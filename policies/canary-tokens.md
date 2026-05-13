# Canary Token Policy

Cycle 4 CR4-7 (canary regex 분리 채택). cc-regression (CR4-1 permanent_reject) 대체 보안 가치.

## 목적

코드/문서/로그에서 외부 서비스의 비밀 토큰(API key, PAT, bot token) 누출을 탐지.

## SoT

`scripts/security/canary-patterns.json` — 패턴 + exclusion globs.

## 패턴 (6+)

| ID | Service | Regex | Severity |
|----|---------|-------|----------|
| CK-001 | AWS Access Key | `AKIA[0-9A-Z]{16}` | high |
| CK-002 | GitHub PAT | `gh[ps]_[A-Za-z0-9]{36}` | high |
| CK-003 | OpenAI API Key (classic) | `sk-[A-Za-z0-9]{48}` | high |
| CK-003a | OpenAI Project Key | `sk-proj-[A-Za-z0-9_-]{40,}` | high |
| CK-004 | Slack Bot Token | `xoxb-...` | high |
| CK-005 | Google API Key | `AIza[0-9A-Za-z\-_]{35}` | high |

## 스캐너

`scripts/security/scan-canary.mjs`

```bash
node scripts/security/scan-canary.mjs            # 전체 스캔, 매칭 시 exit 1
node scripts/security/scan-canary.mjs --quiet    # 발견 1줄만
node scripts/security/scan-canary.mjs --dry-run  # 보고만, exit 0
```

## False positive 제외

`canary-patterns.json` `exclusion_globs`:
- `**/*.test.{js,ts,mjs}`, `**/*.mock.*`
- `**/fixtures/**`, `**/__tests__/**`, `**/__mocks__/**`
- `docs/**/example*`
- `tests/**/*.smoke.test.js`
- 본 SoT + 스캐너 자체 (self-exclusion)

## CI 통합 (권고)

`.github/workflows/canary.yml`:

```yaml
on: [pull_request, push: main]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node scripts/security/scan-canary.mjs --quiet
```

`continue-on-error: false` (실제 누출 발견 시 PR 차단).

## /security-review 통합

`/security-review` SKILL이 본 스캐너를 호출하여 PR 단위 리뷰 결과에 포함.

## CR4-1 cc-regression vs CR4-7 canary

| 측면 | cc-regression (CR4-1 reject) | canary (CR4-7 adopt) |
|------|------------------------------|---------------------|
| 탐지 대상 | hooks 회귀 (간접) | 비밀 토큰 누출 (직접) |
| 비용 | 18-25h | 4-6h |
| 외부 의존 | none | none (offline) |
| GDPR 부담 | high (hash + retention + opt-in) | low (regex 매칭만) |
| 직접 가치 | medium | high (security ROI) |
