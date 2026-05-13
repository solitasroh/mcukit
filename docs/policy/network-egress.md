# 네트워크 송신 정책 (FR-06, 위-12)

> SoT: [`policies/network-allowlist.json`](../../policies/network-allowlist.json)

## 기본 원칙

**egress = deny by default.** 외부 네트워크 호출은 명시적 allowlist 항목으로만 허용.

## 차단 패턴 (14개, council security HIGH-2 확장)

```
import http
import https
require('http')
require('https')
fetch(
axios.
got.
node-fetch
undici
require('node:net')
require('node:dgram')
require('node:http2')
new WebSocket(
new EventSource(
```

## 면제 경로

| 경로 | 사유 |
|------|------|
| `tests/`, `test/` | 외부 송신 mock 또는 시험 fixture |
| `scripts/op-` | 사이클 1 OpenProject MCP 통합 (allowed_egress 등록) |

**production `node_modules/` 면제 안 됨** — 의존성 자체의 송신 차단 위함 (supply chain 보강).

## allowed_egress 추가 절차

1. Plan + Design 결정 통과
2. Security review 통과
3. `policies/network-allowlist.json` `allowed_egress[]`에 추가:
   ```json
   {
     "host": "api.example.com",
     "scripts": ["scripts/feature-X.js"],
     "rationale": "기능 X 외부 API 의존, 사용자 opt-in",
     "since": "cycle-N"
   }
   ```

## 자동 검증

`node scripts/verify-policy.js --check network-egress`

- `lib/`, `scripts/`, `hooks/` 디렉터리의 `.js|.mjs|.cjs` 파일 검사
- 면제 경로 외에서 차단 패턴 grep
- 위반 1건 이상 → exit 1

## SBOM 보강 (FR-14, council infra HIGH-2)

`docs/policy/supply-chain-sbom.md` 참조. `node_modules` 의존성 자체의 송신 차단.
