// Cycle 3 PR-B — Capability/Neutral SKILL 변환 smoke tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const GRANDFATHERED = [
  // MCU domain
  'misra-c', 'freertos', 'stm32-hal', 'nxp-mcuxpresso', 'cmake-embedded',
  'hw-analysis', 'mcu-critical-analysis', 'communication', 'serial-bridge',
  // MPU domain
  'yocto-build', 'yocto-build-reproducibility', 'yocto-review',
  'yocto-stm32-bsp', 'yocto-stm32-build', 'yocto-stm32-recipe', 'yocto-stm32-setup',
  'kernel-driver', 'imx-bsp', 'rootfs-config', 'board-debug',
  // WPF domain
  'wpf-mvvm', 'xaml-design', 'dotnet-patterns',
];

const NEUTRAL_PHASES = [
  'phase-1-schema', 'phase-2-convention', 'phase-3-mockup', 'phase-4-api',
  'phase-5-design-system', 'phase-6-ui-integration', 'phase-7-seo-security',
  'phase-8-review', 'phase-9-deployment',
];

const NEUTRAL_LEVELS = ['starter', 'dynamic', 'enterprise'];

const BEGIN = '<!-- BEGIN: cycle3-body-neutral -->';
const END = '<!-- END: cycle3-body-neutral -->';

test('PR-B: 23 grandfathered SKILLs frontmatter has grandfathered: true', () => {
  for (const name of GRANDFATHERED) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    assert.match(text, /^grandfathered:\s*true/m, `${name} missing grandfathered: true`);
  }
});

test('PR-B: grandfathered SKILLs have § 0 section', () => {
  for (const name of GRANDFATHERED) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    assert.ok(/^## 0\. 문서 구조/m.test(text), `${name} missing § 0 section`);
  }
});

test('PR-B: 9 neutral phase-* SKILLs have cycle3 marker', () => {
  for (const name of NEUTRAL_PHASES) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    assert.ok(text.includes(BEGIN), `${name} missing BEGIN marker`);
    assert.ok(text.includes(END), `${name} missing END marker`);
  }
});

test('PR-B: 3 level SKILLs (starter/dynamic/enterprise) have cycle3 marker', () => {
  for (const name of NEUTRAL_LEVELS) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    assert.ok(text.includes(BEGIN), `${name} missing BEGIN marker`);
    assert.ok(text.includes(END), `${name} missing END marker`);
  }
});

test('PR-B: all converted SKILLs § 0 present', () => {
  for (const name of [...NEUTRAL_PHASES, ...NEUTRAL_LEVELS]) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    assert.ok(/^## 0\. 문서 구조/m.test(text), `${name} missing § 0`);
  }
});

test('PR-B: skill-body-extract scan reports >=42 converted', () => {
  // 4 cycle 1.5 + 7 workflow + 23 grandfathered + 9 phases + 3 levels = 46 converted
  // Scan command output check via grep on actual files
  const all = fs.readdirSync('skills').filter((d) => {
    try { return fs.statSync(`skills/${d}`).isDirectory() && fs.existsSync(`skills/${d}/SKILL.md`); }
    catch { return false; }
  });
  let cycle3 = 0;
  let grandfathered = 0;
  let cycle15 = 0;
  for (const name of all) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    if (text.includes('cycle15-body-neutral')) cycle15++;
    if (text.includes('cycle3-body-neutral')) cycle3++;
    if (/^grandfathered:\s*true/m.test(text)) grandfathered++;
  }
  assert.ok(cycle15 >= 4, `cycle15 SKILLs >= 4 expected, got ${cycle15}`);
  assert.ok(cycle3 >= 19, `cycle3 SKILLs >= 19 expected (7 workflow + 9 phase + 3 level), got ${cycle3}`);
  assert.ok(grandfathered >= 23, `grandfathered >= 23 expected, got ${grandfathered}`);
});

test('PR-B: marker pair integrity (real markers, not §0 mentions)', () => {
  // Real markers are at line-start (after newline or BOF), not inside backticks/text.
  const all = fs.readdirSync('skills').filter((d) => {
    try { return fs.statSync(`skills/${d}`).isDirectory() && fs.existsSync(`skills/${d}/SKILL.md`); }
    catch { return false; }
  });
  for (const name of all) {
    const text = fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8');
    // Match marker only when on its own line (line start + trailing newline)
    const beginCount = (text.match(/(?:^|\r?\n)<!-- BEGIN: cycle3-body-neutral -->(?=\r?\n)/g) || []).length;
    const endCount = (text.match(/(?:^|\r?\n)<!-- END: cycle3-body-neutral -->(?=\r?\n)/g) || []).length;
    assert.equal(beginCount, endCount, `${name} marker pair mismatch: ${beginCount} BEGIN vs ${endCount} END`);
  }
});
