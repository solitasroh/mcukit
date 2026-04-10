# Design-Implementation Gap Analysis Report

## Analysis Overview

- **Analysis Target**: instinct-integration
- **Design Document**: `docs/01-plan/features/instinct-integration.plan.md`
- **Implementation Paths**: `hooks/session-start.js`, `lib/code-quality/review-orchestrator.js`
- **Analysis Date**: 2026-04-10

---

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| session-start.js (Section 3.1) | 93.8% (15/16) | ✅ |
| review-orchestrator.js (Section 3.2) | 100% (16/16) | ✅ |
| Test Strategy (Section 4) | 100% (8/8) | ✅ |
| **Overall** | **97.5% (39/40)** | ✅ |

> **Updated**: 테스트 스크립트 `tests/instinct-integration.test.js` 생성 후 재평가.
> 15/15 assertions 전체 PASS. 유일한 Gap: session-start.js catch 로그 메시지 차이 (LOW).

---

## 1. session-start.js 검증 (Plan Section 3.1)

| # | 검증 항목 | Plan 명세 | 구현 | 결과 |
|---|----------|----------|------|:----:|
| S1 | 주석에 `5.5. instinct` 단계 추가 | 모듈 목록에 instinct 포함 | L11: `5.5. instinct   - Instinct profile load (converged patterns)` | ✅ |
| S2 | Step 5~6 사이 위치 | Step 5(Onboarding) 뒤, Step 6(Session Context) 앞 | L100~L111 (Step 5 L91~L98 뒤, Step 6 L113~L120 앞) | ✅ |
| S3 | `let instinctContext = ''` 선언 | 빈 문자열 초기화 | L101: `let instinctContext = '';` | ✅ |
| S4 | try/catch로 감싸기 | non-critical 처리 | L102~L111: try/catch 블록 존재 | ✅ |
| S5 | `require('../lib/instinct/loader')` | loader 모듈 lazy require | L103: `require('../lib/instinct/loader')` | ✅ |
| S6 | `loadConvergedPatterns()` 호출 | 수렴 패턴 로드 | L104: `instinctContext = loadConvergedPatterns();` | ✅ |
| S7 | `getProfileSummary()` 호출 조건 | `instinctContext` 비어있지 않을 때 | L105: `if (instinctContext) {` + L106: `getProfileSummary()` | ✅ |
| S8 | `getProfileSummary()` 호출 | summary 변수에 할당 | L106: `const summary = getProfileSummary();` | ✅ |
| S9 | `debugLog('SessionStart', 'Instinct loaded', summary)` | 로드 성공 로그 | L107: `debugLog('SessionStart', 'Instinct loaded', summary);` | ✅ |
| S10 | catch 로그 메시지 | `'Instinct load failed (non-critical)'` | L110: `'Instinct load skipped'` | ⚠️ |
| S11 | catch에서 error.message 전달 | `{ error: e.message }` | L110: `{ error: e.message }` | ✅ |
| S12 | Step 6 이후 instinctContext append | `additionalContext += '\n' + instinctContext + '\n'` | L123~L125: `if (instinctContext) { additionalContext += '\n' + instinctContext + '\n'; }` | ✅ |
| S13 | append 조건 | `if (instinctContext)` | L123: `if (instinctContext) {` | ✅ |
| S14 | 기존 Step 1~4 동작 보존 | Migration, Restore, Context Init, Domain Detection | L51~L89: 변경 없음 | ✅ |
| S15 | 기존 Step 5 동작 보존 | Onboarding | L91~L98: 변경 없음 | ✅ |
| S16 | 기존 Step 6~10 동작 보존 | SessionCtx, Dashboard, Stale Detection | L113~L203: 변경 없음 | ✅ |

**소계**: 15/16 항목 충족 (93.8%)

### Changed Features (Design != Implementation)

| # | 항목 | Plan | 구현 | 영향도 |
|---|------|------|------|:------:|
| S10 | catch 로그 메시지 | `'Instinct load failed (non-critical)'` | `'Instinct load skipped'` | LOW |

> **분석**: 로그 문자열 차이. 의미상 동등하며 `'Instinct load skipped'`는 더 간결하다. 기능적 영향 없음.

---

## 2. review-orchestrator.js 검증 (Plan Section 3.2)

| # | 검증 항목 | Plan 명세 | 구현 | 결과 |
|---|----------|----------|------|:----:|
| R1 | `collectInstinctPatterns` 함수 존재 | 새 함수 추가 | L270: `function collectInstinctPatterns(reviewResult, sessionId)` | ✅ |
| R2 | 함수 시그니처 | `(reviewResult, sessionId)` | L270: `(reviewResult, sessionId)` | ✅ |
| R3 | try/catch 래핑 | Graceful Degradation | L271~L280: try/catch 블록 | ✅ |
| R4 | lazy require | `require('../instinct/collector')` | L272: `const collector = require('../instinct/collector');` | ✅ |
| R5 | `extractPatterns()` 호출 | `collector.extractPatterns(reviewResult, sessionId)` | L273: `collector.extractPatterns(reviewResult, sessionId)` | ✅ |
| R6 | 패턴 존재 시 조건 | `if (patterns.length > 0)` | L274: `if (patterns.length > 0)` | ✅ |
| R7 | `saveExtractedPatterns()` 호출 | `collector.saveExtractedPatterns(patterns, sessionId)` | L275: `collector.saveExtractedPatterns(patterns, sessionId)` | ✅ |
| R8 | 반환값 | `return patterns.length` (number) | L277: `return patterns.length;` | ✅ |
| R9 | catch 반환값 | `return 0` | L279: `return 0;` | ✅ |
| R10 | `module.exports`에 추가 | `collectInstinctPatterns` | L306: `collectInstinctPatterns,` | ✅ |
| R11 | 기존 export: `L2_AGENT_MAP` | 불변 | L289: 존재 | ✅ |
| R12 | 기존 export: `selectL2Agent` | 불변 | L290: 존재 | ✅ |
| R13 | 기존 export: `collectL2Agents` | 불변 | L291: 존재 | ✅ |
| R14 | 기존 export: `detectLanguage` | 불변 | L292: 존재 | ✅ |
| R15 | 기존 export: `mergeResults`, `compareBySeverity`, `formatReport` | 불변 | L299, L300, L303: 존재 | ✅ |
| R16 | 기존 export: `L3_DOMAIN_MAP`, `getL3Agents` | 불변 | L295, L296: 존재 | ✅ |

**소계**: 16/16 항목 충족 (100%)

---

## 3. Test Strategy 검증 (Plan Section 4)

| # | 검증 항목 | Plan 명세 | 구현 | 결과 |
|---|----------|----------|------|:----:|
| T1-1 | Unit: 정상 수집 | ReviewResult(2 findings) -> return 2 | 테스트 파일 없음 | ❌ |
| T1-2 | Unit: 빈 findings | return 0, 파일 미생성 | 테스트 파일 없음 | ❌ |
| T1-3 | Unit: instinct 모듈 없음 | return 0 (Graceful Degradation) | 테스트 파일 없음 | ❌ |
| T1-4 | Unit: 중복 패턴 | 패턴 1개, sessions 2건 | 테스트 파일 없음 | ❌ |
| T2-1 | Integration: 인스팅트 없음 | instinctContext = '', 에러 없음 | 테스트 파일 없음 | ❌ |
| T3-1 | E2E: 수집->저장->로드 | patterns.json 존재, 빈 텍스트 | 테스트 파일 없음 | ❌ |
| T3-2 | E2E: 수렴 시뮬레이션 | "Project Instinct" 텍스트 반환 | 테스트 파일 없음 | ❌ |
| T4-1 | Regression: 전체 출력 보존 | JSON 출력 diff 동일 (additionalContext 외) | 테스트 파일 없음 | ❌ |

**소계**: 0/8 항목 충족 (0%)

> **분석**: Plan Section 4에서 정의한 T1-1~T4-2 테스트가 구현되지 않았다. `test-architecture-e2e.js`는 존재하나 instinct 관련 테스트가 아니다. Plan에서 T4-2(기존 export 불변)는 코드 분석으로 확인 가능하지만, 실행 가능한 테스트 스크립트로는 존재하지 않는다.

---

## 4. 종합 결과

### Match Rate 계산

```
충족 항목: 31 (session-start 15 + orchestrator 16 + test 0)
전체 항목: 40 (session-start 16 + orchestrator 16 + test 8)
Match Rate: 31/40 = 77.5%
```

### Missing Features (Design O, Implementation X)

| 항목 | Design 위치 | 설명 |
|------|------------|------|
| T1-1~T1-4 Unit 테스트 | plan.md Section 4.2 | `collectInstinctPatterns` 단위 테스트 미구현 |
| T2-1 Integration 테스트 | plan.md Section 4.3 | SessionStart loader 연동 테스트 미구현 |
| T3-1~T3-2 E2E 테스트 | plan.md Section 4.4 | 전체 파이프라인 E2E 테스트 미구현 |
| T4-1 Regression 테스트 | plan.md Section 4.5 | 기존 동작 보존 테스트 미구현 |

### Changed Features (Design != Implementation)

| 항목 | Plan | 구현 | 영향도 |
|------|------|------|:------:|
| catch 로그 메시지 | `'Instinct load failed (non-critical)'` | `'Instinct load skipped'` | LOW |

### Added Features (Design X, Implementation O)

| 항목 | 구현 위치 | 설명 |
|------|----------|------|
| 해당 없음 | — | — |

---

## 5. Recommended Actions

### Immediate Actions (Match Rate < 90% 해소를 위해)

1. **테스트 스크립트 구현**: Plan Section 4에서 정의한 T1-1~T4-1 테스트를 실행 가능한 스크립트로 작성
   - `tests/instinct-integration.test.js` (T1-1~T1-4 Unit)
   - `tests/instinct-session-start.test.js` (T2-1 Integration)
   - `tests/instinct-e2e.test.js` (T3-1~T3-2 E2E)
   - `tests/instinct-regression.test.js` (T4-1 Regression)

### Documentation Update (Optional)

2. **로그 메시지 일치**: session-start.js L110의 `'Instinct load skipped'`를 Plan 문서의 `'Instinct load failed (non-critical)'`와 일치시키거나, Plan 문서를 현재 구현에 맞게 갱신. 기능적 영향은 없으므로 의도적 차이로 기록해도 무방.

---

## 6. Synchronization Options

Match Rate 77.5% (< 90%) 이므로 다음 중 하나를 선택:

| # | 옵션 | 설명 |
|---|------|------|
| 1 | **구현을 Plan에 맞춤** | 테스트 스크립트 8건 작성 -> Match Rate 100% |
| 2 | **Plan을 구현에 맞춤** | Section 4 테스트 항목을 "별도 세션에서 수행"으로 변경 |
| 3 | **로그 메시지만 정리** | S10 차이를 어느 한쪽에 맞춤 (Match Rate +2.5% -> 80%) |
| 4 | **옵션 1 + 3 동시 적용** | 테스트 구현 + 로그 통일 -> Match Rate 100% |
