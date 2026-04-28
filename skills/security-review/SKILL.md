---
name: security-review
classification: capability
classification-reason: Security analysis capability independent of model advancement
deprecation-risk: none
description: |
  Full STRIDE threat modeling adapted for embedded systems (MCU/MPU/WPF).
  Domain-specific hardware threat vectors, confidence-based filtering, false-positive exclusion.
  Inspired by gstack /cso with embedded adaptation.

  Triggers: security review, STRIDE, threat model, 보안 리뷰, 위협 모델링,
  セキュリティレビュー, 脅威モデリング, 安全审查, 威胁建模,
  revisión de seguridad, revue de sécurité, Sicherheitsüberprüfung, revisione sicurezza

  Do NOT use for: general code review (use /code-review),
  OWASP web-only checks (use security-architect agent directly).
argument-hint: "[feature] [--domain mcu|mpu|wpf] [--confidence 8]"
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
imports: []
next-skill: null
pdca-phase: check
task-template: "[Security] {feature}"
---

# Security Review Skill

> STRIDE threat modeling for embedded systems. Confidence-gated, domain-specific.
>
> **잠금 어휘 SoT**: [policies/locked-vocab.json](../../policies/locked-vocab.json) — 부록 §A는 `node scripts/gen-locked-vocab.mjs`로 자동 생성됩니다.

## 0. 문서 구조 (본 SKILL의 세 층)

1. **도메인 본문 (기존 §How It Works ~ §Module Dependencies)**: 임베디드 STRIDE 위협 모델. 잠금 어휘 사용 허용 (grandfathered).
2. **방법론 본문 — 도메인 중립 (§임계값+합산, §사용자 질문 양식)**: Cycle 1.5 추가. 잠금 어휘 0건 자동 검증.
3. **도메인 예시 부록 (§A)**: SoT 자동 생성.

## Arguments

| Argument | Description | Example |
|----------|-------------|---------|
| `{feature}` | Feature to review | `/security-review uart-dma` |
| `--domain` | Force domain (auto-detected if omitted) | `--domain mcu` |
| `--confidence` | Minimum confidence 0-10 (default: 8) | `--confidence 7` |

## How It Works

1. Auto-detect domain (MCU/MPU/WPF) from project files
2. Scan implementation files for the feature
3. Run STRIDE threat analysis using `lib/quality/embedded-threat-model.js`
4. Filter results by confidence threshold (default >= 8/10)
5. Exclude false positives (test files, mocks, examples)
6. Generate security review report

## STRIDE Threat Matrix

### MCU Threats

| STRIDE | Threat | Severity | Detection |
|--------|--------|----------|-----------|
| Spoofing | Firmware update forgery | Critical | Pattern: firmware_update, ota_update |
| Spoofing | Bootloader tampering | Critical | Pattern: bootloader, BOOT_ADDRESS |
| Tampering | Flash direct modification | High | Pattern: FLASH_Program, flash_write |
| Info Disclosure | JTAG/SWD port open | Critical | Pattern: JTAG, SWD, openocd |
| Info Disclosure | UART debug in production | High | Pattern: printf, UART_Transmit |
| DoS | Interrupt storm | High | Pattern: EXTI_Callback, NVIC_EnableIRQ |
| EoP | Stack overflow | Critical | Pattern: sprintf, strcpy, gets |

### MPU Threats (Kernel/Driver/App)

| STRIDE | Threat | Severity | Detection |
|--------|--------|----------|-----------|
| Spoofing | Kernel module impersonation | High | Pattern: insmod, modprobe |
| Spoofing | Shared library replacement | High | Pattern: LD_PRELOAD, dlopen |
| Tampering | DT overlay tampering | Medium | Pattern: dtoverlay, of_overlay |
| Info Disclosure | /proc exposure | Medium | Pattern: /proc/, proc_create |
| DoS | OOM killer trigger | High | Pattern: malloc, kmalloc |
| EoP | setuid misuse | High | Pattern: setuid, cap_set_proc |

### WPF Threats

| STRIDE | Threat | Severity | Detection |
|--------|--------|----------|-----------|
| Spoofing | DLL injection | High | Pattern: LoadLibrary, DllImport |
| Tampering | Config file modification | Medium | Pattern: app.config, appsettings |
| Info Disclosure | Serial port sniffing | Medium | Pattern: SerialPort, COM port |
| DoS | UI thread blocking | Medium | Pattern: Thread.Sleep, .Result |
| EoP | UAC bypass | High | Pattern: requireAdministrator |

## Confidence Scoring

| Score | Meaning |
|:-----:|---------|
| 10 | Definite vulnerability in production code |
| 8-9 | High confidence, production context confirmed |
| 6-7 | Pattern match but context uncertain |
| 4-5 | Possible issue, needs manual verification |
| 0-3 | Low confidence, likely false positive |

**Default threshold: 8** — only high-confidence findings reported.

## False-Positive Exclusions

Files in these paths are automatically excluded or confidence-reduced:
- `test/`, `tests/`, `mock/`, `mocks/`, `example/`, `examples/`
- Files ending in `.test.*` or `.spec.*`
- Debug-only code behind `#ifdef DEBUG`

## Output

**Output Format**:
```
--- Security Review: {feature} -----------------------
Domain    : MCU
Files     : 12 scanned
Threshold : 8/10
Findings  : 3

[CRITICAL] S-MCU-001: Firmware update forgery (9/10)
  File: src/ota/firmware_update.c
  Description: Unsigned firmware updates detected
  Mitigations:
    - Implement secure boot chain
    - Sign firmware with asymmetric keys

[HIGH] I-MCU-001: JTAG/SWD debug port open (8/10)
  File: src/hal/debug_config.h
  Description: Debug port configuration found in production code
  Mitigations:
    - Disable JTAG/SWD in production (fuse bits)

[HIGH] E-MCU-001: Stack overflow risk (8/10)
  File: src/protocol/parser.c
  Description: Unbounded string functions detected
  Mitigations:
    - Use bounded functions (snprintf, strncpy)
------------------------------------------------------
Summary: 1 Critical, 2 High, 0 Medium
```

**Report Path**: `docs/03-analysis/{feature}.security-review.md`

## Integration

### security-architect Agent
The `/security-review` skill can invoke the `security-architect` agent for deeper analysis.
The agent has the embedded STRIDE threat model section for domain-specific review.

### PDCA Check Phase
Security review runs as part of the Check phase, alongside gap analysis.
Auto-suggested after `/pdca analyze` completes.

### /guard Mode
When guard mode is active, security review findings are elevated (threshold lowered to 6).

## Module Dependencies

| Module | Function | Usage |
|--------|----------|-------|
| `lib/quality/embedded-threat-model.js` | `analyze()`, `getStrideSummary()` | Threat detection |
| `agents/security-architect.md` | STRIDE threat model | Deep analysis |

## Usage Examples

```bash
# Review a feature for MCU
/security-review uart-dma

# Review with lower confidence threshold
/security-review kernel-spi --confidence 6

# Force WPF domain
/security-review serial-bridge --domain wpf
```

<!-- BEGIN: cycle15-body-neutral -->

## 차단·경고·기록만 임계값 + 합산 판정

### 임계값 (3단계)

| 단계 | float (0.0~1.0) | 정수 (0~10) | 의미 |
|------|:---------------:|:-----------:|------|
| **BLOCK** | ≥ 0.85 | ≥ 8.5 | 머지 차단, 즉시 수정 필요 |
| **WARN** | 0.60 ≤ x < 0.85 | 6.0 ≤ x < 8.5 | 알림만, 사용자 판단 |
| **LOG_ONLY** | 0.40 ≤ x < 0.60 | 4.0 ≤ x < 6.0 | 감사 로그만 |
| (IGNORE) | < 0.40 | < 4.0 | 출력 안 함 |

### 환산 표 (기존 `--confidence` 옵션 호환)

| 정수 점수 | float | 단계 |
|:---------:|:-----:|------|
| 10 | 1.00 | BLOCK |
| 9 | 0.90 | BLOCK |
| 8.5 | 0.85 | BLOCK (경계) |
| 8 | 0.80 | WARN |
| 7 | 0.70 | WARN |
| 6 | 0.60 | WARN |
| 5 | 0.50 | LOG_ONLY |
| 4 | 0.40 | LOG_ONLY (경계) |
| ≤ 3 | < 0.40 | IGNORE |

### 위협 모델 모듈 호출 시그니처

본 SKILL은 두 검사기를 나란히 돌리고 결과를 합산합니다:

```
// 검사기 1: 패턴 매칭 (lib/quality/embedded-threat-model.js)
const results = analyze(code, filePath, domain, minConfidence);
// 반환: [{ id, stride, severity, confidence: 0~10, message, ... }, ...]
const score1 = results[0].confidence / 10;  // float 환산

// 검사기 2: 에이전트 문맥 분석 (agents/security-architect.md 호출)
const score2 = await invokeSecurityArchitect(file, finding);  // 0.0~1.0 float
```

### 합산 판정 규칙 (combineVerdict, 분기 우선순위 명시)

```
function combineVerdict(score1, score2, finding):
  // 우선순위 1: severity=critical 패턴은 단일 검사기 ≥0.85만으로 BLOCK 유지 (강등 금지)
  if finding.severity == "critical" AND isCriticalPattern(finding.id):
    if max(score1, score2) >= 0.85:
      return "BLOCK"

  // 우선순위 2: 둘 다 강함 → BLOCK
  if score1 >= 0.85 AND score2 >= 0.85:
    return "BLOCK"

  // 우선순위 3: 둘 다 의심 (0.60+) → BLOCK (단일 강함보다 우선)
  if score1 >= 0.60 AND score2 >= 0.60:
    return "BLOCK"

  // 우선순위 4: 한쪽만 강함 (≥0.85) + 다른 쪽 약함 → WARN으로 강등
  if max(score1, score2) >= 0.85:
    return "WARN"

  // 우선순위 5: 한쪽만 의심
  if max(score1, score2) >= 0.60:
    return "WARN"

  // 우선순위 6: 한쪽만 약한 신호
  if max(score1, score2) >= 0.40:
    return "LOG_ONLY"

  return "IGNORE"
```

### 경계 케이스 (시험 사례 매핑)

| (score1, score2) | severity·패턴 | 판정 | 이유 |
|------------------|--------------|------|------|
| (0.85, 0.60) | non-critical | BLOCK | 우선순위 3 (둘 다 0.60+) |
| (0.90, 0.50) | non-critical | WARN | 우선순위 4 (한쪽만 강함, 강등) |
| (0.90, 0.50) | critical, isCriticalPattern | BLOCK | 우선순위 1 (강등 금지) |
| (0.65, 0.70) | any | BLOCK | 우선순위 3 |
| (0.45, 0.45) | any | LOG_ONLY | 우선순위 6 |

### severity=critical 강등 금지 패턴 (8개)

| ID | 도메인 | 패턴 | 단일 ≥0.85로 BLOCK 유지 이유 |
|----|--------|------|--------------------------------|
| `S-MCU-001` | MCU | 펌웨어 업데이트 위변조 | 부팅 사슬 신뢰 무너짐 |
| `S-MCU-002` | MCU | Bootloader 변조 | 부팅 사슬 |
| `T-MCU-001` | MCU | Flash 직접 수정 (보안 영역) | 펌웨어 무결성 위협 |
| `I-MCU-001` | MCU | JTAG/SWD production 노출 | 양산 칩 내부 노출 |
| `E-MCU-001` | MCU | 스택 오버플로 + 코어 예외 트리거 | 단일 신호로도 명백한 위급 |
| `S-MPU-001` | MPU | 커널 모듈 위변조 (`insmod`/`modprobe`) | 시스템 권한 탈취 |
| `S-MPU-002` | MPU | LD_PRELOAD 치환 (라이브러리 가로채기) | 권한 탈취 |
| `S-WPF-001` | WPF | DLL 인젝션 | 응용 권한 탈취 |

`isCriticalPattern(id)`는 위 8개 ID와 정확 매칭합니다.

### 카나리 정책 (본 사이클 제외)

본 sync 사이클에서는 카나리 토큰 정책을 도입하지 않습니다. 사유: 본 프로젝트에 카나리 토큰 인프라가 정의되지 않은 상태에서 deterministic BLOCK 규칙만 명시하면 dead rule이 되어 시험 사례가 가짜로 통과될 위험이 있습니다. 별 PDCA 사이클에서 토큰 사전 + 검출 정규식 ≥ 3개와 함께 도입할 때 다시 검토합니다.

## 사용자 질문 양식

`AskUserQuestion` 호출 시 5요소 강제: 질문(≤90자) / ELI10(30~120자, 도메인 전문가 면제 가능) / 추천안+이유(중립 자세 허용) / 선택지마다 ✅ ≥ 2개·❌ ≥ 1개 (각 40자 이상) / 한 번뿐인 결정에는 "⚠️ 이 결정은 되돌릴 수 없습니다 — 신중히 선택하십시오" 표시.

ELI10은 전체 결정에 1회만 작성합니다.

도메인별 보안 검사 사례는 부록 §A를 참조하세요.

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

**MCU 보안 검사 — JTAG/SWD production 노출 (강등 금지)**

**판정**: BLOCK (단일 검사기 ≥0.85, severity=critical, I-MCU-001) — production 펌웨어에 JTAG 핀 활성화 발견.


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

**MPU 보안 검사 — 커널 모듈 위변조 (강등 금지)**

**판정**: BLOCK (S-MPU-001, severity=critical) — insmod 호출 경로에 무결성 검증 부재 발견.


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

**WPF 보안 검사 — DLL 인젝션 (강등 금지)**

**판정**: BLOCK (S-WPF-001, severity=critical) — LoadLibrary 호출 경로에 코드 서명 검증 부재.


<!-- END: locked-vocab-appendix -->
