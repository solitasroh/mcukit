// Cycle 5 smoke — 73 SKILL 100% conversion + cycle5-matrix.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cycle5 = JSON.parse(fs.readFileSync('policies/decisions/cycle5-matrix.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('policies/manifest.json', 'utf8'));

const NEUTRAL_20 = [
  'arch-lock', 'audit', 'benchmark', 'btw', 'cc-version-analysis',
  'claude-code-learning', 'control', 'deploy', 'desktop-app',
  'development-pipeline', 'do-reverse-spec', 'guard', 'mermaid',
  'mobile-app', 'pdca-batch', 'plan-plus', 'pm-discovery', 'reframe',
  'rkit-rules', 'zero-script-qa',
];
const GRANDFATHERED_7 = [
  'op-create-task', 'op-standup', 'op-status', 'op-task',
  'openproject-conventions', 'mr-conventions', 'project-workspace',
];

test('cycle5-matrix: 1 candidate, CR5-1 adopt', () => {
  assert.equal(cycle5.candidates.length, 1);
  const c = cycle5.candidates[0];
  assert.equal(c.id, 'CR5-1');
  assert.equal(c.decision, 'adopt');
  assert.ok(c.reasoning.length >= 50);
  assert.ok(c.evidence.length >= 2);
});

test('manifest registers cycle5-matrix', () => {
  const e = manifest.sots.find((s) => s.path === 'decisions/cycle5-matrix.json');
  assert.ok(e);
  assert.equal(e.since, 'cycle-5');
});

test('20 neutral SKILLs have cycle3 marker', () => {
  const BEGIN = '<!-- BEGIN: cycle3-body-neutral -->';
  for (const name of NEUTRAL_20) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    assert.ok(text.includes(BEGIN), `${name} missing BEGIN marker`);
    assert.ok(/^## 0\. 문서 구조/m.test(text), `${name} missing § 0`);
  }
});

test('7 grandfathered SKILLs have grandfathered: true', () => {
  for (const name of GRANDFATHERED_7) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    assert.match(text, /^grandfathered:\s*true/m, `${name} missing grandfathered: true`);
    assert.ok(/^## 0\. 문서 구조/m.test(text), `${name} missing § 0`);
  }
});

test('73 SKILL 100% — untouched 0', () => {
  const skills = fs.readdirSync('skills').filter((d) => {
    try { return fs.statSync(`skills/${d}`).isDirectory() && fs.existsSync(`skills/${d}/SKILL.md`); }
    catch { return false; }
  });
  let untouched = 0;
  for (const name of skills) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    const has15 = text.includes('cycle15-body-neutral');
    const has3 = text.includes('cycle3-body-neutral');
    const grand = /^grandfathered:\s*true/m.test(text);
    if (!has15 && !has3 && !grand) untouched++;
  }
  assert.equal(untouched, 0, `expected 0 untouched, got ${untouched}`);
});

test('CR4-6 unblock chain — escalation_history references cycle 4', () => {
  const c = cycle5.candidates[0];
  assert.equal(c.predecessor_decision.cycle, '4');
  assert.equal(c.predecessor_decision.candidate_id, 'CR4-6');
  assert.equal(c.escalation_count, 1);
  assert.equal(c.escalation_history.length, 1);
});
