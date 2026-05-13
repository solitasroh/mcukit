#!/usr/bin/env node
/**
 * skill-body-extract.mjs
 *
 * Cycle 3 CR-3 — 28+ SKILL body/appendix two-layer 변환 보조 도구.
 *
 * Modes:
 *   --scan                       모든 SKILL 검사 + 변환 상태 보고 (read-only)
 *   --apply-markers <names...>   대상 SKILL에 cycle3-body-neutral 마커 + § 0 절 삽입
 *   --apply-grandfathered <names...>  대상 SKILL frontmatter에 grandfathered: true + § 0 절 삽입
 *   --verify [name]              SKILL 단위 빠른 검증 (마커 쌍 + § 0)
 *
 * Marker: <!-- BEGIN: cycle3-body-neutral --> ~ <!-- END: cycle3-body-neutral -->
 * § 0 절 표준 위치: frontmatter 직후 + 본문 시작 전
 *
 * Cycle 1.5 패턴 (cycle15-body-neutral) 유지 — neutral 마커는 cycle별로 분리.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');

const BEGIN = '<!-- BEGIN: cycle3-body-neutral -->';
const END = '<!-- END: cycle3-body-neutral -->';
const CYCLE15_BEGIN = '<!-- BEGIN: cycle15-body-neutral -->';

const SECTION_0_NEUTRAL = `## 0. 문서 구조 (본 SKILL의 세 층)

1. **도메인 본문 (§1 ~ §N)**: 이 SKILL의 프로토콜.
   잠금 어휘 사용 0건이 \`verify-policy --check body-neutrality\`로 자동 검증됩니다.
2. **방법론 본문 — 도메인 중립**: Cycle 3에서 \`<!-- BEGIN: cycle3-body-neutral -->\` ~ \`<!-- END: cycle3-body-neutral -->\` 마커로 감싸진 영역.
3. **도메인 예시 부록 (§A)**: MCU/MPU/WPF 도메인별 사례.
   SoT(\`policies/locked-vocab.json\`)에서 \`scripts/gen-locked-vocab.mjs\`가 자동 생성합니다.

직접 부록을 편집하지 마세요 — \`node scripts/gen-locked-vocab.mjs\`로 재생성됩니다.

---

`;

const SECTION_0_GRANDFATHERED = `## 0. 문서 구조 (본 SKILL의 세 층)

1. **도메인 본문 (§1 ~ §N)**: 이 SKILL의 프로토콜.
   **grandfathered SKILL** — 잠금 어휘 사용 허용 (Cycle 3 변환). 본문 자체가 도메인 기술입니다.
2. **방법론 본문 — 도메인 중립 (선택)**: 공통 방법론 절이 있다면 \`<!-- BEGIN: cycle3-body-neutral -->\` 마커로 분리.
3. **도메인 예시 부록 (§A)**: SoT(\`policies/locked-vocab.json\`)에서 자동 생성.

직접 부록을 편집하지 마세요 — \`node scripts/gen-locked-vocab.mjs\`로 재생성됩니다.

---

`;

function readSkill(name) {
  const p = path.join(SKILLS_DIR, name, 'SKILL.md');
  if (!fs.existsSync(p)) return null;
  return { path: p, text: fs.readFileSync(p, 'utf8') };
}

function splitFrontmatter(text) {
  // Tolerate CRLF + LF line endings.
  const startRe = /^---\r?\n/;
  const endRe = /\r?\n---\r?\n/;
  const startMatch = startRe.exec(text);
  if (!startMatch) return { fm: null, body: text };
  const startEnd = startMatch.index + startMatch[0].length;
  const rest = text.slice(startEnd);
  const endMatch = endRe.exec(rest);
  if (!endMatch) return { fm: null, body: text };
  const fmEnd = startEnd + endMatch.index + endMatch[0].length;
  return {
    fm: text.slice(0, fmEnd),
    body: text.slice(fmEnd),
  };
}

function scan() {
  const skills = fs.readdirSync(SKILLS_DIR).filter((d) => {
    return fs.statSync(path.join(SKILLS_DIR, d)).isDirectory()
        && fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md'));
  });
  console.log(`Found ${skills.length} SKILLs in ${SKILLS_DIR}\n`);
  const summary = {
    total: skills.length,
    cycle15_converted: 0,
    cycle3_converted: 0,
    grandfathered: 0,
    untouched: 0,
  };
  const rows = [];
  for (const name of skills) {
    const s = readSkill(name);
    const has15 = s.text.includes(CYCLE15_BEGIN);
    const has3 = s.text.includes(BEGIN);
    const { fm: skillFm } = splitFrontmatter(s.text);
    const grandfathered = skillFm ? /^grandfathered:\s*true/m.test(skillFm) : false;
    const hasSection0 = /^## 0\. 문서 구조/m.test(s.text);
    if (has15) summary.cycle15_converted++;
    if (has3) summary.cycle3_converted++;
    if (grandfathered) summary.grandfathered++;
    if (!has15 && !has3 && !grandfathered) summary.untouched++;
    rows.push({ name, cycle15: has15, cycle3: has3, grandfathered, sec0: hasSection0 });
  }
  console.log('Summary:', JSON.stringify(summary, null, 2));
  console.log('\nState per SKILL (cycle15 | cycle3 | grandfathered | §0):');
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(30)} ${r.cycle15 ? '✓' : '·'} ${r.cycle3 ? '✓' : '·'} ${r.grandfathered ? '✓' : '·'} ${r.sec0 ? '✓' : '·'}`);
  }
  return summary;
}

function applyMarkersNeutral(name) {
  const s = readSkill(name);
  if (!s) {
    console.error(`SKILL not found: ${name}`);
    return false;
  }
  if (s.text.includes(BEGIN)) {
    console.log(`  ${name}: already has cycle3 marker — skip`);
    return false;
  }
  if (s.text.includes(CYCLE15_BEGIN)) {
    console.log(`  ${name}: has cycle15 marker — skip (cycle 1.5 SKILL)`);
    return false;
  }
  const { fm, body } = splitFrontmatter(s.text);
  if (!fm) {
    console.error(`  ${name}: no frontmatter — manual edit required`);
    return false;
  }
  const hasSec0 = /^## 0\. 문서 구조/m.test(body);
  let newBody = body.replace(/^\s+/, '');
  if (!hasSec0) {
    newBody = SECTION_0_NEUTRAL + newBody;
  }
  newBody = `${BEGIN}\n\n${newBody.trimEnd()}\n\n${END}\n`;
  fs.writeFileSync(s.path, fm + '\n' + newBody);
  console.log(`  ${name}: applied cycle3 marker + § 0 (neutral)`);
  return true;
}

function applyGrandfathered(name) {
  const s = readSkill(name);
  if (!s) {
    console.error(`SKILL not found: ${name}`);
    return false;
  }
  const { fm, body } = splitFrontmatter(s.text);
  if (!fm) {
    console.error(`  ${name}: no frontmatter — manual edit required`);
    return false;
  }
  let newFm = fm;
  if (!/^grandfathered:/m.test(fm)) {
    // Insert grandfathered line before closing --- (CRLF or LF tolerant).
    newFm = fm.replace(/(\r?\n)(---\r?\n)$/, '$1grandfathered: true$1$2');
  } else {
    console.log(`  ${name}: grandfathered already set`);
  }
  const hasSec0 = /^## 0\. 문서 구조/m.test(body);
  let newBody = body;
  if (!hasSec0) {
    newBody = SECTION_0_GRANDFATHERED + body.replace(/^\s+/, '');
  }
  fs.writeFileSync(s.path, newFm + newBody);
  console.log(`  ${name}: grandfathered: true + § 0 added`);
  return true;
}

function verify(name) {
  const skillsToCheck = name ? [name] : fs.readdirSync(SKILLS_DIR).filter((d) => {
    return fs.statSync(path.join(SKILLS_DIR, d)).isDirectory()
        && fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md'));
  });
  let errors = 0;
  for (const n of skillsToCheck) {
    const s = readSkill(n);
    if (!s) continue;
    const has3 = s.text.includes(BEGIN);
    const has3End = s.text.includes(END);
    if (has3 && !has3End) {
      console.error(`${n}: BEGIN marker without END`);
      errors++;
    }
    if (has3End && !has3) {
      console.error(`${n}: END marker without BEGIN`);
      errors++;
    }
  }
  if (errors === 0) console.log(`Verify OK: ${skillsToCheck.length} SKILLs`);
  return errors;
}

// ---- main ----
const args = process.argv.slice(2);
if (args[0] === '--scan') {
  scan();
} else if (args[0] === '--apply-markers') {
  for (const n of args.slice(1)) applyMarkersNeutral(n);
} else if (args[0] === '--apply-grandfathered') {
  for (const n of args.slice(1)) applyGrandfathered(n);
} else if (args[0] === '--verify') {
  const code = verify(args[1]);
  process.exit(code > 0 ? 1 : 0);
} else {
  console.log('Usage:');
  console.log('  --scan                            scan all SKILLs and report state');
  console.log('  --apply-markers <name1> <name2>   apply cycle3 marker + § 0 (neutral)');
  console.log('  --apply-grandfathered <name1> ... apply grandfathered: true + § 0');
  console.log('  --verify [name]                   verify marker pair integrity');
}
