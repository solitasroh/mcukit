// Cycle 2 FR-09 PII anonymization algorithm tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Inline algorithm replica per Design v0.2 §3.6.
function normalizePath(absPath) {
  const slashed = absPath.replace(/\\/g, '/').replace(/\/$/, '');
  return process.platform === 'win32' ? slashed.toLowerCase() : slashed;
}

function anonymize(salt, absPath) {
  return crypto
    .createHash('sha256')
    .update(salt + ':' + normalizePath(absPath))
    .digest('hex')
    .slice(0, 14);
}

const SALT = 'a'.repeat(64);

test('TC-14: same path → same fingerprint (deterministic)', () => {
  const fp1 = anonymize(SALT, 'D:/work/private/rkit');
  const fp2 = anonymize(SALT, 'D:/work/private/rkit');
  assert.equal(fp1, fp2);
});

test('TC-15: different path → different fingerprint', () => {
  const fp1 = anonymize(SALT, 'D:/work/private/rkit');
  const fp2 = anonymize(SALT, 'D:/work/private/other');
  assert.notEqual(fp1, fp2);
});

test('TC-18: fingerprint length === 14', () => {
  const fp = anonymize(SALT, '/home/user/project');
  assert.equal(fp.length, 14);
});

test('TC-42: POSIX case-sensitive on non-win32 / case-insensitive on win32', () => {
  const fpA = anonymize(SALT, '/Foo');
  const fpB = anonymize(SALT, '/foo');
  if (process.platform === 'win32') {
    assert.equal(fpA, fpB, 'win32 lowercase → same fp');
  } else {
    assert.notEqual(fpA, fpB, 'POSIX preserves case → different fp');
  }
});

test('normalize: trailing slash removed', () => {
  const fp1 = anonymize(SALT, '/home/user/project');
  const fp2 = anonymize(SALT, '/home/user/project/');
  assert.equal(fp1, fp2);
});

test('normalize: backslash converted to slash', () => {
  const fp1 = anonymize(SALT, 'D:\\work\\rkit');
  const fp2 = anonymize(SALT, 'D:/work/rkit');
  assert.equal(fp1, fp2);
});

test('TC-17: no raw username in output', () => {
  const fp = anonymize(SALT, '/home/alice/project');
  assert.ok(!fp.includes('alice'));
  assert.ok(!fp.includes('home'));
});
