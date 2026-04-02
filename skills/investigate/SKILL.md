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

Save to `.mcukit/decisions/ADR-{NNN}-{slug}.md`:

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
