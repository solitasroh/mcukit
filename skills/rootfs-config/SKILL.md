---
name: rootfs-config
classification: capability
deprecation-risk: low
domain: mpu
description: |
  루트파일시스템 구성 가이드. init 시스템, 파일시스템 레이아웃, 부팅 최적화.
  Triggers: rootfs, init, systemd, busybox, 루트파일시스템, ファイルシステム
user-invocable: true
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
pdca-phase: do
grandfathered: true
---
## 0. 문서 구조 (본 SKILL의 세 층)

1. **도메인 본문 (§1 ~ §N)**: 이 SKILL의 프로토콜.
   **grandfathered SKILL** — 잠금 어휘 사용 허용 (Cycle 3 변환). 본문 자체가 도메인 기술입니다.
2. **방법론 본문 — 도메인 중립 (선택)**: 공통 방법론 절이 있다면 `<!-- BEGIN: cycle3-body-neutral -->` 마커로 분리.
3. **도메인 예시 부록 (§A)**: SoT(`policies/locked-vocab.json`)에서 자동 생성.

직접 부록을 편집하지 마세요 — `node scripts/gen-locked-vocab.mjs`로 재생성됩니다.

---

# Root Filesystem Configuration Guide

## Init Systems
| System | Use Case | Package |
|--------|----------|---------|
| **systemd** | Full-featured, service management | IMAGE_INSTALL += "systemd" |
| **SysVinit** | Traditional, lightweight | Default in many Yocto images |
| **BusyBox init** | Minimal, embedded | Buildroot default |

## Filesystem Layout
```
/ (rootfs)
├── bin/        → /usr/bin (merged on modern distros)
├── etc/        → Configuration files
├── lib/        → Shared libraries
├── usr/
│   ├── bin/    → User binaries
│   ├── lib/    → Libraries
│   └── share/  → Architecture-independent data
├── var/        → Variable data (logs, runtime)
├── tmp/        → Temporary files
├── dev/        → Device nodes (devtmpfs)
├── proc/       → Process info (procfs)
└── sys/        → Kernel/device info (sysfs)
```

## Size Optimization
- Strip binaries: `INHIBIT_PACKAGE_STRIP = "0"` (Yocto)
- Remove docs: `EXTRA_IMAGE_FEATURES:remove = "doc-pkgs"`
- Use musl instead of glibc for small footprint
- Squashfs for read-only rootfs (better compression)
