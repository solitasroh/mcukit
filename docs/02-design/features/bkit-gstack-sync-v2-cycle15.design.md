---
template: design
version: 1.2
---

# bkit-gstack-sync-v2 사이클 1.5 설계 문서 (v0.2)

> **한 줄 요약**: 4 SKILL을 **본문(도메인 중립) + 부록(MCU/MPU/WPF 도메인 예시)** 두 층으로 분리한다. 잠금 어휘는 `policies/locked-vocab.json` 단일 출처(SoT)에서 부록을 자동 생성. 정책 강제는 `scripts/verify-policy.js` + Stop 훅 자동화. 카나리 항목은 본 사이클 제외(dead rule).
>
> **프로젝트**: rkit
> **버전**: v0.9.14 → v0.9.15 (목표)
> **작성자**: 노수장 + 6인 council (design-validator, code-analyzer, security-architect, frontend-architect, enterprise-expert, infra-architect)
> **작성일**: 2026-04-28
> **상태**: Draft v0.2 (council 18건 반영)
> **기획서**: [bkit-gstack-sync-v2-cycle15.plan.md](../../01-plan/features/bkit-gstack-sync-v2-cycle15.plan.md) v0.3

---

## 1. 개요

### 1.1 설계 목표

1. **두 층 분리**: 4 SKILL을 (i) 방법론 본문 — 임베디드 어구 0건, 일반 사용자도 자연스러움 + (ii) 도메인 예시 부록 — MCU/MPU/WPF 절에서 잠금 어휘 보존. 같은 양식이 두 층에서 다른 톤으로 나타남.
2. **단일 출처 SoT**: `policies/locked-vocab.json` 하나에서 잠금 어휘 20개 + 도메인 분류 + 의미 정의. 4 SKILL 부록은 `scripts/gen-locked-vocab.mjs`로 자동 생성. 수동 다중 편집 0건.
3. **정책 자동 검증**: `scripts/verify-policy.js`가 (a) 본문 grep -v 임베디드 어휘 0건 / (b) 부록 grep 잠금 어휘 ≥1건 / (c) 제외 토큰 0건 / (d) 평가 파일 구문 / (e) SoT 스키마를 PR 시·`/code-review` 시·CI에서 자동 검증. 사람 검증 의존 제거.
4. **임계값·합산 안전 보강**: severity=critical 패턴(MCU/MPU/WPF 8개)은 단일 분류기 강등 금지. `analyze()` 호출 시그니처 명시. 분기 우선순위 재정렬. 카나리는 본 사이클 제외.
5. **회귀 표면 최소화**: 9 커밋 모두 독립 검증 가능. 새 npm 의존성·새 에이전트·기존 에이전트 동작 의미 변경 0건. 기존 인프라(`embedded-threat-model.js`, `audit-logger.js`, agent들) 미변경.

### 1.2 설계 원칙

- **방법론은 본문 일반론으로, 도메인은 부록 잠금으로, 정책은 자동 검증으로** (사이클 1.5 핵심)
- **글만 바뀐다**: SKILL.md 4개 + 부록 자동 생성 + 정책 1개 + 평가 14개 + 검증 스크립트 1개 + 사례 시험 1개. JS 비즈니스 로직 0건.
- **상태 파일은 v1.5.9 Path Registry 준수 + 원자적 쓰기**: `.rkit/state/` 격리 + 임시파일+rename 패턴.
- **안전한 기본값**: 통계 부족 시 모든 검사 실행. NEVER_GATE 5개(보안·데이터 이전·SKILL.md 일관성·잠금 어휘 동기화·평가 파일 구문) 통계 무관 항상 실행.

---

## 2. 아키텍처

### 2.1 변경 대상 파일 지도 (v0.2)

```
rkit/
├── policies/                              ← 신규 디렉터리
│   └── locked-vocab.json                  (신규 ~80줄, 잠금 어휘 SoT)
├── scripts/
│   ├── verify-policy.js                   (신규 ~250줄, node ESM, Windows 호환)
│   └── gen-locked-vocab.mjs               (신규 ~80줄, 부록 자동 생성)
├── skills/
│   ├── investigate/SKILL.md               (수정 +180줄: 본문 §위험 결정 멈춤·§질문 양식·SoT 링크 / 부록 §MCU·§MPU·§WPF 예시)
│   ├── retro/SKILL.md                     (수정 +160줄: 본문 §이전 비교·§상투어·§질문 양식·SoT 링크 / 부록 §MCU·§MPU·§WPF 예시)
│   ├── security-review/SKILL.md           (수정 +140줄: 본문 §임계값+합산·§질문 양식·SoT 링크 / 부록 §MCU·§MPU·§WPF 예시)
│   └── code-review/SKILL.md               (수정 +280줄: 본문 §자동 생략·§중복 제거·§질문 양식·SoT 링크 / 부록 §MCU·§MPU·§WPF 예시)
├── docs/policy/
│   └── gstack-sync-policy.md              (신규 ~140줄)
├── CLAUDE.md                              (수정 +1줄: 정책 + verify-policy 명령 안내)
├── .claude/hooks/                         (기존 디렉터리, 추가)
│   └── pre-commit                         (수정 또는 신규: verify-policy 훅 등록)
├── evals/
│   ├── workflow/code-review/              cycle15-{before,after}.{prompt,expected}.md + eval.yaml(`judge: regex_only`)
│   ├── workflow/retro/                    cycle15-{before,after}.{prompt,expected}.md + eval.yaml
│   ├── capability/investigate/            cycle15-{before,after}.{prompt,expected}.md + eval.yaml
│   └── capability/security-review/        cycle15-{before,after}.{prompt,expected}.md + eval.yaml
├── tests/code-review/
│   └── cross-review-dedup.smoke.test.js   (신규 ~150줄, 5 TC: 윈도우 한정 1건 추가)
└── .rkit/state/
    ├── code-review-stats.json             (신규 — 검사 히트율, 원자적 쓰기)
    ├── review-history.jsonl               (신규 — 리뷰 이력, append-only + atomic, 100 entries 윈도우)
    └── skip-log.json                      (신규 — 자동 생략 사유 기록)
```

**합계 (v0.2)**: 수정 5 파일 (+760줄), 신규 18 파일 (+870줄). 삭제 0건.

### 2.2 의존 관계 (v0.2)

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자 / Claude Code                                            │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────┐    ┌─────────────────────────────────┐
│  Skill Loader (미변경)    │    │  Stop 훅 / Pre-commit 훅          │
└────────────┬─────────────┘    └────────────┬────────────────────┘
             │                                │
             ▼                                ▼
┌──────────────────────────┐    ┌─────────────────────────────────┐
│  4 SKILL.md (변경)        │    │  scripts/verify-policy.js (신규) │
│  ├ 본문 (도메인 중립)      │◄───┤  ├ 본문 grep -v 임베디드 어휘 0  │
│  ├ §질문 양식             │    │  ├ 부록 grep 잠금 어휘 ≥1        │
│  ├ §임계값+합산 (요-05)    │    │  ├ 제외 토큰 grep 0             │
│  ├ §자동 생략 (요-06)      │    │  ├ eval.yaml 구문               │
│  ├ §중복 제거 (요-07)      │    │  └ SoT 스키마 검증              │
│  ├ SoT 링크 머리말        │    └────────────┬────────────────────┘
│  └ 부록 (MCU/MPU/WPF)    │◄───┐            │ 검증 결과
│   ▲ scripts/gen-locked-  │    │            ▼
│     vocab.mjs로 자동 생성│    │   ┌─────────────────────────┐
└────────────┬─────────────┘    │   │ pass: 진행              │
             │                   │   │ fail: 차단 + 사유 출력  │
             ▼                   │   └─────────────────────────┘
┌──────────────────────────┐    │
│  policies/locked-vocab   │────┘ (SoT)
│  .json (신규)             │
└──────────────────────────┘

상태 파일 (.rkit/state/, 모두 원자적 쓰기):
  code-review-stats.json   ← /code-review 종료 시 갱신
  review-history.jsonl     ← /code-review 사용자 응답 시 append (lock 없이 atomic)
  skip-log.json            ← 자동 생략 발생 시 기록
```

### 2.3 기존 인프라 의존 (변경 없음 — v0.1과 동일)

| 인프라 | 역할 | 변경 |
|--------|------|:----:|
| `lib/quality/embedded-threat-model.js` | STRIDE 분석 — `analyze(code, filePath, domain, minConfidence)` 호출 (security-architect 확인) | ❌ |
| 5개 agent (code-analyzer, security-architect, design-validator, gap-detector, qa-monitor) | 동작 의미 무변경 | ❌ |
| `lib/audit/audit-logger.js` | 감사 로그 (사이클 1 강화 완료) | ❌ |
| `.rkit/state/learnings.json` | 회고 학습 누적 — 읽기 전용 + version 검증 | 읽기 |
| `scripts/code-review-stop.js` | `/code-review` Stop 훅 | ❌ |

---

## 3. 데이터 모델

### 3.1 `code-review-stats.json` (FR-06, 원자적 쓰기)

**위치**: `.rkit/state/code-review-stats.json`
**갱신 패턴**: 임시파일 쓰기 + rename (인터럽트 안전, 위-8)
**parse 실패 시**: 빈 객체로 fallback + 감사 로그 기록 (`audit-logger.js` category=`system`)

```json
{
  "version": "1.0",
  "lastUpdated": "2026-04-28T00:00:00Z",
  "specialists": {
    "testing":            { "dispatchCount": 12, "totalFindings": 5, "lastDispatch": "2026-04-28T00:00:00Z", "gateStatus": "active",         "lastProbe": null },
    "maintainability":    { "dispatchCount": 12, "totalFindings": 8, "lastDispatch": "2026-04-28T00:00:00Z", "gateStatus": "active",         "lastProbe": null },
    "security":           { "dispatchCount": 10, "totalFindings": 0, "lastDispatch": "2026-04-28T00:00:00Z", "gateStatus": "never_gate",     "lastProbe": null },
    "data_migration":     { "dispatchCount":  3, "totalFindings": 0, "lastDispatch": "2026-04-28T00:00:00Z", "gateStatus": "never_gate",     "lastProbe": null },
    "skill_md_consistency": { "dispatchCount": 5, "totalFindings": 0, "lastDispatch": "2026-04-28T00:00:00Z", "gateStatus": "never_gate", "lastProbe": null },
    "vocab_sync":         { "dispatchCount":  5, "totalFindings": 0, "lastDispatch": "2026-04-28T00:00:00Z", "gateStatus": "never_gate",     "lastProbe": null },
    "eval_syntax":        { "dispatchCount":  5, "totalFindings": 0, "lastDispatch": "2026-04-28T00:00:00Z", "gateStatus": "never_gate",     "lastProbe": null },
    "performance":        { "dispatchCount": 11, "totalFindings": 0, "lastDispatch": "2026-04-28T00:00:00Z", "gateStatus": "gate_candidate", "lastProbe": "2026-04-26T00:00:00Z" }
  }
}
```

**`gateStatus` 결정 (확장 v0.2)**:
- `dispatchCount` < 10 → `active` (안전 기본값)
- `dispatchCount` ≥ 10 AND `totalFindings` == 0 AND name NOT IN [security, data_migration, skill_md_consistency, vocab_sync, eval_syntax] → `gate_candidate`
- name IN 위 5개 → `never_gate` (NEVER_GATE 확장, enterprise-expert 권고)
- 그 외 → `active`

**Probe 재검 (위-4 표본 편향 대응, enterprise-expert 권고)**:
- `gate_candidate` 상태에서도 N=20 커밋마다 강제 1회 dispatch (lastProbe 갱신).
- 파일 패턴 변화 감지(예: 신규 SKILL.md 등장) 시 카운터 리셋 → 다시 `active`.

### 3.2 `review-history.jsonl` (FR-07, 원자적 append, 100 entries 윈도우)

**위치**: `.rkit/state/review-history.jsonl`
**쓰기 패턴**: 새 줄 한 번만 append. Node `fs.appendFileSync(path, line, { flag: 'a' })` — POSIX 보장 atomic write < 4096 바이트. 줄당 ≤ 4096 바이트로 제한 (위-8 동시 쓰기 방지). 큰 review는 여러 entries로 분할.
**조회 윈도우**: 파일 끝에서 최근 **100 entries**만 읽음 (infra-architect 권고, 회전 미적용 결정-4A).
**회전 정책**: 본 사이클 미적용. 윈도우 한정으로 충분. (사이클 2 이월)

```jsonl
{"timestamp":"2026-04-28T00:00:00Z","reviewId":"rv-001","commit":"b079db4","schemaVersion":"1.0","findings":[{"fingerprint":"a1b2c3d4...","file":"lib/foo.js","line":42,"ruleId":"no-unused-vars","severity":"minor","message":"unused variable 'tmp'","action":"skipped"}]}
```

### 3.3 식별값(`fingerprint`) (유니코드 코드포인트 명시)

**입력 5개를 sha256 해시** (code-analyzer MEDIUM 권고: 멀티바이트 명확화):

```
fingerprint = sha256(
  file_path                          + ":" +    // POSIX 정규화 (slash 통일, lower)
  line_number                        + ":" +    // 정수
  rule_id                            + ":" +    // 검사 규칙 ID
  severity                           + ":" +    // critical|major|minor|info (lower_snake)
  message_first_80_codepoints                   // 메시지 첫 80개 유니코드 코드포인트 (한글 1자=1코드포인트)
)
```

**80자 미만 메시지**: padding 없음 (그대로 사용). 짧은 메시지는 그 자체로 식별성 충분.

### 3.4 중복 제거 알고리즘 (윈도우 한정 + 보강)

```
function shouldSuppress(currentFinding, currentCommit):
  // 1. 최근 100 entries 윈도우만 읽음 (O(N) 디스크 I/O 방지)
  recentHistory = readJsonlTail("review-history.jsonl", 100)

  // 2. 같은 fingerprint 검색 (역순)
  for each prevReview in recentHistory reversed:
    for each prevFinding in prevReview.findings:
      if prevFinding.fingerprint == currentFinding.fingerprint:
        // 3. action이 "skipped"가 아니면 절대 숨김 0
        if prevFinding.action != "skipped":
          return false  // "fixed" / "auto-fixed"는 항상 재검사
        // 4. 같은 fingerprint가 과거에 fixed→재발→skipped인 경우(가장 최근만 봄)
        //    역순 검색이라 가장 최근 항목이 먼저 잡힘 → 자연스러운 처리
        // 5. 해당 파일이 변경되었는지 확인
        try:
          changedFiles = git_diff_name_only(prevReview.commit, currentCommit)
        catch GitNotAvailable:
          // 폴백: git 미설치 환경에서는 보수적으로 재출력 (code-analyzer LOW 권고)
          return false
        if currentFinding.file in changedFiles:
          return false  // 파일 변경됨 → 재출력
        // 6. 모든 조건 통과 → 숨김
        return true
  return false  // 윈도우 내 일치 없음 → 정상 출력
```

### 3.5 신규: `skip-log.json` (자동 생략 감사)

**위치**: `.rkit/state/skip-log.json`
**용도**: 자동 생략 발생 시 기록. enterprise-expert 권고 — "생략된 검사가 갑자기 필요해질 때 추적".
**형식**:

```json
{
  "version": "1.0",
  "entries": [
    {
      "timestamp": "2026-04-28T00:00:00Z",
      "specialist": "performance",
      "reason": "gate_candidate (10회 0건)",
      "reviewId": "rv-005",
      "diffSize": 142
    }
  ]
}
```

### 3.6 `learnings.json` 읽기 (FR-03, version 검증 — code-analyzer MEDIUM 권고)

```
function readLearnings():
  data = readJson(".rkit/state/learnings.json")
  if data.version != "1.0":
    audit_log(category="system", level="warn", message="learnings.json version mismatch")
    return null  // FR-03 비교 표 첨부 건너뜀
  if data.learnings.length < 3:
    return null  // 항목 부족, 비교 안 함
  return data.learnings
```

### 3.7 enum 표기 컨벤션 통일 (code-analyzer HIGH 권고)

| 종류 | 표기 | 예 |
|------|------|-----|
| **verdict 단계** | UPPER_SNAKE | `BLOCK`, `WARN`, `LOG_ONLY`, `IGNORE` |
| **gateStatus** | lower_snake | `active`, `gate_candidate`, `never_gate` |
| **severity** | lower 단어 | `critical`, `major`, `minor`, `info` |
| **action** | lower 단어 | `skipped`, `fixed`, `auto_fixed` |

이 컨벤션은 `policies/locked-vocab.json` 머리에도 명시.

---

## 4. 컴포넌트 사양 (요구사항별 상세 변경)

### 4.1 FR-01: 위험 결정 시 멈춤 — 본문(중립) + 부록(도메인 예시)

**변경 위치**: `skills/investigate/SKILL.md`. 본문(중립)은 §3 끝, 부록(도메인 예시)은 SKILL.md 끝.

**본문 (도메인 중립, 잠금 어휘 0건)**:

```markdown
## 위험 결정 시 멈춤 절차

다음 4가지 상황 중 하나라도 만나면 **즉시 분석을 멈추고** 사용자에게 묻는다. 일상적 코딩이나 명백한 변경에는 적용하지 않는다.

### 멈춤 트리거

1. **아키텍처 결정**: 모듈 경계·계층 구조·핵심 의존성 변경.
2. **데이터 모델 변경**: 영속 데이터 스키마·식별자·인덱스 변경.
3. **되돌리기 어려운 작업**: 파일·디렉터리 영구 삭제, 디스크 직접 쓰기, 강제 push, 데이터 영구 폐기.
4. **누락 컨텍스트**: 필요한 정보의 30% 미만만 확보된 상태.

### 멈춤 후 절차

1. 한 문장으로 모호함을 명명: "X와 Y 중 어느 쪽인지 결정해야 합니다."
2. 2~3개 선택지를 표로 제시 (각 ✅ 2개 이상 / ❌ 1개 이상, 각 40자 이상).
3. 추천안과 한 줄 이유 명시. **추천이 불분명한 경우**: "추천: 없음 — 양쪽 트레이드오프가 대등함" (frontend-architect HIGH-2 권고).
4. AskUserQuestion으로 묻는다.
```

**부록 (도메인 예시, 잠금 어휘 보존)**:

```markdown
## 부록 A: 도메인 예시

> 이 부록은 `scripts/gen-locked-vocab.mjs`로 자동 생성됩니다. 직접 편집하지 마세요.
> SoT: `policies/locked-vocab.json`

### A.1 MCU 예시

> 🛑 멈춤: "CFSR=0x40000400 (UNALIGNED) 발생. 정렬 위반이 (A) packed 구조체 접근인지 (B) DMA 버퍼 정렬 문제인지 결정해야 합니다."
>
> | 선택지 | ✅ 좋은 점 | ❌ 나쁜 점 |
> |---|---|---|
> | A) packed 구조체 분석 | 코드 검색만으로 검증 가능. 빌드 영향 없음. | 실제 원인이 DMA면 시간 낭비. |
> | B) DMA 버퍼 4-byte 정렬 검증 | linker script + DMA channel 설정 동시 점검. 근본 해결. | 하드웨어 매뉴얼 참조 필요. |
>
> 추천: B — UNALIGNED + 직전 DMA 트랜잭션 로그 있으면 DMA 가능성 높음.
> (HardFault, CFSR 보존)

### A.2 MPU 예시

> 🛑 멈춤: "Device Tree 노드 `&i2c1`의 clock-frequency 변경이 (A) bblayers.conf 신규 레이어 추가인지 (B) 기존 dtsi 오버라이드인지 결정해야 합니다."
> ... (Device Tree, dtsi, bblayers.conf 보존)

### A.3 WPF 예시

> 🛑 멈춤: "MainViewModel의 ObservableObject 상속을 (A) 기존 MVVM 구조 유지인지 (B) 새 RelayCommand 패턴으로 마이그레이션인지 결정해야 합니다."
> ... (XAML, MVVM, ObservableObject, RelayCommand 보존)
```

### 4.2 FR-02 + FR-11: 사용자 질문 양식 (도메인 면제 + 중립 추천 + ⚠️)

**4 SKILL 본문에 공통 추가** (frontend-architect 5건 권고 반영):

```markdown
## 사용자 질문 양식

`AskUserQuestion` 도구 호출 시 다음 5요소 강제.

| 요소 | 설명 | 검증 |
|------|------|------|
| 1. 질문 | 90자 이하, 결과 중심 | `len ≤ 90` |
| 2. 한 줄 쉬운 설명 (ELI10) | 기술 용어 없이 결정 의미 풀기. **예외: 도메인 전문가 결정 시 생략 가능** (`audience: domain_expert` 명시 시) | 길이 30~120자 또는 명시적 생략 |
| 3. 추천안 + 이유 | "추천: X — <이유>". **중립 자세 허용**: "추천: 없음 — 양쪽 트레이드오프가 대등함" | regex `^추천안?:` |
| 4. ✅≥2 / ❌≥1 | 각 항목 40자 이상 (코드 포인트 기준) | `min_length: 40` (eval.yaml에 명시) |
| 5. 한 번뿐인 결정 표시 | "⚠️ 이 결정은 되돌릴 수 없습니다 — 신중히 선택하십시오" (✅에서 ⚠️로 변경) | regex `⚠️ 이 결정은 되돌릴 수 없습니다` |

### ELI10 선택지별 중복 금지

ELI10은 **전체 결정에 1회**만 작성. 선택지마다 ELI10 반복 시 인지 부하 ↑. (frontend-architect MEDIUM-1 권고)

### 예시 (일반)

```
question: "Plan §3.5의 임계값 0.85를 0.80으로 낮출까요?"
ELI10: 지금 임계값은 매우 확실한 위협만 차단합니다.

선택지 A: 0.85 유지 (추천)
  추천: A — 알려진 위급 5건 중 5건이 차단 유지됨 (검증됨).
  ✅ 거짓 양성 비율 가장 낮음 (FP < 5%) — 이전 사례에서 검증된 임계값.
  ✅ severity=critical 강등 금지 정책과 일관 — 본 사이클 정책 준수.
  ❌ 위험도 0.80~0.84 패턴은 경고로만 떠 사용자가 놓칠 수 있음.

선택지 B: 0.80으로 낮춤
  ✅ 위험도 0.80~0.84 패턴도 차단 → 보안 커버리지 ↑.
  ✅ FN 감소 (실제 위협 놓치는 비율).
  ❌ FP 증가 가능 — 회귀 시험 재실행 필요.
```

### 예시 (한 번뿐인 결정 — 파괴적 작업)

```
question: "데이터베이스 컬럼 X를 영구 삭제할까요?"
audience: domain_expert  ← ELI10 생략 허용

선택지 A: 영구 삭제 (추천)
  추천: A — 90일 보관 정책 만료, 백업 검증 완료.
  ⚠️ 이 결정은 되돌릴 수 없습니다 — 신중히 선택하십시오
  ✅ 디스크 12GB 회수.
  ✅ GDPR 90일 의무 충족.
```
```

### 4.3 FR-03: 이전 회고 비교 (변경 없음, learnings.json version 검증 추가)

§3.6 readLearnings() 함수 의사 코드 명시. 외 v0.1과 동일.

### 4.4 FR-04: AI 상투어 줄이기 (변경 없음, 잠금 어휘 면제 명확화)

v0.1과 동일. 단 "임베디드 어휘 면제는 SoT(`policies/locked-vocab.json`)의 `vocabs[].term`으로 정의된 어휘에 한정"으로 명확화 (code-analyzer MEDIUM 권고).

### 4.5 FR-05: 차단·경고·기록만 임계값 + 합산 판정 (대폭 보강)

**변경 위치**: `skills/security-review/SKILL.md` §Confidence Scoring 다음.

**보강된 본문 (security-architect HIGH 4건 + code-analyzer HIGH 1건 반영)**:

```markdown
## 차단·경고·기록만 임계값 + 합산 판정

### 임계값 (3단계)

| 단계 | float | 정수 (0~10) | 의미 |
|------|:-----:|:-----------:|------|
| **BLOCK** | ≥ 0.85 | ≥ 8.5 | 머지 차단 |
| **WARN** | 0.60 ≤ x < 0.85 | 6.0 ≤ x < 8.5 | 알림 |
| **LOG_ONLY** | 0.40 ≤ x < 0.60 | 4.0 ≤ x < 6.0 | 감사 로그만 |
| (IGNORE) | < 0.40 | < 4.0 | 출력 안 함 |

### embedded-threat-model.js API 시그니처

(security-architect HIGH 권고 — 호출 시그니처 명시 필수)

```javascript
const result = analyze(code, filePath, domain, minConfidence);
// 반환: [{ id, stride, severity, confidence: 0~10, message, ... }, ...]
// confidence는 정수 0~10. float 환산: confidence / 10.
const score1 = result.confidence / 10;  // STRIDE 패턴 매칭 검사기

const score2 = await invokeSecurityArchitect(file, finding);  // 에이전트 문맥 분석
// score2는 0.0~1.0 float
```

### 합산 판정 규칙 (combineVerdict, 분기 우선순위 재정렬)

(code-analyzer HIGH-1 + security-architect HIGH 권고)

```
function combineVerdict(score1, score2, finding):
  // 우선순위 1: severity=critical 패턴은 단일 분류기 ≥0.85만으로 BLOCK 유지 (강등 금지)
  if finding.severity == "critical" AND isCriticalPattern(finding.id):
    if max(score1, score2) >= 0.85: return "BLOCK"

  // 우선순위 2: 둘 다 강함 → BLOCK
  if score1 >= 0.85 AND score2 >= 0.85: return "BLOCK"

  // 우선순위 3: 둘 다 의심 (0.60+) → BLOCK (단일 강함보다 우선)
  if score1 >= 0.60 AND score2 >= 0.60: return "BLOCK"

  // 우선순위 4: 한쪽만 강함 (≥0.85) + 다른 쪽 약함 → WARN으로 강등
  //  단, 우선순위 1에서 이미 처리되지 않은 non-critical만 해당
  if max(score1, score2) >= 0.85: return "WARN"

  // 우선순위 5: 한쪽만 의심
  if max(score1, score2) >= 0.60: return "WARN"

  // 우선순위 6: 한쪽만 약한 신호
  if max(score1, score2) >= 0.40: return "LOG_ONLY"

  return "IGNORE"
```

**경계 케이스 명시 (code-analyzer HIGH-1)**:
- (0.85, 0.60) → 우선순위 3에서 BLOCK (둘 다 0.60+)
- (0.90, 0.50) non-critical → 우선순위 4에서 WARN (한쪽만 강함)
- (0.90, 0.50) critical 패턴 → 우선순위 1에서 BLOCK (강등 금지)
- (0.50, 0.50) → 우선순위 6에서 LOG_ONLY

### severity=critical 강등 금지 패턴 (security-architect HIGH 권고, 8개로 확장)

| ID | 도메인 | 패턴 | 단일 ≥0.85로 BLOCK 유지 이유 |
|----|--------|------|--------------------------------|
| `S-MCU-001` | MCU | 펌웨어 업데이트 위변조 | 부팅 사슬 신뢰 무너짐 |
| `S-MCU-002` | MCU | Bootloader 변조 | 동상 — 부팅 사슬 |
| `T-MCU-001` | MCU | Flash 직접 수정 (보안 영역) | 펌웨어 무결성 위협 |
| `I-MCU-001` | MCU | JTAG/SWD production 노출 | 양산 칩 내부 노출 |
| `E-MCU-001` | MCU | stack overflow + HardFault 트리거 | 단일 신호로도 명백한 위급 |
| `S-MPU-001` | MPU | 커널 모듈 위변조 (`insmod`/`modprobe`) | 시스템 권한 탈취 |
| `S-MPU-002` | MPU | LD_PRELOAD 치환 (라이브러리 가로채기) | 동상 — 권한 탈취 |
| `S-WPF-001` | WPF | DLL 인젝션 | 응용 권한 탈취 |

`isCriticalPattern(id)`는 위 8개 ID와 정확 매칭.

### 카나리 정책

**본 사이클 제외** (D-7 결정-1A). rkit 코드/스킬에 카나리 토큰 인프라 0건. 정의 없는 deterministic BLOCK은 dead rule이 되어 가짜 통과 위험. 사이클 2 또는 별 PDCA에서 (`docs/policy/canary-tokens.md` + 검출 정규식 ≥3개) 동반 도입 시 다시 검토.
```

### 4.6 FR-06: 자동 생략 — 본문 텍스트 보강 + probe + NEVER_GATE 5개

**변경 위치**: `skills/code-review/SKILL.md` §Review Categories 다음.

**보강된 본문 (design-validator 약점 2 + enterprise-expert HIGH 반영)**:

```markdown
## 자주 안 잡히는 검사 자동 생략

### 동작 원리

1. `/code-review` 시작 시 `.rkit/state/code-review-stats.json` 읽음 (parse 실패 시 빈 객체).
2. 각 검사(specialist)에 대해:
   - `gateStatus == "never_gate"`: 무조건 dispatch (보안·데이터 이전·SKILL.md 일관성·잠금 어휘 동기화·평가 파일 구문)
   - `gateStatus == "active"`: 정상 dispatch
   - `gateStatus == "gate_candidate"`: **자동 생략** + 출력 "[검사명] 자동 생략됨 — 최근 N회 0 findings"
3. 단, `gate_candidate` 상태에서도 N=20 커밋마다 강제 1회 dispatch (probe). `lastProbe`로 추적.
4. 파일 패턴 변화 감지 시 카운터 리셋 (예: 신규 SKILL.md 등장).
5. `--force-{이름}` 옵션 시 강제 dispatch.

### 자동 생략 사유 기록

자동 생략이 발생할 때마다 `.rkit/state/skip-log.json`에 기록:
- timestamp, specialist, reason, reviewId, diffSize.

### NEVER_GATE 고정 5개 (확장)

| 이름 | 이유 |
|------|------|
| `security` | 안전망 (gstack 정책 답습) |
| `data_migration` | 안전망 (데이터 손실 방지) |
| `skill_md_consistency` | 본 사이클 핵심 자산 (잠금 어휘 보존) |
| `vocab_sync` | SoT-부록 일관성 검증 (요-12와 통합) |
| `eval_syntax` | eval.yaml 구문 유효성 (CI 진입 전 검증) |

(MISRA·메모리 예산은 *대상 프로젝트* 영역으로 본 plugin NEVER_GATE에는 부적합 — enterprise-expert 명시)

### 통계 갱신 (원자적 쓰기)

```javascript
// 임시파일 + rename 패턴 (위-8 인터럽트 안전)
const tmpPath = path + '.tmp.' + Date.now();
fs.writeFileSync(tmpPath, JSON.stringify(stats, null, 2));
fs.renameSync(tmpPath, path);  // POSIX atomic
```
```

### 4.7 FR-07: 리뷰 중복 제거 — 본문 텍스트 보강 + 윈도우 + atomic

**변경 위치**: `skills/code-review/SKILL.md` §FR-06 다음.

**보강된 본문 (design-validator 약점 2 + code-analyzer HIGH-2 + infra-architect MEDIUM 반영)**:

```markdown
## 리뷰 간 중복 제거

### 동작 원리

1. `.rkit/state/review-history.jsonl`에서 **최근 100 entries 윈도우**만 읽음 (O(N) I/O 방지).
2. 각 현재 리뷰 항목에 대해 §3.4 알고리즘 실행.
3. 일치 + skipped + 파일 unchanged → 숨김. 그 외 → 정상 출력.
4. 출력 끝에 "이전 리뷰에서 사용자가 무시한 N건 숨김 처리됨" 요약.

### 식별값 (fingerprint)

§3.3 정의 — 5개 필드 sha256, 메시지는 유니코드 코드포인트 80개 기준.

### 원자적 append

```javascript
// POSIX atomic append < 4096 bytes
const line = JSON.stringify(reviewEntry) + '\n';
if (line.length > 4096) {
  // findings 분할하여 여러 줄로 쓰기 (각 줄 < 4096 bytes)
  splitAndAppend(line);
} else {
  fs.appendFileSync('.rkit/state/review-history.jsonl', line);
}
```

### 회전 정책

본 사이클 미적용 (결정-4A). 100 entries 윈도우 한정으로 충분. 사이클 2 또는 별 PDCA에서 5MB 또는 5000 entries 회전 도입 검토.

### git 미설치 환경 폴백

`git_diff_name_only` 호출 실패 시 보수적으로 `return false` (재출력) — 안전한 기본값.
```

### 4.8 FR-08: 잠금 어휘 SoT (D-4 d 적용)

**신규 파일 1: `policies/locked-vocab.json`**:

```json
{
  "version": "1.0",
  "description": "Embedded reserved vocabulary — single source of truth (SoT)",
  "policy": "이 어휘는 일반화·번역·삭제 금지. 4 SKILL 본문에 사용 0건. 4 SKILL 부록에 1건 이상 보존.",
  "vocabs": [
    { "term": "HardFault",        "domain": "mcu", "meaning": "Cortex-M 코어 예외" },
    { "term": "CFSR",             "domain": "mcu", "meaning": "0xE000ED28, Configurable Fault Status Register" },
    { "term": "HFSR",             "domain": "mcu", "meaning": "0xE000ED2C, HardFault Status Register" },
    { "term": "MMFAR",            "domain": "mcu", "meaning": "0xE000ED34, MemManage Fault Address" },
    { "term": "BFAR",             "domain": "mcu", "meaning": "0xE000ED38, BusFault Address" },
    { "term": "FreeRTOS",         "domain": "mcu", "meaning": "임베디드 RTOS" },
    { "term": "MISRA C",          "domain": "mcu", "meaning": "안전 임베디드 코딩 표준 (MISRA C:2012)" },
    { "term": "Device Tree",      "domain": "mpu", "meaning": "리눅스 하드웨어 기술 트리" },
    { "term": "dtsi",             "domain": "mpu", "meaning": "Device Tree Source Include" },
    { "term": "dtoverlay",        "domain": "mpu", "meaning": "Device Tree Overlay (런타임 수정)" },
    { "term": "bblayers.conf",    "domain": "mpu", "meaning": "Yocto 레이어 설정 파일" },
    { "term": "Yocto",            "domain": "mpu", "meaning": "임베디드 리눅스 빌드 시스템" },
    { "term": "bitbake",          "domain": "mpu", "meaning": "Yocto 빌드 도구" },
    { "term": "U-Boot",           "domain": "mpu", "meaning": "Bootloader" },
    { "term": "XAML",             "domain": "wpf", "meaning": "WPF/UWP UI 마크업 언어" },
    { "term": "MVVM",             "domain": "wpf", "meaning": "Model-View-ViewModel 패턴" },
    { "term": "ObservableObject", "domain": "wpf", "meaning": "CommunityToolkit.Mvvm 베이스 클래스" },
    { "term": "RelayCommand",     "domain": "wpf", "meaning": "CommunityToolkit.Mvvm Command 속성" },
    { "term": ".csproj",          "domain": "wpf", "meaning": "C# 프로젝트 파일" },
    { "term": "app.config",       "domain": "wpf", "meaning": "NET 응용 프로그램 설정 파일" }
  ],
  "schema": {
    "verdictEnum": ["BLOCK", "WARN", "LOG_ONLY", "IGNORE"],
    "gateStatusEnum": ["active", "gate_candidate", "never_gate"],
    "severityEnum": ["critical", "major", "minor", "info"],
    "actionEnum": ["skipped", "fixed", "auto_fixed"]
  }
}
```

**신규 파일 2: `scripts/gen-locked-vocab.mjs`**:
- `policies/locked-vocab.json` 읽기 → 도메인별 그룹 → 4 SKILL 부록 절(`## 부록 A.1 MCU` 등) 자동 생성/갱신.
- 기존 부록 절 삭제 후 다시 쓰기 (멱등).
- `bun run gen:vocab` 명령으로 호출.

**4 SKILL 머리에 추가 1줄**:

```markdown
> 잠금 어휘: [policies/locked-vocab.json](../../policies/locked-vocab.json) (SoT, gen:vocab으로 부록 자동 생성)
```

### 4.9 FR-09: 평가 8세트 — judge: regex_only + min_length

**`eval.yaml` 형식 (`evals/capability/investigate/eval.yaml` 예)**:

```yaml
name: investigate-cycle15
classification: capability
domain: all
judge: regex_only            # infra-architect MEDIUM 권고 — LLM judge 호출 0건 보장
tests:
  - id: cycle15-after
    prompt: cycle15-after.prompt.md
    expected: cycle15-after.expected.md
    assertions:
      - type: regex_positive
        patterns:
          - "🛑 멈춤"
          - "^추천안?:"
          - "✅"
          - "❌"
          - "⚠️ 이 결정은 되돌릴 수 없습니다"   # FR-11 ⚠️ 표시
      - type: min_length        # frontend-architect MEDIUM-3 권고
        target: each_pros_con
        min: 40                  # 코드 포인트 기준
      - type: count
        pattern: "✅"
        per_option_min: 2
      - type: count
        pattern: "❌"
        per_option_min: 1
      - type: regex_negative_in_body  # 본문 일반론에 임베디드 어휘 0건
        patterns:
          - "HardFault"
          - "CFSR"
        scope: body              # 부록은 검사 안 함
      - type: regex_positive_in_appendix  # 부록에 잠금 어휘 ≥1건
        patterns:
          - "HardFault"
        scope: appendix
```

### 4.10 FR-10: 정책 문서 + verify-policy 통합

**`docs/policy/gstack-sync-policy.md`** (보강):

```markdown
# gstack → rkit 동기화 정책

## 1. 잠금 어휘 SoT
[policies/locked-vocab.json](../../policies/locked-vocab.json) 단일 출처. 4 SKILL 부록은 `bun run gen:vocab`으로 자동 생성.

## 2. 가져오지 않을 항목 (7가지)
... (v0.1과 동일)

## 3. 검증 기준 (자동화)
- 본문 grep -v 임베디드 어휘 0건 (verify-policy.js --check body-neutrality)
- 부록 grep 잠금 어휘 ≥1건 (verify-policy.js --check vocab-preservation)
- 제외 토큰 0건 (verify-policy.js --check forbidden-tokens)
- eval.yaml 구문 (verify-policy.js --check eval-syntax)
- SoT 스키마 (verify-policy.js --check sot-schema)

명령: `bun run verify:policy`
훅: `.claude/hooks/pre-commit` 자동 호출

## 4. 적용 범위 + 확장 절차

본 정책은 SKILL.md 레이어에만 적용. 범위 확장은 신규 design 문서 + NEVER_GATE 재평가 필수 (enterprise-expert 권고).
```

### 4.11 FR-11: 본문/부록 두 층 구조 명시

각 4 SKILL.md 머리에 다음 절 추가:

```markdown
## 문서 구조 (본 SKILL의 두 층)

이 스킬 문서는 두 층으로 구성됩니다:

1. **방법론 본문 (이 절 ~ 부록 A 직전)**: 도메인 중립 일반론. 임베디드 어휘 0건. 일반 사용자도 위화감 없음.
2. **도메인 예시 부록 (§A 이하)**: MCU/MPU/WPF 절. 같은 양식을 임베디드 사례로 보여줌. 잠금 어휘 보존 (SoT 관리).

부록은 `bun run gen:vocab`으로 SoT(`policies/locked-vocab.json`)에서 자동 생성됩니다. 직접 편집하지 마세요.
```

### 4.12 FR-12: 정책 검증 자동화

**`scripts/verify-policy.js`** (신규, node ESM, ~250줄):

```javascript
#!/usr/bin/env node
// Usage: node scripts/verify-policy.js [--check <name>]
// Windows 호환 (bash 의존 없음)

import fs from 'node:fs';
import path from 'node:path';

const SOT = JSON.parse(fs.readFileSync('policies/locked-vocab.json', 'utf8'));
const SKILLS = ['investigate', 'retro', 'security-review', 'code-review'];
const FORBIDDEN_TOKENS = [
  'gstack-update-check', 'gstack-config', 'gstack-slug',
  'GBrain', 'TELEMETRY:', 'EXPLAIN_LEVEL:', 'slop-scan'
];

const checks = {
  'body-neutrality': checkBodyNeutrality,    // 본문에 임베디드 어휘 0건
  'vocab-preservation': checkVocabPreserved, // 부록에 잠금 어휘 ≥1건
  'forbidden-tokens': checkForbidden,         // 제외 토큰 0건
  'eval-syntax': checkEvalSyntax,             // eval.yaml 구문
  'sot-schema': checkSotSchema,               // SoT JSON 스키마
};

function splitBodyAppendix(skillPath) {
  const text = fs.readFileSync(skillPath, 'utf8');
  const idx = text.search(/^## 부록/m);
  return idx === -1
    ? { body: text, appendix: '' }
    : { body: text.slice(0, idx), appendix: text.slice(idx) };
}

function checkBodyNeutrality() {
  const errors = [];
  for (const skill of SKILLS) {
    const { body } = splitBodyAppendix(`skills/${skill}/SKILL.md`);
    for (const v of SOT.vocabs) {
      if (body.includes(v.term)) {
        errors.push(`skills/${skill}/SKILL.md 본문에 잠금 어휘 "${v.term}" 발견`);
      }
    }
  }
  return errors;
}

function checkVocabPreserved() {
  const errors = [];
  for (const skill of SKILLS) {
    const { appendix } = splitBodyAppendix(`skills/${skill}/SKILL.md`);
    for (const v of SOT.vocabs) {
      if (!appendix.includes(v.term)) {
        errors.push(`skills/${skill}/SKILL.md 부록에 "${v.term}" 누락 — gen:vocab 재실행 필요`);
      }
    }
  }
  return errors;
}

// ... (나머지 3 check)

const arg = process.argv[2];
const targets = arg && arg.startsWith('--check')
  ? [process.argv[3]]
  : Object.keys(checks);

let total = 0;
for (const name of targets) {
  const errs = checks[name]();
  total += errs.length;
  if (errs.length) {
    console.error(`❌ ${name}: ${errs.length} 위반`);
    errs.forEach(e => console.error(`   ${e}`));
  } else {
    console.log(`✅ ${name}`);
  }
}
process.exit(total === 0 ? 0 : 1);
```

**`.claude/hooks/pre-commit` 등록**:

```bash
#!/usr/bin/env bash
# 또는 Stop hook으로 등록
node scripts/verify-policy.js
```

**`package.json` 또는 `CLAUDE.md` 명령**:

```bash
bun run verify:policy             # 전체 검사
bun run verify:policy -- --check body-neutrality  # 특정 검사만
bun run gen:vocab                  # 부록 자동 생성
```

---

## 5. 시험 사례 (TC) 매트릭스 (v0.2: 27 → 35)

기존 27 TC + 신규 8 TC 추가:

| TC | 검증 대상 | 입력 | 기대 결과 |
|----|----------|------|----------|
| TC-1~27 | (v0.1과 동일) | ... | ... |
| **TC-28 (신규)** | FR-05 분기 우선순위 | (0.85, 0.60) non-critical | BLOCK (우선순위 3, code-analyzer HIGH-1) |
| **TC-29 (신규)** | FR-05 분류기 충돌 | (0.90 정규식, 0.10 LLM) non-critical | WARN (우선순위 4 강등, security HIGH 권고) |
| **TC-30 (신규)** | FR-05 LOG_ONLY 합산 | (0.45, 0.45) | LOG_ONLY (우선순위 6) |
| **TC-31 (신규)** | FR-05 critical 강등 금지 | (0.90, 0.30) S-MCU-001 | BLOCK 유지 (우선순위 1) |
| **TC-32 (신규)** | FR-06 probe 재검 | gate_candidate + 20 커밋 경과 | 강제 dispatch + lastProbe 갱신 |
| **TC-33 (신규)** | FR-07 윈도우 한정 | history 200 entries, 일치는 150번째 | 100 entries 윈도우라 일치 못 찾음 → 정상 출력 |
| **TC-34 (신규)** | FR-11 본문 어휘 0건 | 4 SKILL 본문 grep | 0건 (verify-policy --check body-neutrality 통과) |
| **TC-35 (신규)** | FR-12 자동화 hook | `git commit` 시 verify-policy 실행 | 위반 있으면 차단 + 사유 출력 |

**합계 35 TC**. FR 단위 매핑: FR-01(1~3), FR-02(4), FR-03(5~6), FR-04(7~8), FR-05(9~13, 28~31), FR-06(14~17, 32), FR-07(18~21, 33), FR-08(22~23), FR-09(24), FR-10(25), FR-11(34), FR-12(35), NFR(26~27).

---

## 6. 구현 순서 (커밋 분해 v0.2: 7 → 9 커밋)

| # | 커밋 메시지 | 변경 파일 | 검증 |
|---|------------|----------|------|
| **C0 (신규)** | `feat(policies): add locked-vocab.json SoT + gen-locked-vocab.mjs` | `policies/locked-vocab.json`, `scripts/gen-locked-vocab.mjs` | SoT JSON 파싱, 20 vocabs 검증 |
| **C1** | `feat(skills/investigate): add Confusion Protocol body + AskUserQuestion format + appendix domains` | `skills/investigate/SKILL.md` | TC-1~3, TC-4 부분, TC-22 부분 |
| **C2** | `feat(skills/retro): add trend delta + AI slop body + appendix domains` | `skills/retro/SKILL.md` | TC-5~8, TC-22 부분 |
| **C3** | `feat(skills/security-review): add threshold + combineVerdict + critical-no-downgrade + analyze() signature + appendix` | `skills/security-review/SKILL.md` | TC-9~13, TC-28~31, TC-22 부분 |
| **C4** | `feat(skills/code-review): add adaptive gating + cross-review dedup + atomic write + appendix` | `skills/code-review/SKILL.md` | TC-14~21, TC-32~33, TC-22 부분 |
| **C5** | `feat(skills): apply SoT links + run gen:vocab to populate appendices` | 4 SKILL.md (부록 자동 갱신) | TC-22, TC-23, TC-34 |
| **C6 (신규)** | `feat(scripts): add verify-policy.js + .claude/hooks/pre-commit registration` | `scripts/verify-policy.js`, `.claude/hooks/pre-commit` | TC-35, TC-26, TC-27 |
| **C7** | `test(evals): add cycle15 8 sets + cross-review-dedup smoke (5 TC) + judge: regex_only` | `evals/...` (16 파일), `tests/code-review/cross-review-dedup.smoke.test.js` | TC-24, TC-26, TC-27 |
| **C8** | `docs(policy): add gstack-sync-policy.md + CLAUDE.md link + verify-policy guide` | `docs/policy/gstack-sync-policy.md`, `CLAUDE.md` | TC-25 |

**의존성**:
- C0 → C5 (gen:vocab은 SoT 필요)
- C1~C4 → C5 (부록 자동 생성은 SKILL 본문 안정 후)
- C5 → C6 (verify-policy는 SoT + 부록 둘 다 필요)
- C6 → C7 (평가가 verify 통과 가정)
- C8 독립

---

## 7. 보안 고려사항

(v0.1 + security-architect HIGH 4건 반영)

- [x] **MCU 위급 패턴 강등 금지** 8개로 확장 (S-MCU-001/002, T-MCU-001, I-MCU-001, E-MCU-001, S-MPU-001/002, S-WPF-001) — §4.5
- [x] **카나리 deterministic BLOCK 제거** (D-7) — dead rule 회피
- [x] **`embedded-threat-model.js` analyze() 시그니처 명시** — §4.5
- [x] **분기 우선순위 재정렬** — §4.5
- [x] **fingerprint 메시지 80개 코드포인트** — §3.3 (위-5 + 멀티바이트 명확화)
- [x] **NEVER_GATE 5개 확장** — 보안+데이터 이전+SKILL.md+SoT+평가 구문
- [x] **한 번뿐인 결정 표시 ⚠️** — §4.2 (frontend MEDIUM-2)
- [x] **상태 파일 atomic write** — §3.1, §3.2 (위-8)

---

## 8. 테스트 계획

### 8.1 시험 범위

| 종류 | 대상 | 도구 |
|------|------|------|
| 정적 검증 | 본문 어휘·부록 어휘·제외 토큰·SoT 스키마 | `scripts/verify-policy.js` (Windows 호환) |
| 단위 시험 | fingerprint, combineVerdict, atomic write | `tests/code-review/cross-review-dedup.smoke.test.js` (5 TC) |
| 평가 (LLM 출력) | 8 cycle15 세트, judge: regex_only | `bun test evals/...` (LLM judge 호출 0건) |
| 회귀 시험 | 기존 평가 (사이클 1) | 기존 명령 재사용 |

### 8.2 핵심 사례

- [x] TC-9, TC-31: severity=critical 패턴 강등 금지 (S-MCU-001 등 8개)
- [x] TC-28~30: 분기 우선순위 경계 케이스 (code-analyzer HIGH-1 대응)
- [x] TC-32: probe 재검 (enterprise 위-1 대응)
- [x] TC-33: 100 entries 윈도우 한정 (infra MEDIUM 대응)
- [x] TC-34: 본문 어휘 0건 (FR-11 두 층 분리 핵심)
- [x] TC-35: verify-policy 자동 차단 (FR-12 핵심)

### 8.3 시간 측정 NFR (design-validator 약점 1 대응)

```bash
# 스킬 로딩 시간
time node -e "require('./lib/skills/loader').loadAll()"
# 평가 실행 시간 (judge: regex_only 보장)
time bun test evals/workflow/code-review evals/workflow/retro evals/capability/investigate evals/capability/security-review
# 기준: 스킬 로딩 회귀 ≤5%, 평가 8 세트 합산 ≤2분
```

---

## 9~11. 클린 아키텍처 / 컨벤션 / 구현 가이드

(v0.1과 동일 — 본 사이클은 코드 계층 변경 0건 + Path Registry 준수 + 추가만 정책)

§11.2 검증 명령 (Windows 호환 갱신):

```bash
# v0.1의 bash for-loop 제거. node 스크립트로 통일.
bun run verify:policy           # 전체
bun run verify:policy -- --check body-neutrality
bun run gen:vocab                # 부록 자동 생성
node --test tests/code-review/cross-review-dedup.smoke.test.js
bun test evals/                  # 회귀 + cycle15
```

---

## 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 0.1 | 2026-04-28 | 초안. 10 FR → 27 TC, 7 커밋. | 노수장 |
| 0.2 | 2026-04-28 | 6인 council 검증 18건 반영. 결정-0 (ii) 본문/부록 두 층 분리, 결정-1A 카나리 제거, 결정-2B 자동화, 결정-3B SoT, 결정-4A 윈도우. FR 10→12, TC 27→35, 커밋 7→9, Risk 7→13. | 노수장 + council |
