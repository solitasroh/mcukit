# cc-regression GDPR 보존 정책 (D-8, FR-08)

> 적용 대상: `lib/cc-regression/` (묶음 E 도입 시), `.rkit/state/cc-regression.jsonl`

## 핵심 원칙

| 항목 | 정책 |
|------|------|
| 저장 내용 | 해시 + 메타데이터만. 원문(prompt/output) 저장 금지 |
| 보존 기간 | 90일 (timestamp 기준) |
| 외부 전송 | 금지 (NEVER_GATE `network_egress` 자동 강제) |
| 위치 | `.rkit/state/cc-regression.jsonl` (로컬만) |
| 삭제 | `node scripts/pdca-regression-purge.mjs` |

## 첫 활성화 시 사용자 동의 (council frontend HIGH-5)

묶음 E 최초 실행 시 1회 프롬프트:

```
[GDPR 고지]
cc-regression이 다음을 로컬에 기록합니다:
  - prompt/output 해시 (원문 미저장)
  - 토큰 사용량, 에러 카테고리
  - 세션·작업 폴더 익명화 식별값 (PII 없음)

  위치: .rkit/state/cc-regression.jsonl
  보존: 90일 후 자동 삭제
  외부 전송: 금지

계속하려면 Enter, 비활성화하려면 N:
```

응답 저장: `.rkit/state/.cc-regression-consent` (`accepted-<iso>` 또는 `declined`).

## 스키마 (entry 1줄)

```jsonl
{"timestamp":"ISO8601","schemaVersion":"1.0","fingerprint":"14자","sessionFp":"14자","promptHash":"sha256:...","outputHash":"sha256:...","tokenIn":N,"tokenOut":N,"errorType":"hardfault|build_fail|...","tag":"cycle-N-X"}
```

### `tag` 필드 정규식 강제 (council security HIGH-3)

```
^cycle-\d+(\.\d+)?-[A-Z0-9-]+$ | ^CO-\d+$
```

자유 텍스트 금지. PII 누출 차단. verify-policy `pii_in_logs` 검사 포함.

## GDPR 준수 매핑

| Article | 충족 방법 |
|---------|----------|
| Art.5(b) 목적 제한 | 첫 활성화 시 사용자 고지 + opt-in |
| Art.5(c) 데이터 최소화 | 해시만 저장, 원문 미저장 |
| Art.5(e) 보관 제한 | 90일 후 자동 삭제 |
| Art.17 삭제권 | `pdca-regression-purge.mjs --all` |
| Art.25 기본값 by design | egress=deny 기본값, 로컬 only |

## 자동 검증

`scripts/verify-policy.js --check pii-in-logs` — fingerprint 외 PII 토큰 grep 0건
`scripts/check-sunset.js` — NEVER_GATE `regression_retention` (sunset cycle-4)
