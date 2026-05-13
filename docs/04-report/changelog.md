# Changelog

## [0.9.14] - 2026-05-13

### Released

- **bkit-gstack-sync-v2 5-cycle 사슬 종결** (PR #6, merge `67bb2d8`):
  - cycle 1.5 / 2 / 3 / 4 / 5 archived, 평균 Match Rate **99.28%**
  - 73 SKILL 100% 변환 (cycle15 4 + cycle3 neutral 19 + grandfathered 23 + cycle5 neutral 20 + grandfathered 7)
  - 8 SoT: `policies/{manifest, never-gate, network-allowlist, locked-vocab v1.1, decisions/cycle2~5-matrix, escalation-policy}.json`
  - 9 verify-policy checks (body-neutrality / vocab-preservation / forbidden-tokens / eval-syntax / sot-schema / manifest-sync / decisions-matrix / network-egress / pii-in-logs)
  - 무한 defer 메커니즘적 차단 — D-3 STRICT R1~R7 + escalation_count prohibit_at=3 작동 검증 (cycle 4)
  - permanent_reject 플래그 (CR-7 / CR4-1 / CR4-2 / CR4-3 / CR4-5)
  - cascade_origin + escalation_history (cycle 4 신규 필드)

- **cpp-static-analysis 통합** (PR #5, merge `a711b64`):
  - `scripts/cpp-static-analysis/` 22 Python 파일 (rapp_review 흡수)
  - `hooks/cpp-post-edit.py` PostToolUse non-blocking hook (stderr only)
  - `scripts/cpp-static-analysis-hook.js` Node ↔ Python bridge (3s timeout)
  - `skills/cpp-static-analysis/` SKILL (capability, cycle3-body-neutral)
  - `/code-review` C/C++ Pre-Analysis 자동 통합
  - PR review 통합 fix: timeout 예산 / silent failure 차단 / 확장자 통일 (`.c` 포함) / POSIX `python3` fallback / canary 6 패턴 분리 채택

### Added

- **Decision Matrix Cycle 3 (cycle3-matrix.json)** — 8 candidates, 3 신규 필드, STRICT mode
- **Escalation Policy (escalation-policy.json)** — Hybrid warn@1 fail@2 prohibit@3
- **SBOM Automation** — CycloneDX JSON via `scripts/gen-sbom.mjs` + `.github/workflows/sbom.yml`
- **Canary Token Scanner** — `scripts/security/scan-canary.mjs` (6 regex: AWS / GitHub PAT / OpenAI / OpenAI Project / Slack / Google)
- **Audit Logger nested PII sanitization** — `sanitizeDetails` depth-3 재귀 + 배열 sanitize
- **PII Anonymization** — `lib/core/anonymize-fingerprint.js` (sha256:14 + salt + O_EXCL, Windows ACL hardening)
- **Context Budget Guard** — `lib/core/context-budget.js` (8000-char cap + priority preserve)
- **Worktree Advisory** — `lib/core/worktree-detector.js` (Git worktree #46808 회피)
- **PDCA Status Facade Split** — `lib/pdca/status.js` 863 lines → 5 submodules (schema/store/feature-lifecycle/context/memory-io)
- **Domain Ports** — `lib/domain/ports/{state-store, audit-sink, cc-payload, docs-code-index}.port.js` (type-only)
- **Infra Adapters** — `lib/infra/{cc-bridge, docs-code-scanner}.js` with `@implements` JSDoc
- **Tools** — `scripts/{verify-policy, check-sunset, skill-body-extract, gen-sbom, gen-locked-vocab, pdca-regression-purge, verify-status-schema}.{js,mjs}`
- **Policy Docs** — `docs/policy/{gdpr-cc-regression, pii-anonymization, network-egress, supply-chain-sbom, escalation, cycle2-decision-format, canary-tokens, gstack-sync-policy}.md`

### Tests

- **214 smoke TC PASS** (cycle 2 78 + cycle 3 46 + cycle 4 56 + cycle 5 6 + cpp-static-analysis 19 + audit-sanitize / 등)
- Multi-cycle STRICT 분기 검증 + cycle 2 legacy 면제
- escalation_count prohibit_at 자기 강제력 자동 검증
- canary scan 0 leaks / 1745 files

### Deprecated

- `scripts/pdca-regression-purge.mjs` — `@deprecated cycle-4 CR4-1 reject`. lib/cc-regression/ 영구 미도입, standalone jsonl purge 도구로 격하.
- `docs/policy/gdpr-cc-regression.md` — `Status: OBSOLETE` banner. cycle 4 CR4-1 permanent_reject로 신규 코드 도입 기준 제외 (결정 이력 보존).

---

## [2026-05-13] - bkit-gstack-sync-v2 Cycle 3 Completion

### Added
- **Decision Matrix Cycle 3**: `policies/decisions/cycle3-matrix.json`
  - 8 candidates (CR-1~CR-8): 6 carry-over from cycle-2 + 2 new (CR-5 SBOM, CR-7 C orchestrator)
  - 3 new fields: `cycle_origin`, `predecessor_decision`, `escalation_count`
  - Decision enum: adopt (1) / partial_adopt (2) / defer (2) / reject (3)
  - Permanent reject: CR-7 C orchestrator (cycle-4+ rediscussion blocked)
  - Escalation Hybrid: warn@1 / fail@2 (override_reason >= 80char required) / prohibit@3 (defer forbidden)

- **Escalation Policy**: `policies/escalation-policy.json`
  - STRICT mode R1~R7 rules (reasoning >= 50char, unblock_condition >= 30char + verb + R3 pattern rejection)
  - Max defer escalation: prohibit_at = 3
  - Applies to cycle-3+ matrices with manifest registration

- **SKILL Transformation** (42 total):
  - Workflow (7): `/pdca`, `/mr`, `/ship`, `/rollback`, `/freeze`, `/skill-create`, `/skill-status` — marker pairs + section 0
  - Capability Grandfathered (23): MCU 9 + MPU 11 + WPF 3 — frontmatter + body-neutrality exempt
  - Neutral Phase (9): `/phase-1` ~ `/phase-9`
  - Neutral Level (3): `/starter`, `/dynamic`, `/enterprise`
  - Tool: `scripts/skill-body-extract.mjs` (scan/insert-markers/verify modes)

- **Port Implementations**:
  - `lib/domain/ports/cc-payload.port.js` (type-only) — JSDoc in `lib/infra/cc-bridge.js`
  - `lib/domain/ports/docs-code-index.port.js` (type-only) — JSDoc in `lib/infra/docs-code-scanner.js`
  - Hexagonal architecture: zero circular deps, port→infra one-way

- **SBOM Automation** (CycloneDX):
  - `scripts/gen-sbom.mjs`: `npm ci --ignore-scripts --prefer-offline` + @cyclonedx/cyclonedx-npm JSON output
  - `.github/workflows/sbom.yml`: pull_request + push main + schedule weekly + workflow_dispatch
  - CI: `npm audit signatures` on GitHub Actions (offline local + signature CI split)
  - Output: `sbom/bom.json` (linguist-generated)

- **Verification & Policy**:
  - `scripts/verify-policy.js` enhanced: manifest enumeration + STRICT flag branching (cycle2 legacy exempt)
  - `scripts/check-sunset.js` updated: current >= sunset FAIL, remaining <= 1 WARN
  - `docs/policy/escalation.md`: Escalation policy documentation + final_revisit_by hard deadline mechanism

- **Test Suite**: 46 smoke tests in `tests/cycle3/` (4 files, 153% target achievement)
  - decisions-strict-gate (19 TC): R1~R7 rules, escalation_count, permanent_reject
  - workflow-skill-conversion (6 TC): marker pairs, section 0, locked-vocab
  - capability-skill-conversion (7 TC): grandfathered frontmatter, body-neutrality
  - ports-and-sbom (14 TC): type-only isolation, cc-bridge/docs-code-scanner impl, SBOM generation
  - Regression: cycle2 78/78 PASS maintained

### Changed
- **cycle2-matrix.json**: Legacy rules preserved (R1 >= 20char, R2 OR condition) via STRICT flag false
- **manifest.json**: 2 new SoT entries (cycle3-matrix + escalation-policy) with since:cycle-3 metadata
- **Governance**: D-3 gate strengthened — "cycle-N carryover" single reason now rejected, unblock_condition must be specific
  
### Deferred to Cycle 4
- CR-6 E + CO-2: cc-regression hash-only + opt-in + retention + purge (escalation_count=2 → 3 at cycle-4 prohibits defer)
- CR-8 CO-1 JSONL: Depends_on CR-6, cascade defer (escalation_count=2)
- CR-2 regression-registry + token-meter (2 ports): Cascade unblock via CR-6

### Rejected (Non-Negotiable for Future Cycles)
- CR-1 A (3 modules): version.js / session-ctx-fp.js / session-title-cache.js
- CR-4 CO-4 BKIT_VERSION SoT: Depends_on CR-1 (A.version reject)
- CR-7 C orchestrator (permanent_reject=true): 4 responsibility overlaps + asymmetric architecture

---

## [2026-05-13] - bkit-gstack-sync-v2 Cycle 2 Completion

### Added
- **Governance SoT**: 6 new policy files in `policies/`
  - `manifest.json`: SoT registry with version + validator + since metadata
  - `decisions/cycle2-matrix.json`: 11 candidates × 5-decision enum (adopt/partial_adopt/defer/reject/pending) with decided_by + evidence + reasoning
  - `never-gate.json`: 8 NEVER_GATE checks (5 from cycle-1.5 + 3 new: network_egress, pii_in_logs, regression_retention) with sunset meta
  - `network-allowlist.json`: egress=deny + 14 blocked patterns + 6 exempt paths
  - `locked-vocab.json` (v1.1): scope field (neutral|domain) for word classification
  - `version.json` (conditional CO-4): BKIT_VERSION SoT placeholder

- **Policy Documents** (6 files in `docs/policy/`):
  - `cycle2-decision-format.md`: decided_by schema + role/id semantics
  - `pii-anonymization.md`: sha256(salt+path) 14-char fingerprint + O_EXCL race protection + win32 lowercase
  - `gdpr-cc-regression.md`: hash-only + 90-day retention + opt-in prompt + purge command
  - `network-egress.md`: 6+ egress patterns (http/https/fetch/axios/got/WebSocket/etc) + production node_modules exempt removed
  - `supply-chain-sbom.md`: npm ci --ignore-scripts + npm audit signatures NFR
  - `gstack-sync-policy.md` (updated): cycle-2 integration notes

- **Verification Tools** (3 scripts):
  - `scripts/check-sunset.js`: Stop hook for transitional gate sunset alert (30-day warning, fail on sunset)
  - `scripts/pdca-regression-purge.mjs`: cc-regression cleanup with .lock + atomic write + isTTY check
  - `scripts/verify-status-schema.js`: ARCHIVED_FEATURES dynamic parsing + forward compatibility

- **Modules Adopted**:
  - `lib/core/context-budget.js`: 8000-char cap + priorityPreserve for hook output
  - `lib/core/worktree-detector.js`: .rkit/runtime/ flag advisory
  - `lib/core/anonymize-fingerprint.js`: PII anonymization algorithm (FR-09)
  - `lib/domain/ports/state-store.port.js`: Type-only interface
  - `lib/domain/ports/audit-sink.port.js`: Type-only interface
  - `lib/infra/docs-code-scanner.js`: Document-code consistency checker
  - `lib/infra/cc-bridge.js`: Claude Code metadata bridge
  - `lib/pdca/status.js` refactored: Facade pattern (61 lines) + 5 submodules (748 lines) for clean separation
    - `lib/pdca/status/schema.js`
    - `lib/pdca/status/store.js`
    - `lib/pdca/status/feature-lifecycle.js`
    - `lib/pdca/status/context.js`
    - `lib/pdca/status/memory-io.js`

- **Test Suite**: 78 smoke tests in `tests/cycle2/` (11 files)
  - decisions-matrix (9 TC): Matrix schema, enum, completion gate
  - lib-core-adopt (12 TC): context-budget, worktree-detector modules
  - lib-domain-ports (3 TC): Port interfaces
  - lib-infra-adopt (16 TC): docs-code-scanner, cc-bridge
  - locked-vocab-scope (5 TC): v1.1 scope field
  - manifest-sync (3 TC): Manifest ↔ policies/ consistency
  - pii-anonymize (7 TC): Salt race + win32 case-sensitivity + 14-char length
  - regression-retention (4 TC): 90-day purge + lock + TTY
  - status-facade-split (11 TC): 27 exports preservation + backward compat
  - status-schema-compat (3 TC): ARCHIVED dynamic parsing
  - sunset-alert (5 TC): check-sunset behavior

### Changed
- **verify-policy.js**: Extended from 5 checks to 9 checks (+4)
  - Added: pii_in_logs, network_egress, decisions-matrix, manifest-sync
  - Preserved: body-neutrality, vocab-preservation, forbidden-tokens, eval-syntax, sot-schema
- **locked-vocab.json**: Added `scope_enum` + `scope_policy` (v1.1)
- **gen-locked-vocab.mjs**: Updated for scope field awareness
- **hooks/hooks.json**: Added check-sunset Stop hook

### Fixed
- **Codex stop-hook findings** (3 commits):
  - dead code (A unused export) resolved in PR-2 integration
  - Instinct + PDCA Progress truncation (context-budget integration, f7f482d)
  - scanVersions canonical SoT correction (package.json not rkit.config.json, 697ea3d)

### Metrics
- **Match Rate**: 96.4% (15 FRs: 13 complete + 2 intentional partial/defer, 13 DRs: 100%)
- **Decision Coverage**: 11/11 candidates non-pending (1 adopt, 4 partial_adopt, 5 defer, 1 reject)
- **Test Pass Rate**: 78/78 TC PASS (100%)
- **Policy Validation**: 9/9 verify-policy checks PASS
- **Codex Issues**: 3/3 resolved
- **Governance**: cycle2-matrix.json 100% completion gate PASS
- **Architecture Compliance**: 0 circular dependencies, 0 external egress violations
- **Execution Time**: 1.5 days (Plan+Design 28 days prior, Do+Check+Act 1.5 days = 40% faster than cycle-1)

### Decisions Made
- **D-1 (Identity)**: (b) Common AI development base (not embedded-only)
- **D-7 (Vocab Scope)**: locked-vocab scope field + domain-scoped: true grandfathered
- **D-8 (GDPR)**: Hash-only + 90-day retention + purge + local-only + opt-in
- **User-1 (Manifest)**: SoT registry with auto-enforcement
- **User-2 (Sunset)**: check-sunset Stop hook + transitional sunset meta
- **User-3 (SBOM)**: npm ci --ignore-scripts + audit signatures NFR

### Carry-Over to Cycle 3
- A remaining 3 modules (version.js, session-ctx-fp.js, session-title-cache.js)
- B remaining 4 ports (cc-payload, docs-code-index, regression-registry, token-meter)
- CO-4: version.json SoT (depends on A.version adoption)
- FR-14: SBOM automation (policy document complete, CI integration cycle-3)
- E + CO-2: cc-regression + canary tokens (opt-in + hash refactor cycle-3+)
- CO-3: 28 SKILL body text application (classification table cycle-2 only)

### Notes
- rkit identity shift from "embedded-specific tool" to "common AI development foundation" — supporting any technical domain
- Governance + auto-verification + decision tracking 3-tier structure fully operational
- 3-PR decomposition: PR-1 governance (8 commits) → PR-2 implementation (8 commits) → PR-3 decisions (4 commits)
- All deferred items intentionally specified in Design v0.2 (not gaps)
- Ready for cycle-3 multi-track execution: A/B/CO-4 deep-dive + C/D/E/F scope clarification + CO-3 SKILL application

## [2026-04-03] - mcu-domain-v2 Completion

### Added
- **mcu-critical-analyzer**: Opus agent implementing ConSynergy 4-Stage pipeline for concurrency/critical issue analysis
- **Extraction Layer (Layer 1)**: 4 JS modules (13 functions) extracting ISR/DMA/concurrency/tool data
  - `isr-extractor.js`: ISR handlers, NVIC config, call graphs, global access (4 functions)
  - `dma-extractor.js`: DMA channels, buffers, peripheral mapping (3 functions)
  - `concurrency-extractor.js`: Global vars, sync primitives, context switches, atomic ops (4 functions)
  - `tool-bridge.js`: cppcheck threadsafety, GCC stack usage (2 functions)
- **Reference Library**: 12 concurrency patterns (CP-01 to CP-12) with severity + detection rules + MISRA/CERT references
- **Custom Scheduler Guide**: Configurable patterns for team's non-FreeRTOS scheduler (16 sync + 9 switch patterns)
- **Skill**: `/mcu-critical-analysis [srcDir]` user-facing interface (workflow classification)
- **Report Template**: Structured critical issue report with severity × confidence matrix

### Changed
- **lib/mcu/index.js**: Added re-exports for 4 new modules (isr-extractor, dma-extractor, concurrency-extractor, tool-bridge)
- **MCU domain scope**: 6 → 10 modules, 24 → 37 functions total

### Metrics
- Design-implementation match rate: 98% (no iteration needed)
- Modules implemented: 4 extraction + 1 agent + 1 skill + 2 references + 1 template
- Functions: 13 new (4+3+4+2)
- Pattern coverage: 12 concurrency patterns with academic backing (ConSynergy, SDRacer, IntRace, SADA)
- Execution time: 1 day (Plan Plus + Design + Do + Check → no Act phase)
- Files created: 10 new files, 1 updated

### Notes
- Custom scheduler specialization: First AI tool for non-FreeRTOS concurrency analysis
- Architecture: Hybrid 2-Layer (deterministic JS extraction + semantic LLM reasoning)
- Integration: Zero breaking changes, backward compatible with existing MCU domain
- Next: Live validation on team codebase, confidence calibration, scheduler pattern customization

## [2026-04-03] - eval-full-coverage Completion

### Added
- **runner.js**: 5 new criteria keyword categories (code, safety, architecture, api, config) for enhanced eval validation
- **config.json**: 12 new rkit domain skills (workflow 11 + capability 19 + hybrid 1 = 31 total)
- **Workflow evals**: zero-script-qa (Docker log-based QA with multi-eval), cc-version-analysis (version impact analysis)
- **Capability evals**: phase-1-schema, phase-3-mockup, phase-4-api, phase-5-design-system, phase-6-ui-integration, phase-7-seo-security, phase-9-deployment, desktop-app
- **Domain coverage**: MCU(4), MPU(3), Desktop(5), Cross(4), Safety(2) = 18 domain-specific skills

### Changed
- **config.json**: Removed 10 bkit common web skills (starter, dynamic, enterprise, mobile-app, claude-code-learning, bkend-*) as irrelevant to rkit domain
- **misra-c**: Moved from capability to workflow classification, upgraded with enhanced criteria
- **Desktop domain**: Redefined from Electron/Tauri to C# WPF/WinUI3 (Windows App SDK)

### Fixed
- **12 placeholder evals**: Upgraded from single-line to multi-line substantive content (stm32-hal, freertos, nxp-mcuxpresso, imx-bsp, kernel-driver, yocto-build, wpf-mvvm, xaml-design, cmake-embedded, communication, serial-bridge, misra-c)
- **stm32-hal safety criteria**: Added validation keywords to expected output for safety keyword matching

### Metrics
- Benchmark pass rate: 31% → 100% (+69%)
- Workflow: 80% → 100% (+3 skills)
- Capability: 0% → 100% (+19 skills)
- Total files changed: 70 (2 modified + 36 upgraded + 32 new)
- Design match rate: 97%
- Execution time: 3 days (estimated 5 days, 40% faster)

### Notes
- No design-implementation gaps found (97% match rate for all 8 requirements)
- 5 minor criteria wording differences with no functional impact — user chose to proceed without correction
- Qt domain expansion structure prepared in config.json for future extensibility
- All new evals include domain-specific scenarios (MCU sensor/UART, MPU device tree, Desktop WPF dashboard, Cross MCU-WPF bridge, Security OTA updates)
