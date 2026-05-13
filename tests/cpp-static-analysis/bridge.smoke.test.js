// PR #5 review fix — cpp-static-analysis bridge + hook contract tests.
// Covers G1 (non-blocking decision:block guard), G2 (timeout/failure non-crash),
// G3 (non-C/C++ early-return), G4 (stdout contract / regex sync).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..', '..');

// ─── Static contract: extension sets aligned across JS + Python (C6) ───

test('SoT: JS CPP_EXTENSIONS includes .c (MCU domain coverage)', () => {
  const { CPP_EXTENSIONS } = require_('../../scripts/cpp-static-analysis-hook.js');
  assert.ok(CPP_EXTENSIONS.has('.c'));
  assert.ok(CPP_EXTENSIONS.has('.cpp'));
  assert.ok(CPP_EXTENSIONS.has('.h'));
  assert.ok(CPP_EXTENSIONS.has('.hpp'));
  assert.ok(CPP_EXTENSIONS.has('.hxx'));
});

test('SoT: Python CPP_EXTENSIONS includes .c (matches JS)', () => {
  const src = fs.readFileSync('scripts/cpp-static-analysis/cpp_parser.py', 'utf8');
  // Extract CPP_EXTENSIONS literal
  const m = src.match(/CPP_EXTENSIONS\s*=\s*\{([^}]+)\}/);
  assert.ok(m, 'CPP_EXTENSIONS literal must be present');
  const exts = m[1].match(/"\.\w+"/g) || [];
  assert.ok(exts.some((e) => e === '"\.c"'), `.c must be in Python set, got ${exts.join(',')}`);
  assert.ok(exts.some((e) => e === '"\.cpp"'));
  assert.ok(exts.some((e) => e === '"\.hxx"'));
});

// ─── G3: non-C/C++ early-return (no Python spawn) ───

test('G3: handleCppStaticAnalysis returns false for non-C++ extension', () => {
  const { handleCppStaticAnalysis } = require_('../../scripts/cpp-static-analysis-hook.js');
  for (const ext of ['.ts', '.py', '.js', '.md', '.json', '.cs', '.xml']) {
    const result = handleCppStaticAnalysis({ tool_input: { file_path: `foo${ext}` } });
    assert.equal(result, false, `${ext} must early-return false`);
  }
});

test('G3: handleCppStaticAnalysis returns false on missing file_path', () => {
  const { handleCppStaticAnalysis } = require_('../../scripts/cpp-static-analysis-hook.js');
  assert.equal(handleCppStaticAnalysis({}), false);
  assert.equal(handleCppStaticAnalysis({ tool_input: {} }), false);
  assert.equal(handleCppStaticAnalysis(null), false);
});

// ─── G2: timeout budget fits under hooks.json Write matcher (5s) ───

test('G2: HOOK_TIMEOUT_MS fits under Write matcher budget (5s)', () => {
  const { HOOK_TIMEOUT_MS } = require_('../../scripts/cpp-static-analysis-hook.js');
  assert.ok(HOOK_TIMEOUT_MS < 5000, `expected < 5000ms (Write matcher budget), got ${HOOK_TIMEOUT_MS}`);
  assert.ok(HOOK_TIMEOUT_MS >= 1000, `expected >= 1000ms (sane minimum), got ${HOOK_TIMEOUT_MS}`);
});

test('G2: HOOK_TIMEOUT_MS == 3000 (design spec p95<3s)', () => {
  const { HOOK_TIMEOUT_MS } = require_('../../scripts/cpp-static-analysis-hook.js');
  assert.equal(HOOK_TIMEOUT_MS, 3000);
});

test('G2: resolvePythonCmd returns string or null (no throw)', () => {
  const { resolvePythonCmd } = require_('../../scripts/cpp-static-analysis-hook.js');
  const cmd = resolvePythonCmd();
  assert.ok(cmd === null || typeof cmd === 'string',
    `expected null or string, got ${typeof cmd} ${cmd}`);
});

// ─── G1: non-blocking — cpp-post-edit.py must never emit decision:block ───

test('G1: cpp-post-edit.py does not emit decision:block', () => {
  const src = fs.readFileSync('hooks/cpp-post-edit.py', 'utf8');
  // No JSON output to stdout claiming decision: block
  assert.ok(!/print\(\s*json\.dumps\(\s*\{[^}]*['"]decision['"]\s*:\s*['"]block['"]/.test(src),
    'cpp-post-edit.py must not emit decision:block (rkit non-blocking policy)');
  // _block_reason internal name OK as long as it goes to stderr
  assert.match(src, /file=sys\.stderr/, 'block findings must go to stderr only');
});

test('G1: cpp-post-edit.py — no stdout output (no print() / safe_print without stderr)', () => {
  const src = fs.readFileSync('hooks/cpp-post-edit.py', 'utf8');
  // Contract: non-blocking — never writes to stdout. All output must go to stderr.
  // Bare print() to stdout is forbidden. Every safe_print must include file=sys.stderr.
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Bare print() statement (not safe_print)
    if (/^\s*print\s*\(/.test(line) && !/safe_print/.test(line)) {
      assert.fail(`line ${i + 1}: bare print() forbidden — use safe_print(..., file=sys.stderr)`);
    }
  }
  // Sanity: safe_print appears
  assert.match(src, /safe_print/);
  // No stdout target
  assert.ok(!/safe_print\([^)]*sys\.stdout/.test(src), 'safe_print must not target sys.stdout');
});

// ─── G4: stdout contract — rapp_review.py output line matches SKILL regex ───

test('G4: rapp_review.py produces "cpp-static-analysis: <dir> (N findings)" format', () => {
  const src = fs.readFileSync('scripts/cpp-static-analysis/rapp_review.py', 'utf8');
  // Either as f-string or .format(); regex matches the canonical contract
  const STDOUT_CONTRACT = /cpp-static-analysis:\s*\{[^}]*\}\s*\(\{[^}]*\}\s*findings\)/;
  assert.ok(STDOUT_CONTRACT.test(src) || /cpp-static-analysis:.*\(.*findings\)/.test(src),
    'rapp_review.py must emit "cpp-static-analysis: <dir> (N findings)" final line');
});

test('G4: SKILL regex matches contract output', () => {
  const src = fs.readFileSync('skills/code-review/SKILL.md', 'utf8');
  // SKILL must define the regex used to parse runner output
  assert.match(src, /\^cpp-static-analysis:\s*\\s\*\(\\S\.\*\?\)\\s\*\\\(\\d\+\s+findings\\\)\$/);
});

test('G4: SKILL regex sample-matches expected stdout', () => {
  const re = /^cpp-static-analysis:\s*(\S.*?)\s*\(\d+ findings\)$/;
  // Positive cases
  assert.ok(re.test('cpp-static-analysis: /tmp/run-20260513 (12 findings)'));
  assert.ok(re.test('cpp-static-analysis: .rkit/state/cpp-static-analysis/20260513-053000 (0 findings)'));
  const m = 'cpp-static-analysis: C:/users/test/run dir (42 findings)'.match(re);
  assert.ok(m, 'should match Windows path with space');
  assert.equal(m[1], 'C:/users/test/run dir');
  // Negative
  assert.ok(!re.test('cpp-static-analysis: [12 findings]'), 'square brackets not allowed');
  assert.ok(!re.test('cpp-static-analysis: dir (12)'), 'missing "findings" keyword');
});

// ─── Critical fix verification: stale silent catches removed ───

test('PR #5 review fix: cpp-post-edit.py _collect_findings differentiates ImportError', () => {
  const src = fs.readFileSync('hooks/cpp-post-edit.py', 'utf8');
  assert.match(src, /except\s+\(ImportError,\s*ModuleNotFoundError\)/);
  assert.match(src, /dependency missing/);
});

test('PR #5 review fix: cpp-static-analysis-hook.js surfaces ENOENT/ETIMEDOUT to stderr', () => {
  const src = fs.readFileSync('scripts/cpp-static-analysis-hook.js', 'utf8');
  assert.match(src, /code === 'ENOENT'/);
  assert.match(src, /code === 'ETIMEDOUT'/);
  assert.match(src, /process\.stderr\.write/);
});

test('PR #5 review fix: code-quality-hook timeout=4000 (not 10000)', () => {
  const src = fs.readFileSync('scripts/code-quality-hook.js', 'utf8');
  assert.match(src, /timeout:\s*4000/);
  // No remaining 10000ms timeout in runLinter
  const runLinterBlock = src.split('function runLinter')[1]?.split('function ')[0] || '';
  assert.ok(!/timeout:\s*10000/.test(runLinterBlock),
    'runLinter must use 4000ms budget after PR #5 review C2 fix');
});

test('PR #5 review fix: template _comment points to .rkit/cpp-static-analysis/', () => {
  const cfg = fs.readFileSync('templates/cpp-static-analysis/project-config.example.json', 'utf8');
  assert.match(cfg, /\.rkit\/cpp-static-analysis\/project-config\.json/);
  assert.ok(!cfg.includes('.claude/project-config.json으로 복사'),
    'old .claude/ path mention must be removed');
});

test('PR #5 review fix: $schema rebrand (no rapp- prefix)', () => {
  const cfg = JSON.parse(fs.readFileSync('templates/cpp-static-analysis/project-config.example.json', 'utf8'));
  assert.ok(!cfg.$schema.startsWith('rapp-'),
    `$schema must not retain rapp- prefix, got: ${cfg.$schema}`);
  assert.match(cfg.$schema, /^cpp-static-analysis-/);
});

test('PR #5 review fix: cpp-static-analysis SKILL has classification', () => {
  const fm = fs.readFileSync('skills/cpp-static-analysis/SKILL.md', 'utf8');
  assert.match(fm, /classification:\s*capability/);
});

test('PR #5 review fix: broken cross-refs removed (no .do.md / docs/cpp-static-analysis-integration.md)', () => {
  const files = [
    'docs/03-analysis/cpp-static-analysis-integration.analysis.md',
    'docs/04-report/features/cpp-static-analysis-integration.report.md',
    'docs/01-plan/features/cpp-static-analysis-integration.plan.md',
  ];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/\(\.\.\/.*cpp-static-analysis-integration\.do\.md\)/.test(src),
      `${f} must not contain broken .do.md reference`);
    assert.ok(!/\(\.\.\/\.\.\/cpp-static-analysis-integration\.md\)/.test(src),
      `${f} must not contain broken base doc reference`);
  }
});
