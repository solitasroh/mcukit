---
name: benchmark
description: |
  MCU/MPU/WPF domain-specific build and resource benchmarking.
  MCU: Flash/RAM usage via arm-none-eabi-size. MPU: rootfs/image size. WPF: build time and publish size.
  Triggers: benchmark, 벤치마크, ベンチマーク, 基准测试, benchmarking, Benchmark, riferimento
classification: capability
domain: all
platforms: [stm32, nxp-k, imx6, imx6ull, imx28, wpf]
user-invocable: true
allowed-tools: [Read, Bash, Glob, Grep]
---

# Build & Resource Benchmark

## 1. Domain Auto-Detection

Before running any benchmark, detect the project domain:

1. **MCU**: Look for `.ioc`, `.ld`, `startup_*.s`, `stm32*.h`, `fsl_*.h` files
2. **MPU**: Look for `.dts`, `.dtsi`, `bblayers.conf`, `*.bb` files
3. **WPF**: Look for `.csproj` with `<UseWPF>true</UseWPF>`

If detection fails, ask the user: "Could not auto-detect project domain. Which domain is this project? (MCU / MPU / WPF)"

## 2. MCU Benchmark Protocol

### 2.1 Flash/RAM Usage Measurement

```bash
# Find all ELF files
find build/ -name "*.elf" 2>/dev/null

# Measure Flash/RAM usage
arm-none-eabi-size --format=berkeley <project>.elf
```

Parse output columns:
- `text` + `data` = **Flash usage**
- `data` + `bss` = **RAM usage**

### 2.2 Linker Script Capacity Parsing

Parse the `.ld` linker script for total capacity:

```
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
  RAM (xrw)   : ORIGIN = 0x20000000, LENGTH = 128K
}
```

Extract `ORIGIN` and `LENGTH` for FLASH and RAM regions.

### 2.3 Threshold Evaluation

| Resource | Warning | Critical |
|----------|---------|----------|
| Flash    | > 85%   | > 95%    |
| RAM      | > 75%   | > 90%    |

### 2.4 Delta Comparison

Load previous benchmark from `.rkit/state/benchmark-history.json`:

```json
{
  "benchmarks": [
    {
      "timestamp": "2026-04-01T10:00:00Z",
      "domain": "mcu",
      "platform": "stm32",
      "elf": "build/firmware.elf",
      "flash_used": 102400,
      "flash_total": 524288,
      "ram_used": 32768,
      "ram_total": 131072,
      "commit": "abc1234"
    }
  ]
}
```

Calculate delta from last entry:
- `delta_flash = current - previous` (bytes and %)
- `delta_ram = current - previous` (bytes and %)

### 2.5 MCU Benchmark Commands

```bash
# Full benchmark
arm-none-eabi-size --format=sysv build/*.elf    # Per-section detail
arm-none-eabi-size --format=berkeley build/*.elf # Summary

# Per-object breakdown (what grew?)
arm-none-eabi-nm --size-sort --print-size build/*.elf | tail -20
```

## 3. MPU Benchmark Protocol

### 3.1 Image Size Measurement

```bash
# Yocto deploy directory
ls -lh tmp/deploy/images/<MACHINE>/

# Image size
du -sh tmp/deploy/images/<MACHINE>/*.rootfs.ext4
du -sh tmp/deploy/images/<MACHINE>/*.rootfs.tar.gz

# rootfs breakdown
du -sh tmp/work/<MACHINE>-poky-linux-gnueabi/*/image/ 2>/dev/null | sort -rh | head -20
```

### 3.2 Build Time

```bash
# Parse bitbake log for total build time
grep "^Build completed" tmp/log/cooker/<MACHINE>/console-latest.log

# Per-recipe build time (top 10 slowest)
grep "^NOTE: recipe" tmp/log/cooker/<MACHINE>/console-latest.log | sort -t= -k2 -rn | head -10
```

### 3.3 Package Count

```bash
# Total packages in image
cat tmp/deploy/images/<MACHINE>/*.manifest | wc -l
```

### 3.4 MPU Thresholds

| Metric          | Guideline                       |
|-----------------|---------------------------------|
| rootfs (NAND)   | < 90% of NAND partition size    |
| rootfs (SD)     | < 80% of SD partition size      |
| Boot time       | Project-specific target         |

## 4. WPF Benchmark Protocol

### 4.1 Build Time Measurement

```bash
# Clean build time
dotnet clean -c Release 2>/dev/null
time dotnet build -c Release

# Publish size
dotnet publish -c Release -o publish_output/
du -sh publish_output/
```

### 4.2 Publish Artifact Breakdown

```bash
# Largest files in publish output
du -a publish_output/ | sort -rn | head -20

# DLL count and total size
find publish_output/ -name "*.dll" | wc -l
find publish_output/ -name "*.dll" -exec du -ch {} + | tail -1
```

### 4.3 NuGet Package Audit

```bash
# List all packages
dotnet list package

# Package count
dotnet list package --format json 2>/dev/null | jq '.projects[].frameworks[].topLevelPackages | length'
```

### 4.4 WPF Thresholds

| Metric           | Warning      | Critical     |
|------------------|--------------|--------------|
| Build time       | > 60s        | > 180s       |
| Publish size     | > 100MB      | > 300MB      |
| NuGet packages   | > 30         | > 50         |

## 5. Output Format

Present results in a structured table:

```
## Benchmark Results — {domain} ({platform})
Date: {timestamp}
Commit: {short_hash}

| Metric         | Value       | Delta     | Threshold | Status |
|----------------|-------------|-----------|-----------|--------|
| Flash Used     | 98.5 KB     | +1.2 KB   | < 85%     | OK     |
| Flash %        | 19.2%       | +0.2%     | < 85%     | OK     |
| RAM Used       | 24.3 KB     | -0.1 KB   | < 75%     | OK     |
| RAM %          | 19.0%       | -0.1%     | < 75%     | OK     |
```

Status values:
- **OK**: Within threshold
- **WARN**: Exceeds warning threshold
- **CRIT**: Exceeds critical threshold

## 6. History and Trend Analysis

After each benchmark run:

1. **Save** results to `.rkit/state/benchmark-history.json`
2. **Trend**: Compare last 5 entries, report if usage is trending upward
3. **Alert**: If 3 consecutive benchmarks show increasing usage, warn about resource pressure
4. **Largest growth**: Identify the commit/change that caused the biggest delta

```json
{
  "trend": {
    "direction": "increasing",
    "avg_delta_flash_pct": "+0.3%",
    "avg_delta_ram_pct": "+0.1%",
    "consecutive_increases": 3,
    "alert": "Flash usage trending upward for 3 consecutive builds"
  }
}
```

## 7. Integration

- Runs after `/pdca do` builds or on-demand via `benchmark` trigger
- Results can be included in `/pdca report` via benchmark summary section
- Supports CI integration: exit code 1 if any metric is CRIT
