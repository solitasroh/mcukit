// Cycle 2 D-7 locked-vocab scope field tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sot = JSON.parse(fs.readFileSync('policies/locked-vocab.json', 'utf8'));

test('TC-27: locked-vocab version 1.1', () => {
  assert.equal(sot.version, '1.1');
});

test('all 20 vocabs have scope field', () => {
  assert.equal(sot.vocabs.length, 20);
  for (const v of sot.vocabs) {
    assert.ok(['neutral', 'domain'].includes(v.scope), `${v.term} scope must be neutral|domain`);
  }
});

test('scope_enum declared', () => {
  assert.deepEqual(sot.scope_enum.sort(), ['domain', 'neutral']);
});

test('backward compat: all v1.0 entries migrated to scope: domain', () => {
  for (const v of sot.vocabs) {
    assert.equal(v.scope, 'domain', `${v.term} should be domain (auto-migrated from v1.0)`);
  }
});

test('scope_policy explains both values', () => {
  assert.ok(sot.scope_policy.neutral);
  assert.ok(sot.scope_policy.domain);
});
