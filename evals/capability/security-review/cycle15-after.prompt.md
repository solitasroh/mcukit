# Prompt — security-review cycle15 (after)

User asks `/security-review` after Cycle 1.5. Apply combineVerdict per the cycle15 body-neutral
section. Output verdict for each of the following 5 (score1, score2, severity, patternId) tuples:

1. (0.85, 0.60), severity=high, pattern=I-MCU-002 → ?
2. (0.90, 0.50), severity=high, pattern=T-MPU-001 → ?
3. (0.90, 0.50), severity=critical, pattern=S-MCU-001 → ?
4. (0.65, 0.70), severity=high, pattern=any → ?
5. (0.45, 0.45), severity=minor, pattern=any → ?

For each, state the verdict tier and the priority rule that produced it. Reference the severity=critical
강등 금지 패턴 list when applicable.
