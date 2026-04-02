---
name: deploy
classification: workflow
classification-reason: Deployment workflow involves external hardware/tools and requires manual approval steps
deprecation-risk: low
description: |
  MCU flash programming, MPU image deployment, WPF publish guide.
  Domain-aware deployment with safety checks for destructive operations.

  Triggers: deploy, 배포, デプロイ, 部署, desplegar, deployer, bereitstellen, distribuire

  Do NOT use for: CI/CD pipeline setup (use /phase-9-deployment),
  GitLab MR creation (use /ship).
argument-hint: "[mcu|mpu|wpf] [target]"
domain: all
platforms: [stm32, nxp-k, imx6, imx6ull, imx28, wpf]
user-invocable: true
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
next-skill: null
pdca-phase: null
task-template: "[Deploy] {domain} {target}"
---

# Deploy Skill

## Overview
Guides deployment for MCU firmware flashing, MPU image writing, and WPF application publishing.
All destructive operations (flash erase, dd to block device) require **manual user approval**.

## Domain Detection
1. Check for `.ioc`, `.ld`, `startup_*.s` files -> MCU
2. Check for `.dts`, `.dtsi`, `bblayers.conf` files -> MPU
3. Check for `.csproj` with `<UseWPF>true</UseWPF>` -> WPF

## MCU Deployment

### STM32 (st-flash / STM32CubeProgrammer)
```bash
# Verify binary exists
ls build/*.bin build/*.hex 2>/dev/null

# Option 1: st-flash (open source, via stlink)
st-flash --format ihex write build/firmware.hex

# Option 2: STM32CubeProgrammer CLI
STM32_Programmer_CLI -c port=SWD -w build/firmware.bin 0x08000000 -v -rst
```

### NXP Kinetis K (JLinkExe / pyOCD)
```bash
# Option 1: JLinkExe
JLinkExe -device MK64FN1M0VLL12 -if SWD -speed 4000 -autoconnect 1 \
  -CommanderScript flash.jlink

# flash.jlink contents:
# r
# loadfile build/firmware.hex
# r
# go
# exit

# Option 2: pyOCD
pyocd flash --target k64f build/firmware.hex
```

### Safety Rules (MCU)
- **MANUAL APPROVAL REQUIRED**: Flash erase commands (`st-flash erase`, mass erase)
- Always verify binary size before flashing: `arm-none-eabi-size build/*.elf`
- Confirm target device matches project configuration
- Backup current firmware if possible before overwrite

## MPU Deployment

### i.MX6 / i.MX6ULL / i.MX28 Image Deployment

#### SD Card (Development)
```bash
# List available block devices FIRST
lsblk

# !! MANUAL APPROVAL REQUIRED for dd commands !!
# Write bootloader
sudo dd if=u-boot.imx of=/dev/sdX bs=1024 seek=1 conv=fsync

# Write rootfs
sudo dd if=core-image-minimal-*.wic of=/dev/sdX bs=4M conv=fsync
sync
```

#### SWUpdate (Production OTA)
```bash
# Generate SWUpdate package
swupdate-mkimage -f sw-description -o update.swu

# Deploy via network
curl -F "file=@update.swu" http://<device-ip>:8080/upload
```

### i.MX28 Specific
```bash
# i.MX28 uses mxs-bootlets, NOT u-boot.imx
# Ensure sb_loader or mfgtool is available
mfgtool2 -c ucl2.xml
```

### Safety Rules (MPU)
- **MANUAL APPROVAL REQUIRED**: All `dd if=` commands to block devices
- **NEVER** auto-detect target device — always ask user to confirm `/dev/sdX`
- Verify image integrity: `sha256sum` before writing
- For i.MX28: use `arm-linux-gnueabi-gcc` (soft float, NO hard float)

## WPF Deployment

### dotnet publish
```bash
# Framework-dependent (smaller, requires .NET runtime on target)
dotnet publish -c Release -r win-x64 --no-self-contained

# Self-contained (larger, standalone)
dotnet publish -c Release -r win-x64 --self-contained true

# Single file
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

### Verification
```bash
# Check output directory
ls -la bin/Release/net8.0-windows/win-x64/publish/

# Verify executable
file bin/Release/net8.0-windows/win-x64/publish/*.exe
```

### Safety Rules (WPF)
- Verify `<UseWPF>true</UseWPF>` in .csproj before publish
- Confirm `<TargetFramework>net8.0-windows</TargetFramework>`
- Check for missing NuGet packages: `dotnet restore` before publish

## Pre-Deployment Checklist
1. Build succeeds without errors
2. Binary size within budget (MCU: Flash < 85%, RAM < 75%)
3. All invariant checks pass (`lib/context/invariant-checker.js`)
4. Version/tag is set appropriately
5. Target device/environment confirmed by user
