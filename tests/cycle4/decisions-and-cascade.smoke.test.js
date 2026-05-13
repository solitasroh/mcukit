// Cycle 4 PR-1 + PR-5 — cycle4-matrix decisions + cascade + escalation_history smoke.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cycle4 = JSON.parse(fs.readFileSync('policies/decisions/cycle4-matrix.json', 'utf8'));
const cycle3 = JSON.parse(fs.readFileSync('policies/decisions/cycle3-matrix.json', 'utf8'));
const cycle2 = JSON.parse(fs.readFileSync('policies/decisions/cycle2-matrix.json', 'utf8'));
const escalation = JSON.parse(fs.readFileSync('policies/escalation-policy.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('policies/manifest.json', 'utf8'));
const neverGate = JSON.parse(fs.readFileSync('policies/never-gate.json', 'utf8'));

test('TC-C4-01: cycle4-matrix 7 candidates non-pending', () => {
  assert.equal(cycle4.candidates.length, 7);
  for (const c of cycle4.candidates) {
    assert.notEqual(c.decision, 'pending', `${c.id} must not be pending`);
  }
});

test('TC-C4-02: CR4-1 permanent_reject + reasoning >= 50 + evidence >= 2', () => {
  const c = cycle4.candidates.find((x) => x.id === 'CR4-1');
  assert.equal(c.decision, 'reject');
  assert.equal(c.permanent_reject, true);
  assert.ok(c.reasoning.length >= 50);
  assert.ok(c.evidence.length >= 2);
});

test('TC-C4-03: CR4-1 escalation_count=3 + history.length=3', () => {
  const c = cycle4.candidates.find((x) => x.id === 'CR4-1');
  assert.equal(c.escalation_count, 3);
  assert.equal(c.escalation_history.length, 3);
  assert.equal(c.escalation_history[0].cycle, '2');
  assert.equal(c.escalation_history[1].cycle, '3');
  assert.equal(c.escalation_history[2].cycle, '4');
});

test('TC-C4-04: CR4-3 cascade_origin=true + escalation_count=0', () => {
  const c = cycle4.candidates.find((x) => x.id === 'CR4-3');
  assert.equal(c.cascade_origin, true);
  assert.equal(c.cascade_parent, 'CR-2');
  assert.equal(c.escalation_count, 0);
});

test('TC-C4-05: CR4-3 reasoning includes 도메인 부재 검증', () => {
  const c = cycle4.candidates.find((x) => x.id === 'CR4-3');
  assert.match(c.reasoning, /lib\/cost.*lib\/metering.*lib\/telemetry|토큰.*도메인/);
});

test('TC-C4-06: never-gate network_egress promoted to permanent (no sunset)', () => {
  const item = neverGate.items.find((x) => x.id === 'network_egress');
  assert.equal(item.scope, 'permanent');
  assert.ok(!item.sunset, 'sunset field must be removed after promotion');
  assert.equal(item.promoted_at, 'cycle-4');
  assert.equal(item.promoted_from, 'transitional');
});

test('TC-C4-07: never-gate regression_retention removed', () => {
  const item = neverGate.items.find((x) => x.id === 'regression_retention');
  assert.equal(item, undefined, 'regression_retention should be removed');
});

test('TC-C4-08: canary-patterns.json has 6+ patterns', () => {
  const cp = JSON.parse(fs.readFileSync('scripts/security/canary-patterns.json', 'utf8'));
  assert.ok(cp.patterns.length >= 6, `expected >= 6 patterns, got ${cp.patterns.length}`);
  for (const p of cp.patterns) {
    assert.ok(p.id);
    assert.ok(p.regex);
    assert.ok(p.severity);
  }
});

test('TC-C4-09: scan-canary.mjs exists + executable', () => {
  assert.ok(fs.existsSync('scripts/security/scan-canary.mjs'));
  const src = fs.readFileSync('scripts/security/scan-canary.mjs', 'utf8');
  assert.match(src, /loadConfig|patterns/);
  assert.match(src, /shouldExclude|exclusion/);
});

test('TC-C4-11: check-sunset.js permanent scope skip 명시', () => {
  const src = fs.readFileSync('scripts/check-sunset.js', 'utf8');
  assert.match(src, /scope === 'permanent'/);
});

test('TC-C4-12: verify-policy expectedCounts[4] === 7', () => {
  const src = fs.readFileSync('scripts/verify-policy.js', 'utf8');
  assert.match(src, /'4':\s*7/);
});

test('TC-C4-13: escalation_history 3 entries (cycle 2/3/4 refs)', () => {
  const c = cycle4.candidates.find((x) => x.id === 'CR4-1');
  const refs = c.escalation_history.map((e) => e.matrix_ref);
  assert.match(refs[0], /cycle2-matrix\.json/);
  assert.match(refs[1], /cycle3-matrix\.json/);
  assert.match(refs[2], /cycle4-matrix\.json/);
});

test('TC-C4-15: escalation_count=3 + decision=reject satisfies prohibit_at (not defer)', () => {
  for (const c of cycle4.candidates) {
    if ((c.escalation_count || 0) >= escalation.thresholds.prohibit_at) {
      assert.notEqual(c.decision, 'defer', `${c.id} escalation=${c.escalation_count} must not defer`);
    }
  }
});

test('TC-C4-16: gdpr-cc-regression.md obsolete banner', () => {
  const src = fs.readFileSync('docs/policy/gdpr-cc-regression.md', 'utf8');
  assert.match(src, /Status.*OBSOLETE/i);
  assert.match(src, /CR4-1/);
});

test('TC-C4-17: pdca-regression-purge.mjs @deprecated marker', () => {
  const src = fs.readFileSync('scripts/pdca-regression-purge.mjs', 'utf8');
  assert.match(src, /@deprecated.*CR4-1/);
});

test('TC-C4-18: CR4-6 defer revisit_by cycle-5 + unblock 통과 R3-R5', () => {
  const c = cycle4.candidates.find((x) => x.id === 'CR4-6');
  assert.equal(c.decision, 'defer');
  assert.equal(c.revisit_by, 'cycle-5');
  assert.ok(c.unblock_condition.length >= 30, 'R4: unblock_condition >= 30 chars');
  const VAGUE = /^cycle-?\d+\s*(이월|carry.?over|defer|연기)\s*$/i;
  assert.ok(!VAGUE.test(c.unblock_condition.trim()), 'R3: not vague');
  assert.match(c.unblock_condition, /(executed|implemented|completed|resolved|passes|adopted|written|exists|integrated|merged|verified)/i);
});

test('TC-C4-19: canary-patterns exclusion_globs >= 8', () => {
  const cp = JSON.parse(fs.readFileSync('scripts/security/canary-patterns.json', 'utf8'));
  assert.ok((cp.exclusion_globs || []).length >= 8);
});

test('TC-C4-20: permanent_reject 플래그 3+ candidates', () => {
  const permRejects = cycle4.candidates.filter((c) => c.permanent_reject === true);
  assert.ok(permRejects.length >= 3, `expected >= 3 permanent_reject, got ${permRejects.length}`);
});

test('TC-C4-21: manifest registers cycle4-matrix', () => {
  const e = manifest.sots.find((s) => s.path === 'decisions/cycle4-matrix.json');
  assert.ok(e);
  assert.equal(e.since, 'cycle-4');
});

test('TC-C4-22: CR4-7 canary adopt + canary-patterns.json reference', () => {
  const c = cycle4.candidates.find((x) => x.id === 'CR4-7');
  assert.equal(c.decision, 'adopt');
  assert.ok(c.reasoning.length >= 50);
});

test('TC-C4-23: cycle 2/3 matrices unchanged (SoT 동결)', () => {
  // cycle 2/3 candidates count match
  assert.equal(cycle2.candidates.length, 11);
  assert.equal(cycle3.candidates.length, 8);
});

test('TC-C4-24: completion gate rule string mentions prohibit_at', () => {
  assert.match(cycle4.completion_gate.rule, /prohibit_at|cascade_origin/);
});

test('TC-C4-25: expected_candidate_count === 7', () => {
  assert.equal(cycle4.expected_candidate_count, 7);
});
