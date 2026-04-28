// tests/code-review/cross-review-dedup.smoke.test.js
//
// Cycle 1.5 FR-07 sanity tests for cross-review fingerprint dedup.
// 5 TC: skipped+unchanged → suppress / skipped+changed → re-emit /
//       fixed → re-emit / fingerprint message-distinct → re-emit /
//       100-entries window → out-of-window match treated as no-match.
//
// These are pure-logic tests against the algorithm spec in
// docs/02-design/features/bkit-gstack-sync-v2-cycle15.design.md §3.4.
// They do NOT call /code-review or git — the helpers are inlined.

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

function fingerprint(file, line, ruleId, severity, message) {
  const head = [...message].slice(0, 80).join('');
  return crypto
    .createHash('sha256')
    .update(`${file.toLowerCase()}:${line}:${ruleId}:${severity}:${head}`)
    .digest('hex');
}

function shouldSuppress(currentFinding, recentHistory, currentCommit, gitDiffNameOnly) {
  for (let i = recentHistory.length - 1; i >= 0; i--) {
    const prev = recentHistory[i];
    for (const f of prev.findings) {
      if (f.fingerprint !== currentFinding.fingerprint) continue;
      if (f.action !== 'skipped') return false;
      let changed;
      try {
        changed = gitDiffNameOnly(prev.commit, currentCommit);
      } catch {
        return false;
      }
      if (changed.includes(currentFinding.file)) return false;
      return true;
    }
  }
  return false;
}

function readJsonlTail(history, n) {
  return history.slice(-n);
}

test('TC-1: skipped + file unchanged → suppress', () => {
  const fp = fingerprint('lib/foo.js', 42, 'no-unused-vars', 'minor', "unused variable 'tmp'");
  const history = [
    { commit: 'aaa111', findings: [{ fingerprint: fp, file: 'lib/foo.js', action: 'skipped' }] },
  ];
  const current = { fingerprint: fp, file: 'lib/foo.js', action: 'open' };
  const result = shouldSuppress(current, history, 'bbb222', () => []);
  assert.equal(result, true, 'should suppress when previously skipped and file unchanged');
});

test('TC-2: skipped + file changed → re-emit', () => {
  const fp = fingerprint('lib/foo.js', 42, 'no-unused-vars', 'minor', "unused variable 'tmp'");
  const history = [
    { commit: 'aaa111', findings: [{ fingerprint: fp, file: 'lib/foo.js', action: 'skipped' }] },
  ];
  const current = { fingerprint: fp, file: 'lib/foo.js', action: 'open' };
  const result = shouldSuppress(current, history, 'bbb222', () => ['lib/foo.js']);
  assert.equal(result, false, 'should re-emit when file modified since prior review');
});

test('TC-3: fixed → always re-emit (regression check)', () => {
  const fp = fingerprint('lib/foo.js', 99, 'max-complexity', 'major', 'complexity 15 > 10');
  const history = [
    { commit: 'aaa111', findings: [{ fingerprint: fp, file: 'lib/foo.js', action: 'fixed' }] },
  ];
  const current = { fingerprint: fp, file: 'lib/foo.js', action: 'open' };
  const result = shouldSuppress(current, history, 'bbb222', () => []);
  assert.equal(result, false, 'fixed/auto_fixed must always be re-checked for regression');
});

test('TC-4: fingerprint differs when message first 80 codepoints differ', () => {
  const fpA = fingerprint('lib/foo.js', 42, 'no-unused-vars', 'minor', "unused variable 'a'");
  const fpB = fingerprint('lib/foo.js', 42, 'no-unused-vars', 'minor', "unused variable 'b'");
  assert.notEqual(fpA, fpB, 'message change must produce different fingerprint');

  const history = [
    { commit: 'aaa111', findings: [{ fingerprint: fpA, file: 'lib/foo.js', action: 'skipped' }] },
  ];
  const currentB = { fingerprint: fpB, file: 'lib/foo.js', action: 'open' };
  const result = shouldSuppress(currentB, history, 'bbb222', () => []);
  assert.equal(result, false, 'distinct fingerprint should not collide with prior skipped item');
});

test('TC-5: 100-entries window — match outside window treated as no-match', () => {
  const fp = fingerprint('lib/foo.js', 42, 'no-unused-vars', 'minor', "unused variable 'tmp'");
  const noise = Array.from({ length: 200 }, (_, i) => ({
    commit: `noise${i}`,
    findings: [
      {
        fingerprint: fingerprint('other.js', i, 'rule', 'minor', `noise ${i}`),
        file: 'other.js',
        action: 'skipped',
      },
    ],
  }));
  const realMatch = {
    commit: 'old001',
    findings: [{ fingerprint: fp, file: 'lib/foo.js', action: 'skipped' }],
  };
  const fullHistory = [realMatch, ...noise];
  const window = readJsonlTail(fullHistory, 100);
  const current = { fingerprint: fp, file: 'lib/foo.js', action: 'open' };
  const result = shouldSuppress(current, window, 'cur', () => []);
  assert.equal(result, false, 'match outside the 100-entries window must NOT suppress');
});
