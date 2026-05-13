# Changelog

> Canonical changelog: `docs/04-report/changelog.md`.
> 본 파일은 scanVersions / release tooling을 위한 root entry point.

## [0.9.14] - 2026-05-13

### Released

- **bkit-gstack-sync-v2 5-cycle 사슬 종결** (PR #6 / merge `67bb2d8`):
  cycle 1.5 / 2 / 3 / 4 / 5 archived, 평균 Match Rate **99.28%**.
  73 SKILL 100% 변환 / 8 SoT / 9 verify-policy checks /
  무한 defer 메커니즘적 차단 (cycle 4 자기 강제력 검증).
  permanent_reject + cascade_origin + escalation_history 신규 필드.

- **cpp-static-analysis 통합** (PR #5 / merge `a711b64`):
  22 Python files (rapp_review 흡수) + Node↔Python bridge (3s timeout).
  skills/cpp-static-analysis (capability, cycle3-body-neutral).
  /code-review C/C++ Pre-Analysis 자동 통합.
  Review fix: timeout / silent failure 차단 / `.c` 포함 / POSIX python3 fallback /
  canary 6 패턴 분리 채택.

### Added

- 9 verify-policy checks (manifest enumeration, STRICT cycle 분기)
- `policies/{manifest, never-gate, network-allowlist, escalation-policy, decisions/cycle2~5-matrix, canary-tokens}.json`
- `lib/core/{anonymize-fingerprint, context-budget, worktree-detector}.js`
- `lib/domain/ports/{state-store, audit-sink, cc-payload, docs-code-index}.port.js`
- `lib/infra/{cc-bridge, docs-code-scanner}.js`
- `lib/pdca/status/` facade split (5 submodules)
- `lib/audit/audit-logger.sanitizeDetails` depth-3 재귀 + 배열
- `scripts/{verify-policy, check-sunset, skill-body-extract, gen-sbom, gen-locked-vocab, pdca-regression-purge, verify-status-schema, release}.{js,mjs}`
- `scripts/security/scan-canary.mjs` (6 regex)
- `.github/workflows/sbom.yml` CycloneDX SBOM (PR + main + weekly)

### Tests

- 214 smoke TC PASS (cycle 2 78 + cycle 3 46 + cycle 4 56 + cycle 5 6 + cpp-static-analysis 19)
- canary scan 0 leaks / 1745 files
- verify-policy 9/9 PASS
- check-sunset 0 FAIL (transitional 0)

### Deprecated

- `scripts/pdca-regression-purge.mjs` (`@deprecated cycle-4 CR4-1 reject`)
- `docs/policy/gdpr-cc-regression.md` (`Status: OBSOLETE` banner)

### Compatibility

- Previous: v0.9.11 (2026-04-08)
- 92 commits between releases
- Minimum: claude-code >= 2.1.78
