---
name: investigate
description: |
  Systematic investigation protocol for MCU HardFault, MPU boot/kernel issues, and WPF crashes.
  Triggers: investigate, 조사, 調査, 调查, investigar, enquêter, untersuchen, indagare, HardFault, crash, 크래시
classification: capability
domain: all
platforms: [stm32, nxp-k, imx6, imx6ull, imx28, wpf]
user-invocable: true
allowed-tools: [Read, Bash, Glob, Grep]
---

# Systematic Investigation Protocol

> **잠금 어휘 SoT**: [policies/locked-vocab.json](../../policies/locked-vocab.json) — 본 SKILL의 부록(도메인 예시)은 `node scripts/gen-locked-vocab.mjs`로 자동 생성됩니다.

## 0. 문서 구조 (본 SKILL의 세 층)

이 스킬 문서는 세 층으로 구성됩니다:

1. **도메인 본문 (§1 ~ §7)**: 임베디드 분야 조사 프로토콜. 본 SKILL이 처음부터 가진 콘텐츠로, 잠금 어휘 사용이 허용됩니다 (grandfathered, Cycle 1.5 D-1(b') 마이크로-예외).
2. **방법론 본문 — 도메인 중립 (§8 ~ §9)**: Cycle 1.5에서 새로 추가된 절. **잠금 어휘 사용 0건**이 자동 검증됩니다. `<!-- BEGIN: cycle15-body-neutral -->` ~ `<!-- END: cycle15-body-neutral -->` 마커로 감쌉니다.
3. **도메인 예시 부록 (§A)**: MCU/MPU/WPF 도메인별 사례. SoT(`policies/locked-vocab.json`)에서 `scripts/gen-locked-vocab.mjs`가 자동 생성합니다.

직접 부록을 편집하지 마세요 — `bun run gen:vocab`으로 재생성됩니다.

## 1. Domain Auto-Detection

Detect the project domain to select the correct investigation protocol:

1. **MCU**: `.ioc`, `.ld`, `startup_*.s`, `stm32*.h`, `fsl_*.h`
2. **MPU**: `.dts`, `.dtsi`, `bblayers.conf`, `*.bb`
3. **WPF**: `.csproj` with `<UseWPF>true</UseWPF>`

If detection fails, ask the user which domain applies.

---

## 2. MCU Investigation Protocol (HardFault / Exception)

### Phase 1: Symptom Collection

Gather fault register values from the user or debug session:

| Register | Address      | Purpose                          |
|----------|--------------|----------------------------------|
| CFSR     | 0xE000ED28   | Configurable Fault Status        |
| HFSR     | 0xE000ED2C   | HardFault Status                 |
| MMFAR    | 0xE000ED34   | MemManage Fault Address          |
| BFAR     | 0xE000ED38   | BusFault Address                 |
| LR       | (stacked)    | Link Register at fault           |
| PC       | (stacked)    | Program Counter at fault         |

Ask the user:
- "What fault registers are available? (CFSR, HFSR, MMFAR, BFAR, stacked PC/LR)"
- "Was the fault reproducible or intermittent?"
- "What was the system doing when the fault occurred?"

### Phase 2: Stack Trace Resolution

```bash
# Resolve PC to source file and line
arm-none-eabi-addr2line -e build/*.elf -f -C <PC_value>

# Resolve LR (caller)
arm-none-eabi-addr2line -e build/*.elf -f -C <LR_value>

# Disassemble around fault address
arm-none-eabi-objdump -d -S build/*.elf | grep -A 10 -B 5 "<PC_value>"
```

### Phase 3: Memory Analysis

```bash
# Check stack boundaries
arm-none-eabi-nm build/*.elf | grep -E "_estack|_sstack|__stack"

# Check MSP value vs _estack
# If MSP < _sstack or MSP > _estack => Stack Overflow

# Heap usage (if using malloc)
arm-none-eabi-nm --size-sort build/*.elf | grep -i heap
```

Stack overflow detection:
- Compare MSP against `_estack` (stack top) defined in linker script
- If MSP exceeds stack boundary, stack overflow is confirmed
- Check FreeRTOS stack watermark: `uxTaskGetStackHighWaterMark()`

### Phase 4: Root Cause Classification

| CFSR Bit       | Cause                    | Typical Root Cause             |
|----------------|--------------------------|--------------------------------|
| IACCVIOL       | Instruction access       | Jump to invalid address        |
| DACCVIOL       | Data access violation    | NULL pointer dereference       |
| MUNSTKERR      | Unstacking error         | Corrupted stack                |
| MSTKERR        | Stacking error           | Stack overflow                 |
| IBUSERR        | Instruction bus error    | Flash read error               |
| PRECISERR      | Precise data bus error   | Invalid memory access          |
| IMPRECISERR    | Imprecise bus error      | Buffered write to invalid addr |
| UNDEFINSTR      | Undefined instruction    | Corrupted code / wrong thumb   |
| INVSTATE       | Invalid state            | BX to non-thumb address        |
| INVPC          | Invalid PC load          | Corrupted exception return     |
| UNALIGNED      | Unaligned access         | Struct packing / cast issue    |
| DIVBYZERO      | Division by zero         | Missing zero-check             |

### Phase 5: Fix Recommendations

| Root Cause          | Fix                                                    |
|---------------------|--------------------------------------------------------|
| NULL pointer        | Add NULL check before dereference; trace allocation    |
| Stack overflow      | Increase stack size in linker script or FreeRTOS config |
| Alignment error     | Use `__attribute__((packed))` or `__PACKED` with care  |
| MPU violation       | Review MPU region config; check access permissions     |
| Division by zero    | Add denominator validation before division             |
| Invalid function ptr| Verify callback registration; check vtable integrity   |

---

## 3. MPU Investigation Protocol (Boot / Kernel)

### Phase 1: Symptom Collection

Ask the user:
- "At which boot stage does the failure occur? (U-Boot / kernel / userspace)"
- "Is there a kernel panic message? Paste the last 20 lines of console output."
- "Was anything changed recently? (DTS, defconfig, recipe, kernel version)"

```bash
# Collect kernel messages
dmesg | tail -100

# Check for kernel panic
dmesg | grep -i -E "panic|oops|bug|error|fail"

# Boot log
cat /var/log/boot.log 2>/dev/null || journalctl -b -p err
```

### Phase 2: Device Tree Validation

```bash
# Compile DTS to check for syntax errors
dtc -I dts -O dtb -o /dev/null -W no-unit_address_vs_reg <file>.dts 2>&1

# Decompile running DTB for comparison
dtc -I dtb -O dts /sys/firmware/devicetree/base > running.dts 2>/dev/null

# Check for DTS warnings
dtc -I dts -O dtb <file>.dts 2>&1 | grep -i -E "warning|error"
```

### Phase 3: Pin Conflict Analysis

```bash
# Search for duplicate GPIO usage across DTS includes
grep -rn "pinctrl-0\|MX6UL_PAD\|MX6Q_PAD\|MX28_PAD" *.dts *.dtsi 2>/dev/null

# Check pinctrl groups for conflicts
grep -A 5 "pinctrl_" *.dts *.dtsi | grep "fsl,pins"
```

Look for:
- Same pad used in multiple pinctrl groups that are both active
- GPIO number conflicts between peripherals
- Missing pinctrl-names or pinctrl-0 references

### Phase 4: Driver State Verification

```bash
# Loaded modules
lsmod

# Platform driver binding status
ls /sys/bus/platform/drivers/

# Check if driver probed successfully
dmesg | grep -E "probe|bound|failed"

# Device presence
ls /sys/bus/i2c/devices/ 2>/dev/null
ls /sys/bus/spi/devices/ 2>/dev/null
```

### Phase 5: Root Cause Classification

| Category              | Symptoms                            | Investigation Path              |
|-----------------------|-------------------------------------|---------------------------------|
| DTS syntax error      | dtc compilation fails               | Fix DTS syntax                  |
| Pin conflict          | Peripheral not responding           | Resolve pad mux conflicts       |
| Driver not loaded     | No /dev entry, probe fail in dmesg  | Check defconfig, compatible     |
| Kernel config missing | Feature absent                      | Enable in defconfig, rebuild    |
| Clock/power           | Peripheral timeout                  | Check clock tree, regulator     |
| Memory map            | Bus error on access                 | Verify reg property in DTS      |

---

## 4. WPF Investigation Protocol (Crash / Exception)

### Phase 1: Symptom Collection

Ask the user:
- "What is the exact exception type and message?"
- "Is there a stack trace? Paste the full exception output."
- "When does it occur? (startup / user action / data loading)"

Key exception types to look for:
- `NullReferenceException` -- Missing binding or uninitialized object
- `XamlParseException` -- XAML syntax/resource error
- `InvalidOperationException` -- Cross-thread UI access
- `BindingExpression` errors in Output window

### Phase 2: Binding Error Analysis

```bash
# Search for common binding issues in XAML
grep -rn "Binding\|{Binding" --include="*.xaml" .

# Check DataContext assignments
grep -rn "DataContext" --include="*.xaml" --include="*.cs" .

# Look for x:Bind (WPF does NOT support this)
grep -rn "x:Bind" --include="*.xaml" .
```

Common binding errors:
- `BindingExpression path error`: Property name mismatch between XAML and ViewModel
- `Cannot find governing FrameworkElement`: DataContext not set or wrong scope
- `Value produced by BindingExpression is not valid`: Type converter missing

### Phase 3: MVVM Verification

```bash
# Check ViewModel inherits ObservableObject
grep -rn "ObservableObject\|INotifyPropertyChanged" --include="*.cs" .

# Check [ObservableProperty] usage
grep -rn "\[ObservableProperty\]" --include="*.cs" .

# Check [RelayCommand] usage
grep -rn "\[RelayCommand\]" --include="*.cs" .

# Verify partial class (required for source generators)
grep -rn "partial class" --include="*.cs" .
```

Violations to detect:
- ViewModel references `System.Windows.Controls` (breaks MVVM separation)
- Missing `partial` keyword on ViewModel class (CommunityToolkit source generators require it)
- Using `{x:Bind}` instead of `{Binding}` (UWP/WinUI only, not WPF)

### Phase 4: NuGet Conflict Check

```bash
# List all packages with versions
dotnet list package

# Check for vulnerable packages
dotnet list package --vulnerable 2>/dev/null

# Check for deprecated packages
dotnet list package --deprecated 2>/dev/null

# Restore and check for version conflicts
dotnet restore --verbosity detailed 2>&1 | grep -i -E "conflict|downgrade|warning"
```

### Phase 5: Root Cause Classification

| Category            | Symptoms                                    | Fix                                     |
|---------------------|---------------------------------------------|-----------------------------------------|
| Binding error       | BindingExpression in Output                 | Fix property path, set DataContext      |
| Threading           | InvalidOperationException on UI access      | Use Dispatcher.Invoke                   |
| NuGet conflict      | FileLoadException, MissingMethodException   | Align package versions                  |
| Data conversion     | FormatException, InvalidCastException       | Add IValueConverter                     |
| XAML parse          | XamlParseException at startup               | Fix XAML syntax, check resource URIs    |
| Missing resource    | IOException, resource not found             | Check Build Action, pack URI            |

---

## 5. Investigation Report Structure

After completing investigation, present findings in this structure:

```
## Investigation Report
Feature: {feature_name}
Date: {timestamp}
Domain: {mcu|mpu|wpf}

### Symptom
{What was observed}

### Root Cause
{Classification from Phase 4}
{Detailed technical explanation}

### Evidence
{Register values / error messages / stack traces}

### Fix Applied
{What was changed and why}

### Prevention
{How to prevent recurrence}
```

## 6. ADR Recording

Record significant investigation findings as Architecture Decision Records:

Save to `.rkit/decisions/ADR-{NNN}-{slug}.md`:

```markdown
# ADR-{NNN}: {Title}

## Status: Accepted
## Date: {date}

## Context
{What led to the investigation}

## Decision
{Root cause and chosen fix}

## Consequences
{Impact of the fix, what to watch for}
```

## 7. Cross-Domain Common Rules

1. **Never guess** -- always collect evidence before proposing a fix
2. **Reproduce first** -- confirm the symptom is reproducible when possible
3. **One variable at a time** -- change only one thing when testing a fix
4. **Record everything** -- save investigation results for future reference
5. **Verify the fix** -- confirm the symptom is gone after applying the fix

<!-- BEGIN: cycle15-body-neutral -->

## 8. 위험 결정 시 멈춤 절차

조사 도중 다음 4가지 상황 중 하나라도 만나면 **즉시 분석을 멈추고** 사용자에게 묻습니다. 일상적 코딩이나 명백한 변경에는 적용하지 않습니다.

### 8.1 멈춤 트리거

1. **아키텍처 결정**: 모듈 경계, 계층 구조, 핵심 의존성 변경.
2. **데이터 모델 변경**: 영속 데이터 스키마, 식별자, 인덱스 변경.
3. **되돌리기 어려운 작업**: 파일·디렉터리 영구 삭제, 디스크 직접 쓰기, 강제 push, 데이터 영구 폐기, 하드웨어 메모리 영구 변경.
4. **누락 컨텍스트**: 필요한 정보의 30% 미만만 확보된 상태.

### 8.2 멈춤 후 절차

1. 한 문장으로 모호함을 명명: "X와 Y 중 어느 쪽인지 결정해야 합니다."
2. 2~3개 선택지를 표로 제시. 각 선택지마다 좋은 점 ✅ 2개 이상 / 나쁜 점 ❌ 1개 이상, 각 항목 40자 이상.
3. 추천안과 한 줄 이유 명시. **추천이 불분명한 경우**: "추천: 없음 — 양쪽 트레이드오프가 대등함"으로 중립 자세를 명시할 수 있습니다.
4. AskUserQuestion 도구로 묻습니다 (§9 사용자 질문 양식 준수).

도메인별 구체 예시는 부록 §A를 참조하세요.

## 9. 사용자 질문 양식

`AskUserQuestion` 도구를 호출할 때 다음 5요소를 항상 포함합니다.

| 요소 | 설명 | 검증 |
|------|------|------|
| 1. 질문 | 90자 이하, 결과 중심 ("X 시 어떻게 처리할까요?" 형) | `len ≤ 90` |
| 2. 한 줄 쉬운 설명 (ELI10) | 기술 용어 없이 한 줄로 결정 의미 풀기. **예외: 도메인 전문가 결정 시 생략 가능** (`audience: domain_expert` 명시 시) | 길이 30~120자 또는 명시적 생략 |
| 3. 추천안 + 이유 | "추천: 옵션 X — 한 줄 이유". **중립 자세 허용**: "추천: 없음 — 양쪽 트레이드오프 대등" | 정규식 `^추천안?:` |
| 4. 선택지마다 ✅ ≥ 2개 / ❌ ≥ 1개 | 각 항목 40자 이상 (유니코드 코드포인트) | per option `min_length: 40` |
| 5. 한 번뿐인 결정 표시 | 되돌릴 수 없는 결정에는 "⚠️ 이 결정은 되돌릴 수 없습니다 — 신중히 선택하십시오" 명시 | 정규식 `⚠️ 이 결정은 되돌릴 수 없습니다` |

### 9.1 ELI10 선택지별 중복 금지

ELI10은 **전체 결정에 1회**만 작성합니다. 선택지마다 ELI10을 반복하면 인지 부하가 커집니다.

### 9.2 일반 예시 (도메인 무관)

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

### 9.3 한 번뿐인 결정 예시

```
question: "데이터베이스 컬럼 X를 영구 삭제할까요?"
audience: domain_expert      ← ELI10 생략 허용

선택지 A: 영구 삭제 (추천)
  추천: A — 90일 보관 정책 만료, 백업 검증 완료.
  ⚠️ 이 결정은 되돌릴 수 없습니다 — 신중히 선택하십시오
  ✅ 디스크 12GB 회수.
  ✅ 보존 정책 90일 의무 충족.
```

도메인별 구체 사례는 부록 §A를 참조하세요.

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

**MCU 예시 — UNALIGNED HardFault 조사**

> 🛑 멈춤: "CFSR=0x40000400 (UNALIGNED) 발생. 정렬 위반이 (A) packed 구조체 접근인지 (B) DMA 버퍼 정렬 문제인지 결정해야 합니다."

| 선택지 | ✅ 좋은 점 | ❌ 나쁜 점 |
|---|---|---|
| A) packed 구조체 분석 | ✅ 코드 검색만으로 검증 가능, 빌드 영향 없음.<br>✅ FreeRTOS 태스크 단위로 격리 검증 용이. | ❌ 실제 원인이 DMA면 시간 낭비. |
| B) DMA 버퍼 4-byte 정렬 검증 | ✅ linker script + DMA channel 설정 동시 점검 가능.<br>✅ 근본 해결로 재발 방지. | ❌ 하드웨어 매뉴얼 참조 필요, 30분 소요. |

**추천**: B — UNALIGNED + 직전 DMA 트랜잭션 로그 있으면 DMA 가능성 높음. MISRA C 권고에도 정렬 가정 명시화 필요.


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

**MPU 예시 — Device Tree 클럭 변경 결정**

> 🛑 멈춤: "Device Tree 노드 &i2c1의 clock-frequency 변경이 (A) bblayers.conf 신규 레이어 추가인지 (B) 기존 dtsi 오버라이드인지 결정해야 합니다."

| 선택지 | ✅ 좋은 점 | ❌ 나쁜 점 |
|---|---|---|
| A) bblayers.conf 신규 레이어 | ✅ Yocto 빌드 격리, U-Boot 영향 없음.<br>✅ 팀 간 변경 추적 용이 (별 레이어).<br>✅ bitbake 캐시 분리 가능. | ❌ 레이어 추가로 빌드 시간 +5분. |
| B) 기존 dtsi 오버라이드 (dtoverlay 없이) | ✅ 변경 한 파일에 집중, diff 명확.<br>✅ 기존 dtsi 의도 유지. | ❌ 다른 보드 변형(BSP fork)에 영향 가능.<br>❌ dtoverlay 없이 정적 변경이라 런타임 변경 불가. |

**추천**: B — 단일 보드 대상이고 런타임 변경 요구가 없다. bitbake 캐시 무효화는 1회만 발생.


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

**WPF 예시 — MVVM 마이그레이션 결정**

> 🛑 멈춤: "MainViewModel의 ObservableObject 상속을 (A) 기존 MVVM 구조 유지인지 (B) 새 RelayCommand 패턴으로 마이그레이션인지 결정해야 합니다."

| 선택지 | ✅ 좋은 점 | ❌ 나쁜 점 |
|---|---|---|
| A) 기존 MVVM 구조 유지 | ✅ 회귀 위험 0, .csproj 변경 없음.<br>✅ 팀 학습 부담 0. | ❌ RelayCommand 보일러플레이트 누적, XAML 바인딩 코드 중복. |
| B) RelayCommand 패턴 마이그레이션 | ✅ 코드 30% 감소 (boilerplate 제거).<br>✅ ObservableObject + [RelayCommand] 자동 생성기로 일관성 향상.<br>✅ app.config 변경 없이 .csproj NuGet만 추가. | ❌ 8개 ViewModel 동시 변경, XAML 바인딩 검증 필요. |

**추천**: B — 보일러플레이트 누적이 심각하고 CommunityToolkit.Mvvm은 안정 버전. 8 ViewModel은 단계적 마이그레이션 가능.


<!-- END: locked-vocab-appendix -->
