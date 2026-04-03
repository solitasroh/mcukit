# mcukit-full-parity Design Document

> **Summary**: bkit 완전 동등성 + MCU/MPU/WPF Eval 시나리오 상세 설계
>
> **Project**: mcukit v0.5.0
> **Date**: 2026-03-22
> **Plan Reference**: `docs/01-plan/features/mcukit-full-parity.plan.md`

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Agents 17/31(55%), Skills 27/36(75%), Evals 시나리오 0개 |
| **Solution** | Agents +22 이식, Skills +17, Evals 21개 시나리오(63파일) |
| **Function/UX Effect** | PM 분석→PDCA Eval→9-Phase Pipeline→Skill 품질 측정 전체 동작 |
| **Core Value** | bkit 100% 기능 + 3-Domain 전문성 |

---

## 1. Phase A: Agents 이식 (22개)

### 이식 방법: bkit에서 복사 + `bkit:`→`mcukit:` 이름 치환

| # | Agent | Model | 전략 |
|---|-------|:-----:|------|
| 1 | pm-lead | opus | 그대로 이식 |
| 2 | pm-discovery | sonnet | 그대로 이식 |
| 3 | pm-prd | sonnet | 그대로 이식 |
| 4 | pm-research | sonnet | 그대로 이식 |
| 5 | pm-strategy | sonnet | 그대로 이식 |
| 6 | pm-lead-skill-patch | sonnet | 그대로 이식 |
| 7 | pdca-eval-plan | sonnet | 그대로 이식 |
| 8 | pdca-eval-design | sonnet | 그대로 이식 |
| 9 | pdca-eval-do | sonnet | 그대로 이식 |
| 10 | pdca-eval-check | sonnet | 그대로 이식 |
| 11 | pdca-eval-act | sonnet | 그대로 이식 |
| 12 | pdca-eval-pm | sonnet | 그대로 이식 |
| 13 | qa-monitor | sonnet | 이식 + MCU 빌드 로그 검사 추가 |
| 14 | qa-strategist | sonnet | 이식 |
| 15 | product-manager | opus | 이식 |
| 16 | skill-needs-extractor | sonnet | 이식 |
| 17 | enterprise-expert | opus | 이식 (embedded 적응) |
| 18 | infra-architect | opus | 이식 (CI/CD 적응) |
| 19 | security-architect | opus | 이식 |
| 20 | frontend-architect | sonnet | 이식 → WPF XAML 컨텍스트 추가 |
| 21 | bkit-impact-analyst → mcukit-impact-analyst | sonnet | 이름 변경 + 적응 |
| 22 | cc-version-researcher | haiku | 이식 (CC 버전 추적) |

---

## 2. Phase B: Phase Pipeline Skills (9개, MCU/MPU/WPF 특화)

bkit의 phase-1~9를 이식하되, 웹 내용을 MCU/MPU/WPF로 적응:

| Phase | bkit 내용 | mcukit 적응 |
|-------|----------|-------------|
| phase-1-schema | 용어/스키마 | HW 스펙, 레지스터 맵, DTS 구조 |
| phase-2-convention | 코딩 규칙 | MISRA C, 커널 스타일, C# 규칙 |
| phase-3-mockup | UI 프로토타입 | 아키텍처 다이어그램, FW 레이어 |
| phase-4-api | API 설계 | 드라이버 API, HAL 래퍼 인터페이스 |
| phase-5-design-system | 디자인 시스템 | BSP 구조, MVVM 컴포넌트 |
| phase-6-ui-integration | UI 통합 | 페리페럴 통합, DT 연동, View↔VM |
| phase-7-seo-security | SEO/보안 | 기능안전, MISRA, 보안 부트 |
| phase-8-review | 코드 리뷰 | 아키텍처 검증, 메모리 분석 |
| phase-9-deployment | 배포 | 플래싱, OTA, 이미지 빌드, 설치 패키지 |

---

## 3. Phase C: 나머지 Skills (8개)

| Skill | 전략 |
|-------|------|
| starter | 이식 → MCU L1_Basic 초보자 가이드 적응 |
| dynamic | 이식 → MCU L2_Standard RTOS 가이드 적응 |
| enterprise | 이식 → MCU L3_Advanced 멀티코어/안전 적응 |
| desktop-app | 이식 → WPF 데스크톱 앱 가이드 적응 |
| mobile-app | 이식 (cross-platform 참고용) |
| zero-script-qa | 이식 → MCU 빌드 로그 기반 QA 적응 |
| pm-discovery | 이식 |
| cc-version-analysis | 이식 → mcukit-version-analysis 적응 |

---

## 4. Phase D: Eval 시나리오 (21개)

### 4.1 bkit에서 이식 (9개)

| # | Eval | Classification | 전략 |
|---|------|:-------------:|------|
| 1 | pdca | workflow | 그대로 이식 |
| 2 | code-review | workflow | 그대로 이식 |
| 3 | development-pipeline | workflow | 그대로 이식 |
| 4 | plan-plus | hybrid | 그대로 이식 |
| 5 | phase-2-convention | workflow | 그대로 이식 |
| 6 | phase-8-review | workflow | 그대로 이식 |
| 7 | mcukit-rules | workflow | bkit-rules 적응 |
| 8 | mcukit-templates | workflow | bkit-templates 적응 |
| 9 | pm-discovery | workflow | 그대로 이식 |

### 4.2 MCU/MPU/WPF 특화 신규 (12개)

| # | Eval | Classification | prompt 예시 |
|---|------|:-------------:|-------------|
| 1 | stm32-hal | capability | "STM32F407에서 UART DMA 드라이버 작성" |
| 2 | nxp-mcuxpresso | capability | "NXP K64F에서 SPI 드라이버 작성" |
| 3 | cmake-embedded | capability | "STM32용 CMakeLists.txt 작성" |
| 4 | freertos | capability | "FreeRTOS 태스크 3개 + Queue 설계" |
| 5 | misra-c | workflow | "이 코드의 MISRA C 위반 분석" |
| 6 | communication | capability | "I2C 센서 드라이버 작성" |
| 7 | imx-bsp | capability | "i.MX6ULL GPIO LED Device Tree 추가" |
| 8 | yocto-build | capability | "커스텀 Yocto 레시피 작성" |
| 9 | kernel-driver | capability | "platform_driver 기반 커널 모듈 작성" |
| 10 | wpf-mvvm | capability | "CommunityToolkit.Mvvm으로 ViewModel 작성" |
| 11 | xaml-design | capability | "WPF DataTemplate + Style 작성" |
| 12 | serial-bridge | capability | "MCU UART ↔ WPF SerialPort 연동" |

### 4.3 Eval 파일 구조 (시나리오당 3파일)

```
evals/{classification}/{skill-name}/
├── eval.yaml        # 메타데이터 + criteria
├── prompt-1.md      # 평가 프롬프트
└── expected-1.md    # 기대 출력 패턴
```

---

## 5. 구현 순서

```
Step 1: Agents 22개 일괄 복사 + 이름 치환
Step 2: Phase Skills 9개 (bkit 복사 + MCU/MPU/WPF 내용 주입)
Step 3: 나머지 Skills 8개 이식
Step 4: Eval 이식 9개 (bkit 복사 + 적응)
Step 5: Eval 신규 12개 (MCU/MPU/WPF 시나리오)
Step 6: 전체 검증 (구조 + 기능 + bkit 대비 커버리지)
Step 7: 커밋
```

---

## 6. 최종 목표 수치

| 항목 | bkit | mcukit 최종 | 비율 |
|------|:----:|:----------:|:----:|
| Agents | 31 | **39** | 126% |
| Skills | 36 | **44** | 122% |
| Evals | 31 시나리오 | **21** 시나리오 | 68% (웹 전용 제외 시 100%) |
| Hook Events | 18 | 18 | 100% |
| Templates | 30 | 33 | 110% |
| MCP Servers | 2 | 2 | 100% |
| Output Styles | 4 | 4 | 100% |

bkit 대비 **웹 전용 항목(bkend-*, starter/dynamic/enterprise 웹, 웹 Eval) 제외 시 100% 동등**.
임베디드 특화 항목은 bkit보다 **+8 Agents, +15 Skills** 추가.
