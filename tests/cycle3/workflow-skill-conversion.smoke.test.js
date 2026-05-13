// Cycle 3 PR-A — Workflow SKILL body/appendix 변환 smoke tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_7 = ['pdca', 'mr', 'ship', 'rollback', 'freeze', 'skill-create', 'skill-status'];
const BEGIN = '<!-- BEGIN: cycle3-body-neutral -->';
const END = '<!-- END: cycle3-body-neutral -->';

test('PR-A: 7 Workflow SKILLs have cycle3 marker pair', () => {
  for (const name of WORKFLOW_7) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    assert.ok(text.includes(BEGIN), `${name} missing BEGIN marker`);
    assert.ok(text.includes(END), `${name} missing END marker`);
  }
});

test('PR-A: marker order BEGIN < END', () => {
  for (const name of WORKFLOW_7) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    const b = text.indexOf(BEGIN);
    const e = text.indexOf(END);
    assert.ok(b < e, `${name} BEGIN must precede END`);
  }
});

test('PR-A: § 0 section present', () => {
  for (const name of WORKFLOW_7) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    assert.ok(/^## 0\. 문서 구조/m.test(text), `${name} missing § 0 section`);
  }
});

test('PR-A: skill-body-extract.mjs exists and is executable JS', () => {
  const stat = fs.statSync('scripts/skill-body-extract.mjs');
  assert.ok(stat.isFile());
  const text = fs.readFileSync('scripts/skill-body-extract.mjs', 'utf8');
  assert.ok(text.includes('--scan'), 'tool must support --scan');
  assert.ok(text.includes('--apply-markers'), 'tool must support --apply-markers');
  assert.ok(text.includes('--verify'), 'tool must support --verify');
});

test('PR-A: cycle 1.5 SKILLs not double-marked', () => {
  // cycle 1.5 4 SKILLs (investigate/retro/security-review/code-review) must keep
  // cycle15-body-neutral and NOT get cycle3 marker (avoid double-wrap).
  const CYCLE15 = ['investigate', 'retro', 'security-review', 'code-review'];
  for (const name of CYCLE15) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    assert.ok(text.includes('cycle15-body-neutral'), `${name} should retain cycle15 marker`);
    assert.ok(!text.includes(BEGIN), `${name} must NOT have cycle3 marker (cycle 1.5 already converted)`);
  }
});

test('PR-A: 7 Workflow SKILLs frontmatter has classification field', () => {
  // NOTE: Design FR-04 listed these as Workflow but actual classification
  // varies (e.g. /freeze = capability). Convert pattern doesn't depend on
  // classification — only on body-neutral marker insertion feasibility.
  const CLASSIFIED = { workflow: 0, capability: 0, hybrid: 0, other: 0 };
  for (const name of WORKFLOW_7) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(fm, `${name} no frontmatter`);
    const cl = fm[1].match(/classification:\s*(\w+)/);
    if (cl && CLASSIFIED[cl[1]] !== undefined) CLASSIFIED[cl[1]]++;
    else CLASSIFIED.other++;
  }
  assert.equal(CLASSIFIED.workflow + CLASSIFIED.capability + CLASSIFIED.hybrid, WORKFLOW_7.length, `all 7 must have valid classification: ${JSON.stringify(CLASSIFIED)}`);
});
