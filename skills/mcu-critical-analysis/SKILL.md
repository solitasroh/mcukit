---
name: mcu-critical-analysis
classification: workflow
classification-reason: Orchestrates multi-stage analysis pipeline with agent invocation
deprecation-risk: low
description: |
  MCU 동시성/시스템 크리티컬 이슈 통합 분석 스킬.
  ConSynergy 4-Stage 파이프라인으로 ISR/DMA/동시성/스택 이슈를 분석하고
  심각도×신뢰도 분류 리포트를 생성합니다.

  Use proactively when user mentions concurrency issues, race conditions,
  interrupt safety, DMA conflicts, or asks for critical code review.

  Triggers: mcu-critical-analysis, critical analysis, 크리티컬 분석,
  동시성 분석, 동시성 감사, concurrency, concurrency audit,
  race condition, 레이스 컨디션, data race, deadlock, 데드락,
  ISR 분석, interrupt analysis, DMA 분석, 스택 분석,
  クリティカル分析, 并发分析, análisis de concurrencia,
  Konkurrenzanalyse, analisi di concorrenza

  Do NOT use for: 일반 코드 리뷰 (code-review 사용),
  MISRA 검증만 필요한 경우 (misra-c 사용),
  아키텍처 설계 (fw-architect 에이전트 사용).
argument-hint: "[srcDir]"
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
imports:
  - ${PLUGIN_ROOT}/refs/mcu/concurrency-patterns.md
  - ${PLUGIN_ROOT}/refs/mcu/custom-scheduler-guide.md
  - ${PLUGIN_ROOT}/templates/mcu-critical-report.template.md
next-skill: pdca analyze
pdca-phase: do
task-template: "[Critical Analysis] {feature}"
---

# MCU Critical Analysis Skill

> Detects concurrency bugs, race conditions, and system-critical issues in MCU firmware
> using a 2-Layer architecture: JS extraction modules + LLM reasoning agent.

## Overview

This skill orchestrates:
1. **Layer 1** (JS Extraction): Runs 4 extraction modules to collect structured data
2. **Layer 2** (LLM Reasoning): Invokes `mcu-critical-analyzer` agent for semantic analysis

## Workflow

### Step 1: Determine Source Directory

- If `$ARGUMENTS` is provided, use it as srcDir
- Otherwise, search current directory for `.c`/`.h` files
- Find `.ioc` file if present (optional, enhances NVIC/DMA analysis)
- Find `.map` file if present (optional, enhances stack analysis)
- Find build directory with `.su` files if present (optional)

### Step 2: Run Layer 1 Extraction

Execute extraction functions from `lib/mcu/` modules using Bash:

```bash
node -e "
const mcu = require('./lib/mcu');
const srcDir = '{srcDir}';
const iocPath = '{iocPath}'; // or null

// ISR extraction
const handlers = mcu.extractISRHandlers(srcDir);
const nvicConfig = mcu.extractNVICConfig(iocPath || null, srcDir);
const callGraph = mcu.extractISRCallGraph(srcDir, handlers);
const isrGlobalAccess = mcu.extractISRGlobalAccess(srcDir, handlers);

// DMA extraction
const dmaConfig = mcu.extractDMAConfig(iocPath || null, srcDir);
const dmaBuffers = mcu.extractDMABuffers(srcDir);

// Concurrency extraction
const globalVars = mcu.extractGlobalVariables(srcDir);
const syncPrimitives = mcu.extractSyncPrimitives(srcDir);
const switchPoints = mcu.extractContextSwitchPoints(srcDir);
const atomicOps = mcu.extractAtomicOps(srcDir);

// Tool bridge (optional)
const cppcheck = mcu.runCppcheckThreadsafety(srcDir);
const stackUsage = mcu.extractStackUsage('{buildDir}', '{mapPath}');

// Output summary
console.log(JSON.stringify({
  handlers: handlers.length,
  nvicConfig: nvicConfig.length,
  dmaChannels: dmaConfig.length,
  dmaBuffers: dmaBuffers.length,
  globalVars: globalVars.length,
  syncPrimitives: syncPrimitives.length,
  switchPoints: switchPoints.length,
  atomicOps: atomicOps.length,
  cppcheckAvailable: cppcheck.available,
  cppcheckFindings: cppcheck.findings.length,
  stackAvailable: stackUsage.available,
  stackEntries: stackUsage.entries.length,
}, null, 2));
"
```

### Step 3: Invoke mcu-critical-analyzer Agent

Pass extraction results to the agent. The agent will:
1. Read refs/mcu/concurrency-patterns.md and custom-scheduler-guide.md
2. Execute ConSynergy 4-Stage Pipeline (Identify → Slice → Reason → Verdict)
3. Read actual source code at flagged locations for verification
4. Generate classified issue report

### Step 4: Output Report

- Save report to `docs/03-analysis/mcu-critical/{project}-{YYYYMMDD}.md`
- Display summary in response:

```
MCU Critical Analysis Complete
─────────────────────────────
Critical: N issues (M high confidence)
Warning:  N issues
Info:     N issues
─────────────────────────────
Report: docs/03-analysis/mcu-critical/...
Next: Review critical issues and apply fixes
```

## Usage Examples

```bash
# Analyze current project
/mcu-critical-analysis

# Analyze specific source directory
/mcu-critical-analysis src/

# Analyze after making changes
/mcu-critical-analysis firmware/Core/Src
```

## Integration with PDCA

This skill integrates into the PDCA cycle:
- Typically used during **Do** phase (implementation review)
- Results feed into **Check** phase (`/pdca analyze`)
- Critical issues should be fixed before `/pdca analyze` for better match rate
