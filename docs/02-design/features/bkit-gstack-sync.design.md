# bkit-gstack-sync Design Document

> **Summary**: bkit 흔적 완전 제거 + lib/context/ 임베디드 재작성 + MCP 서버 재작성 + gstack 영감 스킬 3개 신규 설계
>
> **Project**: mcukit
> **Version**: 0.6.2 → 0.7.0
> **Author**: soojang.roh
> **Date**: 2026-04-02
> **Status**: Draft
> **Planning Doc**: [bkit-gstack-sync.plan.md](../../01-plan/features/bkit-gstack-sync.plan.md)
> **Selected Architecture**: Option C — Full Rebrand

---

## 1. Overview

### 1.1 Design Goals

1. **bkit 완전 독립**: 코드베이스에서 bkit 참조를 완전히 제거하여 mcukit이 독립 프로젝트로 진화 가능하게 함
2. **임베디드 특화 컨텍스트 시스템**: bkit v2.0.6의 Living Context System을 웹 중심 로직 없이 MCU/MPU/WPF 전용으로 재설계
3. **MCP 서버 경로 중앙화**: paths.js를 MCP 서버에서도 import하여 경로 관리 일원화
4. **gstack 임베디드 도구**: `/benchmark`, `/investigate`, `/retro`를 3도메인 프리셋으로 신규 설계

### 1.2 Design Principles

- **Single Source of Truth**: 모든 경로는 `lib/core/paths.js`에서만 정의
- **Domain-Aware**: 모든 신규 모듈은 `lib/domain/detector.js`의 감지 결과에 따라 동작 분기
- **Zero bkit**: 라이선스 출처 표기는 `NOTICE.md`로 이관, 코드 내 bkit 참조 0건
- **Graceful Fallback**: 툴체인 미설치 시에도 스킬이 유용한 가이드를 제공

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     mcukit Plugin                            │
│                                                              │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │ paths.js │◀─│ MCP Servers   │  │ lib/context/         │  │
│  │ (SSOT)   │  │ mcukit-pdca   │  │ (NEW: embedded-only) │  │
│  │          │◀─│ mcukit-analysis│  │                      │  │
│  └────┬─────┘  └───────────────┘  └──────────┬───────────┘  │
│       │                                       │              │
│       ▼                                       ▼              │
│  ┌─────────┐  ┌────────────┐  ┌──────────────────────────┐  │
│  │.mcukit/ │  │ domain/    │  │ skills/ (NEW x4)         │  │
│  │ state/  │  │ detector.js│──│ benchmark, investigate,  │  │
│  │ runtime/│  │            │  │ retro, deploy            │  │
│  │ audit/  │  └────────────┘  └──────────────────────────┘  │
│  └─────────┘                                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow — Context System

```
Plan Document ──→ context-loader.js ──→ Context Anchor (5줄 요약)
                       │                      │
                       ▼                      ▼
              domain/detector.js      Design/Do/Analysis 템플릿에 삽입
                       │
                       ▼
              Domain-specific adapters:
              ├── MCU: 링커스크립트 → 메모리맵 → 영향 분석
              ├── MPU: Device Tree → 핀맵 → 영향 분석
              └── WPF: .csproj → 의존성 → 영향 분석
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `lib/context/*` | `lib/core/paths.js`, `lib/domain/detector.js` | 경로 해석 + 도메인 분기 |
| MCP Servers | `lib/core/paths.js` (require) | 경로 중앙화 |
| New Skills | `lib/domain/detector.js` (런타임 감지) | 도메인별 프리셋 |
| `session-guide.js` | `lib/core/paths.js`, `lib/pdca/status.js` | PDCA 상태 참조 |

---

## 3. Detailed Design

### 3.1 Phase 1: Full Rebrand (bkit 완전 제거)

#### 3.1.1 런타임 경로 통일

**현재 상태**: `paths.js`는 이미 `.mcukit/`을 사용하지만, MCP 서버와 일부 스크립트가 `.bkit/`을 하드코딩

**변경 계획**:

| 파일 | 현재 | 변경 |
|------|------|------|
| `servers/mcukit-pdca-server/index.js` | `const BKIT_DIR = path.join(ROOT, '.bkit')` | `const { STATE_PATHS } = require('../../lib/core/paths')` |
| `servers/mcukit-analysis-server/index.js` | `const BKIT_DIR = path.join(ROOT, '.bkit')` | `const { STATE_PATHS } = require('../../lib/core/paths')` |
| `servers/*/package.json` | `"name": "bkit-*-server"` | `"name": "mcukit-*-server"` |

MCP 서버의 `statePath()`, `auditPath()`, `checkpointsDir()` 함수를 paths.js의 `STATE_PATHS`로 교체:

```javascript
// BEFORE (servers/mcukit-pdca-server/index.js)
const ROOT = process.env.BKIT_ROOT || process.cwd();
const BKIT_DIR = path.join(ROOT, '.bkit');
function statePath(filename) { return path.join(BKIT_DIR, 'state', filename); }

// AFTER
const { STATE_PATHS } = require('../../lib/core/paths');
function statePath(filename) { return path.join(STATE_PATHS.state(), filename); }
```

#### 3.1.2 MCP URI 스킴 전환

```javascript
// BEFORE
const RESOURCES = [
  { uri: 'bkit://pdca/status', ... },
  { uri: 'bkit://quality/metrics', ... },
  { uri: 'bkit://audit/latest', ... },
];

// AFTER
const RESOURCES = [
  { uri: 'mcukit://pdca/status', ... },
  { uri: 'mcukit://quality/metrics', ... },
  { uri: 'mcukit://audit/latest', ... },
];
```

#### 3.1.3 MCP 서버 함수명 전환

| 현재 함수명 | 변경 후 |
|-------------|---------|
| `handleBkitPdcaStatus()` | `handlePdcaStatus()` |
| `handleBkitPdcaHistory()` | `handlePdcaHistory()` |
| `handleBkitFeatureList()` | `handleFeatureList()` |
| `handleBkitFeatureDetail()` | `handleFeatureDetail()` |
| `handleBkitPlanRead()` | `handlePlanRead()` |
| `handleBkitDesignRead()` | `handleDesignRead()` |
| `handleBkitAnalysisRead()` | `handleAnalysisRead()` |
| `handleBkitReportRead()` | `handleReportRead()` |
| `handleBkitMetricsGet()` | `handleMetricsGet()` |
| `handleBkitMetricsHistory()` | `handleMetricsHistory()` |

> MCP 도구 이름(mcukit_pdca_status 등)은 이미 mcukit 접두사이므로 변경 불필요.

#### 3.1.4 lib/pdca/status.js 함수명 치환

| 현재 | 변경 |
|------|------|
| `readBkitMemory()` | `readMemory()` |
| `writeBkitMemory()` | `writeMemory()` |

호출자 전수 검색 후 일괄 치환. `lib/common.js` bridge에서도 re-export 갱신.

#### 3.1.5 .bkit/ → .mcukit/ 데이터 마이그레이션

`hooks/startup/migration.js`에 v0.7.0 마이그레이션 추가:

```javascript
// v0.7.0: .bkit/ → .mcukit/ final migration
function migrateBkitToMcukit(projectDir) {
  const bkitDir = path.join(projectDir, '.bkit');
  const mcukitDir = path.join(projectDir, '.mcukit');

  if (!fs.existsSync(bkitDir)) return { migrated: false, reason: 'no .bkit/' };

  const subdirs = ['state', 'runtime', 'audit', 'snapshots', 'checkpoints', 'decisions', 'workflows'];
  let fileCount = 0;

  for (const sub of subdirs) {
    const src = path.join(bkitDir, sub);
    const dest = path.join(mcukitDir, sub);
    if (!fs.existsSync(src)) continue;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    for (const file of fs.readdirSync(src)) {
      const srcFile = path.join(src, file);
      const destFile = path.join(dest, file);
      // 이미 존재하면 .bkit/ 것이 더 최신인 경우에만 덮어씀
      if (!fs.existsSync(destFile) || fs.statSync(srcFile).mtimeMs > fs.statSync(destFile).mtimeMs) {
        fs.copyFileSync(srcFile, destFile);
        fileCount++;
      }
    }
  }

  // pdca-status.json 내부 경로 치환
  const statusPath = path.join(mcukitDir, 'state', 'pdca-status.json');
  if (fs.existsSync(statusPath)) {
    let content = fs.readFileSync(statusPath, 'utf8');
    content = content.replace(/\.bkit\//g, '.mcukit/');
    fs.writeFileSync(statusPath, content);
  }

  return { migrated: true, fileCount };
}
```

#### 3.1.6 라이선스 출처 관리

코드 내 bkit 참조를 모두 제거하되, 법적 의무는 `NOTICE.md`로 이관:

```markdown
# NOTICE

This project includes code derived from the following open source projects:

## bkit-claude-code
- Source: https://github.com/popup-studio-ai/bkit-claude-code
- License: Apache 2.0
- Copyright: POPUP STUDIO
- Derived modules: lib/core/, lib/pdca/, lib/audit/, lib/control/, lib/quality/,
  lib/intent/, lib/task/, lib/team/, lib/ui/

## gstack
- Source: https://github.com/garrytan/gstack
- License: MIT
- Copyright: Garry Tan
- Inspired features: /freeze, /guard, /reframe, /security-review, /ship
```

#### 3.1.7 스킬/에이전트/템플릿 전수 치환 목록

**스킬 (13개)**:

| 스킬 | 치환 대상 |
|------|----------|
| `audit/SKILL.md` | `.bkit/audit/` → `.mcukit/audit/`, `.bkit/decisions/` → `.mcukit/decisions/` |
| `control/SKILL.md` | `.bkit/runtime/control-state.json` → `.mcukit/runtime/...` |
| `rollback/SKILL.md` | `.bkit/checkpoints/`, `.bkit/state/pdca-status.json` |
| `btw/SKILL.md` | `.bkit/btw-suggestions.json` → `.mcukit/state/btw-suggestions.json` |
| `plan-plus/SKILL.md` | `bkit PDCA's structured planning` → `mcukit PDCA's structured planning` |
| `skill-status/SKILL.md` | `bkit core skills`, marketplace 경로 |
| `cc-version-analysis/SKILL.md` | `bkit` 키워드 28회+ → `mcukit` |
| `claude-code-learning/SKILL.md` | `bkit-learning`, `bkit-pdca-guide`, `bkit-enterprise` → `mcukit-*` |
| `dynamic/SKILL.md` | `gstack /cso`, `.bkit-memory.json` |
| `enterprise/SKILL.md` | `.bkit-memory.json`, `bkit-enterprise` |
| `starter/SKILL.md` | `.bkit-memory.json`, `bkit-learning` |
| `security-review/SKILL.md` | `gstack /cso` 출처 → NOTICE.md 참조로 변경 |
| `reframe/SKILL.md` | `Garry Tan (gstack /office-hours)` → NOTICE.md 참조 |

**에이전트 (6개)**:

| 에이전트 | 치환 대상 |
|----------|----------|
| `mcukit-impact-analyst.md` | `name: bkit-impact-analyst` → `name: mcukit-impact-analyst` |
| `pdca-eval-plan.md` | `v1.6.1 baseline vs Customized bkit` → `vs baseline` |
| `gap-detector.md` | `.bkit/{state,runtime,snapshots}/` → `.mcukit/...` |
| `pdca-iterator.md` | `.bkit/{state,runtime,snapshots}/` → `.mcukit/...` |
| `skill-needs-extractor.md` | `bkit-marketplace` 경로 → mcukit 경로 |
| `cc-version-researcher.md` | bkit 관련성 분석 항목 → mcukit |

**템플릿 (7개)**:

| 템플릿 | 치환 대상 |
|--------|----------|
| `TEMPLATE-GUIDE.md` | `"bkit Template Selection Guide"` → `"mcukit Template Selection Guide"` |
| `convention.template.md` | `"Generated by bkit PDCA System"` → `"Generated by mcukit PDCA System"` |
| `iteration-report.template.md` | `"Generated by bkit Evaluator-Optimizer Pattern"` → `mcukit` |
| `cc-version-analysis.template.md` | bkit 관련 섹션 → mcukit |
| `schema.template.md` | bkit 참조 → mcukit |
| `CLAUDE.template.md` | bkit 참조 → mcukit |
| `pm-prd.template.md` | bkit 참조 → mcukit |

**lib 코드**:

| 파일 | 치환 대상 |
|------|----------|
| `lib/common.js` | `"bkit Common Module - Migration Bridge"` → `"mcukit Common Module"` |
| `lib/audit/audit-logger.js` | `"Design Reference: docs/.../bkit-v200-..."` → 제거 |
| `lib/audit/decision-tracer.js` | 동일 |
| `lib/control/guard-mode.js` | `"Inspired by gstack's /guard"` → 제거, NOTICE.md |
| `lib/control/destructive-detector.js` | `"gstack-inspired"` → 제거, NOTICE.md |

**scripts**:

| 파일 | 치환 대상 |
|------|----------|
| `scripts/pre-write.js` | `"gstack-inspired"` 주석 → 제거 |
| `scripts/unified-write-post.js` | `"bkit-rules"` → `"mcukit-rules"` |
| `scripts/instructions-loaded-handler.js` | `"bkit core rules"` → `"mcukit core rules"` |
| `scripts/team-stop.js` | `"bkit-memory.json"` → `"memory.json"` |
| `scripts/pdca-task-completed.js` | `".bkit-memory.json"` → `.mcukit/state/memory.json` |

---

### 3.2 Phase 2: lib/context/ 임베디드 재작성

bkit v2.0.6의 `lib/context/` 7개 모듈을 컨셉만 차용하여 MCU/MPU/WPF 전용으로 재작성.

#### 3.2.1 lib/context/index.js (모듈 통합 export)

```javascript
module.exports = {
  ...require('./context-loader'),
  ...require('./impact-analyzer'),
  ...require('./invariant-checker'),
  ...require('./scenario-runner'),
  ...require('./self-healing'),
  ...require('./ops-metrics'),
  ...require('./decision-record'),
};
```

#### 3.2.2 context-loader.js — PDCA 문서→코드 컨텍스트 로딩

| 기능 | 설명 |
|------|------|
| `loadPlanContext(feature)` | Plan 문서에서 요구사항/제약조건 추출 |
| `loadDesignContext(feature)` | Design 문서에서 아키텍처 결정/파일 목록 추출 |
| `extractContextAnchor(feature)` | 5줄 전략 요약 (WHY/WHO/RISK/SUCCESS/SCOPE) |
| `injectAnchorToTemplate(template, anchor)` | 템플릿에 앵커 삽입 |

**도메인 분기**:
- **MCU**: 메모리 예산 (Flash < 85%, RAM < 75%), 타겟 칩 모델, 주변장치 목록
- **MPU**: Device Tree 호환성, Yocto 레이어 의존성, 커널 버전
- **WPF**: .NET 버전, NuGet 패키지 의존성, MVVM 패턴 준수

#### 3.2.3 impact-analyzer.js — 변경 영향 분석

| 기능 | 설명 |
|------|------|
| `analyzeImpact(changedFiles)` | 변경된 파일의 영향 범위 분석 |
| `getMemoryImpact(changedFiles)` | MCU: 링커스크립트 기반 Flash/RAM 영향 |
| `getDtsImpact(changedFiles)` | MPU: Device Tree 변경 영향 (핀 충돌 등) |
| `getDependencyImpact(changedFiles)` | WPF: .csproj 의존성 변경 영향 |

**MCU 특화 로직**:
```
*.ld 변경 → FLASH/RAM 섹션 파싱 → 사용량 재계산 → 임계값 경고
*.c/*.h 변경 → arm-none-eabi-size 출력 파싱 → 이전 대비 delta
*.ioc 변경 → CubeMX 핀 재배치 → 충돌 감지
```

**MPU 특화 로직**:
```
*.dts/*.dtsi 변경 → dtc -I dts -O dtb 검증 → 에러 보고
local.conf 변경 → bitbake 호환성 검사
defconfig 변경 → 커널 옵션 의존성 체크
```

**WPF 특화 로직**:
```
*.csproj 변경 → NuGet restore 검증
*.xaml 변경 → 바인딩 경로 검증
ViewModel 변경 → View 연결 영향 분석
```

#### 3.2.4 invariant-checker.js — 불변 조건 검증

| 기능 | 설명 |
|------|------|
| `checkInvariants(domain)` | 도메인별 불변 조건 전수 검증 |
| `checkMisra(files)` | MCU: MISRA C:2012 Required 규칙 위반 감지 |
| `checkDtsSyntax(files)` | MPU: Device Tree 구문 검증 |
| `checkMvvmPattern(files)` | WPF: ViewModel이 System.Windows.Controls 참조 안 함 검증 |

#### 3.2.5 scenario-runner.js — 시나리오 기반 검증

도메인별 빌드/검증 시나리오 실행:

| 도메인 | 시나리오 |
|--------|----------|
| MCU | `cmake --build . && arm-none-eabi-size build/*.elf` |
| MPU | `dtc -I dts -O dtb -o /dev/null {dts_file}` |
| WPF | `dotnet build --no-restore` |

#### 3.2.6 self-healing.js — 자동 오류 복구

```javascript
/**
 * Self-healing: 빌드 실패 시 자동 진단 및 수정 제안
 * 모델: 설정 가능 (기본 sonnet, opus fallback)
 */
const HEALING_STRATEGIES = {
  mcu: {
    'undefined reference': '링커스크립트 확인, 소스 파일 누락 검사',
    'region .* overflowed': 'Flash/RAM 사용량 최적화 필요',
    'multiple definition': '헤더 가드 확인, static 선언 검토',
  },
  mpu: {
    'syntax error': 'Device Tree 구문 검증 (dtc)',
    'ERROR: Nothing PROVIDES': 'Yocto 레시피 의존성 확인',
    'do_compile failed': '크로스 컴파일러 툴체인 확인',
  },
  wpf: {
    'NETSDK1005': 'TargetFramework 확인 (net8.0-windows)',
    'CS0246': 'NuGet 패키지 누락, dotnet restore 실행',
    'XDG0062': 'XAML 바인딩 경로 확인',
  },
};
```

#### 3.2.7 ops-metrics.js — 운영 메트릭스

| 메트릭 | MCU | MPU | WPF |
|--------|-----|-----|-----|
| 빌드 시간 | cmake --build 소요 시간 | bitbake 소요 시간 | dotnet build 소요 시간 |
| 바이너리 크기 | arm-none-eabi-size .elf | rootfs 이미지 크기 | publish 출력 크기 |
| 메모리 사용 | Flash/RAM 절대/비율 | /proc/meminfo | 프로세스 메모리 |

#### 3.2.8 decision-record.js — 의사결정 기록

```javascript
/**
 * ADR (Architecture Decision Record) 구조화 기록
 * 저장: .mcukit/decisions/{timestamp}-{title}.json
 */
function recordDecision({ title, context, decision, consequences, domain }) {
  // ...
}
```

---

### 3.3 Phase 3: lib/pdca/session-guide.js 이식

bkit v2.0.5의 Context Anchor 개념을 mcukit에 적응:

| 함수 | 역할 |
|------|------|
| `extractContextAnchor(feature)` | Plan 문서에서 WHY/WHO/RISK/SUCCESS/SCOPE 추출 |
| `formatContextAnchor(anchor)` | 마크다운 형식으로 포맷팅 |
| `analyzeModules(feature)` | Design 문서에서 모듈 분리 분석 |
| `suggestSessions(modules)` | 세션 범위 추천 |

**mcukit 특화 확장**:
- MCU: 메모리 예산을 Context Anchor에 포함 (`BUDGET: Flash 45KB/64KB, RAM 12KB/20KB`)
- MPU: 타겟 보드/커널 버전 포함 (`TARGET: i.MX6ULL EVK, Linux 5.15`)
- WPF: .NET 버전/MVVM 프레임워크 포함 (`STACK: .NET 8, CommunityToolkit.Mvvm`)

---

### 3.4 Phase 4: 신규 스킬 설계

#### 3.4.1 /benchmark — 임베디드 벤치마크

```yaml
---
name: benchmark
description: |
  MCU/MPU/WPF 도메인별 빌드 및 리소스 벤치마크.
  Triggers: benchmark, 벤치마크, ベンチマーク, 基准测试, benchmarking
classification: capability
domain: all
platforms: [stm32, nxp-k, imx6, imx6ull, imx28, wpf]
user-invocable: true
allowed-tools: [Read, Bash, Glob, Grep]
---

## MCU Benchmark Protocol
1. `arm-none-eabi-size build/*.elf` → Flash/RAM 절대값
2. Flash/RAM 사용 비율 계산 (링커스크립트 파싱)
3. 이전 벤치마크와 비교 (`.mcukit/state/benchmark-history.json`)
4. 임계값 경고 (Flash > 85%, RAM > 75%)

## MPU Benchmark Protocol
1. Yocto 이미지 크기: `ls -lh tmp/deploy/images/*/core-image-*.wic`
2. 빌드 시간: bitbake 로그 파싱
3. rootfs 크기: `du -sh tmp/work/*/rootfs/`

## WPF Benchmark Protocol
1. `dotnet build --no-incremental` 빌드 시간 측정
2. `dotnet publish -c Release` 출력 크기
3. NuGet 패키지 수/크기 분석

## Output Format
| Metric | Value | Delta | Status |
|--------|-------|-------|--------|
| Flash  | 45KB  | +2KB  | OK     |
| RAM    | 12KB  | +0.5KB| OK     |
```

#### 3.4.2 /investigate — 임베디드 조사 프로토콜

```yaml
---
name: investigate
description: |
  MCU HardFault/MPU Device Tree 오류/WPF 크래시 체계적 조사.
  Triggers: investigate, 조사, 調査, 调查, investigar, HardFault, 크래시
classification: capability
domain: all
platforms: [stm32, nxp-k, imx6, imx6ull, imx28, wpf]
user-invocable: true
allowed-tools: [Read, Bash, Glob, Grep]
---

## MCU Investigation Protocol (HardFault)
1. **증상 수집**: HardFault 레지스터 값 (CFSR, HFSR, MMFAR, BFAR)
2. **스택 트레이스**: `arm-none-eabi-addr2line -e build/*.elf {PC}`
3. **메모리 분석**: 스택 오버플로 여부 (MSP vs _estack)
4. **근본 원인 분류**: NULL 포인터 / 스택 오버플로 / 정렬 오류 / MPU 위반
5. **수정 제안**: 원인별 맞춤 가이드

## MPU Investigation Protocol (부트/커널)
1. **증상 수집**: dmesg 마지막 100줄, 커널 패닉 메시지
2. **Device Tree 검증**: `dtc -I dts -O dtb` 에러 확인
3. **핀 충돌 분석**: pinctrl 그룹 간 GPIO 중복 검사
4. **드라이버 상태**: `lsmod`, `/sys/bus/platform/drivers/`
5. **근본 원인 분류**: DTS 오류 / 드라이버 미로딩 / 커널 설정 누락

## WPF Investigation Protocol (크래시/예외)
1. **증상 수집**: 예외 타입, 스택 트레이스, InnerException
2. **바인딩 오류**: Output 창 바인딩 에러 확인
3. **MVVM 검증**: ViewModel↔View 연결 점검
4. **NuGet 충돌**: 패키지 버전 호환성 분석
5. **근본 원인 분류**: 바인딩 / 스레딩 / NuGet / 데이터 변환
```

#### 3.4.3 /retro — 엔지니어링 회고

```yaml
---
name: retro
description: |
  PDCA Report 이후 구조화된 엔지니어링 회고.
  Triggers: retro, 회고, 振り返り, 回顾, retrospectiva
classification: workflow
domain: all
user-invocable: true
allowed-tools: [Read, Write, Glob, Grep]
---

## Retrospective Protocol
1. **PDCA 메트릭스 수집**: Report 문서에서 Match Rate, Iteration Count, 작업 기간 추출
2. **What Went Well**: 잘 된 점 (AI 지원 효과, 도메인 스킬 활용도)
3. **What Could Improve**: 개선점 (반복 원인, 컨텍스트 손실, 도구 부족)
4. **Action Items**: 구체적 개선 조치
5. **Lessons Learned**: `.mcukit/state/learnings.json`에 기록

## Output
- `docs/04-report/{feature}.retro.md` — 회고 문서
- `.mcukit/state/learnings.json` — 학습 사항 축적
```

#### 3.4.4 /deploy — 임베디드 배포

```yaml
---
name: deploy
description: |
  MCU 플래시/MPU 이미지/WPF 퍼블리시 배포 가이드.
  Triggers: deploy, 배포, デプロイ, 部署, desplegar
classification: workflow
domain: all
platforms: [stm32, nxp-k, imx6, imx6ull, imx28, wpf]
user-invocable: true
allowed-tools: [Read, Bash, Glob, Grep]
---

## MCU Deploy
1. 빌드 확인: `cmake --build build/`
2. 바이너리 크기 확인: `arm-none-eabi-size build/*.elf`
3. 플래시 프로그래밍: `st-flash write build/*.bin 0x08000000` (STM32)
   또는 `JLinkExe -device {chip} -if SWD -speed 4000 -CommandFile flash.jlink` (NXP)
4. **확인 필요**: 플래시 명령은 수동 승인 필요 (safety rule)

## MPU Deploy
1. 이미지 빌드: `bitbake core-image-minimal`
2. SD 카드 쓰기: `dd if=*.wic of=/dev/sdX bs=1M` (**수동 승인 필수**)
3. 또는 OTA: `swupdate` / `Mender` 클라이언트 사용

## WPF Deploy
1. 퍼블리시: `dotnet publish -c Release -r win-x64 --self-contained`
2. 설치 패키지: MSIX/ClickOnce/InnoSetup
3. 배포 경로 확인
```

---

### 3.5 Phase 5: Self-Healing 에이전트

```yaml
# agents/self-healing.md
---
name: self-healing
model: sonnet
effort: medium
maxTurns: 15
tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
disallowedTools:
  - Agent
memory:
  scope: project
---

# Self-Healing Agent

빌드 실패 또는 런타임 오류 발생 시 자동으로 진단하고 수정을 시도하는 에이전트.

## 동작 원칙
1. 에러 메시지 파싱 → 도메인 감지 (MCU/MPU/WPF)
2. 도메인별 HEALING_STRATEGIES에서 매칭
3. 수정 시도 (최대 3회)
4. 수정 결과를 `.mcukit/decisions/` 에 ADR로 기록
5. 실패 시 사람에게 에스컬레이션

## 제한사항
- 링커스크립트(*.ld), Device Tree(*.dts), .csproj 파일은 수정 전 확인 필요
- 플래시/dd 명령은 절대 자동 실행 금지
```

---

## 4. Implementation Order

| Step | Phase | Task | Files | Est. |
|------|-------|------|-------|------|
| 1 | P0 | `.bkit/` → `.mcukit/` 마이그레이션 로직 | `hooks/startup/migration.js` | 소 |
| 2 | P0 | MCP pdca-server 재작성 (paths.js import, 함수명, URI) | `servers/mcukit-pdca-server/index.js`, `package.json` | 중 |
| 3 | P0 | MCP analysis-server 재작성 | `servers/mcukit-analysis-server/index.js`, `package.json` | 중 |
| 4 | P0 | `lib/pdca/status.js` 함수명 치환 + 호출자 갱신 | `lib/pdca/status.js`, `lib/common.js` | 소 |
| 5 | P0 | `NOTICE.md` 라이선스 출처 파일 작성 | `NOTICE.md` | 소 |
| 6 | P1 | `lib/context/` 7개 모듈 + index.js 신규 작성 | 8개 파일 | 대 |
| 7 | P1 | `lib/pdca/session-guide.js` 작성 | 1개 파일 | 중 |
| 8 | P1 | `agents/self-healing.md` 작성 | 1개 파일 | 소 |
| 9 | P1 | `skills/deploy/SKILL.md` 작성 | 1개 파일 | 중 |
| 10 | P2 | `skills/benchmark/SKILL.md` 작성 | 1개 파일 | 중 |
| 11 | P2 | `skills/investigate/SKILL.md` 작성 | 1개 파일 | 중 |
| 12 | P2 | `skills/retro/SKILL.md` 작성 | 1개 파일 | 소 |
| 13 | P3 | 스킬 13개 bkit 참조 치환 | 13개 파일 | 중 |
| 14 | P3 | 에이전트 6개 bkit 참조 치환 | 6개 파일 | 소 |
| 15 | P3 | 템플릿 7개 bkit 참조 치환 | 7개 파일 | 소 |
| 16 | P3 | lib/scripts bkit 참조 치환 | ~10개 파일 | 소 |
| 17 | P3 | 전수 검증 grep + test-all.js | 전체 | 소 |

---

## 5. Test Plan

### 5.1 Test Scope

| Type | Target | Method |
|------|--------|--------|
| 경로 통일 검증 | `.bkit/` 참조 잔류 0건 | `grep -rn "\.bkit/" lib/ scripts/ servers/ skills/ agents/ templates/` |
| MCP 서버 검증 | 16개 도구 정상 응답 | JSON-RPC 수동 호출 (stdin pipe) |
| 함수명 검증 | `readBkit/writeBkit` 잔류 0건 | `grep -rn "Bkit" lib/` |
| 스킬 로딩 | 55개 스킬 (기존 51 + 신규 4) | `skill-status` 확인 |
| 에이전트 로딩 | 40개 에이전트 (기존 39 + 신규 1) | 에이전트 목록 확인 |
| 마이그레이션 | `.bkit/` → `.mcukit/` 데이터 무손실 | diff 비교 |
| PDCA 워크플로우 | Plan→Design→Do→Check 전체 흐름 | `/pdca status` 정상 출력 |

### 5.2 Test Cases (Key)

- [ ] SessionStart에서 `.bkit/` 자동 마이그레이션 후 `.mcukit/` 정상 참조
- [ ] MCP `mcukit://pdca/status` 리소스 정상 반환
- [ ] `/benchmark` 스킬에서 도메인 자동 감지 후 적절한 프로토콜 실행
- [ ] `/investigate` 스킬에서 MCU HardFault 레지스터 파싱 가이드 출력
- [ ] Context Anchor가 Design→Do 전환 시 자동 삽입

---

## 6. Security Considerations

- [ ] MCP 서버 경로 순회 방지 (feature 파라미터에 `../` 차단)
- [ ] `/deploy` 스킬의 플래시/dd 명령은 반드시 수동 승인 (기존 safety rule 준수)
- [ ] Self-Healing 에이전트의 자동 수정 범위를 소스 코드로 제한 (빌드 스크립트/링커 제외)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-02 | Initial draft — Option C Full Rebrand | soojang.roh |
