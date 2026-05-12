// Cycle 2 FR-08 cc-regression retention algorithm tests.
import test from 'node:test';
import assert from 'node:assert/strict';

// retention filter replica (matches pdca-regression-purge.mjs logic)
function filterByRetention(lines, retentionDays, nowMs = Date.now()) {
  const cutoff = nowMs - retentionDays * 86400 * 1000;
  return lines.filter((l) => {
    try {
      return new Date(JSON.parse(l).timestamp).getTime() >= cutoff;
    } catch {
      return true; // malformed preserved
    }
  });
}

const NOW = new Date('2026-04-28T00:00:00Z').getTime();

function entry(daysAgo) {
  return JSON.stringify({
    timestamp: new Date(NOW - daysAgo * 86400 * 1000).toISOString(),
    fingerprint: 'a'.repeat(14),
    sessionFp: 'b'.repeat(14),
    promptHash: 'sha256:' + 'c'.repeat(64),
    outputHash: 'sha256:' + 'd'.repeat(64),
    tokenIn: 100,
    tokenOut: 50,
    errorType: 'null',
    tag: 'cycle-2-A',
  });
}

test('TC-11: 91 days ago → purge target', () => {
  const lines = [entry(91), entry(10), entry(1)];
  const kept = filterByRetention(lines, 90, NOW);
  assert.equal(kept.length, 2);
  assert.ok(!kept.includes(entry(91)));
});

test('boundary: exactly 90 days ago kept (>=)', () => {
  const lines = [entry(90), entry(91)];
  const kept = filterByRetention(lines, 90, NOW);
  assert.equal(kept.length, 1);
  assert.equal(kept[0], entry(90));
});

test('malformed line preserved', () => {
  const lines = ['not-json', entry(1)];
  const kept = filterByRetention(lines, 90, NOW);
  assert.equal(kept.length, 2);
});

test('TC-43: tag regex validation', () => {
  const tagRegex = /^cycle-\d+(\.\d+)?-[A-Z0-9-]+$|^CO-\d+$/;
  assert.ok(tagRegex.test('cycle-2-A'));
  assert.ok(tagRegex.test('cycle-1.5-CODE-REVIEW'));
  assert.ok(tagRegex.test('CO-4'));
  // PII-style tag rejected
  assert.ok(!tagRegex.test('user-alice'));
  assert.ok(!tagRegex.test('/home/alice/project'));
  assert.ok(!tagRegex.test('cycle-2 with spaces'));
});
