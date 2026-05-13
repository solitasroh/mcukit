# gstack → rkit 동기화 정책

> **사이클 1.5에서 정착됨** (2026-04-28).
> 본 정책은 SKILL.md 레이어 동기화에 한정됩니다. `lib/`, `agents/`, `hooks/` 신규 모듈 도입은 별도 사이클별로 평가합니다.

## 1. 잠금 어휘 단일 출처 (SoT)

[`policies/locked-vocab.json`](../../policies/locked-vocab.json)이 잠금 어휘 20개의 단일 출처입니다.

- **MCU 7개**: `HardFault`, `CFSR`, `HFSR`, `MMFAR`, `BFAR`, `FreeRTOS`, `MISRA C`
- **MPU 7개**: `Device Tree`, `dtsi`, `dtoverlay`, `bblayers.conf`, `Yocto`, `bitbake`, `U-Boot`
- **WPF 6개**: `XAML`, `MVVM`, `ObservableObject`, `RelayCommand`, `.csproj`, `app.config`

**정책**:
- 이 어휘는 일반화·번역·삭제 금지.
- 4개 SKILL의 **방법론 본문 (cycle15-body-neutral 영역)**에 사용 0건.
- 4개 SKILL의 **부록 §A (locked-vocab-appendix 영역)**에 1건 이상 보존.
- 부록은 [`scripts/gen-locked-vocab.mjs`](../../scripts/gen-locked-vocab.mjs)로 자동 생성합니다.
- gstack에서 텍스트를 가져올 때도 보존합니다.

## 2. 가져오지 않을 항목 (7가지)

다음은 gstack 전용 자산으로, rkit으로 가져오지 않습니다 (회귀 표면 최소화).

| # | 항목 | 사유 |
|---|------|------|
| 1 | `bin/gstack-*` 보조 스크립트 | 임베디드 개발과 무관, 외부 의존 |
| 2 | gstack 자체 메모리 시스템 (GBrain, `~/.gstack/projects/`) | rkit은 `.rkit/state/learnings.json` 사용 |
| 3 | 사용량 수집 (telemetry, `~/.gstack/analytics/`) | 본 plugin은 텔레메트리 수집 안 함 |
| 4 | 문장 품질 검사 도구 (slop-scan) | 기존 `code-analyzer` agent + `lib/quality/`로 대체 |
| 5 | 사이드바·웹소켓·터미널 보안 묶음 | 브라우저 자동화 무관, 임베디드 외 |
| 6 | 톤·정체성 문서 (ETHOS.md voice, CHANGELOG release-summary 양식) | 한·영 혼용 + 임베디드 도메인 voice 유지 |
| 7 | OWASP 웹 전용 취약점 항목 | 임베디드용 STRIDE는 유지 (`agents/security-architect.md`) |

## 3. 검증 기준 (자동화)

[`scripts/verify-policy.js`](../../scripts/verify-policy.js)가 5개 검사를 자동 실행합니다.

| 검사 | 통과 조건 | 명령 |
|------|----------|------|
| **body-neutrality** | 4 SKILL의 cycle15-body-neutral 영역에 잠금 어휘 0건 | `node scripts/verify-policy.js --check body-neutrality` |
| **vocab-preservation** | 4 SKILL의 부록 §A에 잠금 어휘 20개 모두 보존 | `node scripts/verify-policy.js --check vocab-preservation` |
| **forbidden-tokens** | 4 SKILL에 §2 제외 항목 토큰 0건 | `node scripts/verify-policy.js --check forbidden-tokens` |
| **eval-syntax** | 4 평가 디렉터리의 `eval.yaml`에 `judge: regex_only` 명시 | `node scripts/verify-policy.js --check eval-syntax` |
| **sot-schema** | `policies/locked-vocab.json` 스키마 유효 (20 vocabs, 도메인 enum) | `node scripts/verify-policy.js --check sot-schema` |

전체 검사: `node scripts/verify-policy.js`

훅 통합:
- **Stop 훅** (`hooks/hooks.json`): 세션 종료 시 자동 실행 (`--quiet`).
- **PR 시**: 사용자 또는 CI가 직접 호출.

## 4. SoT-부록 동기화 워크플로

```
1. SoT 변경:      policies/locked-vocab.json 편집 (예: 어휘 추가)
2. 부록 재생성:   node scripts/gen-locked-vocab.mjs
3. 검증:         node scripts/verify-policy.js
4. 커밋:         policies + 4 SKILL.md 함께 묶어서 커밋
```

부록을 직접 편집하지 마세요. SoT가 단일 출처입니다.

## 5. 적용 범위 + 확장 절차

본 정책은 **SKILL.md 레이어 동기화**에만 적용됩니다.

확장이 필요한 경우 (예: `lib/`, `agents/`, `hooks/` 신규 모듈을 gstack에서 가져옴):

1. 새 design 문서를 작성하여 영향 범위 명시.
2. NEVER_GATE 5개를 재평가 (현재: `security`, `data_migration`, `skill_md_consistency`, `vocab_sync`, `eval_syntax`).
3. 본 정책 §2 제외 항목 7가지 재검토.
4. PDCA 사이클로 변경 처리.

## 6. 관련 문서

- 기획서: [`docs/01-plan/features/bkit-gstack-sync-v2-cycle15.plan.md`](../01-plan/features/bkit-gstack-sync-v2-cycle15.plan.md)
- 설계: [`docs/02-design/features/bkit-gstack-sync-v2-cycle15.design.md`](../02-design/features/bkit-gstack-sync-v2-cycle15.design.md)
- 사이클 1 보고서 §9 carry-over: [`docs/archive/2026-04/bkit-gstack-sync-v2/bkit-gstack-sync-v2.report.md`](../archive/2026-04/bkit-gstack-sync-v2/bkit-gstack-sync-v2.report.md)
