# Prompt — investigate cycle15 (after)

You are running rkit `/investigate` after Cycle 1.5 changes (Confusion Protocol §8 + AskUserQuestion
format §9 in body-neutral region). Respond per the cycle15 protocol.

## User input

"lib/context 모듈을 4개 하위 모듈로 분할하고 싶다. 어떻게 진행할지 조사해줘."

## Required behavior (after)

This request is an "아키텍처 결정" trigger (§8.1.1). The skill MUST:

1. Stop with `🛑 멈춤:` and name the ambiguity.
2. Present 2~3 options with ✅ (≥2 each, ≥40 codepoints) and ❌ (≥1 each, ≥40 codepoints).
3. State `추천안:` with a one-line reason. Neutral stance allowed.
4. If irreversible, include `⚠️ 이 결정은 되돌릴 수 없습니다 — 신중히 선택하십시오`.
