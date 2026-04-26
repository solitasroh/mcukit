# mcu-domain-v2 Planning Document

> **Summary**: MCU 동시성/시스템 크리티컬 이슈 통합 분석 에이전트 구축
>
> **Project**: rkit
> **Version**: 0.7.0
> **Author**: soojang.roh
> **Date**: 2026-04-03
> **Status**: Draft
> **Method**: Plan Plus (Brainstorming-Enhanced PDCA)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | MCU 펌웨어에서 컨텍스트 스위칭 시 발생하는 동시성 버그(레이스 컨디션, 공유자원 보호 누락, volatile 오용)는 코드 리뷰로 잡기 극히 어려움. 자체 스케줄러 사용으로 FreeRTOS 전제 도구 활용 불가 |
| **Solution** | 2-Layer 아키텍처: JS 모듈이 소스/설정에서 데이터를 추출하고, opus 에이전트가 ConSynergy 4-Stage 파이프라인으로 의미론적 분석 수행. 4개 추출 모듈(13함수) + 1 에이전트 + 2 레퍼런스 + 1 템플릿 + 1 스킬 |
| **Function/UX Effect** | 코드 리뷰 시 `/mcu-critical-analysis` 실행 → ISR/DMA/동시성/스택 크리티컬 이슈가 심각도+신뢰도별로 분류된 리포트 자동 생성. 팀원 누구나 20년차 수준의 동시성 감사를 받을 수 있음 |
| **Core Value** | "컨텍스트 스위칭을 고려하지 못한 코드"를 빌드 전에 잡는 자동화. 자체 스케줄러에 특화된 유일한 AI 분석 도구 |

---

## 1. User Intent Discovery

### 1.1 Core Problem

MCU 펌웨어 개발에서 동시성/시스템 크리티컬 이슈는 가장 잡기 어려운 버그 유형이다:
- 인터럽트↔메인 루프/태스크 간 레이스 컨디션
- 컨텍스트 스위칭 시 비보호 공유자원 접근
- volatile 키워드 오용 (동기화 수단으로 사용)
- DMA 전송 중 메모리 접근 충돌
- 스택 오버플로우로 인한 메모리 무결성 파괴

기존 도구(cppcheck, embedded-review 등)는 FreeRTOS/pthreads를 전제하며,
팀의 자체 스케줄링 시스템에서는 동작하지 않거나 false positive가 많다.

### 1.2 Target Users

| User Type | Usage Context | Key Need |
|-----------|---------------|----------|
| 팀 개발자 | 코드 리뷰, PR 전 자가 점검 | 동시성 이슈 자동 감지 및 수정 가이드 |
| 시니어 엔지니어 | 아키텍처 리뷰, 크리티컬 코드 감사 | 신뢰도 높은 분석 리포트 |

### 1.3 Success Criteria

- [ ] 자체 스케줄러 기반 코드에서 동시성 이슈를 감지할 수 있다
- [ ] ISR↔태스크 간 공유자원 보호 누락을 90% 이상 감지한다
- [ ] False positive rate < 30% (신뢰도 High 등급 기준)
- [ ] 팀원이 별도 설정 없이 `/mcu-critical-analysis` 한 번으로 리포트를 받는다

### 1.4 Constraints

| Constraint | Details | Impact |
|------------|---------|--------|
| 자체 스케줄러 | FreeRTOS가 아닌 커스텀 스케줄링 시스템 사용 | High — 범용 도구 활용 불가, 패턴 직접 정의 필요 |
| JS 모듈 한계 | AST 파싱/심볼릭 실행 불가 (regex 기반) | Medium — 추출만 하고 판단은 LLM에 위임 |
| cppcheck 의존 | threadsafety 애드온은 제한적 | Low — 보완 수단으로만 사용 |

---

## 2. Alternatives Explored

### 2.1 Approach A: 통합 크리티컬 분석 에이전트 — Selected

| Aspect | Details |
|--------|---------|
| **Summary** | 1개 고차원 에이전트(opus)가 3개 분석 영역을 통합 분석 |
| **Pros** | 단일 진입점, 이슈 간 상관관계 분석 가능 (ISR 내 뮤텍스 사용 → 데드락) |
| **Cons** | 에이전트 프롬프트 복잡도 증가 |
| **Effort** | Medium |
| **Best For** | 이슈 간 연관성이 중요한 실제 프로젝트 |

### 2.2 Approach B: 도메인별 분할 에이전트 (3개)

| Aspect | Details |
|--------|---------|
| **Summary** | ISR, DMA, 동시성 별로 독립 에이전트 3개 구성 |
| **Pros** | 각 에이전트가 작고 집중적, 병렬 실행 가능 |
| **Cons** | 에이전트 간 상관관계 분석 어려움, 관리 복잡도 |
| **Effort** | High |
| **Best For** | 특정 영역만 선택적으로 분석 |

### 2.3 Decision Rationale

**Selected**: Approach A
**Reason**: 동시성 버그의 본질은 시스템 요소 간 상호작용에 있다. ISR 우선순위가 DMA 채널과 연관되고, 공유 변수가 컨텍스트 스위칭 포인트에서 위험해지는 것처럼, 분리된 에이전트로는 크로스 도메인 상관 분석이 불가능하다.

---

## 3. YAGNI Review

### 3.1 Included (v1 Must-Have)

- [x] NVIC 우선순위 충돌 감지
- [x] DMA 채널 경합 분석
- [x] 스레드/뮤텍스 경합 감사 (자체 스케줄러 기반)
- [x] 스택 오버플로 위험 분석
- [x] 메모리 무결성 검사 (공유자원 보호)
- [x] 컨텍스트 스위칭 안전성 분석
- [x] volatile 오용 감지
- [x] 비재진입 함수 호출 감지
- [x] 메모리 배리어 누락 감지
- [x] cppcheck threadsafety 결과 증강

### 3.2 Deferred (v2+ Maybe)

| Feature | Reason for Deferral | Revisit When |
|---------|---------------------|--------------|
| FreeRTOS 특화 분석 | 현재 사용하지 않음 | FreeRTOS 프로젝트 진행 시 |
| HIL 동적 검증 | 하드웨어 연결 필요, 인프라 구축 비용 | 정적 분석 성숙 후 |
| 자동 수정(Auto-fix) | 동시성 수정은 위험도 높음, 사람 판단 필요 | 신뢰도 High 달성 후 |
| 전력 소비 모델링 | 다른 문제 영역 | 별도 feature로 |

### 3.3 Removed (Won't Do)

| Feature | Reason for Removal |
|---------|-------------------|
| 심볼릭 실행 기반 검증 | JS 모듈로 구현 불가, 학술 도구 영역 |
| AST 기반 정밀 분석 | C 파서 구현 비용 대비 LLM 추론이 더 효과적 |

---

## 4. Scope

### 4.1 In Scope

- [x] lib/mcu/ 데이터 추출 모듈 4개 (13 함수)
- [x] mcu-critical-analyzer 에이전트 1개 (opus, ConSynergy 4-Stage)
- [x] refs/mcu/concurrency-patterns.md — 동시성 위험 패턴 라이브러리
- [x] refs/mcu/custom-scheduler-guide.md — 자체 스케줄러 패턴 가이드 (템플릿)
- [x] templates/mcu-critical-report.template.md — 분석 리포트 템플릿
- [x] skills/mcu-critical-analysis/SKILL.md — 분석 트리거 스킬

### 4.2 Out of Scope

- FreeRTOS 특화 분석 (v1에서 제외, 사용하지 않으므로)
- HIL 동적 검증 (하드웨어 인프라 필요)
- 자동 코드 수정 (리포트만 생성, 수정은 사람이 판단)

---

## 5. Requirements

### 5.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 소스 코드에서 ISR 핸들러 및 NVIC 설정 자동 추출 | High | Pending |
| FR-02 | ISR 내부 호출 그래프 및 전역변수 접근 추출 | High | Pending |
| FR-03 | DMA 채널/스트림 설정 및 버퍼 정보 추출 | High | Pending |
| FR-04 | DMA↔페리퍼럴 매핑 테이블 자동 생성 | Medium | Pending |
| FR-05 | 전역/static 변수의 volatile 여부 및 접근 위치 추출 | High | Pending |
| FR-06 | 동기화 프리미티브(mutex, critical_section, irq_disable) 사용 위치 추출 | High | Pending |
| FR-07 | 자체 스케줄러의 컨텍스트 스위칭 포인트 추출 (패턴 configurable) | High | Pending |
| FR-08 | C11 atomic 연산 및 __sync 내장함수 사용 위치 추출 | Medium | Pending |
| FR-09 | cppcheck --addon=threadsafety 실행 및 결과 파싱 | Medium | Pending |
| FR-10 | GCC -fstack-usage .su 파일 + .map 파일에서 함수별 스택 사용량 추출 | Medium | Pending |
| FR-11 | ConSynergy 4-Stage 파이프라인 기반 에이전트 분석 | High | Pending |
| FR-12 | Critical/Warning/Info 심각도 + High/Medium/Low 신뢰도 분류 리포트 | High | Pending |
| FR-13 | 동시성 위험 패턴 라이브러리 (SDRacer, IntRace 기반) | High | Pending |

### 5.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 정확도 | False Positive < 30% (신뢰도 High 기준) | 팀 코드베이스에서 실측 |
| 성능 | 1000 LOC 기준 추출 < 5초 | 벤치마크 |
| 확장성 | 자체 스케줄러 패턴을 ref 문서로 교체 가능 | 구조 검증 |
| 호환성 | STM32 + NXP Kinetis K 양쪽 지원 | 양 플랫폼 테스트 |

---

## 6. Success Criteria

### 6.1 Definition of Done

- [ ] 4개 추출 모듈 구현 완료 (13 함수)
- [ ] mcu-critical-analyzer 에이전트 정의 완료
- [ ] concurrency-patterns.md 레퍼런스 작성 완료
- [ ] custom-scheduler-guide.md 템플릿 작성 완료
- [ ] mcu-critical-report.template.md 리포트 템플릿 완료
- [ ] mcu-critical-analysis SKILL.md 스킬 정의 완료
- [ ] 팀 코드베이스 대상 검증 실행 (최소 1회)

### 6.2 Quality Criteria

- [ ] 모든 추출 함수에 단위 테스트 (입력 샘플 기반)
- [ ] 에이전트 eval 시나리오 작성
- [ ] 기존 MCU 도메인 모듈과 충돌 없음

---

## 7. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 자체 스케줄러 패턴이 다양하여 추출 누락 | High | Medium | configurable 패턴 매칭, ref 문서에 패턴 등록 |
| LLM false positive 과다 | Medium | Medium | 신뢰도(High/Medium/Low) 분류로 노이즈 필터링 |
| cppcheck 미설치 환경 | Low | Medium | tool-bridge를 optional로 설계, 없으면 skip |
| regex 기반 추출의 한계 | Medium | High | 추출은 후보 식별만, 판단은 LLM에 위임하여 보완 |

---

## 8. Architecture Considerations

### 8.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | |
| **Dynamic** | Feature-based modules, BaaS | Web apps | |
| **Enterprise** | Strict layer separation, DI | High-traffic systems | |
| **Embedded** | 2-Layer (Extraction + LLM Reasoning) | MCU/MPU firmware | ✅ |

### 8.2 Key Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 분석 주체 | JS 모듈 / LLM 에이전트 / 하이브리드 | 하이브리드 (2-Layer) | JS로 추출, LLM으로 추론 — 각 레이어의 강점 활용 |
| 에이전트 수 | 1 (통합) / 3 (분할) | 1 (통합) | 크로스 도메인 상관분석 필수 |
| 분석 파이프라인 | Ad-hoc / ConSynergy 4-Stage | ConSynergy 4-Stage | 학술적으로 검증된 LLM+정적분석 결합 방법론 |
| 스케줄러 지원 | FreeRTOS 고정 / configurable | configurable | 자체 스케줄러 패턴을 ref 문서로 교육 |

### 8.3 Component Overview

```
rkit/
├── lib/mcu/
│   ├── isr-extractor.js          # ISR 핸들러/NVIC/호출그래프/전역변수 추출
│   ├── dma-extractor.js          # DMA 설정/버퍼/페리퍼럴 매핑 추출
│   ├── concurrency-extractor.js  # 전역변수/동기화/컨텍스트스위치/atomic 추출
│   ├── tool-bridge.js            # cppcheck/GCC stack usage 외부 도구 연동
│   ├── (기존) pin-config.js
│   ├── (기존) clock-tree.js
│   ├── (기존) memory-analyzer.js
│   ├── (기존) toolchain.js
│   ├── (기존) build-history.js
│   └── index.js                  # 전체 re-export (신규 모듈 추가)
├── agents/
│   └── mcu-critical-analyzer.md  # opus, ConSynergy 4-Stage 파이프라인
├── skills/
│   └── mcu-critical-analysis/
│       └── SKILL.md              # 트리거: /mcu-critical-analysis
├── refs/mcu/
│   ├── concurrency-patterns.md   # 동시성 위험 패턴 라이브러리
│   └── custom-scheduler-guide.md # 자체 스케줄러 패턴 가이드 (팀 작성)
└── templates/
    └── mcu-critical-report.template.md  # 분석 리포트 템플릿
```

### 8.4 Data Flow

```
Source Code (.c/.h)  ──┐
.ioc file            ──┤
.map file            ──┤──→ Layer 1: Data Extraction (4 JS modules)
.ld file             ──┤         │
cppcheck output      ──┤         │ 구조화된 JSON 데이터
.su files (GCC)      ──┘         │
                                 ▼
                    Layer 2: LLM Reasoning (mcu-critical-analyzer)
                         │
                         │ ConSynergy 4-Stage Pipeline:
                         │ ① Identify: 공유자원 중 ISR↔태스크 공유 필터
                         │ ② Slice: 관련 코드 경로 분리
                         │ ③ Reason: 보호 누락, volatile 오용, 비재진입 판단
                         │ ④ Verdict: 심각도×신뢰도 분류 + 수정 제안
                         │
                         ▼
              Critical Issue Report (.md)
              ┌─────────────────────────┐
              │ Critical (3)            │
              │  C-001: ISR에서 비보호   │
              │        전역변수 접근     │
              │  ...                    │
              │ Warning (5)             │
              │ Info (2)                │
              └─────────────────────────┘
                         │
                         ▼
              PDCA Gap Analysis → Auto-fix Loop
```

---

## 9. Convention Prerequisites

### 9.1 Applicable Conventions

- [x] 기존 lib/mcu/ 모듈 네이밍 컨벤션 준수 (camelCase 함수, kebab-case 파일)
- [x] 에이전트 정의 형식 (기존 fw-architect.md, safety-auditor.md 동일)
- [x] 스킬 SKILL.md frontmatter 형식 (v1.6.0 Skills 2.0)
- [x] 레퍼런스 문서 형식 (기존 refs/stm32/, refs/nxp-k/ 동일)

---

## 10. Next Steps

1. [ ] Write design document (`/pdca design mcu-domain-v2`)
2. [ ] Team review and approval
3. [ ] Start implementation (`/pdca do mcu-domain-v2`)

---

## Appendix A: Research Sources

### A.1 학술 연구

- [ConSynergy (2025)](https://www.mdpi.com/1999-5903/17/12/578) — LLM+정적분석 4단계 동시성 버그 감지
- [SDRacer (IEEE 2020)](https://ieeexplore.ieee.org/document/9072666/) — ISR 레이스 자동 감지/검증/수리
- [IntRace (2024)](https://link.springer.com/article/10.1007/s11227-024-06189-4) — 인터럽트 데이터 레이스 경로 분석
- [SADA (USENIX 2021)](https://www.usenix.org/conference/usenixsecurity21/presentation/bai) — DMA 안전하지 않은 접근 감지
- [IoT-SkillsBench (2025)](https://arxiv.org/html/2603.19583v1) — 임베디드 AI 에이전트 벤치마크
- [AI-Assisted Firmware Validation (2025)](https://arxiv.org/abs/2509.09970) — AI 에이전트 기반 펌웨어 검증

### A.2 기존 도구/프로젝트

- [Embedder](https://embedder.com/) — 상용 AI 펌웨어 엔지니어 (400+ MCU, SIL+HIL)
- [embedded-review](https://github.com/ylongw/embedded-review) — CC 스킬 기반 펌웨어 코드 리뷰
- [awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) — CC 임베디드 시스템 에이전트
- [Cppcheck Premium 25.8.0](https://www.cppcheck.com/product-news/cppcheck-premium-25.8.0-released-full-misra-c2025-coverage) — MISRA C:2025 전체 커버

### A.3 표준/가이드라인

- MISRA C:2023 Amendment 4 — 멀티스레딩/atomic 규칙 (Rules 22.11-22.20)
- SEI CERT CON02-C — volatile을 동기화 수단으로 사용 금지
- ARM Cortex-M DMB/DSB/ISB — 메모리 배리어 가이드

---

## Appendix B: Brainstorming Log

| Phase | Question | Answer | Decision |
|-------|----------|--------|----------|
| Intent | 핵심 문제? | 동시성/크리티컬 이슈 분석 고차원 에이전트 | 통합 크리티컬 분석 에이전트 |
| Intent | 대상 사용자? | 팀 개발자들 | 팀 전원이 쉽게 사용 가능한 스킬 형태 |
| Alternatives | 접근 방식? | A:통합 / B:분할 / C:기존확장 | A:통합 — 크로스 도메인 상관분석 |
| YAGNI | FreeRTOS? | 사용하지 않음, 자체 스케줄러 | 제외. configurable 패턴으로 자체 스케줄러 지원 |
| Design | 모듈 역할? | 추출 vs 분석 혼재 문제 | 2-Layer: 모듈=추출, 에이전트=분석 |
| Research | 기존 도구? | Embedder(생성), embedded-review(리뷰) | rkit은 동시성 분석 특화 — 차별화 |
| Research | 학술 기법? | ConSynergy, SDRacer, IntRace, SADA | ConSynergy 4-Stage를 에이전트 파이프라인에 적용 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-03 | Initial draft (Plan Plus) | soojang.roh |
