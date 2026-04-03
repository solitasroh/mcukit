# bkit-gstack-sync Planning Document

> **Summary**: bkit v2.0.4~v2.0.6 신규 기능 이식 + gstack 미반영 기능 추가 + bkit 잔류 참조 전수 정리
>
> **Project**: rkit
> **Version**: 0.6.2 (core v2.0.0)
> **Author**: soojang.roh
> **Date**: 2026-04-02
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | rkit은 bkit v2.0.3 기반으로 포킹되었으나, bkit이 v2.0.6까지 3개 패치를 릴리즈하여 Context Anchor, Living Context System, Self-Healing 등 핵심 기능이 미반영. 또한 bkit→rkit 마이그레이션이 불완전하여 `.bkit/` 런타임 경로, MCP 서버 내부, 함수명, 스킬/에이전트 참조에 bkit 흔적이 다수 잔류. gstack의 `/benchmark`, `/investigate`, `/retro` 등 임베디드에 유용한 기능도 미통합. |
| **Solution** | P0: bkit→rkit 마이그레이션 완료 (런타임 경로 통일, MCP 서버 치환, 함수명 정리). P1: bkit v2.0.5~v2.0.6 핵심 모듈 이식 (session-guide, lib/context/, self-healing). P2: gstack 미반영 기능 임베디드 특화 통합 (/benchmark, /investigate, /retro). P3: 스킬/에이전트/템플릿 bkit 잔류 참조 전수 치환. |
| **Function/UX Effect** | 런타임 경로 일관성으로 상태 관리 안정성 확보, PRD→코드 컨텍스트 침투율 75-85% 달성, 세션 간 컨텍스트 손실 감소, MCU 빌드 벤치마크/HardFault 조사 프로토콜 제공 |
| **Core Value** | rkit을 bkit 최신 코어와 동기화하여 기술 부채를 해소하고, 임베디드 도메인 특화 도구를 확장하여 MCU/MPU/WPF 개발자의 생산성을 극대화 |

---

## 1. Overview

### 1.1 Purpose

rkit이 bkit v2.0.3에서 포킹된 이후 발생한 3가지 갭을 해소한다:

1. **마이그레이션 미완료**: `.bkit/` 런타임 경로, MCP 서버 코드, 함수명에 bkit 참조가 잔류하여 유지보수 혼란 발생
2. **bkit 업스트림 갭**: v2.0.4~v2.0.6에서 추가된 Context Anchor, Living Context System, Self-Healing 등 핵심 기능 미반영
3. **gstack 미통합 기능**: `/benchmark`, `/investigate`, `/retro` 등 임베디드 도메인에 유용한 기능 미적용

### 1.2 Background

- rkit은 bkit-claude-code (Apache 2.0, popup-studio-ai)에서 PDCA 코어를 포팅한 프로젝트
- v0.6.0에서 gstack (Garry Tan)의 safety/quality/security/delivery 패턴을 임베디드 도메인에 적응 통합
- 현재 `.bkit/`과 `.rkit/` 이중 상태 디렉토리가 공존하며, 실제 런타임은 `.bkit/`을 사용하는 불일치 상태
- bkit v2.0.6의 Living Context System은 PRD→코드 컨텍스트 침투율을 30-40%에서 75-85%로 개선

### 1.3 Related Documents

- bkit 원본: https://github.com/popup-studio-ai/bkit-claude-code
- gstack 원본: https://github.com/garrytan/gstack
- rkit 마스터 플랜: `docs/01-plan/rkit-master-plan.md`
- rkit 코어 설계: `docs/02-design/features/rkit-core.design.md`

---

## 2. Scope

### 2.1 In Scope

- [P0] `.bkit/` → `.rkit/` 런타임 경로 전수 통일
- [P0] MCP 서버 2개 내부 bkit 참조 완전 치환 (환경변수, URI 스킴, 서버명, 패키지명)
- [P0] `lib/pdca/status.js` bkit 함수명 치환 (`readBkitMemory` → `readMcukitMemory` 등)
- [P1] `lib/pdca/session-guide.js` 이식 (bkit v2.0.5 Context Anchor)
- [P1] `lib/context/` 7개 모듈 이식 (bkit v2.0.6 Living Context System)
- [P1] Self-Healing 에이전트 추가 (bkit v2.0.6)
- [P1] `/deploy` 스킬 임베디드 특화 이식 (bkit v2.0.6)
- [P2] `/benchmark` 스킬 신규 — MCU Flash/RAM/빌드 시간 벤치마크 (gstack 영감)
- [P2] `/investigate` 스킬 신규 — HardFault/Device Tree/BSOD 조사 프로토콜 (gstack 영감)
- [P2] `/retro` 스킬 신규 — PDCA Report 보완 회고 (gstack 영감)
- [P3] 스킬 13개 `.bkit/` 경로 및 output style 참조 치환
- [P3] 에이전트 6개 bkit 참조 치환
- [P3] 템플릿 7개 bkit 푸터/생성자 치환
- [P3] `lib/common.js` 주석 헤더, 감사 모듈 Design Reference 정리

### 2.2 Out of Scope

- bkit v2.0.4 Windows Hook 경로 호환성 (rkit은 Linux 전용)
- gstack `/browse`, `/connect-chrome` 브라우저 자동화 (임베디드 도메인 무관)
- gstack `/autoplan`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review` (기존 PDCA/reframe과 기능 중복)
- gstack `/design-html` (WPF 도메인에서는 XAML이 주 UI이므로 별도 프로토타이핑 불필요)
- bkit 업스트림 인프라 템플릿 11개 (ArgoCD, Terraform 등 — 임베디드 도메인 무관)
- bkit→rkit URI 스킴 변경 (`bkit://` → `rkit://`) 시 외부 소비자 호환성 보장 (현재 외부 소비자 없음)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Category |
|----|-------------|----------|----------|
| FR-01 | `.bkit/` 런타임 디렉토리를 `.rkit/`으로 통일, 기존 `.bkit/` 데이터 마이그레이션 | P0-High | Migration |
| FR-02 | MCP 서버 내부 `BKIT_ROOT`, `.bkit/`, `bkit://` URI, 서버명을 `rkit` 계열로 치환 | P0-High | Migration |
| FR-03 | `lib/pdca/status.js`의 `readBkitMemory()`, `writeBkitMemory()` 함수명 치환 | P0-High | Migration |
| FR-04 | `pdca-status.json`의 `team.stateFile`, `team.eventsFile` 경로를 `.rkit/` 기준으로 갱신 | P0-High | Migration |
| FR-05 | bkit v2.0.5 `session-guide.js` 이식 — Context Anchor 추출/삽입/세션 분리 | P1-High | Upstream |
| FR-06 | bkit v2.0.6 `lib/context/` 7개 모듈 이식 — Living Context System | P1-High | Upstream |
| FR-07 | bkit v2.0.6 Self-Healing 에이전트 추가 (Opus 기반 자동 오류 복구) | P1-Medium | Upstream |
| FR-08 | bkit v2.0.6 `/deploy` 스킬 → 임베디드 배포 특화 (Flash/OTA/Yocto 이미지) | P1-Medium | Upstream |
| FR-09 | `/benchmark` 스킬 — MCU: Flash/RAM arm-none-eabi-size, MPU: 이미지 크기, WPF: 빌드 시간 | P2-Medium | gstack |
| FR-10 | `/investigate` 스킬 — MCU: HardFault 레지스터 분석, MPU: dmesg/DTS 오류, WPF: 크래시 덤프 | P2-Medium | gstack |
| FR-11 | `/retro` 스킬 — PDCA Report 이후 구조화된 엔지니어링 회고 | P2-Low | gstack |
| FR-12 | 스킬 13개 내부 `.bkit/` 경로 → `.rkit/` 치환 | P3-Medium | Cleanup |
| FR-13 | 에이전트 6개 내부 bkit 참조 → rkit 치환 | P3-Medium | Cleanup |
| FR-14 | 템플릿 7개 bkit 푸터/생성자 표기 → rkit 치환 | P3-Low | Cleanup |
| FR-15 | `lib/common.js`, `lib/audit/` 주석/Design Reference 정리 | P3-Low | Cleanup |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 호환성 | 기존 `.bkit/` 상태 데이터 무손실 마이그레이션 | 마이그레이션 전후 pdca-status.json diff 비교 |
| 안정성 | MCP 서버 URI 변경 후 정상 도구 호출 | 16개 MCP 도구 전수 호출 테스트 |
| 일관성 | 프로젝트 내 `bkit` 문자열 잔류 0건 (주석/라이선스 표기 제외) | `grep -r "bkit" --include="*.js" --include="*.md"` |
| 성능 | Context Anchor 적용 후 세션 간 컨텍스트 유지율 75%+ | Design→Do 전환 시 요구사항 재질문 빈도 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `.rkit/` 단일 런타임 디렉토리로 통일, `.bkit/` 미사용
- [ ] MCP 서버 `rkit://` URI 스킴으로 전환, 16개 도구 정상 동작
- [ ] `grep -rn "\.bkit/" lib/ scripts/ servers/` 결과 0건 (라이선스/출처 주석 제외)
- [ ] `lib/context/` 7개 모듈 이식 및 기존 PDCA 워크플로우와 통합
- [ ] Session Guide Context Anchor가 Plan→Design→Do 전환 시 자동 삽입
- [ ] `/benchmark`, `/investigate`, `/retro` 3개 스킬 추가 및 도메인별 동작 확인
- [ ] test-all.js 통과

### 4.2 Quality Criteria

- [ ] PDCA Gap Analysis Match Rate >= 90%
- [ ] 기존 51개 스킬 정상 로딩 (skill-status 확인)
- [ ] 39개 에이전트 정상 로딩

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `.bkit/` → `.rkit/` 전환 시 기존 상태 데이터 손실 | High | Medium | 마이그레이션 스크립트에 백업+검증 단계 추가, rollback 경로 확보 |
| MCP URI 변경 (`bkit://` → `rkit://`) 시 Claude Code 캐시 불일치 | Medium | Low | 세션 재시작으로 해결, 하위 호환 alias 검토 |
| bkit v2.0.6 `lib/context/` 모듈이 bkit 전용 의존성 보유 | High | Medium | 이식 전 의존성 분석, 필요시 인터페이스 어댑터 작성 |
| gstack `/benchmark`가 arm-none-eabi 툴체인 미설치 환경에서 실패 | Low | High | 툴체인 감지 로직 추가, 미설치 시 graceful fallback |
| `lib/context/self-healing.js`가 Opus 모델 필수 — 비용 우려 | Medium | Medium | 모델 설정 가능하게 하고, sonnet fallback 옵션 제공 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | |
| **Dynamic** | Feature-based modules, BaaS | Web apps | |
| **Enterprise** | Strict layer separation, DI | Complex systems | **Selected** |

> rkit은 L3_Advanced 레벨 프로젝트로, lib/core + lib/pdca + lib/domain 계층 분리 아키텍처 사용

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 런타임 경로 전환 방식 | A) 하드 전환 / B) Symlink 호환 / C) 점진적 전환 | A) 하드 전환 | 이중 경로 혼란 제거, `.bkit/` 완전 제거 |
| MCP URI 스킴 | A) `rkit://` / B) `bkit://` 유지 | A) `rkit://` | 브랜딩 일관성, 외부 소비자 없음 |
| bkit v2.0.6 이식 방식 | A) Cherry-pick / B) 전체 모듈 복사+적응 | B) 전체 모듈 복사 | 의존성 명확, 임베디드 특화 수정 용이 |
| gstack 스킬 구현 | A) gstack 코드 포팅 / B) 컨셉만 차용하여 신규 작성 | B) 컨셉 차용 신규 | 임베디드 도메인 특화, 라이선스 명확 |
| Self-Healing 모델 | A) Opus 전용 / B) 설정 가능 | B) 설정 가능 | 비용 효율, sonnet fallback |

### 6.3 모듈 구조 변경

```
lib/
├── context/                   # [NEW] bkit v2.0.6 이식
│   ├── context-loader.js      # PDCA 문서→코드 컨텍스트 로딩
│   ├── impact-analyzer.js     # 변경 영향 분석 (메모리맵 추적)
│   ├── invariant-checker.js   # 불변 조건 검증 (MISRA 연속 검증)
│   ├── scenario-runner.js     # 시나리오 기반 검증
│   ├── self-healing.js        # 자동 오류 복구
│   ├── ops-metrics.js         # 운영 메트릭스 (빌드 시간/메모리)
│   └── decision-record.js     # 의사결정 기록
├── pdca/
│   ├── session-guide.js       # [NEW] bkit v2.0.5 이식
│   └── status.js              # [MOD] 함수명 치환
├── core/
│   └── paths.js               # [MOD] .bkit/ → .rkit/ 경로 통일
...

skills/
├── benchmark/SKILL.md         # [NEW] gstack 영감 MCU/MPU/WPF 벤치마크
├── investigate/SKILL.md       # [NEW] gstack 영감 HardFault/DTS 조사
├── retro/SKILL.md             # [NEW] gstack 영감 엔지니어링 회고
├── deploy/SKILL.md            # [NEW] bkit v2.0.6 임베디드 배포

agents/
├── self-healing.md            # [NEW] bkit v2.0.6 자동 복구 에이전트

servers/
├── rkit-pdca-server/
│   ├── package.json           # [MOD] name: "rkit-pdca-server"
│   └── index.js               # [MOD] MCUKIT_ROOT, rkit://, 전수 치환
├── rkit-analysis-server/
│   ├── package.json           # [MOD] name: "rkit-analysis-server"
│   └── index.js               # [MOD] 전수 치환
```

---

## 7. Implementation Order

### Phase 1: P0 — 마이그레이션 완료 (Day 1)

| Step | Task | Files | Est. |
|------|------|-------|------|
| 1-1 | `.bkit/` 상태 데이터를 `.rkit/`으로 복사+검증 | `.bkit/` → `.rkit/` | 소 |
| 1-2 | `lib/core/paths.js` 경로 상수 확인/수정 | `lib/core/paths.js` | 소 |
| 1-3 | `lib/pdca/status.js` 함수명 치환 (readBkitMemory 등) | `lib/pdca/status.js` | 소 |
| 1-4 | `lib/common.js` bridge 주석 정리 | `lib/common.js` | 소 |
| 1-5 | MCP 서버 2개 전수 치환 (index.js + package.json) | `servers/*/` | 중 |
| 1-6 | `pdca-status.json` team 경로 갱신 | `.rkit/state/pdca-status.json` | 소 |
| 1-7 | SessionStart hook에서 `.bkit/` → `.rkit/` 마이그레이션 로직 | `hooks/startup/migration.js` | 소 |

### Phase 2: P1 — bkit v2.0.5~v2.0.6 이식 (Day 2-3)

| Step | Task | Files | Est. |
|------|------|-------|------|
| 2-1 | `lib/pdca/session-guide.js` 이식 + rkit 적응 | 신규 1개 | 중 |
| 2-2 | `lib/context/` 7개 모듈 이식 + 임베디드 특화 | 신규 7개 + index.js | 대 |
| 2-3 | Self-Healing 에이전트 추가 | `agents/self-healing.md` | 소 |
| 2-4 | `/deploy` 스킬 — 임베디드 배포 특화 | `skills/deploy/SKILL.md` | 중 |
| 2-5 | PDCA 템플릿에 Context Anchor 삽입 지점 추가 | `templates/*.template.md` | 소 |

### Phase 3: P2 — gstack 미반영 기능 (Day 4)

| Step | Task | Files | Est. |
|------|------|-------|------|
| 3-1 | `/benchmark` 스킬 신규 작성 (MCU/MPU/WPF 3도메인) | `skills/benchmark/SKILL.md` | 중 |
| 3-2 | `/investigate` 스킬 신규 작성 (HardFault/DTS/크래시) | `skills/investigate/SKILL.md` | 중 |
| 3-3 | `/retro` 스킬 신규 작성 (PDCA Report 보완) | `skills/retro/SKILL.md` | 소 |

### Phase 4: P3 — 잔류 참조 정리 (Day 5)

| Step | Task | Files | Est. |
|------|------|-------|------|
| 4-1 | 스킬 13개 `.bkit/` 경로 + output style 참조 치환 | `skills/*/SKILL.md` x13 | 중 |
| 4-2 | 에이전트 6개 bkit 참조 치환 | `agents/*.md` x6 | 소 |
| 4-3 | 템플릿 7개 bkit 푸터/생성자 치환 | `templates/*.md` x7 | 소 |
| 4-4 | `lib/audit/`, `lib/control/` Design Reference 정리 | `lib/audit/*.js`, `lib/control/*.js` | 소 |
| 4-5 | 전수 검증: `grep -rn "\.bkit\|readBkit\|writeBkit\|bkit-" lib/ scripts/ servers/ skills/ agents/ templates/` | 전체 | 소 |

---

## 8. Impact Analysis

### 8.1 기존 소비자 영향

| 소비자 | 영향 | 대응 |
|--------|------|------|
| SessionStart Hook | `.bkit/` 경로 읽기 → `.rkit/` 전환 필요 | migration.js에서 자동 마이그레이션 |
| unified-stop.js | `.bkit/` 상태 파일 참조 | paths.js 중앙 경로 사용으로 자동 해결 |
| 기존 PDCA 3개 피처 (pdca, startup, domain) | `.bkit/state/pdca-status.json` 참조 | 데이터 복사 후 `.rkit/` 통일 |
| MCP 서버 소비자 (Claude Code) | `bkit://` URI 스킴 변경 | 세션 재시작으로 해결 |

### 8.2 변경 파일 수 예상

| Category | New | Modified | Total |
|----------|-----|----------|-------|
| lib/ | 8 | 6 | 14 |
| skills/ | 4 | 13 | 17 |
| agents/ | 1 | 6 | 7 |
| servers/ | 0 | 4 | 4 |
| templates/ | 0 | 7 | 7 |
| hooks/ | 0 | 1 | 1 |
| **Total** | **13** | **37** | **50** |

---

## 9. Next Steps

1. [ ] Write design document (`bkit-gstack-sync.design.md`)
2. [ ] Phase 1 (P0) 구현: 마이그레이션 완료
3. [ ] Phase 2 (P1) 구현: bkit v2.0.5~v2.0.6 이식
4. [ ] Phase 3 (P2) 구현: gstack 미반영 기능
5. [ ] Phase 4 (P3) 구현: 잔류 참조 정리
6. [ ] Gap Analysis
7. [ ] Completion Report

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-02 | Initial draft — P0~P3 전체 범위 포함 | soojang.roh |
