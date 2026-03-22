---
name: misra-c
classification: workflow
classification-reason: "MISRA compliance process is model-independent and always valuable"
deprecation-risk: none
domain: mcu
platforms: [stm32, nxp-k]
description: |
  MISRA C:2012 코딩 표준 가이드. Required/Advisory/Documented 규칙 분류,
  자주 위반되는 규칙 Top 20, cppcheck --addon=misra 연동.
  Triggers: MISRA, MISRA C, coding standard, 코딩 표준, コーディング規約, 编码标准
user-invocable: true
allowed-tools: [Read, Glob, Grep, Bash]
pdca-phase: check
---

# MISRA C:2012 Coding Standard Guide

## Rule Categories

| Category | Count | Compliance |
|----------|:-----:|------------|
| **Required (R)** | ~100 | Must comply. Zero violations. |
| **Advisory (A)** | ~50 | Should comply. Deviation with justification. |
| **Documented (D)** | ~16 | Document if deviated. |

## Frequently Violated Rules (Top 20)

| Rule | Cat | Description |
|------|:---:|-------------|
| R.10.1 | R | Operands shall not be of an inappropriate essential type |
| R.10.3 | R | Expression assigned to narrower/different essential type |
| R.10.4 | R | Both operands shall have same essential type category |
| R.11.3 | R | Cast between pointer to object and different object type |
| R.14.3 | R | Controlling expressions - no invariant Boolean |
| R.17.7 | R | Return value of non-void function shall be used |
| R.21.3 | R | Memory allocation (malloc/free) shall not be used |
| R.21.6 | R | Standard I/O (printf/scanf) shall not be used |
| A.4.1 | A | Run-time failures shall be minimized |
| R.8.4 | R | Compatible declaration required for functions |
| R.2.2 | R | No dead code |
| R.15.7 | R | All if...else if shall be terminated with else |
| D.4.1 | D | Deprecated features shall not be used |
| R.12.1 | R | Precedence of operators shall be explicit |
| R.20.4 | R | Macro shall not be defined with same name as keyword |

## cppcheck Integration

```bash
# Basic MISRA check
cppcheck --addon=misra src/

# With rule text file (for descriptive messages)
cppcheck --addon=misra.json src/
# misra.json:
# { "script": "misra.py", "args": ["--rule-texts=misra_rules.txt"] }

# Suppress specific rules
cppcheck --addon=misra --suppress=misra-c2012-20.9 src/
```

**Limitations of cppcheck MISRA addon**:
- Covers approximately 60-70% of MISRA C:2012 rules
- System-level rules (multi-translation-unit) not fully supported
- Undecidable rules cannot be fully verified by static analysis
- Higher false positive rate compared to commercial tools
- For MISRA certification: use PC-lint Plus, Polyspace, QAC, or LDRA

## Embedded-Specific MISRA Guidance

### Allowed Deviations (Common in Embedded)
- R.21.6 (Standard I/O): Debug builds may use printf via SWO/ITM
- R.21.3 (malloc): FreeRTOS heap management is acceptable with proper configuration
- R.11.3 (Pointer cast): Hardware register access requires pointer casting

### Common Fixes
```c
// R.17.7: Use return value
(void)HAL_UART_Transmit(&huart1, data, len, 100); // Explicit void cast if intentionally ignoring

// R.10.3: Match types
uint32_t count = 0U;  // Use U suffix for unsigned literals

// R.15.7: Always have else
if (condition) {
  // ...
} else {
  // No action required - MISRA compliance
}
```
