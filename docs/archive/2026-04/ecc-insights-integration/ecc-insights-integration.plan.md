# ecc-insights-integration Planning Document

> **Summary**: ECC 인사이트 기반 3-Layer 코드 리뷰 시스템 + 인스팅트 학습 엔진 도입
>
> **Project**: rkit
> **Version**: 0.9.10 → 0.9.11+
> **Author**: 노수장
> **Date**: 2026-04-09
> **Status**: Draft
> **PRD 참조**: `docs/00-pm/ecc-insights-integration.prd.md`

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 코드 설계 품질(SOLID, 복잡도, DRY)과 언어별 숙어(C++ RAII, C# async/await)를 체계적으로 검증할 범용 리뷰어가 없으며, 세션마다 코딩 관습이 리셋된다 |
| **Solution** | 3-Layer 코드 리뷰(L1 범용 설계 + L2 언어 숙어 + L3 도메인 위임) + 인스팅트 학습 엔진으로 세션 간 패턴 자동 누적 |
| **Function/UX Effect** | `/code-review` 한 번으로 설계 품질 + 언어 숙어 통합 리포트, 3세션 후 반복 교정 70% 감소 |
| **Core Value** | "코드 설계 품질은 도메인과 무관하다" -- 범용 품질 계층과 도메인 안전 계층의 분리로 모든 개발자에게 가치 제공 |

---

## 1. Overview

### 1.1 Purpose

Everything Claude Code(ECC, 146K Stars) 분석에서 도출된 2가지 핵심 인사이트를 rkit에 도입한다:

1. **3-Layer 코드 리뷰 시스템**: ECC의 9개 언어별 리뷰어 철학을 계승하되, "범용 설계 품질(L1) → 언어 숙어(L2) → 도메인 안전(L3, 기존 에이전트 위임)"의 계층적 아키텍처로 구현
2. **인스팅트 학습 엔진**: ECC의 세션 간 패턴 학습 시스템을 rkit의 PDCA 생태계에 맞춤 통합

### 1.2 Background

- **ECC 분석 결과**: `docs/03-analysis/everything-claude-code-comparison.analysis.md`
- **PRD**: `docs/00-pm/ecc-insights-integration.prd.md`
- **핵심 근거**: 코드 설계 품질(SOLID, 복잡도, DRY)은 C든 C#이든 Python이든 동일하게 적용되는 범용 원칙. 도메인 안전 규칙(MISRA, MVVM, ISR/DMA)은 이미 기존 전문 에이전트가 담당. 이 두 계층을 명확히 분리하는 것이 핵심.

### 1.3 Related Documents

- PRD: `docs/00-pm/ecc-insights-integration.prd.md`
- ECC 비교 분석: `docs/03-analysis/everything-claude-code-comparison.analysis.md`
- 기존 코드 리뷰 스킬: `skills/code-review/SKILL.md`
- 기존 코드 분석 에이전트: `agents/code-analyzer.md`
- 메트릭 수집기: `lib/code-quality/metrics-collector.js`

---

## 2. Scope

### 2.1 In Scope

**Phase 1 (v0.9.11) - refs 개선 + L1 code-analyzer 프로덕션 레벨 리팩터링**:

*Step 0: 기존 훅 시스템 버그 수정 (차단 이슈)*:
- [ ] `context-hierarchy.js` 버그 수정: `getCommon()` 빈 body + `core` 미선언 → `getPlatform()` 연결 복구 (원인: `c389514` common.js bridge 제거 시 lazy require 누락)
- [ ] `pre-write.js` → `permission-manager.js` → `context-hierarchy.js` 호출 체인 정상화 확인
- [ ] PreToolUse Write 훅 정상 동작 회귀 테스트
- [ ] `metrics-collector.js` git 수정 내용 확인 및 정리 (현재 unstaged 상태)

*Step 1: refs/code-quality/ 기존 문서 개선 (ECC 참고, 선행 작업)*:
- [ ] `common.md` 보안 체크리스트 섹션 추가 (하드코딩 시크릿, 인젝션, Path Traversal)
- [ ] `common.md` 심각도 분류 체계 추가 (CRITICAL/HIGH/MEDIUM/LOW → BLOCK/WARNING/APPROVE)
- [ ] `common.md` AI 생성 코드 특별 감사 규칙 추가
- [ ] `cpp.md` 보안 섹션 추가 (정수 오버플로, 버퍼 오버플로, 초기화 안된 변수, 커맨드 인젝션)
- [ ] `cpp.md` 동시성 안전 규칙 추가 (데이터 레이스, 데드락, std::mutex/scoped_lock 패턴)
- [ ] `cpp.md` sanitizer 가이드 추가 (ASan, UBSan, TSan)
- [ ] `csharp.md` Nullable Reference Types (#nullable enable) 규칙 추가
- [ ] `csharp.md` 보안 섹션 추가 (BinaryFormatter 금지, Path Traversal, unsafe deserialization)
- [ ] `csharp.md` sealed 클래스 + IOptions\<T\> 패턴 추가
- [ ] `python.md` 보안 섹션 추가 (f-string SQL 인젝션, 셸 인젝션, pickle, 파일 경로)
- [ ] `python.md` 가변 기본 인자 금지 규칙 추가 (`def f(x=[])`)
- [ ] `python.md` logging > print, builtin 섀도잉 금지 규칙 추가
- [ ] `pre-guide.js` COMPACT_RULES 업데이트 (보안/심각도 반영)

*Step 2: code-analyzer 리팩터링 (개선된 refs 기반)*:
- [ ] 기존 `code-analyzer` 에이전트를 L1 전용으로 리팩터링 (`agents/code-analyzer.md` MODIFY)
- [ ] SQ-001~008 규칙을 SOLID 원칙 기반으로 재편 및 품질 강화
- [ ] 순환 복잡도(cyclomatic) 임계값 통일 (warn: 10, error: 20)
- [ ] DRY 위반 / 코드 중복 감지 규칙 추가
- [ ] 안티패턴 검증 강화 (Feature Envy, Primitive Obsession, God Class)
- [ ] 심각도 분류 체계 적용 (common.md 기반 CRITICAL→BLOCK 매핑)
- [ ] 통합 리뷰 리포트 마크다운 출력 (FR-008)
- [ ] L1 규칙 정의 모듈 분리 (`lib/code-quality/design-rules.js`)

**Phase 2 (v0.9.12) - L2 언어별 숙어 리뷰어**:
- [ ] C/C++ 숙어 리뷰어 에이전트 (`agents/c-cpp-reviewer.md` NEW)
- [ ] C# 숙어 리뷰어 에이전트 (`agents/csharp-reviewer.md` NEW)
- [ ] Python 숙어 리뷰어 에이전트 (`agents/python-reviewer.md` NEW)
- [ ] L3 도메인 리뷰 오케스트레이션 (`--domain` 옵션)
- [ ] PDCA Quality Gate 연동 (FR-009)

**Phase 3 (v0.9.13) - 인스팅트 학습 엔진**:
- [ ] 인스팅트 데이터 수집 엔진 (`lib/instinct/collector.js`)
- [ ] 프로젝트별 인스팅트 저장소 (`.rkit/instinct/{project-hash}/`)
- [ ] 세션 시작 시 인스팅트 프로파일 자동 로드
- [ ] 신뢰도 점수 기반 패턴 관리
- [ ] 3세션 수렴 알고리즘
- [ ] **데이터 구조에 크로스 프로젝트/팀 공유 확장점 미리 설계** (Design 단계에서 정의)

**Phase 4 (v0.9.14) - 크로스 프로젝트 전이 + 팀 인스팅트 공유**:
- [ ] 크로스 프로젝트 패턴 승격 (도메인 동일 조건, 3+ 프로젝트 기준)
- [ ] 글로벌 인스팅트 저장소 (`.rkit/instinct/global/`)
- [ ] 팀 공유 인스팅트 (git submodule 기반)
- [ ] 도메인 격리 필터링 (MCU/MPU/WPF 간 오염 방지)

### 2.2 Out of Scope

- L3 도메인 안전 규칙의 신규 구현 (기존 에이전트에 위임)
- Go, Rust, Java 등 추가 언어 리뷰어 (1.0.0으로 연기)
- 유료 라이선스 / 프리미엄 기능

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Phase | Status |
|----|-------------|----------|-------|--------|
| **--- Step 0: 기존 훅 버그 수정 (차단 이슈) ---** | | | | |
| FR-B01 | context-hierarchy.js getCommon()/core 미선언 버그 수정 | Must | v0.9.11-S0 | Pending |
| FR-B02 | PreToolUse Write 훅 호출 체인 정상화 (pre-write → permission-manager → context-hierarchy) | Must | v0.9.11-S0 | Pending |
| FR-B03 | metrics-collector.js unstaged 변경 내용 검토 및 정리 | Should | v0.9.11-S0 | Pending |
| **--- Step 1: refs 개선 (선행 작업, ECC 참고) ---** | | | | |
| FR-R01 | common.md 보안 체크리스트 추가 (시크릿, 인젝션, Path Traversal) | Must | v0.9.11-S1 | Pending |
| FR-R02 | common.md 심각도 분류 체계 추가 (CRITICAL/HIGH/MEDIUM/LOW → BLOCK/WARNING/APPROVE) | Must | v0.9.11-S1 | Pending |
| FR-R03 | common.md AI 생성 코드 감사 규칙 추가 | Should | v0.9.11-S1 | Pending |
| FR-R04 | cpp.md 보안 섹션 (정수 오버플로, 버퍼 오버플로, 초기화 안된 변수) + 동시성 안전 + sanitizer | Must | v0.9.11-S1 | Pending |
| FR-R05 | csharp.md Nullable Reference Types + 보안(BinaryFormatter, Path Traversal) + sealed/IOptions | Must | v0.9.11-S1 | Pending |
| FR-R06 | python.md 보안 섹션 (SQL/셸 인젝션, pickle) + 가변 기본 인자 + logging > print | Must | v0.9.11-S1 | Pending |
| FR-R07 | pre-guide.js COMPACT_RULES 업데이트 (보안/심각도 반영) | Must | v0.9.11-S1 | Pending |
| **--- L1 범용 설계 품질 ---** | | | | |
| FR-001 | code-analyzer 리팩터링: SOLID, 복잡도, DRY, 함수 크기, 에러 처리 + 심각도 분류 | Must | v0.9.11-S2 | Pending |
| FR-002 | 네이밍/가독성 리뷰: 네이밍 컨벤션, 매직 넘버, 주석 품질 | Must | v0.9.11-S2 | Pending |
| FR-003 | 중복/추상화 분석: 코드 중복 감지, 관심사 분리 평가 | Must | v0.9.11-S2 | Pending |
| FR-008 | 통합 리뷰 리포트: L1 단일 마크다운 출력 (심각도 기반 정렬) | Must | v0.9.11-S2 | Pending |
| **--- L2 언어별 숙어 ---** | | | | |
| FR-004 | C/C++ 숙어 리뷰어: RAII, const correctness, smart ptr, 보안, 동시성 (개선된 cpp.md imports) | Must | v0.9.12 | Pending |
| FR-005 | C# 숙어 리뷰어: async/await, nullable, IDisposable, LINQ (개선된 csharp.md imports) | Must | v0.9.12 | Pending |
| FR-006 | Python 숙어 리뷰어: 타입힌트, context manager, dataclass (개선된 python.md imports) | Should | v0.9.12 | Pending |
| FR-007 | 도메인 리뷰 오케스트레이션: `--domain` 옵션으로 L3 위임 | Should | v0.9.12 | Pending |
| FR-009 | PDCA Quality Gate 연동: gate-manager.js 통합 | Should | v0.9.12 | Pending |
| FR-010 | 인스팅트 데이터 수집: 리뷰 결과 + 교정 패턴 자동 저장 | Should | v0.9.13 | Pending |
| FR-011 | 인스팅트 프로파일 로드: 세션 시작 시 자동 로드 | Should | v0.9.13 | Pending |
| FR-012 | 인스팅트 학습 수렴: 3세션 수렴 + 신뢰도 점수 | Should | v0.9.13 | Pending |
| FR-013 | 크로스 프로젝트 패턴 승격: 도메인 동일 3+ 프로젝트 기준 | Should | v0.9.14 | Pending |
| FR-014 | 팀 인스팅트 공유: git submodule 기반 팀 공유 저장소 | Should | v0.9.14 | Pending |
| FR-015 | 리뷰 우선순위 자동화: 변경 영향도 기반 정렬 | Could | v0.9.14 | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | L1+L2 리뷰 응답 시간 < 30초 (100줄 기준) | 벤치마크 측정 |
| Performance | 인스팅트 로드 시간 < 1초 | SessionStart 훅 타이밍 |
| Accuracy | L1 리뷰 false positive < 10% | 20파일 기준 수동 검증 |
| Accuracy | L2 언어 숙어 탐지 정확도 > 85% | 언어별 테스트 케이스 |
| Storage | 인스팅트 프로파일 크기 < 50KB/프로젝트 | 파일 크기 모니터링 |
| Compatibility | metrics-collector.js 기존 API 호환 | 기존 테스트 통과 |

---

## 4. Success Criteria

### 4.1 Definition of Done

**Phase 1-Step 0 (v0.9.11, 훅 버그 수정)**:
- [ ] `context-hierarchy.js` getCommon()/core 버그 수정 완료
- [ ] `pre-write.js` 에러 없이 실행 확인 (모든 코드 확장자)
- [ ] 기존 PostToolUse Edit 훅(code-quality-hook.js) 동작 미파괴 확인

**Phase 1-Step 1 (v0.9.11, refs 개선)**:
- [ ] common.md에 보안 체크리스트 + 심각도 분류 + AI 감사 규칙 추가 완료
- [ ] cpp.md에 보안 + 동시성 + sanitizer 규칙 추가 완료
- [ ] csharp.md에 nullable + 보안 + sealed/IOptions 추가 완료
- [ ] python.md에 보안 + 가변 기본 인자 + logging 규칙 추가 완료
- [ ] pre-guide.js COMPACT_RULES 업데이트 완료
- [ ] 기존 rkit-rules, pdca 스킬의 동작 미파괴 확인 (회귀 테스트)

**Phase 1-Step 2 (v0.9.11, L1 리팩터링)**:
- [ ] `code-analyzer` 에이전트 프로덕션 레벨 리팩터링 완료
- [ ] SQ 규칙 SOLID 기반 재편, 임계값 통일
- [ ] 심각도 분류 체계 적용 (CRITICAL → BLOCK 매핑)
- [ ] `/code-review` 스킬에서 L1 자동 실행
- [ ] 통합 리포트 마크다운 포맷 확정 (심각도 기반 정렬)
- [ ] metrics-collector.js 정량 데이터 연동
- [ ] 스킬 평가(eval) 3개 이상 작성 및 통과

**Phase 2 (v0.9.12)**:
- [ ] C/C++, C#, Python 숙어 리뷰어 에이전트 각각 구현
- [ ] 언어 자동 감지 → 해당 L2 리뷰어 활성화
- [ ] `--domain` 옵션으로 L3 기존 에이전트 호출
- [ ] PDCA quality gate 연동 확인

**Phase 3 (v0.9.13)**:
- [ ] 인스팅트 수집/저장/로드 파이프라인 구현
- [ ] 신뢰도 점수 알고리즘 구현
- [ ] 3세션 수렴 파일럿 테스트 통과
- [ ] 데이터 구조에 크로스 프로젝트/팀 공유 확장점 포함

**Phase 4 (v0.9.14)**:
- [ ] 크로스 프로젝트 패턴 승격 구현
- [ ] 팀 인스팅트 공유 저장소 구현
- [ ] 도메인 격리 필터링 검증

### 4.2 Quality Criteria

- [ ] refs 개선 후 기존 rkit-rules, pdca 스킬 동작 미파괴 (pre-guide.js COMPACT_RULES 포함)
- [ ] 기존 code-review 스킬 하위 호환성 유지
- [ ] 기존 에이전트(code-analyzer, safety-auditor) 동작 미영향
- [ ] L1 리뷰 false positive < 10%
- [ ] L2 리뷰 false positive < 15%
- [ ] 인스팅트 저장소 무결성 (JSON 스키마 검증)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| context-hierarchy.js 버그로 PreToolUse Write 훅 전체 실패 중 | **Critical** | **확인됨** | Step 0에서 최우선 수정. getCommon() lazy require 복구 + core → getPlatform() 연결 |
| refs 개선 시 pre-guide.js COMPACT_RULES 깨짐 | High | Medium | refs 수정 → COMPACT_RULES 즉시 업데이트 → rkit-rules 동작 검증을 하나의 원자적 작업으로 |
| refs 보안 규칙 추가 시 기존 리뷰 결과 변화 | Medium | Medium | 보안 규칙은 새 섹션으로 추가 (기존 섹션 수정 X). 기존 SQ 규칙 동작에 영향 없음 확인 |
| L2 언어 숙어 리뷰어의 false positive 과다 | High | Medium | 언어별 20파일 검증 후 규칙 조정, 신뢰도 임계값 설정 |
| 인스팅트 학습 수렴이 예상보다 느림 | Medium | Medium | 초기에는 rule-based fallback 제공, 3세션→5세션 유연 조정 |
| L1+L2 리뷰 응답 시간 초과 (>30초) | Medium | Low | 병렬 실행 구조, diff 기반 증분 리뷰, 캐싱 |
| code-analyzer 리팩터링 시 기존 동작 파괴 | Medium | Medium | 리팩터링 전 기존 SQ-001~008 동작을 테스트로 고정, 점진적 변경 |
| Claude API 토큰 비용 증가 | Low | Medium | diff 기반 증분 리뷰, 캐싱 전략 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | |
| **Dynamic** | Feature-based modules, BaaS | Web apps, SaaS | |
| **Enterprise** | Strict layer separation, DI | High-traffic systems | |

> **해당 없음**: rkit은 Claude Code 플러그인 프로젝트. 웹 앱이 아닌 도구 개발.

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| L1 구현 방식 | (A) 신규 에이전트 (B) code-analyzer 리팩터링 | **(B) 리팩터링** | 기존 SQ-001~008과 60% 중복. 프로덕션 레벨 품질 강화와 동시에 L1 역할 부여 |
| L1 정량 데이터 소스 | (A) LLM only (B) metrics-collector.js + LLM | **(B) 하이브리드** | 정량(복잡도, 함수 크기)은 JS로 측정, 정성(SOLID, DRY)은 LLM이 판단 |
| L2 언어 감지 | (A) 파일 확장자 (B) domain/detector.js (C) 새 감지기 | **(A) 파일 확장자** | L2는 도메인이 아닌 언어 기반. .c/.cpp/.h → C/C++, .cs → C#, .py → Python |
| L3 위임 방식 | (A) 자동 (B) opt-in (`--domain`) | **(B) opt-in** | 기본은 L1+L2만. 도메인 안전은 사용자가 명시적으로 요청 시에만 |
| 인스팅트 저장소 | (A) memory.json 확장 (B) 독립 디렉토리 | **(B) 독립** | `.rkit/instinct/{project-hash}/` - 기존 memory.json과 분리 |
| 인스팅트 식별자 | (A) git remote URL (B) 디렉토리 경로 해시 | **(A) git remote URL** | ECC 방식과 동일. remote가 없으면 경로 해시로 fallback |

### 6.3 3-Layer 아키텍처

```
/code-review 실행 흐름:

[사용자] → /code-review [파일/디렉토리]
    │
    ├── [1] 파일 확장자 감지 → 대상 언어 판별
    │
    ├── [2] L1: code-analyzer 에이전트 (리팩터링됨)
    │   ├── metrics-collector.js → 정량 데이터 (복잡도, 함수 크기)
    │   └── LLM 분석 → 정성 판단 (SOLID, DRY, 네이밍)
    │
    ├── [3] L2: 언어별 숙어 리뷰어 (파일 확장자 기반 자동 선택)
    │   ├── .c/.cpp/.h → c-cpp-reviewer
    │   ├── .cs → csharp-reviewer
    │   └── .py → python-reviewer
    │
    ├── [4] 결과 병합 → 통합 리포트 (L1 + L2)
    │
    └── [5] --domain 옵션 시 L3 추가:
        ├── MCU 감지 → safety-auditor + mcu-critical-analyzer
        ├── MPU 감지 → linux-bsp-expert
        └── WPF 감지 → wpf-architect
```

### 6.4 신규 파일 구조

```
rkit/
├── agents/
│   ├── code-analyzer.md           (MODIFY - L1 프로덕션 레벨 리팩터링)
│   ├── c-cpp-reviewer.md          (NEW - L2 C/C++ 숙어)
│   ├── csharp-reviewer.md         (NEW - L2 C# 숙어)
│   └── python-reviewer.md         (NEW - L2 Python 숙어)
│
├── lib/
│   ├── code-quality/
│   │   ├── metrics-collector.js   (EXISTING - 정량 데이터)
│   │   ├── design-rules.js        (NEW - L1 SOLID/DRY 규칙 모듈 분리)
│   │   └── review-orchestrator.js (NEW - L1+L2+L3 오케스트레이션)
│   │
│   └── instinct/                  (NEW - Phase 3, v0.9.13)
│       ├── collector.js           (패턴 수집)
│       ├── store.js               (저장소 관리, 크로스 프로젝트 확장점 포함)
│       ├── loader.js              (세션 시작 시 로드)
│       └── confidence.js          (신뢰도 점수 알고리즘)
│
├── skills/
│   └── code-review/
│       └── SKILL.md               (MODIFY - L1+L2+L3 오케스트레이션)
│
├── refs/
│   └── code-quality/
│       ├── common.md              (MODIFY - 보안 체크리스트 + 심각도 분류 + AI 감사 추가)
│       ├── architecture-patterns.md (EXISTING - M11 아키텍처 준수 평가)
│       ├── cpp.md                 (MODIFY - 보안 + 동시성 + sanitizer 추가)
│       ├── csharp.md              (MODIFY - nullable + 보안 + sealed/IOptions 추가)
│       ├── python.md              (MODIFY - 보안 + 가변인자 + logging 추가)
│       └── typescript.md          (EXISTING - TypeScript 규칙)
│       ※ 신규 파일 불필요 — 기존 참조 문서가 L1+L2 규칙을 이미 충분히 커버
│
└── .rkit/
    └── instinct/                  (NEW - Phase 3, 런타임 데이터)
        ├── {project-hash}/
        │   ├── patterns.json      (학습된 패턴)
        │   └── confidence.json    (신뢰도 점수)
        └── global/                (크로스 프로젝트 승격, v0.9.14)
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` has coding conventions section
- [x] `rkit.config.json` exists with domain-specific rules
- [x] ESLint configuration via hooks
- [ ] L1 설계 품질 규칙 정의 → **본 feature에서 신규 작성**
- [ ] L2 언어별 숙어 규칙 정의 → **본 feature에서 신규 작성**

### 7.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **보안 체크리스트** | **missing** (전 언어 부재) | common.md + 각 언어별 보안 섹션 | **P0 필수** |
| **심각도 분류 체계** | **missing** | CRITICAL/HIGH/MEDIUM/LOW → BLOCK/WARNING/APPROVE | **P0 필수** |
| **L1 SOLID 규칙** | partial (common.md OOP 섹션) | SRP, OCP, DIP 검증 기준 강화 | High |
| **L1 복잡도 임계값** | exists (metrics-collector) | cyclomatic > 10 경고, > 20 에러 통일 | High |
| **L1 함수 크기** | exists (metrics-collector) | > 50줄 경고, > 100줄 에러 통일 | High |
| **L2 C++ 보안+동시성** | **missing** (cpp.md에 보안/동시성 없음) | 정수 오버플로, 데이터 레이스, sanitizer | **P0 필수** |
| **L2 C# nullable+보안** | **missing** (csharp.md에 nullable 미언급) | #nullable enable, BinaryFormatter 금지 | **P0 필수** |
| **L2 Python 보안** | **missing** (python.md에 보안 없음) | SQL/셸 인젝션, pickle, 가변 인자 | **P0 필수** |
| **L2 숙어 규칙** | **exists** (각 언어 .md) | 보안 추가 후 기존 숙어는 그대로 활용 | 검증만 |
| **인스팅트 스키마** | missing | patterns.json, confidence.json 스키마 | Medium |

### 7.3 Configuration (rkit.config.json 확장)

```json
{
  "codeReview": {
    "layers": {
      "L1": {
        "enabled": true,
        "complexityThreshold": { "warn": 10, "error": 20 },
        "functionSizeThreshold": { "warn": 50, "error": 100 },
        "parameterCountThreshold": { "warn": 5, "error": 8 }
      },
      "L2": {
        "enabled": true,
        "languages": ["c", "cpp", "csharp", "python"]
      },
      "L3": {
        "enabled": false,
        "note": "opt-in via --domain flag"
      }
    }
  },
  "instinct": {
    "enabled": false,
    "convergenceThreshold": 3,
    "confidenceMin": 0.3,
    "maxPatternsPerProject": 100,
    "storagePath": ".rkit/instinct/"
  }
}
```

---

## 8. Next Steps

1. [ ] Design 문서 작성 (`/pdca design ecc-insights-integration`)
2. [ ] **refs 개선 상세 설계** (어떤 섹션을 어떤 위치에 추가할지, ECC 규칙 중 채택 목록 확정)
3. [ ] **pre-guide.js 영향 분석** (COMPACT_RULES 업데이트 범위 확정)
4. [ ] `code-analyzer` 리팩터링 설계 (기존 SQ 규칙 → SOLID 기반 재편 + 심각도 분류)
5. [ ] L1 규칙 모듈 설계 (`lib/code-quality/design-rules.js`)
6. [ ] L2 에이전트 → 개선된 `refs/code-quality/{cpp,csharp,python}.md` imports 연결 설계
7. [ ] 기존 `code-review` 스킬 → 3-Layer 오케스트레이션 확장 설계
8. [ ] 인스팅트 저장소 JSON 스키마 정의 (**크로스 프로젝트/팀 공유 확장점 포함**)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-09 | PRD 기반 초안 작성. 3-Layer 아키텍처, FR-001~014, 릴리즈 로드맵 | 노수장 |
| 0.2 | 2026-04-09 | 리뷰 피드백 반영: L1은 code-analyzer 리팩터링, 버전 0.9.x→1.0.0 통일, 크로스 프로젝트+팀 공유 통합(v0.9.14), 인스팅트 데이터 설계 시점을 Design에서 미리 진행. FR-013~015 추가 | 노수장 |
| 0.3 | 2026-04-09 | refs 개선 선행 작업 추가: ECC 대비 보안 규칙 전무 발견, FR-R01~R07 신규, Phase 1을 Step 1+2로 분리, 리스크 2건 추가 | 노수장 |
| 0.4 | 2026-04-09 | 기존 훅 버그 발견 및 Step 0 추가: context-hierarchy.js `core is not defined` 에러 (c389514 커밋에서 common.js bridge 제거 시 lazy require 누락). PreToolUse Write 훅 전체 실패 상태. FR-B01~B03 추가, 확인된 리스크 1건 추가 | 노수장 |
