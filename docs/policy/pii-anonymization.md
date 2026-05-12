# PII 익명화 정책 (FR-09)

> 적용 대상: `lib/core/session-ctx-fp.js`, `lib/core/worktree-detector.js` (묶음 A 도입 시), `cc-regression.jsonl` fingerprint 필드

## 익명화 식별값 알고리즘

```
fingerprint = sha256( device_salt + ':' + normalize_path(absolute_path) ).slice(0, 14)
```

### normalize_path

- POSIX `/` 통일 (Windows backslash → slash)
- trailing slash 제거
- **win32 플랫폼만 lowercase** (council security HIGH-1)
- POSIX는 대소문자 보존 (Linux/Mac case-sensitive FS)

### device_salt

- 위치: `~/.rkit/device-salt`
- 32 bytes random (crypto.randomBytes)
- 권한: 0o600 (POSIX) + Windows `icacls` ACL (current user only)
- 생성: `O_EXCL` atomic — 두 프로세스 동시 호출 시 race 방지 (council code-analyzer HIGH-1)

## 금지 사항

raw 형태로 저장 금지:
- `os.userInfo().username`
- `process.env.USERNAME` / `process.env.USER`
- `os.hostname()`
- `os.homedir()` (salt 위치 외)
- `process.env.HOME` / `process.env.USERPROFILE`
- `git config user.email`
- `git remote get-url`

## 결정성 보증

> 같은 기기 + 같은 경로 → 항상 같은 fingerprint

per_device_salt가 동일하므로 한 기기에서 다른 두 프로젝트가 같은 fp를 가질 수 없음. fp 충돌은 디바이스 salt 노출 없이 추적성 보장 (council frontend HIGH-4).

## 14자 길이 근거

sha256 hex(64) → 14자(56 bits) 절단. 충돌 확률 ≈ 2^28 ≈ 268M 경로에서 50% (생일 문제). 단일 기기, 90일 보존, 단일 프로젝트 컨텍스트에서 실용적 충돌 0건.

## 자동 검증

`node scripts/verify-policy.js --check pii-in-logs` — `.rkit/state/*.json|jsonl`에서 raw USERNAME/HOME/HOSTNAME/git remote URL grep. 0건 의무.
