# rkit-full-parity Planning Document

> **Summary**: bkit v2.0.0 완전 동등성 달성 + MCU/MPU/WPF 도메인 특화 Eval 시나리오
>
> **Project**: rkit v0.5.0
> **Date**: 2026-03-22
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | rkit에 PM Agent Team(6), PDCA Eval Agents(6), QA/Architecture Agents(8), Phase Skills(9), Eval 시나리오가 없어 bkit 대비 Agent 55%, Skill 75% 수준 |
| **Solution** | 미이식 Agents 23개 이식 + Phase Skills 9개 MCU/MPU/WPF 특화 재작성 + Eval 시나리오 신규 작성 |
| **Function/UX Effect** | `/pdca pm` PM 분석, PDCA 단계별 품질 평가, 9-Phase 파이프라인 MCU/MPU/WPF 가이드, Skill 품질 자동 측정 |
| **Core Value** | bkit 31 Agents / 36 Skills 완전 동등 + 임베디드 특화 = "bkit의 모든 기능 + 3개 도메인 전문성" |

---

## 1. 정밀 GAP 분석 결과

### 1.1 미이식 Agents (23개)

| Group | Agents | 수 | 이식 전략 |
|-------|--------|:--:|-----------|
| **PM Agent Team** | pm-lead, pm-discovery, pm-prd, pm-research, pm-strategy, pm-lead-skill-patch | 6 | 그대로 이식 (임베디드 PM에도 유용) |
| **PDCA Eval** | pdca-eval-plan, pdca-eval-design, pdca-eval-do, pdca-eval-check, pdca-eval-act, pdca-eval-pm | 6 | 그대로 이식 |
| **QA** | qa-monitor, qa-strategist | 2 | 이식 + MCU 빌드 검증 확장 |
| **Product** | product-manager, skill-needs-extractor | 2 | 그대로 이식 |
| **Architecture** | enterprise-expert, infra-architect, security-architect, frontend-architect | 4 | 이식 (enterprise→embedded 적응) |
| **Analysis** | bkit-impact-analyst, cc-version-researcher | 2 | rkit 적응 (bkit→rkit) |
| **Backend** | bkend-expert | 1 | **제외** (웹 백엔드 → MCU/MPU/WPF 무관) |

**이식 대상: 22개** (bkend-expert 1개 제외)

### 1.2 미이식 Skills (24개)

| Group | Skills | 수 | 이식 전략 |
|-------|--------|:--:|-----------|
| **Phase Pipeline** | phase-1~9 (schema, convention, mockup, api, design-system, ui-integration, seo-security, review, deployment) | 9 | **MCU/MPU/WPF 특화 재작성** |
| **Project Level** | starter, dynamic, enterprise | 3 | 이식 + L1/L2/L3 매핑 |
| **Backend** | bkend-auth, bkend-cookbook, bkend-data, bkend-quickstart, bkend-storage | 5 | **제외** (웹 백엔드) |
| **bkit 전용** | bkit-rules, bkit-templates | 2 | **제외** (rkit-rules로 대체됨) |
| **Workflow** | cc-version-analysis, zero-script-qa, pm-discovery, desktop-app, mobile-app | 5 | 이식 (cc-version→rkit-version, desktop→wpf로 매핑) |

**이식 대상: 17개** (bkend-* 5개 + bkit-rules/templates 2개 제외)

### 1.3 Eval 시나리오 (신규)

bkit의 Eval 시나리오를 MCU/MPU/WPF 도메인에 맞게 신규 작성:

| Category | Eval | 수 |
|----------|------|:--:|
| **MCU Capability** | stm32-hal, nxp-mcuxpresso, cmake-embedded, communication, freertos, misra-c | 6 |
| **MPU Capability** | imx-bsp, yocto-build, kernel-driver, rootfs-config | 4 |
| **WPF Capability** | wpf-mvvm, xaml-design, dotnet-patterns, serial-bridge | 4 |
| **Workflow** | pdca, rkit-rules, code-review, development-pipeline | 4 |

**신규 Eval: 18개 시나리오 (각 3파일 = 54파일)**

---

## 2. 구현 범위

### Phase A: Agents 이식 (22개)
### Phase B: Phase Pipeline Skills MCU/MPU/WPF 특화 재작성 (9개)
### Phase C: 나머지 Skills 이식 (8개)
### Phase D: Eval 시나리오 작성 (18개 × 3파일)
### Phase E: 검증 + 커밋

---

## 3. 예상 산출물

| Category | 현재 | 추가 | 최종 |
|----------|:----:|:----:|:----:|
| **Agents** | 17 | +22 | **39** (bkit 31 + MCU/MPU/WPF 8) |
| **Skills** | 27 | +17 | **44** (bkit 29 + MCU/MPU/WPF 15) |
| **Evals** | 4 (프레임워크) | +54 | **58** |
| **Total Files** | 279 | ~93 | **~372** |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-22 | 초기 기획 | Rootech |
