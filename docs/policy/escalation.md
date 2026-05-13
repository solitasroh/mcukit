# Decisions Matrix — Escalation Policy

Cycle 3 신설. 무한 defer 사슬 차단 목적 (Plan D-3 강화).

## 임계

| escalation_count | 동작 | 요구사항 |
|:----------------:|------|----------|
| 0 | 통상 | 없음 |
| 1 | WARN | `override_reason` 권장 (선택) |
| **2** | **FAIL** unless ... | `override_reason >= 80 chars` AND `final_revisit_by` |
| **3+** | **defer 금지** | `decision` 반드시 `adopt` / `partial_adopt` / `reject` |

SoT: `policies/escalation-policy.json`
검사기: `scripts/verify-policy.js --check decisions-matrix`

## escalation_count 산정

- `cycle_origin === "cycle-3-new"` → 시작 시 0
- `cycle_origin === "cycle-2-carryover"` AND `predecessor_decision.decision === "defer"` → 1 (cycle 3 진입)
- cycle 3에서도 defer 결정 → 2 (cycle 4 진입 시점)
- cycle 4에서도 defer → 3 (cycle 5 진입 시점이지만 prohibit_at으로 차단)

## STRICT flag

- `m.cycle >= 3` 시 STRICT 적용 (R1~R7)
- cycle 2 매트릭스는 legacy (R1 >= 20자, R2 OR)
- 매트릭스별 cycle 필드 기반 분기 — cycle 2 회귀 차단

## D-3 강화 7 규칙 (STRICT)

| # | 규칙 | Severity |
|---|------|----------|
| R1 | `reasoning.length >= 50` (all non-pending) | FAIL |
| R2 | defer: `unblock_condition` AND `revisit_by` | FAIL |
| R3 | `unblock_condition` 모호 패턴 거부 `/^cycle-?\d+\s*(이월\|carry.?over\|defer\|연기)\s*$/i` | FAIL |
| R4 | `unblock_condition.length >= 30` | FAIL |
| R5 | `unblock_condition` 동사 포함 — `implemented\|completed\|resolved\|passes\|adopted\|written\|exists\|integrated\|merged\|verified` | WARN |
| R6 | `revisit_by` 형식 `/^cycle-\d+(\.\d+)?$/` | FAIL |
| R7 | adopt/partial_adopt: `evidence.length >= 2` | FAIL |

## permanent_reject

`reject` 결정 시 `permanent_reject: true` 플래그로 cycle-N+ 재논의 차단. cycle 3 CR-7 (C lib/orchestrator)이 첫 사례 — bkit/rkit 책임 분할 1:N 비대칭 영구 reject.

## Cycle 3 적용 후보 (escalation_count >= 2)

| 후보 | escalation | 결정 | 사유 |
|------|:---:|------|------|
| CR-4 CO-4 BKIT_VERSION | 2 | reject | CR-1 A.version reject 종속, override 면제 (reject) |
| CR-6 E + CO-2 묶음 | 2 | defer | override_reason 80자+ + final_revisit_by cycle-4 |
| CR-7 C orchestrator | 2 | reject permanent | 1:N 비대칭, override 면제 (reject) |
| CR-8 CO-1 JSONL | 2 | defer cascade | override_reason 80자+ + final_revisit_by cycle-4 |

cycle 4 진입 시 CR-6 + CR-8 escalation_count == 3 → prohibit_at 강제 결정.
