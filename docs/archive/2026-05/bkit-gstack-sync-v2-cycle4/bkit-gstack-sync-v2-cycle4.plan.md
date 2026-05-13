---
template: plan
version: 1.2
description: rkit ↔ bkit 정렬 cycle 4 — cycle 3 이월 4건 강제 결정 + sunset 처리
---

# bkit-gstack-sync-v2-cycle4 Planning Document

> **Summary**: Cycle 3 이월 4건 강제 종결 (escalation_count=3 prohibit_at) + transitional sunset 2건 처리
>
> **Project**: rkit
> **Version**: 0.9.13
> **Author**: soojang.roh
> **Date**: 2026-05-13
> **Status**: Draft (v0.1)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Cycle 3 이월 4건 (CR-6 E hash-only, CR-8 CO-1 cascade, CR-2 잔여 2 ports) 진입 시 escalation_count=3 도래 — prohibit_at 메커니즘으로 defer 영구 차단. transitional sunset 2건 (network_egress, regression_retention) 도래 시 FAIL. |
| **Solution** | CR-6 (E + CO-2) 하드 결정 — adopt 또는 reject 강제 (defer 금지). CR-8 + CR-2 잔여 2 cascade — CR-6 결정에 종속. sunset 2건 — 정책 영구 적용 또는 보강. |
| **Function/UX Effect** | rkit-bkit 정렬 사슬 종결, GDPR cc-regression 도입 또는 영구 제거 결정 명시. sunset transitional → permanent 전환으로 보안 정책 안정화. |
| **Core Value** | Plan D-3 STRICT gate 작동 검증 — cycle 3에서 설계한 무한 defer 차단 메커니즘이 cycle 4에서 실제 강제 결정 유도. 정책의 자기 강제력 검증. |

---

## 1. Overview

### 1.1 Purpose

Cycle 3 cycle3-end 시점 이월 4건 + transitional sunset 2건 강제 처리. cycle-N 사슬 종결.

### 1.2 Background

Cycle 3 종료 시 잔여:
- **CR-6 E + CO-2 cc-regression**: cycle 3 escalation_count=2 (defer 2회). cycle 4 진입 시 count=3 → `policies/escalation-policy.json` prohibit_at 메커니즘으로 defer 금지. adopt/partial_adopt/reject 강제.
- **CR-8 CO-1 JSONL rotation**: cycle 3 cascade defer. CR-6 결정에 종속 — cascade로 자동 결정.
- **CR-2 잔여 2 ports**: regression-registry cascade (CR-6 종속) + token-meter (도메인 부재).
- **Transitional sunset 2건**: `network_egress` + `regression_retention` cycle-4 sunset 도래 → `check-sunset.js` 진입 시 FAIL. 정책 영구 적용 또는 sunset 연장 결정 필수.

추가 검토 후보 (cycle 4 신규):
- 미변환 27 SKILL (Design FR-04 명시 외 — op-*, mr-conventions, mermaid, audit, benchmark 등) 검토.
- bkit cycle 3+ 신규 추가 모듈 (있다면) 검토.

### 1.3 Related Documents

- Cycle 3 archive: `docs/archive/2026-05/bkit-gstack-sync-v2-cycle3/` (plan + design + analysis + report)
- Cycle 3 matrix (cycle-2 SoT 동결과 동일 패턴 유지): `policies/decisions/cycle3-matrix.json`
- Escalation 정책: `policies/escalation-policy.json` (prohibit_at = 3)
- never-gate sunset: `policies/never-gate.json` (transitional 3 items, 2 sunset cycle-4 도래)
- D-3 게이트: `docs/policy/escalation.md`

---

## 2. Scope

### 2.1 In Scope

- [ ] **CR4-1 E + CO-2 강제 결정** (escalation_count=3) — adopt vs reject 평가. adopt 시 lib/cc-regression/ 신설 + opt-in + retention + canary 18-25h.
- [ ] **CR4-2 CO-1 JSONL rotation cascade** — CR4-1 결정 결과 종속. adopt 시 5MB/5000 entries/1 backup 정책 코드화.
- [ ] **CR4-3 CR-2 잔여 2 ports cascade** — regression-registry (CR4-1 종속) + token-meter (도메인 부재 — reject vs cycle 5+ defer).
- [ ] **CR4-4 network_egress sunset 처리** — `transitional` 유지 (sunset 연장) vs `permanent` 전환 vs 정책 폐기.
- [ ] **CR4-5 regression_retention sunset 처리** — CR4-1 결과와 연계 (E adopt 시 retention 90일 자동 활성화).
- [ ] **CR4-6 미변환 27 SKILL 분류 + 변환** (선택, P3) — Design FR-04 명시 외 SKILL 변환 또는 명시 제외.
- [ ] cycle4-matrix.json 신설 (cycle3 SoT 동결)
- [ ] verify-policy `decisions-matrix` cycle 4 대상 추가 — STRICT 규칙 cycle 3 동일 적용
- [ ] check-sunset.js — sunset 도래 후 FAIL 분기 검증 (cycle-4 진입 시점 자동 트리거)

### 2.2 Out of Scope

- bkit cycle 3 이후 신규 도입 (cycle-5 이후 평가)
- 미변환 27 SKILL 중 op-* (OpenProject 통합 영역) — bkit과 무관 (cycle 5+ 평가)
- 신규 도메인 SKILL 추가 (rkit 자체 신규 기능)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `policies/decisions/cycle4-matrix.json` 신설 — 6 candidates (CR4-1~CR4-6) × 5 decision enum | High | Pending |
| FR-02 | CR4-1 E + CO-2 강제 결정 — adopt 시 lib/cc-regression/event-recorder.js (hash-only sha256:14 + salt) + opt-in prompt + retention 90일 + canary regex | High | Pending |
| FR-03 | CR4-2 CO-1 JSONL rotation — CR4-1 adopt 시 5MB / 5000 entries / 1 backup file 자동 회전 모듈 | High | Pending |
| FR-04 | CR4-3 CR-2 잔여 2 ports 결정 — regression-registry cascade + token-meter reject 권고 | Medium | Pending |
| FR-05 | CR4-4 network_egress sunset 처리 — sunset 연장 vs permanent 전환 결정 + never-gate 갱신 | High | Pending |
| FR-06 | CR4-5 regression_retention sunset 처리 — CR4-1 결과 종속, 정책 갱신 | High | Pending |
| FR-06b | CR4-6 미변환 SKILL 분류 — Design FR-04 외 27 SKILL × {변환/grandfathered/명시 제외} | Low | Pending |
| FR-07 | cycle3-matrix → cycle4-matrix carry-forward — escalation_count cycle 4 진입 시 +1 (defer 결정 한정) | High | Pending |
| FR-08 | verify-policy decisions-matrix cycle 4 대상 추가 — manifest enumeration 자동 인식 | High | Pending |
| FR-09 | escalation_count prohibit_at=3 실제 작동 검증 — defer 결정 시 FAIL 발생 | High | Pending |
| FR-10 | check-sunset.js cycle-4 진입 시 sunset_cycle == current_cycle 도래 → FAIL 분기 검증 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|--------------------|
| 정책 자기 강제력 | escalation_count=3 도래 defer 결정 시 verify-policy FAIL | smoke TC |
| 종결 게이트 | 6 candidates 모두 non-pending + R1~R7 충족 + override_reason (escalation=3은 override 불가) | verify-policy decisions-matrix |
| GDPR | CR4-1 adopt 시 D-8 4 조건 모두 충족 (hash-only / 90일 / opt-in / purge) | docs/policy/gdpr-cc-regression.md |
| sunset 처리 | check-sunset.js current=4, sunset=4 → FAIL 정확 트리거 | smoke TC |
| 회귀 | cycle2 + cycle3 smoke 124/124 회귀 PASS | `node --test "tests/cycle*/*.test.js"` |
| 보안 | egress=deny 유지 (registry.npmjs.org allowlist 추가 금지) | verify-policy network-egress |
| 자동화 | sunset transitional → permanent 또는 정책 폐기 결정 명시 | never-gate.json 갱신 |
| 종료 일정 | cycle 4 목표 2일 (2026-05-14 ~ 2026-05-16) | git tag |
| 테스트 | cycle4 smoke TC >= 25 PASS | tests/cycle4/ |
| 코드 품질 | E adopt 시 신규 모듈 SQ-004 < 300 lines | wc -l |

### 3.3 Constraints

- D-3 STRICT gate (cycle 3 신설) 그대로 적용 — R1~R7
- escalation_count=3 prohibit_at — defer 금지 (강제 결정)
- raw PII 0건 유지
- registry.npmjs.org allowlist 추가 금지 (egress sunset 정책 일관성)
- cycle 4 종료 시 carry-over 0 목표 (또는 명시 reject)

---

## 4. Design Considerations

### 4.1 Architecture Approach

- cycle4-matrix.json separate (cycle 3 SoT 동결)
- CR4-1 (E) decision: adopt 시 신규 모듈 5종 (event-recorder, hash, opt-in-prompt, retention-check, canary-regex)
- sunset 처리: never-gate.json 갱신 (`transitional` → `permanent` 또는 항목 제거)
- check-sunset.js 분기 검증 — cycle-4 진입 시점에 FAIL 트리거

### 4.2 Tech Stack

| Layer | Technology |
|-------|------------|
| Decision tracking | `policies/decisions/cycle4-matrix.json` (STRICT) |
| GDPR purge | `scripts/pdca-regression-purge.mjs` (cycle 2 신규, cycle 4 활성화) |
| GDPR retention | `scripts/check-retention.mjs` (cycle 4 신설) — `.rkit/state/cc-regression.jsonl` mtime 90일 expire |
| Hash | `lib/core/anonymize-fingerprint.js` (FR-09 재사용, sha256:14 + salt) |
| Canary | `policies/canary-tokens.md` + regex `policies/canary-regex.json` |
| Sunset | `scripts/check-sunset.js` (cycle 2 신규, cycle 4 FAIL 작동 검증) |

### 4.3 Open Questions (Design 단계 해소)

- DR-1 CR4-1 adopt vs reject — D-8 4 조건 모두 충족 가능성 평가. cycle 3 council 측정 비용 18-25h.
- DR-2 sunset 처리 옵션 — transitional 유지 (cycle 5+ 재논의) vs permanent 전환 vs 정책 폐기.
- DR-3 token-meter.port reject vs cycle 5+ defer — rkit 토큰 도메인 부재.
- DR-4 미변환 27 SKILL 처리 — 일괄 vs 단계 vs 명시 제외 (P3 — 본 cycle 범위 밖 가능).
- DR-5 canary regex 패턴 출처 — bkit 참조 vs rkit 자체 정의.
- DR-6 escalation_count cycle 진입 시 자동 갱신 메커니즘 — 수동 vs 스크립트.

---

## 5. Implementation Plan

### 5.1 Phases

| Phase | Description | Duration | Output |
|-------|-------------|----------|--------|
| Plan | 본 문서 + carry-over 사슬 확인 | 0.5일 | plan.md |
| Design | DR-1~6 해소 + cycle4-matrix 스키마 | 0.5일 | design.md v0.x |
| Do | candidate 결정 + 구현 + smoke TC | 1일 | commits + tests |
| Check | gap 분석 + escalation 메커니즘 작동 검증 | 0.5일 | analysis.md |
| Report + Archive | 완료 보고서 + cycle4-end tag | 0.5일 | report.md + archive |

### 5.2 Critical Path

1. cycle4-matrix.json 신설 + manifest 등록
2. CR4-1 E adopt vs reject 결정 (Design DR-1 council)
3. CR4-1 adopt 시: lib/cc-regression/event-recorder.js + opt-in + retention 구현
4. CR4-2 CO-1 cascade: CR4-1 결과 기반
5. CR4-3 CR-2 잔여 2 cascade: 동일
6. CR4-4 sunset 처리: never-gate.json 갱신
7. CR4-5 sunset 처리: CR4-1 결과 연계
8. check-sunset.js FAIL 작동 검증 + verify-policy 회귀

### 5.3 Dependencies

- cycle3 SoT (cycle3-matrix.json 동결)
- D-8 GDPR 정책 (`docs/policy/gdpr-cc-regression.md`)
- FR-09 anonymize-fingerprint (cycle 2 sha256:14 + salt)
- bkit references: `references/bkit-claude-code/lib/cc-regression/event-recorder.js` (200자 truncate, 재작성 필요)

---

## 6. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 위-1 CR4-1 E adopt 비용 cycle-4 초과 (cycle 3 council 측정 18-25h, cycle 4 16h) | High | High | reject 영구 결정 우선 검토. adopt 시 5 PR 분할 또는 cycle-5 추가 이월 (escalation_count=4 — 정책 갱신 필요) |
| 위-2 sunset 도래 FAIL로 cycle 4 시작 차단 | Medium | High | check-sunset.js 일시 비활성 vs 정책 즉시 갱신 — Plan 첫 commit으로 sunset 연장 결정 |
| 위-3 escalation_count=3 prohibit_at 정책 자기 강제력 실패 (defer 강행 수단 발견) | Low | Critical | verify-policy 코드 리뷰 + smoke TC 강화 |
| 위-4 cycle 4 종료 시 carry-over 0 목표 미달 — cycle-5 이월 발생 | Medium | High | reject 결정 우선. escalation_count=4 도래 시 정책 임계 갱신 필요 (현재 prohibit_at=3) |
| 위-5 CR4-1 reject 시 docs/policy/gdpr-cc-regression.md 폐기 — cycle 2 신규 산출물 무효화 | Low | Low | reject 사유 명시 + 문서 obsolete 표기 (삭제 안 함, 결정 이력 보존) |
| 위-6 canary regex 패턴 false positive — 실제 secret 아닌 토큰 차단 | Medium | Medium | regex 패턴 검증 TC + allowlist 보완 |
| 위-7 token-meter reject 시 bkit cycle 5+ 도입 모듈 cascade — 의존 사슬 단절 | Low | Low | reject 사유에 영구 명시 (permanent_reject) |
| 위-8 미변환 27 SKILL 일괄 변환 시 cycle 4 일정 초과 | High | Medium | P3 우선순위, 본 cycle 범위 밖 결정 가능 |
| 위-9 cycle 4 escalation count 갱신 자동화 미구현 — 수동 갱신 실수 | Medium | Medium | 스크립트 작성 또는 Design 단계에서 결정 |
| 위-10 Codex stop-hook 0건 차단 깨짐 — cycle 4 신규 모듈 dead code | Medium | Medium | 각 commit 후 wire-in 검증 |

---

## 7. Decision Records

| ID | Decision | Rationale | Status |
|----|----------|-----------|--------|
| D-1 | cycle4-matrix.json separate | cycle 3 SoT 동결 — append 시 이력 손실. cycle 2/3 패턴 재사용 | Accepted |
| D-2 | escalation_count cycle 4 진입 시 cycle 3 defer 항목 +1 | Plan D-3 강화 메커니즘 — count=3 prohibit_at 도래 | Accepted |
| D-3 | CR4-1 reject 우선 검토 (cycle 3 council 비용 18-25h 측정) | Plan 위-1. adopt 비용이 cycle 4 16h 초과 가능 | Pending Design |
| D-4 | sunset 처리: permanent 전환 우선 검토 (transitional 유지 시 cycle-5+ 재논의 부담) | sunset 메커니즘 본래 목적 — permanent 전환으로 종결 | Pending Design |
| D-5 | token-meter.port permanent reject — rkit 토큰 도메인 부재 + 도입 의미 부재 | Plan 위-7. cycle 5+ defer 무한 사슬 차단 | Pending Design |
| D-6 | 미변환 27 SKILL — 본 cycle 범위 밖 (P3, cycle 5+ 평가) | 위-8. cycle 4 critical path는 carry-over 종결 | Pending Design |

---

## 8. Acceptance Criteria

- [ ] `policies/decisions/cycle4-matrix.json` 6 candidates 모두 non-pending (defer 금지 — escalation_count=3)
- [ ] cycle4 smoke TC >= 25 PASS + cycle2 78 + cycle3 46 회귀 PASS
- [ ] verify-policy 9/9 PASS (decisions-matrix cycle 4 대상 추가)
- [ ] never-gate.json transitional 2 items 처리 — permanent 전환 또는 명시 제거
- [ ] check-sunset.js cycle-4 진입 시 FAIL 작동 검증 (또는 정책 갱신으로 해소)
- [ ] CR4-1 (E + CO-2) 강제 결정 — adopt (구현 완료) 또는 reject (영구) 명시
- [ ] cycle 4 종료 시 carry-over 0 (또는 permanent_reject 명시)
- [ ] Codex stop-hook 0건 차단

---

## 9. Open Questions

| Q-ID | Question | Owner | Resolved? |
|------|----------|-------|-----------|
| Q-1 | CR4-1 adopt 시 일정 — 5 PR 분할 가능 여부 | Design | Pending |
| Q-2 | sunset 옵션 — permanent 전환 시 sunset 메타 필드 유지 vs 삭제 | Design | Pending |
| Q-3 | escalation_count 자동 갱신 스크립트 — Plan 또는 Do 단계 신설 | Design | Pending |
| Q-4 | canary regex 패턴 출처 — bkit 참조 vs 자체 정의 (E adopt 시) | Design | Pending |
| Q-5 | cycle 4 신규 분석 후보 — 본 cycle 포함 vs cycle 5+ | Design | Pending |
| Q-6 | escalation_count=4 도래 시 처리 (cycle 5 진입 시점) — 정책 임계 갱신 필요 여부 | Design | Pending |

---

**Status**: Draft v0.1 — Design phase에서 DR-1~6 + Q-1~6 해소 → v0.2.
