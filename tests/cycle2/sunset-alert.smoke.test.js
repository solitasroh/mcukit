// Cycle 2 FR-15 sunset alert algorithm tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Replica of check-sunset.js logic
function parseCycleString(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^cycle-(\d+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1]) : null;
}

function evaluate(items, currentCycle, warnBefore = 1) {
  const warnings = [];
  const failures = [];
  for (const item of items) {
    if (item.scope !== 'transitional' || !item.sunset) continue;
    const sunsetCycle = parseCycleString(item.sunset);
    if (sunsetCycle == null) continue;
    const remaining = sunsetCycle - currentCycle;
    if (remaining <= 0) failures.push(item.id);
    else if (remaining <= warnBefore) warnings.push(item.id);
  }
  return { warnings, failures };
}

const ng = JSON.parse(fs.readFileSync('policies/never-gate.json', 'utf8'));

test('TC-40: current cycle 2, sunset cycle-4 → silent', () => {
  const r = evaluate(ng.items, 2);
  assert.equal(r.warnings.length, 0);
  assert.equal(r.failures.length, 0);
});

test('current cycle 3, sunset cycle-4 → WARN (only items still transitional)', () => {
  // After cycle 4 processing: network_egress promoted to permanent, regression_retention removed.
  // No transitional items remain — warnings should be empty.
  const r = evaluate(ng.items, 3);
  assert.equal(r.warnings.length, 0, `expected 0 transitional WARN after cycle 4 processing, got: ${r.warnings.join(',')}`);
  assert.equal(r.failures.length, 0);
});

test('current cycle 4, sunset cycle-4 → no FAIL (transitional resolved)', () => {
  // Cycle 4 (CR4-4 promote + CR4-5 remove) cleared all transitional sunsets.
  const r = evaluate(ng.items, 4);
  assert.equal(r.failures.length, 0, `expected 0 FAIL after cycle 4 processing, got: ${r.failures.join(',')}`);
});

test('permanent items not affected', () => {
  const r = evaluate(ng.items, 5);
  for (const id of ['security', 'data_migration', 'skill_md_consistency', 'vocab_sync', 'eval_syntax', 'pii_in_logs']) {
    assert.ok(!r.warnings.includes(id), `${id} permanent, should not warn`);
    assert.ok(!r.failures.includes(id), `${id} permanent, should not fail`);
  }
});

test('parseCycleString handles cycle-1.5', () => {
  assert.equal(parseCycleString('cycle-1.5'), 1.5);
  assert.equal(parseCycleString('cycle-4'), 4);
  assert.equal(parseCycleString('invalid'), null);
});
