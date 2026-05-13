---
template: plan
version: 1.2
description: rkit ↔ bkit 정렬 cycle 3 — cycle 2 이월 6건 + 추가 분석 처리
---

# bkit-gstack-sync-v2-cycle3 Planning Document

> **Summary**: Cycle 2 carry-over 6 항목 처리 + 신규 분석으로 rkit ↔ bkit 정렬률 완성
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
| **Problem** | Cycle 2 종료 시점 6 carry-over (A 3 모듈 / B 4 ports / CO-3 28 SKILL 본문 / CO-4 BKIT_VERSION / FR-14 SBOM / E+CO-2 cc-regression 묶음) 미처리. 의도적 defer지만 cycle-3에서 처리 또는 reject 결정 필수 — 무한 이월 차단. |
| **Solution** | Cycle 2와 동일한 candidate × decision matrix 패턴으로 6 항목 일괄 평가. depends_on 사슬 (CO-4 ← A.version, CO-2 ← E.hash-only) 해소 우선. 28 SKILL 본문 적용은 일괄 vs 단계 분리. |
| **Function/UX Effect** | rkit 도메인 정렬률 80%+ 달성 (cycle 2 기준 33% B ports → 80%+ 목표). BKIT_VERSION sync 자동화 + SBOM 검증 + cc-regression GDPR 안전 도입. |
| **Core Value** | rkit이 bkit 발전 속도와 분리되지 않으면서 도메인 중립성·정책 자동화·GDPR 컴플라이언스 유지 — "다른 분야 도입 시 임베디드만 책임" 차단. |

---

## 1. Overview

### 1.1 Purpose

Cycle 2 cycle2-end (2026-05-13) 시점 의도 이월 6 항목 종결. 무한 defer 사슬 차단.

### 1.2 Background

Cycle 2 11 candidates → adopt 1 / partial_adopt 4 / defer 5 / reject 1. defer 5 중:
- C lib/orchestrator 책임 중복 4 → cycle-3 재검토
- E lib/cc-regression hash 재작성 → cycle-3 묶음
- CO-1 JSONL rotation depends_on [D reject, E defer] → cascade
- CO-2 canary depends_on [E defer] → cycle-3 묶음
- CO-4 BKIT_VERSION depends_on [A.version defer]

partial_adopt 2 잔여:
- A 3 모듈: version.js / session-ctx-fp.js / session-title-cache.js
- B 4 ports: cc-payload / docs-code-index / regression-registry / token-meter
- CO-3 28 SKILL: 분류표만 cycle-2, 본문 적용 cycle-3

기타:
- FR-14 SBOM 자동화 (Design §3.5 명세, 구현 cycle-3 이월)

### 1.3 Related Documents

- Cycle 2 Plan: `docs/archive/2026-05/bkit-gstack-sync-v2-cycle2/bkit-gstack-sync-v2-cycle2.plan.md`
- Cycle 2 Design v0.2: `docs/archive/2026-05/bkit-gstack-sync-v2-cycle2/bkit-gstack-sync-v2-cycle2.design.md`
- Cycle 2 Analysis: `docs/archive/2026-05/bkit-gstack-sync-v2-cycle2/bkit-gstack-sync-v2-cycle2.analysis.md`
- Cycle 2 Report: `docs/archive/2026-05/bkit-gstack-sync-v2-cycle2/bkit-gstack-sync-v2-cycle2.report.md`
- Decisions matrix (cycle-2 종료 상태): `policies/decisions/cycle2-matrix.json`
- 정책 (live): `policies/{manifest,never-gate,network-allowlist,locked-vocab}.json`
- gstack-sync 정책: `docs/policy/gstack-sync-policy.md`

---

## 2. Scope

### 2.1 In Scope

- [ ] Cycle 2 carry-over 6 항목 처리 → `policies/decisions/cycle3-matrix.json` 신설 (matrix SoT 패턴 재사용)
- [ ] **CR-1 A 잔여 3 모듈** 평가 — version.js / session-ctx-fp.js / session-title-cache.js
- [ ] **CR-2 B 잔여 4 ports** 평가 — cc-payload / docs-code-index / regression-registry / token-meter (rkit 도메인 매핑률 재측정)
- [ ] **CR-3 CO-3 28 SKILL 본문 적용** — 일괄 vs 단계 분리, body/appendix two-layer 일괄 변환
- [ ] **CR-4 CO-4 BKIT_VERSION SoT** — A.version 결정에 종속 (CR-1 결과 기반)
- [ ] **CR-5 FR-14 SBOM 자동화** — `scripts/gen-sbom.mjs` + `npm ci --ignore-scripts` + `npm audit signatures` + CI 통합
- [ ] **CR-6 E + CO-2 묶음 (cc-regression hash-only + canary)** — D-8 GDPR 정책 구현 또는 cycle-4 이월
- [ ] **CR-7 C lib/orchestrator 재검토** — 책임 중복 표 작성 후 통합/reject 결정
- [ ] **CR-8 CO-1 JSONL rotation** — D/E 결정 결과에 따라 자동 처리

### 2.2 Out of Scope

- bkit cycle 3 이후 신규 도입 (cycle-4 이후 평가)
- rkit 자체 신규 기능 추가 (정렬에 집중)
- 28 SKILL 도메인 특화 분기 (cycle-4 이후 — body-neutrality 유지 우선)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `policies/decisions/cycle3-matrix.json` 신설 — 8 candidates (CR-1~CR-8) × 5 decision enum | High | Pending |
| FR-02 | A 잔여 3 모듈 평가 — FR-09 anonymizeFingerprint 알고리즘과의 호환성 검증 (session-ctx-fp 14자 sha256+salt 정합) | High | Pending |
| FR-03 | B 잔여 4 ports 매핑률 재측정 — rkit 도메인 (intent/pdca/quality/team) 매핑 가능 ports 식별, 매핑률 80% 이상 채택 기준 | High | Pending |
| FR-04 | CO-3 28 SKILL 본문 변환 — body/appendix two-layer 일괄 적용 (cycle 1.5 Match Rate 100% 패턴 재사용) | High | Pending |
| FR-05 | CO-4 BKIT_VERSION SoT — `policies/version.json` 신설 (rkit 0.9.x + bkit 2.1.x sync 추적) | Medium | Pending |
| FR-06 | FR-14 SBOM 자동화 — CycloneDX JSON + npm audit signatures + Stop hook 등록 | High | Pending |
| FR-07 | E cc-regression hash-only 구현 — promptHash/outputHash (sha256 14자 + salt) + opt-in prompt + retention 90일 + `/pdca regression purge` 명령 | High | Pending |
| FR-08 | CO-2 canary token 인프라 — `docs/policy/canary-tokens.md` + regex >= 3 + 잠재 유출 탐지 검사 | Medium | Pending |
| FR-09 | C lib/orchestrator 책임 중복 해소 표 — rkit 4 모듈 (intent / pdca/lifecycle / team / control/trust-engine) × bkit orchestrator 책임 매트릭스 | Medium | Pending |
| FR-10 | CO-1 JSONL rotation — D/E 결정 기반 통합 (5MB / 5000 entries / 1 backup) 또는 정책만 문서 보존 | Low | Pending |
| FR-11 | cycle2-matrix.json → cycle3-matrix.json carry-forward — cycle 2 종료 상태 보존 + cycle 3 결정 이력 분리 | High | Pending |
| FR-12 | verify-policy `decisions-matrix` 검사 cycle-3 대상 확장 — `policies/decisions/cycle3-matrix.json` 8 candidates 게이트 | High | Pending |
| FR-13 | check-sunset.js 갱신 — cycle 2 transitional 3 items (network_egress / regression_retention) 현재 cycle = 3 비교, sunset_cycle - current 차이 재계산 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|--------------------|
| 정합성 | rkit ↔ bkit 정렬률 80% 이상 (B ports 33% → 80% 목표) | `policies/decisions/cycle3-matrix.json` adopt + partial_adopt 비율 |
| 보안 | egress=deny 유지, raw PII 0건 | verify-policy `pii-in-logs` + `network-egress` 검사 |
| GDPR | E adopt 시 hash-only + 90일 + opt-in + purge 4 조건 모두 충족 | `docs/policy/gdpr-cc-regression.md` 검사 항목 |
| 정책 격리 | body-neutrality 유지 (CO-3 28 SKILL 본문 변환 시 도메인 어휘 0건) | `scripts/verify-policy.js` body-neutrality 검사 |
| 자동화 | sunset transitional 3 items 처리 — sunset_cycle == current_cycle 도래 시 FAIL | `scripts/check-sunset.js` Stop hook |
| 호환성 | rkit 기존 export 호환 100% | cycle3 smoke TC + cycle2 smoke TC 회귀 |
| 종료 게이트 | 8 candidates non-pending + adopt/partial 사유 >= 20자 | `verify-policy.js --check decisions-matrix` cycle-3 대상 |
| SBOM 신선도 | CycloneDX JSON 매 cycle 종료 시 갱신 | `scripts/gen-sbom.mjs` + git tag 부착 |
| 테스트 | cycle3 smoke TC >= 30개 PASS + cycle2 TC 78/78 회귀 PASS | `node --test "tests/cycle3/*.test.js"` + cycle2 |
| 코드 품질 | 새 모듈 SQ-004 < 300 lines, 함수 SRP | 각 모듈 wc -l 검증 |
| 문서 | cycle2 archive 참조 깨짐 0 | grep `docs/archive/2026-05/` |
| 회귀 | NEVER_GATE 8 items 모두 PASS 유지 | verify-policy 9 checks (sunset 도래 항목은 cycle-4로 이월 결정) |

### 3.3 Constraints

- 보안: D-8 GDPR (hash+metadata, 90일, opt-in, /pdca purge) — E adopt 시 4 조건 모두 충족
- 권한: scripts/op-* 외 외부 egress 추가 금지 (allowlist 유지)
- 시간: cycle 3 목표 기간 약 2일 (2026-05-14 ~ 2026-05-16)
- 호환: rkit 기존 lib/pdca/status 27 exports 100% 보존
- 어휘: locked-vocab.json v1.1 20 terms scope:domain 유지

---

## 4. Design Considerations

### 4.1 Architecture Approach

- cycle-3 matrix SoT 신설 — `policies/decisions/cycle3-matrix.json` (cycle2-matrix와 동일 스키마)
- depends_on 사슬 해소: CO-4 ← CR-1 (A.version), CR-8 ← CR-6 (E adopt 여부), CR-6 ← D-8 정책 구현 완료
- 28 SKILL 변환: body 도메인 어휘 제거 + appendix 분리 (cycle 1.5 패턴 일괄 적용)
- SBOM: CycloneDX 1.5 JSON, `npm ci --ignore-scripts` 안전 모드

### 4.2 Tech Stack

| Layer | Technology |
|-------|------------|
| Decision tracking | `policies/decisions/cycle3-matrix.json` (cycle-2 패턴 재사용) |
| SBOM | CycloneDX JSON + npm audit signatures |
| GDPR purge | `scripts/pdca-regression-purge.mjs` (cycle-2 신규, cycle-3에서 E adopt 시 활성화) |
| Verify | scripts/verify-policy.js 9 checks (decisions-matrix 대상 확장) |
| Sunset | scripts/check-sunset.js (Stop hook) — cycle 2 transitional 3 → cycle 3 비교 |

### 4.3 Open Questions (Design 단계 해소)

- DR-1 cycle3-matrix.json vs cycle2-matrix.json 이력 보존 방식 — append vs separate file (separate 권고, manifest 등록)
- DR-2 28 SKILL 본문 변환 일괄 vs 단계 분리 — 일괄 (cycle 1.5 패턴) vs 5 SKILL씩 6 PR (위험 분산)
- DR-3 SBOM CI 통합 시점 — Stop hook (매 stop) vs cycle-end tag 시 (수동)
- DR-4 E cc-regression hash-only 알고리즘 — sha256 14자 + salt (FR-09 재사용) vs 다른 해시
- DR-5 C lib/orchestrator — 통합 (rkit 4 모듈 facade) vs reject (영구) vs cycle-4 추가 defer
- DR-6 CR-8 JSONL rotation — D reject 확정 시 정책 문서만 vs cycle-3 신규 후보 결정

---

## 5. Implementation Plan

### 5.1 Phases

| Phase | Description | Duration | Output |
|-------|-------------|----------|--------|
| Plan | 본 문서 + matrix 초기 8 candidates 등록 | 0.5일 | plan.md + cycle3-matrix.json initial |
| Design | DR-1~6 해소 + 8 candidates 평가 기준 + FR-14 SBOM 스키마 | 0.5일 | design.md v0.x |
| Do | candidate 결정 + 구현 + smoke TC | 1일 | commits + tests |
| Check | gap 분석 (FR/DR 매핑 + matrix non-pending) | 0.5일 | analysis.md |
| Report + Archive | 완료 보고서 + cycle3-end tag + archive | 0.5일 | report.md + archive |

### 5.2 Critical Path

1. cycle3-matrix.json 신설 (manifest 등록 + verify-policy 대상 변경)
2. CR-1 A 잔여 3 평가 → CR-4 CO-4 unblock 결정
3. CR-2 B 잔여 4 ports 매핑률 측정 → adopt/defer 결정
4. CR-3 28 SKILL 변환 일괄 vs 단계 (DR-2 결정)
5. CR-5 SBOM 자동화 → Stop hook 등록
6. CR-6 E hash-only 구현 (D-8 정책 4 조건 충족) 또는 cycle-4 이월
7. CR-7 C 책임 중복 표 → 통합/reject 결정
8. CR-8 CO-1 JSONL rotation → D/E 결과 종속

### 5.3 Dependencies

- cycle 2 매트릭스 cycle2-matrix.json (cycle 2 종료 상태 보존)
- bkit references: `references/bkit-claude-code/lib/{core,domain,cc-regression,infra}/`
- D-8 GDPR 정책 (`docs/policy/gdpr-cc-regression.md`) — E adopt 시 4 조건 점검

---

## 6. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 위-1 28 SKILL 일괄 변환 시 SKILL 기능 회귀 | Medium | High | Cycle 1.5 패턴 (4 SKILL Match 100%) 재사용. 회귀 시 단계 분리 fallback |
| 위-2 B 4 ports rkit 도메인 매핑률 33% 미만 — 모두 defer | Medium | Medium | 매핑률 < 80% 시 reject로 명시 결정 (defer 무한 회피) |
| 위-3 E cc-regression hash-only 재작성 비용 cycle-3 초과 | High | Medium | cycle-4 이월 후 D-8 정책 문서 유지. /pdca purge 명령 활성화 시점 보류 |
| 위-4 SBOM 자동화 시 npm audit signatures 외부 호출 — egress=deny 위배 | Medium | High | `npm ci --ignore-scripts` 사용 + signature 검증 시점 분리 (lockfile only). 또는 allowlist 추가 (registry.npmjs.org) |
| 위-5 cycle 2 transitional sunset 도래 (cycle-4) — cycle 3 종료 시 sunset_cycle == current_cycle + 1 → 경고만 | Low | Low | check-sunset.js current = 3 비교, sunset_cycle = 4 → WARN. cycle 4 시작 시 FAIL |
| 위-6 CO-3 28 SKILL 본문 변환 시 locked-vocab 위배 | Medium | High | verify-policy `body-neutrality` + `vocab-preservation` 양쪽 검사 PASS 필수 |
| 위-7 cycle3-matrix.json 신설 시 manifest-sync 검사 실패 | Low | Low | manifest.json 신설 동시 commit + verify-policy 즉시 실행 |
| 위-8 C lib/orchestrator 통합 시 rkit 4 모듈 책임 변경 — 외부 호출자 호환 깨짐 | High | High | reject로 결정 우선 검토. 통합 시 facade 패턴 + 회귀 smoke TC 추가 |
| 위-9 CR-1 session-ctx-fp.js bkit 16자 sha256 → rkit FR-09 14자 + salt 호환 알고리즘 — 두 시스템 출력 다름 | High | Medium | rkit 단방향 채택 + bkit 비교 검증 도구 별도 작성 |
| 위-10 Codex stop-hook 검토 — cycle 3 신규 모듈 dead code / SoT 오류 재발 | Medium | Medium | 매 commit 후 hooks/session-start.js wire-in 검증 + scanVersions canonical 확인 |
| 위-11 cycle 2 archive 참조 깨짐 — Plan/Design에서 archive 경로 참조 | Low | Low | grep + relative path 검증 |
| 위-12 cycle 3 종료 시 carry-over 0 목표 미달 — cycle-4 이월 발생 | Medium | Medium | Plan 단계에서 명시 reject 우선 검토 (defer 무한 회피) |

---

## 7. Decision Records

| ID | Decision | Rationale | Status |
|----|----------|-----------|--------|
| D-1 | cycle3-matrix.json 신설 (cycle2-matrix와 분리) | append vs separate — append 시 cycle-2 종료 상태 mutate → 이력 손실. separate 안전 | Accepted |
| D-2 | 8 candidates (CR-1~CR-8) | cycle-2 6 carry-over + CR-7 (C 재검토) + CR-8 (CO-1 종속) 통합 | Accepted |
| D-3 | 종료 게이트 강화 — defer 사유 "cycle-N 이월" 단독 거부, "구체적 unblock_condition" 필수 | cycle-2 종료 시 5 defer 중 일부 "cycle-3 이월" 단순 사유 → cycle-3 무한 회피 위험 | Accepted |
| D-4 | 28 SKILL 본문 변환 일괄 (cycle 1.5 패턴) — DR-2 Design에서 확정 | cycle 1.5 4 SKILL Match 100% 검증됨 | Pending Design |
| D-5 | E cc-regression cycle-4 이월 가능성 — cycle-3 시작 시점 D-8 4 조건 모두 충족 가능성 평가 | hash-only 알고리즘 + opt-in prompt + retention + purge 명령 — purge는 cycle-2에 완료, 나머지 3 cycle-3 신규 | Pending Design |
| D-6 | SBOM 자동화 — Stop hook (매 stop) vs cycle-end tag — DR-3 Design 결정 | Stop hook 비용 vs 자동화 효과 trade-off | Pending Design |
| D-7 | C lib/orchestrator reject 우선 검토 | 책임 중복 4건 + rkit 4 모듈 통합 비용 + 외부 호환 위험 — reject가 합리적 | Pending Design |

---

## 8. Acceptance Criteria

- [ ] `policies/decisions/cycle3-matrix.json` 8 candidates 모두 non-pending
- [ ] cycle3 smoke TC >= 30개 PASS + cycle2 78/78 회귀 PASS
- [ ] verify-policy 9/9 PASS (decisions-matrix 대상 cycle-3로 변경)
- [ ] sunset 3 transitional items 평가 — cycle-3 종료 시 cycle-4 도래 알림
- [ ] FR-14 SBOM `bom.json` 생성 + git tag 부착
- [ ] D-8 GDPR 4 조건 평가 (E adopt 결정 기반)
- [ ] cycle 3 종료 시 carry-over 0 또는 명시 reject (defer 사유 강화)
- [ ] Codex stop-hook 0건 차단 — 모든 신규 모듈 wire-in 확인

---

## 9. Open Questions

| Q-ID | Question | Owner | Resolved? |
|------|----------|-------|-----------|
| Q-1 | C lib/orchestrator 통합 vs reject 어느 쪽 — rkit 4 모듈 책임 매트릭스 작성 후 결정 | Design | Pending |
| Q-2 | 28 SKILL 변환 일괄 vs 단계 — 단계 시 5 SKILL × 6 PR 분리 | Design | Pending |
| Q-3 | SBOM 외부 호출 (npm audit signatures) — egress=deny 허용 추가 vs lockfile only 검증 | Design | Pending |
| Q-4 | E cc-regression cycle-3 vs cycle-4 — hash-only 알고리즘 비용 측정 후 결정 | Design | Pending |
| Q-5 | cycle3-matrix.json manifest 등록 시점 — Plan 종료 vs Do 시작 | Design | Pending |
| Q-6 | CO-1 JSONL rotation — D reject 확정 시 정책 문서만 vs cycle-3 신규 후보 | Design | Pending |

---

**Status**: Draft v0.1 — Design phase 진행 시 DR-1~6 + Q-1~6 해소 → v0.2
