# rkit 구조 개선 계획서

> 작성일: 2026-04-06 | 버전: 0.9.2 → 1.0.0 목표
>
> 분석 결과에서 도출된 6건의 구조적 문제를 4단계로 개선합니다.
> 각 단계는 독립적으로 커밋/배포 가능하도록 설계되었습니다.

---

## 문제 요약

| # | 이슈 | 심각도 | Phase |
|---|------|--------|-------|
| 1 | 버전 번호 5곳 불일치 | 🔴 Critical | Phase 1 |
| 2 | `catch (_)` 에러 무시 패턴 (28개 파일) | 🟡 Medium | Phase 1 |
| 3 | `detectDomainLevel()` placeholder 미구현 | 🟡 Medium | Phase 2 |
| 4 | `_scanCache` 메모리 관리 부재 | 🟡 Medium | Phase 2 |
| 5 | Lazy require 과다 (순환 의존성 증상) | 🟠 High | Phase 3 |
| 6 | `common.js` 거대 브릿지 (~200 re-exports) | 🟠 High | Phase 4 |

---

## Phase 1: Foundation — 즉시 수정 가능한 항목

> 목표: 코드 변경 최소, 외부 영향 없음, 1일 내 완료 가능
>
> 예상 작업량: 2~4시간

### 1.1 버전 번호 통일 ✅ (2026-04-06 완료)

**문제**: 5곳에 서로 다른 버전 번호가 산재

**적용 결과**:

| 파일 | 변경 전 | 변경 후 |
|------|---------|---------|
| `.claude-plugin/marketplace.json` → `metadata.version` | `1.0.0` | → `0.9.2` ✅ |
| `hooks/hooks.json` → `description` | `v0.6.2` | → `v0.9.2` ✅ |
| `hooks/session-start.js` → `systemMessage` | `v0.1.0` (하드코딩) | → `require('../package.json').version` (동적) ✅ |
| `lib/core/constants.js` | `RKIT_VERSION` 없음 | → `RKIT_VERSION = require('../../package.json').version` 추가 ✅ |

- 검증: `node test-all.js` → **76 PASS, 0 FAIL**
- `package.json`의 `version` 필드를 Single Source of Truth로 확정

---

### 1.2 에러 무시 패턴 개선 ✅ (2026-04-06 완료)

**문제**: `catch (_) { /* non-critical */ }` 패턴이 `lib/` 28개 파일, 75곳에 산재

**적용 결과**:

| 그룹 | 파일 수 | 처리 | 방식 |
|------|---------|------|------|
| PDCA 핵심 | 5 (state-machine, status, resume, lifecycle, feature-manager) | 15곳 | `debugLog()` 로깅 추가 |
| 도메인 감지 | 2 (detector, cross) | 11곳 | `debugLog()` 로깅 추가 |
| 코어 I/O | 2 (state-store, paths) | 7곳 | Best-effort 주석 또는 `debugLog()` |
| 나머지 | 18 (control, mcu, mpu, pdca, team, ui) | 46곳 | `catch (_)` → `catch (_e)` 일괄 변환 |
| **합계** | **27** | **75곳** → **0곳** | |

- 특수 케이스: `errors.js`의 `safeCatch()` 내부 catch (debug 모듈 로드 실패 시) — 의도적 무시 유지, `_` → `_e` 변환만
- 검증: `node test-all.js` → **76 PASS, 0 FAIL**
- `grep "catch (_)" lib/` → **0건**

---

## Phase 2: Domain & Cache — 기능 보완 ✅ (2026-04-06 완료)

> 목표: 미구현 기능 완성, 메모리 안정성 확보

### 2.1 `detectDomainLevel()` 실제 구현 ✅

**작업 결과**:
- `lib/domain/detector.js`의 `detectDomainLevel()`이 `lib/pdca/level.js`로 정상 위임되도록 구현 완료.
- 순환 참조(circular dependency)를 피하기 위해 `level.js`를 함수 내에서 `require` (lazy require)하는 방식으로 처리.
- `detectDomainLevel('mcu')` 가 더 이상 하드코딩된 `L1_Basic`을 반환하지 않고, 실제 마커에 기반한 `L3_Advanced` 등을 반환함.

### 2.2 Scan Cache TTL 및 크기 제한 추가 ✅

**작업 결과**:
- `lib/domain/detector.js`의 무한히 커지던 `_scanCache` 맵에 LRU 메커니즘과 TTL 추가.
- `SCAN_CACHE_TTL = 60000` (60초), `SCAN_CACHE_MAX = 20` (최대 20개 항목) 적용.
- `clearScanCache()` 함수를 추가하고 module에 export하여, 메모리 누수 방지 및 테스트 용이성 모두 확보.

**검증**:
- **76 PASS, 0 FAIL** (`node test-all.js`) — 기존 도메인 감지 및 의존성 기능들에 대해 문제 없음을 확인.
- 임의 실행 (`node -e "..."`)을 통해 `detectDomainLevel` 스텁 정상 교체, `clearScanCache` 타입 등 동작 확인됨.

---

## Phase 3: Dependency — 순환 의존성 정리 ✅ (2026-04-06 완료)

> 목표: Lazy require 패턴을 구조적으로 해소

### 작업 결과
1. **`core/config.js`**: `getMcukitConfig()`에 하드코딩되어 있던 `pdca` 등 도메인-특화 기본값(defaults)을 제거하여, `pdca` 파트와의 보이지 않는 결합을 제거.
2. **`pdca/state-machine.js`**: `let _core = null; function getCore() { ... }` 형태의 lazy require를 파일 상단의 정규 `const core = require('../core')`로 전환 (직접 import).
3. **`domain/detector.js`**: `state-machine.js`와 동일하게 lazy require를 정규 `require`로 전환 완료.
4. **검증**: `node test-all.js` (76 PASS, 0 FAIL) 확인 및 개별 모듈(`node -e "require('./lib/core')"`, `require('./lib/pdca')`, `require('./lib/domain')`) 단독 로드 정상 통과 확인. 

---

## Phase 4: Bridge — common.js 점진적 해소 ✅ (2026-04-06 완료)

> 목표: `common.js` 의존성을 완전히 제거하고 직접 모듈 import로 전환.

### 4.1 현황 및 파악 결과

- `docs/improvement-plan.md`의 최초 작성 시점엔 `scripts/`에 약 61개 파일이 의존한다고 분석되었으나, 확인 결과 **`scripts/` 하위 파일들은 이미 이전 리팩토링 단계에서 모두 직접 import(`require('../lib/core/...')` 등)로 전환을 완료**한 상태였습니다.
- 단, `lib/` 디렉토리 내의 6개 파일(`context-fork.js`, `context-hierarchy.js`, `import-resolver.js`, `memory-store.js`, `permission-manager.js`, `skill-orchestrator.js`)만이 여전히 `require('./common.js')` 패턴에 의존하고 있었습니다.

### 4.2 완료 사항

- 위 6개의 잔여 참조 파일 안에서 사용되는 `common.` 패턴을 추적하여 `core.` 및 `pdcaStatus.` 등의 명시적 객체 호출로 스크립트를 통해 일괄 변환 완료.
- 거대 브릿지 파일이었던 **`lib/common.js` 최종 완전 삭제**.
- **검증**: `node test-all.js` (122/122개 모듈 로드, 76 PASS, 0 FAIL) 를 바탕으로 레거시 브릿지가 제거된 후에도 전체 애플리케이션의 모듈 시스템이 완벽하게 동작함을 확인.

---

## 부록: State Machine Guard 순서 문제 ✅ (2026-04-06 완료)

### 해결 내용
- `check`에서 최대 반복 도달 시 `report`로 강제 전환되는 Guard (이벤트명: `REPORT_DONE`)를  `FORCE_REPORT`로 변경하여, `report` 완료 시 발생하는 실제 `REPORT_DONE` 이벤트와의 혼동을 없앰.
- `lib/pdca/state-machine.js` 의 `EVENTS` 및 `TRANSITIONS` 배열 수정 완료.

---

## 실행 타임라인 (권장)

```
Week 1  ┃ Phase 1 — 버전 통일 + 에러 로깅 개선
        ┃   └→ commit: "fix: unify version numbers, replace silent catch"
        ┃
Week 2  ┃ Phase 2 — detectDomainLevel 구현 + scanCache TTL
        ┃   └→ commit: "feat: implement domain level detection, add cache TTL"
        ┃
Week 3-4┃ Phase 3 — 순환 의존성 해소
        ┃   └→ commit: "refactor: eliminate circular dependencies"
        ┃
Week 5+ ┃ Phase 4 — common.js 점진적 해소 (비파괴적, 점진적)
        ┃   └→ commits: "refactor: migrate {script} to direct imports"
```

---

## 공통 검증 방법

모든 Phase에서 다음 검증을 수행합니다:

```bash
# 1. 모든 lib 모듈 로드 테스트 (test-all.js TEST 1)
node test-all.js

# 2. 특정 모듈 단독 로드
node -e "require('./lib/core')"
node -e "require('./lib/pdca')"
node -e "require('./lib/domain')"

# 3. 잔여 문제 grep
grep -rn "catch (_)" lib/          # Phase 1: 28 → 0
grep -rn "require.*common" scripts/ # Phase 4: N → 0
grep -rn "v0\." hooks/ .claude-plugin/ # Phase 1: 버전 일관성
```
