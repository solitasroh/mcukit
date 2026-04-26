# Everything Claude Code (ECC) vs rkit 종합 비교 분석

> **분석일**: 2026-04-09
> **분석 방법**: 3개 병렬 에이전트 (레포지토리 직접 분석, 웹 조사, rkit 내부 분석)
> **대상 버전**: ECC v1.10.0 / rkit v0.9.10
> **근거 수준**: 모든 항목에 출처 명시. 추측 시 `[추측]` 표기.

---

## Executive Summary

| 항목 | Everything Claude Code (ECC) | rkit |
|------|-----|------|
| **포지셔닝** | 범용 AI 에이전트 하네스 최적화 시스템 | 임베디드 도메인 특화 AI 개발 키트 |
| **Stars** | 146,731 | 비공개 (사내 프로젝트) |
| **버전** | v1.10.0 (2026-04-08) | v0.9.10 |
| **에이전트** | 47개 (범용 언어/프레임워크) | 41개 (MCU/MPU/WPF 전문) |
| **스킬** | 181개 (14개 언어 생태계) | 72개 (임베디드 도메인 집중) |
| **커맨드** | 79개 (레거시 호환) | 통합 PDCA 스킬로 관리 |
| **방법론** | Research-First + TDD + Continuous Learning | PDCA 상태 머신 (20 트랜지션) |
| **도메인** | 언어 불특정 범용 | MCU/MPU/WPF 자동 감지 |
| **크로스 하네스** | 8개 (Claude, Cursor, Codex, OpenCode, Kiro 등) | Claude Code 전용 |
| **핵심 차별점** | 규모, 범용성, 크로스 하네스 | 도메인 깊이, PDCA 엔진, MCU 분석 |

**한 줄 요약**: ECC는 "넓고 얕은" 범용 최적화 시스템, rkit은 "좁고 깊은" 임베디드 전문 개발 키트.

---

## 1. 레포지토리 개요

### 1.1 Everything Claude Code (ECC)

| 항목 | 내용 |
|------|------|
| **URL** | https://github.com/affaan-m/everything-claude-code |
| **웹사이트** | https://ecc.tools |
| **작성자** | Affaan Mustafa (@affaan-m) |
| **라이선스** | MIT |
| **생성일** | 2026-01-18 |
| **설명** | "The agent harness performance optimization system" |
| **배경** | Anthropic x Forum Ventures 해커톤 우승 (2025.09) |
| **주 언어** | JavaScript (2.2MB), Rust (509KB), Shell, Python, TypeScript |
| **npm 패키지** | `ecc-universal` (주간 다운로드: 715건) |

> **출처**: GitHub API 직접 조회, npm 레지스트리

### 1.2 rkit

| 항목 | 내용 |
|------|------|
| **URL** | https://github.com/solitasroh/rkit (비공개) |
| **작성자** | 노수장 |
| **라이선스** | MIT |
| **선행 프로젝트** | bkit (Apache 2.0), gstack (MIT) |
| **설명** | AI Native Embedded Development Kit |
| **주 언어** | JavaScript (Node 18+) |
| **도메인** | MCU (STM32, NXP), MPU (i.MX, STM32MP), WPF (.NET 8) |

---

## 2. 아키텍처 비교

### 2.1 설계 철학

| 관점 | ECC | rkit |
|------|-----|------|
| **접근 방식** | 플러그인/설정 패키지 (에이전트 하네스에 올려놓는 최적화 레이어) | 통합 개발 플랫폼 (PDCA 상태 머신 엔진 내장) |
| **핵심 원칙** | Research-First, Security-First, TDD, Continuous Learning | PDCA 사이클, 도메인 자동 감지, 안전 우선 |
| **상태 관리** | SQLite 세션 저장소 (ECC2), 인스팅트 파일 기반 | 선언적 PDCA 상태 머신 (20 트랜지션, 9 가드) |
| **확장 방향** | 수평 (더 많은 언어/프레임워크 추가) | 수직 (도메인 깊이 강화) |
| **자동화 수준** | 훅 기반 이벤트 자동화 | L0-L4 제어 가능한 자동화 레벨 |

### 2.2 디렉토리 구조 비교

```
ECC (2,588개 항목)                    rkit
├── agents/ (47)                      ├── agents/ (41)
├── skills/ (181 SKILL.md)            ├── skills/ (72 SKILL.md)
├── commands/ (79, 레거시)             ├── (통합 스킬로 관리)
├── hooks/ (25개 이벤트)               ├── hooks/ (18개 이벤트)
├── rules/ (14개 언어)                 ├── refs/ (5개 도메인 참고)
├── scripts/ (138)                    ├── scripts/ (자동화)
├── tests/ (83)                       ├── evals/ (64개 스킬 평가)
├── docs/ (1,025, 6개 언어)            ├── templates/ (32개 PDCA 템플릿)
├── ecc2/ (Rust 차세대)                ├── servers/ (2개 MCP 서버)
├── schemas/ (10)                     ├── lib/ (124개 핵심 모듈)
├── .cursor/ .codex/ .opencode/       │   ├── core/ (설정, 경로, 상태)
│   .kiro/ .gemini/ .trae/            │   ├── domain/ (도메인 감지)
│   .codebuddy/ .agents/              │   ├── pdca/ (상태 머신)
│   (8개 하네스 설정)                    │   ├── mcu/ (메모리, ISR, DMA)
├── .mcp.json (6개 MCP)               │   ├── mpu/ (DT, Yocto, 교차컴파일)
└── SOUL.md (프로젝트 정체성)            │   ├── wpf/ (MVVM, XAML)
                                      │   ├── team/ (에이전트 팀 조정)
                                      │   └── context/ (Living Context)
                                      └── output-styles/ (4개 응답 포맷)
```

**핵심 차이**: ECC는 `lib/` 없이 선언적 마크다운 기반. rkit은 124개 JS 모듈의 런타임 엔진을 보유.

---

## 3. 에이전트 시스템 비교

### 3.1 수량 및 분류

| 카테고리 | ECC (47개) | rkit (41개) |
|----------|-----------|-------------|
| **아키텍처/설계** | architect, planner | fw-architect, wpf-architect |
| **코드 품질** | code-reviewer, 9개 언어별 리뷰어 | code-analyzer, safety-auditor |
| **보안** | security-reviewer | security-architect, safety-auditor (MISRA) |
| **테스트** | tdd-guide, e2e-test | qa-monitor, qa-strategist |
| **자동화** | loop-operator, harness-optimizer | pdca-iterator, self-healing |
| **MCU 전문** | - | fw-architect, mcu-critical-analyzer, hw-interface-expert |
| **MPU 전문** | - | linux-bsp-expert, kernel-module-dev, yocto-expert |
| **WPF 전문** | - | wpf-architect, xaml-expert, dotnet-expert |
| **PM/기획** | - | pm-lead, pm-discovery, pm-strategy, pm-research, pm-prd (5개 팀) |
| **PDCA 평가** | - | pdca-eval-plan/design/do/check/act, pdca-eval-pm (7개) |

### 3.2 핵심 차이점

**ECC의 강점 - 언어별 전문 리뷰어**:
- TypeScript, Python, Go, Rust, Java, Kotlin, C++, C#, Dart/Flutter 각각 전용 리뷰어 보유
- 범용 `code-reviewer` + 언어별 `{lang}-reviewer` 2중 구조

**rkit의 강점 - 도메인 전문 분석**:
- MCU: ISR/DMA 추출기 → LLM 의미 분석 (ConSynergy 4-Stage Pipeline)
- MPU: Device Tree 검증, Yocto 빌드 분석, 교차 컴파일러 감지
- WPF: MVVM 패턴 검증, XAML 바인딩 분석
- PM Agent Team: 5개 에이전트 병렬 실행으로 PRD 자동 생성

> **출처**: ECC - agents/ 디렉토리 직접 분석, rkit - agents/ 디렉토리 및 lib/ 모듈 분석

---

## 4. 스킬 시스템 비교

### 4.1 수량 및 범위

| 항목 | ECC (181개) | rkit (72개) |
|------|-------------|-------------|
| **언어/프레임워크** | python, rust, golang, nextjs, django, laravel, springboot, flutter 등 14+ | C (MISRA), C# (WPF), Yocto (bitbake) |
| **테스트** | tdd-workflow, e2e-testing, verification-loop 등 7+ | zero-script-qa, phase-8-review |
| **보안** | security-scan (AgentShield), defi-amm-security, llm-trading-agent-security | security-review (STRIDE), misra-c |
| **산업별** | healthcare-cdss, healthcare-emr, hipaa-compliance, customs-trade | MCU/MPU/WPF 도메인별 전문 스킬 |
| **컨텍스트** | strategic-compact, context-budget, token-budget-advisor | Living Context System (7개 모듈) |
| **연구** | search-first, deep-research, research-ops | plan-plus (브레인스토밍), reframe (문제 재정의) |
| **PDCA** | - | pdca (통합), pdca-batch, 9개 phase 스킬 |
| **프로젝트 관리** | - | op-status, op-task, op-create-task, op-standup, mr, ship |

### 4.2 스킬 깊이 비교 예시

**보안 스캔 비교**:

| 항목 | ECC (AgentShield) | rkit (security-review) |
|------|-------------------|----------------------|
| 테스트 수 | 1,282개 | STRIDE 6개 위협 카테고리 |
| 정적 분석 규칙 | 102개 | 도메인별 하드웨어 위협 벡터 |
| 대상 | .claude/ 설정 파일 | MCU/MPU/WPF 코드 |
| 등급 | A~F 보안 점수 | 신뢰도 기반 필터링 |
| 특화 | 프롬프트 인젝션, 시크릿 탐지 | 임베디드 하드웨어 위협, MISRA 준수 |

**MCU 분석 (rkit 전용)**:

rkit만 보유한 MCU 전문 분석 엔진 (`lib/mcu/`):
- `memory-analyzer.js`: GCC ARM .map 파일 파싱, Flash/RAM 사용량, 빌드 간 델타
- `isr-extractor.js`: 인터럽트 핸들러 목록, 우선순위 매핑
- `dma-extractor.js`: DMA 채널 설정 추출
- `concurrency-extractor.js`: 전역 변수, 뮤텍스, 공유 자원 감지
- `clock-tree.js`: PLL/SYSCLK/APB 주파수 계산, 제한값 체크
- `pin-config.js`: CubeMX .ioc 분석, 핀 충돌 감지

> ECC에는 이에 상응하는 임베디드 분석 기능이 없음.

---

## 5. 방법론 비교

### 5.1 ECC: Research-First + TDD + Continuous Learning

```
[사용자 요청]
    ↓
[search-first] 코딩 전 리서치
    ↓
[planner] 구현 계획
    ↓
[tdd-guide] 테스트 우선 작성
    ↓
[코드 작성]
    ↓
[code-reviewer] + [lang-reviewer] 리뷰
    ↓
[continuous-learning] 인스팅트 추출
    ↓
[다음 세션에서 인스팅트 적용]
```

**인스팅트 시스템** (ECC 고유):
- 세션 종료 시 코딩 패턴을 `~/.claude/skills/learned/`에 자동 저장
- 프로젝트별 격리 (git remote URL 기반)
- 여러 프로젝트에서 반복되는 패턴은 자동 승격(promotion)
- 신뢰도 점수 기반 관리

### 5.2 rkit: PDCA 상태 머신

```
[PM Phase] → pm-lead → 5개 에이전트 병렬 → PRD
    ↓
[Plan] → 기획 문서 → 템플릿 기반 자동 생성
    ↓
[Design] → 설계 문서 → 도메인별 스펙 (MCU HW, MPU BSP, WPF MVVM)
    ↓
[Do] → 구현 → 도메인 자동 감지 → 안전 가드
    ↓
[Check] → gap-detector → 일치율 90% 기준
    ↓ (<90%)         ↓ (≥90%)
[Act] → pdca-iterator   [Report] → report-generator
    ↓ (자동 반복, 최대 5회)
[Check 재실행]
```

**상태 머신** (rkit 고유):
- 선언적 전이 테이블: 10 상태 × 14 이벤트 → 20 트랜지션
- 가드 함수로 전이 조건 검증
- 체크포인트/롤백 지원
- `.rkit/state/pdca-status.json`에 자동 저장

### 5.3 방법론 비교 요약

| 관점 | ECC | rkit |
|------|-----|------|
| **개발 흐름** | Research → TDD → Code → Review → Learn | PM → Plan → Design → Do → Check → Act → Report |
| **반복 메커니즘** | 인스팅트 기반 세션 간 학습 | 갭 분석 < 90% → 자동 반복 (최대 5회) |
| **품질 게이트** | 훅 기반 (포맷팅, 타입체크, console.log 검사) | PDCA 가드 + 품질 게이트 7단계 + 메트릭 M1-M10 |
| **문서화** | WORKING-CONTEXT.md (수동) | PDCA 문서 자동 생성 (32개 템플릿) |
| **제품 기획** | 없음 | PM Agent Team (5개 에이전트, PRD 자동 생성) |

---

## 6. 크로스 하네스 지원

### ECC - 8개 하네스 지원

| 하네스 | 설정 디렉토리 | 파일 수 |
|--------|-------------|---------|
| Claude Code | `.claude/` | 23 |
| Cursor | `.cursor/` | 80 |
| OpenCode | `.opencode/` | 84 |
| Kiro | `.kiro/` | 110 |
| Codex | `.codex/` | 6 |
| Gemini | `.gemini/` | 1 |
| Trae | `.trae/` | 4 |
| CodeBuddy | `.codebuddy/` | 6 |

### rkit - Claude Code 전용

rkit은 Claude Code Plugin 시스템에 최적화되어 있으며, 다른 AI 코딩 도구는 지원하지 않음.

**평가**: ECC의 크로스 하네스 지원은 팀에서 서로 다른 AI 도구를 사용하는 환경에서 유리. 반면 rkit은 Claude Code의 Plugin API를 깊이 활용하여 더 긴밀한 통합을 달성.

---

## 7. 보안 비교

| 항목 | ECC | rkit |
|------|-----|------|
| **전용 보안 가이드** | the-security-guide.md (29KB) | CLAUDE.md Safety Rules |
| **보안 스캐너** | AgentShield (1,282 테스트, 102 규칙) | - |
| **git 보안** | `--no-verify` 차단 (PreToolUse 훅) | destructive operation detector (8 규칙) |
| **파일 보호** | - | `/freeze` (도메인별), `/guard` (통합 안전 모드) |
| **코딩 표준** | 언어별 rules/ (14개 언어) | MISRA C:2012 (Required 0 위반) |
| **위협 모델링** | - | STRIDE 기반 security-review (임베디드 특화) |
| **파괴적 명령** | 시크릿 탐지 | dd/flash erase 차단, force push 거부 |
| **자동화 제어** | - | L0-L4 자동화 레벨 + trust score |

**평가**: ECC는 에이전트 설정 자체의 보안에 집중 (AgentShield). rkit은 임베디드 코드의 안전성에 집중 (MISRA, 파일 보호, 파괴적 명령 차단).

---

## 8. 커뮤니티 및 생태계

### 8.1 ECC 커뮤니티 평가

| 지표 | 수치 | 평가 |
|------|------|------|
| GitHub Stars | 146,731 | Claude Code 생태계 압도적 1위 |
| GitHub Forks | 22,615 | 매우 활발 |
| npm 주간 다운로드 | 715 | **스타 대비 매우 낮음** |
| GitHub App 설치 | 150+ | 실제 팀 사용 증거 |
| 기여자 | 170+ | 다양한 기여 |
| 문서 번역 | 6개 언어 | 한국어 포함 |

> **출처**: GitHub API, npm 레지스트리

### 8.2 ECC에 대한 커뮤니티 의견 양면성

**긍정적 평가**:
- FlorianBruniaux의 claude-code-ultimate-guide에서 **CRITICAL (최고점)** 등급 ([출처](https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/docs/resource-evaluations/015-everything-claude-code-github-repo.md))
- Augment Code가 "100K 스타 돌파" 분석 기사 게시 ([출처](https://www.augmentcode.com/learn/everything-claude-code-github))

**부정적/회의적 평가**:
- Medium: "82K-Star Agent Harness That's **Dividing** the Developer Community" ([출처](https://medium.com/@tentenco/everything-claude-code-inside-the-82k-star-agent-harness-thats-dividing-the-developer-community-4fe54feccbc1))
- **과잉 엔지니어링(YAGNI) 비판**: "잘 작성된 CLAUDE.md와 좋은 테스트만으로 충분하다" (Reddit r/ClaudeCode)
- **스타 vs 실사용 괴리**: 146K 스타 vs npm 주간 715 다운로드
- **바이럴 마케팅 의존**: X(Twitter) 스레드의 바이럴 효과로 대량 스타 획득 의혹

### 8.3 ECC 작성자 프로필

| 항목 | 내용 |
|------|------|
| **이름** | Affaan Mustafa |
| **위치** | 샌프란시스코 / 벨뷰 |
| **GitHub** | 팔로워 4,378명, 공개 리포 26개 |
| **학력** | UC San Diego BS (수학-CS) + BA (경영경제학), 20세 3학위 |
| **해커톤** | Anthropic x Forum Ventures 우승 (2025.09) |
| **기타 프로젝트** | stoictradingAI ($2M+ 거래), elizaOS 코어 기여자, Ito Markets 공동창업 |
| **논문** | HyperMamba (SSRN 게재) |

> **신뢰도**: Anthropic 공식 해커톤 수상은 검증 가능. 다만 임베디드/전통 SW 엔지니어링 배경은 아님. Web3/크립토 트레이딩 출신.

---

## 9. 강점/약점 SWOT 비교

### 9.1 ECC

| | 긍정 | 부정 |
|---|------|------|
| **내부** | **강점**: 146K 스타, 8개 하네스 지원, 181개 스킬, AgentShield 보안, 인스팅트 학습, 활발한 릴리스, 6개 언어 문서 | **약점**: 과잉 엔지니어링 비판, npm 715 다운로드, 단일 기여자 의존 (759/850 커밋), ECC2 미완성, 도메인 깊이 부족 |
| **외부** | **기회**: Claude Code 생태계 성장, 크로스 하네스 시장 선점, Rust 기반 ECC2로 성능 향상 | **위협**: Anthropic 공식 플러그인 생태계 확장, "단순한 CLAUDE.md로 충분" 회의론, 바이럴 피로 |

### 9.2 rkit

| | 긍정 | 부정 |
|---|------|------|
| **내부** | **강점**: 임베디드 도메인 깊이 (MCU/MPU/WPF), PDCA 상태 머신 엔진, MCU 동시성 분석, PM Agent Team, Living Context, 124개 런타임 모듈 | **약점**: Claude Code 전용, 소규모 사용자 기반, v0.9.x (아직 1.0 미만), 범용 언어 지원 부족 |
| **외부** | **기회**: 임베디드 AI 개발 도구 시장 공백, PDCA 방법론 수요, OpenProject 연동 | **위협**: ECC 등 범용 도구의 도메인 확장, Claude Code API 변경 리스크 |

---

## 10. 정량 비교 요약

| 항목 | ECC | rkit | 비고 |
|------|-----|------|------|
| 에이전트 수 | 47 | 41 | ECC +15% |
| 스킬 수 | 181 | 72 | ECC +151% |
| 커맨드 수 | 79 | 통합 관리 | ECC 레거시 분리 |
| 훅 이벤트 | 25 | 18 | ECC +39% |
| 지원 언어 | 14+ | 3 (C, C#, Yocto) | ECC 수평 확장 |
| 지원 하네스 | 8 | 1 | ECC 크로스 하네스 |
| 런타임 모듈 | 없음 (선언적) | 124개 JS 모듈 | rkit 엔진 보유 |
| PDCA 상태 머신 | 없음 | 20 트랜지션, 9 가드 | rkit 고유 |
| MCU 분석기 | 없음 | 6개 전문 추출기 | rkit 고유 |
| PM 에이전트 팀 | 없음 | 5개 에이전트 | rkit 고유 |
| MCP 서버 | 6개 (외부) | 2개 (자체) | 접근 방식 차이 |
| 문서 번역 | 6개 언어 | - | ECC 다국어 |
| 테스트 | 83개 파일, CI 33 매트릭스 | 64개 스킬 평가 | 접근 방식 차이 |
| npm 주간 DL | 715 | N/A | |
| GitHub Stars | 146,731 | N/A | |

---

## 11. 사용 사례별 적합도

### 11.1 ECC가 더 적합한 경우

| 사용 사례 | 이유 |
|----------|------|
| 다양한 언어/프레임워크 프로젝트 | 14개 언어별 규칙과 리뷰어 |
| 팀에서 여러 AI 도구 병용 | 8개 크로스 하네스 지원 |
| 웹/앱 개발 프로젝트 | Next.js, Django, Laravel, Spring Boot 등 스킬 |
| 에이전트 설정 보안 감사 | AgentShield (1,282 테스트) |
| 에이전트 하네스 학습 목적 | 181개 스킬, 포괄적 문서 (6개 언어) |
| 크립토/핀테크 프로젝트 | DeFi, AMM 보안 스킬 보유 |
| 헬스케어 프로젝트 | HIPAA, CDSS, EMR 스킬 보유 |

### 11.2 rkit이 더 적합한 경우

| 사용 사례 | 이유 |
|----------|------|
| MCU 펌웨어 개발 (STM32, NXP) | ISR/DMA/동시성 전문 분석, MISRA C 검증 |
| 임베디드 Linux BSP (i.MX, STM32MP) | Device Tree, Yocto 12단계, 교차 컴파일 |
| WPF 데스크톱 앱 (.NET 8) | MVVM 검증, XAML 분석, MCU↔WPF 시리얼 통신 |
| PDCA 기반 체계적 개발 관리 | 상태 머신, 품질 게이트, 자동 반복 |
| 제품 기획부터 시작하는 경우 | PM Agent Team (5개 에이전트 PRD 생성) |
| 안전 필수 시스템 (Safety-Critical) | MISRA C:2012, 메모리 버짓, 스택 마진 |
| OpenProject 기반 프로젝트 관리 | op-status, op-task, op-standup 스킬 |
| MCU+WPF 통합 시스템 | serial-bridge, 도메인 자동 감지 |

---

## 12. 핵심 인사이트

### 12.1 ECC에서 참고할 만한 요소

1. **인스팅트 시스템**: 세션 간 패턴 학습 및 프로젝트별 격리는 rkit의 메모리 시스템 강화에 참고 가능
2. **AgentShield**: 에이전트 설정 자체의 보안 스캔은 rkit에 없는 관점
3. **크로스 하네스**: Cursor/Codex 등 다른 AI 도구 지원은 향후 확장 검토 가능 [추측]
4. **산업별 스킬**: 헬스케어, 무역 준수 등 산업 특화 스킬은 rkit의 도메인 확장 모델 참고
5. **ECC 2.0 Rust**: 차세대 컨트롤 플레인을 Rust로 구현하는 시도는 성능 관점에서 주목

### 12.2 rkit이 ECC 대비 우위인 영역

1. **런타임 엔진**: 124개 JS 모듈로 실제 코드 분석 (ISR, DMA, 메모리, 클럭, 핀) — ECC는 선언적 설정만
2. **PDCA 상태 머신**: 20 트랜지션의 선언적 상태 관리는 ECC에 없는 구조적 접근
3. **도메인 자동 감지**: 마커 파일 + 콘텐츠 분석 + 신뢰도 점수 기반 도메인 라우팅
4. **PM Agent Team**: 제품 기획부터 시작하는 전체 생명주기 — ECC는 코딩 단계에 집중
5. **MCU 동시성 분석**: ConSynergy 4-Stage Pipeline은 rkit만의 고유 기술

### 12.3 주의 사항

- ECC의 146K 스타는 실제 사용량(npm 715/주)과 큰 괴리가 있음. 스타 수를 품질의 지표로 사용하기 어려움.
- ECC의 181개 스킬 중 상당수는 매우 특화된 도메인(customs-trade, energy-procurement)으로, 유지보수 부담이 우려됨.
- "잘 작성된 CLAUDE.md와 좋은 테스트만으로 충분하다"는 숙련 개발자의 의견은 ECC와 rkit 모두에 적용될 수 있는 비판.
- 두 프로젝트는 **경쟁 관계가 아닌 상호 보완** 관계. ECC는 범용 최적화, rkit은 도메인 전문.

---

## 13. Claude Code 생태계 내 포지셔닝

```
          넓음 ← 범위(Scope) → 좁음
높음       ┌─────────────────────────┐
 ↑        │  ECC                    │
깊이       │  (범용 최적화 시스템)      │
(Depth)   │  47 에이전트, 181 스킬     │
 ↓        │  8 하네스, 14 언어        │
낮음       └─────────────────────────┘

높음       ┌─────────────────────────┐
 ↑        │              rkit       │
깊이       │    (임베디드 전문 키트)    │
(Depth)   │    41 에이전트, 72 스킬    │
 ↓        │    MCU/MPU/WPF, PDCA    │
낮음       └─────────────────────────┘

          ┌─────────────────────────┐
          │ awesome-claude-code     │
          │ (큐레이트된 리소스 목록)   │
          │ 개별 선택 가능            │
          └─────────────────────────┘

          ┌─────────────────────────┐
          │ claude-code-ultimate    │
          │ (교육/가이드)            │
          │ 22,000줄, 11챕터        │
          └─────────────────────────┘
```

---

## 14. 결론

| 관점 | 결론 |
|------|------|
| **규모** | ECC가 압도적 (2.5배 스킬, 8배 하네스) |
| **깊이** | rkit이 우위 (MCU 분석 엔진, PDCA 상태 머신, 124개 런타임 모듈) |
| **방법론** | rkit의 PDCA 상태 머신이 더 체계적. ECC는 인스팅트 학습이 독특 |
| **실용성** | 임베디드 개발자에게는 rkit, 범용 웹/앱 개발자에게는 ECC |
| **성숙도** | ECC v1.10.0이 더 높은 버전이지만, rkit은 런타임 엔진 품질이 높음 |
| **커뮤니티** | ECC 압도적 (146K 스타). 단, 스타 vs 실사용 괴리 주의 |
| **미래** | ECC는 ECC2 (Rust) 진화 중. rkit은 v1.0.0 + 도메인 확장 예정 |

**최종 평가**: 두 프로젝트는 서로 다른 문제를 해결한다. ECC는 "모든 AI 코딩 도구에서 최적의 에이전트 경험"을, rkit은 "임베디드 개발자의 전체 생명주기를 AI로 자동화"를 목표로 한다. 경쟁이 아닌 **직교(orthogonal) 관계**이며, 각각의 도메인에서 최고 수준의 도구이다.

---

## 출처 목록

| # | 출처 | URL | 유형 |
|---|------|-----|------|
| 1 | GitHub - ECC 레포지토리 | https://github.com/affaan-m/everything-claude-code | 직접 분석 |
| 2 | GitHub API (레포 통계) | https://api.github.com/repos/affaan-m/everything-claude-code | API 조회 |
| 3 | npm - ecc-universal | https://www.npmjs.com/package/ecc-universal | 패키지 통계 |
| 4 | Augment Code 분석 기사 | https://www.augmentcode.com/learn/everything-claude-code-github | 블로그 |
| 5 | Medium 분석 기사 | https://medium.com/@tentenco/everything-claude-code-inside-the-82k-star-agent-harness-thats-dividing-the-developer-community-4fe54feccbc1 | 블로그 |
| 6 | Apiyi.com 기술 분석 | https://help.apiyi.com/en/everything-claude-code-plugin-guide-en.html | 기술 문서 |
| 7 | claude-code-ultimate-guide 평가 | https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/docs/resource-evaluations/015-everything-claude-code-github-repo.md | 리뷰 |
| 8 | AgentShield GitHub | https://github.com/affaan-m/agentshield | 직접 분석 |
| 9 | Affaan Mustafa 프로필 | https://affaanmustafa.com/ | 공식 사이트 |
| 10 | ECC Tools GitHub App | https://github.com/marketplace/ecc-tools | 마켓플레이스 |
| 11 | rkit 소스 코드 | D:/work/private/rkit/ (로컬) | 직접 분석 |
| 12 | byteiota 분석 | https://byteiota.com/everything-claude-code-production-agent-framework/ | 블로그 |
| 13 | bridgers.agency 분석 | https://bridgers.agency/en/blog/everything-claude-code-explained | 블로그 |
