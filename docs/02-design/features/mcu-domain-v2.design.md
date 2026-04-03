# mcu-domain-v2 Design Document

> **Summary**: MCU 동시성/시스템 크리티컬 이슈 통합 분석 — 2-Layer 아키텍처 상세 설계
>
> **Project**: rkit
> **Version**: 0.7.0
> **Author**: soojang.roh
> **Date**: 2026-04-03
> **Status**: Draft
> **Planning Doc**: [mcu-domain-v2.plan.md](../01-plan/features/mcu-domain-v2.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. MCU 소스 코드에서 동시성/크리티컬 이슈 관련 데이터를 **결정적으로 추출**하는 JS 모듈 구현
2. 추출 데이터를 받아 **의미론적 추론**으로 위험을 판정하는 opus 에이전트 정의
3. 자체 스케줄러 패턴을 **configurable**하게 지원하는 구조
4. 기존 lib/mcu/ 모듈과 **동일한 코딩 컨벤션** 유지

### 1.2 Design Principles

- **Layer 분리**: 추출(deterministic JS) ↔ 추론(LLM agent) — 각 레이어의 책임을 명확히 분리
- **최소 의존**: 외부 도구(cppcheck)는 optional, 없어도 핵심 분석 가능
- **Configurable 패턴**: 자체 스케줄러 API를 ref 문서로 교체 가능 (하드코딩 금지)
- **기존 호환**: lib/mcu/index.js re-export 구조 유지, 기존 함수 시그니처 불변

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Skill Layer                                                 │
│  skills/mcu-critical-analysis/SKILL.md                       │
│  (trigger: /mcu-critical-analysis [srcDir])                  │
└────────────────────────┬────────────────────────────────────┘
                         │ invokes
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Agent Layer (Layer 2 — LLM Reasoning)                       │
│  agents/mcu-critical-analyzer.md (opus)                      │
│                                                              │
│  ConSynergy 4-Stage Pipeline:                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │①Identify │→│② Slice   │→│③ Reason  │→│④ Verdict │       │
│  │공유자원   │ │코드경로   │ │보호누락   │ │심각도     │       │
│  │식별      │ │분리      │ │판단      │ │분류      │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  References:                                                 │
│  - refs/mcu/concurrency-patterns.md (위험 패턴 DB)           │
│  - refs/mcu/custom-scheduler-guide.md (스케줄러 API)         │
└────────────────────────┬────────────────────────────────────┘
                         │ calls (via tools)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Extraction Layer (Layer 1 — Deterministic JS)               │
│  lib/mcu/                                                    │
│  ┌────────────────┐ ┌────────────────┐                      │
│  │ isr-extractor   │ │ dma-extractor  │                      │
│  │ .js (4 funcs)   │ │ .js (3 funcs)  │                      │
│  └────────────────┘ └────────────────┘                      │
│  ┌────────────────┐ ┌────────────────┐                      │
│  │ concurrency-   │ │ tool-bridge    │                      │
│  │ extractor.js   │ │ .js (2 funcs)  │                      │
│  │ (4 funcs)      │ │                │                      │
│  └────────────────┘ └────────────────┘                      │
│                                                              │
│  기존 모듈 (변경 없음):                                       │
│  pin-config.js | clock-tree.js | memory-analyzer.js          │
│  toolchain.js  | build-history.js                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
입력 소스                     Layer 1 (추출)              Layer 2 (추론)             출력
─────────              ──────────────────      ──────────────────       ─────────

*.c / *.h  ──→ isr-extractor ──────┐
                                    │
*.ioc      ──→ isr-extractor ──────┤
               dma-extractor ──────┤──→  JSON 데이터  ──→  mcu-critical  ──→  Report
*.map      ──→ tool-bridge ────────┤     (구조화)          -analyzer          (.md)
                                    │                     (opus agent)
*.su       ──→ tool-bridge ────────┤                        │
                                    │                        │
*.c / *.h  ──→ concurrency- ──────┘                        ▼
               extractor                              PDCA analyze
                                                      → iterate loop
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| isr-extractor | fs, path | 소스파일 읽기, .ioc 파싱 |
| dma-extractor | pin-config (기존) | .ioc 파싱 결과 재활용 |
| concurrency-extractor | fs, path | 소스파일 패턴 매칭 |
| tool-bridge | child_process (optional) | cppcheck 실행 |
| mcu-critical-analyzer | isr-extractor, dma-extractor, concurrency-extractor, tool-bridge | 추출 데이터 소비 |

---

## 3. Data Model

### 3.1 추출 데이터 구조 (Layer 1 → Layer 2)

#### ISR Extraction Result

```javascript
/**
 * @typedef {Object} ISRInfo
 * @property {string} name - ISR 핸들러 이름 (예: "USART1_IRQHandler")
 * @property {string} file - 소스파일 경로
 * @property {number} line - 선언 라인 번호
 * @property {string[]} calledFunctions - ISR 내부에서 호출하는 함수 목록
 * @property {string[]} globalAccess - ISR에서 접근하는 전역변수 목록
 * @property {string} accessType - "read" | "write" | "readwrite"
 */

/**
 * @typedef {Object} NVICConfig
 * @property {string} irqName - 인터럽트 이름
 * @property {number} preemptPriority - 선점 우선순위
 * @property {number} subPriority - 서브 우선순위
 * @property {string} source - "ioc" | "source" (설정 출처)
 * @property {string} file - 설정 파일 경로
 * @property {number} line - 설정 라인 번호
 */

/**
 * @typedef {Object} ISRExtractionResult
 * @property {ISRInfo[]} handlers - ISR 핸들러 목록
 * @property {NVICConfig[]} nvicConfig - NVIC 우선순위 설정
 * @property {Object[]} callGraph - ISR → 함수 호출 관계
 * @property {Object[]} globalAccess - ISR → 전역변수 접근 관계
 */
```

#### DMA Extraction Result

```javascript
/**
 * @typedef {Object} DMAChannelConfig
 * @property {string} peripheral - 연결된 페리퍼럴 (예: "USART1_TX")
 * @property {number} stream - DMA 스트림 번호
 * @property {number} channel - DMA 채널 번호
 * @property {string} direction - "PERIPH_TO_MEMORY" | "MEMORY_TO_PERIPH" | "MEMORY_TO_MEMORY"
 * @property {string} mode - "NORMAL" | "CIRCULAR"
 * @property {string} source - "ioc" | "source"
 */

/**
 * @typedef {Object} DMABufferInfo
 * @property {string} name - 버퍼 변수명
 * @property {string} file - 선언 파일
 * @property {number} line - 선언 라인
 * @property {number} size - 버퍼 크기 (바이트, 추정)
 * @property {boolean} aligned - __attribute__((aligned)) 여부
 * @property {boolean} inNoCacheRegion - 캐시 비활성 영역 여부
 */

/**
 * @typedef {Object} DMAExtractionResult
 * @property {DMAChannelConfig[]} channels - DMA 채널 설정 목록
 * @property {DMABufferInfo[]} buffers - DMA 버퍼 정보
 * @property {Object[]} peripheralMap - DMA↔페리퍼럴 매핑
 */
```

#### Concurrency Extraction Result

```javascript
/**
 * @typedef {Object} GlobalVarInfo
 * @property {string} name - 변수명
 * @property {string} type - C 타입 (예: "uint32_t")
 * @property {boolean} isVolatile - volatile 키워드 여부
 * @property {boolean} isStatic - static 키워드 여부
 * @property {string} file - 선언 파일
 * @property {number} line - 선언 라인
 * @property {Object[]} accessPoints - 접근 위치 목록 [{file, line, context, isWrite}]
 */

/**
 * @typedef {Object} SyncPrimitiveUsage
 * @property {string} type - "mutex_lock" | "mutex_unlock" | "critical_enter" | "critical_exit" | "irq_disable" | "irq_enable"
 * @property {string} file - 사용 파일
 * @property {number} line - 사용 라인
 * @property {string} scope - 함수명 (어떤 함수 내에서 사용됐는지)
 */

/**
 * @typedef {Object} ContextSwitchPoint
 * @property {string} function - 컨텍스트 스위치를 유발하는 함수명
 * @property {string} file - 호출 위치 파일
 * @property {number} line - 호출 라인
 * @property {string} callerFunction - 호출하는 함수명
 */

/**
 * @typedef {Object} ConcurrencyExtractionResult
 * @property {GlobalVarInfo[]} globalVars - 전역/static 변수 목록
 * @property {SyncPrimitiveUsage[]} syncPrimitives - 동기화 프리미티브 사용
 * @property {ContextSwitchPoint[]} contextSwitchPoints - 컨텍스트 스위칭 포인트
 * @property {Object[]} atomicOps - C11 atomic / __sync 사용 위치
 */
```

#### Tool Bridge Result

```javascript
/**
 * @typedef {Object} CppcheckFinding
 * @property {string} id - 체크 ID (예: "threadsafety-staticLocalObject")
 * @property {string} severity - "error" | "warning" | "style"
 * @property {string} message - 설명 메시지
 * @property {string} file - 파일 경로
 * @property {number} line - 라인 번호
 */

/**
 * @typedef {Object} StackUsageEntry
 * @property {string} function - 함수명
 * @property {number} stackBytes - 스택 사용량 (바이트)
 * @property {string} qualifier - "static" | "dynamic" | "bounded"
 * @property {string} file - 소스 파일
 */

/**
 * @typedef {Object} ToolBridgeResult
 * @property {CppcheckFinding[]} cppcheckFindings - cppcheck 결과 (optional)
 * @property {StackUsageEntry[]} stackUsage - 함수별 스택 사용량 (optional)
 * @property {boolean} cppcheckAvailable - cppcheck 사용 가능 여부
 * @property {boolean} suFilesAvailable - .su 파일 존재 여부
 */
```

### 3.2 분석 리포트 구조 (Layer 2 출력)

```javascript
/**
 * @typedef {Object} CriticalIssue
 * @property {string} id - 이슈 ID (예: "C-001")
 * @property {string} severity - "critical" | "warning" | "info"
 * @property {string} confidence - "high" | "medium" | "low"
 * @property {string} category - "race-condition" | "volatile-misuse" | "dma-conflict" | "stack-overflow" | "nvic-conflict" | "non-reentrant" | "memory-barrier" | "context-switch"
 * @property {string} title - 이슈 제목
 * @property {string} description - 상세 설명
 * @property {Object[]} locations - 관련 코드 위치 [{file, line, snippet}]
 * @property {string} recommendation - 수정 권고
 * @property {string} reference - 관련 표준/패턴 참조 (예: "MISRA C:2023 Rule 22.15")
 */
```

---

## 4. Module Specification

### 4.1 isr-extractor.js

```javascript
/**
 * ISR Handler & NVIC Configuration Extractor
 * @module lib/mcu/isr-extractor
 * @version 0.1.0
 */

/**
 * Extract ISR handler functions from source directory
 * Patterns: void *_IRQHandler(void), void ISR_*(void)
 * @param {string} srcDir - 소스 디렉토리 경로
 * @returns {ISRInfo[]}
 */
function extractISRHandlers(srcDir) { }

/**
 * Extract NVIC priority configuration from .ioc and source files
 * Sources: .ioc NVIC.* keys + HAL_NVIC_SetPriority() calls
 * @param {string|null} iocPath - .ioc 파일 경로 (null이면 소스만 검색)
 * @param {string} srcDir - 소스 디렉토리
 * @returns {NVICConfig[]}
 */
function extractNVICConfig(iocPath, srcDir) { }

/**
 * Extract 1-depth call graph from ISR handlers
 * ISR 내부에서 직접 호출하는 함수 목록 추출
 * @param {string} srcDir - 소스 디렉토리
 * @param {ISRInfo[]} handlers - extractISRHandlers 결과
 * @returns {Object[]} [{handler, calledFunctions: [{name, file, line}]}]
 */
function extractISRCallGraph(srcDir, handlers) { }

/**
 * Extract global variable access from ISR handlers
 * ISR에서 읽기/쓰기하는 전역변수 식별
 * @param {string} srcDir - 소스 디렉토리
 * @param {ISRInfo[]} handlers - extractISRHandlers 결과
 * @returns {Object[]} [{handler, variable, accessType, file, line}]
 */
function extractISRGlobalAccess(srcDir, handlers) { }
```

**구현 전략**:
- `extractISRHandlers`: `*_IRQHandler` 패턴은 CMSIS 표준, `void` 반환 + `void` 파라미터 확인
- `extractNVICConfig`: .ioc에서 `NVIC.*.PreemptionPriority`, `NVIC.*.SubPriority` 키 추출 + 소스에서 `HAL_NVIC_SetPriority(IRQn, preempt, sub)` regex 매칭
- `extractISRCallGraph`: ISR 함수 본문 내 함수 호출 패턴 `identifier(` 매칭 (1-depth만)
- `extractISRGlobalAccess`: ISR 본문에서 참조하는 변수 중, 파일 스코프 전역변수와 교차 매칭

### 4.2 dma-extractor.js

```javascript
/**
 * DMA Channel/Stream Configuration & Buffer Extractor
 * @module lib/mcu/dma-extractor
 * @version 0.1.0
 */

/**
 * Extract DMA channel/stream configuration
 * Sources: .ioc DMA.* keys + HAL_DMA_Init() / fsl_edma calls
 * @param {string|null} iocPath - .ioc 파일 경로
 * @param {string} srcDir - 소스 디렉토리
 * @returns {DMAChannelConfig[]}
 */
function extractDMAConfig(iocPath, srcDir) { }

/**
 * Extract DMA buffer declarations and attributes
 * Patterns: __attribute__((aligned)), __ALIGN_BEGIN, DMA buffer comments
 * @param {string} srcDir - 소스 디렉토리
 * @returns {DMABufferInfo[]}
 */
function extractDMABuffers(srcDir) { }

/**
 * Map DMA channels to peripherals using .ioc and source data
 * @param {DMAChannelConfig[]} dmaConfig - extractDMAConfig 결과
 * @param {Object} pinConfig - pin-config.js의 extractPeripheralList 결과
 * @returns {Object[]} [{dmaStream, dmaChannel, peripheral, direction}]
 */
function mapDMAToPeripherals(dmaConfig, pinConfig) { }
```

**구현 전략**:
- `extractDMAConfig`: .ioc에서 `Dma.*` 키 추출 (STM32), 소스에서 `hdma_*.Init.Channel`, `hdma_*.Init.Direction` 추출
- `extractDMABuffers`: `uint8_t.*dma.*buf` 류 변수 + `__attribute__((aligned(N)))` 또는 `__ALIGN_BEGIN` 매크로 감지
- `mapDMAToPeripherals`: DMA 설정의 peripheral 필드와 pin-config의 페리퍼럴 목록 교차 매핑

### 4.3 concurrency-extractor.js

```javascript
/**
 * Concurrency Hazard Data Extractor
 * @module lib/mcu/concurrency-extractor
 * @version 0.1.0
 */

/**
 * Extract global and file-scope static variables with volatile status
 * @param {string} srcDir - 소스 디렉토리
 * @returns {GlobalVarInfo[]}
 */
function extractGlobalVariables(srcDir) { }

/**
 * Extract synchronization primitive usage
 * Configurable patterns for custom scheduler
 * Default patterns: osMutexAcquire, __disable_irq, taskENTER_CRITICAL, etc.
 * Custom patterns loaded from refs/mcu/custom-scheduler-guide.md
 * @param {string} srcDir - 소스 디렉토리
 * @param {Object} [options] - {customPatterns: [{type, pattern}]}
 * @returns {SyncPrimitiveUsage[]}
 */
function extractSyncPrimitives(srcDir, options) { }

/**
 * Extract context switch points (scheduler yield, task switch)
 * Configurable for custom scheduler
 * @param {string} srcDir - 소스 디렉토리
 * @param {Object} [options] - {switchPatterns: string[]}
 * @returns {ContextSwitchPoint[]}
 */
function extractContextSwitchPoints(srcDir, options) { }

/**
 * Extract C11 atomic operations and GCC __sync builtins usage
 * @param {string} srcDir - 소스 디렉토리
 * @returns {Object[]} [{type, operation, file, line, variable}]
 */
function extractAtomicOps(srcDir) { }
```

**구현 전략**:
- `extractGlobalVariables`: 파일 최상위 스코프 변수 선언 패턴 매칭 (`static? volatile? type name`), `extern` 선언 추적
- `extractSyncPrimitives`: 기본 패턴 + `options.customPatterns`로 자체 스케줄러 API 지원. ref 문서에서 패턴 로드 가능
- `extractContextSwitchPoints`: 기본 패턴 (`osThreadYield`, `taskYIELD`, `SVC_Handler`) + `options.switchPatterns`으로 커스텀 확장
- `extractAtomicOps`: `atomic_*`, `__atomic_*`, `__sync_*` 패턴 매칭

### 4.4 tool-bridge.js

```javascript
/**
 * External Tool Integration Bridge
 * @module lib/mcu/tool-bridge
 * @version 0.1.0
 *
 * All external tools are OPTIONAL.
 * Functions return empty results gracefully when tools are not installed.
 */

/**
 * Run cppcheck with threadsafety addon and parse results
 * @param {string} srcDir - 소스 디렉토리
 * @param {Object} [options] - {cppcheckPath: string, extraArgs: string[]}
 * @returns {CppcheckFinding[]} 빈 배열 if cppcheck not installed
 */
function runCppcheckThreadsafety(srcDir, options) { }

/**
 * Extract per-function stack usage from GCC .su files and .map file
 * Requires build with -fstack-usage flag
 * @param {string} buildDir - 빌드 디렉토리 (.su 파일 검색)
 * @param {string|null} mapPath - .map 파일 경로 (optional, 심볼 매칭용)
 * @returns {StackUsageEntry[]} 빈 배열 if .su files not found
 */
function extractStackUsage(buildDir, mapPath) { }
```

**구현 전략**:
- `runCppcheckThreadsafety`: `which cppcheck` 확인 → `cppcheck --addon=threadsafety --template='{id}:{severity}:{file}:{line}:{message}' srcDir` 실행 → 파싱
- `extractStackUsage`: `.su` 파일 glob → `function_name\tsize\tqualifier` 형식 파싱 → .map 파일로 함수 위치 보강

---

## 5. Agent Specification

### 5.1 mcu-critical-analyzer.md

```markdown
---
name: mcu-critical-analyzer
description: |
  MCU 동시성/시스템 크리티컬 이슈 통합 분석 에이전트.
  2-Layer 아키텍처의 Layer 2 — ConSynergy 4-Stage 파이프라인으로
  ISR/DMA/동시성/스택 이슈를 의미론적으로 분석하고 심각도×신뢰도 리포트 생성.

  Triggers: critical analysis, 크리티컬 분석, 동시성 분석, concurrency audit,
  クリティカル分析, 关键分析, análisis crítico

  Do NOT use for: 일반 코드 리뷰 (code-analyzer 사용),
  MISRA 검증 (safety-auditor 사용), 아키텍처 설계 (fw-architect 사용).
model: opus
effort: high
maxTurns: 30
memory: project
context: fork
tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task(Explore)
  - Write
  - Edit
skills: [pdca, rkit-rules, misra-c]
---
```

### 5.2 Agent Prompt — ConSynergy 4-Stage Pipeline

에이전트 프롬프트의 핵심 분석 로직:

```
## Analysis Pipeline (ConSynergy 4-Stage)

### Stage 1: Identify (공유자원 식별)
입력: concurrency-extractor의 globalVars + isr-extractor의 globalAccess
동작:
- 전역변수 중 ISR과 main/task 양쪽에서 접근하는 변수 필터링
- 전역변수 중 복수 스레드/태스크에서 접근하는 변수 필터링
- DMA 버퍼와 CPU 접근이 겹치는 메모리 영역 식별
결과: 공유자원 후보 목록

### Stage 2: Slice (동시성 슬라이싱)
입력: Stage 1 결과 + 소스 코드 (Read tool)
동작:
- 각 공유자원의 접근 코드 경로를 실제 소스에서 읽어 분리
- 접근 전후의 동기화 프리미티브 사용 여부 확인
- ISR 호출 관계에서 비재진입 함수 호출 체인 추적
결과: 자원별 접근 코드 슬라이스 + 보호 상태

### Stage 3: Reason (의미론적 추론)
입력: Stage 2 결과 + refs/mcu/concurrency-patterns.md
동작:
- volatile만으로 보호된 공유 접근 → volatile 오용 판정
- ISR에서 malloc/printf/strtok 등 호출 → 비재진입 위험 판정
- DMA 완료 후 메모리 배리어 없음 → 캐시 일관성 위험 판정
- 동일 우선순위 NVIC 인터럽트 간 자원 공유 → 경합 판정
- 컨텍스트 스위치 포인트 전후 non-atomic 연산 → 데이터 레이스 판정
- 스택 사용량이 할당의 75% 초과 → 오버플로 위험 판정
결과: 이슈 후보 목록 + 판단 근거

### Stage 4: Verdict (위험도 판정)
입력: Stage 3 결과
동작:
- 심각도 분류: Critical (실제 데이터 손상 가능) / Warning (잠재적 위험) / Info (개선 권고)
- 신뢰도 분류: High (패턴 명확) / Medium (컨텍스트 의존) / Low (추정)
- 수정 권고 생성 (코드 예시 포함)
- 관련 표준 참조 (MISRA C, SEI CERT, ARM 가이드)
결과: CriticalIssue[] → Report 생성
```

### 5.3 Agent Error Handling

| 상황 | 에이전트 동작 |
|------|-------------|
| 소스 디렉토리 없음 | 에러 메시지 + 사용법 안내 |
| .ioc 파일 없음 | NVIC/DMA는 소스 코드만으로 분석 (기능 저하 모드) |
| cppcheck 미설치 | threadsafety 결과 없이 자체 분석만 수행 |
| .su 파일 없음 | 스택 분석 skip, 나머지 분석 계속 |
| 전역변수 0개 추출 | Info 이슈: "전역변수가 감지되지 않았습니다" |

---

## 6. Skill Specification

### 6.1 mcu-critical-analysis/SKILL.md

```yaml
---
name: mcu-critical-analysis
classification: workflow
description: |
  MCU 동시성/시스템 크리티컬 이슈 통합 분석 스킬.
  ConSynergy 4-Stage 파이프라인으로 ISR/DMA/동시성/스택 이슈를 분석하고
  심각도×신뢰도 분류 리포트를 생성합니다.

  Triggers: mcu-critical-analysis, critical analysis, 크리티컬 분석,
  동시성 분석, concurrency, race condition, 레이스 컨디션,
  クリティカル分析, 并发分析, análisis de concurrencia

  Do NOT use for: 일반 코드 리뷰, MISRA 검증, 아키텍처 설계
argument-hint: "[srcDir]"
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
imports:
  - ${PLUGIN_ROOT}/refs/mcu/concurrency-patterns.md
  - ${PLUGIN_ROOT}/refs/mcu/custom-scheduler-guide.md
  - ${PLUGIN_ROOT}/templates/mcu-critical-report.template.md
next-skill: pdca analyze
pdca-phase: do
---
```

### 6.2 Skill Workflow

```
1. srcDir 인자 확인 (없으면 현재 디렉토리에서 .c/.h 검색)
2. Layer 1 추출 실행:
   a. extractISRHandlers(srcDir) → handlers
   b. extractNVICConfig(iocPath, srcDir) → nvicConfig
   c. extractISRCallGraph(srcDir, handlers) → callGraph
   d. extractISRGlobalAccess(srcDir, handlers) → isrGlobalAccess
   e. extractDMAConfig(iocPath, srcDir) → dmaConfig
   f. extractDMABuffers(srcDir) → dmaBuffers
   g. extractGlobalVariables(srcDir) → globalVars
   h. extractSyncPrimitives(srcDir, customOptions) → syncPrimitives
   i. extractContextSwitchPoints(srcDir, customOptions) → switchPoints
   j. extractAtomicOps(srcDir) → atomicOps
   k. runCppcheckThreadsafety(srcDir) → cppcheckFindings (optional)
   l. extractStackUsage(buildDir, mapPath) → stackUsage (optional)
3. mcu-critical-analyzer 에이전트 호출 (추출 데이터 전달)
4. 리포트 생성 → docs/03-analysis/mcu-critical/{feature}-{timestamp}.md
5. 요약 출력 (Critical N / Warning N / Info N)
```

---

## 7. Reference Documents Specification

### 7.1 refs/mcu/concurrency-patterns.md

동시성 위험 패턴 라이브러리. 에이전트가 Stage 3 Reason에서 참조.

| 패턴 ID | 이름 | 설명 | 심각도 |
|---------|------|------|--------|
| CP-01 | ISR 비보호 전역 쓰기 | ISR에서 전역변수 쓰기 시 critical section 없음 | Critical |
| CP-02 | volatile 동기화 오용 | volatile만으로 멀티바이트 변수 보호 시도 | Critical |
| CP-03 | ISR 내 비재진입 호출 | ISR에서 malloc/printf/sprintf/strtok 호출 | Critical |
| CP-04 | DMA 메모리 배리어 누락 | DMA 완료 콜백 후 DMB/DSB 없음 | Warning |
| CP-05 | NVIC 동일 우선순위 경합 | 같은 선점 우선순위 ISR 간 공유자원 접근 | Warning |
| CP-06 | Non-atomic 읽기-수정-쓰기 | 32비트 이상 변수의 비원자적 RMW 연산 | Critical |
| CP-07 | 컨텍스트 스위치 임계구간 | 컨텍스트 스위치 포인트 직전 락 해제 누락 | Critical |
| CP-08 | DMA 버퍼 캐시 정렬 | DMA 버퍼가 캐시라인 경계에 미정렬 | Warning |
| CP-09 | 스택 오버플로 위험 | 함수 스택 사용량이 할당의 75% 초과 | Warning |
| CP-10 | atomic 초기화 누락 | C11 atomic 변수 ATOMIC_VAR_INIT 없이 사용 | Warning |
| CP-11 | ISR 내 긴 실행 | ISR에서 루프/지연/블로킹 호출 | Warning |
| CP-12 | 공유 플래그 비보호 | 태스크 간 공유 플래그 변수에 동기화 없음 | Critical |

### 7.2 refs/mcu/custom-scheduler-guide.md

팀이 작성하는 자체 스케줄러 패턴 가이드 (템플릿).

```markdown
# Custom Scheduler Pattern Guide

## Scheduler API

| Function | Type | Description |
|----------|------|-------------|
| scheduler_yield() | context-switch | 태스크 양보, 컨텍스트 스위치 유발 |
| mutex_lock(m) | sync-enter | 뮤텍스 획득 |
| mutex_unlock(m) | sync-exit | 뮤텍스 해제 |
| critical_enter() | sync-enter | 크리티컬 섹션 진입 (인터럽트 비활성) |
| critical_exit() | sync-exit | 크리티컬 섹션 퇴출 |

## Pattern Matching Rules (rkit용)

syncPatterns:
  - {type: "sync-enter", pattern: "mutex_lock\\s*\\("}
  - {type: "sync-exit", pattern: "mutex_unlock\\s*\\("}
  - {type: "sync-enter", pattern: "critical_enter\\s*\\("}
  - {type: "sync-exit", pattern: "critical_exit\\s*\\("}

switchPatterns:
  - "scheduler_yield\\s*\\("
  - "task_switch\\s*\\("

## Non-Reentrant Functions (금지 목록)
- malloc, free, printf, sprintf, snprintf
- strtok, strerror, localtime, asctime, rand
```

---

## 8. Report Template Specification

### 8.1 templates/mcu-critical-report.template.md

```markdown
# MCU Critical Analysis Report

> **Project**: {project}
> **Source**: {srcDir}
> **Date**: {date}
> **Analyzer**: mcu-critical-analyzer v{version}

## Summary

| Severity | Count |
|----------|:-----:|
| Critical | {criticalCount} |
| Warning  | {warningCount} |
| Info     | {infoCount} |

## Critical Issues

### {id}: {title}

- **Severity**: {severity} | **Confidence**: {confidence}
- **Category**: {category}
- **Location**: {file}:{line}

**Description**: {description}

**Code**:
\```c
{codeSnippet}
\```

**Recommendation**: {recommendation}

**Reference**: {reference}

---

## Analysis Pipeline Log

| Stage | Input | Output | Duration |
|-------|-------|--------|----------|
| Identify | {inputCount} vars | {sharedCount} shared | {ms}ms |
| Slice | {sharedCount} shared | {sliceCount} slices | {ms}ms |
| Reason | {sliceCount} slices | {issueCount} issues | {ms}ms |
| Verdict | {issueCount} issues | {C}/{W}/{I} classified | {ms}ms |
```

---

## 9. Implementation Order

### 9.1 구현 순서 (의존성 기반)

```
Phase 1: Foundation (Day 1)
├── 1-1. concurrency-patterns.md (레퍼런스 — 에이전트 프롬프트 참조)
├── 1-2. custom-scheduler-guide.md (레퍼런스 — 추출기 패턴 설정)
└── 1-3. mcu-critical-report.template.md (리포트 템플릿)

Phase 2: Extractors (Day 1-2)
├── 2-1. isr-extractor.js (4 함수)
├── 2-2. dma-extractor.js (3 함수) — depends on pin-config.js
├── 2-3. concurrency-extractor.js (4 함수) — depends on custom-scheduler-guide
└── 2-4. tool-bridge.js (2 함수) — optional deps

Phase 3: Integration (Day 2)
├── 3-1. lib/mcu/index.js 업데이트 (신규 모듈 re-export)
├── 3-2. mcu-critical-analyzer.md (에이전트 정의)
└── 3-3. mcu-critical-analysis/SKILL.md (트리거 스킬)

Phase 4: Validation (Day 3)
├── 4-1. 추출 함수 단위 테스트 (샘플 입력 기반)
├── 4-2. 에이전트 eval 시나리오
└── 4-3. 팀 코드베이스 검증 실행
```

### 9.2 파일 생성 체크리스트

| # | File | Type | Functions | Phase |
|---|------|------|:---------:|:-----:|
| 1 | `refs/mcu/concurrency-patterns.md` | Reference | — | 1 |
| 2 | `refs/mcu/custom-scheduler-guide.md` | Reference | — | 1 |
| 3 | `templates/mcu-critical-report.template.md` | Template | — | 1 |
| 4 | `lib/mcu/isr-extractor.js` | Module | 4 | 2 |
| 5 | `lib/mcu/dma-extractor.js` | Module | 3 | 2 |
| 6 | `lib/mcu/concurrency-extractor.js` | Module | 4 | 2 |
| 7 | `lib/mcu/tool-bridge.js` | Module | 2 | 2 |
| 8 | `lib/mcu/index.js` | Update | — | 3 |
| 9 | `agents/mcu-critical-analyzer.md` | Agent | — | 3 |
| 10 | `skills/mcu-critical-analysis/SKILL.md` | Skill | — | 3 |
| — | **Total** | **10 files** | **13 funcs** | — |

---

## 10. Test Plan

### 10.1 Test Scope

| Type | Target | Method |
|------|--------|--------|
| Unit | 추출 함수 13개 | 샘플 .c/.h/.ioc 입력 → 기대 출력 비교 |
| Integration | Layer 1 → Layer 2 데이터 전달 | 추출 결과를 에이전트에 피딩, 리포트 형식 검증 |
| E2E | 전체 스킬 워크플로우 | `/mcu-critical-analysis` 실행 → 리포트 생성 확인 |

### 10.2 Test Cases (Key)

- [ ] ISR 핸들러가 있는 STM32 프로젝트에서 핸들러 추출 정상 동작
- [ ] .ioc 없는 프로젝트에서 소스코드만으로 NVIC 설정 추출
- [ ] 전역변수에 volatile 없이 ISR↔main 공유 시 Critical 이슈 감지
- [ ] DMA 버퍼 캐시 미정렬 시 Warning 이슈 감지
- [ ] cppcheck 미설치 시 graceful 동작 (빈 결과 반환)
- [ ] .su 파일 없는 환경에서 스택 분석 skip
- [ ] 커스텀 스케줄러 패턴으로 컨텍스트 스위치 포인트 추출

### 10.3 Eval Scenarios

| Scenario | Input | Expected |
|----------|-------|----------|
| 레이스 컨디션 감지 | ISR에서 비보호 전역변수 쓰기 | Critical, confidence High |
| volatile 오용 | volatile만으로 32비트 공유 변수 보호 | Critical, confidence High |
| DMA 충돌 | 동일 DMA 채널에 2개 페리퍼럴 | Warning, confidence High |
| 정상 코드 | 모든 공유변수 mutex 보호 | 이슈 0개 |
| 부분 보호 | 일부만 critical section 보호 | Warning, confidence Medium |

---

## 11. Coding Convention Reference

### 11.1 Naming Conventions (기존 lib/mcu/ 준수)

| Target | Rule | Example |
|--------|------|---------|
| 파일명 | kebab-case | `isr-extractor.js`, `tool-bridge.js` |
| 함수명 | camelCase | `extractISRHandlers()`, `runCppcheckThreadsafety()` |
| 상수 | UPPER_SNAKE_CASE | `DEFAULT_SYNC_PATTERNS` |
| JSDoc | 모든 exported 함수 | @param, @returns 필수 |
| 모듈 헤더 | @module, @version | 기존 패턴 동일 |

### 11.2 Module Structure (기존 패턴)

```javascript
/**
 * {Module description}
 * @module lib/mcu/{name}
 * @version 0.1.0
 */

const fs = require('fs');
const path = require('path');

// Functions...

module.exports = {
  functionA,
  functionB,
};
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-03 | Initial draft | soojang.roh |
