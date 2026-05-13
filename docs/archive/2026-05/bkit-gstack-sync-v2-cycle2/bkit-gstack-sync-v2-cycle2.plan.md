---
template: plan
version: 1.2
---

# bkit-gstack-sync-v2 계획 문서 — Cycle 2

> **요약**: Cycle 2에서는 rkit을 임베디드 전용 도구로 보지 않는다. rkit을 **AI 개발 흐름을 관리하는 공통 기반**으로 보고, bkit의 큰 신규 기능들을 rkit에 넣을지 평가한다. 판단 기준은 "특정 하드웨어 개발에 맞는가"가 아니라 **rkit의 작업 흐름, 에이전트 연결, 스킬 실행, 기록/검증 체계를 더 단순하고 믿을 수 있게 만드는가**이다.
>
> **프로젝트**: rkit
> **목표 버전**: v0.9.15 후보
> **작성일**: 2026-04-28
> **상태**: 초안
> **브랜치**: `feature/bkit-gstack-sync-v2`

---

## 한눈에 보기

| 관점 | 내용 |
|-------------|---------|
| **문제** | Cycle 1 문서에는 rkit을 MCU/MPU/WPF 중심 도구로 보는 표현이 많았다. 이 기준을 그대로 두면 Cycle 2에서 bkit의 큰 기능들을 너무 좁은 기준으로 판단하게 된다. |
| **해결 방향** | Cycle 2의 기준을 바꾼다. bkit 기능을 볼 때 "임베디드에 맞는가"가 아니라 "rkit 전체 작업 흐름을 더 안정적으로 만드는가"를 본다. |
| **사용자 영향** | rkit은 특정 분야 전용 도구가 아니라 여러 개발 분야에서 쓸 수 있는 공통 작업 기반으로 확장된다. MCU/MPU/WPF 같은 기능은 rkit 본체가 아니라 필요할 때 붙는 기능 묶음으로 본다. |
| **핵심 원칙** | **"rkit 본체는 특정 분야에 묶이지 않고, 분야별 기능은 필요할 때 붙인다."** |

---

## 1. Cycle 2의 기준 변경

### 1.1 이전 기준

Cycle 1 문서에서는 다음 관점이 강했다.

- rkit은 임베디드 개발 도구다.
- bkit 기능은 MCU/MPU/WPF에 맞으면 가져온다.
- 기존 임베디드 표현을 유지할지가 중요한 판단 기준이다.

### 1.2 새 기준

Cycle 2부터는 이렇게 본다.

- rkit은 **AI 개발 작업을 계획하고, 실행하고, 검증하는 공통 기반**이다.
- MCU, MPU, WPF, 백엔드, 프론트엔드, 인프라 같은 분야는 rkit 위에 붙는 기능 묶음이다.
- bkit 신규 기능은 특정 분야 기준이 아니라 안정성, 확장성, 검증 가능성, 운영 부담 기준으로 평가한다.

### 1.3 판단 문장

> "이 기능이 임베디드에 맞는가?"가 아니라  
> **"이 기능이 rkit의 작업 흐름을 더 일관되고 검증 가능하게 만드는가?"**를 묻는다.

### 1.4 관련 문서

| 문서 | 위치 | 본 사이클에서의 역할 |
|------|------|----------------------|
| Cycle 1 Report | `docs/archive/2026-04/bkit-gstack-sync-v2/bkit-gstack-sync-v2.report.md` | 선행 사이클. cleanup + audit 강화. §9 carry-over에 본 사이클 후보 모듈 명시. |
| Cycle 1.5 Report | `docs/archive/2026-04/bkit-gstack-sync-v2-cycle15/bkit-gstack-sync-v2-cycle15.report.md` | 직전 사이클. SKILL 4종 + SoT + 자동 검증. §9 carry-over 4 카드(JSONL 회전·카나리·28 SKILL·BKIT_VERSION) 본 사이클 평가 대상에 통합 (§2.3). |
| 동기화 정책 | `docs/policy/gstack-sync-policy.md` | 사이클 1.5에서 정착. §5 "범위 확장 절차"에 따라 본 사이클(`lib/`, `agents/`, `hooks/` 신규 모듈 도입)은 신규 design 문서 + NEVER_GATE 재평가 의무 (§7 NFR로 강제). |
| 잠금 어휘 SoT | `policies/locked-vocab.json` | 본 사이클에서 신규 어휘가 추가될 가능성. 도입되는 모듈이 도메인 어휘를 담는다면 SoT에 반영 필요 (§7 NFR). |
| 자동 검증 도구 | `scripts/verify-policy.js` | 5 검사가 본 사이클의 모든 신규 모듈에도 자동 적용됨 (Stop 훅 등록됨). |

---

## 2. Cycle 2에서 볼 대상

### 2.1 평가 대상

| 묶음 | bkit 후보 | 쉽게 말하면 | 우선도 |
|---|---|---|---|
| A | `lib/core/{version,context-budget,worktree-detector,session-ctx-fp,session-title-cache}` | 버전 기준, 대화 길이 관리, 작업 폴더/세션 식별을 정리하는 기본 기능 | P0 |
| B | `lib/domain/{ports,guards,rules}` | 분야별 기능을 rkit 본체에 직접 박지 않고, 바깥에서 붙일 수 있게 만드는 경계 구조 | P0 |
| C | `lib/orchestrator/` | 사용자의 의도를 해석하고 다음 행동을 정하는 흐름 제어 기능 | P1 |
| D | `lib/qa/` + QA 에이전트 + `qa-phase` | 테스트 계획, 실행, 결과 보고를 자동화하는 품질 검증 흐름 | P1 |
| E | `lib/cc-regression/` | Claude Code나 실행 환경 변화로 생기는 회귀를 추적하는 기록 체계 | P1 |
| F | `lib/infra/{telemetry,cc-bridge,docs-code-scanner}` | 실행 기록, 문서-코드 일치 검사, 외부 관측 도구와의 연결 기능 | P2 |
| G | `lib/pdca/status.js` 분할 | PDCA 상태 관리 파일을 역할별로 나눌지 평가 | P2 |

### 2.2 이번 Cycle에서 하지 않는 것

- 특정 MCU/MPU/WPF 기능을 새로 추가하는 작업
- gstack 기존 스킬 강화 작업
- gstack 신규 스킬 도입
- bkit의 운영 인프라를 그대로 복사하는 작업
- Sentry, ArgoCD, Terraform 같은 외부 운영 도구 도입

### 2.3 사이클 1.5 이월 카드 (carry-over) 통합

사이클 1.5 보고서 §9에서 본 사이클로 명시 이월된 4 카드를 위 7 묶음과 함께 평가한다.

| 카드 | 내용 | 묶음 매핑 | 본 사이클 평가 방향 |
|------|------|----------|---------------------|
| **CO-1** | JSONL 회전 정책 | `code-review-stats.json` / `review-history.jsonl` | 묶음 D (QA) 또는 묶음 F (telemetry)에 포함. 5MB / 5000 entries 회전 + `.1` 백업 정책 도입 가능성 |
| **CO-2** | 카나리 토큰 정책 | 별 평가 대상 (사이클 1.5 D-7에서 dead rule로 제외됨) | `docs/policy/canary-tokens.md` + 검출 정규식 ≥3개 동반 도입 시에만 부활. 본 사이클 우선도 P2. |
| **CO-3** | 28 SKILL 전체 확대 | 사이클 1.5 D-2에서 4 SKILL 한정. 본 사이클에서 단계적 확대 평가 | 묶음 B (분야별 기능 경계) 결정 후 28 SKILL 전체에 본문/부록 두 층 + SoT 정책 적용 가능성. P1. |
| **CO-4** | `BKIT_VERSION` SoT | 묶음 A `lib/core/version`과 정합 | 묶음 A P0의 일부로 통합. 사이클 1 D-5에서 이월된 항목. |

본 사이클 평가는 7 묶음 + 4 carry-over 카드 = **11개 후보**를 한 번에 본다. 단, CO-2(카나리)는 P2로 본 사이클에서 도입 가능성 낮음 (도입 인프라 부재).

---

## 3. 평가 원칙

| 원칙 | 설명 | 거절 신호 |
|---|---|---|
| rkit 본체는 특정 분야에 묶지 않는다 | rkit의 중심 기능은 어떤 개발 분야에서도 동작해야 한다 | 새 기능이 MCU/MPU/WPF를 본체 코드에 직접 전제로 넣는다 |
| 기존 사용법을 깨지 않는다 | 기존 PDCA 명령, hook 출력, 스킬 실행 방식은 유지한다 | 기존 명령 출력이나 설정 파일 구조를 바꿔야 한다 |
| 부가 기능은 꺼도 동작해야 한다 | 품질 검사, 실행 기록, 문서 검사 기능은 꺼져 있어도 rkit 본체가 동작해야 한다 | 부가 기능이 없으면 SessionStart나 PDCA가 실패한다 |
| 먼저 검증 기준을 만든다 | 기능을 가져오기 전에 무엇을 확인할지 테스트를 먼저 정한다 | 파일을 먼저 복사한 뒤 나중에 맞춰보려 한다 |
| rkit만의 차이는 이유가 있어야 한다 | bkit과 다르게 둘 부분은 이름, 경로, 설정, 권한처럼 명확한 이유가 있어야 한다 | 의미 없이 이름만 바꾸거나 구조만 달라진다 |

---

## 4. 추천 진행 순서

### 4.1 1단계 — 기본 기준 정리 (P0)

목표: 큰 구조를 들여오기 전에 rkit의 기본 기준부터 정리한다.

- `lib/core/version` 평가
  - 현재 버전 정보가 여러 곳에 흩어져 있는지 확인한다.
  - 하나의 기준 파일로 모을 수 있는지 판단한다.
- `context-budget` 평가
  - SessionStart나 스킬 안내 문구가 너무 길어지는 문제를 줄일 수 있는지 본다.
- `worktree-detector`, `session-ctx-fp`, `session-title-cache` 평가
  - 여러 작업 폴더, 이어서 작업하기, 세션 구분에 도움이 되는지 본다.

완료 기준:

- `node test-all.js` 통과
- `node hooks/session-start.js` 출력 구조 유지
- 기존 audit 기록을 읽는 코드가 깨지지 않음

### 4.2 2단계 — 분야별 기능을 붙이는 경계 정리 (P0)

목표: rkit 본체와 분야별 기능을 분리한다.

- bkit `lib/domain/{ports,guards,rules}` 구조를 분석한다.
- rkit의 기존 `lib/domain`, `lib/mcu`, `lib/mpu`, `lib/wpf`와 겹치는 부분을 확인한다.
- 분야별 기능 묶음을 어떻게 등록하고 연결할지 정한다.

완료 기준:

- rkit 본체가 특정 분야 기능을 직접 불러오지 않는다.
- 분야별 기능은 등록 방식으로 연결된다.
- 기존 MCU/MPU/WPF 감지 기능은 그대로 동작한다.

### 4.3 3단계 — 작업 흐름 제어 기능 평가 (P1)

목표: bkit의 흐름 제어 기능이 rkit의 기존 PDCA 흐름을 대체할지, 보조할지 결정한다.

- 사용자 의도 해석 기능과 기존 `lib/intent` 비교
- 다음 행동 추천 기능과 기존 `/pdca next`, `/pdca status` 비교
- 작업 상태 흐름 기능과 기존 `lib/pdca/lifecycle` 비교
- 팀/에이전트 협업 기능과 기존 `lib/team` 비교

완료 기준:

- 같은 책임을 두 곳에서 처리하지 않도록 정리 계획이 있어야 한다.
- 기존 `/pdca status`, `/pdca next`, SessionStart 이어하기 동작이 유지되어야 한다.
- 옮겨가는 방법이 불명확하면 도입하지 않는다.

### 4.4 4단계 — 품질 검증과 회귀 추적 평가 (P1)

목표: 테스트 계획, 테스트 실행, 결과 보고, 회귀 추적을 rkit에 넣을 가치가 있는지 본다.

- `lib/qa`가 독립된 품질 검증 흐름으로 동작할 수 있는지 확인한다.
- `lib/cc-regression`이 기존 audit/quality 기록과 연결될 수 있는지 확인한다.
- 토큰 사용량이나 회귀 원인 추적이 실제 운영에 도움이 되는지 확인한다.

완료 기준:

- 품질 검증 단계는 선택 기능이어야 한다.
- 실패하더라도 rkit 본체를 멈추기보다 보고 가능한 신호로 남긴다.
- 새 테스트 실행기가 기존 `test-all.js`를 대체하지 않는다.

### 4.5 5단계 — 실행 기록과 문서-코드 일치 검사 평가 (P2)

목표: 실행 기록, 외부 관측 도구 연결, 문서-코드 일치 검사를 선택 기능으로 둘지 평가한다.

- 실행 기록 내보내기는 기본 꺼짐으로 둔다.
- 문서-코드 일치 검사는 수동 명령 또는 CI에서만 시작하는 방향으로 본다.
- 외부 기록 저장소가 없어도 로컬 audit은 독립적으로 동작해야 한다.

완료 기준:

- 외부 네트워크나 저장소 설정이 없어도 모든 테스트가 통과한다.
- audit 기록 구조는 기존과 호환된다.
- 문서-코드 일치 검사는 오탐 처리 기준을 포함한다.

---

## 5. 기능 요구사항

| ID | 요구사항 | 우선도 |
|---|---|---|
| FR-01 | Cycle 2 평가 기준을 "임베디드 적합성"이 아니라 "rkit 공통 기반 적합성"으로 문서화한다 | P0 |
| FR-02 | 기본 기능 후보 5종을 도입/보류/부분도입 중 하나로 결정하고 이유를 남긴다 | P0 |
| FR-03 | 분야별 기능을 본체와 분리해서 붙이는 구조를 설계한다 | P0 |
| FR-04 | bkit 흐름 제어 기능과 기존 PDCA/의도해석/팀 기능의 책임 중복 표를 만든다 | P1 |
| FR-05 | 품질 검증과 회귀 추적 기능을 선택 기능으로 도입할 수 있는지 평가한다 | P1 |
| FR-06 | 실행 기록 내보내기와 문서-코드 검사는 기본 꺼짐 상태의 선택 기능으로만 평가한다 | P2 |
| FR-07 | 도입되는 모듈마다 먼저 검증 테스트를 만든다 | P0 |
| FR-08 (신규) | cc-regression GDPR 보존 정책 — 해시+메타만 저장(원문 금지), 90일 보존, `/pdca regression purge` 명령, 로컬 only 강제 | P0 |
| FR-09 (신규) | session-ctx-fp + worktree-detector PII 익명화 — `fingerprint = sha256(per_device_salt + normalized_path)` 14자 절단, raw username/$HOME/hostname/git remote URL 저장 금지 | P0 |
| FR-10 (신규) | `policies/` SoT 디렉터리 표준화 — locked-vocab.json + version.json + network-allowlist.json + decisions/ + never-gate.json 일원화. 사이클 1.5 자산 + 본 사이클 신규 SoT 통합 | P0 |
| FR-11 (신규) | 11후보 × 4결정 추적 매트릭스 — `policies/decisions/cycle2-matrix.json` SoT 도입. 후보ID·상태(도입/부분도입/보류/기각)·근거·증거링크·결정자·revisit-by 필드. 사이클 종료 시 결정 재구성 보장 | P0 |
| FR-12 (신규) | 묶음 G(`lib/pdca/status.js` 분할) 호환성 매트릭스 — 사이클 1·1.5 archived feature 12건 모두 정상 읽기 검증. 분할 전·후 스키마 호환성 시험 | P1 |
| FR-13 (신규) | CO-3(28 SKILL 확대) 분류표 — 도메인 중립 SKILL vs 도메인 전용 SKILL 명시. `domain-scoped: true` 머리말 필드 도입. `docs/02-design/`에만 보관 (사이클 3+에서 README 갱신) | P1 |

---

## 6. 비기능 요구사항

| 구분 | 기준 |
|---|---|
| 기존 호환성 | 기존 hook, PDCA 명령, audit 기록, 설정 키가 깨지지 않는다 |
| 분야 독립성 | rkit 본체 신규 기능은 MCU/MPU/WPF를 직접 전제하지 않는다 |
| 선택 가능성 | 품질 검증, 실행 기록, 문서 검사는 꺼져 있어도 rkit 본체에 영향이 없다 |
| 검증 가능성 | 각 도입 후보는 도입 전에 확인할 테스트가 있어야 한다 |
| bkit 정합성 | bkit과 다르게 둘 부분은 이유와 경계를 기록한다 |
| **사이클 1.5 정책 준수** | 신규 모듈 도입 시 잠금 어휘 SoT(`policies/locked-vocab.json`) + 본문/부록 두 층 정책 + `verify-policy.js` 5 검사 통과 의무 (`docs/policy/gstack-sync-policy.md` §5 "범위 확장 절차" 준수) |
| **NEVER_GATE 재평가** | 신규 모듈 도입 시 사이클 1.5의 NEVER_GATE 5개(`security`, `data_migration`, `skill_md_consistency`, `vocab_sync`, `eval_syntax`) 재평가 + 신규 후보 3개 평가: `network_egress`(외부 호출 0건), `pii_in_logs`(홈경로·hostname·email grep), `regression_retention`(cc-regression 보존기간 SoT 존재) |
| **상태 파일 표준** | 묶음 A 신규 상태 파일 모두 `.rkit/state/` Path Registry 등재 + atomic write(tmpfile+rename) + 100-entries 윈도우 검색 의무 (사이클 1.5 패턴 답습) |
| **자동 검증 시간** | `verify-policy.js` 단일 실행 ≤ 30s. 사이클 1.5 8 eval 합산 2분 한도와 정합 |
| **PR-time 자동 검출** | `lib/` 신규 파일 추가 시 verify-policy 신규 항목·NEVER_GATE 등록·SoT 갱신 3종 동반 여부 자동 diff 검사. 미동반 시 차단 (enterprise-expert HIGH 권고) |
| **검사 만료 정책** | verify-policy 각 검사에 `scope: permanent\|transitional` + `sunset: cycle-N` 메타데이터 의무화. 사이클 종료 시 transitional 자동 회수 |
| **egress=deny 기본값** | 묶음 F 도입 시 `policies/network-allowlist.json` SoT + 기본 차단 + 첫 송신 시 동의 프롬프트. URL grep만으로는 동적 endpoint 검출 부족 (security HIGH-1) |

---

## 7. 위험과 대응

| ID | 위험 | 영향 | 발생 가능성 | 대응 |
|----|------|:----:|:----------:|------|
| **위-1** | rkit 정체성 재정의(D-1 (b) 공통 개발 기반 우선)가 임베디드 사용자에게 거부감을 일으킬 수 있다 | 큼 | 중간 | CLAUDE.md `displayName`·`keywords`·README는 본 사이클 미수정. 정체성 전환은 *내부 평가 기준* 차원에만 적용. 사용자 메시징은 사이클 3 이후 별 결정으로 분리. |
| **위-2** | 7 묶음 + 4 carry-over = 11 후보 동시 평가 시 회귀 표면 폭발 | 큼 | 높음 | P0 묶음(A·B)만 본 사이클에서 결정. P1·P2는 **결정 기록만** 남기고 도입은 다음 사이클로 분리. 사이클 1·1.5의 "회귀 표면 최소화" 원칙 답습. |
| **위-3** | 묶음 C(orchestrator)가 기존 PDCA 흐름과 책임 중복 → 사용자 혼란 | 큼 | 중간 | §4.3 단계의 책임 중복 표 작성을 P1 결정 게이트로 둠. 책임 중복 발견 시 자동 보류(c) 처리. 단순 통합 금지. |
| **위-4** | 묶음 F(telemetry)가 외부 네트워크 호출을 도입 → 보안·privacy 회귀 | 큼 | 중간 | NFR "선택 가능성"으로 기본 꺼짐 강제. 도입 시 `audit-logger`처럼 로컬 전용 + opt-in. NEVER_GATE 검사 추가 (외부 토큰·URL grep 0건). |
| **위-5** | 사이클 1.5 정책(SoT, body-neutral, verify-policy)이 신규 모듈에 적용 안 됨 → 정책 형해화 | 큼 | 중간 | NFR "사이클 1.5 정책 준수" 강제. 도입되는 모듈이 SKILL.md를 새로 만든다면 본문/부록 두 층 의무. lib/ 모듈은 verify-policy 검사 항목 추가 평가. |
| **위-6** | 묶음 G(`lib/pdca/status.js` 분할)가 사이클 1·1.5의 `.rkit/state/pdca-status.json` 스키마와 충돌 | 중간 | 중간 | 분할 전 기존 스키마 호환성 매트릭스 작성. 사이클 1·1.5의 archived feature 12건이 모두 정상 읽기 보장되어야 함. 회귀 시험 추가. |
| **위-7** | CO-3(28 SKILL 확대) 시도 시 grandfathered 본문에 잠금 어휘 다수 존재 → body-neutrality 위반 폭증 | 중간 | 높음 | 28 SKILL 일괄 적용은 위험. 도메인 SKILL(MCU/MPU/WPF 전용)과 도메인 중립 SKILL(PDCA/code-review 등)을 분류 후 단계적 적용. 도메인 SKILL은 grandfathered 유지. |
| **위-8** | bkit `lib/orchestrator/`나 `lib/qa/`의 의존 그래프가 너무 커서 부분 도입 불가 | 큼 | 중간 | 단계 4·5 진입 전 의존 그래프 그래프 분석 의무. 의존이 P0 묶음으로 침투하면 자동 보류. |
| **위-9** | 평가 11 후보 중 일부가 결정 게이트 통과 못 해 사이클 1.5 패턴(100% Match Rate) 깨짐 | 중간 | 높음 | "Match Rate 100%"가 본 사이클의 기본 목표는 아님. **결정 기록(도입/부분도입/보류/기각)이 모두 남으면** 본 사이클 성공. FR-11 결정 추적 매트릭스로 재구성 보장. 보고서에 **이중 트랙** 명시 — 품질 트랙(Match Rate) + 거버넌스 트랙(결정 분포). |
| **위-10** | cc-regression 영구 기록 GDPR Art.5/Art.17 위반 (security HIGH-2) | 큼 | 높음 | FR-08 + D-8 차단. 해시+메타만, 90일 보존, purge 명령, 로컬 only. |
| **위-11** | session-ctx-fp/worktree-detector가 PII 노출 (security HIGH-3) | 큼 | 높음 | FR-09 익명화 강제. salt+SHA-256+14자 절단. NEVER_GATE `pii_in_logs` 추가. |
| **위-12** | 묶음 F telemetry 동적 endpoint로 grep 우회 (security HIGH-1) | 큼 | 중간 | NFR egress=deny 기본값 + `network-allowlist.json` SoT + import http/https/fetch 금지 검사. NEVER_GATE `network_egress` 추가. |
| **위-13** | 잠금 어휘 vs D-1 충돌, CO-3 실행 시 표면화 (frontend HIGH-3) | 큼 | 높음 | D-7 차단. `locked-vocab.json` 스키마 `scope: neutral\|domain` 필드 + FR-13 분류표. 도메인 SKILL grandfathered + `domain-scoped: true`. |
| **위-14** | verify-policy 검사 누적으로 5사이클 후 시간 폭주·false positive 증가 | 중간 | 높음 | NFR "검사 만료 정책" 각 검사 `sunset` 메타. NFR "자동 검증 시간 ≤ 30s". 사이클 종료 시 transitional 자동 회수. |
| **위-15** | 11×4=44 결정 셀 추적 부재로 사이클 종료 시 결정 재구성 불가 | 큼 | 높음 | FR-11 결정 매트릭스 SoT 강제. verify-policy에 "11 후보 모두 종결 상태" 게이트 추가. |
| **위-16** | 보류 결정 영구 carry-over화 부채 누적 | 중간 | 중간 | 보류 결정에 `revisit-by: cycle-N` 또는 `unblock-condition` 필드 의무화 (FR-11 스키마). |
| **위-17** | 정체성 전환 간극 — 사이클 2 완료 시 CLAUDE.md/README 미갱신 시 사이클 3 메시징이 소급 정당화로 느껴짐 (frontend HIGH-1) | 중간 | 중간 | 사이클 2 완료 시점 CLAUDE.md Overview 1줄 최소 예고: `rkit works best with MCU/MPU/WPF projects today — broader domain support is in progress.` 잠금 어휘 정책 미위반. |

---

## 8. 결정 기록으로 남길 것

| ID | 결정할 내용 | 선택지 |
|---|---|---|
| D-1 | rkit의 기준 정체성 | (a) 임베디드 우선 / (b) 공통 개발 기반 우선 |
| D-2 | 버전 정보 기준 | (a) bkit 방식 채택 / (b) rkit wrapper 사용 / (c) 현상 유지 |
| D-3 | 분야별 기능 연결 구조 | (a) bkit 구조 채택 / (b) 연결 방식만 채택 / (c) 보류 |
| D-4 | 흐름 제어 기능 | (a) 기존 PDCA 대체 / (b) 보조 기능으로 사용 / (c) 보류 |
| D-5 | 품질 검증 단계 | (a) 선택 가능한 단계 / (b) 명령으로만 제공 / (c) 보류 |
| D-6 | 실행 기록 내보내기 | (a) 로컬 기록만 / (b) 외부 전송은 선택 / (c) 보류 |
| **D-7 (신규)** | 잠금 어휘 scope 메타-정책 | (a) **A: locked-vocab.json 스키마 `scope: neutral\|domain` 필드 + 도메인 SKILL grandfathered + `domain-scoped: true` 표시** / (b) 사이클 3+ 이월 |
| **D-8 (신규)** | cc-regression GDPR 보존 정책 | (a) **해시+메타만, 90일 보존, purge 명령, 로컬 only** / (b) 원문 저장 + 30일 / (c) opt-in으로만 |

---

## 9. 검증 계획

| 검증 | 명령/방법 | 기대 |
|---|---|---|
| 기존 전체 테스트 | `node test-all.js` | 통과 |
| instinct 통합 테스트 | `node tests/instinct-integration.test.js` | 통과 |
| architecture E2E | `node tests/test-architecture-e2e.js` | bad case는 retry, good case는 pass |
| SessionStart 출력 | `node hooks/session-start.js` | JSON 구조 유지 |
| 신규 검증 테스트 | 도입 모듈별 책임 검증 테스트 또는 간단 실행 테스트 | 각 후보가 맡은 역할을 실제로 확인 |
| 선택 기능 꺼짐 상태 | 품질 검증/실행 기록/문서 검사 기능을 끈 상태로 실행 | rkit 본체 영향 없음 |
| **verify-policy 5+M 검사 시간** | `time node scripts/verify-policy.js` | ≤ 30s (NFR) |
| **결정 매트릭스 종결 게이트** | `verify-policy --check decisions-matrix` (신규 검사) | 11 후보 모두 도입/부분도입/보류/기각 중 하나로 종결 |
| **PII 익명화 검증** | `verify-policy --check pii-in-logs` (신규) | username/$HOME/hostname/git URL grep 0건 |
| **GDPR 보존 검증** | `verify-policy --check regression-retention` (신규) | cc-regression 파일 90일 초과 0건 + 원문 저장 0건 |
| **egress=deny 검증** | `verify-policy --check network-egress` (신규) | `import http\|https\|fetch` 미허용 모듈에서 0건 |
| **상태 파일 호환성** | 사이클 1·1.5 archived feature 12건 모두 정상 읽기 (`node scripts/verify-status-schema.js --before --after`, FR-12) | 12/12 PASS |
| **결정 산출물 검증** | 보류/기각 결정도 `policies/decisions/cycle2-matrix.json`에 근거+revisit-by 필드 명시 | 11 후보 × 필수 필드 100% 충족 |

---

## 10. Cycle 2 산출물 기준

Cycle 2의 산출물은 반드시 둘 중 하나다.

1. **도입**: 코드, 테스트, 결정 이유, 옮겨가는 방법을 함께 남긴다.
2. **보류/기각**: 왜 지금 넣지 않는지와 다시 검토할 조건을 남긴다.

단순히 bkit 파일을 복사하는 것은 완료로 보지 않는다.

---

## 11. 후속 항목 표현 수정 요약

| 후보 | 이전 표현 | 수정된 표현 |
|---|---|---|
| Clean Architecture | MCU 도메인 구조화 가능성 | 분야별 기능을 본체와 분리해서 붙이는 구조 |
| Orchestrator | embedded skill 오케스트레이션 | 사용자 의도와 다음 행동을 정하는 작업 흐름 제어 |
| QA Phase | rkit 테스트 자동화 기반 | 선택 가능한 품질 검증 흐름 |
| cc-regression | 장기 안정성 추적 | 실행 환경 변화로 생기는 회귀 추적 |
| telemetry | audit와 통합 가능 | 기본 꺼짐 상태의 실행 기록 내보내기 |
| core 5 modules | 기본 기능 확장 | 버전, 세션, 작업 폴더 기준 정리 |
| status split | 분기 vs 채택 | PDCA 상태 관리 책임 분리 평가 |

---

## 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 0.1 | 2026-04-28 | 초안. 사용자 직접 작성. rkit 정체성 재정의(D-1) + 7 묶음 + 5단계 + 7 FR + 5 NFR + 6 결정 기록. | 노수장 |
| 0.2 | 2026-04-28 | 보강 5건: §1.4 관련 문서 링크 / §2.3 사이클 1.5 carry-over 4 카드 통합 / §6 NFR 2건 추가(사이클 1.5 정책 준수, NEVER_GATE 재평가) / §7 위험과 대응 9건 신설 / 절 번호 재정렬(§7→§8 등). | 노수장 |
| 0.3 | 2026-04-28 | 6인 council 검증 결과 반영 (HIGH 9건). 결정 α/β/γ/δ/ε 모두 A 채택. FR 7→13 (FR-08 GDPR purge, FR-09 PII 익명화, FR-10 SoT 표준화, FR-11 결정 매트릭스, FR-12 status 호환성, FR-13 CO-3 분류표). NFR 7→12 (egress=deny, 상태 파일 표준, 검증 시간 ≤30s, PR-time 자동 검출, 검사 만료, NEVER_GATE 3 추가). 결정 D-7 scope 메타-정책, D-8 GDPR 신설. 위험 9→17 (위-10 GDPR, 위-11 PII, 위-12 egress, 위-13 어휘 충돌, 위-14 검사 누적, 위-15 추적 부재, 위-16 carry-over 부채, 위-17 정체성 간극). §9 검증 항목 7건 추가. | 노수장 + 6인 council |
