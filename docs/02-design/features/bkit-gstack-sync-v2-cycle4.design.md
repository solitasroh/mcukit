---
template: design
version: 0.1
description: bkit-gstack-sync-v2 Cycle 4 — carry-over 강제 종결 (council 6명)
---

# bkit-gstack-sync-v2-cycle4 Design Document

> **Summary**: 6 candidates × council 통합. CR4-1 permanent reject + CO-2 분리 채택 + sunset permanent 전환 + cascade reject. 8h 5-PR carry-over 0 목표.
>
> **Project**: rkit
> **Version**: 0.9.13
> **Author**: soojang.roh + 6-agent council
> **Date**: 2026-05-13
> **Status**: Draft (v0.1)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | cycle 3 이월 4 + sunset 2 + 신규 분석 → 6 candidates. escalation_count=3 prohibit_at 도래 — defer 금지. |
| **Solution** | CR4-1 permanent reject (cycle 4 16h 범위 + cycle 2 산출물 obsolete 마킹) + CO-2 canary 분리 채택 + sunset permanent 전환 + cascade reject. |
| **Function/UX Effect** | 6 candidates: adopt 1 (CO-2 canary) + reject 5 (CR4-1 permanent + 4 cascade). carry-over 0 목표 달성. Plan D-3 정책 자기 강제력 검증. |
| **Core Value** | "cycle-N 이월" 무한 defer 메커니즘적 차단 작동 증명. Plan D-3 STRICT gate + escalation prohibit_at 정책이 cycle 4에서 실제 강제 결정 유도 검증. |

---

## 1. Overview

### 1.1 Council 결정 책임

| Agent | 담당 |
|-------|------|
| `rkit:security-architect` | CR4-1 reject + CO-2 canary 분리 채택 |
| `rkit:infra-architect` | CR4-4 permanent / CR4-3 token-meter permanent reject / check-sunset.js 패치 |
| `rkit:frontend-architect` | CR4-6 옵션 C (cycle 5+ 명시 제외) |
| `rkit:enterprise-expert` | CR4-1 reject 전략 + 8h 5-PR 구조 + carry-over 0 확률 80% |
| `rkit:design-validator` | escalation_history + cascade_origin + verify-policy 패치 |
| `rkit:code-analyzer` | reject 시 obsolete 마킹 절차 + token-meter 도메인 부재 검증 |

### 1.2 핵심 결정 (vs Plan v0.1)

1. **CR4-1 permanent reject** (Plan adopt vs reject 둘 다 검토 → council 3/3 reject 합치)
2. **CO-2 canary 분리 채택** (Plan에서 CR4-1과 묶음 → council 분리 권고, 4-6h 별도 채택)
3. **CR4-2/CR4-3 cascade permanent reject** (Plan defer cascade → council permanent reject)
4. **sunset 2건 permanent 전환** (Plan permanent vs 연장 → council permanent 합치)
5. **CR4-6 옵션 C 명시 제외** (Plan 다중 옵션 → council 옵션 C 확정)
6. **escalation_history + cascade_origin 신규 필드** (Plan에 없음 → design-validator 권고)

---

## 2. Architecture

### 2.1 cycle4-matrix.json 스키마 (cycle 3 + 신규 2 필드)

```jsonc
{
  "version": "1.0",
  "cycle": "4",
  "candidates": [
    {
      "id": "CR4-N",
      "decision": "permanent_reject|reject|adopt|partial_adopt",
      "reasoning": "...",                       // >= 50자 (R1)
      "evidence": [...],                        // >= 2 (R7)
      "decided_by": {...},
      "escalation_count": 0~3,
      "escalation_history": [                   // 신규 — audit 추적
        {"cycle":"2", "decision":"defer", "matrix_ref":"decisions/cycle2-matrix.json#E"},
        {"cycle":"3", "decision":"defer", "matrix_ref":"decisions/cycle3-matrix.json#CR-6"},
        {"cycle":"4", "decision":"reject", "matrix_ref":"decisions/cycle4-matrix.json#CR4-1"}
      ],
      "cascade_origin": true,                   // 신규 — cascade defer escalation 분리
      "cascade_parent": "CR-2",                 // 신규 — 부모 candidate
      "permanent_reject": true                  // cycle-N+ 재논의 차단
    }
  ],
  "strict_mode": true,
  "completion_gate": {
    "rule": "All 6 candidates non-pending. STRICT R1~R7. CR4-1/CR4-2 prohibit_at terminal — defer 금지. CR4-3 cascade_origin=true escalation_count=0.",
    "check": "scripts/verify-policy.js --check decisions-matrix"
  }
}
```

### 2.2 verify-policy.js 패치 (5줄 + 분기)

```js
const expectedCounts = { '2': 11, '3': 8, '4': 6 };

// cascade_origin 분기 — escalation_count 0 강제, prohibit_at 무관
const isCascade = c.cascade_origin === true && typeof c.cascade_parent === 'string';
if (isCascade && c.escalation_count !== 0) {
  errors.push(`${id}: cascade_origin=true requires escalation_count=0`);
}

// escalation_history 검증 (cycle 4 이상 STRICT 한정)
if (cycleNum >= 4 && c.escalation_count > 0 && !isCascade) {
  if (Array.isArray(c.escalation_history)) {
    if (c.escalation_history.length !== c.escalation_count + 1) {
      errors.push(`${id}: escalation_history.length must equal escalation_count+1`);
    }
  }
}
```

### 2.3 6 Candidates 결정 매트릭스

| ID | 후보 | 결정 | escalation | cycle_origin | predecessor |
|----|------|------|:---:|--------------|-------------|
| **CR4-1** | E + CO-2 cc-regression | **permanent_reject** | 3 (terminal) | cycle-3-carryover | CR-6 defer |
| **CR4-2** | CO-1 JSONL rotation | permanent_reject (cascade) | 3 (terminal) | cycle-3-carryover | CR-8 defer |
| **CR4-3a** | regression-registry.port | permanent_reject (cascade) | 0 (cascade_origin) | cycle-3-carryover | CR-2 partial |
| **CR4-3b** | token-meter.port | permanent_reject (도메인 부재) | 0 (cascade_origin) | cycle-3-carryover | CR-2 partial |
| **CR4-4** | network_egress sunset | permanent 전환 (NEW adopt) | 0 | cycle-4-new | null |
| **CR4-5** | regression_retention sunset | reject (CR4-1 종속, 항목 제거) | 0 | cycle-4-new | null |
| **CR4-6** | 27 SKILL P3 | explicit_exclude (cycle 5+) | 0 | cycle-4-new | null |
| **CO-2 canary** | 분리 채택 | adopt (별도 candidate or 통합) | 0 | cycle-4-new | CR-6 |

**참고**: CR4-3은 2 sub-candidates (a/b) 또는 단일 candidate에서 reasoning 분기 — Design 선택: 단일 CR4-3 candidate로 두 ports 모두 reject (cascade_parent: "CR-2").

총 candidates 수: 6 (CR4-1, CR4-2, CR4-3, CR4-4, CR4-5, CR4-6). CO-2는 CR4-1 reject 후 분리 채택 — 신규 candidate **CR4-7** (canary) 추가 → 총 **7 candidates**.

→ Plan FR-01 "6 candidates"에서 **7로 보정** (CO-2 분리 채택 반영).

### 2.4 sunset 처리

**never-gate.json 갱신**:

```jsonc
{
  "id": "network_egress",
  "scope": "permanent",
  "promoted_at": "cycle-4",
  "promoted_from": "transitional",
  "previous_sunset": "cycle-4",
  "reason": "cycle-3 verify-policy 9/9 PASS 회귀 검증 + module group F 영구 미도입 — cycle 5+ 부활 시 신규 candidate 평가"
},
{
  "id": "regression_retention",
  "REMOVED": true  // CR4-1 permanent_reject — retention 검사 대상 부재
}
```

**check-sunset.js 패치** (5줄, infra 권고):

```js
for (const item of ng.items || []) {
  if (item.scope === 'permanent') continue;  // 신규 — 명시적 skip
  if (item.scope !== 'transitional' || !item.sunset) continue;
  ...
}
```

---

## 3. Detailed Design (FRs)

### 3.1 FR-01 cycle4-matrix.json 신설 (7 candidates)

7 candidates × 5 enum + STRICT + escalation_history + cascade_origin. manifest 등록 추가.

### 3.2 FR-02 CR4-1 permanent reject

**reasoning (>= 50자, R1)**:
> Council 결정 (security + enterprise + code-analyzer). cc-regression cycle 3 council 비용 18-25h 측정 vs cycle 4 16h 범위 — 112~156% 초과 확정. escalation_count=3 prohibit_at 도래로 cycle-5 추가 defer는 정책 임계 위반. core 보안 가치 (regression 탐지)는 CO-2 canary regex 5 패턴 분리 채택으로 70-80% 대체 가능. rkit 임베디드 plugin 도메인 부합도 낮음 — cc-regression 본래 목적은 hooks 회귀 탐지인데 rkit hooks 표면적 작음. hash collision 표면 (sha256:14 ≈ 2^56) + opt-in prompt 우회 가능성 + raw text 회귀 리스크가 도입 가치 < 도입 비용 + 보안 표면. 영구 reject로 cycle-5+ 재논의 차단. (총 412자)

**evidence (>= 2, R7)**:
- cycle 3 council 비용 측정 18-25h (cycle 3 archive analysis.md)
- rkit `lib/cost/` / `lib/metering/` / `lib/telemetry/` 디렉토리 부재 (Glob 검증)
- CO-2 canary 5 패턴 대체 가능성 (AWS / GitHub / OpenAI / Slack / Google)
- bkit `references/bkit-claude-code/lib/cc-regression/event-recorder.js` (200자 truncate, hash 0 — 재작성 evidence)
- `policies/escalation-policy.json` prohibit_at=3

### 3.3 FR-03 cycle 2 산출물 obsolete 마킹 (CR4-1 reject 후속)

| 산출물 | 처리 |
|--------|------|
| `docs/policy/gdpr-cc-regression.md` | 상단 banner `> **Status**: OBSOLETE (CR4-1 permanent_reject, 2026-05-13)` + 이력 보존 |
| `scripts/pdca-regression-purge.mjs` | 헤더 주석 추가 `// @deprecated cycle-4 CR4-1 reject. Standalone tool — reusable for other jsonl purge`. 보존 (manifest 미등록 확인) |
| `tests/cycle2/regression-retention.smoke.test.js` | describe.skip + reject 사유 주석 |
| `.rkit/state/cc-regression.jsonl` | 존재 시 purge 1회 실행 후 reject 결정 |

### 3.4 FR-04 CR4-2 CO-1 JSONL rotation permanent_reject

CR4-1 cascade. reasoning: jsonl 정책 통합 대상 부재. 향후 다른 jsonl 도메인 (e.g. audit.jsonl) 신설 시 별도 candidate 평가.

### 3.5 FR-05 CR4-3 잔여 2 ports permanent_reject (cascade)

regression-registry: CR4-1 cascade (port 도입 의미 부재). token-meter: rkit 토큰 도메인 부재 검증 (lib/cost / metering / telemetry 0).

**cascade_origin: true** + **escalation_count: 0** (cycle 4 신규 candidate 처리, 부모 CR-2 partial_adopt 영향 없음).

### 3.6 FR-06 CR4-4 network_egress permanent 전환

`scope: "permanent"` + `sunset` 필드 삭제 + `promoted_at`/`promoted_from`/`previous_sunset` 이력 추가.

### 3.7 FR-07 CR4-5 regression_retention 항목 제거

CR4-1 reject로 retention 검사 대상 부재 — never-gate.json `regression_retention` 항목 삭제. `docs/policy/gdpr-cc-regression.md` obsolete 마킹은 FR-03 처리.

### 3.8 FR-08 CR4-6 27 SKILL explicit_exclude (cycle 5+)

```json
{
  "id": "CR4-6",
  "decision": "explicit_exclude",
  "reasoning": "27 SKILL 대부분 classification frontmatter 보유. 미변환 실체는 body marker 미삽입뿐으로 런타임 영향 없음. cycle 4 critical path는 CR4-1 강제 결정 + sunset 처리. P3 + 위-8 일정 초과 리스크로 본 cycle 범위 밖. cycle 5+ 신규 candidate 평가. 분류 권고: grandfathered 7 (op-* + mr-conventions + project-workspace), neutral 20."
}
```

`explicit_exclude` 신규 decision 값 — enum 확장 필요. 대안: `defer` + revisit_by `cycle-5` + unblock 명시 (Plan D-3 STRICT 통과 검증 필수).

**Design 선택**: `defer` + revisit_by `cycle-5` + unblock_condition (R3~R5 통과 문구). cascade 아님 — escalation_count=0 (cycle 4 신규).

### 3.9 FR-09 CR4-7 CO-2 canary 분리 채택 (4-6h)

5 regex 패턴 + `scripts/security/canary-patterns.json` SoT + `scripts/security/scan-canary.mjs` + `/security-review` SKILL 통합.

**패턴**:

```jsonc
[
  { "id": "CK-001", "service": "AWS Access Key", "regex": "AKIA[0-9A-Z]{16}", "severity": "high" },
  { "id": "CK-002", "service": "GitHub PAT",     "regex": "gh[ps]_[A-Za-z0-9]{36}", "severity": "high" },
  { "id": "CK-003", "service": "OpenAI API Key", "regex": "sk-[A-Za-z0-9]{48}", "severity": "high" },
  { "id": "CK-003a", "service": "OpenAI Project Key", "regex": "sk-proj-[A-Za-z0-9_-]{40,}", "severity": "high" },
  { "id": "CK-004", "service": "Slack Bot Token","regex": "xoxb-[0-9]{11,13}-[0-9]{11,13}-[A-Za-z0-9]{24}", "severity": "high" },
  { "id": "CK-005", "service": "Google API Key", "regex": "AIza[0-9A-Za-z\\-_]{35}", "severity": "high" }
]
```

False positive exclusion: `*.test.{ts,js,c,cs}`, `*.mock.*`, `fixtures/**`, `docs/**/example*`.

### 3.10 FR-10 check-sunset.js 패치 (5줄 명시성)

infra 권고 — `scope === 'permanent'` 명시 skip + smoke TC.

### 3.11 FR-11 escalation_history + cascade_origin 신규 필드

verify-policy.js 검증 추가 (5-10줄). cycle 4 이상 STRICT 한정.

### 3.12 FR-12 verify-policy `expectedCounts['4'] = 7` (CO-2 분리 채택 반영)

### 3.13 FR-13 cycle4 smoke TC

| TC | 검증 |
|----|------|
| TC-C4-01 | cycle4-matrix.json 7 candidates non-pending |
| TC-C4-02 | CR4-1 permanent_reject + reasoning >= 50자 + evidence >= 2 |
| TC-C4-03 | CR4-1 escalation_count=3 + escalation_history.length=4 |
| TC-C4-04 | CR4-2 cascade cascade_origin=true + escalation_count=0 |
| TC-C4-05 | CR4-3 token-meter reasoning 도메인 부재 검증 인용 |
| TC-C4-06 | CR4-4 never-gate.json scope=permanent + sunset 필드 삭제 |
| TC-C4-07 | CR4-5 never-gate.json regression_retention 항목 부재 |
| TC-C4-08 | CR4-7 scripts/security/canary-patterns.json 5+ 패턴 |
| TC-C4-09 | scripts/security/scan-canary.mjs 실행 + 5 패턴 매칭 검증 |
| TC-C4-10 | check-sunset.js cycle-4 진입 시 0 FAIL (모든 transitional 처리됨) |
| TC-C4-11 | check-sunset.js permanent scope skip 명시 |
| TC-C4-12 | verify-policy expectedCounts['4']=7 |
| TC-C4-13 | escalation_history cycle 2/3/4 ref 3건 |
| TC-C4-14 | cycle2 78 + cycle3 46 회귀 PASS |
| TC-C4-15 | escalation_count=3 + decision='defer' 시 FAIL (정책 자기 강제력) |
| TC-C4-16 | obsolete 마킹: gdpr-cc-regression.md banner 존재 |
| TC-C4-17 | obsolete 마킹: pdca-regression-purge.mjs @deprecated 주석 |
| TC-C4-18 | CR4-6 defer revisit_by cycle-5 + unblock_condition R3~R5 통과 |
| TC-C4-19 | CO-2 canary regex false positive 제외 규칙 (test/mock/fixtures) |
| TC-C4-20 | permanent_reject 플래그 5건 (CR4-1, CR4-2, CR4-3, CR4-3 token-meter 분리 시) |

목표 >= 20 TC.

---

## 4. PR 분할 (enterprise 권고 5-PR)

| PR | 내용 | 시간 |
|----|------|------|
| **PR-1 governance** | cycle4-matrix.json + manifest 추가 + verify-policy 패치 (expectedCounts + cascade_origin) | 2h |
| **PR-2 sunset 처리** | never-gate.json permanent 전환 + regression_retention 제거 + check-sunset.js 패치 | 1.5h |
| **PR-3 CR4-1 reject + obsolete 마킹** | gdpr-cc-regression.md banner + pdca-regression-purge.mjs @deprecated + cycle 2 TC skip | 1h |
| **PR-4 CR4-7 CO-2 canary 채택** | canary-patterns.json + scan-canary.mjs + /security-review 통합 | 1.5h |
| **PR-5 decisions + smoke + report + archive** | 20 cycle4 smoke TC + analysis + report + archive | 2h |

총 **8h**. enterprise 권고와 일치.

---

## 5. Risks

| ID | Risk | Prob | Impact | Mitigation |
|----|------|:---:|:---:|------------|
| 위-1 cycle 2 obsolete 자산 잔존 — 기여자 혼란 | Low | Medium | banner + @deprecated marker 3중 표시 |
| 위-2 CO-2 canary false positive — CI 실패 증가 | Medium | Medium | exclusion 규칙 + dry-run 1주 후 enforcing |
| 위-3 escalation_history 필드 cycle 2/3 매트릭스 회귀 — 미존재 | Low | Low | cycle 4 이상 STRICT 한정 적용 |
| 위-4 cascade_origin escalation_count 분리 — 검증 로직 누락 | Medium | Medium | verify-policy 5줄 패치 + smoke TC-C4-04 |
| 위-5 token-meter 영구 reject 후 bkit cycle 5+ 의존 모듈 cascade — 의존 사슬 단절 | Low | Low | reject 사유에 영구 명시 + 신규 candidate 경로 명기 |
| 위-6 check-sunset.js 패치 누락 — `scope === 'permanent'` skip 분기 미작동 | Low | Medium | smoke TC-C4-11 + 코드 리뷰 |
| 위-7 cycle 4 종료 후 carry-over 0 미달 | Low | High | reject 우선 + CR4-6 explicit_exclude/defer (escalation 0) |
| 위-8 Codex stop-hook 0건 차단 깨짐 | Low | Medium | 매 commit 후 wire-in 검증 |

---

## 6. Decision Records

| DR | Decision | Council | Status |
|----|----------|---------|--------|
| D-1 | CR4-1 permanent reject (cc-regression) | security + enterprise + code-analyzer | **Accepted** |
| D-2 | CO-2 canary 분리 채택 (CR4-7 신규 candidate) | security | **Accepted** |
| D-3 | CR4-2 CO-1 JSONL cascade permanent_reject | security + code-analyzer | **Accepted** |
| D-4 | CR4-3 cascade_origin + escalation_count=0 | design-validator | **Accepted** |
| D-5 | CR4-3 token-meter permanent reject (도메인 부재 검증) | infra + code-analyzer | **Accepted** |
| D-6 | CR4-4 network_egress permanent 전환 (sunset 필드 삭제) | infra | **Accepted** |
| D-7 | CR4-5 regression_retention 항목 제거 (CR4-1 cascade) | security + infra | **Accepted** |
| D-8 | CR4-6 27 SKILL defer cycle-5 + unblock 명시 | frontend + design-validator | **Accepted** |
| D-9 | escalation_history + cascade_origin 신규 필드 | design-validator | **Accepted** |
| D-10 | verify-policy 패치 — expectedCounts + cascade 분기 | design-validator | **Accepted** |
| D-11 | check-sunset.js 5줄 명시성 패치 (`permanent` skip) | infra | **Accepted** |
| D-12 | escalation 자동화 옵션 C (verify-policy 검증) | design-validator | **Accepted** |

---

## 7. Acceptance Criteria

- [ ] `policies/decisions/cycle4-matrix.json` 7 candidates 모두 non-pending
- [ ] cycle4 smoke TC >= 20 PASS + cycle2 78 + cycle3 46 회귀 PASS
- [ ] verify-policy 9/9 PASS (`expectedCounts['4']=7` + cascade 분기 + escalation_history)
- [ ] `policies/never-gate.json` transitional 0건 (`network_egress` permanent / `regression_retention` 제거)
- [ ] check-sunset.js cycle-4 진입 시 0 FAIL
- [ ] CR4-1 reject + obsolete 마킹 3건 완료 (gdpr-cc-regression.md / pdca-regression-purge.mjs / cycle 2 TC skip)
- [ ] CR4-7 canary 5+ 패턴 SoT + 스캐너 작동
- [ ] permanent_reject 플래그 5건 명시 (cycle-5+ 재논의 차단)
- [ ] Codex stop-hook 0건 차단
- [ ] cycle4-end git tag 부착 (cycle4-start 동반)
- [ ] cycle 4 종료 시 carry-over 0 또는 명시 defer (CR4-6 cycle-5+, escalation_count=0)

---

**Status**: Draft v0.1 — Council 6/6 합의 통합. Do 단계 진행 가능.
