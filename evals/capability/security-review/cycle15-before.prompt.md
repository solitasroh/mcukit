# Prompt — security-review cycle15 (before)

User asks `/security-review`. Skill v0.9.13 has only `--confidence 8` integer threshold; no
BLOCK/WARN/LOG_ONLY tiers, no two-classifier ensemble, no severity-based no-downgrade.

## Input

5 sample findings with mixed (score1, score2) pairs. Output as v0.9.13 would.
