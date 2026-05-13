---
name: yocto-review
classification: capability
deprecation-risk: low
domain: mpu
platforms: [stm32mp]
description: |
  Yocto/Embedded Linux 코드 리뷰 기준. Recipe, 스크립트, DTS, defconfig 리뷰 체크리스트.
  Triggers: yocto review, recipe review, bbappend review, Yocto 리뷰
user-invocable: false
allowed-tools: [Read, Glob, Grep]
pdca-phase: check
grandfathered: true
---
## 0. 문서 구조 (본 SKILL의 세 층)

1. **도메인 본문 (§1 ~ §N)**: 이 SKILL의 프로토콜.
   **grandfathered SKILL** — 잠금 어휘 사용 허용 (Cycle 3 변환). 본문 자체가 도메인 기술입니다.
2. **방법론 본문 — 도메인 중립 (선택)**: 공통 방법론 절이 있다면 `<!-- BEGIN: cycle3-body-neutral -->` 마커로 분리.
3. **도메인 예시 부록 (§A)**: SoT(`policies/locked-vocab.json`)에서 자동 생성.

직접 부록을 편집하지 마세요 — `node scripts/gen-locked-vocab.mjs`로 재생성됩니다.

---

# Yocto Code Review Checklist

## Principles

- Prioritize actual build failures and runtime errors.
- Minimize style/formatting nitpicks.
- **No over-critique**: If no real issues found, respond "LGTM". Do not invent problems.

## Must-Check Items

### Recipe (.bb / .bbappend)

| Issue | Description |
|-------|-------------|
| SRC_URI errors | Wrong URL, checksum mismatch, missing file references |
| License missing | `LICENSE`, `LIC_FILES_CHKSUM` not specified |
| Dependency errors | Missing or circular `DEPENDS`/`RDEPENDS` |
| Override misuse | `=` vs `:append` vs `:prepend` used incorrectly |
| FILESEXTRAPATHS missing | bbappend adds files but omits path setup |
| do_install path errors | Misuse of `${D}`, `${bindir}`, etc. |

### Scripts (.sh)

| Issue | Description |
|-------|-------------|
| No error handling | Missing `set -e`, continues on failure |
| Hardcoded paths | Environment-dependent absolute paths |
| Unquoted variables | Breaks on paths with spaces |

### Makefile / CMakeLists.txt

| Issue | Description |
|-------|-------------|
| No cross-compile support | Calls host tools directly |
| Ignores DESTDIR/prefix | Hardcoded install paths |

### DTS / defconfig

| Issue | Description |
|-------|-------------|
| Pin conflicts | Same pin assigned to multiple functions |
| Clock/interrupt mismatch | Reference node vs actual hardware mismatch |

## Recommendations (non-blocking)

- Unnecessary `do_compile`/`do_install` overrides
- Excessive patches when bbappend could solve it
