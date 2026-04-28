#!/usr/bin/env node
/**
 * verify-policy.js
 *
 * Cycle 1.5 — gstack→rkit sync policy enforcement.
 * Five checks ensure body/appendix two-layer separation, vocab preservation,
 * forbidden token absence, eval syntax sanity, and SoT schema validity.
 *
 * Usage:
 *   node scripts/verify-policy.js                    # run all checks
 *   node scripts/verify-policy.js --check <name>     # run a single check
 *   node scripts/verify-policy.js --quiet            # only report failures
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — at least one check failed
 *   2 — usage error / SoT load failed
 *
 * Design refs:
 *   - docs/02-design/features/bkit-gstack-sync-v2-cycle15.design.md §4.12
 *   - policies/locked-vocab.json (SoT)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOT_PATH = path.join(ROOT, 'policies/locked-vocab.json');
const SKILLS = ['investigate', 'retro', 'security-review', 'code-review'];
const FORBIDDEN_TOKENS = [
  'gstack-update-check',
  'gstack-config',
  'gstack-slug',
  'GBrain',
  'TELEMETRY:',
  'EXPLAIN_LEVEL:',
  'slop-scan',
];
const BODY_NEUTRAL_BEGIN = '<!-- BEGIN: cycle15-body-neutral -->';
const BODY_NEUTRAL_END = '<!-- END: cycle15-body-neutral -->';
const APPENDIX_BEGIN = '<!-- BEGIN: locked-vocab-appendix';
const APPENDIX_END = '<!-- END: locked-vocab-appendix -->';

let SOT;
try {
  SOT = JSON.parse(fs.readFileSync(SOT_PATH, 'utf8'));
} catch (err) {
  console.error(`❌ failed to load SoT (${SOT_PATH}): ${err.message}`);
  process.exit(2);
}

function readSkill(name) {
  return fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8');
}

function extractRegion(text, beginMarker, endMarker) {
  const beginIdx = text.indexOf(beginMarker);
  if (beginIdx < 0) return null;
  const endIdx = text.indexOf(endMarker, beginIdx);
  if (endIdx < 0) return null;
  return text.slice(beginIdx + beginMarker.length, endIdx);
}

function checkBodyNeutrality() {
  const errors = [];
  for (const skill of SKILLS) {
    const text = readSkill(skill);
    const region = extractRegion(text, BODY_NEUTRAL_BEGIN, BODY_NEUTRAL_END);
    if (region == null) {
      errors.push(`skills/${skill}/SKILL.md: cycle15-body-neutral 마커 누락`);
      continue;
    }
    for (const v of SOT.vocabs) {
      if (region.includes(v.term)) {
        errors.push(
          `skills/${skill}/SKILL.md (cycle15-body-neutral 영역): 잠금 어휘 "${v.term}" 노출 — 본문은 도메인 중립이어야 함 (D-1 b')`,
        );
      }
    }
  }
  return errors;
}

function checkVocabPreservation() {
  const errors = [];
  for (const skill of SKILLS) {
    const text = readSkill(skill);
    const beginIdx = text.indexOf(APPENDIX_BEGIN);
    const endIdx = text.indexOf(APPENDIX_END);
    if (beginIdx < 0 || endIdx <= beginIdx) {
      errors.push(`skills/${skill}/SKILL.md: 부록 마커 누락 — gen-locked-vocab.mjs 실행 필요`);
      continue;
    }
    const appendix = text.slice(beginIdx, endIdx);
    for (const v of SOT.vocabs) {
      if (!appendix.includes(v.term)) {
        errors.push(
          `skills/${skill}/SKILL.md 부록: 잠금 어휘 "${v.term}" 누락 — gen-locked-vocab.mjs 재실행 필요`,
        );
      }
    }
  }
  return errors;
}

function checkForbiddenTokens() {
  const errors = [];
  for (const skill of SKILLS) {
    const text = readSkill(skill);
    for (const tok of FORBIDDEN_TOKENS) {
      let idx = text.indexOf(tok);
      while (idx !== -1) {
        const lineStart = text.lastIndexOf('\n', idx) + 1;
        const lineEnd = text.indexOf('\n', idx);
        const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
        // Skip lines that explicitly list this as a forbidden token (self-reference)
        const trimmed = line.trim();
        const isSelfReference =
          trimmed.startsWith("'") || trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.includes('금지');
        if (!isSelfReference) {
          errors.push(`skills/${skill}/SKILL.md: 제외 토큰 "${tok}" 사용 발견 (line "${line.trim().slice(0, 80)}")`);
          break;
        }
        idx = text.indexOf(tok, idx + tok.length);
      }
    }
  }
  return errors;
}

function checkEvalSyntax() {
  const errors = [];
  const evalRoots = ['evals/workflow/code-review', 'evals/workflow/retro', 'evals/capability/investigate', 'evals/capability/security-review'];
  for (const root of evalRoots) {
    const absRoot = path.join(ROOT, root);
    if (!fs.existsSync(absRoot)) {
      // not yet present — eval files added in C7. tolerate during partial cycle.
      continue;
    }
    const yamlPath = path.join(absRoot, 'eval.yaml');
    if (!fs.existsSync(yamlPath)) {
      errors.push(`${root}/eval.yaml 누락`);
      continue;
    }
    const text = fs.readFileSync(yamlPath, 'utf8');
    if (!/judge:\s*regex_only/.test(text)) {
      errors.push(`${root}/eval.yaml: \`judge: regex_only\` 명시 누락 (LLM judge 호출 0건 보장 필요)`);
    }
    if (!/^name:\s*\S+/m.test(text) || !/^classification:\s*(workflow|capability|hybrid)/m.test(text)) {
      errors.push(`${root}/eval.yaml: 필수 필드(name, classification) 누락 또는 형식 오류`);
    }
  }
  return errors;
}

function checkSotSchema() {
  const errors = [];
  if (SOT.version !== '1.0') errors.push(`SoT version: expected "1.0", got "${SOT.version}"`);
  if (!Array.isArray(SOT.vocabs) || SOT.vocabs.length !== 20) {
    errors.push(`SoT vocabs: expected 20 entries, got ${SOT.vocabs?.length}`);
  }
  const validDomains = new Set(['mcu', 'mpu', 'wpf']);
  for (const v of SOT.vocabs || []) {
    if (typeof v.term !== 'string' || !v.term) errors.push(`SoT vocab: invalid term "${v.term}"`);
    if (!validDomains.has(v.domain)) errors.push(`SoT vocab "${v.term}": invalid domain "${v.domain}"`);
    if (typeof v.meaning !== 'string' || !v.meaning) errors.push(`SoT vocab "${v.term}": missing meaning`);
  }
  if (!SOT.schema || !Array.isArray(SOT.schema.verdictEnum) || !Array.isArray(SOT.schema.gateStatusEnum)) {
    errors.push('SoT schema enum lists missing or malformed');
  }
  return errors;
}

const checks = {
  'body-neutrality': checkBodyNeutrality,
  'vocab-preservation': checkVocabPreservation,
  'forbidden-tokens': checkForbiddenTokens,
  'eval-syntax': checkEvalSyntax,
  'sot-schema': checkSotSchema,
};

const argv = process.argv.slice(2);
const quiet = argv.includes('--quiet');
const checkArgIdx = argv.indexOf('--check');
const targets =
  checkArgIdx >= 0 && argv[checkArgIdx + 1]
    ? [argv[checkArgIdx + 1]]
    : Object.keys(checks);

let totalFailures = 0;
const results = [];
for (const name of targets) {
  if (!checks[name]) {
    console.error(`❌ unknown check: "${name}". Available: ${Object.keys(checks).join(', ')}`);
    process.exit(2);
  }
  const errs = checks[name]();
  totalFailures += errs.length;
  results.push({ name, errors: errs });
}

for (const { name, errors } of results) {
  if (errors.length === 0) {
    if (!quiet) console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}: ${errors.length} 위반`);
    for (const e of errors) console.error(`   ${e}`);
  }
}

if (totalFailures === 0) {
  if (!quiet) console.log(`\n✅ All ${targets.length} check(s) passed`);
  process.exit(0);
}
console.error(`\n❌ ${totalFailures} 위반 — gstack 동기화 정책 위반`);
process.exit(1);
