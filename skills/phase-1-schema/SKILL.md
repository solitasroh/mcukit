---
name: phase-1-schema
classification: capability
classification-reason: Pattern guidance may overlap with model's built-in knowledge as it improves
deprecation-risk: medium
description: |
  Skill for defining terminology and data structures used throughout the project.
  Covers domain terminology, entities, relationships, and schema design.

  Use proactively when starting a new project or when data structures are unclear.

  Triggers: schema, terminology, data model, entity, 스키마, 用語, データモデル, 数据模型,
  esquema, terminología, modelo de datos, schéma, terminologie, modèle de données,
  Schema, Terminologie, Datenmodell, schema, terminologia, modello dati

  Do NOT use for: UI-only changes, deployment, or when schema is already defined.
agent: rkit:pipeline-guide
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
user-invocable: false
imports:
  - ${PLUGIN_ROOT}/templates/pipeline/phase-1-schema.template.md
  - ${PLUGIN_ROOT}/templates/shared/naming-conventions.md
next-skill: phase-2-convention
pdca-phase: plan
task-template: "[Phase-1] {feature}"
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

# Phase 1: Schema/Terminology Definition

> Define terminology and data structures used throughout the project

## Purpose

Unify the language of the project. Ensure all team members (or AI) communicate using the same terms and clearly understand data structures.

## What to Do in This Phase

1. **Build Glossary**: Map business terms + global standards
2. **Identify Entities**: Determine what "things" exist
3. **Define Relationships**: Relationships between entities
4. **Design Schema**: Define data structures

## Glossary

### Why is it Needed?

**Explaining business terms to Claude Code every time is tedious**.
Creating a glossary allows:
- Claude to automatically reference for context understanding
- Team communication consistency
- Reduced onboarding time for new team members/AI

### Term Categories

| Category | Description | Example |
|----------|-------------|---------|
| **Business Terms** | Internal proprietary terms | "Caddy" (golf booking assistant) |
| **Global Standards** | Industry common or technical standard terms | "OAuth", "REST API" |
| **Mapping** | Business ↔ Global correspondence | "Member" = User, "Payment" = Payment |

### Glossary Template

```markdown
## Business Terms (Internal Terms)

| Term | English | Definition | Global Standard Mapping |
|------|---------|------------|------------------------|
| Caddy | Caddy | AI assistant that helps book golf rounds | Booking Assistant |
| Round | Round | One 18-hole golf play | Session, Booking |
| Green Fee | Green Fee | Golf course usage fee | Usage Fee |

## Global Standards

| Term | Definition | Reference |
|------|------------|-----------|
| OAuth 2.0 | Authentication protocol | RFC 6749 |
| REST | API architecture style | - |
| UUID | Universal Unique Identifier | RFC 4122 |

## Term Usage Rules

1. Use **English** in code (`Caddy`, `Round`)
2. Use **local language** in UI/docs (Caddy, Round)
3. API responses prioritize **global standards** (`booking_assistant`)
```

### Claude Code Auto-Reference Setup

To have Claude automatically reference the glossary:

**Method 1**: Include in CLAUDE.md
```markdown
## Term Reference
For this project's term definitions, see `docs/01-plan/glossary.md`.
```

**Method 2**: Add term rules to project CLAUDE.md
```markdown
<!-- Add to CLAUDE.md -->
Project terms are defined in docs/01-plan/glossary.md.
Always reference when using business terms.
```

## Deliverables

```
docs/01-plan/
├── glossary.md         # Glossary (recommended new)
│   ├── Business Terms
│   ├── Global Standards
│   └── Mapping Table
├── schema.md           # Data schema
├── terminology.md      # (existing) → recommend merging into glossary.md
└── domain-model.md     # Domain model
```

## PDCA Application

- **Plan**: Identify what entities/terms are needed
- **Design**: Design schema structure, relationships
- **Do**: Write documentation
- **Check**: Review for omissions/contradictions
- **Act**: Finalize and proceed to Phase 2

## Level-wise Application

| Level | Application Level |
|-------|------------------|
| Starter | Simple (core terms only) |
| Dynamic | Detailed (all entities) |
| Enterprise | Detailed (per microservice) |

## Example Questions

```
"What are the core 'things' this project deals with?"
"What are the relationships between users, products, orders...?"
"Are 'member' and 'user' the same or different?"
```

## Template

See `templates/pipeline/phase-1-schema.template.md`

## Next Phase

Phase 2: Coding Convention → Now that terms are defined, define code rules

<!-- END: cycle3-body-neutral -->
