---
template: plan
version: 1.2
---

# bkit-gstack-sync-v2 사이클 1.5 기획서

> **한 줄 요약**: gstack의 4개 스킬(`/investigate`, `/retro`, `/security-review`, `/code-review`)에서 검증된 의사결정·리뷰 방법을 rkit으로 골라 옮기되 — **방법론은 본문에 도메인 중립으로 두고**, **임베디드 핵심 어휘는 부록에 보존**한다. 정책은 자동 검증으로 강제한다.
>
> **프로젝트**: rkit
> **버전**: v0.9.14 → v0.9.15 (목표)
> **작성자**: 노수장
> **작성일**: 2026-04-28
> **상태**: 초안 (Draft)
> **사이클**: 1.5 / bkit-gstack-sync-v2 (사이클 1 보고서 §9에서 이월된 작업)
> **브랜치**: `feature/bkit-gstack-sync-v2` (계속 사용)
> **선행 문서**: `docs/archive/2026-04/bkit-gstack-sync-v2/bkit-gstack-sync-v2.report.md`

---

## 한눈에 보기 (Executive Summary)

| 관점 | 내용 |
|------|------|
| **문제** | rkit의 4개 스킬(`/investigate`, `/retro`, `/security-review`, `/code-review`)은 합쳐서 845줄 수준으로 얕다. gstack의 같은 역할 스킬(합쳐서 약 5,500줄) 비교 시 다음 4가지가 빠져 있다. (a) 위험도가 높은 결정(아키텍처·데이터 모델·되돌리기 어려운 작업·정보 부족)을 만났을 때 **잠시 멈추고 2~3개 선택지를 비교해 사용자에게 묻는 절차**, (b) 사용자에게 질문할 때 **추천안과 장단점을 정해진 모양으로 제시하는 양식**, (c) 보안 판정에서 **"차단/경고/기록만"을 단계별로 나누고 두 검사기가 동시에 의심할 때만 차단**하는 규칙, (d) 코드 리뷰에서 **자주 아무것도 못 잡는 검사는 자동으로 건너뛰되, 보안·데이터 이전 검사는 항상 돌리고, 사용자가 이미 무시한 항목은 같은 코드에서 다시 안 띄우는** 규칙. 이런 게 없어서 같은 입력에도 결과가 들쭉날쭉하고, 왜 그렇게 판단했는지 추적도 어렵다. |
| **해법** | gstack의 위 4가지 방법만 골라 rkit으로 옮기되, 각 스킬 문서를 **두 층으로 분리한다**. (1) **방법론 본문**은 도메인 중립으로 — 임베디드 어구 0건, MPU/WPF/일반 사용자가 읽어도 위화감 없음. (2) **도메인 예시 부록**에 MCU·MPU·WPF 절을 두고 같은 양식을 임베디드 사례로 보여줌 — 잠금 어휘 20개는 여기에 보존. 잠금 어휘는 `policies/locked-vocab.json`을 단일 출처(SoT)로 두고 4 SKILL이 링크. 또한 정책 강제력 확보를 위해 `scripts/verify-policy.js` + Stop 훅으로 **자동 검증**(잠금 어휘·제외 토큰·평가 파일 구문)을 강제한다. gstack 보조 스크립트·자체 메모리·사용량 수집·문장 품질 도구·웹 보안 항목 7가지는 명시적으로 가져오지 않는다. 변경 전후 효과 측정을 위해 평가 8쌍과 사례 시험 1세트를 함께 만든다. |
| **기능·체감 효과** | (i) `/investigate`가 위험한 결정 앞에서 자동으로 멈추고 "선택지 A/B/C — 각각의 좋은 점·나쁜 점"을 표로 보여주고 사용자에게 묻는다. (ii) 사용자에게 질문할 때마다 항상 "한 줄 쉬운 설명 + 추천안 + 장점 2개 이상 + 단점 1개 이상"이 들어간다. (iii) `/security-review`가 한 검사기만 강하게 의심할 때는 차단까지 가지 않고 경고로 낮춘다. 두 검사기가 동시에 의심해야 차단한다 → 잘못된 경보(거짓 양성) 감소. (iv) `/code-review`에서 "10번 돌려서 한 번도 안 잡힌 검사"는 자동으로 건너뛰어 빨라지지만, 보안과 데이터 이전 검사는 항상 돈다. 또 사용자가 이미 "이건 괜찮다"고 무시한 항목은 그 파일이 그대로면 다시 띄우지 않는다. **목표: 코드 리뷰 시간 30% 단축, 보안 거짓 경보 50% 감소, 임베디드 핵심 어휘는 단 한 개도 손실되지 않음.** |
| **핵심 가치** | **"방법론은 본문 일반론으로, 도메인은 부록 잠금으로, 정책은 자동 검증으로"** — 사이클 1의 "잡음 없이 깔끔하게 맞춘다"는 원칙을 스킬 문서 단계로 확장한다. 일반론·도메인·정책의 책임을 분리하여 한 층이 다른 층을 깎지 않게 한다. gstack 전용 보조 도구는 가져오지 않아 회귀 위험을 좁게 유지한다. |

---

## 1. 개요

### 1.1 목적

사이클 1 보고서의 §9 "다음 사이클로 이월"에서 명시적으로 사이클 1.5로 분리된 항목을 처리한다. gstack 4개 스킬의 **방법론 부분**만 골라 rkit으로 옮기고, 앞으로의 모든 gstack→rkit 동기화 작업에서 임베디드 분야 어휘 손실을 막을 수 있도록 **잠금 어휘 목록 정책**을 스킬 문서 단계에 정착시킨다.

### 1.2 배경

- **사이클 1 (완료, 일치율 100%, 2026-04-27 보관 처리됨)**: bkit v2.0.6 → v2.1.10 정리 + 감사 로그 강화. 의사결정 D-4에 따라 gstack 스킬 강화는 사이클 1.5로 분리됨 (정리 PR의 회귀 위험 표면을 최소화하려는 목적).
- **사이클 1.5 진입 조건 (보고서 §9)**: "각 스킬별 변경 전/후 평가 정의 + 임베디드 어휘(`HardFault`, `Device Tree`, `XAML` 등) 보존 정책 수립" → 본 기획서 §3, §4, §6에서 정의.
- **gstack 참조 위치**: `references/gstack/{investigate,retro,cso,review}/SKILL.md` (각각 918, 1619, 1358, 1632줄).
- **rkit 현재 상태**: `skills/{investigate,retro,security-review,code-review}/SKILL.md` (각각 324, 191, 171, 159줄). 합쳐서 845줄.

### 1.3 관련 문서

- 선행 보고서: `docs/archive/2026-04/bkit-gstack-sync-v2/bkit-gstack-sync-v2.report.md` (§9 이월 작업)
- 선행 기획서: `docs/archive/2026-04/bkit-gstack-sync-v2/bkit-gstack-sync-v2.plan.md` (의사결정 D-4)
- gstack 참조 근거 (모두 실제 파일에서 확인됨):
  - `references/gstack/investigate/SKILL.md:573` — 위험도 결정 시 멈춤 절차
  - `references/gstack/investigate/SKILL.md:295-322` — 추천안·장단점 질문 양식
  - `references/gstack/cso/SKILL.md` + `references/gstack/CLAUDE.md` — 차단/경고/기록만 임계값과 두 검사기 합산 규칙
  - `references/gstack/review/SKILL.md:1146` — 자주 안 잡히는 검사 자동 생략
  - `references/gstack/review/SKILL.md:1304` — 리뷰 간 중복 제거

---

## 2. 작업 범위

### 2.1 포함 범위 (이번 사이클에서 한다)

- [ ] **요구사항-01**: `/investigate` 스킬 문서에 **"위험도 높은 결정 앞에서 멈춤" 절** 추가. 멈추는 4가지 상황(아키텍처 결정 / 데이터 모델 변경 / 되돌리기 어려운 작업(`rm`/`dd`/플래시 지우기) / 정보가 30% 미만인 상태)과, 멈춘 뒤 2~3개 선택지의 좋은 점·나쁜 점을 비교해 보여주는 형식 정의.
- [ ] **요구사항-02**: 4개 스킬 공통으로 **"사용자 질문 양식" 절** 추가. 사용자에게 묻는 도구(`AskUserQuestion`)를 쓸 때 다음 5가지를 항상 포함하도록 강제. (1) 90자 이하의 결과 중심 질문, (2) 한 줄 쉬운 설명, (3) 추천안 + 한 줄 이유, (4) 각 선택지마다 좋은 점 ✅ 2개 이상 / 나쁜 점 ❌ 1개 이상 (각 항목 40자 이상), (5) 되돌릴 수 없는 선택지에는 "✅ 이건 한 번뿐인 결정이라 단점을 적지 않습니다" 같은 표시.
- [ ] **요구사항-03**: `/retro` 스킬 문서에 **"이전 회고와 비교" 절** 추가. `.rkit/state/learnings.json`에 회고 기록이 3건 이상 쌓였을 때 직전 회고와의 일치율 변화·반복 횟수 변화·사용한 스킬 변화를 표로 자동 첨부. 3건 미만이면 건너뜀.
- [ ] **요구사항-04**: `/retro` 스킬 문서에 **"AI 상투어 줄이기" 절** 추가. 회고 글에서 쓰지 말 단어 8개 (delve, robust, comprehensive, nuanced, fundamental, leverage, seamless, holistic), 줄표(em-dash) 금지, "실제 숫자·실제 파일 이름·실제 명령어를 쓴다"는 규칙. **임베디드 핵심 어휘는 이 금지에서 면제** (지키는 게 우선).
- [ ] **요구사항-05**: `/security-review` 스킬 문서에 **"차단/경고/기록만 단계 + 합산 판정" 절** 추가. 임계값: 차단 0.85 / 경고 0.60 / 기록만 0.40 (기존 0~10 점수와의 환산표: 8.5/10 = 0.85). 합산 규칙: (a) 한 검사기만 0.85 이상이면 경고로 낮춤, (b) 두 검사기(STRIDE 패턴 + 에이전트 문맥) 동시 0.60 이상이면 차단. **단, severity=critical 패턴은 강등 금지**: MCU(stack overflow + HardFault, S-MCU-001 펌웨어 위변조, Bootloader 변조, Flash 직접 수정, JTAG production 노출), MPU(S-MPU-001 커널 모듈 위변조, S-MPU-002 LD_PRELOAD 치환), WPF(S-WPF-001 DLL 인젝션) — 단일 검사기 ≥0.85만으로 차단 유지. `embedded-threat-model.js`의 `analyze(code, filePath, domain, minConfidence)` 호출 시그니처를 본문에 명시. **카나리 항목은 본 사이클에서 제외** (rkit에 카나리 토큰 인프라 0건 — dead rule 회피, 결정-1A 적용).
- [ ] **요구사항-06**: `/code-review` 스킬 문서에 **"자주 안 잡히는 검사 자동 생략" 절** 추가. `.rkit/state/code-review-stats.json`(새 파일)에서 검사별 히트율 조회. "10번 이상 돌렸는데 한 번도 못 잡은 검사"는 자동 생략 + 이유 출력. NEVER_GATE 고정(통계 무관 항상 실행): **보안 검사, 데이터 이전 검사, SKILL.md 일관성 검사, 잠금 어휘 동기화 검증, 평가 파일 구문 유효성** (5개로 확장). 표본 편향 방지를 위해 **N=20 커밋마다 강제 1회 재검(probe)** 실행 + 파일 패턴 변화(예: 신규 SKILL.md) 감지 시 카운터 리셋 + 생략 사유는 `.rkit/state/skip-log.json`에 기록. `--force-{이름}` 옵션으로 사용자 수동 강제 가능.
- [ ] **요구사항-07**: `/code-review` 스킬 문서에 **"리뷰 간 중복 제거" 절** 추가. `.rkit/state/review-history.jsonl`(새 파일, append-only, 원자적 쓰기 — 임시파일 + rename)에서 **최근 100 entries 윈도우**(O(N) 디스크 I/O 방지) 내 직전 리뷰의 "사용자가 무시함" 항목 식별값(파일+줄+규칙ID+severity+메시지 첫 80자, 유니코드 코드포인트 기준 sha256) 조회. 현재 리뷰 항목 식별값 일치 + `git diff --name-only <이전 커밋> HEAD`에 해당 파일 없음 → 숨김. "고침"·"자동 고침"은 항상 재검사. **JSONL 회전은 본 사이클 미적용** (윈도우 한정으로 충분, 결정-4A 적용).
- [ ] **요구사항-08 (변경)**: **잠금 어휘 단일 출처(SoT) 추출**. `policies/locked-vocab.json`을 신규로 만들어 20개 어휘 (MCU 7개: HardFault, CFSR, HFSR, MMFAR, BFAR, FreeRTOS, MISRA C / MPU 7개: Device Tree, dtsi, dtoverlay, bblayers.conf, Yocto, bitbake, U-Boot / WPF 6개: XAML, MVVM, ObservableObject, RelayCommand, .csproj, app.config) + 도메인 분류 + 의미 한 줄을 담는다. 4개 스킬 문서는 **방법론 본문에는 어휘 0건** (도메인 중립) + **도메인 예시 부록(MCU/MPU/WPF 절)에서만 사용** + **머리에 SoT 링크 1줄**. 부록은 `scripts/gen-locked-vocab.mjs`로 자동 생성 가능하여 수동 다중 편집 금지. 어휘는 일반화·번역·삭제 금지, gstack sync 시에도 보존. (결정-0 (ii) + 결정-3B 적용)
- [ ] **요구사항-09**: 4개 스킬 × {변경 전, 변경 후} = 8개 평가 시나리오. 위치: `evals/workflow/{code-review,retro}/cycle15-{before,after}.{prompt,expected}.md` + `evals/capability/{investigate,security-review}/{eval.yaml + cycle15 세트}`. 검증 항목: (i) 위험 결정 시 멈춤 발화(요-01), (ii) 사용자 질문 양식 충족(요-02), (iii) 차단/경고/기록만 정확 분류(요-05), (iv) 한 번 무시한 항목 재출력 안 함(요-07), (v) 임베디드 어휘 보존(요-08).
- [ ] **요구사항-10**: gstack→rkit 동기화 정책 문서. 위치: `docs/policy/gstack-sync-policy.md` (새 파일). 내용: SoT 링크(`policies/locked-vocab.json`) + 가져오지 않을 항목 7가지(보조 스크립트, 자체 메모리, 사용량 수집, 문장 품질 도구, 사이드바·웹소켓, 톤·정체성 문서, 웹 전용 보안 항목) + 검증 기준 (평가 통과, 본문 grep -v 임베디드 어휘 0건, 부록 잠금 어휘 1건 이상, 제외 토큰 0건). `CLAUDE.md` rkit 절에서 한 줄 링크. 정책 강제는 요-12에서 자동화.

- [ ] **요구사항-11 (신규)**: 작장 고도우 — `/code-review` SKILL.md에 **본문(도메인 중립) + 부록(MCU/MPU/WPF 도메인 예시) 두 층 분리** 명시. 다른 3 SKILL(`/investigate`, `/retro`, `/security-review`)도 동일 구조. ELI10 의무는 본문 일반론에만 적용 + **도메인 전문가 결정 시 ELI10 생략 가능** 예외 명시. 추천안 의무화는 **중립 자세 허용** ("추천: 없음 — 양쪽 트레이드오프 대등"). 한 번뿐인 결정 표시는 ✅ 대신 **⚠️ 또는 🚨**로 변경 (경고 의미 일치). (결정-0 (ii) + frontend-architect 권고)

- [ ] **요구사항-12 (신규)**: 정책 검증 자동화. `scripts/verify-policy.js` (신규, node ESM) — 본문 grep -v 임베디드 어휘 0건 / 부록 grep 잠금 어휘 ≥1건 / 제외 토큰 0건 / 평가 파일 구문 유효 / `policies/locked-vocab.json` 스키마 검증. `.claude/hooks/pre-commit` 또는 PostToolUse 훅에 등록. CI/local 동일 명령(`bun run verify:policy`). Windows 호환 보장 (bash for-loop 의존 제거). (결정-2B 적용)

### 2.2 제외 범위 (이번 사이클에서 안 한다)

- gstack의 `bin/gstack-*` 보조 스크립트 (스킬 시작 전 환경 점검 스크립트, 사용량 수집, 학습 검색, 저장소 모드 감지 등) → 임베디드 개발과 무관, 외부 의존
- gstack의 자체 메모리 시스템 (`~/.gstack/projects/$SLUG/learnings.jsonl`, 프로젝트 간 공유) → rkit은 `.rkit/state/learnings.json`을 이미 사용 (형식 다름)
- gstack의 문장 품질 검사 도구(slop-scan) 정책 → rkit은 `code-analyzer` 에이전트 + `lib/quality/`를 쓰는 중. 이 도구 도입은 별도 사이클에서 평가
- gstack의 브라우저 사이드바·웹소켓·터미널 보안 묶음 → 브라우저 자동화 대상, 임베디드 무관 (사이클 1 §9의 제외 정책과 동일)
- gstack의 변경 이력 출시 요약 양식, 정체성 문서(ETHOS.md) 톤 → rkit은 한글·영문 혼용 + 임베디드 도메인 톤. gstack 톤을 강제하면 임베디드 어휘가 일반어로 풀릴 위험 있음 → 잠금 어휘 정책으로 대체
- gstack `/cso`의 OWASP 웹 취약점 10대 항목 (XSS, CSRF, SQL Injection 등) → 이미 `agents/security-architect.md`에 웹 패턴 보유. **임베디드용 STRIDE 위협 모델은 그대로 유지하되, 임계값·합산 판정 메커니즘만 가져온다.**
- gstack `/review`의 7개 전문가(테스트·유지보수성·보안·성능·데이터 이전·API 계약·디자인) 라이브러리 전체 도입 → 사이클 2 평가 대상 (요-06은 자동 생략 *원리*만 가져오고, 전문가 라이브러리는 들이지 않는다)
- bkit의 `BKIT_VERSION` 단일 출처 (사이클 1 D-5에서 사이클 2로 이월하기로 결정) → 본 사이클 무관
- 새 에이전트 추가 또는 기존 에이전트(`code-analyzer`, `security-architect`, `gap-detector`)의 **동작 의미** 변경 → 스킬 문서 단계에서만 변경
- 새 npm 의존성 추가 → 모든 변경은 기존 인프라(`AskUserQuestion` 도구, 파일 도구, `lib/quality/embedded-threat-model.js`) 위에서 스킬 문서 글만 수정

---

## 3. 요구사항

### 3.1 기능 요구사항

| 번호 | 요구사항 | 우선순위 | 상태 |
|------|----------|:--------:|------|
| 요-01 | `/investigate`에 멈춤 절차 추가 (4가지 트리거 + 멈춤 절차 + 2~3 선택지 비교 양식). 트리거: 아키텍처 결정 / 데이터 모델 변경 / 되돌리기 어려운 작업(`rm`/`dd`/플래시 지우기) / 정보 부족(30% 미만) | 높음 | 미시작 |
| 요-02 | 4개 스킬 공통 사용자 질문 양식. 필수 5요소: 결과 중심 질문(≤90자) + 한 줄 쉬운 설명 + 추천안(이유 포함) + 선택지마다 좋은 점 ✅ 2개 이상 / 나쁜 점 ❌ 1개 이상 (각 40자 이상) + 되돌릴 수 없는 선택은 "한 번뿐인 결정" 표시 | 높음 | 미시작 |
| 요-03 | `/retro`에 이전 회고와의 비교 절. `.rkit/state/learnings.json` 항목 3건 이상일 때 직전 대비 일치율 변화·반복 횟수 변화·스킬 사용 변화 표 자동 첨부. 3건 미만이면 건너뜀. | 중간 | 미시작 |
| 요-04 | `/retro`에 AI 상투어 줄이기 절. 금지 단어 8개 (delve, robust, comprehensive, nuanced, fundamental, leverage, seamless, holistic), 줄표 금지, 실제 숫자·파일명·명령어 강제. 임베디드 어휘는 면제. | 중간 | 미시작 |
| 요-05 | `/security-review`에 차단·경고·기록만 임계값 + 합산 판정 절. 임계값: 차단 0.85, 경고 0.60, 기록만 0.40. 환산표 명시(8.5/10 = 0.85). 합산 규칙: 한 검사기만 0.85 이상이면 경고로 낮춤, 두 검사기(STRIDE 패턴 + 에이전트 문맥) 동시 0.60 이상이면 차단. 카나리 노출은 무조건 차단. | 높음 | 미시작 |
| 요-06 | `/code-review`에 자주 안 잡히는 검사 자동 생략 절. `.rkit/state/code-review-stats.json`(신규)에서 검사별 히트율 조회. "10번 이상 0건"이면 자동 생략 + 이유 출력. 보안·데이터 이전 검사는 고정 항상-실행. `--force-{이름}` 옵션으로 사용자 수동 강제. | 높음 | 미시작 |
| 요-07 | `/code-review`에 리뷰 간 중복 제거 절. `.rkit/state/review-history.jsonl`(신규)에서 직전 리뷰의 "사용자가 무시함" 항목 식별값 조회 (파일+줄+규칙ID sha256). 같은 식별값 + `git diff --name-only <이전 커밋> HEAD`로 그 파일이 안 바뀌었으면 숨김. "고침"·"자동 고침"은 항상 재검사. | 높음 | 미시작 |
| 요-08 | 4개 스킬 문서 머리에 임베디드 잠금 어휘 목록 절. 20개 어휘 (MCU 7개 / MPU 7개 / WPF 6개). 정책: "풀어쓰기·번역·삭제 금지. gstack 동기화 시에도 보존." | 높음 | 미시작 |
| 요-09 | 4개 스킬 × {변경 전, 변경 후} = 8개 평가 세트. 위치: `evals/workflow/{code-review,retro}/cycle15-{before,after}.{prompt,expected}.md` + `evals/capability/{investigate,security-review}/{eval.yaml + cycle15 세트}`. 검증: 멈춤 발화 / 질문 양식 충족 / 차단·경고·기록만 정확 분류 / 무시 항목 재출력 0건 / 임베디드 어휘 보존. | 높음 | 미시작 |
| 요-10 | gstack→rkit 동기화 정책 문서. 위치: `docs/policy/gstack-sync-policy.md` 신규. 내용: 잠금 어휘 20개 + 제외 항목 7가지 + 검증 기준. `CLAUDE.md` rkit 절에서 한 줄 링크. | 중간 | 미시작 |

### 3.2 비기능 요구사항

| 항목 | 기준 | 측정 방법 |
|------|------|----------|
| **스킬 로딩 시간** | 변경 후 스킬 문서 읽는 시간 회귀 5% 이내 (현재 4 스킬 합산 845줄 → 약 1,400줄로 +60%이지만 토큰화는 줄 수에 비례) | `time node -e "require('./lib/skills/loader').loadAll()"` 비교 (대응 스크립트 있다면) |
| **평가 실행 시간** | 8개 평가 합산 2분 이내 (rkit 자체 패턴 검증은 외부 LLM 판정 없이 정규식·grep 기반) | `time bun test evals/workflow/code-review evals/workflow/retro evals/capability/investigate evals/capability/security-review` 또는 동등 npm |
| **방법론 본문 도메인 중립** | 4 SKILL의 방법론 본문(부록 제외)에 임베디드 어휘 0건. | `bun run verify:policy --check body-neutrality` (요-12) |
| **도메인 부록 어휘 보존** | 잠금 어휘 20개가 4 SKILL 부록에서 각 1건 이상 유지. 손실 0건. | `bun run verify:policy --check vocab-preservation` (요-12) — `policies/locked-vocab.json` SoT 기준 |
| **스킬 로딩 시간** | 변경 후 4 SKILL 합산 토큰 35K 이내 유지 | `node -e "..."` 측정 (NFR §8 추가) |
| **평가 실행 시간** | 8 평가 합산 2분 이내 — `eval.yaml`에 `judge: regex_only` 명시로 LLM judge 호출 0건 보장 | `time bun test evals/...` |
| **사용자 질문 양식 준수** | 4개 스킬 문서 안의 모든 사용자 질문 예제(예시 포함)가 요-02의 5요소 충족 | 정규식: `^Recommendation:` 또는 `^추천안:`, `✅`/`❌` 카운트 ≥2/≥1 per 선택지 |
| **임계값 정확도** | 요-05 적용 후 사례 모음 기반 회귀 시험: 알려진 위급 5/5 차단 유지, 알려진 거짓 경보 3/3 경고로 강등 | `evals/capability/security-review/expected-cycle15-after.md` 비교 |
| **리뷰 중복 제거 정확도** | 같은 항목 재출력 0건 (요-07 사례: 직전에 무시 3건, 파일 안 바뀜 → 현재 출력 0건). 파일이 바뀐 1건은 정상 출력. | 사례: `tests/code-review/cross-review-dedup.smoke.test.js` (신규, 4건 이상) |
| **회귀 영향** | 기존 `code-review`의 Stop 훅(완료 시 실행되는 훅) 동작, `code-analyzer`/`gap-detector`/`security-architect` 에이전트 동작 의미 무변경 | 기존 평가(`evals/workflow/code-review/`) 통과 유지 |

---

## 4. 성공 기준

### 4.1 완료 기준

- [ ] 요-01 ~ 요-10 구현 완료 (10/10)
- [ ] 4개 스킬 문서 머리에 잠금 어휘 절 존재
- [ ] 8개 평가 세트({변경 전, 변경 후} × 4개 스킬) 작성 및 통과
- [ ] `docs/policy/gstack-sync-policy.md` 신규 + `CLAUDE.md` 링크
- [ ] 기존 평가(`evals/workflow/code-review/`) 통과 유지 (회귀 0건)
- [ ] 일치율 90% 이상 (사이클 1.5의 검증 단계)

### 4.2 품질 기준

- [ ] 잠금 어휘 20개 grep ≥1건/스킬 × 4개 스킬 = 80건 통과, 손실 0건
- [ ] 제외 항목 7가지에 해당하는 패턴/코드 도입 0건 (`grep -E "gstack-update-check|gstack-config|gstack-slug|GBrain|TELEMETRY:|EXPLAIN_LEVEL:|slop-scan" skills/`)
- [ ] 사용자 질문 양식 준수: 4개 스킬의 질문 예제 모두 한 줄 쉬운 설명/추천안/좋은 점 2개 이상/나쁜 점 1개 이상 포함
- [ ] 리뷰 중복 제거 신규 사례 시험 4건 이상 통과
- [ ] 스킬 문서의 머리말 형식 검증 통과 (`node -e ...`로 머리말 파싱 확인)

---

## 5. 위험과 대응

| 번호 | 위험 | 영향 | 발생 가능성 | 대응 |
|------|------|:----:|:----------:|------|
| 위-1 | gstack 글을 그대로 가져다 쓰면 임베디드 어휘가 일반어로 풀려 사라짐 (예: "fault" → "error", "ISR" → "callback") | 큼 | 높음 | **요-08 잠금 어휘 목록**이 1차 방어. 비기능 요구사항으로 어휘 grep 검증 강제. 글을 쓸 때 gstack 원문을 인용하지 않고 **rkit 임베디드 예시로 다시 쓴다** (예: 보안 취약점 예시는 "stack overflow" 단독이 아니라 "stack overflow + HardFault 트리거"로). |
| 위-2 | gstack 전용 보조 스크립트·환경 점검 코드를 의도치 않게 스킬 문서에 옮김 (예: `~/.claude/skills/gstack/bin/...` 인용) | 큼 | 중간 | 제외 항목 7가지를 §2.2에 명시. 비기능 요구사항 grep으로 `gstack-config`, `gstack-slug`, `GBrain`, `TELEMETRY:` 등 토큰 0건 검증. PR 시 자기 점검표. |
| 위-3 | 0.85/0.60/0.40 임계값이 rkit 사례에 안 맞아 거짓 양성·거짓 음성 변동 (특히 MCU 스택 오버플로 패턴은 한 검사기만으로도 명확한데 강등됨) | 큼 | 중간 | 요-05에 "카나리 노출은 무조건 차단" + "MCU 위급 패턴(예: stack overflow + HardFault 트리거)은 강등 금지" 예외 명시. 변경 전/후 평가에서 알려진 위급 5건이 차단을 유지하는지 검증. |
| 위-4 | 자동 생략이 통계 부족(rkit은 리뷰 통계 신생) → 모든 검사가 매번 실행됨 | 중간 | 높음 | 통계 10회 이상이 안 쌓이면 **모두 실행** (안전한 기본값). 보안·데이터 이전 검사 2개는 통계와 무관하게 항상 실행. 통계는 시간 경과로 자연스럽게 쌓임. |
| 위-5 | 리뷰 중복 제거 시 식별값 충돌 (파일+줄+규칙ID sha256이 우연히 같음) → 다른 항목을 잘못 숨김 | 중간 | 낮음 | 식별값에 `심각도` + `메시지 첫 80자`도 포함하여 충돌 확률 낮춤. "고침"·"자동 고침"은 절대 숨기지 않음 (회귀 검사 보장). |
| 위-6 | 스킬 문서 줄 수 증가로 스킬 2.0 토큰 상한(약 40K) 근접 (gstack는 25~35K로 합법) | 작음 | 낮음 | rkit 4 스킬 현재 합산 약 12K 토큰으로 추정 → +60% 시 약 19K. 여유 큼. 그래도 요-08 잠금 어휘 목록은 **한 스킬에만 본문 정의 + 나머지 3 스킬은 한 줄 링크**로 줄여 중복 회피. |
| 위-7 | gstack 동기화 정책 문서(요-10)가 사이클 2의 신규 모듈 평가(사이클 1 D-5, 보고서 §9 사이클 2)와 충돌 | 작음 | 중간 | 요-10에 "본 정책은 스킬 문서 단계 동기화에만 적용. lib/, agents/, hooks/ 신규 모듈 도입은 별도 사이클별로 평가" 명시 + "범위 확장은 신규 design 문서 + NEVER_GATE 재평가 필수" 조항 추가. 사이클 2 시작 시 재평가. |
| 위-8 (신규) | `code-review-stats.json` 갱신 도중 인터럽트로 partial JSON 파손 → 다음 호출에서 JSON.parse 실패 | 중간 | 중간 | infra-architect HIGH 권고 반영. 모든 갱신은 임시파일 쓰기 + rename 패턴(원자적). parse 실패 시 빈 객체 fallback + 감사 로그 기록. |
| 위-9 (신규) | 잠금 어휘 추가 시 4 SKILL + 정책 + 검증 명령 동기화 실패 (사람 다중 편집) | 큼 | 높음 | enterprise-expert HIGH 권고 반영. D-4(d) `policies/locked-vocab.json` SoT + 부록 자동 생성으로 수동 편집 0건. 요-12 자동 검증으로 SoT-부록 일관성 강제. |
| 위-10 (신규) | 정책 강제력 부재로 3개월 내 정책 무력화 | 큼 | 높음 | 요-12 (`scripts/verify-policy.js` + Stop 훅) 도입. PR 시 자동 통과/차단. CI 자동화 필수. |
| 위-11 (신규) | combineVerdict 분기 우선순위 결함으로 (0.85, 0.60) 같은 경계 케이스가 BLOCK인지 WARN인지 모호 | 큼 | 중간 | code-analyzer HIGH 권고 반영. Design §4.5 분기 순서 재정렬 + TC-9~13 외에 경계 케이스 TC 3건 추가 (분기 우선순위 / 분류기 충돌 / LOG_ONLY 합산). |
| 위-12 (신규) | severity 표기 3종 혼용으로 SKILL.md·평가·코드 간 enum 불일치 | 작음 | 높음 | code-analyzer HIGH 권고 반영. Design §3에 enum 표기 컨벤션 통일 명시 (verdict 단계는 UPPER_SNAKE, gateStatus는 lower_snake, severity는 lower 단어). |
| 위-13 (신규) | severity=critical 단일 분류기 강등이 정규식 검사기(결정론적, 신뢰 높음)의 위급 발견을 묻어버림 | 큼 | 중간 | security-architect HIGH 권고 반영. 요-05에 "severity=critical 패턴은 강등 금지 — MCU/MPU/WPF 8개 패턴" 추가. TC-13 + 신규 TC로 검증. |

---

## 6. 아키텍처 고려사항

### 6.1 프로젝트 레벨

| 레벨 | 특징 | 추천 대상 | 선택 |
|------|------|----------|:----:|
| **Starter** | 단순 구조 | 정적 사이트 | ☐ |
| **Dynamic** | 기능별 모듈 | 웹앱, MVP | ☐ |
| **Enterprise** | 엄격한 계층 분리 | 대용량 시스템 | ☐ |
| **rkit (임베디드)** | MCU/MPU/WPF 도메인 플러그인 (스킬+에이전트+훅 계층) | 본 프로젝트 | ☑ |

> rkit은 위 3 레벨 분류 외 임베디드 플러그인 전용 구조. 본 사이클 1.5의 변경은 **스킬 문서 계층에만 한정**.

### 6.2 핵심 의사결정

| 번호 | 결정 항목 | 선택지 | 채택 | 이유 |
|------|-----------|--------|:----:|------|
| **D-1 (변경)** | gstack 텍스트 가져오는 방식 | (a) 그대로 복사 + 단순 번역 / (b) 방법론만 추출 + rkit 도메인 예시로 한 층에 다시 작성 / (b') **본문은 도메인 중립 일반론, 부록에 MCU/MPU/WPF 도메인 예시 분리 (두 층 구조)** / (c) 통째로 통합 | **(b')** | (b)는 frontend-architect HIGH-1 (HardFault 예시 + ELI10 노이즈), security-architect CRITICAL (카나리 dead rule)에서 한 층 혼합의 모순 드러남. (b')는 본문은 일반 사용자에게도 자연스럽고 부록은 도메인 전문가에게 적합. 결정-0 (ii). |
| **D-2** | 사용자 질문 양식 적용 범위 | (a) 4개 스킬만 / (b) 모든 스킬(28개) | **(a)** | 본 사이클 범위는 4 스킬. 28개 전체 적용은 회귀 위험 표면이 너무 큼 (D-4와 동일 원칙: 정리 PR의 회귀 표면 최소화). 성공 시 사이클 2 이후 점진 확대. |
| **D-3** | 임계값 단위 표준 | (a) 0~10 정수 (rkit 기존 점수) / (b) 0.0~1.0 실수 (gstack의 ML 점수) / (c) **두 단위 모두 명시 + 환산표 제공** | **(c)** | 기존 `/security-review --confidence 8` 호환 유지 + gstack의 0.85 등 참조 명시. 스킬 문서 본문에 `8.5/10 = 0.85` 환산표 한 줄 추가. |
| **D-4 (변경)** | 잠금 어휘 목록 저장 위치 | (a) 4 SKILL 각각 본문 정의 / (b) 한 SKILL 본문 + 3 SKILL 링크 / (c) `docs/policy/`에만 저장 / **(d) `policies/locked-vocab.json` SoT + 4 SKILL 부록 자동 생성** | **(d)** | (b)는 enterprise-expert HIGH 권고 (4 SKILL + 정책 + 검증 명령 누락 시간 문제). (d)는 SoT가 본문/부록 일관성 보장의 자연스러운 도구. 부록은 `scripts/gen-locked-vocab.mjs`로 자동 생성. 위-9 (어휘 동기화 실패) 본질적으로 해소. 결정-3B. |
| **D-7 (신규)** | 카나리 토큰 정책 처리 | (a) **본 사이클 §4.5에서 카나리 절 제거** / (b) 새 FR로 `docs/policy/canary-tokens.md` + 검출 정규식 ≥3개 동반 도입 | **(a)** | rkit 코드/스킬에 카나리 토큰 인프라 0건 (security-architect grep 확인). 정의 없이 명시하면 dead rule이 되어 TC가 가짜 통과될 위험. carry-over에 없던 항목으로 본 사이클 스코프 깔끔. 결정-1A. |
| **D-8 (신규)** | 정책 강제 메커니즘 | (a) NFR로만 사람 grep 검증 / (b) **`scripts/verify-policy.js` + Stop 훅 자동화** | **(b)** | enterprise-expert HIGH (사람 검증은 3개월 내 무력화 확실) + infra-architect HIGH (Windows 호환 위해 bash 의존 제거 필요). 결정-2B. FR-12로 신설. |
| **D-5** | 신규 통계·이력 파일 위치 | (a) `.rkit/state/` (기존 위치) / (b) `.rkit/runtime/` / (c) `docs/03-analysis/.review-meta/` | **(a)** | `.rkit/state/`는 v1.5.9 경로 등록소로 이미 표준화. `pdca-status.json` / `learnings.json`과 일관. `.rkit/runtime/`은 에이전트 상태/이벤트용. v1.5.9 정책 준수. |
| **D-6** | 사이클 1.5 묶음 범위 | (a) **사이클 1.5는 4개 스킬만** (본 기획서) / (b) 사이클 2 신규 모듈 1~2개 미리 / (c) 사이클 1.5a (스킬) + 1.5b (평가 인프라)로 분할 | **(a)** | (b)는 D-4 원칙 위반 (회귀 표면 ↑). (c)는 8개 평가 세트 작성이 본 사이클의 핵심 검증인데 분할 시 검증 공백. (a)가 사이클 1 이월 작업과 정확히 일치. |

### 6.3 변경 대상 파일

```
영향 범위 (예상 줄 수 ±):
┌────────────────────────────────────────────────────────────────┐
│ skills/investigate/SKILL.md          324 → ~520줄  (+196)     │
│ skills/retro/SKILL.md                191 → ~360줄  (+169)     │
│ skills/security-review/SKILL.md      171 → ~290줄  (+119)     │
│ skills/code-review/SKILL.md          159 → ~410줄  (+251)     │
│   (잠금 어휘 본문 정의 + 자동 생략 + 리뷰 중복 제거)            │
├────────────────────────────────────────────────────────────────┤
│ docs/policy/gstack-sync-policy.md    신규  ~150줄  (+150)     │
│ CLAUDE.md (rkit 절)                  +1줄 링크                 │
├────────────────────────────────────────────────────────────────┤
│ evals/workflow/code-review/cycle15-{before,after}.{prompt,expected}.md  신규 │
│ evals/workflow/retro/cycle15-{before,after}.{prompt,expected}.md         신규 │
│ evals/capability/investigate/{eval.yaml + cycle15 세트}                  신규 │
│ evals/capability/security-review/{eval.yaml + cycle15 세트}              신규 │
│   8개 평가 파일 × 약 50줄 = +400줄                              │
├────────────────────────────────────────────────────────────────┤
│ tests/code-review/cross-review-dedup.smoke.test.js   신규 약 120줄 │
├────────────────────────────────────────────────────────────────┤
│ 합계: +1,405줄, 삭제 0줄 (추가만)                              │
└────────────────────────────────────────────────────────────────┘
```

### 6.4 커밋 순서 미리보기 (변경: 7 → 9 커밋)

```
C0  feat(policies): policies/locked-vocab.json + scripts/gen-locked-vocab.mjs (요-08 SoT 기반)
C1  feat(skills/investigate): 본문(도메인 중립) + 부록(MCU/MPU/WPF 예시)        (요-01, 요-02, 요-11)
C2  feat(skills/retro): 본문(이전 비교 + 상투어 면제) + 부록(도메인 회고 예시)    (요-03, 요-04, 요-11)
C3  feat(skills/security-review): 본문(임계값+합산, severity=critical 강등 금지) (요-05, 요-11)
C4  feat(skills/code-review): 본문(자동 생략 + 중복 제거 + atomic write)         (요-06, 요-07, 요-11)
C5  feat(skills): SoT 링크 머리말 + 부록 도메인 절 채움                           (요-08, 요-11)
C6  feat(scripts): scripts/verify-policy.js + .claude/hooks/pre-commit 등록      (요-12)
C7  test(evals): cycle15 8 세트 + 사례 시험 + judge: regex_only 명시              (요-09)
C8  docs(policy): gstack-sync-policy.md + CLAUDE.md 링크 + verify-policy 통합 안내 (요-10)
```

각 커밋 독립 검증 가능. C0이 SoT 도입(D-4 d), C1~C4는 본문 일반론(도메인 어휘 0건 grep 통과 필요), C5는 부록을 SoT에서 자동 생성, C6은 자동 검증 인프라, C7~C8은 평가·정책 문서. 회귀 시 단일 커밋 되돌리기 가능.

---

## 7. 컨벤션 준비

### 7.1 기존 프로젝트 컨벤션

- [x] `CLAUDE.md` rkit 절 존재
- [x] `.rkit/state/` 경로 등록소 (v1.5.9)
- [x] 스킬 문서 머리말 표준 (name/description/classification/...)
- [x] 평가 디렉터리 구조 (`evals/{capability,workflow,hybrid}/{스킬}/`)
- [x] `lib/quality/embedded-threat-model.js` (security-review 의존)

### 7.2 정의·검증할 컨벤션

| 항목 | 현재 상태 | 정의 내용 | 우선순위 |
|------|-----------|----------|:--------:|
| **gstack 동기화 정책** | 미정의 (사이클 1에서 비공식) | `docs/policy/gstack-sync-policy.md` (요-10) | 높음 |
| **사용자 질문 양식 표준** | 비공식 (각 스킬 자유 형식) | 4개 스킬 공통 절 (요-02) | 높음 |
| **잠금 어휘 grep 검증** | 없음 | 비기능 요구사항으로 강제 (검증 명령 §3.2) | 높음 |
| **스킬 통계·이력 파일 위치** | `.rkit/state/` (v1.5.9 표준) | 신규 `code-review-stats.json` + `review-history.jsonl`도 동일 위치 (D-5) | 중간 |

### 7.3 환경 변수

본 사이클은 새 환경 변수 도입 없음. 기존 `RKIT_AUTOMATION_LEVEL`, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` 등 변경 없음.

### 7.4 파이프라인 통합

본 사이클은 9단계 개발 파이프라인 외부. PDCA 사이클 내부 사이클 1.5 (계획 → 설계 → 실행 → 검증 → 보고 → 보관).

---

## 8. 다음 단계

1. [ ] 사용자 검토: D-1 ~ D-6 의사결정 (특히 D-1 가져오는 방식, D-4 잠금 어휘 위치) — 본 기획서 승인 게이트
2. [ ] `/pdca design bkit-gstack-sync-v2-cycle15` — 설계 문서 작성 (요-01 ~ 요-10에 대한 구체 변경 위치 + 시험 사례 매트릭스 + 커밋 분해 확정)
3. [ ] `/pdca do bkit-gstack-sync-v2-cycle15` — C1 ~ C7 순차 구현
4. [ ] `/pdca analyze bkit-gstack-sync-v2-cycle15` — gap-detector로 요구사항/비기능 요구사항/시험 매칭 + 잠금 어휘·제외 항목 grep 검증
5. [ ] `/pdca report bkit-gstack-sync-v2-cycle15` + `/pdca archive --summary` + 사이클 2 진입 결정

---

## 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 0.1 | 2026-04-28 | 초안. 사이클 1 보고서 §9 이월 작업 반영. 10 요구사항, 7 비기능 요구사항, 7 위험, 6 의사결정. | 노수장 |
| 0.2 | 2026-04-28 | 영문 기술 용어를 한글로 풀어쓰기 (사용자 요청). Reserved 어휘·도구명·파일명·명령어는 식별 보존. | 노수장 |
| 0.3 | 2026-04-28 | 6인 council 검증 18건 반영. 결정-0 (ii) 본문/부록 두 층 분리(D-1 b'), 결정-1A 카나리 제거(D-7), 결정-2B 정책 자동화(D-8, FR-12), 결정-3B SoT 추출(D-4 d, FR-08 변경), 결정-4A 윈도우 한정. FR 10→12, Risk 7→13, 커밋 7→9. | 노수장 + 6인 council |
