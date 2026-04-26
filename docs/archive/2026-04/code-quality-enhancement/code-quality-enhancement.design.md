# code-quality-enhancement Design Document

> **Summary**: AI 코드 생성 품질 보장 — 규칙 강화 + PostToolUse 3-Stage 검증 + 메트릭 대시보드
>
> **Project**: rkit
> **Version**: 0.7.0
> **Author**: soojang.roh
> **Date**: 2026-04-03
> **Status**: Draft
> **Planning Doc**: [code-quality-enhancement.plan.md](../01-plan/features/code-quality-enhancement.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. 규칙 문서를 **LLM이 실제로 모방할 수 있는 수준**으로 강화 (Bad/Good 코드 쌍, 모던 관용구, 디자인 패턴 구현 예시)
2. **매 코드 작성 후 자동 검증**하는 PostToolUse 3-Stage 훅 구현
3. 코드 품질을 **정량적으로 추적**하는 메트릭 수집/대시보드

### 1.2 Design Principles

- **도메인 무관**: 임베디드/웹/데스크톱 어디서든 적용되는 순수 코드 구조 품질
- **구체성 우선**: 추상 원칙보다 실제 코드 예시가 LLM에게 효과적
- **기존 훅 통합**: unified-write-post.js 패턴 유지, 새 핸들러 추가
- **Graceful degradation**: 외부 도구(linter) 미설치 시 skip, Stage 2-3은 항상 동작

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  스킬/에이전트 호출 시 (pdca, code-review, plan-plus 등)     │
│                                                              │
│  imports로 로드 (Level 1 — 평탄화):                          │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ common.md  │ │ cpp.md   │ │csharp.md │  ← 코드 작성 가이드│
│  │(클린아키텍처│ │(Modern   │ │(Modern   │                   │
│  │ OOP/패턴)  │ │ C++17/20)│ │ C# 12)   │                   │
│  └────────────┘ └──────────┘ └──────────┘                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ LLM이 코드 작성
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  PostToolUse(Write|Edit) — 매 코드 수정 후 자동 실행         │
│                                                              │
│  unified-write-post.js → handleCodeQuality(input)           │
│                                                              │
│  ┌─ Stage 1: Linter (command) ──────────────────────┐       │
│  │  .c/.cpp → cppcheck --enable=style               │       │
│  │  .cs     → dotnet format --verify-no-changes      │       │
│  │  .ts/.js → npx eslint (or biome)                  │       │
│  │  .py     → ruff check                             │       │
│  │  미설치 → skip                                    │       │
│  └──────────────────────────────────────────────────┘       │
│                        ↓                                     │
│  ┌─ Stage 2: Structure Check (command) ─────────────┐       │
│  │  metrics-collector.js로 정량 분석:                 │       │
│  │  - 함수 길이 > 40줄 → 경고                        │       │
│  │  - 파라미터 > 3개 → 경고                          │       │
│  │  - 중첩 > 3단계 → 경고                            │       │
│  │  - 파일 > 300줄 → 경고                            │       │
│  │  위반 발견 시 stderr에 피드백 메시지 출력           │       │
│  └──────────────────────────────────────────────────┘       │
│                        ↓                                     │
│  ┌─ Stage 3: Metrics Storage (command) ─────────────┐       │
│  │  .rkit/state/code-quality-metrics.json 업데이트    │       │
│  │  파일별 최신 메트릭 기록                           │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

**Note**: Plan에서 Stage 2를 prompt handler로 설계했으나, 재검토 결과 **command handler로 변경**합니다.
- 이유: prompt handler는 매 Edit마다 LLM 호출 → 속도/비용 과다
- 대안: metrics-collector.js가 정량적 구조 검사를 수행 (함수 길이, 파라미터 수, 중첩 깊이 등)
- 의미론적 검토는 별도 `/code-review` 스킬로 분리 (사용자가 원할 때 실행)

### 2.2 Data Flow

```
코드 작성 (Write/Edit)
    ↓
PostToolUse hook 실행
    ├─→ Stage 1: linter 실행 → stderr 출력 (위반 목록)
    ├─→ Stage 2: metrics-collector → stderr 출력 (구조 위반)
    └─→ Stage 3: metrics 저장 → .rkit/state/code-quality-metrics.json
    ↓
Claude가 stderr 피드백 수신 → 자동 수정 결정
    ↓
/pdca status → 메트릭 대시보드 표시
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| code-quality-hook.js | lib/core/io, lib/core/debug | rkit 표준 I/O |
| code-quality-hook.js | lib/code-quality/metrics-collector.js | 구조 분석 |
| metrics-collector.js | fs, path | 파일 분석, JSON 저장 |
| unified-write-post.js | code-quality-hook.js | 기존 훅에 통합 |

---

## 3. Reference Documents Specification

### 3.1 refs/code-quality/common.md (신규, ~200줄)

범용 코드 구조 품질 가이드. 언어 무관.

**포함 내용:**

#### Section 1: Clean Architecture 실전 가이드
```
- 4-layer 구조: Presentation → Application → Domain → Infrastructure
- 레이어 판단 기준 테이블:
  | 코드 내용 | 레이어 | 왜? |
  |----------|--------|-----|
  | UI 렌더링, 입력 처리 | Presentation | 사용자 상호작용 |
  | 유스케이스 오케스트레이션 | Application | 비즈니스 흐름 |
  | 핵심 비즈니스 규칙 | Domain | 프레임워크 독립 |
  | DB, API, 파일 I/O | Infrastructure | 외부 세계 |
- 의존성 방향 위반 Bad/Good 예시
```

#### Section 2: OOP 원칙 실전 가이드
```
- 상속 vs 합성 판단 기준 (is-a vs has-a)
- 인터페이스 설계: 작은 인터페이스 여러 개 > 큰 인터페이스 하나 (ISP)
- 캡슐화 레벨: public 최소화, 구현 숨기기
- Bad/Good 예시 (최소 3쌍)
```

#### Section 3: 디자인 패턴 적용 판단
```
- 기존 SKILL.md의 Decision Table 확장
- 각 패턴별 "언제 쓰고 언제 쓰지 않는지" 명확화
- 핵심 패턴 5개의 다국어 구현 스켈레톤:
  Strategy, Factory, Observer, Builder, Adapter
```

#### Section 4: 코드 스멜 & 안티패턴
```
- God Object/Function: 하나의 클래스/함수가 너무 많은 일
- Feature Envy: 다른 클래스의 데이터를 과도하게 사용
- Primitive Obsession: 도메인 개념을 원시 타입으로 표현
- Shotgun Surgery: 하나의 변경이 여러 클래스 수정 유발
- 각각 Bad/Good 코드 쌍
```

#### Section 5: 추천 레퍼런스 레포
```
- 언어별 Clean Architecture 레포 URL + 핵심 파일 경로 안내
- "이 레포의 이 디렉토리 구조를 참고하라"
```

### 3.2 refs/code-quality/cpp.md (강화, ~250줄)

현재 130줄 → 250줄. 추가할 내용:

| 섹션 | 추가 내용 |
|------|----------|
| **모던 C++17/20 관용구** | structured bindings, `std::optional`, `if constexpr`, `std::format`, concepts, ranges, `std::span` — 각각 Bad(구식)/Good(모던) 쌍 |
| **프로젝트 구조** | src/include/tests/lib 분리, CMakeLists 구조, 헤더 분리 원칙 |
| **디자인 패턴 C++ 구현** | Strategy(함수 포인터 + std::function), CRTP(정적 다형성), RAII 래퍼 패턴 |
| **안티패턴** | God class, `using namespace std`, 매크로 남용, raw pointer 소유권 혼란 |
| **레퍼런스 레포** | ModernCppStarter, CppCoreGuidelines 핵심 섹션 링크 |

### 3.3 refs/code-quality/csharp.md (강화, ~250줄)

현재 132줄 → 250줄. 추가할 내용:

| 섹션 | 추가 내용 |
|------|----------|
| **모던 C# 12** | record, primary constructor, pattern matching (switch expression), collection expressions, raw string literals — Bad/Good 쌍 |
| **레이어 구조** | Clean Architecture in .NET: Domain/Application/Infrastructure/Presentation 4레이어 + 각 레이어에 뭐가 들어가는지 |
| **에러 핸들링** | Result<T> 패턴, custom exception hierarchy, global exception handler |
| **네이밍 규칙** | PascalCase/camelCase/_prefix 사용처, I접두사 규칙, 비동기 Async 접미사 |
| **레퍼런스 레포** | jasontaylordev/CleanArchitecture, CommunityToolkit/MVVM-Samples |

### 3.4 refs/code-quality/typescript.md (강화, ~200줄)

현재 90줄 → 200줄. 추가할 내용:

| 섹션 | 추가 내용 |
|------|----------|
| **모던 TS 5.x** | `satisfies` operator, const type parameters, template literal types, `using` declarations — Bad/Good 쌍 |
| **모듈/배럴 구조** | feature-based 폴더 구조, index.ts 배럴 패턴, circular dependency 방지 |
| **테스트 규칙** | vitest/jest 컨벤션, 테스트 네이밍, mock 경계 |
| **에러 핸들링** | Result/Either 패턴, custom error class hierarchy, zod validation |
| **레퍼런스 레포** | clean-ts-api, typescript-clean-architecture |

### 3.5 refs/code-quality/python.md (강화, ~200줄)

현재 127줄 → 200줄. 추가할 내용:

| 섹션 | 추가 내용 |
|------|----------|
| **모던 Python 3.12** | type alias (`type X = ...`), match statement, `Self` type, `**kwargs` typed | Bad/Good 쌍 |
| **async 패턴** | asyncio 올바른 사용, async context manager, gather vs TaskGroup |
| **패키지 구조** | src layout, pyproject.toml, `__init__.py` export 전략 |
| **레퍼런스 레포** | python-clean-architecture, FastAPI best practices |

---

## 4. PostToolUse Hook Specification

### 4.1 code-quality-hook.js

기존 `unified-write-post.js`에 핸들러로 통합.

```javascript
/**
 * Code Quality PostToolUse Handler
 * @module scripts/code-quality-hook
 * @version 0.1.0
 *
 * Runs after every Write/Edit on code files.
 * 3-Stage pipeline: Linter → Structure Check → Metrics Storage
 */
```

#### Stage 1: Linter (외부 도구, optional)

```javascript
/**
 * Run language-appropriate linter on modified file
 * @param {string} filePath - modified file path
 * @returns {{warnings: string[], errors: string[], skipped: boolean}}
 */
function runLinter(filePath) { }
```

| 확장자 | Linter | Command | Fallback |
|--------|--------|---------|----------|
| `.c`, `.cpp`, `.h` | cppcheck | `cppcheck --enable=style --quiet {file}` | skip |
| `.cs` | dotnet-format | `dotnet format --verify-no-changes --include {file}` | skip |
| `.ts`, `.tsx`, `.js` | eslint/biome | `npx eslint --no-fix {file}` or `npx biome check {file}` | skip |
| `.py` | ruff | `ruff check {file}` | skip |

**동작**: linter 미설치 시 `{skipped: true}` 반환, Stage 2로 진행.

#### Stage 2: Structure Check (내장, 항상 실행)

```javascript
/**
 * Analyze code structure metrics for a single file
 * @param {string} filePath - file to analyze
 * @param {string} content - file content
 * @returns {StructureCheckResult}
 */
function checkStructure(filePath, content) { }

/**
 * @typedef {Object} StructureCheckResult
 * @property {Object[]} violations - [{rule, message, line, severity}]
 * @property {FileMetrics} metrics - 정량 메트릭
 */

/**
 * @typedef {Object} FileMetrics
 * @property {number} totalLines - 전체 라인 수
 * @property {FunctionMetric[]} functions - 함수별 메트릭
 * @property {number} maxNestingDepth - 최대 중첩 깊이
 */

/**
 * @typedef {Object} FunctionMetric
 * @property {string} name - 함수명
 * @property {number} lines - 함수 본문 라인 수
 * @property {number} params - 파라미터 수
 * @property {number} nestingDepth - 최대 중첩 깊이
 * @property {number} startLine - 시작 라인
 */
```

**검사 규칙:**

| Rule ID | 규칙 | 임계값 | 심각도 |
|---------|------|--------|--------|
| SQ-001 | 함수 본문 라인 수 | > 40 → warning, > 80 → error | warning/error |
| SQ-002 | 함수 파라미터 수 | > 3 → warning, > 5 → error | warning/error |
| SQ-003 | 중첩 깊이 | > 3 → warning, > 5 → error | warning/error |
| SQ-004 | 파일 전체 라인 수 | > 300 → warning, > 500 → error | warning/error |

**함수 감지 패턴** (언어별):

```javascript
const FUNCTION_PATTERNS = {
  c_cpp: /^(?:static\s+)?(?:inline\s+)?(?:virtual\s+)?[\w*&:<>]+\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?(?:override\s*)?(?:noexcept\s*)?{/,
  csharp: /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:virtual\s+)?(?:override\s+)?[\w<>\[\]?]+\s+(\w+)\s*\([^)]*\)/,
  typescript: /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>\[\]|]+)?\s*{)/,
  python: /^\s*(?:async\s+)?def\s+(\w+)\s*\(/,
};
```

#### Stage 3: Metrics Storage

```javascript
/**
 * Save metrics to .rkit/state/code-quality-metrics.json
 * @param {string} filePath
 * @param {FileMetrics} metrics
 */
function saveMetrics(filePath, metrics) { }
```

**metrics.json 구조:**

```json
{
  "version": "1.0",
  "lastUpdated": "2026-04-03T16:00:00Z",
  "files": {
    "src/services/order.ts": {
      "totalLines": 245,
      "functions": [
        {"name": "calculateTotal", "lines": 35, "params": 2, "nestingDepth": 2},
        {"name": "processOrder", "lines": 52, "params": 4, "nestingDepth": 4}
      ],
      "maxNestingDepth": 4,
      "violations": 2,
      "lastChecked": "2026-04-03T16:30:00Z"
    }
  },
  "summary": {
    "totalFiles": 12,
    "totalViolations": 5,
    "avgFunctionLength": 28,
    "avgParams": 2.3,
    "maxNestingDepth": 4
  }
}
```

### 4.2 Hook 통합 — unified-write-post.js 확장

기존 핸들러 패턴에 맞춰 추가:

```javascript
// unified-write-post.js에 추가할 핸들러

/**
 * Code quality handler - runs on code files only
 * @param {Object} input - Hook input with tool_input.file_path
 * @returns {boolean}
 */
function handleCodeQuality(input) {
  const filePath = input.tool_input?.file_path;
  if (!filePath) return false;

  const ext = path.extname(filePath).toLowerCase();
  const codeExts = ['.c', '.cpp', '.h', '.hpp', '.cs', '.ts', '.tsx', '.js', '.jsx', '.py'];
  if (!codeExts.includes(ext)) return false;

  const { runLinter, checkStructure, saveMetrics } = require('./code-quality-hook');

  // Stage 1: Linter
  const lintResult = runLinter(filePath);

  // Stage 2: Structure Check
  const content = fs.readFileSync(filePath, 'utf-8');
  const structResult = checkStructure(filePath, content);

  // Stage 3: Metrics Storage
  saveMetrics(filePath, structResult.metrics);

  // Output violations to stderr (Claude sees this as feedback)
  const allViolations = [...(lintResult.warnings || []), ...structResult.violations];
  if (allViolations.length > 0) {
    const msg = formatViolations(filePath, allViolations);
    process.stderr.write(msg);
  }

  return true;
}
```

### 4.3 hooks.json 변경

**변경 불필요** — 기존 `unified-write-post.js`의 PostToolUse(Write) 훅이 이미 등록되어 있음. 내부에 `handleCodeQuality` 핸들러를 추가하는 방식.

단, **Edit** matcher도 필요:

```json
{
  "matcher": "Edit",
  "hooks": [
    {
      "type": "command",
      "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/code-quality-hook.js",
      "timeout": 10000
    }
  ]
}
```

---

## 5. Metrics Dashboard Specification

### 5.1 pdca status 통합

`/pdca status` 실행 시 code-quality-metrics.json이 존재하면 품질 섹션 추가:

```
📊 PDCA Status
─────────────────────────────
Feature: code-quality-enhancement
Phase: Do (Implementation)
─────────────────────────────

📐 Code Quality Metrics
─────────────────────────────
Files Checked: 12
Violations: 5 (3 warning, 2 error)
Avg Function Length: 28 lines (limit: 40)
Avg Parameters: 2.3 (limit: 3)
Max Nesting: 4 (limit: 3) ⚠
─────────────────────────────
Top Violations:
  src/services/order.ts:45  processOrder() — 52 lines (limit: 40)
  src/services/order.ts:45  processOrder() — 4 params (limit: 3)
  lib/utils/parser.js:12    parseConfig() — nesting 4 (limit: 3)
```

---

## 6. Implementation Order

```
Phase 1: Reference Documents (Day 1)
├── 1-1. refs/code-quality/common.md (신규 — 클린아키텍처/OOP/패턴/안티패턴)
├── 1-2. refs/code-quality/cpp.md (강화)
├── 1-3. refs/code-quality/csharp.md (강화)
├── 1-4. refs/code-quality/typescript.md (강화)
└── 1-5. refs/code-quality/python.md (강화)

Phase 2: Hook & Metrics (Day 2)
├── 2-1. lib/code-quality/metrics-collector.js (구조 분석 + 메트릭 수집)
├── 2-2. scripts/code-quality-hook.js (3-Stage 파이프라인)
├── 2-3. unified-write-post.js 확장 (handleCodeQuality 추가)
└── 2-4. hooks.json 업데이트 (Edit matcher 추가)

Phase 3: Integration (Day 2)
├── 3-1. rkit-rules SKILL.md 업데이트 (common.md imports 추가)
├── 3-2. pdca SKILL.md imports 업데이트 (common.md 추가)
└── 3-3. pdca status에 메트릭 대시보드 통합
```

### 파일 생성/수정 체크리스트

| # | File | Action | Phase |
|---|------|--------|:-----:|
| 1 | `refs/code-quality/common.md` | Create (~200줄) | 1 |
| 2 | `refs/code-quality/cpp.md` | Rewrite (130→250줄) | 1 |
| 3 | `refs/code-quality/csharp.md` | Rewrite (132→250줄) | 1 |
| 4 | `refs/code-quality/typescript.md` | Rewrite (90→200줄) | 1 |
| 5 | `refs/code-quality/python.md` | Rewrite (127→200줄) | 1 |
| 6 | `lib/code-quality/metrics-collector.js` | Create | 2 |
| 7 | `scripts/code-quality-hook.js` | Create | 2 |
| 8 | `scripts/unified-write-post.js` | Modify (핸들러 추가) | 2 |
| 9 | `hooks/hooks.json` | Modify (Edit matcher) | 2 |
| 10 | `skills/rkit-rules/SKILL.md` | Modify (imports) | 3 |
| 11 | `skills/pdca/SKILL.md` | Modify (imports) | 3 |
| — | **Total** | 6 create + 5 modify = **11 files** | — |

---

## 7. Test Plan

### 7.1 Test Cases

- [ ] C 파일에 50줄 함수 작성 → Stage 2에서 SQ-001 warning 출력
- [ ] TS 파일에 5개 파라미터 함수 → SQ-002 error 출력
- [ ] Python 파일에 4단계 중첩 → SQ-003 warning 출력
- [ ] 400줄 C# 파일 → SQ-004 warning 출력
- [ ] cppcheck 미설치 환경 → Stage 1 skip, Stage 2-3 정상
- [ ] .md 파일 수정 → code quality hook 미실행 (코드 파일만)
- [ ] metrics.json 누적 저장 확인
- [ ] /pdca status에 메트릭 대시보드 표시

### 7.2 Eval Scenarios

| Scenario | Expected |
|----------|----------|
| 에이전트가 45줄 함수 작성 후 | PostToolUse 피드백 수신 → 함수 분리 |
| 에이전트가 4파라미터 함수 작성 후 | PostToolUse 피드백 → 파라미터 객체 도입 |
| linter 없는 환경 | graceful skip, 구조 검사만 실행 |

---

## 8. Coding Convention

### 8.1 기존 패턴 준수

| Target | Convention |
|--------|-----------|
| 파일명 | kebab-case: `code-quality-hook.js`, `metrics-collector.js` |
| 함수명 | camelCase: `checkStructure()`, `saveMetrics()` |
| 모듈 | `require()` CommonJS (기존 rkit 패턴) |
| I/O | `lib/core/io.js`의 `readStdinSync`, `outputAllow` 사용 |
| 디버그 | `lib/core/debug.js`의 `debugLog` 사용 |
| hooks.json | 기존 구조 유지, matcher 패턴 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-03 | Initial draft | soojang.roh |
