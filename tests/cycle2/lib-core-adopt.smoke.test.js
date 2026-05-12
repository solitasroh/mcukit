// Cycle 2 P0 candidate A partial_adopt smoke tests.
// Verifies context-budget + worktree-detector + anonymize-fingerprint
// behavior after rkit-side adoption with FR-09 patches.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { applyBudget, DEFAULT_MAX_CHARS } = require_('../../lib/core/context-budget.js');
const { anonymizeFingerprint, normalizePath } = require_('../../lib/core/anonymize-fingerprint.js');
const { inspectWorktree } = require_('../../lib/core/worktree-detector.js');

test('context-budget: short input passthrough', () => {
  const s = 'hello world';
  assert.equal(applyBudget(s), s);
});

test('context-budget: long input truncated below cap', () => {
  const long = 'a'.repeat(9000);
  const out = applyBudget(long);
  assert.ok(out.length < long.length);
  assert.ok(out.includes('truncated'));
});

test('context-budget: default cap is 8000', () => {
  assert.equal(DEFAULT_MAX_CHARS, 8000);
});

test('context-budget: priority sections preserved', () => {
  const filler = 'b'.repeat(2000);
  const priority = 'MANDATORY: This must survive truncation.';
  const input = [filler, filler, filler, filler, priority, filler, filler].join('\n\n');
  const out = applyBudget(input);
  assert.ok(out.includes(priority), 'priority section must survive truncation');
});

test('anonymize: deterministic (same path → same fp)', () => {
  const a = anonymizeFingerprint('/home/user/project');
  const b = anonymizeFingerprint('/home/user/project');
  assert.equal(a, b);
});

test('anonymize: different paths → different fps', () => {
  const a = anonymizeFingerprint('/home/user/project-a');
  const b = anonymizeFingerprint('/home/user/project-b');
  assert.notEqual(a, b);
});

test('anonymize: length === 14', () => {
  assert.equal(anonymizeFingerprint('/x').length, 14);
});

test('anonymize: no raw username in output', () => {
  const fp = anonymizeFingerprint('/home/alice/project');
  assert.ok(!fp.includes('alice'));
  assert.ok(!fp.includes('home'));
});

test('normalizePath: backslash → slash', () => {
  const n = normalizePath('D:\\work\\project');
  assert.ok(!n.includes('\\'));
  assert.ok(n.includes('/'));
});

test('normalizePath: trailing slash removed', () => {
  assert.equal(normalizePath('/home/user/'), '/home/user');
});

test('normalizePath: win32 vs POSIX case branch', () => {
  const n = normalizePath('/Foo/Bar');
  if (process.platform === 'win32') {
    assert.equal(n, '/foo/bar', 'win32 should lowercase');
  } else {
    assert.equal(n, '/Foo/Bar', 'POSIX should preserve case');
  }
});

test('worktree-detector: inspect returns shape', () => {
  const r = inspectWorktree();
  assert.ok('isWorktree' in r);
  assert.equal(typeof r.isWorktree, 'boolean');
});
