# cpp-reference-patterns Planning Document

> **Summary**: C++ 레퍼런스 레포 핵심 패턴을 cpp.md에 사전 추출하여 에이전트가 Read만으로 실전 코드 스타일 학습
>
> **Project**: rkit
> **Version**: 0.8.0
> **Author**: soojang.roh
> **Date**: 2026-04-03
> **Status**: Draft
> **Method**: Plan Plus (Brainstorming-Enhanced PDCA)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | cpp.md에 레퍼런스 레포 URL만 나열되어 있어 에이전트가 실제 코드 패턴을 참고하지 않음. HARD-RULE로 ref를 Read해도 "fmtlib/fmt처럼 써라"가 아닌 "fmtlib/fmt가 있다"만 알게 됨 |
| **Solution** | 4개 레포(fmtlib/fmt, abseil, ModernCppStarter, nlohmann/json)에서 핵심 설계 패턴을 코드 스니펫+설계 의도로 추출하여 cpp.md에 직접 포함. ~150줄 추가 |
| **Function/UX Effect** | 에이전트가 C++ 코드 작성 전 cpp.md Read → 규칙 + 실전 레포 패턴이 한 번에 로드 → abseil 스타일 LogSink, fmtlib 스타일 API 확장을 자연스럽게 적용 |
| **Core Value** | "규칙을 알려줬으니 지켜라"에서 "이 레포가 이렇게 하니까 따라해"로 전환 — LLM에게는 구체적 코드가 추상적 원칙보다 100배 효과적 |

---

## 1. User Intent Discovery

### 1.1 Core Problem

에이전트가 C++ 코드를 작성할 때 레퍼런스 레포의 실제 설계 패턴을 참고하지 않음:
- cpp.md를 Read해도 URL 목록만 보이고 실제 코드 패턴은 없음
- WebFetch로 매번 GitHub에 접근하는 것은 비현실적 (속도, 비용)
- 결과적으로 규칙은 지키지만 실전 코드 스타일(fmtlib API 패턴, abseil 모듈 구조)은 적용 안 됨

### 1.2 Target Users

| User Type | Usage Context | Key Need |
|-----------|---------------|----------|
| rkit 플러그인 사용자 | C++ 코드 설계/작성 시 | 에이전트가 fmtlib/abseil 수준의 API 설계를 자동 적용 |

### 1.3 Success Criteria

- [ ] cpp.md Read만으로 4개 레포의 핵심 패턴이 컨텍스트에 로드된다
- [ ] 에이전트가 "Logger 클래스 설계" 같은 요청에 abseil LogSink 패턴을 자동 적용한다
- [ ] WebFetch 없이 레포 패턴을 참조할 수 있다

---

## 2. Alternatives Explored

### 2.1 Approach A: cpp.md에 직접 추가 — Selected

| Aspect | Details |
|--------|---------|
| **Pros** | 1파일 Read로 완결. 유지보수 단순 |
| **Cons** | cpp.md 250→~450줄 증가 |

### 2.2 Decision Rationale

**Selected**: A
**Reason**: 에이전트는 1파일을 Read하는 게 2파일보다 확실히 누락 없음. 컨텍스트 증가(~150줄)는 허용 범위.

---

## 3. YAGNI Review

### 3.1 Included (v1)

- [x] fmtlib/fmt: format_as() ADL, formatter<T> 특수화, 컴파일타임 검증
- [x] abseil: StatusOr<T>, LogSink 추상화, LogEntry 구조화, 모듈 구조
- [x] ModernCppStarter: CMake target-scoped, include/src/test 분리, CPM.cmake
- [x] nlohmann/json: to_json/from_json ADL, detail/ 모듈러 구조

### 3.2 Deferred

| Feature | Revisit When |
|---------|-------------|
| cpp-best-practices/gui_starter_template | v2 (다른 4개로 충분) |
| 자동 레포 업데이트 | 레포 메이저 릴리즈 시 수동 업데이트 |

---

## 4. Scope

### 4.1 In Scope

- [x] refs/code-quality/cpp.md의 `Reference Repos` 섹션을 `Reference Repo Patterns` 섹션으로 교체
- [x] 4개 레포에서 핵심 패턴 추출 (WebFetch로 실제 코드 확인)
- [x] 각 패턴에 코드 스니펫 + 설계 의도 + "이렇게 적용하라" 지시 포함
- [x] rkit-rules HARD-RULE 문구 보강 (레포 패턴도 적용하라는 지시 명시)

### 4.2 Out of Scope

- 다른 언어 (C#/TS/Python) ref 패턴 추출 — 별도 feature
- 레포 자동 동기화 시스템

---

## 5. Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | fmtlib/fmt에서 API 확장 패턴 3개 이상 추출 (코드 스니펫 포함) | High |
| FR-02 | abseil에서 에러 처리 + 모듈 구조 + 로깅 패턴 추출 | High |
| FR-03 | ModernCppStarter에서 프로젝트 구조 + CMake 패턴 추출 | High |
| FR-04 | nlohmann/json에서 타입 확장 + 내부 구조 패턴 추출 | High |
| FR-05 | rkit-rules HARD-RULE에 "레포 패턴도 적용" 지시 추가 | Medium |
| FR-06 | cpp.md 총 라인 수 450줄 이내 유지 | Medium |

---

## 6. Implementation Approach

1. 4개 레포의 핵심 소스를 WebFetch로 실제 확인
2. 각 레포에서 3-5개 핵심 패턴 추출 (코드 + 설계 의도)
3. cpp.md의 Reference Repos 섹션 교체
4. rkit-rules HARD-RULE 문구 보강
5. 커밋 + push + marketplace 동기화

---

## Appendix: Brainstorming Log

| Phase | Question | Answer | Decision |
|-------|----------|--------|----------|
| Intent | 범위? | 4개 레포 전부 + 디자인 패턴 | 포괄적 추출 |
| Alternatives | 구조? | A:cpp.md 직접 / B:별도 파일 | A — 1파일 완결 |
| YAGNI | 레포 수? | 4개 (gui_starter 제외) | 충분한 커버리지 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-03 | Initial draft (Plan Plus) | soojang.roh |
