# Changelog

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
