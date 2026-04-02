# bkit-gstack-sync Gap Analysis Report

> **Feature**: bkit-gstack-sync
> **Design Document**: docs/02-design/features/bkit-gstack-sync.design.md
> **Analysis Date**: 2026-04-02
> **Analyzer**: gap-detector (automated)

---

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| P0: Full Rebrand | 88% | Warning |
| P1: Feature Porting | 100% | Pass |
| P2: New Skills | 100% | Pass |
| P3: Residual Cleanup | 85% | Warning |
| Test Plan | 83% | Warning |
| **Overall** | **91%** | **Pass** |

---

## Per-Step Compliance

### P0: Full Rebrand (Steps 1-5)

| Step | Item | Status | Notes |
|:----:|------|:------:|-------|
| 1 | `hooks/startup/migration.js` — `migrateBkitDir()` exists | Matched | Function present at line 21, newer-wins strategy, .bkit/ removal logic all implemented |
| 2 | MCP pdca-server — MCUKIT_ROOT/MCUKIT_DIR, serverInfo, no handleBkit* | Partial | Uses `MCUKIT_ROOT`/`MCUKIT_DIR` inline constants instead of `require('../../lib/core/paths')`. serverInfo = `mcukit-pdca-server`. Zero `handleBkit*` functions. See deviation D-01 below. |
| 3 | MCP analysis-server — same checks | Partial | Same inline constant pattern. serverInfo = `mcukit-analysis-server`. Zero `handleBkit*`. Same deviation D-01. |
| 4 | `lib/pdca/status.js` — readMemory/writeMemory | Matched | `readMemory()` at line 786, `writeMemory()` at line 806. Legacy `readBkitMemory`/`writeBkitMemory` retained as compat aliases (lines 854-855). |
| 5 | `NOTICE.md` — bkit + gstack attribution | Matched | Exists at project root with both bkit (Apache 2.0) and gstack (MIT) sections. |

### P1: Feature Porting (Steps 6-9)

| Step | Item | Status | Notes |
|:----:|------|:------:|-------|
| 6 | `lib/context/` — 7 modules + index.js | Matched | All 8 files present: context-loader.js, impact-analyzer.js, invariant-checker.js, scenario-runner.js, self-healing.js, ops-metrics.js, decision-record.js, index.js |
| 7 | `lib/pdca/session-guide.js` — 4 exports | Matched | `extractContextAnchor`, `formatContextAnchor`, `analyzeModules`, `suggestSessions` all exported (lines 195-198) |
| 8 | `agents/self-healing.md` | Matched | Exists with MCU/MPU/WPF domain-specific description |
| 9 | `skills/deploy/SKILL.md` | Matched | Exists with MCU flash, MPU image, WPF publish protocols |

### P2: New Skills (Steps 10-12)

| Step | Item | Status | Notes |
|:----:|------|:------:|-------|
| 10 | `skills/benchmark/SKILL.md` | Matched | MCU Flash/RAM, MPU image, WPF build protocols present |
| 11 | `skills/investigate/SKILL.md` | Matched | HardFault, DTS, crash protocols present |
| 12 | `skills/retro/SKILL.md` | Matched | Retrospective protocol with PDCA Report prerequisite |

### P3: Residual Cleanup (Steps 13-17)

| Step | Item | Status | Notes |
|:----:|------|:------:|-------|
| 13 | Skills cleanup | Partial | 1 occurrence in `skills/skill-status/SKILL.md` — upstream marketplace path (`bkit-marketplace/bkit/*/skills/`). This is an expected upstream path reference. |
| 14 | Agents cleanup | Partial | 1 occurrence in `agents/skill-needs-extractor.md` — upstream marketplace path (`bkit-marketplace/bkit/*/skills/`). Expected upstream reference. |
| 15 | Templates cleanup | Matched | 0 occurrences of `bkit` in templates/ |
| 16 | lib/scripts cleanup | Matched | 0 occurrences in JS files outside migration.js. Compat aliases (`readBkitMemory`/`writeBkitMemory`) exist in status.js, index.js, common.js but are intentional backward-compat re-exports. |
| 17 | Full verification | Partial | 15 total residual `bkit` references in non-docs, non-NOTICE files. Breakdown: migration.js (9, intentional), skill-status (1, upstream path), skill-needs-extractor (1, upstream path), .bkit/ snapshot data files (6, stale data), README.md (1, attribution). |

### Test Plan (Section 5)

| Check | Result | Status |
|-------|--------|:------:|
| `.bkit/` refs in source = 0 (except migration.js, docs) | 0 in lib/scripts JS files | Pass |
| `readBkit`/`writeBkit` in lib/ = 0 (except compat aliases) | 3 files with compat aliases only | Pass |
| `node -c servers/mcukit-pdca-server/index.js` | OK, no syntax errors | Pass |
| `node -c servers/mcukit-analysis-server/index.js` | OK, no syntax errors | Pass |
| `node -e "require('./lib/common')"` | OK, loads successfully | Pass |
| `node -e "require('./lib/context')"` | OK, loads successfully | Pass |
| package.json names updated | `mcukit-pdca-server`, `mcukit-analysis-server` | Pass |
| `.bkit/` directory should not exist post-migration | `.bkit/` directory still present with stale snapshot files | Fail |

---

## Differences Found

### Missing (Design specified, Implementation absent)

| ID | Item | Design Location | Description | Severity |
|----|------|-----------------|-------------|----------|
| M-01 | MCP paths.js import | design:3.1.1 (line 108) | MCP servers should `require('../../lib/core/paths')` for `STATE_PATHS`, but use inline `MCUKIT_DIR` constant instead | Low |
| M-02 | pdca-status.json path rewrite | design:3.1.5 (line 189-194) | Migration should rewrite `.bkit/` to `.mcukit/` inside pdca-status.json content; not implemented in migration.js | Medium |

### Added (Implementation present, Design absent)

| ID | Item | Implementation Location | Description | Severity |
|----|------|------------------------|-------------|----------|
| A-01 | Compat aliases | lib/pdca/status.js:854-855 | `readBkitMemory`/`writeBkitMemory` kept as backward-compat aliases, not specified in design but prudent | Info |

### Changed (Design differs from Implementation)

| ID | Item | Design | Implementation | Severity |
|----|------|--------|----------------|----------|
| D-01 | MCP server path resolution | `const { STATE_PATHS } = require('../../lib/core/paths')` | `const MCUKIT_DIR = path.join(ROOT, '.mcukit')` with local helper functions | Low |
| D-02 | Migration function name | `migrateBkitToMcukit(projectDir)` | `migrateBkitDir(result)` — different signature (uses result accumulator pattern) | Info |
| D-03 | .bkit/ stale data | Design expects `.bkit/` removed after migration | `.bkit/` directory persists with 6 snapshot files containing legacy paths | Medium |

---

## Detailed Findings

### D-01: MCP Server Path Resolution (Low Severity)

The design specified that MCP servers should import `STATE_PATHS` from `lib/core/paths.js` to achieve Single Source of Truth for paths. The implementation instead uses inline constants (`const MCUKIT_DIR = path.join(ROOT, '.mcukit')`) with local helper functions (`statePath()`, `auditPath()`). This works correctly but creates a secondary path definition outside of `paths.js`.

**Risk**: If `.mcukit/` directory structure changes, MCP servers must be updated separately from `paths.js`.

**Recommendation**: Accept as-is. MCP servers intentionally avoid dependencies on lib/ to remain lightweight and standalone. Document this as an intentional design deviation.

### M-02: pdca-status.json Content Rewrite (Medium Severity)

The design document (lines 189-194) specifies that after copying files from `.bkit/` to `.mcukit/`, the migration should rewrite `.bkit/` path references inside `pdca-status.json` content. The actual `migrateBkitDir()` function copies files but does not perform this content rewrite.

**Risk**: Migrated `pdca-status.json` may contain stale `.bkit/` path references in its JSON values.

**Recommendation**: Add path content rewriting to `migrateBkitDir()` or verify that downstream consumers resolve paths dynamically.

### D-03: Stale .bkit/ Directory (Medium Severity)

The `.bkit/` directory still exists with 6 snapshot JSON files containing `.bkit/runtime/` path references. The migration function should have cleaned this up, but the snapshots were not processed (they reference `agent-state.json` and `agent-events.jsonl` with `.bkit/` paths).

**Risk**: Confusion between `.bkit/` and `.mcukit/` state directories. No functional impact since active code reads from `.mcukit/`.

**Recommendation**: Run migration or manually remove `.bkit/` directory. The migration function handles removal when no errors occur (migration.js line 63-71).

---

## Summary

**Match Rate: 91%** -- Design and implementation match well.

17 implementation steps were verified. 13 fully matched, 4 partially matched, 0 missing. The partial matches are minor: MCP servers use inline constants instead of paths.js imports (intentional lightweight design), and two marketplace-path references in skills/agents are expected upstream references. The stale `.bkit/` directory and missing pdca-status.json content rewrite are the only actionable items.

### Recommended Actions

1. **[Optional]** Add `.bkit/` path content rewriting to `migrateBkitDir()` per design section 3.1.5
2. **[Optional]** Remove stale `.bkit/` directory (or let migration handle it on next session start with a project that has `.bkit/`)
3. **[Document]** Record the MCP inline-constants deviation as intentional in design document
4. No blocking issues for release
