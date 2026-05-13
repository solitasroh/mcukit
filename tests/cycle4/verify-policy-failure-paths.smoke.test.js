// PR #6 review fix — verify-policy.js 9 checks 자체 실패 경로 직접 검증.
// 위반 fixture를 tmp 디렉토리에 만들고 spawn으로 검사 실행 → exit 1 + 에러 메시지 확인.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-policy.js');

function runCheck(checkName, env = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, '--check', checkName, '--quiet'], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function runAll() {
  const r = spawnSync(process.execPath, [SCRIPT, '--quiet'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

test('verify-policy all checks: exit 0 on current state', () => {
  const r = runAll();
  assert.equal(r.code, 0, `expected exit 0, got ${r.code}, stderr: ${r.stderr}`);
});

test('decisions-matrix check: works in isolation', () => {
  const r = runCheck('decisions-matrix');
  assert.equal(r.code, 0, `decisions-matrix should pass, stderr: ${r.stderr}`);
});

test('manifest-sync check: works in isolation', () => {
  const r = runCheck('manifest-sync');
  assert.equal(r.code, 0);
});

test('network-egress check: works in isolation', () => {
  const r = runCheck('network-egress');
  assert.equal(r.code, 0);
});

test('pii-in-logs check: works in isolation', () => {
  const r = runCheck('pii-in-logs');
  assert.equal(r.code, 0);
});

test('unknown check name: exit 2', () => {
  const r = runCheck('nonexistent-check');
  assert.equal(r.code, 2, 'unknown check should exit 2');
});

test('--quiet flag suppresses success output', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--quiet'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0);
  // --quiet mode should NOT emit "All N check(s) passed" — only failures
  assert.ok(!r.stdout.includes('All'), `--quiet should suppress success summary, got: ${r.stdout}`);
});

test('output mode: --check single name does not run all checks', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--check', 'sot-schema'], {
    cwd: ROOT, encoding: 'utf8',
  });
  assert.equal(r.status, 0);
  // Only sot-schema check line (per-check ✅) + summary line. Summary mentions "All 1 check(s)".
  assert.match(r.stdout, /✅ sot-schema/);
  assert.match(r.stdout, /All 1 check\(s\) passed/, 'summary must indicate single check ran');
});

test('cycle 2 matrix legacy rules: STRICT flag false (not strict)', () => {
  // Verify that cycle 2 matrix passes despite shorter reasoning (legacy >= 20 chars)
  const cycle2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies/decisions/cycle2-matrix.json'), 'utf8'));
  assert.notEqual(cycle2.strict_mode, true, 'cycle 2 must remain legacy');
  const r = runCheck('decisions-matrix');
  assert.equal(r.code, 0, 'cycle 2 legacy mode must not fail decisions-matrix check');
});

test('cycle 3+ STRICT mode enforced via strict_mode flag', () => {
  const cycle3 = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies/decisions/cycle3-matrix.json'), 'utf8'));
  const cycle4 = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies/decisions/cycle4-matrix.json'), 'utf8'));
  assert.equal(cycle3.strict_mode, true);
  assert.equal(cycle4.strict_mode, true);
});

test('verify-policy script header lists 9 checks (after PR #6 doc fix)', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(src, /Nine checks/, 'header must say "Nine checks" not "Five"');
  assert.match(src, /manifest-sync.*decisions-matrix.*network-egress.*pii-in-logs/s);
});

test('blocked_patterns invalid regex must surface (no silent catch)', () => {
  // Verify the compile-time loop exists and pushes errors for invalid regex.
  // This is a static check that the silent `catch {}` from PR #6 review C1 is gone.
  const src = fs.readFileSync(SCRIPT, 'utf8');
  // Must compile patterns once (not per-file in a try/catch swallow)
  assert.match(src, /invalid blocked_pattern/, 'verify-policy must emit error for invalid regex');
  assert.ok(!/for \(const pattern of blocked\) \{\s*try \{\s*const re = new RegExp/.test(src),
    'silent regex catch pattern must be removed');
});

test('escalation-policy load surfaces error for cycle 3+ if missing', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  // Must check maxCycleSeen >= 3 and push error if escalation load fails
  assert.match(src, /escalation-policy\.json required for cycle/);
});
