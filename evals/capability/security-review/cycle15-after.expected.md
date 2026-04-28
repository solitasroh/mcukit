# Expected — security-review cycle15 (after)

| # | (score1, score2) | severity·패턴 | 판정 | 우선순위 |
|---|------------------|---------------|------|----------|
| 1 | (0.85, 0.60) | high, I-MCU-002 | BLOCK | 우선순위 3 — 둘 다 ≥0.60 |
| 2 | (0.90, 0.50) | high, T-MPU-001 | WARN | 우선순위 4 — 한쪽만 ≥0.85, severity=critical 아니므로 강등 |
| 3 | (0.90, 0.50) | critical, S-MCU-001 | BLOCK | 우선순위 1 — severity=critical AND isCriticalPattern, 강등 금지 |
| 4 | (0.65, 0.70) | high | BLOCK | 우선순위 3 — 둘 다 ≥0.60 |
| 5 | (0.45, 0.45) | minor | LOG_ONLY | 우선순위 6 — max ≥0.40 |

S-MCU-001은 severity=critical 강등 금지 8개 패턴 중 하나 (펌웨어 위변조). 단일 검사기 ≥0.85만으로 BLOCK 유지.
