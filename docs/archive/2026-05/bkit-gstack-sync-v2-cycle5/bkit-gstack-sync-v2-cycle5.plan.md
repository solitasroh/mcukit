---
template: plan
version: 1.2
description: rkit ↔ bkit 정렬 cycle 5 — CR4-6 unblock 충족 (27 SKILL conversion)
---

# bkit-gstack-sync-v2-cycle5 Planning Document

> **Summary**: CR4-6 단일 candidate, mechanical SKILL conversion. small cycle.
>
> **Project**: rkit
> **Version**: 0.9.13
> **Author**: soojang.roh
> **Date**: 2026-05-13
> **Status**: Draft v0.1 (combined plan + design)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Cycle 4 CR4-6 (27 SKILL P3) defer cycle-5 + unblock 명시. 본 cycle은 unblock 충족 단일 작업. |
| **Solution** | skill-body-extract.mjs `--apply-markers` (20 neutral) + `--apply-grandfathered` (7 grandfathered) batch 실행. verify-policy 9/9 회귀 검증. |
| **Function/UX Effect** | rkit 73 SKILL 전체 변환 완료 (cycle 1.5 4 + cycle 3 46 + cycle 5 27 = 77 ... 단 4 중복 cycle 1.5 = 73/73 = 100%). 추가 carry-over 0. |
| **Core Value** | 4-cycle 사슬 종결 (cycle 1.5/2/3/4) + cycle 5 단독 wrap-up. CR4-6 unblock_condition 검증으로 R3~R5 (불명확 cycle-N 이월 거부 + 동사 포함) 메커니즘 실증. |

---

## 1. Overview

### 1.1 Purpose

Cycle 4 CR4-6 unblock 조건 충족:
> `skill-body-extract.mjs --apply-markers + --apply-grandfathered batch executed for 27 remaining SKILLs AND verify-policy body-neutrality PASS`

본 cycle 종료 시점: 73 SKILL 전체 변환 완료 + verify-policy 9/9 PASS.

### 1.2 Background

Cycle 3 CR-3 partial_adopt: 46/73 SKILL 변환 (Design FR-04 명시 대상). 잔여 27 SKILL은 Plan §2.2 (cycle 5+) + Cycle 4 CR4-6 defer로 본 cycle 처리 결정.

### 1.3 27 SKILL 분류 (council frontend 권고)

**Grandfathered 7** (외부 통합 + 팀 규칙 + 도메인 특화):
- op-create-task, op-standup, op-status, op-task, openproject-conventions (OpenProject MCP 통합)
- mr-conventions (GitLab MR 팀 규칙)
- project-workspace (mpu domain 명시)

**Neutral 20** (workflow + capability 범용):
- arch-lock, audit, benchmark, btw, cc-version-analysis, claude-code-learning, control, deploy, desktop-app, development-pipeline, do-reverse-spec, guard, mermaid, mobile-app, pdca-batch, plan-plus, pm-discovery, reframe, rkit-rules, zero-script-qa

---

## 2. Scope

### 2.1 In Scope

- [ ] CR5-1: 27 SKILL 변환 — 20 neutral marker + § 0 / 7 grandfathered frontmatter + § 0
- [ ] verify-policy 9/9 회귀 PASS
- [ ] skill-body-extract --scan: cycle3_converted + grandfathered + cycle15_converted == 73 (untouched 0)
- [ ] cycle5-matrix.json 신설 (1 candidate)
- [ ] cycle 4 (147) + cycle 5 회귀 PASS

### 2.2 Out of Scope

- 신규 SKILL 추가
- 도메인 분기 (cycle 6+ 평가 가능)

---

## 3. Requirements (Plan + Design 통합)

### 3.1 FRs

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `policies/decisions/cycle5-matrix.json` 신설 — 1 candidate (CR5-1) | High | Pending |
| FR-02 | 20 neutral SKILL → `--apply-markers` batch | High | Pending |
| FR-03 | 7 grandfathered SKILL → `--apply-grandfathered` batch | High | Pending |
| FR-04 | verify-policy 9/9 PASS + cycle 2/3/4 회귀 PASS | High | Pending |
| FR-05 | skill-body-extract --scan untouched 0 | High | Pending |
| FR-06 | cycle 4 CR4-6 unblock 충족 검증 smoke TC | Medium | Pending |

### 3.2 Constraints

- locked-vocab body-neutrality 유지 (neutral SKILL body 도메인 어휘 0)
- grandfathered SKILL은 body-neutrality 검사 면제 (frontmatter `grandfathered: true`)
- 73 SKILL 변환 완료 시점: 73/73 = 100%

---

## 4. Implementation (Do)

```bash
# Neutral 20
node scripts/skill-body-extract.mjs --apply-markers \
  arch-lock audit benchmark btw cc-version-analysis claude-code-learning \
  control deploy desktop-app development-pipeline do-reverse-spec guard \
  mermaid mobile-app pdca-batch plan-plus pm-discovery reframe rkit-rules \
  zero-script-qa

# Grandfathered 7
node scripts/skill-body-extract.mjs --apply-grandfathered \
  op-create-task op-standup op-status op-task openproject-conventions \
  mr-conventions project-workspace

# Verify
node scripts/verify-policy.js          # 9/9
node scripts/skill-body-extract.mjs --scan  # untouched 0
node --test tests/cycle*/*.test.js     # 147+ PASS
```

---

## 5. Decision (cycle5-matrix)

| ID | 후보 | 결정 | 사유 |
|----|------|------|------|
| CR5-1 | 27 SKILL 변환 (cycle 4 CR4-6 unblock) | adopt | unblock 조건 mechanical 충족 |

---

## 6. Acceptance

- [ ] 73 SKILL 100% 변환
- [ ] verify-policy 9/9 PASS
- [ ] cycle 2/3/4 회귀 PASS
- [ ] cycle5 smoke TC >= 5 PASS
- [ ] cycle5-end git tag

---

**Status**: Combined Plan + Design v0.1. mechanical cycle — council 불필요.
