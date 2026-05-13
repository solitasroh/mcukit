# Cycle 2 결정 매트릭스 형식 (FR-11)

> SoT: [`policies/decisions/cycle2-matrix.json`](../../policies/decisions/cycle2-matrix.json)

## 결정 enum

| 값 | 의미 |
|----|------|
| `pending` | 아직 결정 안 됨 (사이클 종료 시 0건이어야 함) |
| `adopt` | 본 사이클에서 도입 (전체) |
| `partial_adopt` | 일부만 도입 |
| `defer` | 보류 (revisit_by 또는 unblock_condition 필수) |
| `reject` | 기각 (사유 명시) |

## 필수 필드 (비-pending)

- `decided_by: { role: "human"|"agent", id: string }` — 누가 결정했는가
- `evidence: string[]` (≥1) — 의사결정 근거 자료 링크
- `reasoning: string` (≥20자) — adopt/partial_adopt 시
- `revisit_by: "cycle-N"` 또는 `unblock_condition: string` — defer 시

## 자동 검증

`node scripts/verify-policy.js --check decisions-matrix`

- 사이클 종료 시 `pending` 0건
- `decided_by` 누락 시 차단
- `defer` + `revisit_by`/`unblock_condition` 둘 다 없으면 차단
- `adopt` + reasoning < 20자 차단

## `depends_on` vs `unblock_condition`

- `depends_on: ["A"]` — 다른 후보 ID 의존 (A가 pending 아닐 때만 진행 가능)
- `unblock_condition: "..."` — 외부 조건 (예: "canary infrastructure exists")
