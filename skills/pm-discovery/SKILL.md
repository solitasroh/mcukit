---
name: pm-discovery
classification: workflow
classification-reason: PM process orchestration independent of model capability evolution
deprecation-risk: none
description: |
  PM Agent Team - Automated product discovery, strategy, and PRD generation.
  Runs 4 specialized PM agents in parallel to produce a comprehensive PRD
  before PDCA Plan phase. Integrates pm-skills frameworks (MIT).

  Use proactively when user wants product analysis before development,
  needs a PRD, or asks for PM-level planning.

  Triggers: /pdca pm, pm analysis, product discovery, PRD, pm team,
  PM 분석, 제품 기획, 제품 발견, PM팀, PRD 작성,
  PM分析, プロダクト分析, 产品分析, 产品发现,
  análisis PM, descubrimiento de producto,
  analyse PM, découverte produit,
  PM-Analyse, Produktentdeckung,
  analisi PM, scoperta prodotto

  Do NOT use for: implementation, code review, existing PDCA phases (plan/design/do/check).
argument-hint: "[feature]"
user-invocable: true
agents:
  default: rkit:pm-lead
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
imports:
  - ${PLUGIN_ROOT}/templates/pm-prd.template.md
next-skill: pdca plan
pdca-phase: pm
task-template: "[PM] {feature}"
---

<!-- BEGIN: cycle3-body-neutral -->

## 0. 문서 구조 (본 SKILL의 세 층)

1. **도메인 본문 (§1 ~ §N)**: 이 SKILL의 프로토콜.
   잠금 어휘 사용 0건이 `verify-policy --check body-neutrality`로 자동 검증됩니다.
2. **방법론 본문 — 도메인 중립**: Cycle 3에서 `<!-- BEGIN: cycle3-body-neutral -->` ~ `<!-- END: cycle3-body-neutral -->` 마커로 감싸진 영역.
3. **도메인 예시 부록 (§A)**: MCU/MPU/WPF 도메인별 사례.
   SoT(`policies/locked-vocab.json`)에서 `scripts/gen-locked-vocab.mjs`가 자동 생성합니다.

직접 부록을 편집하지 마세요 — `node scripts/gen-locked-vocab.mjs`로 재생성됩니다.

---

# PM Agent Team - Product Discovery & Strategy

> Automated PM analysis pipeline: Discovery + Strategy + Research -> PRD
> Based on [pm-skills](https://github.com/phuryn/pm-skills) by Pawel Huryn (MIT License)

## Overview

PM Agent Team provides AI-powered product management analysis for solo developers
and small teams without a dedicated PM. It runs before the PDCA Plan phase to ensure
you're building the right thing.

## How It Works

```
/pdca pm {feature}
     |
     v
PM Lead (opus) - orchestrates
     |
     +-- pm-discovery  --> Opportunity Solution Tree
     +-- pm-strategy   --> Value Proposition + Lean Canvas     [parallel]
     +-- pm-research   --> Personas + Competitors + Market
     |
     v
pm-prd --> Beachhead + GTM + PRD (8-section)
     |
     v
docs/00-pm/{feature}.prd.md
     |
     v
Next: /pdca plan {feature} (PRD auto-referenced)
```

## Included PM Frameworks (8)

| Framework | Agent | Origin |
|-----------|-------|--------|
| Opportunity Solution Tree | pm-discovery | Teresa Torres |
| Value Proposition (JTBD 6-Part) | pm-strategy | Huryn & Abdul Rauf |
| Lean Canvas | pm-strategy | Ash Maurya |
| User Personas (JTBD) | pm-research | JTBD-based |
| Competitor Analysis | pm-research | Strategic positioning |
| Market Sizing (TAM/SAM/SOM) | pm-research | Dual-method |
| Beachhead Segment | pm-prd | Geoffrey Moore |
| GTM Strategy | pm-prd | Product Compass |

## Usage

```bash
# Run PM analysis
/pdca pm my-saas-app

# After PM analysis, continue with PDCA
/pdca plan my-saas-app    # PRD auto-referenced
/pdca design my-saas-app
/pdca do my-saas-app
```

## Requirements

- Agent Teams enabled: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Project level: Dynamic or Enterprise (Starter not supported)

## PDCA Integration

```
[PM] --> [Plan] --> [Design] --> [Do] --> [Check] --> [Act] --> [Report]
 ^        ^
 new      PRD auto-referenced in Plan
```

When `/pdca plan {feature}` runs after PM analysis:
1. Checks for `docs/00-pm/{feature}.prd.md`
2. If found, reads PRD and uses as context for Plan document
3. Plan document quality is significantly improved with PM-backed data

## Output

PRD document saved to `docs/00-pm/{feature}.prd.md` containing:
- Executive Summary (4-perspective)
- Opportunity Solution Tree
- Value Proposition + Lean Canvas
- User Personas (3) + Competitor Analysis (5) + Market Sizing
- Beachhead Segment + GTM Strategy
- Product Requirements (8-section PRD)

<!-- END: cycle3-body-neutral -->
