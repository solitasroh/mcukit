// Cycle 3 D-3 STRICT gate smoke tests.
// Verifies R1~R7 + escalation policy + STRICT flag + cycle 2 legacy 면제.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cycle3 = JSON.parse(fs.readFileSync('policies/decisions/cycle3-matrix.json', 'utf8'));
const cycle2 = JSON.parse(fs.readFileSync('policies/decisions/cycle2-matrix.json', 'utf8'));
const escalation = JSON.parse(fs.readFileSync('policies/escalation-policy.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('policies/manifest.json', 'utf8'));

test('manifest registers cycle3-matrix.json', () => {
  const entry = manifest.sots.find((s) => s.path === 'decisions/cycle3-matrix.json');
  assert.ok(entry, 'cycle3-matrix.json must be registered');
  assert.equal(entry.since, 'cycle-3');
});

test('manifest registers escalation-policy.json', () => {
  const entry = manifest.sots.find((s) => s.path === 'escalation-policy.json');
  assert.ok(entry, 'escalation-policy.json must be registered');
});

test('cycle3-matrix has 8 candidates', () => {
  assert.equal(cycle3.candidates.length, 8);
});

test('cycle3-matrix STRICT mode declared', () => {
  assert.equal(cycle3.strict_mode, true);
  assert.equal(cycle3.cycle, '3');
});

test('R1: all non-pending reasoning >= 50 chars (cycle 3)', () => {
  for (const c of cycle3.candidates) {
    if (c.decision === 'pending') continue;
    assert.ok(c.reasoning.length >= 50, `${c.id} reasoning too short: ${c.reasoning.length}`);
  }
});

test('R2: defer requires both unblock_condition AND revisit_by (cycle 3)', () => {
  for (const c of cycle3.candidates) {
    if (c.decision !== 'defer') continue;
    assert.ok(c.unblock_condition, `${c.id} (defer) missing unblock_condition`);
    assert.ok(c.revisit_by, `${c.id} (defer) missing revisit_by`);
  }
});

test('R3: unblock_condition rejects vague cycle-N patterns', () => {
  const VAGUE = /^cycle-?\d+\s*(이월|carry.?over|defer|연기)\s*$/i;
  for (const c of cycle3.candidates) {
    if (c.decision !== 'defer') continue;
    assert.ok(!VAGUE.test(c.unblock_condition.trim()), `${c.id} unblock_condition matches vague pattern`);
  }
});

test('R4: unblock_condition >= 30 chars', () => {
  for (const c of cycle3.candidates) {
    if (c.decision !== 'defer') continue;
    assert.ok(c.unblock_condition.length >= 30, `${c.id} unblock too short: ${c.unblock_condition.length}`);
  }
});

test('R6: revisit_by matches /^cycle-N(\\.M)?$/', () => {
  const FMT = /^cycle-\d+(\.\d+)?$/;
  for (const c of cycle3.candidates) {
    if (c.decision !== 'defer') continue;
    assert.ok(FMT.test(c.revisit_by), `${c.id} revisit_by invalid format: ${c.revisit_by}`);
  }
});

test('R7: adopt/partial_adopt evidence >= 2', () => {
  for (const c of cycle3.candidates) {
    if (c.decision !== 'adopt' && c.decision !== 'partial_adopt') continue;
    assert.ok(c.evidence.length >= 2, `${c.id} evidence too few: ${c.evidence.length}`);
  }
});

test('escalation_count >= 2 defer requires override_reason >= 80 chars', () => {
  for (const c of cycle3.candidates) {
    if (c.decision !== 'defer') continue;
    if ((c.escalation_count || 0) < 2) continue;
    assert.ok(c.override_reason, `${c.id} missing override_reason`);
    assert.ok(c.override_reason.length >= 80, `${c.id} override_reason too short: ${c.override_reason.length}`);
  }
});

test('escalation_count >= 2 defer requires final_revisit_by', () => {
  for (const c of cycle3.candidates) {
    if (c.decision !== 'defer') continue;
    if ((c.escalation_count || 0) < 2) continue;
    assert.ok(c.final_revisit_by, `${c.id} missing final_revisit_by`);
  }
});

test('escalation_count >= 3 prohibits defer', () => {
  for (const c of cycle3.candidates) {
    if ((c.escalation_count || 0) >= escalation.thresholds.prohibit_at) {
      assert.notEqual(c.decision, 'defer', `${c.id} escalation=${c.escalation_count} must not defer`);
    }
  }
});

test('CR-7 marked as permanent_reject', () => {
  const c7 = cycle3.candidates.find((c) => c.id === 'CR-7');
  assert.equal(c7.decision, 'reject');
  assert.equal(c7.permanent_reject, true);
});

test('cycle_origin field present on all candidates', () => {
  for (const c of cycle3.candidates) {
    assert.ok(['cycle-2-carryover', 'cycle-3-new'].includes(c.cycle_origin), `${c.id} cycle_origin invalid`);
  }
});

test('predecessor_decision required for cycle-2-carryover', () => {
  for (const c of cycle3.candidates) {
    if (c.cycle_origin !== 'cycle-2-carryover') continue;
    assert.ok(c.predecessor_decision, `${c.id} carryover must have predecessor_decision`);
    assert.equal(c.predecessor_decision.cycle, '2');
  }
});

test('completion gate: no candidates pending', () => {
  const pending = cycle3.candidates.filter((c) => c.decision === 'pending');
  assert.deepEqual(pending.map((c) => c.id), []);
});

test('legacy: cycle 2 matrix STRICT flag absent (legacy rules apply)', () => {
  assert.notEqual(cycle2.strict_mode, true, 'cycle 2 must remain legacy — STRICT false');
});

test('escalation-policy.json schema', () => {
  assert.equal(escalation.thresholds.warn_at, 1);
  assert.equal(escalation.thresholds.fail_at, 2);
  assert.equal(escalation.thresholds.prohibit_at, 3);
});
