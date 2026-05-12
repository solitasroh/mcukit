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

test('current cycle 3, sunset cycle-4 → WARN', () => {
  const r = evaluate(ng.items, 3);
  assert.deepEqual(r.warnings.sort(), ['network_egress', 'regression_retention'].sort());
  assert.equal(r.failures.length, 0);
});

test('current cycle 4, sunset cycle-4 → FAIL', () => {
  const r = evaluate(ng.items, 4);
  assert.deepEqual(r.failures.sort(), ['network_egress', 'regression_retention'].sort());
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
