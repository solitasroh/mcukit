# instinct-integration Planning Document

> **Summary**: 인스팅트 엔진을 기존 시스템에 연동 — review-orchestrator 수집 + SessionStart 로드
>
> **Project**: rkit
> **Version**: v0.9.13 (통합 패치)
> **Author**: 노수장
> **Date**: 2026-04-10
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 인스팅트 4개 모듈(confidence, store, collector, loader)은 완성되었지만 기존 시스템과 연결되지 않아 실제로 동작하지 않는다 |
| **Solution** | review-orchestrator.js에 collector 연동(리뷰 후 자동 수집) + session-start.js에 loader 연동(세션 시작 시 수렴 패턴 자동 주입) |
| **Function/UX Effect** | `/code-review` 실행 후 패턴이 자동 축적되고, 다음 세션 시작 시 "Project Instinct" 섹션이 컨텍스트에 나타남 |
| **Core Value** | v0.9.13 인스팅트 엔진의 가치를 실현하는 "마지막 1마일" 연결 |

---

## 1. Overview

### 1.1 Purpose

v0.9.13에서 구현한 인스팅트 4개 모듈을 기존 rkit 파이프라인에 연결한다. 이 작업 없이는 인스팅트 엔진이 호출되지 않는다.

### 1.2 연결 포인트

```
/code-review 실행
    ↓
review-orchestrator.js (기존)
    ↓ mergeResults() 후
collector.saveExtractedPatterns()  ← [NEW] 연동 1
    ↓
다음 세션 시작
    ↓
session-start.js (기존)
    ↓ Step 6 (Session Context) 전
loader.loadConvergedPatterns()     ← [NEW] 연동 2
    ↓ additionalContext에 주입
```

---

## 2. Scope

### 2.1 In Scope

| # | 작업 | 대상 파일 | 유형 | 설명 |
|---|------|----------|------|------|
| 1 | SessionStart에 loader 연동 | `hooks/session-start.js` | MODIFY | Step 5~6 사이에 인스팅트 로드 단계 추가 |
| 2 | orchestrator에 수집 함수 추가 | `lib/code-quality/review-orchestrator.js` | MODIFY | `collectInstinctPatterns()` export 추가 |
| 3 | session-start description 업데이트 | `hooks/session-start.js` | MODIFY | 주석의 모듈 목록에 instinct 추가 |

### 2.2 Out of Scope

- collector.js / store.js / confidence.js / loader.js 자체 수정 (이미 완성)
- /code-review 스킬 SKILL.md 수정 (에이전트가 orchestrator를 직접 호출하므로 불필요)
- 인스팅트 비활성화 토글 (Graceful Degradation으로 충분, 별도 설정 불필요)

---

## 3. Implementation Details

### 3.1 session-start.js 수정

Step 5(Onboarding)와 Step 6(Session Context) 사이에 새 단계 추가:

```javascript
// --- 5.5. Instinct Profile Load ---
let instinctContext = '';
try {
  const { loadConvergedPatterns, getProfileSummary } = require('../lib/instinct/loader');
  instinctContext = loadConvergedPatterns();
  if (instinctContext) {
    const summary = getProfileSummary();
    debugLog('SessionStart', 'Instinct loaded', summary);
  }
} catch (e) {
  debugLog('SessionStart', 'Instinct load failed (non-critical)', { error: e.message });
}
```

그리고 Step 6에서 `additionalContext`에 append:

```javascript
if (instinctContext) {
  additionalContext += '\n' + instinctContext + '\n';
}
```

### 3.2 review-orchestrator.js 수정

`collectInstinctPatterns()` 함수를 추가하여 리뷰 후 패턴 수집을 호출할 수 있게 한다:

```javascript
function collectInstinctPatterns(reviewResult, sessionId) {
  try {
    const collector = require('../instinct/collector');
    const patterns = collector.extractPatterns(reviewResult, sessionId);
    if (patterns.length > 0) {
      collector.saveExtractedPatterns(patterns, sessionId);
    }
    return patterns.length;
  } catch {
    return 0; // Graceful degradation
  }
}
```

exports에 추가: `collectInstinctPatterns`

---

## 4. Test Strategy

### 4.1 테스트 방법론

**Isolation-First 접근**: 각 연동 포인트를 독립적으로 검증한 후 E2E로 통합 확인한다.

```
T1 (Unit)        → 개별 함수 호출 + 반환값 검증
T2 (Integration) → 파일 I/O 포함한 연동 흐름 검증
T3 (E2E)         → session-start.js 전체 실행 + 출력 JSON 검증
T4 (Regression)  → 기존 동작 보존 확인
```

### 4.2 Unit Test: collectInstinctPatterns

| ID | 시나리오 | 입력 | 기대 결과 |
|----|---------|------|-----------|
| T1-1 | 정상 수집 | ReviewResult(2 findings) | return 2, patterns.json 생성 |
| T1-2 | 빈 findings | ReviewResult(0 findings) | return 0, 파일 미생성 |
| T1-3 | instinct 모듈 없음 | require 실패 시뮬레이션 | return 0 (Graceful Degradation) |
| T1-4 | 중복 패턴 | 동일 finding 2회 호출 | 패턴 1개, sessions 2건 |

```javascript
// T1-1 검증 스크립트
const ro = require('./lib/code-quality/review-orchestrator');
const result = { target: 'test/', files: ['a.c'], findings: [
  { rule: 'SQ-001', file: 'a.c', line: 10, severity: 'HIGH', layer: 'L1', title: 'Long fn', fix: 'Split' }
]};
const count = ro.collectInstinctPatterns(result, 'test-session');
console.assert(count === 1, `Expected 1, got ${count}`);
```

### 4.3 Integration Test: SessionStart loader 연동

| ID | 시나리오 | 조건 | 기대 결과 |
|----|---------|------|-----------|
| T2-1 | 인스팅트 없음 (첫 실행) | `.rkit/instinct/` 없음 | instinctContext = '', 에러 없음 |
| T2-2 | 수렴 패턴 있음 | patterns.json + confidence.json 사전 배치 | instinctContext에 "Project Instinct" 포함 |
| T2-3 | JSON 손상 | patterns.json 에 `{invalid` | instinctContext = '', .bak 생성 |

```javascript
// T2-1 검증: 빈 상태에서 session-start.js 실행
// node hooks/session-start.js 의 JSON 출력에서 additionalContext 확인
// "Instinct load failed" 로그가 없어야 함 (빈 store는 정상)
```

### 4.4 E2E Test: 전체 파이프라인

| ID | 시나리오 | 절차 | 검증 |
|----|---------|------|------|
| T3-1 | 수집→저장→로드 | 1) collectInstinctPatterns 호출 2) .rkit/instinct/ 확인 3) loadConvergedPatterns 호출 | patterns.json에 패턴 존재, 아직 미수렴이므로 빈 텍스트 |
| T3-2 | 수렴 시뮬레이션 | confidence.json에 convergedAt 수동 설정 후 loadConvergedPatterns | "Project Instinct" 텍스트 반환 |

### 4.5 Regression Test: 기존 동작 보존

| ID | 검증 대상 | 방법 |
|----|----------|------|
| T4-1 | session-start.js 전체 출력 | 인스팅트 연동 전/후 JSON 출력 diff — `additionalContext` 외 필드 동일 |
| T4-2 | review-orchestrator 기존 export | `selectL2Agent`, `mergeResults`, `formatReport` 동작 불변 |
| T4-3 | hooks.json 타임아웃 | SessionStart 5000ms 이내 완료 (인스팅트 추가 < 50ms) |

### 4.6 검증 실행 계획

```
구현 완료 후:
1. node -e "..." 로 T1-1~T1-4 실행
2. node hooks/session-start.js 로 T2-1 실행 (JSON 출력 파싱)
3. 사전 데이터 배치 후 T2-2, T3-2 실행
4. git diff 로 T4-1~T4-2 확인
```

---

## 5. Success Criteria

| 기준 | 테스트 ID | 검증 방법 |
|------|----------|----------|
| SessionStart 시 인스팅트 로드 | T2-1, T2-2 | session-start.js 실행 후 instinctContext 확인 |
| 빈 store에서 에러 없음 | T2-1 | 인스팅트 파일 없을 때 정상 동작 |
| collectInstinctPatterns 동작 | T1-1, T1-4 | 패턴 추출 + 중복 처리 정상 |
| Graceful Degradation | T1-3, T2-3 | require 실패/JSON 손상 시 에러 없이 빈 값 반환 |
| 기존 동작 보존 | T4-1~T4-3 | 기존 export/출력/타임아웃 불변 |
| Gap Analysis >= 90% | — | Design vs Implementation 비교 |

---

## 6. Risks

| 리스크 | 영향 | 대응 | 관련 테스트 |
|--------|------|------|------------|
| session-start.js 타임아웃 증가 | 세션 시작 지연 | loader.js는 파일 1~2개 읽기, < 50ms | T4-3 |
| require 실패 | 인스팅트 미작동 | try/catch non-critical 처리 | T1-3 |
| JSON 손상 | 패턴 유실 | .bak 백업 후 빈 구조 반환 | T2-3 |
| 기존 훅 간섭 | 다른 단계 실패 | 독립 try/catch 블록, 기존 코드 미수정 | T4-1 |

---

## 7. Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-10 | 초안 작성 | 노수장 |
