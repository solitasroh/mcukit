// PR #6 추가 리뷰 fix — audit sanitize depth + memory-io quarantine 직접 검증.
// 이전 누락: Gap-1 (audit-logger depth-3 경계), Gap-4 (memory-io 3 분기),
//           Gap-5 (cyclic + 배열 중첩).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { sanitizeDetails } = require_('../../lib/audit/audit-logger.js');

// ─── audit-logger.sanitizeDetails depth-3 경계 ──────────────────────────

test('Gap-1: depth 1 password redacted (root.token)', () => {
  const r = sanitizeDetails({ token: 'leak1' });
  assert.equal(r.token, '[REDACTED]');
});

test('Gap-1: depth 2 password redacted (a.password)', () => {
  const r = sanitizeDetails({ a: { password: 'leak2' } });
  assert.equal(r.a.password, '[REDACTED]');
});

test('Gap-1: depth 3 password redacted (a.b.password)', () => {
  const r = sanitizeDetails({ a: { b: { password: 'leak3' } } });
  // At depth=3 (the value of a.b is at depth 2; its props are evaluated at depth 3)
  // sanitizeValue's depth check is BEFORE the key-redact loop, so depth 3 returns
  // '[truncated-depth]' (the entire a.b becomes that string).
  // Either redaction (preferred) OR truncated-depth is acceptable — both prevent leak.
  const inner = r.a.b;
  const leaked = typeof inner === 'object' && inner !== null && inner.password === 'leak3';
  assert.ok(!leaked, `expected redaction or truncation, got ${JSON.stringify(inner)}`);
});

test('Gap-1: depth 4 truncated (a.b.c.password)', () => {
  const r = sanitizeDetails({ a: { b: { c: { password: 'leak4' } } } });
  // c is at depth 3 — should be truncated entirely
  assert.notDeepEqual(r.a.b.c, { password: 'leak4' }, 'depth-4 nested must not leak raw value');
});

test('Gap-5: cyclic object does not crash sanitize', () => {
  const a = { name: 'root' };
  a.self = a;
  // Should not throw / infinite loop
  const r = sanitizeDetails({ payload: a });
  assert.ok(r, 'cyclic input must produce some result');
  // Either non-serializable sentinel or truncated-depth — both safe
  assert.ok(typeof r.payload !== 'undefined');
});

test('Gap-5: array containing object with sensitive key', () => {
  const r = sanitizeDetails({ list: [{ password: 'leak-arr' }] });
  assert.ok(Array.isArray(r.list), 'array preserved');
  assert.equal(r.list[0].password, '[REDACTED]', 'array element nested key redacted');
});

test('Gap-5: nested arrays preserve structure', () => {
  const r = sanitizeDetails({ matrix: [[1, 2], [3, 4]] });
  assert.deepEqual(r.matrix, [[1, 2], [3, 4]]);
});

test('Gap-1: long string truncated', () => {
  const long = 'x'.repeat(5000);
  const r = sanitizeDetails({ payload: long });
  assert.ok(r.payload.length < long.length, 'long strings must be capped');
  assert.match(r.payload, /…\[truncated\]$/);
});

test('Gap-1: arrays at root return empty object', () => {
  // Current contract: sanitizeDetails returns {} for non-object input
  const r = sanitizeDetails([1, 2, 3]);
  assert.deepEqual(r, {});
});

test('Gap-1: primitives passthrough (number, boolean, null)', () => {
  const r = sanitizeDetails({ n: 42, b: true, x: null });
  assert.equal(r.n, 42);
  assert.equal(r.b, true);
  assert.equal(r.x, null);
});

// ─── memory-io readMemory quarantine 3 분기 ──────────────────────────

function withTempMemory(content, fn) {
  // memory-io reads from STATE_PATHS.memory() which derives from project paths.
  // We test by writing a corrupted file at the actual path and verifying behavior.
  const { readMemory } = require_('../../lib/pdca/status/memory-io.js');
  const paths = require_('../../lib/core/paths');
  const memoryPath = paths.STATE_PATHS.memory();
  const memoryDir = path.dirname(memoryPath);

  // Backup existing memory if present
  let backup = null;
  if (fs.existsSync(memoryPath)) {
    backup = fs.readFileSync(memoryPath, 'utf8');
  }
  fs.mkdirSync(memoryDir, { recursive: true });

  // Clean up quarantine files first (defensive)
  for (const f of fs.readdirSync(memoryDir)) {
    if (f.startsWith(path.basename(memoryPath) + '.corrupted.')) {
      fs.unlinkSync(path.join(memoryDir, f));
    }
  }

  try {
    fs.writeFileSync(memoryPath, content, 'utf8');
    const result = readMemory();
    const quarantineFiles = fs.readdirSync(memoryDir).filter((f) =>
      f.startsWith(path.basename(memoryPath) + '.corrupted.')
    );
    fn({ result, quarantineFiles, memoryPath, memoryDir });
  } finally {
    // Restore
    for (const f of fs.readdirSync(memoryDir)) {
      if (f.startsWith(path.basename(memoryPath) + '.corrupted.')) {
        try { fs.unlinkSync(path.join(memoryDir, f)); } catch {}
      }
    }
    if (backup != null) {
      fs.writeFileSync(memoryPath, backup, 'utf8');
    } else if (fs.existsSync(memoryPath)) {
      try { fs.unlinkSync(memoryPath); } catch {}
    }
  }
}

test('Gap-4: corrupt JSON (non-empty invalid) triggers quarantine', () => {
  withTempMemory('{not valid json', ({ result, quarantineFiles }) => {
    assert.equal(result, null, 'returns null on corruption');
    assert.ok(quarantineFiles.length >= 1, `expected quarantine file, got ${quarantineFiles.length}`);
  });
});

test('Gap-4: empty file returns null without quarantine', () => {
  withTempMemory('', ({ result, quarantineFiles }) => {
    assert.equal(result, null);
    assert.equal(quarantineFiles.length, 0, 'empty file should not be quarantined');
  });
});

test('Gap-4: whitespace-only returns null without quarantine', () => {
  withTempMemory('   \n   ', ({ result, quarantineFiles }) => {
    assert.equal(result, null);
    assert.equal(quarantineFiles.length, 0, 'whitespace-only should not be quarantined');
  });
});

test('Gap-4: valid JSON returns parsed object', () => {
  withTempMemory(JSON.stringify({ test: 'value', n: 42 }), ({ result, quarantineFiles }) => {
    assert.deepEqual(result, { test: 'value', n: 42 });
    assert.equal(quarantineFiles.length, 0);
  });
});

// ─── verify-policy violation fixture (Gap-2 + Gap-3) ───────────────────

test('Gap-2: invalid blocked_pattern surfaces as error (static contract)', () => {
  // verify-policy.js must contain the noisy-fail compile loop.
  const src = fs.readFileSync('scripts/verify-policy.js', 'utf8');
  // Pattern compiles outside the per-file scan loop, with errors.push on failure
  assert.match(src, /errors\.push\(`policies\/network-allowlist\.json: invalid blocked_pattern/);
});

test('Gap-3: escalation-policy required for cycle 3+ (static contract)', () => {
  const src = fs.readFileSync('scripts/verify-policy.js', 'utf8');
  // maxCycleSeen tracking + conditional error push
  assert.match(src, /maxCycleSeen.*>=.*3/s);
  assert.match(src, /escalation-policy\.json required for cycle/);
});

test('audit-logger header reflects depth-3 + arrays', () => {
  const src = fs.readFileSync('lib/audit/audit-logger.js', 'utf8');
  assert.match(src, /MAX_DEPTH=3/);
  assert.match(src, /Arrays are sanitized element-wise/);
});

test('memory-io header documents two quarantine paths', () => {
  const src = fs.readFileSync('lib/pdca/status/memory-io.js', 'utf8');
  assert.match(src, /Two quarantine entry paths/);
});

test('anonymize-fingerprint user-empty refuses ACL (fail-loud)', () => {
  const src = fs.readFileSync('lib/core/anonymize-fingerprint.js', 'utf8');
  assert.match(src, /cannot resolve user principal — skipping ACL/);
});

test('scan-canary surfaces unreadable files', () => {
  const src = fs.readFileSync('scripts/security/scan-canary.mjs', 'utf8');
  assert.match(src, /unreadable\.push/);
  assert.match(src, /unreadable file\(s\) skipped/);
});
