# Prompt — code-review cycle15 (after)

User runs `/code-review src/lib/foo.js` after Cycle 1.5. Stats show: `performance` specialist has
dispatchCount=12, totalFindings=0 (gate_candidate, lastProbe 8 commits ago). `security` is NEVER_GATE.
Review history JSONL has 3 prior `skipped` findings on `src/lib/foo.js:42` (rule no-unused-vars,
fingerprint a1b2c3d4...). The file has not been modified since.

Now run /code-review and report what specialists run, what is auto-skipped, and what duplicate
findings are suppressed.
