# code-quality-enhancement Planning Document

> **Summary**: AI 에이전트가 생성하는 코드의 구조적 품질을 보장하기 위한 규칙 강화, 강제 검증 메커니즘, 레퍼런스 레포 시스템 구축
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
| **Problem** | 현재 코드 품질 규칙(refs/code-quality/)이 추상적이라 LLM이 실제로 좋은 구조의 코드를 생성하지 못함. OOP, 디자인 패턴, 클린 아키텍처 적용이 형식적이고, 작성 후 검증 메커니즘도 전무 |
| **Solution** | 3가지 축으로 개선: ① 규칙 문서를 언어별 Bad/Good 코드 예시 + 모던 관용구 + 디자인 패턴 실전 구현으로 대폭 강화 ② PostToolUse 3-Stage 훅(Linter → Prompt → Metrics)으로 매 코드 작성 후 자동 검증 ③ 언어별 레퍼런스 레포를 등록하여 "이 코드처럼 써라" 교육 |
| **Function/UX Effect** | `/pdca do` 시 에이전트가 모던 관용구와 클린 아키텍처를 적용한 코드 생성 → PostToolUse 훅이 매 Edit 후 구조 위반 자동 감지 → 피드백이 에이전트에 주입되어 즉시 수정 → 품질 메트릭이 누적되어 대시보드로 확인 가능 |
| **Core Value** | "규칙을 알려줬으니 지켜라"가 아닌 "매번 검증하고, 좋은 코드를 보여주고, 정량적으로 추적한다" — AI 코드 생성 품질의 구조적 보장 |

---

## 1. User Intent Discovery

### 1.1 Core Problem

AI 에이전트(Claude)가 생성하는 코드의 **구조적 품질**이 부족하다:
- 함수가 너무 길고, 책임이 뒤섞여 있음
- 디자인 패턴을 적용하지 않거나 형식적으로만 적용
- 모던 언어 관용구(Modern C++, C# records, TS discriminated unions)를 사용하지 않음
- 클린 아키텍처 레이어를 무시하고 코드를 아무 데나 배치
- 기존 코드를 재사용하지 않고 중복 코드를 생성

현재 규칙 문서(refs/code-quality/*.md)의 한계:
- SOLID 원칙 나열 수준 — "어떻게" 적용하는지 구체적 코드 예시 부족
- Bad/Good 예시가 의사코드 수준 — 언어별 실제 코드로 보여줘야 함
- 규칙을 줘도 **따르는지 검증할 방법이 없음**
- 모든 규칙을 적을 수 없으므로 **"이 레포처럼 써라"** 방식이 필요

### 1.2 Target Users

| User Type | Usage Context | Key Need |
|-----------|---------------|----------|
| rkit 플러그인 사용자 | PDCA Do 단계에서 코드 작성 | 에이전트가 구조적으로 좋은 코드를 자동 생성 |
| 코드 리뷰어 | /code-review 실행 | 구조적 위반을 자동 감지 |

### 1.3 Success Criteria

- [ ] 규칙 문서가 언어별 Bad/Good 실제 코드 예시를 포함한다
- [ ] 모던 언어 관용구(C++17/20, C# 12, TS 5.x, Python 3.12)가 포함된다
- [ ] PostToolUse 훅이 매 Edit/Write 후 구조적 위반을 자동 감지한다
- [ ] 감지된 위반이 에이전트 컨텍스트에 피드백으로 주입된다
- [ ] 프로젝트별 코드 품질 메트릭이 누적 추적된다

### 1.4 Constraints

| Constraint | Details | Impact |
|------------|---------|--------|
| 도메인 무관 | 임베디드, 웹, 데스크톱 어디서든 적용 | High — 특정 도메인 규칙 혼재 금지 |
| 컨텍스트 윈도우 | refs 파일이 너무 크면 컨텍스트 소비 | Medium — 핵심만 포함, 상세는 Read로 |
| 외부 도구 의존 | linter 미설치 시 Stage 1 skip | Low — prompt handler로 보완 |

---

## 2. Alternatives Explored

### 2.1 Approach A+B: 규칙 강화 + PostToolUse 강제 검증 + 레퍼런스 레포 — Selected

| Aspect | Details |
|--------|---------|
| **Summary** | 규칙 문서 대폭 강화 + PostToolUse 3-Stage 훅 + 레퍼런스 레포 참조 시스템 |
| **Pros** | 규칙(교육) + 검증(강제) + 예시(모방) 3축 동시 해결 |
| **Cons** | 작업량 많음, PostToolUse 속도 영향 가능 |
| **Effort** | High |

### 2.2 Decision Rationale

**Selected**: A+B 하이브리드
**Reason**: 규칙만으로는 LLM이 안 따르고, 검증만으로는 사후 대응이고, 레퍼런스만으로는 체계가 없음. 3축을 함께 적용해야 실질적 품질 향상 가능.

---

## 3. YAGNI Review

### 3.1 Included (v1 Must-Have)

- [x] 규칙 문서 강화 — 언어별 Bad/Good 코드 예시, 디자인 패턴 실전 구현, 모던 관용구
- [x] PostToolUse 검증 훅 — 3-Stage (Linter → Prompt Handler → Metrics)
- [x] 품질 메트릭 대시보드 — 함수 길이/파라미터/중첩/파일 크기 추적

### 3.2 Deferred (v2+)

| Feature | Reason for Deferral | Revisit When |
|---------|---------------------|--------------|
| 레퍼런스 레포 등록 시스템 | rkit.config.json에 레포 URL 등록 + 자동 클론 | v1 검증 후 |
| Auto-fix (자동 수정) | 구조적 수정은 의미론적 판단 필요, 위험 | Prompt handler 성숙 후 |
| 프로젝트별 커스텀 규칙 | 팀별 규칙 오버라이드 | 기본 규칙 안정화 후 |

---

## 4. Scope

### 4.1 In Scope

- [x] refs/code-quality/ 4개 파일 대폭 강화 (cpp.md, csharp.md, typescript.md, python.md)
  - 각 파일에 추가: 디자인 패턴 구현 예시, 모던 관용구, 프로젝트 구조 가이드, 안티패턴
- [x] refs/code-quality/common.md 신규 — 언어 무관 클린 아키텍처/OOP/디자인 패턴 가이드
- [x] rkit-rules SKILL.md 코드 품질 섹션 강화
- [x] scripts/code-quality-hook.js — PostToolUse 3-Stage 파이프라인
- [x] hooks.json 업데이트 — PostToolUse 등록
- [x] lib/code-quality/metrics-collector.js — 정량적 메트릭 수집
- [x] 품질 메트릭 대시보드 (pdca status 통합 또는 별도 커맨드)

### 4.2 Out of Scope

- 레퍼런스 레포 자동 클론/인덱싱
- 특정 도메인(임베디드, 웹) 특화 규칙 (이미 별도 스킬에 존재)
- Auto-fix 기능

---

## 5. Requirements

### 5.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | common.md: 클린 아키텍처 레이어 판단 기준 + 의존성 규칙 + Bad/Good 예시 | High | Pending |
| FR-02 | common.md: 디자인 패턴 8가지의 실전 적용 판단 기준 + 언어별 구현 예시 | High | Pending |
| FR-03 | common.md: OOP 원칙 적용 가이드 (상속 vs 합성, 인터페이스 설계, 캡슐화 레벨) | High | Pending |
| FR-04 | cpp.md 강화: 모던 C++17/20 관용구 (structured bindings, std::optional, concepts, ranges) + 프로젝트 구조 | High | Pending |
| FR-05 | csharp.md 강화: 모던 C# 12 (record, pattern matching, primary constructors) + 레이어 구조 + 에러 핸들링 | High | Pending |
| FR-06 | typescript.md 강화: 모던 TS 5.x (satisfies, const type params, template literals) + 모듈/배럴 구조 + 테스트 | High | Pending |
| FR-07 | python.md 강화: 모던 Python 3.12 (type alias, match statement) + async 패턴 + 패키지 구조 | High | Pending |
| FR-08 | PostToolUse Stage 1: 언어별 linter 자동 실행 (cppcheck/dotnet-format/eslint/ruff) | High | Pending |
| FR-09 | PostToolUse Stage 2: Prompt handler로 구조적 원칙 위반 의미론적 검토 | High | Pending |
| FR-10 | PostToolUse Stage 3: Metrics collector — 함수길이/파라미터수/중첩깊이/파일크기 수집 | Medium | Pending |
| FR-11 | .rkit/state/code-quality-metrics.json 누적 저장 | Medium | Pending |
| FR-12 | 품질 메트릭 대시보드 출력 (pdca status 통합) | Medium | Pending |
| FR-13 | 각 언어 문서에 추천 레퍼런스 레포 URL 기재 | Medium | Pending |

### 5.2 Non-Functional Requirements

| Category | Criteria | Measurement |
|----------|----------|-------------|
| 성능 | PostToolUse 훅 실행 < 3초 (Stage 1+3), < 10초 (Stage 2 prompt) | 벤치마크 |
| 호환성 | linter 미설치 시 graceful skip | 설치 없는 환경 테스트 |
| 컨텍스트 | common.md < 200줄, 언어별 < 250줄 | 라인 카운트 |

---

## 6. Success Criteria

### 6.1 Definition of Done

- [ ] common.md 작성 완료 (클린 아키텍처 + OOP + 디자인 패턴)
- [ ] 4개 언어별 refs 강화 완료 (Bad/Good + 모던 관용구 + 구조)
- [ ] code-quality-hook.js 3-Stage 파이프라인 구현
- [ ] hooks.json PostToolUse 등록
- [ ] metrics-collector.js 메트릭 수집 구현
- [ ] pdca status에 품질 메트릭 통합

### 6.2 Quality Criteria

- [ ] 각 언어 문서에 최소 5개 이상의 Bad/Good 코드 쌍
- [ ] PostToolUse 훅이 함수 40줄 초과 감지 가능
- [ ] linter 미설치 시 Stage 1 skip, Stage 2-3 정상 동작

---

## 7. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| PostToolUse 속도 저하 | Medium | High | Stage 2 prompt를 선택적으로 실행 (C/C# 파일만) |
| 규칙 문서 컨텍스트 과다 소비 | Medium | Medium | 핵심만 본문, 상세는 Read 참조 구조 유지 |
| LLM이 규칙을 읽어도 안 따름 | High | Medium | PostToolUse 훅으로 강제 피드백 — 따를 때까지 반복 |
| Prompt handler 비용 | Low | High | 수정된 파일에만 적용, 전체 프로젝트 스캔 금지 |

---

## 8. Architecture Considerations

### 8.1 Key Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 규칙 전달 방식 | 규칙 나열 / Bad-Good 예시 / 레퍼런스 레포 | Bad-Good + 레포 URL | LLM은 추상 원칙보다 구체적 코드 예시로 학습 |
| 검증 시점 | 사전(PreToolUse) / 사후(PostToolUse) | PostToolUse | 코드 작성 후 검증 → 피드백 주입이 자연스러움 |
| 검증 방식 | command only / prompt only / 하이브리드 | 하이브리드 3-Stage | linter(결정적) + prompt(의미론적) + metrics(정량적) |
| 메트릭 저장 | 세션 / 영구 | 영구 (.rkit/state/) | 프로젝트별 품질 추세 추적 |

### 8.2 Component Overview

```
rkit/
├── refs/code-quality/
│   ├── common.md           (신규) 클린아키텍처/OOP/디자인패턴 범용 가이드
│   ├── cpp.md              (강화) 모던 C++17/20 + Bad/Good + 구조
│   ├── csharp.md           (강화) 모던 C# 12 + Bad/Good + 레이어
│   ├── typescript.md       (강화) 모던 TS 5.x + Bad/Good + 모듈 구조
│   └── python.md           (강화) 모던 Python 3.12 + Bad/Good + async
├── scripts/
│   └── code-quality-hook.js  (신규) PostToolUse 3-Stage 파이프라인
├── lib/code-quality/
│   └── metrics-collector.js  (신규) 코드 메트릭 수집/저장
├── skills/rkit-rules/
│   └── SKILL.md              (강화) 코드 품질 섹션 업데이트
└── hooks.json                (업데이트) PostToolUse 등록
```

### 8.3 PostToolUse 3-Stage Pipeline

```
Write/Edit 완료
    ↓
Stage 1: Linter (command, <1초)
├── .c/.cpp → cppcheck --enable=style
├── .cs     → dotnet format --verify-no-changes
├── .ts/.js → eslint --no-fix (or biome)
├── .py     → ruff check
└── 미설치 시 skip (graceful)
    ↓
Stage 2: Prompt Handler (prompt, <10초)
├── "방금 수정된 파일 {file}의 코드 구조를 검토하라"
├── 체크: 함수 40줄 초과, 파라미터 3개 초과, 중첩 3단계 초과
├── 체크: SRP 위반, 불필요한 결합, 중복 코드
├── 위반 발견 시 피드백을 에이전트 컨텍스트에 주입
└── 위반 없으면 통과
    ↓
Stage 3: Metrics Collector (command, <0.5초)
├── 함수 길이, 파라미터 수, 중첩 깊이, 파일 크기 계산
├── .rkit/state/code-quality-metrics.json 업데이트
└── 임계값 초과 시 경고 메시지 출력
```

---

## 9. Convention Prerequisites

### 9.1 Applicable Conventions

- [x] 레퍼런스 문서 형식 — 기존 refs/ 패턴 유지
- [x] 훅 스크립트 형식 — 기존 scripts/ 패턴 (mcu-post-build.js 등) 동일
- [x] 메트릭 저장 형식 — .rkit/state/ 하위 JSON

---

## 10. Next Steps

1. [ ] Write design document (`/pdca design code-quality-enhancement`)
2. [ ] Team review and approval
3. [ ] Start implementation (`/pdca do code-quality-enhancement`)

---

## Appendix A: 추천 레퍼런스 레포

### 범용 (언어 무관)
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) — C++ 표준 위원회 공식 가이드
- [jasontaylordev/CleanArchitecture](https://github.com/jasontaylordev/CleanArchitecture) — .NET Clean Architecture (16k+ stars)

### C++
- [TheLartians/ModernCppStarter](https://github.com/TheLartians/ModernCppStarter) — 모던 C++ 프로젝트 구조 템플릿
- [rigtorp/awesome-modern-cpp](https://github.com/rigtorp/awesome-modern-cpp) — 모던 C++ 리소스 모음

### C#
- [CommunityToolkit/MVVM-Samples](https://github.com/CommunityToolkit/MVVM-Samples) — 공식 MVVM 패턴 샘플
- [stevsharp/MVVMCleanArchitecture](https://github.com/stevsharp/MVVMCleanArchitecture) — WPF Clean Architecture

### TypeScript
- [rmanguinho/clean-ts-api](https://github.com/rmanguinho/clean-ts-api) — TDD + SOLID + Clean Architecture
- [bypepe77/typescript-clean-architecture](https://github.com/bypepe77/typescript-clean-architecture) — tsyringe DI + SOLID

### Python
- [pcah/python-clean-architecture](https://github.com/pcah/python-clean-architecture) — Protocol + adapter 패턴 툴킷

---

## Appendix B: Brainstorming Log

| Phase | Question | Answer | Decision |
|-------|----------|--------|----------|
| Intent | 핵심 문제? | 규칙이 추상적, 검증 메커니즘 없음, 레퍼런스 레포 필요 | 3축 동시 해결 |
| Intent | 대상? | rkit 플러그인 사용자 전체 | 도메인 무관 범용 |
| Alternatives | 접근? | A:레포+훅 / B:문서강화 / A+B:하이브리드 | A+B 하이브리드 |
| YAGNI | 범위? | 규칙강화 + 훅 + 메트릭 | 레포 자동클론은 v2 |
| Design | 도메인? | 도메인 무관 순수 코드 구조 | 임베디드 특화 규칙은 별도 스킬에 유지 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-03 | Initial draft (Plan Plus) | soojang.roh |
