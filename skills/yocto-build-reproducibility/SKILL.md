---
name: yocto-build-reproducibility
classification: capability
deprecation-risk: low
domain: mpu
platforms: [stm32mp]
description: |
  Yocto 빌드 재현성 가이드. SRCREV 고정, SSTATE 캐시 공유, DL_DIR 미러, 빌드 환경 고정.
  Triggers: SRCREV, SSTATE, DL_DIR, build reproducibility, 빌드 재현성
user-invocable: false
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

# Yocto Build Reproducibility

## 전제 조건

### .env 확인 (공통)

스킬 실행 전 프로젝트 루트의 `.env` 파일을 확인한다:

1. `.env` 파일이 있으면 → 정상 진행 (값을 읽어서 사용)
2. `.env` 파일이 없으면:
   - devkit plugin 디렉토리의 `templates/env.template` 파일을 찾는다
   - `env.template`이 있으면 → 프로젝트 루트에 `.env.example`과 `.env`로 복사
   - 사용자에게 안내: "`.env` 파일이 생성되었습니다. 필요한 값을 채워주세요."
   - `env.template`이 없으면 → "devkit plugin이 설치되지 않은 것 같습니다." 안내
3. `.env`에서 이 스킬에 필요한 변수를 읽는다 (빈 값이면 사용자에게 질문)

## SRCREV Pinning

- `SRCREV = "${AUTOREV}"` is **prohibited** in bbappend files.
- Always pin to a full 40-char commit hash for reproducible builds.
- Example: `SRCREV = "a1b2c3d4e5f6..."`

## SSTATE Cache Sharing

- Share `SSTATE_DIR` via NFS/sshfs on team build servers to significantly reduce build time.
- Archive and restore SSTATE cache in CI pipelines.
- Configure path via `.env` `YOCTO_SSTATE_DIR`.

## DL_DIR Mirror

- Back up `DL_DIR` tarballs for offline builds.
- Set `SOURCE_MIRROR_URL` in local.conf to enable builds without external network.
- Configure path via `.env` `YOCTO_DL_DIR`.

## Build Environment Pinning

- Unify host packages via a prerequisites install script (e.g., `tools/install-yocto-prerequisites.sh`).
- Pin manifest tags to manage source versions (`YOCTO_MANIFEST_BRANCH`).
- Version-control Dockerfiles when using Docker/Podman containers.
