# rkit — AI Native Embedded Development Kit

> **PDCA methodology + Domain-specific AI agents for MCU/MPU/WPF development**

rkit is a Claude Code plugin that provides structured development workflows for embedded and desktop projects. It auto-detects your project domain and activates domain-specific Skills, Agents, and Quality Gates.

## Supported Domains

| Domain | Platforms | Key Features |
|--------|-----------|-------------|
| **MCU** | STM32, NXP Kinetis K | .map memory analysis, .ioc pin/clock validation, MISRA C |
| **MPU** | i.MX6, i.MX6ULL, i.MX28, STM32MP | Device Tree validation, Yocto/Buildroot analysis, STM32MP Yocto workflow |
| **WPF** | C#/XAML/.NET 8 | XAML binding verification, MVVM pattern validation |

## Installation

### Option 1: Plugin Marketplace (Recommended)

```bash
# 1. Register rkit as a marketplace
/plugin marketplace add solitasroh/rkit

# 2. Install the plugin
/plugin install rkit@solitasroh-rkit
```

**Updating to latest version:**

```bash
/plugin uninstall rkit@solitasroh-rkit
/plugin marketplace remove solitasroh-rkit
/plugin marketplace add solitasroh/rkit
/plugin install rkit@solitasroh-rkit
```

### Option 2: Manual Clone + Symlink

```bash
# 1. Clone the repository
git clone https://github.com/solitasroh/rkit.git ~/.claude/plugins/rkit

# 2. Symlink skills and agents
ln -s ~/.claude/plugins/rkit/skills ~/.claude/skills
ln -s ~/.claude/plugins/rkit/agents ~/.claude/agents
```

### Option 3: Project-local (Submodule)

```bash
# 1. Add to your embedded project as a submodule
cd my-stm32-project
git submodule add https://github.com/solitasroh/rkit.git .rkit

# 2. Symlink into .claude/
mkdir -p .claude
ln -s ../.rkit/skills .claude/skills
ln -s ../.rkit/agents .claude/agents
cp .rkit/CLAUDE.md ./CLAUDE.md
```

## Quick Start

```bash
# 1. Open your MCU/MPU/WPF project in Claude Code
cd my-stm32-project
claude

# 2. rkit auto-detects domain (MCU/MPU/WPF)
# 3. Start PDCA workflow
/pdca plan my-feature
/pdca design my-feature
/pdca do my-feature
/pdca analyze my-feature
/pdca report my-feature
```

## Plugin Contents

| Component | Count | Description |
|-----------|:-----:|-------------|
| **Skills** | 69 | Domain knowledge, PDCA workflow, safety, security, delivery, ops, STM32MP Yocto |
| **Agents** | 40 | AI specialists (fw-architect, linux-bsp-expert, wpf-architect, self-healing, CTO, PM team...) |
| **Hook Events** | 8 | Essential lifecycle hooks (session, safety, build, compaction, startup) |
| **Output Styles** | 4 | Response formatting (learning, pdca-guide, embedded, pdca-embedded) |
| **Templates** | 32 | PDCA documents, domain specs, pipeline phases, shared patterns, env template |
| **Lib Modules** | 118 | Core engine, PDCA state machine, Living Context System, quality metrics |
| **MCP Servers** | 2 | PDCA status & metrics (10 tools), code quality & gap analysis (6 tools) |
| **Evals** | 64 | Skill evaluation prompts (workflow, capability, hybrid) |
| **Refs** | 5 | Code pattern references (HAL, SDK, DTS, Yocto, MVVM) |

## Key Features

### MCU Domain
- **Auto Memory Report**: `make` builds trigger automatic Flash/RAM dashboard
- **Pin Conflict Detection**: CubeMX .ioc pin assignment validation
- **Clock Tree Verification**: PLL/SYSCLK/APB frequency calculation and limit check
- **MISRA C Guide**: Required/Advisory rule reference with cppcheck integration

### MPU Domain
- **DTS Validation**: Automatic `dtc` syntax check on .dts/.dtsi file save
- **Yocto Analysis**: local.conf/bblayers.conf parsing, image size tracking
- **Cross-Compiler Detection**: i.MX28 soft float auto-selection (ARMv5TEJ)
- **STM32MP Yocto Workflow**: Full 12-step setup, BSP customization, recipe automation (ST/NXP/TI)
- **Board Debug**: SSH remote testing, serial log analysis, QC report generation
- **HW Analysis**: Schematic/datasheet analysis → DTS/defconfig/driver mapping

### WPF Domain
- **XAML Binding Check**: Path extraction with [ObservableProperty] Source Generator support
- **MVVM Validation**: Pattern compliance scoring (no View references in ViewModel)
- **Serial Bridge**: MCU UART ↔ WPF SerialPort parameter consistency check

### Safety & Quality (v0.6.0)
- **File Freeze**: Domain preset protection (`/freeze preset mcu` — linker scripts, startup, HAL config)
- **Guard Mode**: Unified safety (`/guard on` — freeze + L2 cap + destructive blocking)
- **Architecture Lock**: Design decision enforcement with Mermaid diagrams (`/arch-lock lock`)
- **Embedded Challenge Protocol**: 21-question pre-PDCA methodology (`/reframe`)
- **STRIDE Security Review**: Domain-specific threat modeling (`/security-review`)
- **GitLab MR Automation**: `glab` CLI-based merge request creation (`/ship mr`)

### Project Management & Delivery
- **GitLab MR Lifecycle**: Full MR management — create, review, feedback, approve, merge (`/mr`)
- **OpenProject Integration**: Task status, creation, time entry via MCP tools (`/op-status`, `/op-task`, `/op-create-task`)
- **BTW Collector**: Capture improvement ideas on-the-fly during development (`/btw`)

### Living Context & Ops (v0.7.0)
- **Living Context System**: 7 modules for runtime context analysis (context-loader, impact-analyzer, invariant-checker, scenario-runner, self-healing, ops-metrics, decision-record)
- **Self-Healing Agent**: Auto-detect and recover from common failure patterns
- **Benchmark Skill**: Performance measurement and regression tracking (`/benchmark`)
- **Deploy Skill**: Deployment workflow management (`/deploy`)
- **Investigate Skill**: Root cause analysis for bugs and incidents (`/investigate`)
- **Retro Skill**: Structured retrospective for PDCA cycles (`/retro`)
- **Auto Migration**: `.bkit/` → `.rkit/` state directory migration with JSON content rewrite

## Requirements

- Claude Code v2.1.78 or later
- Node.js 18+ (for hook scripts)

## License

MIT

## Based On

- Core PDCA engine ported from [bkit-claude-code](https://github.com/popup-studio-ai/bkit-claude-code) (Apache 2.0) by POPUP STUDIO
- Safety/quality patterns adapted from [gstack](https://github.com/garrytan/gstack) (MIT) by Garry Tan

See [NOTICE.md](NOTICE.md) for full attribution.
