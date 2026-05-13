---
name: retro
description: |
  Structured engineering retrospective after PDCA Report completion.
  Triggers: retro, retrospective, 회고, 振り返り, 回顾, retrospectiva, rétrospective, Retrospektive, retrospettiva
classification: workflow
domain: all
user-invocable: true
allowed-tools: [Read, Write, Glob, Grep]
---

# Engineering Retrospective

> **잠금 어휘 SoT**: [policies/locked-vocab.json](../../policies/locked-vocab.json) — 본 SKILL의 부록(도메인 예시)은 `node scripts/gen-locked-vocab.mjs`로 자동 생성됩니다.

## 0. 문서 구조 (본 SKILL의 세 층)

1. **도메인 본문 (§1 ~ §5)**: 임베디드 분야 회고 프로토콜. 잠금 어휘 사용 허용 (grandfathered).
2. **방법론 본문 — 도메인 중립 (§6 ~ §8)**: Cycle 1.5에서 새로 추가된 이전 회고 비교 + AI 상투어 줄이기 + 사용자 질문 양식 절. 잠금 어휘 0건이 자동 검증됩니다.
3. **도메인 예시 부록 (§A)**: SoT 자동 생성.

## 1. Prerequisites

Before running a retrospective, verify:

1. **PDCA Report exists**: Check for `docs/04-report/features/{feature}.report.md`
2. **Feature is complete**: Report should contain final Match Rate and status

```bash
# Verify report exists
ls docs/04-report/features/{feature}.report.md
```

If the report does not exist, inform the user:
"No PDCA Report found for '{feature}'. Run `/pdca report {feature}` first."

## 2. Retrospective Protocol

### Phase 1: PDCA Metrics Collection

Extract from the Report document:

| Metric            | Source                              |
|-------------------|-------------------------------------|
| Match Rate        | Report "Match Rate" or "일치율"     |
| Iteration Count   | Number of `/pdca iterate` cycles    |
| Duration          | Plan date to Report date            |
| Domain            | MCU / MPU / WPF                     |
| Platform          | stm32, imx6, wpf, etc.             |

Also collect from `.rkit/state/`:
- `pdca-status.json` -- PDCA phase transition history
- `benchmark-history.json` -- Resource usage trend during feature

### Phase 2: What Went Well

Evaluate and document successes across these dimensions:

| Dimension              | Guiding Questions                                          |
|------------------------|------------------------------------------------------------|
| AI Assistance          | Did domain skills provide accurate guidance?               |
| Domain Skill Usage     | Which skills were invoked? Were they sufficient?           |
| Automation Level       | How much was automated vs manual intervention?             |
| PDCA Adherence         | Did the team follow Plan -> Design -> Do -> Check -> Act?  |
| First-time Quality     | Was Match Rate > 90% on first Check?                       |
| Build/Resource Budget  | Did benchmarks stay within thresholds throughout?          |

### Phase 3: What Could Improve

Identify friction points:

| Dimension              | Guiding Questions                                          |
|------------------------|------------------------------------------------------------|
| Iteration Count        | If > 2 iterations, what caused rework?                     |
| Context Loss           | Were there points where AI lacked project context?         |
| Missing Skills         | Was there a domain need not covered by existing skills?    |
| Tool Gaps              | Were any manual steps that should be automated?            |
| Documentation Drift    | Did Design docs stay in sync with implementation?          |
| Review Bottlenecks     | Were there delays in code review or verification?          |

### Phase 4: Action Items

Generate concrete, actionable improvements:

```markdown
### Action Items

- [ ] **{Category}**: {Specific action} — Owner: {person/team}, Due: {date}
```

Categories:
- **Skill**: Add or improve an rkit skill
- **Config**: Change `.rkit/` configuration
- **Workflow**: Modify PDCA process or hooks
- **Tooling**: Add build/test/deploy automation
- **Knowledge**: Document a lesson for future reference

### Phase 5: Lessons Learned

Save structured learnings to `.rkit/state/learnings.json`:

```json
{
  "learnings": [
    {
      "id": "L-{NNN}",
      "date": "{timestamp}",
      "feature": "{feature}",
      "domain": "{mcu|mpu|wpf}",
      "category": "{skill|config|workflow|tooling|knowledge}",
      "summary": "{One-line summary}",
      "detail": "{Detailed lesson}",
      "action": "{What to do differently next time}",
      "applied": false
    }
  ]
}
```

If the file already exists, append to the `learnings` array. Assign the next sequential ID.

## 3. Output Document

Generate `docs/04-report/{feature}.retro.md`:

```markdown
# Retrospective: {feature}

**Date**: {date}
**Domain**: {domain}
**Platform**: {platform}
**Duration**: {start_date} to {end_date} ({N} days)

## PDCA Metrics

| Metric          | Value  |
|-----------------|--------|
| Match Rate      | {N}%   |
| Iterations      | {N}    |
| Duration        | {N}d   |
| Skills Used     | {list} |

## What Went Well

- {item 1}
- {item 2}
- ...

## What Could Improve

- {item 1}
- {item 2}
- ...

## Action Items

- [ ] {action 1}
- [ ] {action 2}
- ...

## Lessons Learned

| ID    | Category  | Summary                    |
|-------|-----------|----------------------------|
| L-001 | {cat}     | {summary}                  |

---
Generated by rkit retro skill
```

## 4. Integration with PDCA

### Auto-Suggestion

After `/pdca report {feature}` completes, suggest:
"Report generated. Run `retro {feature}` to capture lessons learned."

### Learnings Reuse

When starting a new feature with `/pdca plan`, check `.rkit/state/learnings.json` for:
- Same domain learnings with `applied: false`
- Present relevant learnings as context for the new plan

### Trend Analysis

When multiple retrospectives exist, analyze trends:
- Average Match Rate trend across features
- Common categories in "What Could Improve"
- Action item completion rate (mark `applied: true` when done)

## 5. Multi-Domain Considerations

| Domain | Retro Focus Areas                                            |
|--------|--------------------------------------------------------------|
| MCU    | Flash/RAM budget adherence, MISRA compliance, HardFault count|
| MPU    | DTS validation pass rate, build time, rootfs size control    |
| WPF    | Binding error count, MVVM compliance, publish size           |

Each domain adds domain-specific metrics to the retrospective automatically based on project detection.

<!-- BEGIN: cycle15-body-neutral -->

## 6. 이전 회고와의 비교 (조건부 자동 첨부)

`.rkit/state/learnings.json`을 읽어 항목 수와 스키마 버전을 확인합니다.

```
function readLearnings():
  data = readJson(".rkit/state/learnings.json")
  if data.version != "1.0":
    audit_log(category="system", level="warn", message="learnings.json version mismatch")
    return null
  if data.learnings.length < 3:
    return null   # 항목 부족, 비교 안 함
  return data.learnings
```

- **항목 < 3건**: 본 단계 건너뜀.
- **항목 ≥ 3건**: 직전 1건과 본 회고 사이의 변화를 표로 자동 첨부.

### 6.1 비교 표 형식

| 지표 | 직전 회고 | 본 회고 | Δ |
|------|----------|---------|---|
| 일치율 | 100% | 95% | -5pp |
| 반복 횟수 | 0 | 2 | +2 |
| 사용 스킬 | code-review, /pdca | code-review, /pdca, /security-review | +1 |
| 기간 | 1일 | 2일 | +1일 |

해석은 1~2 문장으로 추가합니다. 예: "반복이 +2로 늘었지만 사용 스킬도 +1로 새 검증을 도입한 결과로 보임."

## 7. AI 상투어 줄이기

회고 출력 작성 시 다음 규칙을 준수합니다.

### 7.1 금지 어휘 (8개)

| 영문 | 대체 |
|------|------|
| delve | 살펴본다, 들여다본다 |
| robust | 튼튼한, 안정적인 |
| comprehensive | 빠짐없는, 전체를 다루는 |
| nuanced | 결이 다른, 미세하게 다른 |
| fundamental | 근본적인, 바탕이 되는 |
| leverage | 활용한다 |
| seamless | 매끄러운, 끊김 없는 |
| holistic | 전체를 보는, 종합적인 |

### 7.2 형식 규칙

- **줄표(em-dash, `—`) 사용 금지**: 대신 마침표·쉼표·"..." 사용.
- **실제 숫자 사용**: "빠른" 대신 "30초", "많은" 대신 "12건".
- **실제 파일명·명령어 사용**: "config 파일" 대신 `lib/permission-manager.js`.

### 7.3 예외: 잠금 어휘 면제

`policies/locked-vocab.json`에 정의된 어휘 20개는 본 규칙 적용 대상이 아닙니다 (보존이 우선).

## 8. 사용자 질문 양식

`AskUserQuestion` 도구를 호출할 때 다음 5요소를 항상 포함합니다.

| 요소 | 설명 | 검증 |
|------|------|------|
| 1. 질문 | 90자 이하, 결과 중심 | `len ≤ 90` |
| 2. 한 줄 쉬운 설명 (ELI10) | 기술 용어 없이 한 줄. **도메인 전문가 결정 시 생략 가능** (`audience: domain_expert` 명시 시) | 30~120자 또는 명시적 생략 |
| 3. 추천안 + 이유 | "추천: 옵션 X — 한 줄 이유". **중립 자세 허용**: "추천: 없음 — 양쪽 트레이드오프 대등" | regex `^추천안?:` |
| 4. 선택지마다 ✅ ≥ 2개 / ❌ ≥ 1개 | 각 항목 40자 이상 (유니코드 코드포인트) | per option `min_length: 40` |
| 5. 한 번뿐인 결정 표시 | "⚠️ 이 결정은 되돌릴 수 없습니다 — 신중히 선택하십시오" | regex `⚠️ 이 결정은 되돌릴 수 없습니다` |

ELI10은 전체 결정에 1회만 작성합니다. 선택지마다 반복하지 않습니다.

도메인별 구체 예시는 부록 §A를 참조하세요.

<!-- END: cycle15-body-neutral -->

---

<!-- BEGIN: locked-vocab-appendix (auto-generated by scripts/gen-locked-vocab.mjs) -->

## 부록 A: 도메인 예시

> 이 부록은 `scripts/gen-locked-vocab.mjs`가 `policies/locked-vocab.json` SoT에서 자동 생성합니다.
> 직접 편집하지 마세요 — `bun run gen:vocab` 또는 `node scripts/gen-locked-vocab.mjs`로 재생성됩니다.

### A.1 MCU 예시

#### 잠금 어휘 (mcu)

| 어휘 | 의미 |
|------|------|
| `HardFault` | Cortex-M 코어 예외 |
| `CFSR` | 0xE000ED28, Configurable Fault Status Register |
| `HFSR` | 0xE000ED2C, HardFault Status Register |
| `MMFAR` | 0xE000ED34, MemManage Fault Address Register |
| `BFAR` | 0xE000ED38, BusFault Address Register |
| `FreeRTOS` | 임베디드 RTOS — xTaskCreate/Queue/Mutex/Semaphore |
| `MISRA C` | 안전 임베디드 코딩 표준 (MISRA C:2012) |

#### 시나리오

**MCU 회고 — HardFault 0건 사이클**

**요약**: Flash 사용량 78% 유지, HardFault 0건, MISRA C Required 위반 0건.


### A.2 MPU 예시

#### 잠금 어휘 (mpu)

| 어휘 | 의미 |
|------|------|
| `Device Tree` | 리눅스 하드웨어 기술 트리 |
| `dtsi` | Device Tree Source Include 파일 |
| `dtoverlay` | Device Tree Overlay (런타임 수정) |
| `bblayers.conf` | Yocto 레이어 설정 파일 |
| `Yocto` | 임베디드 리눅스 빌드 시스템 |
| `bitbake` | Yocto 빌드 도구 |
| `U-Boot` | Bootloader |

#### 시나리오

**MPU 회고 — Yocto 빌드 시간 단축**

**요약**: U-Boot + 커널 빌드 시간 22분 → 14분 (-36%), bblayers.conf 캐시 분리 효과.


### A.3 WPF 예시

#### 잠금 어휘 (wpf)

| 어휘 | 의미 |
|------|------|
| `XAML` | WPF/UWP UI 마크업 언어 |
| `MVVM` | Model-View-ViewModel 패턴 |
| `ObservableObject` | CommunityToolkit.Mvvm 베이스 클래스 |
| `RelayCommand` | CommunityToolkit.Mvvm Command 속성 |
| `.csproj` | C# 프로젝트 파일 |
| `app.config` | .NET 응용 프로그램 설정 파일 |

#### 시나리오

**WPF 회고 — XAML 바인딩 오류 0건**

**요약**: MVVM 구조 정합성 검증 도구 도입 후 XAML 바인딩 오류 12건 → 0건. .csproj 빌드 시간 회귀 0건.


<!-- END: locked-vocab-appendix -->
