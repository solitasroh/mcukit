---
template: design
version: 0.1
description: bkit-gstack-sync-v2 Cycle 3 — council 합의 통합 설계
---

# bkit-gstack-sync-v2-cycle3 Design Document

> **Summary**: 8 candidates × council 결정 통합, D-3 게이트 강화 + escalation 정책, 28 SKILL 분류별 변환, SBOM 자동화
>
> **Project**: rkit
> **Version**: 0.9.13
> **Author**: soojang.roh + 6-agent council
> **Date**: 2026-05-13
> **Status**: Draft (v0.1)
> **Plan reference**: `docs/01-plan/features/bkit-gstack-sync-v2-cycle3.plan.md`

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Cycle 2 carry-over 6 + cycle 3 신규 분석 2 = 8 candidates 일괄 처리. defer 무한 사슬 차단 + GDPR/SBOM/도메인 매핑률 결정 |
| **Solution** | cycle3-matrix.json separate + D-3 7 규칙 강화 + escalation_count Hybrid 정책 + 분류별 SKILL 변환 + GitHub Actions SBOM offline + E cycle-4 명시 이월 |
| **Function/UX Effect** | 8 candidates: adopt 1 / partial 2 / defer 2 / reject 3 (CR-1 3건은 reject 1 그룹). rkit-bkit 정렬 50%+ (cascade 포함 100%). cycle-3 종료 시 carry-over 0 또는 명시 reject |
| **Core Value** | "cycle-N 이월" 단순 사유 영구 거부. 무한 defer 메커니즘적 차단 (R1~R7 + escalation 임계 == 3 prohibit). 도메인 중립성 + GDPR + SBOM supply chain 동시 충족 |

---

## 1. Overview

### 1.1 Council 구성 + 결정 책임

| Agent | 담당 |
|-------|------|
| `rkit:enterprise-expert` | DR-1 (cycle3-matrix separate) / DR-2 일괄 정책 / Q-5 manifest 등록 시점 |
| `rkit:infra-architect` | DR-3 (SBOM CI 시점) / Q-3 (offline + CI signatures) |
| `rkit:security-architect` | DR-4 (E hash 알고리즘) / DR-5 (C orchestrator) / D-8 GDPR |
| `rkit:code-analyzer` | CR-1 A 잔여 3 / CR-2 B 잔여 4 ports |
| `rkit:frontend-architect` | CR-3 28 SKILL 변환 (Workflow → Capability 단계) |
| `rkit:design-validator` | D-3 7 규칙 강화 / escalation 정책 / cycle 2 회귀 차단 flag |

### 1.2 핵심 변경 사항 (vs Plan v0.1)

1. **D-3 게이트 강화** R1~R7 7 규칙 + `STRICT` flag (cycle 2 회귀 면제)
2. **escalation_count == 3 prohibit** 옵션 C — 무한 defer 영구 차단
3. **CR-1 3 모듈 모두 reject** (Plan 평가 시점 partial_adopt 가능성 → council 검증 후 reject)
4. **CR-3 옵션 C (분류별)** Plan 권고 일괄(옵션 A) → 단계별 (Workflow PR-A + Capability PR-B)
5. **E cycle-4 이월 명시** + override_reason 80자+ (Plan 권고 cycle-3 → cycle-4)
6. **CR-7 C 영구 reject** `permanent_reject: true` (Plan D-7 권고 확정)

---

## 2. Architecture

### 2.1 cycle3-matrix.json 스키마 (확장)

```jsonc
{
  "version": "1.0",
  "cycle": "3",
  "lastUpdated": "...",
  "description": "Cycle 3 candidate × decision tracking matrix. 8 candidates × 5 enum.",
  "candidates": [
    {
      "id": "CR-N",
      "title": "...",
      "priority": "P0|P1|P2",
      "decision": "pending|adopt|partial_adopt|defer|reject",
      "reasoning": "...",                    // >= 50자 (R1 강화)
      "evidence": [...],                     // >= 2건 (R7 강화)
      "decided_by": { "role": "agent|human", "id": "..." },
      "decided_at": "...",
      "depends_on": [...],
      "unblock_condition": "...",            // defer 시 >= 30자 + 동사 + R3 정규식 통과
      "revisit_by": "cycle-N",               // defer 시 필수 (R2 AND 강화)
      "cycle_origin": "cycle-2-carryover|cycle-3-new",  // 신규
      "predecessor_decision": {              // cycle-2-carryover 시 필수
        "cycle": "2", "candidate_id": "...", "decision": "..."
      },
      "escalation_count": 0,                 // 누적 defer 횟수
      "override_reason": "...",              // escalation_count >= 2 defer 시 >= 80자 필수
      "final_revisit_by": "cycle-N",         // escalation_count >= 2 defer 시 필수 (hard deadline)
      "permanent_reject": true               // reject 시 cycle-N+ 재논의 차단
    }
  ],
  "decision_enum": ["pending", "adopt", "partial_adopt", "defer", "reject"],
  "decided_by_schema": {...},
  "completion_gate": {
    "rule": "STRICT mode. R1~R7 적용. escalation_count >= 3 시 defer 금지.",
    "check": "scripts/verify-policy.js --check decisions-matrix"
  }
}
```

### 2.2 D-3 게이트 강화 — R1~R7 7 규칙

| # | 규칙 | 적용 | Severity |
|---|------|------|----------|
| R1 | `reasoning.length >= 50` | non-pending 전체 | FAIL |
| R2 | defer 시 `unblock_condition` AND `revisit_by` 양쪽 필수 | defer | FAIL |
| R3 | `unblock_condition` 모호 패턴 거부 — `/^cycle-?\d+\s*(이월\|carry.?over\|defer\|연기)\s*$/i` | defer | FAIL |
| R4 | `unblock_condition.length >= 30` | defer | FAIL |
| R5 | `unblock_condition` 동사 1+ 포함 — `implemented\|completed\|resolved\|passes\|adopted\|written\|exists\|integrated` | defer | WARN |
| R6 | `revisit_by` 형식 `/^cycle-\d+(\.\d+)?$/` | defer | FAIL |
| R7 | adopt/partial_adopt 시 `evidence.length >= 2` | adopt/partial_adopt | FAIL |

**STRICT flag**: cycle 2 회귀 면제 — `STRICT = m.cycle === '3' || Number(m.cycle) >= 3`. cycle 2 매트릭스는 legacy 규칙 (R1 >= 20자, R2 OR) 유지.

### 2.3 Escalation 정책 — 옵션 C Hybrid

| escalation_count | 동작 |
|-----------------:|------|
| 0 | 통상 |
| 1 | WARN — `override_reason` 권장 |
| 2 | FAIL 조건: `override_reason >= 80자` + `final_revisit_by` 필수 |
| 3+ | **defer 금지** — adopt/partial_adopt/reject 강제 |

신규 SoT: `policies/escalation-policy.json` 또는 `policies/never-gate.json` 메타 항목 — 권고는 별도 SoT (manifest 등록 깔끔).

### 2.4 8 Candidates 매핑

| ID | escalation_count | cycle_origin | predecessor | 결정 | escalation 규칙 |
|----|:---:|--------------|-------------|------|----------------|
| CR-1 A 잔여 3 | 1 | cycle-2-carryover | A.partial_adopt | reject | 면제 (reject) |
| CR-2 B 잔여 4 | 1 | cycle-2-carryover | B.partial_adopt | partial_adopt | 면제 |
| CR-3 28 SKILL | 1 | cycle-2-carryover | CO-3.partial_adopt | partial_adopt | 면제 |
| CR-4 CO-4 BKIT_VERSION | **2** | cycle-2-carryover | CO-4.defer | reject | 면제 (reject — A.version reject로 종속 차단) |
| CR-5 SBOM | 0 | cycle-3-new | null | adopt | 면제 |
| CR-6 E + CO-2 | **2** | cycle-2-carryover | E.defer + CO-2.defer | defer | **override_reason 80자+ + final_revisit_by cycle-4 필수** |
| CR-7 C orchestrator | **2** | cycle-2-carryover | C.defer | reject (permanent) | 면제 |
| CR-8 CO-1 JSONL | **2** | cycle-2-carryover | CO-1.defer | defer cascade | **override_reason 80자+ + final_revisit_by cycle-4 필수** |

---

## 3. Detailed Design (FRs)

### 3.1 FR-01 cycle3-matrix.json 신설

- 경로: `policies/decisions/cycle3-matrix.json`
- 신규 필드 3종 (cycle_origin / predecessor_decision / escalation_count) + 필수 메타 (override_reason, final_revisit_by, permanent_reject 조건부)
- manifest 등록: Plan 종료 시점 (Q-5), description에 STRICT 강화 명시

### 3.2 FR-02 CR-1 A 잔여 3 모듈 reject

| 모듈 | 사유 |
|------|------|
| `version.js` | rkit 단일 SoT `package.json:version` (cycle 2 C21 fix). 도입 시 SoT 분기 |
| `session-ctx-fp.js` | rkit FR-09 14자+salt 보안 우위 (bkit 16자 salt 없음, 결정론 노출) |
| `session-title-cache.js` | rkit `lib/team/state-writer.js` 원자 쓰기 패턴 보유. bkit `.bkit/` 경로 누출 위험 |

reasoning 50자+ + evidence 2건+ 보장.

### 3.3 FR-03 CR-2 B 잔여 4 ports

| Port | 결정 | rkit 구현체 |
|------|------|------------|
| `cc-payload.port.js` | adopt | `lib/infra/cc-bridge.js` (cycle 2 F adopted) |
| `docs-code-index.port.js` | adopt | `lib/infra/docs-code-scanner.js` (`measure()` 시그니처 일치) |
| `regression-registry.port.js` | defer cascade | unblock: CR-6 E adopt/partial_adopt AND `lib/cc-regression/registry.js` 존재 |
| `token-meter.port.js` | defer | unblock: rkit ENH 등록 + `lib/cost/` 신규 도메인 PDCA AND baseline rkit 어휘 재정의 |

매핑률: 50% (Plan FR-03 80% 미달) — cascade defer 100% (검증 가능 unblock) → D-3 예외 명시 권고.

**신규 파일**:
- `lib/domain/ports/cc-payload.port.js` (type-only, module.exports = {})
- `lib/domain/ports/docs-code-index.port.js` (type-only)

JSDoc `@implements` cc-bridge.js + docs-code-scanner.js에 추가.

### 3.4 FR-04 CR-3 28 SKILL 변환 — 분류별 단계

**PR-A: Workflow 7 SKILL (0.5일)** — cycle 1.5 4 SKILL 제외 후 실질 7:

```
/pdca /mr /ship /rollback /freeze /skill-create /skill-status
```

처리: `<!-- BEGIN: cycle3-body-neutral -->` ~ `<!-- END: cycle3-body-neutral -->` 마커 + `## 0. 문서 구조` 절 삽입. neutral.

**PR-B: Capability 18 + neutral phase-* (1일)**:

```
MCU domain (grandfathered):    /misra-c, /freertos, /stm32-hal, /nxp-mcuxpresso, /cmake-embedded, /hw-analysis, /mcu-critical-analysis, /communication, /serial-bridge
MPU domain (grandfathered):    /yocto-build, /yocto-build-reproducibility, /yocto-review, /yocto-stm32-bsp, /yocto-stm32-build, /yocto-stm32-recipe, /yocto-stm32-setup, /kernel-driver, /imx-bsp, /rootfs-config, /board-debug
WPF domain (grandfathered):    /wpf-mvvm, /xaml-design, /dotnet-patterns
Neutral Capability:            /phase-1 ~ /phase-9, /starter, /dynamic, /enterprise
```

grandfathered: frontmatter `grandfathered: true` + body-neutrality 검사 면제.

**자동화 도구**: `scripts/skill-body-extract.mjs` 신설 (--scan + --insert-markers + --verify 모드).

### 3.5 FR-05 CR-4 CO-4 BKIT_VERSION reject

A.version reject로 종속 차단. `policies/version.json` SoT 작성 안 함. bkit sync 추적은 `docs/policy/gstack-sync-policy.md` 수동 유지.

### 3.6 FR-06 CR-5 SBOM 자동화 adopt

- `scripts/gen-sbom.mjs` 신설 — `npm ci --ignore-scripts --prefer-offline` + `@cyclonedx/cyclonedx-npm` JSON 생성
- 로컬 경로: offline only (signatures 스킵)
- CI 경로: `npm audit signatures` 보강
- `.github/workflows/sbom.yml` 신설 — `on: [pull_request, push: main, schedule: weekly]`
- `package.json`: `"sbom": "node scripts/gen-sbom.mjs"`
- 출력: `sbom/bom.json` + `.gitattributes` `linguist-generated=true`

```js
// scripts/gen-sbom.mjs 골자
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('sbom', { recursive: true });
execSync('npm ci --ignore-scripts --prefer-offline', { stdio: 'inherit' });
const bom = execSync('npx --no-install @cyclonedx/cyclonedx-npm --output-format JSON --omit dev', { encoding: 'utf8' });
writeFileSync('sbom/bom.json', bom);
if (process.env.CI) execSync('npm audit signatures', { stdio: 'inherit' });
console.log('SBOM ok:', JSON.parse(bom).components?.length, 'components');
```

### 3.7 FR-07 CR-6 E + CO-2 cycle-4 이월

**override_reason** (cycle-3 escalation_count == 2 임계 → 80자+ 필수):

> bkit `event-recorder.js`는 promptHash/outputHash 0 (200자 truncate만). hash-only 전환은 재작성 수준. FR-09 알고리즘 재사용 가능하나 opt-in prompt + retention 90일 expire + canary regex >= 3 추가 비용 18-25h 측정됨 (Plan §5.1 cycle-3 16h 범위 초과). cycle-4 묶음 처리로 영구 차단.

**unblock_condition** (R3~R5 통과):

> lib/cc-regression/event-recorder.js exists with promptHash/outputHash fields (sha256:14 from anonymizeFingerprint reuse) AND .rkit/state/.cc-regression-consent file write path implemented AND scripts/check-retention.mjs exists with 90-day mtime expire AND smoke TC >= 8 PASS (tests/cycle4/cc-regression-*.test.js)

**final_revisit_by**: `cycle-4` (hard deadline). cycle-4에서 escalation_count == 3 → defer 금지 (adopt/partial/reject 강제).

### 3.8 FR-08 CR-7 C lib/orchestrator permanent reject

```jsonc
{
  "id": "CR-7",
  "decision": "reject",
  "permanent_reject": true,
  "reasoning": "Council 결정. cycle-2 defer 사유 (책임 중복 4건) 재평가 결과 통합 불가 확정. bkit 1 모듈 통합 책임 (의도/PDCA/team/trust) ↔ rkit 4 독립 모듈 1:N 비대칭. rkit는 PDCA를 1급 시민으로 둔 아키텍처로 bkit orchestrator hierarchy와 책임 분할 방향이 다름. facade 통합 시 4 모듈 외부 호출자 호환 깨짐 (Plan 위-8 High/High). cycle-2 auto_defer_trigger overlap >= 3 충족 상태 변화 없어 cycle-4 추가 defer는 Plan D-3 위배. synergy는 측정된 효익 없음. 영구 reject로 cycle-4+ 재논의 차단.",
  "evidence": [
    "lib/intent/router.js (rkit 의도 분류 독립)",
    "lib/pdca/lifecycle.js (rkit PDCA 1급 모듈)",
    "lib/team/coordinator.js (rkit 12 PDCA agents 분배)",
    "lib/control/trust-engine.js (rkit L0-L5 trust engine 독립)",
    "references/bkit-claude-code/lib/orchestrator/ (bkit 4 책임 통합 1 모듈)",
    "cycle2-matrix.json C.auto_defer_trigger=overlap>=3"
  ]
}
```

### 3.9 FR-09 CR-8 CO-1 JSONL rotation cascade defer

D reject + E cycle-4 defer → 회전 정책 통합 대상 부재. 정책 권고만 문서 유지 (`docs/policy/network-egress.md` 보존).

**override_reason** (escalation_count == 2):

> cycle-2 cascade defer 사유 (depends_on [D, E] 미해소) cycle-3에서도 동일. D rejected (영구), E cycle-4 이월. cycle-3 신규 작업 없음 — 정책 권고 5MB/5000 entries/1 backup만 문서 보존. cycle-4 E adopt 시 동반 도입.

**final_revisit_by**: `cycle-4`

### 3.10 FR-10 D-3 strict gate 구현

`scripts/verify-policy.js` 패치 — `checkDecisionsMatrix()`:

```js
const matrixPath = path.join(ROOT, 'policies/decisions/cycle3-matrix.json'); // cycle-3 enumeration
// 또는 manifest enumeration:
const manifest = JSON.parse(fs.readFileSync('policies/manifest.json', 'utf8'));
const matrixEntries = manifest.entries.filter(e => e.path.match(/^decisions\/cycle\d+-matrix\.json$/));
for (const entry of matrixEntries) {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies', entry.path), 'utf8'));
  const STRICT = Number(m.cycle) >= 3;
  // STRICT면 R1~R7, 아니면 legacy
}
```

### 3.11 FR-11 escalation-policy.json 신설

```jsonc
{
  "version": "1.0",
  "policy": "max_defer_escalation",
  "since": "cycle-3",
  "warn_at": 1,
  "fail_at": 2,
  "prohibit_at": 3,
  "applies_to": "policies/decisions/cycle*-matrix.json",
  "rule": "escalation_count >= 2 시 override_reason >= 80자 + final_revisit_by 필수. >= 3 시 defer 금지.",
  "description": "무한 defer 사슬 차단. cycle 경계 마다 escalation_count += 1 (이전 cycle decision === 'defer')."
}
```

manifest 등록 추가.

### 3.12 FR-12 verify-policy `decisions-matrix` 검사 — multi-cycle

기존: `cycle2-matrix.json` 단일 hardcoded → manifest enumeration:
1. manifest entries 중 `^decisions/cycle\d+-matrix\.json$` 패턴 모두 검사
2. cycle 필드 기반 STRICT 분기
3. legacy 면제 (cycle 2 매트릭스는 R1 >= 20자, R2 OR 유지)

### 3.13 FR-13 check-sunset.js 갱신

cycle 2 transitional 3 items (network_egress / regression_retention / 등) cycle-4 sunset.
- current = 3 비교 → cycle-3 종료 시 `sunset == current + 1` → **WARN**
- cycle-4 시작 시 `sunset == current` → **FAIL**

규칙: `current >= sunset` FAIL (design-validator W-3 권고).

### 3.14 FR-14 cycle3 smoke TC

| TC | 검증 |
|----|------|
| TC-C3-01 | PR-A Workflow 7 SKILL 마커 쌍 존재 |
| TC-C3-02 | PR-A Workflow 7 SKILL `## 0. 문서 구조` 절 포함 |
| TC-C3-03 | PR-A neutral SKILL body locked-vocab 0건 |
| TC-C3-04 | PR-B Capability grandfathered frontmatter 존재 |
| TC-C3-05 | cycle 2 smoke 78/78 회귀 PASS |
| TC-C3-06 | cycle3-matrix.json 8 candidates non-pending |
| TC-C3-07 | escalation_count >= 2 시 override_reason >= 80자 |
| TC-C3-08 | escalation_count >= 3 시 decision !== 'defer' |
| TC-C3-09 | reasoning >= 50자 (R1) |
| TC-C3-10 | defer 시 unblock_condition + revisit_by (R2) |
| TC-C3-11 | unblock_condition 모호 패턴 거부 (R3) |
| TC-C3-12 | cc-payload.port + docs-code-index.port type-only |
| TC-C3-13 | sbom/bom.json 생성 + components > 0 |
| TC-C3-14 | scripts/gen-sbom.mjs offline mode (HTTP import 0) |
| TC-C3-15 | check-sunset.js current=3, sunset=4 → WARN |
| TC-C3-16 | permanent_reject: true 시 cycle-N+ matrix 재등록 차단 |
| TC-C3-17 | cycle 2 매트릭스 legacy 규칙 면제 (STRICT flag false) |

목표: >= 30 TC. 위 17 + smoke 11~13 추가 (port 구현체 통합 + Workflow 변환 회귀 + manifest sync).

---

## 4. PR 분할 (3-PR + Workflow/Capability 분리)

| PR | 내용 | 커밋 범위 |
|----|------|----------|
| **PR-1 governance** | cycle3-matrix.json + escalation-policy.json + manifest entry 2건 + verify-policy STRICT flag + check-sunset 갱신 + 정책 문서 (`docs/policy/escalation.md`) | C0~C5 |
| **PR-2 Workflow SKILL 변환 (PR-A)** | 7 SKILL + skill-body-extract.mjs 스캔 모드 + smoke TC-C3-01~03 | C6~C9 |
| **PR-3 Capability SKILL 변환 (PR-B)** | 18 SKILL grandfathered + neutral phase-* + smoke TC-C3-04~05 | C10~C13 |
| **PR-4 implementation** | CR-2 ports adopt (cc-payload + docs-code-index) + CR-5 SBOM (gen-sbom.mjs + .github/workflows/sbom.yml) | C14~C18 |
| **PR-5 decisions** | matrix 8 결정 갱신 + override_reason + permanent_reject + 모든 cycle3 smoke TC | C19~C22 |

---

## 5. Risks (council 통합)

| ID | Risk | Prob | Impact | Mitigation |
|----|------|:---:|:---:|------------|
| 위-1 | cycle 2 매트릭스 R2 AND 적용 시 D `revisit_by: null` FAIL | High | High | STRICT flag — cycle 2 면제 |
| 위-2 | FR-12 의미 모호 (cycle2 검사 유지 vs 교체) | Medium | Medium | manifest enumeration + STRICT 분기로 둘 다 검사 |
| 위-3 | 28 SKILL 일괄 변환 위험 | Medium | High | 분류별 단계 (PR-A → PR-B) 채택 |
| 위-4 | grandfathered Capability body-neutrality 위배 오탐 | Medium | High | frontmatter `grandfathered: true` 검사 면제 |
| 위-5 | SBOM 외부 호출 egress 정책 약화 | Medium | High | offline only 로컬 + CI signatures 분리 |
| 위-6 | E cycle-4 이월 후 escalation_count == 3 도래 | High | Medium | final_revisit_by cycle-4 hard deadline → cycle-4 escalation prohibit_at=3 강제 결정 |
| 위-7 | CR-1 session-ctx-fp 해시 호환 (bkit 16자 vs rkit 14자) | High | Medium | rkit 단방향 — bkit 채택 reject, 호환 비교 도구 별도 작성 (선택) |
| 위-8 | SKILL 마커 삽입 실수 — verify-policy 임시 깨짐 | Low | Low | PR 단위로만 verify-policy. 중간 브랜치는 `--check body-neutrality` 단독 |
| 위-9 | escalation 정책 신설 — never-gate 통합 vs 별도 SoT 갈등 | Low | Low | 별도 SoT (`escalation-policy.json`) 채택 — never-gate boolean enable 패턴 유지 |
| 위-10 | CR-3 cycle 3 기간 (2일) 내 27 SKILL 변환 미완 | Medium | Medium | Workflow 0.5일 + Capability 1일 — 마커 삽입 위주, 새 절 작성 최소화 |
| 위-11 | CR-6 cycle-4 이월 시 cycle-4 carry-over 사슬 형성 | Medium | Medium | escalation_count cycle-4 == 3 → defer 금지로 강제 결정 |
| 위-12 | Codex stop-hook — cycle 3 신규 모듈 (port + SBOM) dead code | Medium | Medium | 각 commit 후 wire-in 검증 + scanVersions canonical 확인 (cycle 2 C21 패턴) |

---

## 6. Decision Records (council 합의)

| DR | Decision | Council Agent | Status |
|----|----------|---------------|--------|
| D-1 | cycle3-matrix.json separate | enterprise | **Accepted** |
| D-2 | 28 SKILL 변환 옵션 C (분류별 단계) | enterprise + frontend | **Accepted** |
| D-3 | 7 규칙 강화 + STRICT flag + escalation 정책 | design-validator | **Accepted** |
| D-4 | E hash 알고리즘 옵션 A (FR-09 재사용) + cycle-4 이월 | security | **Accepted** |
| D-5 | C lib/orchestrator permanent reject | security | **Accepted** |
| D-6 | SBOM CI: GitHub Actions + tag PreToolUse 보조 | infra | **Accepted** |
| D-7 | SBOM 외부 호출: 옵션 C (offline + CI signatures) | infra | **Accepted** |
| D-8 | manifest 등록: Plan 종료 시점 (빈 matrix) | enterprise | **Accepted** |
| D-9 | cycle_origin / predecessor_decision / escalation_count 3 신규 필드 | design-validator | **Accepted** |
| D-10 | escalation 별도 SoT (`policies/escalation-policy.json`) | design-validator | **Accepted** |

---

## 7. Open Questions (Design 이후)

| Q-ID | Question | Owner | Status |
|------|----------|-------|--------|
| Q-1 | manifest enumeration vs cycle3 단일 hardcoded — verify-policy 패치 범위 | Do 단계 | Pending |
| Q-2 | skill-body-extract.mjs `--insert-markers` 자동 vs 수동 변환 | Do 단계 | Pending |
| Q-3 | GitHub Actions cron 주기 weekly vs daily | Do 단계 | Pending |
| Q-4 | cc-payload.port `@implements` JSDoc 적용 시점 — port 신설 commit vs cc-bridge 갱신 별도 commit | Do 단계 | Pending |
| Q-5 | escalation-policy.json 추가 manifest entry 시점 — cycle3-matrix와 동시 vs 분리 | Do 단계 | Pending |

---

## 8. Acceptance Criteria

- [ ] `policies/decisions/cycle3-matrix.json` 8 candidates 모두 non-pending
- [ ] cycle3 smoke TC >= 30 PASS + cycle2 78/78 회귀 PASS
- [ ] verify-policy 9/9 PASS (manifest enumeration + STRICT flag 적용)
- [ ] sbom/bom.json 생성 + GitHub Actions workflow 활성화
- [ ] SKILL 27건 변환 완료 (Workflow 7 + Capability 18 + neutral phase-* + starter/dynamic/enterprise)
- [ ] `policies/escalation-policy.json` 신설 + manifest 등록
- [ ] escalation_count 메커니즘 작동 — CR-6/CR-8 override_reason 80자+ + final_revisit_by 검증
- [ ] CR-7 `permanent_reject: true` cycle-4+ 재논의 차단
- [ ] Codex stop-hook 0건 차단 — wire-in + SoT 검증
- [ ] cycle3-end git tag 부착 (cycle3-start tag 동반)
- [ ] cycle 3 종료 시 carry-over 0 또는 명시 reject (D-3 cycle-N 이월 거부)

---

**Status**: Draft v0.1 — council 6/6 합의 통합. Do 단계 진행 가능.
