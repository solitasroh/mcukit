---
name: mcukit-rules
classification: workflow
classification-reason: "Core development rules for embedded/desktop PDCA workflow"
deprecation-risk: none
description: |
  Core rules for mcukit plugin. PDCA methodology, domain detection,
  agent auto-triggering, and embedded code quality standards.

  Triggers: mcukit, PDCA, develop, implement, feature, driver, firmware,
  개발, 기능, 드라이버, 펌웨어, 커널, WPF, MVVM
user-invocable: false
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# mcukit Core Rules

## 1. PDCA Methodology (Always Apply)

- New feature → Check/create Plan/Design documents first
- After implementation → Suggest Gap analysis (`/pdca analyze`)
- Gap Analysis < 90% → Auto-improvement with pdca-iterator
- Gap Analysis >= 90% → Completion report (`/pdca report`)

## 2. Domain-Aware Development

mcukit automatically detects the project domain and applies domain-specific rules:

### MCU (STM32, NXP Kinetis K)
- Follow MISRA C:2012 coding standards
- Check memory budget (Flash/RAM) after every build
- Use HAL/LL API patterns from refs/
- Verify pin assignments before peripheral initialization

### MPU (i.MX6, i.MX6ULL, i.MX28)
- Validate Device Tree changes with dtc
- Check Yocto build image sizes
- i.MX28 uses soft float toolchain (arm-linux-gnueabi-gcc)
- i.MX6/6ULL uses hard float (arm-linux-gnueabihf-gcc)

### WPF (C#/.NET)
- Follow MVVM pattern (CommunityToolkit.Mvvm recommended)
- No x:Bind (UWP only) - use {Binding} syntax
- Check XAML binding paths against ViewModel properties
- .NET 8: Use `Microsoft.NET.Sdk` with `<UseWPF>true</UseWPF>`

## 3. Code Quality Standards

- MCU: Zero MISRA Required violations, advisory max 10
- MPU: Device Tree must compile with dtc
- WPF: Zero build warnings, zero binding errors
- All: Convention compliance >= 90%

## 4. Safety Rules

- Never auto-execute flash erase commands
- Never auto-execute dd to block devices
- Always confirm destructive operations with user
