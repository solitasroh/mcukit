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
  if (!['1.0', '1.1'].includes(SOT.version)) errors.push(`SoT version: expected "1.0" or "1.1", got "${SOT.version}"`);
  if (!Array.isArray(SOT.vocabs) || SOT.vocabs.length !== 20) {
    errors.push(`SoT vocabs: expected 20 entries, got ${SOT.vocabs?.length}`);
  }
  const validDomains = new Set(['mcu', 'mpu', 'wpf']);
  const validScopes = new Set(['neutral', 'domain']);
  for (const v of SOT.vocabs || []) {
    if (typeof v.term !== 'string' || !v.term) errors.push(`SoT vocab: invalid term "${v.term}"`);
    if (!validDomains.has(v.domain)) errors.push(`SoT vocab "${v.term}": invalid domain "${v.domain}"`);
    if (typeof v.meaning !== 'string' || !v.meaning) errors.push(`SoT vocab "${v.term}": missing meaning`);
    if (SOT.version === '1.1' && !validScopes.has(v.scope)) {
      errors.push(`SoT vocab "${v.term}": missing or invalid scope (expected neutral|domain)`);
    }
  }
  if (!SOT.schema || !Array.isArray(SOT.schema.verdictEnum) || !Array.isArray(SOT.schema.gateStatusEnum)) {
    errors.push('SoT schema enum lists missing or malformed');
  }
  return errors;
}

// Cycle 2 new check: manifest-sync — every policies/*.json must register in manifest
function checkManifestSync() {
  const errors = [];
  const manifestPath = path.join(ROOT, 'policies/manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('policies/manifest.json missing — SoT registry required from Cycle 2');
    return errors;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const registered = new Set((manifest.sots || []).map((s) => s.path));

  function walk(dir, prefix) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        out.push(...walk(path.join(dir, entry.name), rel));
      } else if (entry.name.endsWith('.json')) {
        out.push(rel);
      }
    }
    return out;
  }
  const actual = walk(path.join(ROOT, 'policies'), '');
  for (const f of actual) {
    if (!registered.has(f)) {
      errors.push(`policies/${f} not registered in manifest.json sots[]`);
    }
  }
  for (const r of registered) {
    if (!actual.includes(r)) {
      errors.push(`manifest.sots references missing file: policies/${r}`);
    }
  }
  return errors;
}

// Decisions-matrix check — manifest enumeration + STRICT flag (cycle >= 3 applies R1~R7).
// Cycle 2 legacy: reasoning >= 20, R2 OR (revisit_by OR unblock_condition).
// Cycle 3+ STRICT: R1 reasoning >= 50, R2 AND, R3 vague pattern reject, R4 unblock >= 30,
//                  R5 verb (WARN), R6 revisit_by format, R7 evidence >= 2, escalation rules.
function checkDecisionsMatrix() {
  const errors = [];
  const manifestPath = path.join(ROOT, 'policies/manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('policies/manifest.json missing');
    return errors;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const matrixEntries = (manifest.sots || []).filter((s) => /^decisions\/cycle\d+-matrix\.json$/.test(s.path));
  if (matrixEntries.length === 0) {
    errors.push('manifest: no decisions/cycle*-matrix.json entries registered');
    return errors;
  }

  // Load escalation policy (cycle 3+)
  let escalation = null;
  try {
    escalation = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies/escalation-policy.json'), 'utf8'));
  } catch { /* optional in cycle 2 */ }

  const decisionEnum = new Set(['pending', 'adopt', 'partial_adopt', 'defer', 'reject']);
  const VAGUE_UNBLOCK = /^cycle-?\d+\s*(이월|carry.?over|defer|연기)\s*$/i;
  const VERB_RE = /(implemented|completed|resolved|passes|adopted|written|exists|integrated|merged|verified)/i;
  const REVISIT_FMT = /^cycle-\d+(\.\d+)?$/;
  const expectedCounts = { '2': 11, '3': 8 };

  for (const entry of matrixEntries) {
    const matrixPath = path.join(ROOT, 'policies', entry.path);
    if (!fs.existsSync(matrixPath)) {
      errors.push(`${entry.path} missing (referenced by manifest)`);
      continue;
    }
    const m = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
    const cycleNum = Number(m.cycle);
    const STRICT = cycleNum >= 3;
    const minReasoningLen = STRICT ? 50 : 20;
    const minEvidenceCount = STRICT ? 2 : 1;
    const expected = expectedCounts[m.cycle];
    if (expected && m.candidates?.length !== expected) {
      errors.push(`${entry.path}: expected ${expected} candidates, got ${m.candidates?.length}`);
    }

    for (const c of m.candidates || []) {
      const id = `${entry.path}#${c.id}`;
      if (!decisionEnum.has(c.decision)) {
        errors.push(`${id}: invalid decision "${c.decision}"`);
        continue;
      }
      if (c.decision === 'pending') continue;
      if (!c.decided_by || !c.decided_by.role) {
        errors.push(`${id} (${c.decision}): decided_by.role required`);
      }
      if (!Array.isArray(c.evidence) || c.evidence.length < minEvidenceCount) {
        errors.push(`${id} (${c.decision}): evidence >= ${minEvidenceCount} entries required (got ${c.evidence?.length || 0})`);
      }

      // R1: reasoning length (STRICT: all non-pending; legacy: adopt/partial only)
      const reasoningTargets = STRICT
        ? ['adopt', 'partial_adopt', 'defer', 'reject']
        : ['adopt', 'partial_adopt'];
      if (reasoningTargets.includes(c.decision)) {
        if (!c.reasoning || c.reasoning.length < minReasoningLen) {
          errors.push(`${id} (${c.decision}): reasoning >= ${minReasoningLen} chars required (got ${c.reasoning?.length || 0}) [R1${STRICT ? ' STRICT' : ' legacy'}]`);
        }
      }

      if (c.decision === 'defer') {
        if (STRICT) {
          // R2: AND of unblock_condition AND revisit_by
          if (!c.unblock_condition || !c.revisit_by) {
            errors.push(`${id} (defer): unblock_condition AND revisit_by both required [R2 STRICT]`);
          }
          // R3: vague pattern reject
          if (c.unblock_condition && VAGUE_UNBLOCK.test(c.unblock_condition.trim())) {
            errors.push(`${id} (defer): unblock_condition matches vague pattern (cycle-N 이월 단독 거부) [R3]`);
          }
          // R4: unblock_condition length
          if (c.unblock_condition && c.unblock_condition.length < 30) {
            errors.push(`${id} (defer): unblock_condition >= 30 chars required (got ${c.unblock_condition.length}) [R4]`);
          }
          // R5: verb (WARN only — not pushed to errors)
          // R6: revisit_by format
          if (c.revisit_by && !REVISIT_FMT.test(c.revisit_by) && c.revisit_by !== 'cycle-3 or later') {
            errors.push(`${id} (defer): revisit_by must match /^cycle-\\d+(\\.\\d+)?$/ (got "${c.revisit_by}") [R6]`);
          }
          // Escalation policy
          if (escalation) {
            const ec = typeof c.escalation_count === 'number' ? c.escalation_count : 0;
            if (ec >= escalation.thresholds.prohibit_at) {
              errors.push(`${id} (defer): escalation_count=${ec} >= prohibit_at (${escalation.thresholds.prohibit_at}) — defer prohibited, must be adopt/partial_adopt/reject`);
            } else if (ec >= escalation.thresholds.fail_at) {
              if (!c.override_reason || c.override_reason.length < 80) {
                errors.push(`${id} (defer): escalation_count=${ec} requires override_reason >= 80 chars (got ${c.override_reason?.length || 0})`);
              }
              if (!c.final_revisit_by) {
                errors.push(`${id} (defer): escalation_count=${ec} requires final_revisit_by (hard deadline)`);
              }
            }
          }
        } else {
          // Legacy cycle 2: OR
          if (!c.revisit_by && !c.unblock_condition) {
            errors.push(`${id} (defer): revisit_by or unblock_condition required [legacy OR]`);
          }
        }
      }
    }
  }
  return errors;
}

// Cycle 2 new check: network-egress — blocked patterns must not appear outside exempt paths
function checkNetworkEgress() {
  const errors = [];
  const allowlistPath = path.join(ROOT, 'policies/network-allowlist.json');
  if (!fs.existsSync(allowlistPath)) {
    errors.push('policies/network-allowlist.json missing');
    return errors;
  }
  const a = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  const blocked = a.blocked_patterns || [];
  const exempt = new Set(a.exempt_paths || []);

  function shouldCheck(filePath) {
    if (filePath.includes('node_modules/')) return false;
    if (filePath.includes('.git/')) return false;
    for (const ex of exempt) if (filePath.startsWith(ex)) return false;
    return filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs');
  }

  function walk(dir) {
    const out = [];
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return []; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        out.push(...walk(full));
      } else if (shouldCheck(rel)) {
        out.push(rel);
      }
    }
    return out;
  }

  const files = ['lib', 'scripts', 'hooks'].flatMap((d) => walk(path.join(ROOT, d)));
  for (const f of files) {
    const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const pattern of blocked) {
      try {
        const re = new RegExp(pattern);
        if (re.test(txt)) {
          errors.push(`${f}: blocked egress pattern matched "${pattern}"`);
        }
      } catch {}
    }
  }
  return errors;
}

// Cycle 2 new check: pii-in-logs — forbidden PII tokens in .rkit/state/
function checkPiiInLogs() {
  const errors = [];
  const stateDir = path.join(ROOT, '.rkit/state');
  if (!fs.existsSync(stateDir)) return errors;
  // forbidden tokens that should never be raw in logs
  const forbidden = [
    process.env.USERNAME,
    process.env.USER,
    process.env.HOSTNAME,
    process.env.HOME?.replace(/\\/g, '/'),
    process.env.USERPROFILE?.replace(/\\/g, '/'),
  ].filter(Boolean);

  function walk(dir) {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...walk(full));
      else if (e.name.endsWith('.json') || e.name.endsWith('.jsonl')) out.push(full);
    }
    return out;
  }

  for (const f of walk(stateDir)) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const tok of forbidden) {
      if (tok && tok.length > 2 && txt.includes(tok)) {
        errors.push(`${path.relative(ROOT, f)}: PII leak — raw token "${tok}" found`);
      }
    }
    // git remote URL pattern
    if (/https:\/\/github\.com\/[^/]+\//.test(txt) || /git@github\.com:/.test(txt)) {
      errors.push(`${path.relative(ROOT, f)}: PII leak — raw git remote URL found`);
    }
  }
  return errors;
}

const checks = {
  'body-neutrality': checkBodyNeutrality,
  'vocab-preservation': checkVocabPreservation,
  'forbidden-tokens': checkForbiddenTokens,
  'eval-syntax': checkEvalSyntax,
  'sot-schema': checkSotSchema,
  'manifest-sync': checkManifestSync,
  'decisions-matrix': checkDecisionsMatrix,
  'network-egress': checkNetworkEgress,
  'pii-in-logs': checkPiiInLogs,
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
