---
template: design
version: 1.2
---

# bkit-gstack-sync-v2 사이클 2 설계 문서 (v0.2)

> **한 줄 요약**: bkit 11 후보(7 묶음 + 4 carry-over) × 4 결정 = **44 결정 셀**을 `policies/decisions/cycle2-matrix.json` SoT로 추적. P0(묶음 A·B + CO-4) 본격 진행, P1·P2는 결정 기록만. 신규 SoT 6종(decisions/cycle2-matrix.json · network-allowlist.json · never-gate.json · locked-vocab.json scope 확장 · version.json · manifest.json) + verify-policy 검사 5→8 확장 + cc-regression GDPR 스키마 + PII 익명화 알고리즘 + sunset 자동 알림 도구 + SBOM (`npm ci --ignore-scripts` + `npm audit signatures`).
>
> **프로젝트**: rkit
> **버전**: v0.9.15 → v0.9.16 (목표, P0 결정 후)
> **작성자**: 노수장 + 6인 council
> **작성일**: 2026-04-28
> **상태**: Draft v0.2 (council 18건 + 사용자 결정 3건 반영)
> **기획서**: [bkit-gstack-sync-v2-cycle2.plan.md](../../01-plan/features/bkit-gstack-sync-v2-cycle2.plan.md) v0.3

---

## 1. 개요

### 1.1 설계 목표

1. **결정 추적 SoT 도입** (FR-11): `policies/decisions/cycle2-matrix.json`에 11 후보 × {도입·부분도입·보류·기각} 추적. 사이클 종료 시 어떤 후보가 어떤 근거로 어디 떨어졌는지 재구성 가능. `decided_by: {role, id}` 필수.
2. **policies/ SoT 디렉터리 표준화 + manifest** (FR-10): 사이클 1.5 + 본 사이클 신규 SoT를 `policies/`에 일원화. `manifest.json`이 SoT 등록부 역할.
3. **잠금 어휘 scope 메타-정책** (D-7, 위-13): `locked-vocab.json` 스키마 확장 `scope: "neutral"|"domain"`. 도메인 SKILL은 `domain-scoped: true` grandfathered.
4. **cc-regression GDPR 스키마** (D-8, FR-08): 해시+메타만, 90일 보존, `/pdca regression purge`, 로컬 only, **첫 활성화 시 opt-in 프롬프트**.
5. **PII 익명화 알고리즘** (FR-09): `fingerprint = sha256(salt + normalized_path)` 14자 절단. **win32만 lowercase**, POSIX 보존. `O_EXCL` atomic salt 생성 + Windows `icacls` 분기.
6. **verify-policy 검사 5→8 확장**: pii_in_logs / network_egress / decisions-matrix 추가. 단일 실행 ≤ 30s. `sunset` 메타 의무.
7. **sunset 자동 알림 도구** (사용자 결정-2 B): `scripts/check-sunset.js` Stop 훅 등록. 만료 30일 이내 경고, 만료 시 실패.
8. **SBOM** (사용자 결정-3 A): `npm ci --ignore-scripts` + `npm audit signatures` NFR.
9. **P0 한정 본격 진행** (위-2): A + B + CO-4만 본 사이클 도입. P1·P2 결정 기록만.

### 1.2 설계 원칙

- **결정 사이클 본질**: 1차 산출물 = `cycle2-matrix.json` 11 후보 종결 상태.
- **이중 트랙 보고**: 품질 트랙(Match Rate) + 거버넌스 트랙(결정 분포). `/pdca status` 출력 끝 1줄 추가.
- **추가만 정책**: 사이클 1·1.5 답습.
- **자동 검증 우선**: 사람 grep 의존 0건.
- **회귀 표면 최소화**: P0만 본 사이클.

---

## 2. 아키텍처

### 2.1 변경 대상 파일 지도 (v0.2)

```
rkit/
├── policies/
│   ├── manifest.json                          (신규 — SoT 등록부, 사용자 결정-1)
│   ├── locked-vocab.json                      (수정: scope 필드 추가, v1.1)
│   ├── version.json                           (조건부 신규 — CO-4)
│   ├── network-allowlist.json                 (신규 — 묶음 F P2 placeholder, 패턴 +6)
│   ├── never-gate.json                        (신규 — NEVER_GATE 8개 + sunset 메타)
│   └── decisions/
│       └── cycle2-matrix.json                 (신규 — 11×4 추적, decided_by 필수)
│
├── scripts/
│   ├── verify-policy.js                       (수정 +180줄: 검사 3 추가, sunset 인지)
│   ├── gen-locked-vocab.mjs                   (수정 +30줄: scope 분기)
│   ├── check-sunset.js                        (신규 ~80줄, 사용자 결정-2)
│   ├── verify-status-schema.js                (신규 ~140줄, FR-12, ARCHIVED 동적 파싱)
│   └── pdca-regression-purge.mjs              (신규 ~90줄, FR-08, .lock + atomic)
│
├── lib/core/                                  ← 조건부 (P0 결정 = adopt)
│   ├── version.js
│   ├── context-budget.js
│   ├── session-ctx-fp.js                      (FR-09 익명화 의무)
│   ├── worktree-detector.js                   (FR-09 의무)
│   └── session-title-cache.js
│
├── lib/domain/                                ← 조건부 (B adopt 시)
│   ├── ports/
│   ├── guards/
│   └── rules/
│
├── tests/cycle2/
│   ├── decisions-matrix.smoke.test.js         (신규)
│   ├── locked-vocab-scope.smoke.test.js       (신규)
│   ├── pii-anonymize.smoke.test.js            (신규, salt race + win32 분기 검증)
│   ├── regression-retention.smoke.test.js     (신규, purge race + opt-in 검증)
│   ├── status-schema-compat.smoke.test.js     (신규, 동적 ARCHIVED 검증)
│   ├── manifest-sync.smoke.test.js            (신규, manifest ↔ policies/ 일치)
│   └── sunset-alert.smoke.test.js             (신규, check-sunset 동작)
│
├── docs/policy/
│   ├── gstack-sync-policy.md                  (수정 +60줄)
│   ├── cycle2-decision-format.md              (신규)
│   ├── pii-anonymization.md                   (신규, "같은 기기 다른 경로 = 다른 fp" 1줄)
│   ├── gdpr-cc-regression.md                  (신규, opt-in 시퀀스)
│   ├── network-egress.md                      (신규, 6+ 패턴 + node_modules 제한)
│   └── supply-chain-sbom.md                   (신규, npm ci --ignore-scripts + audit signatures)
│
└── CLAUDE.md                                  (수정 +1~3줄: Overview 예고 + Data & Privacy 절)
```

### 2.2 결정 흐름 (v0.1과 동일)

P0 (단계 1) → P0 adopt 시 코드 구현 (단계 2) → P1 평가 (단계 3) → P2 평가 (단계 4) → 종결 게이트 (단계 5).

### 2.3 기존 인프라 변경

| 인프라 | 변경 | 비고 |
|--------|:----:|------|
| `verify-policy.js` | ✅ +3 검사 + sunset | 기존 5 검사 무변경 |
| `locked-vocab.json` | ✅ scope 필드 v1.1 | vocabs[].scope 추가 |
| `gen-locked-vocab.mjs` | ✅ scope 인지 | |
| `hooks/hooks.json` | ✅ check-sunset Stop 훅 추가 | 기존 verify-policy Stop 훅 옆 |
| 5 SKILL.md / .rkit/state/ | ❌ | 그대로 |

---

## 3. 데이터 모델

### 3.0 공통 NFR: 원자적 쓰기 (신규, council infra MED-#1)

모든 SoT JSON 파일 갱신 패턴:

```javascript
function atomicWriteJson(path, data) {
  const tmp = path + '.tmp.' + process.pid + '.' + Date.now();
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(data, null, 2));
    fs.fsyncSync(fd);   // OS write buffer flush
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, path);   // POSIX atomic
}
```

대상: locked-vocab / never-gate / network-allowlist / version / decisions/cycle2-matrix / manifest.

### 3.1 SoT: `policies/manifest.json` (신규, 사용자 결정-1 A)

```json
{
  "version": "1.0",
  "description": "SoT registry — every policies/ JSON must register here.",
  "sots": [
    { "path": "locked-vocab.json", "validator": "scripts/verify-policy.js --check vocab-preservation", "since": "cycle-1.5" },
    { "path": "never-gate.json", "validator": "scripts/verify-policy.js --check decisions-matrix", "since": "cycle-2" },
    { "path": "network-allowlist.json", "validator": "scripts/verify-policy.js --check network-egress", "since": "cycle-2" },
    { "path": "version.json", "validator": null, "since": "cycle-2", "conditional": "A adopt" },
    { "path": "decisions/cycle2-matrix.json", "validator": "scripts/verify-policy.js --check decisions-matrix", "since": "cycle-2" }
  ]
}
```

**자동 검증**: `verify-policy --check manifest-sync` — `policies/**/*.json` 실제 파일과 `manifest.sots[]` 일치 강제. 신규 SoT 추가 시 manifest 등록 누락 차단.

### 3.2 SoT: `policies/decisions/cycle2-matrix.json` (FR-11, decided_by 필수)

```json
{
  "version": "1.0",
  "cycle": "2",
  "lastUpdated": "2026-04-28T00:00:00Z",
  "candidates": [
    {
      "id": "A",
      "title": "lib/core/{version,context-budget,worktree-detector,session-ctx-fp,session-title-cache}",
      "priority": "P0",
      "decision": "pending",
      "reasoning": null,
      "evidence": [],
      "decided_by": null,
      "decided_at": null,
      "depends_on": [],
      "unblock_condition": null,
      "revisit_by": null,
      "carry_over": "CO-4 BKIT_VERSION integrated"
    },
    { "id": "B", "priority": "P0", "depends_on": ["A"], "...": "..." },
    { "id": "C", "priority": "P1", "depends_on": [], "...": "..." },
    { "id": "D", "priority": "P1", "carry_over": "CO-1 JSONL rotation integrated", "...": "..." },
    { "id": "E", "priority": "P1", "depends_on": [], "unblock_condition": "GDPR D-8 resolved AND opt-in prompt implemented", "...": "..." },
    { "id": "F", "priority": "P2", "unblock_condition": "egress=deny allowlist SoT exists", "...": "..." },
    { "id": "G", "priority": "P2", "unblock_condition": "FR-12 compat matrix 12+1/12+1 PASS", "...": "..." },
    { "id": "CO-1", "priority": "P1", "linked_to": "D or E", "...": "..." },
    { "id": "CO-2", "priority": "P2", "unblock_condition": "canary infrastructure exists", "...": "..." },
    { "id": "CO-3", "priority": "P1", "unblock_condition": "D-7 scope meta-policy resolved AND B decision != pending", "...": "..." },
    { "id": "CO-4", "priority": "P0", "linked_to": "A", "...": "..." }
  ],
  "decision_enum": ["pending", "adopt", "partial_adopt", "defer", "reject"],
  "decided_by_schema": {
    "role": ["human", "agent"],
    "id": "string (human: git email | agent: agent name)"
  },
  "depends_on_semantics": "candidate IDs (must be != pending before this can adopt)",
  "unblock_condition_semantics": "free-text external condition (must be observable / verifiable)",
  "completion_gate": {
    "rule": "All 11 candidates must have decision != pending",
    "check": "scripts/verify-policy.js --check decisions-matrix"
  }
}
```

**필수 필드 검증** (verify-policy `decisions-matrix`):
- `decision != pending` (사이클 종료 시)
- `defer` → `revisit_by` 또는 `unblock_condition` 필수
- `adopt`/`partial_adopt` → `reasoning.length ≥ 20`
- 모든 비-pending → `evidence.length ≥ 1`, `decided_by != null`

### 3.3 SoT: `policies/never-gate.json` (sunset 메타)

```json
{
  "version": "1.0",
  "items": [
    { "id": "security",              "since": "cycle-1.5", "scope": "permanent" },
    { "id": "data_migration",        "since": "cycle-1.5", "scope": "permanent" },
    { "id": "skill_md_consistency",  "since": "cycle-1.5", "scope": "permanent" },
    { "id": "vocab_sync",            "since": "cycle-1.5", "scope": "permanent" },
    { "id": "eval_syntax",           "since": "cycle-1.5", "scope": "permanent" },
    { "id": "network_egress",        "since": "cycle-2",   "scope": "transitional", "sunset": "cycle-4" },
    { "id": "pii_in_logs",           "since": "cycle-2",   "scope": "permanent" },
    { "id": "regression_retention",  "since": "cycle-2",   "scope": "transitional", "sunset": "cycle-4" }
  ]
}
```

### 3.4 SoT: `policies/network-allowlist.json` (egress 패턴 6+, council security HIGH-2)

```json
{
  "version": "1.0",
  "policy": "deny by default. egress requires Plan + Design + security review.",
  "allowed_egress": [],
  "blocked_patterns": [
    "import http",
    "import https",
    "require\\('http'\\)",
    "require\\('https'\\)",
    "fetch\\(",
    "axios\\.",
    "got\\.",
    "node-fetch",
    "undici",
    "require\\('node:net'\\)",
    "require\\('node:dgram'\\)",
    "require\\('node:http2'\\)",
    "new WebSocket\\(",
    "new EventSource\\("
  ],
  "exempt_paths": ["tests/", "test/"]
}
```

**변경 (council security HIGH-2)**: production `node_modules/` exempt 제거. `tests/` + `test/` 만 면제.

### 3.5 SoT 확장: `policies/locked-vocab.json` v1.1 (D-7)

```json
{
  "version": "1.1",
  "vocabs": [
    { "term": "HardFault", "domain": "mcu", "scope": "domain" }
  ],
  "scope_enum": ["neutral", "domain"],
  "scope_policy": {
    "neutral": "도메인 무관 사용 가능. verify-policy body-neutrality 면제.",
    "domain": "도메인 SKILL 본문/부록만. 중립 SKILL body-neutrality 위반."
  }
}
```

**역호환**: v1.0 vocabs는 모두 `scope: "domain"`으로 자동 매핑.

### 3.6 PII 익명화 알고리즘 (FR-09, council security HIGH-1 + code-analyzer HIGH-1 반영)

```javascript
import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SALT_PATH = path.join(os.homedir(), '.rkit', 'device-salt');

function applyWindowsAcl(file) {
  if (process.platform !== 'win32') return;
  try {
    const user = process.env.USERNAME || os.userInfo().username;
    execFileSync('icacls', [file, '/inheritance:r', '/grant:r', `${user}:F`], { stdio: 'ignore' });
  } catch {
    // ACL 실패 시 audit log + 계속 (fail-soft)
  }
}

function getOrCreateSalt() {
  try {
    return fs.readFileSync(SALT_PATH, 'utf8').trim();
  } catch {
    fs.mkdirSync(path.dirname(SALT_PATH), { recursive: true });
    const salt = crypto.randomBytes(32).toString('hex');
    try {
      // O_EXCL atomic create — race 방지 (code-analyzer HIGH-1)
      const fd = fs.openSync(SALT_PATH, 'wx', 0o600);
      fs.writeSync(fd, salt);
      fs.closeSync(fd);
      applyWindowsAcl(SALT_PATH);
      return salt;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // 다른 프로세스가 먼저 생성 → 재읽기
        return fs.readFileSync(SALT_PATH, 'utf8').trim();
      }
      throw err;
    }
  }
}

function normalizePath(absPath) {
  // POSIX slash 통일
  const slashed = absPath.replace(/\\/g, '/').replace(/\/$/, '');
  // win32만 lowercase (council security HIGH-1, code-analyzer HIGH)
  return process.platform === 'win32' ? slashed.toLowerCase() : slashed;
}

export function anonymizeFingerprint(absPath) {
  const salt = getOrCreateSalt();
  const normalized = normalizePath(absPath);
  return crypto
    .createHash('sha256')
    .update(salt + ':' + normalized)
    .digest('hex')
    .slice(0, 14);
}
```

**금지 목록** (verify-policy `pii_in_logs` 검사):
- `os.userInfo().username`, `os.hostname()`, `os.homedir()` (salt 위치 외)
- `git config user.email`, `git remote get-url`

### 3.7 cc-regression GDPR 스키마 (FR-08, D-8, opt-in 추가)

**위치**: `.rkit/state/cc-regression.jsonl` (묶음 E adopt 시)

```jsonl
{"timestamp":"2026-04-28T00:00:00Z","schemaVersion":"1.0","fingerprint":"a1b2c3d4e5f6g7","sessionFp":"e5f6a7b8c9d0e1","promptHash":"sha256:...","outputHash":"sha256:...","tokenIn":1234,"tokenOut":567,"errorType":"hardfault","tag":"cycle-2-A"}
```

**`tag` regex 강제** (council security HIGH-3 + code-analyzer MEDIUM):
```
^cycle-\d+(\.\d+)?-[A-Z0-9-]+$ | ^CO-\d+$
```
PII 누출 차단. verify-policy `pii_in_logs` 검사 대상에 포함.

**opt-in 프롬프트** (council frontend HIGH-5, GDPR Art.5(b)):

```javascript
// 묶음 E 최초 실행 시 1회
if (!fs.existsSync('.rkit/state/.cc-regression-consent')) {
  console.log(`
[GDPR 고지]
cc-regression이 다음을 로컬에 기록합니다:
  - prompt/output 해시 (원문 미저장)
  - 토큰 사용량, 에러 카테고리
  - 세션·작업 폴더 익명화 식별값 (PII 없음)
  - 위치: .rkit/state/cc-regression.jsonl
  - 보존: 90일 후 자동 삭제 (또는 'node scripts/pdca-regression-purge.mjs --all')
  - 외부 전송: 금지 (verify-policy network_egress 자동 강제)

계속하려면 Enter, 비활성화하려면 N: `);
  const ans = await readline.question('');
  if (ans.trim().toLowerCase() === 'n') {
    fs.writeFileSync('.rkit/state/.cc-regression-consent', 'declined');
    process.exit(0);
  }
  fs.writeFileSync('.rkit/state/.cc-regression-consent', 'accepted-' + new Date().toISOString());
}
```

**보존 규칙** (D-8 (a) 채택):
- 해시만 저장, 원문 0건
- 90일 보존, `pdca-regression-purge.mjs --older-than=90d`
- 로컬 only (NEVER_GATE `network_egress`)

### 3.8 enum 표기 컨벤션 (사이클 1.5 답습 + 확장)

| 종류 | 표기 | 예 |
|------|------|-----|
| verdict | UPPER_SNAKE | `BLOCK`, `WARN`, `LOG_ONLY` |
| gateStatus | lower_snake | `active`, `gate_candidate`, `never_gate` |
| severity | lower 단어 | `critical`, `major`, `minor`, `info` |
| action | lower 단어 | `skipped`, `fixed`, `auto_fixed` |
| **decision** | lower_snake | `pending`, `adopt`, `partial_adopt`, `defer`, `reject` |
| **scope (vocab)** | lower 단어 | `neutral`, `domain` |
| **scope (policy)** | lower 단어 | `permanent`, `transitional` |
| **role (decided_by)** | lower 단어 | `human`, `agent` |

---

## 4. 컴포넌트 사양 (FR별)

### 4.1 FR-01: 정체성 재정의 (D-1 (b))
Plan §1 명시. cycle2-matrix 평가 시 "공통 기반 적합성" 기준 사용.

### 4.2 FR-02 + FR-07: 11 후보 결정 + 사전 검증 테스트
각 후보:
1. 의존 그래프 분석 → evidence
2. 책임 중복 표 (C·D·G) → evidence
3. 사전 검증 테스트 (FR-07): `tests/cycle2/<id>.smoke.test.js`
4. 결정 게이트 → `decision` 갱신 + `decided_by`
5. `revisit_by`/`unblock_condition` (defer 시)

### 4.3 FR-03: 분야별 분리 (B)
조건부. ports 인터페이스 표 + Mermaid 시퀀스 + mcu/mpu/wpf 매핑 표.

### 4.4 FR-04: 책임 중복 표 (C)
| 책임 | 기존 rkit | bkit 후보 | 중복 |
|------|----------|----------|:----:|
| 의도 해석 | `lib/intent/` | `lib/orchestrator/intent` | ✅ |
| 다음 행동 | `/pdca next`, `/pdca status` | `lib/orchestrator/next-action` | ✅ |
| 상태 흐름 | `lib/pdca/lifecycle/` | `lib/orchestrator/workflow-sm` | ✅ |
| 팀 협업 | `lib/team/` | `lib/orchestrator/team` | ✅ |

중복 ≥3건 → C `defer` 자동 권고.

### 4.5 FR-05: QA + 회귀 (D + E + CO-1)
D 검증: 독립 옵션 + qa-phase SKILL 본문/부록 검증 + CO-1 통합 가능성.
E 검증 (FR-08 + D-8 의존): §3.7 GDPR + purge + opt-in + NEVER_GATE 통과.

### 4.6 FR-06: telemetry (F, P2)
`network-allowlist.json` 빈 allowed_egress 유지 → F 도입 시 design 단계 추가. 본 사이클 평가만, 도입 0건 권고.

### 4.7 FR-08: cc-regression purge (`scripts/pdca-regression-purge.mjs`)

```javascript
#!/usr/bin/env node
// council code-analyzer MEDIUM-3 + infra HIGH-2 반영: .lock + atomic + isTTY

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const REGRESSION_LOG = '.rkit/state/cc-regression.jsonl';
const LOCK_PATH = REGRESSION_LOG + '.lock';
const RETENTION_DAYS = 90;

function acquireLock() {
  try {
    const fd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_PATH); } catch {}
}

async function confirmDestructive(count) {
  if (!process.stdin.isTTY) {
    console.error('[abort] non-TTY environment, refuse destructive --all without confirmation');
    process.exit(2);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question(`Delete ${count} cc-regression entries? (yes/N): `);
  rl.close();
  return ans.trim().toLowerCase() === 'yes';
}

async function main() {
  // ... [arg parse: --all, --older-than=Nd, --dry-run]

  if (!acquireLock()) {
    console.error('[abort] another purge in progress (lock file exists). retry later.');
    process.exit(1);
  }

  try {
    // ... [read, filter, atomic write back]
    const lines = fs.readFileSync(REGRESSION_LOG, 'utf8').split('\n').filter(Boolean);
    const cutoff = Date.now() - olderThanDays * 86400 * 1000;
    const keep = all ? [] : lines.filter((l) => {
      try { return new Date(JSON.parse(l).timestamp).getTime() >= cutoff; }
      catch { return true; }
    });
    const deleteCount = lines.length - keep.length;

    if (deleteCount === 0) { console.log('Nothing to purge.'); return; }
    if (dryRun) { console.log(`[dry-run] would delete ${deleteCount}`); return; }
    if (all && !(await confirmDestructive(deleteCount))) { console.log('Aborted.'); return; }

    const tmp = REGRESSION_LOG + '.tmp.' + Date.now();
    fs.writeFileSync(tmp, keep.join('\n') + (keep.length > 0 ? '\n' : ''));
    fs.renameSync(tmp, REGRESSION_LOG);
    console.log(`Purged ${deleteCount}. Kept ${keep.length}.`);
  } finally {
    releaseLock();
  }
}

main().catch((err) => { releaseLock(); console.error(err); process.exit(1); });
```

### 4.8 FR-09: PII 익명화 (§3.6 알고리즘)
사례 시험 `tests/cycle2/pii-anonymize.smoke.test.js`:
- TC-14~18 (결정성, 구분, 권한, PII grep, 길이)
- TC 추가: salt race (두 프로세스 동시 호출 시 같은 salt 확인)
- TC 추가: Linux/Mac case-sensitive `/Foo` vs `/foo` 다른 fp (council security HIGH-1)

### 4.9 FR-10: `policies/` SoT 표준화 + manifest

**구조**:
```
policies/
├── manifest.json                  ← 사용자 결정-1 A: SoT 등록부
├── locked-vocab.json
├── never-gate.json
├── network-allowlist.json
├── version.json                   (조건부)
└── decisions/
    └── cycle2-matrix.json
```

**거버넌스** (council enterprise + frontend):
1. 신규 SoT 추가 시 `manifest.json` 등록 의무 (verify-policy 자동 검증)
2. 각 SoT `version` + `description` 필수
3. `gstack-sync-policy.md` §1 갱신

### 4.10 FR-11: 결정 매트릭스 (§3.2 + decided_by)

verify-policy `decisions-matrix` 검사:
- pending 0건 (사이클 종료)
- defer → revisit_by 또는 unblock_condition
- adopt → reasoning ≥ 20자
- 모든 비-pending → evidence ≥ 1, decided_by != null
- depends_on 순환 참조 없음

`/pdca status` 출력 확장 (council frontend HIGH-2):
```
결정 현황: pending 8 / adopt 2 / defer 1 / reject 0  (cycle2-matrix.json)
```

### 4.11 FR-12: status 호환성 (`verify-status-schema.js`, ARCHIVED 동적)

```javascript
// council code-analyzer HIGH-2 반영: 하드코딩 제거, _INDEX.md 동적 파싱
function loadArchivedFeatures() {
  const indexPath = 'docs/archive/2026-04/_INDEX.md';
  const txt = fs.readFileSync(indexPath, 'utf8');
  const rows = txt.match(/^\|\s*([a-z0-9-]+)\s*\|/gm) || [];
  return rows.map((r) => r.match(/^\|\s*([a-z0-9-]+)/)[1])
    .filter((id) => id !== 'feature');
}
```

사이클 1.6+에서 자동 반영.

### 4.12 FR-13: 28 SKILL 분류표 (`partial` 제거)

council frontend HIGH-2 반영. `partial` → `neutral` + `grandfathered: body-only` 주석:

| SKILL | scope | grandfathered |
|-------|-------|---------------|
| `/pdca` | neutral | ❌ |
| `/code-review` | neutral | body-only (Cycle 1.5 cycle15-body-neutral 영역만 검증) |
| `/investigate`·`/retro`·`/security-review` | domain | ✅ |
| `/starter`·`/dynamic`·`/enterprise` | neutral | ❌ |
| `/misra-c`·`/freertos`·`/communication`·`/stm32-hal`·`/nxp-mcuxpresso`·`/cmake-embedded`·`/hw-analysis`·`/mcu-critical-analysis` | domain | ✅ |
| `/yocto-*`·`/kernel-driver`·`/imx-bsp`·`/rootfs-config`·`/board-debug` | domain | ✅ |
| `/wpf-mvvm`·`/xaml-design`·`/dotnet-patterns` | domain | ✅ |
| `/phase-1-schema` ~ `/phase-9-deployment` | neutral | ❌ |
| 기타 (mr·op-*·mermaid·freeze·guard·control·deploy·mobile-app·desktop-app 등) | neutral | ❌ |

### 4.13 FR-14 (신규): SBOM (사용자 결정-3 A)

**위치**: `docs/policy/supply-chain-sbom.md` + Design §7
**내용**:
- `npm ci --ignore-scripts` 의무 (postinstall 등 외부 스크립트 거부)
- `npm audit signatures` 의무 (패키지 서명 검증)
- `package-lock.json` 커밋 의무 (해시 고정)
- CI에서 lock 변경 시 manual review

### 4.14 FR-15 (신규): sunset 자동 알림 (사용자 결정-2 B → A 사용자 변경)

**위치**: `scripts/check-sunset.js` (신규)

```javascript
#!/usr/bin/env node
// Stop hook 등록. never-gate.json transitional 항목 만료 알림.

const CURRENT_CYCLE = 2;   // 사이클 진행 시 갱신
const WARN_BEFORE = 1;     // N 사이클 전 경고

const ng = JSON.parse(fs.readFileSync('policies/never-gate.json', 'utf8'));
const warnings = [];
const failures = [];

for (const item of ng.items) {
  if (item.scope !== 'transitional' || !item.sunset) continue;
  const sunsetCycle = parseInt(item.sunset.replace('cycle-', ''));
  if (CURRENT_CYCLE >= sunsetCycle) {
    failures.push(`[FAIL] ${item.id} sunset reached at ${item.sunset}`);
  } else if (sunsetCycle - CURRENT_CYCLE <= WARN_BEFORE) {
    warnings.push(`[WARN] ${item.id} sunset in ${sunsetCycle - CURRENT_CYCLE} cycle(s) at ${item.sunset}`);
  }
}

warnings.forEach((w) => console.warn(w));
failures.forEach((f) => console.error(f));
process.exit(failures.length > 0 ? 1 : 0);
```

hooks.json Stop hook 추가:
```json
{
  "type": "command",
  "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/check-sunset.js",
  "timeout": 5000
}
```

---

## 5. 시험 사례 (TC) 매트릭스 (40 → 45 TC, "관련 위험" 열 추가)

| TC | FR/D | 검증 | 입력 | 기대 | 관련 위험 |
|----|------|------|------|------|----------|
| 1 | FR-01 | 평가 기준 | matrix 평가 기준 | "공통 기반 적합성" | 위-1, 17 |
| 2 | FR-02 | 11 후보 | matrix candidates | length === 11 | 위-2 |
| 3 | FR-02 | 결정 enum | decision_enum | 5개 | 위-9, 15 |
| 4 | FR-07 | 사전 시험 | adopt 후보 evidence | smoke.test.js 존재 | 위-9 |
| 5 | FR-03 | ports | B adopt 시 | interface ≥3 | 위-2 |
| 6 | FR-04 | 책임 중복 | C 평가 | ≥3건 시 defer | 위-3 |
| 7 | FR-05 D 독립 | D adopt 시 꺼짐 | 본체 동작 | hooks/session-start | 위-4 |
| 8 | FR-05 E GDPR | E adopt 후보 | unblock D-8 명시 | 위-10 |
| 9 | FR-06 F | network-allowlist | `allowed_egress.length === 0` (사이클 종료 시) | 위-12 |
| 10 | FR-08 GDPR 해시 | cc-regression entry | promptHash 존재 + 원문 부재 | 위-10 |
| 11 | FR-08 90일 | 91일 전 entry | purge 대상 | 위-10 |
| 12 | FR-08 purge --all | yes 응답 | 전체 삭제 | 위-10 |
| 13 | FR-08 purge N | N 응답 | Aborted | 위-10 |
| 14 | FR-09 결정성 | 같은 경로 2회 | 같은 fp | 위-11 |
| 15 | FR-09 구분 | 다른 경로 | 다른 fp | 위-11 |
| 16 | FR-09 salt 권한 | salt 파일 | 0o600 + Windows icacls | 위-11 |
| 17 | FR-09 PII grep | `.rkit/state/` | username/HOME/hostname/git URL 0건 | 위-11 |
| 18 | FR-09 길이 | fp.length | === 14 | 위-11 |
| 19 | FR-10 SoT | `policies/` ls | manifest+locked-vocab+never-gate+decisions 최소 | 위-9 |
| 20 | FR-10 version 필드 | 각 SoT | version + description 필수 | 위-9 |
| 21 | FR-11 종결 | 사이클 종료 시 | pending 0건 | 위-15 |
| 22 | FR-11 revisit_by | defer 후보 | revisit_by 또는 unblock_condition | 위-16 |
| 23 | FR-11 reasoning | adopt 후보 | length ≥ 20 | 위-9 |
| 24 | FR-11 evidence | 비-pending | ≥ 1 | 위-15 |
| 25 | FR-12 호환성 | 분할 전/후 | 동적 ARCHIVED 모두 PASS | 위-6 |
| 26 | FR-13 분류표 | 28 SKILL | 모두 행 존재 | 위-7, 13 |
| 27 | D-7 scope | locked-vocab vocabs[].scope | 20 vocabs 명시 | 위-13 |
| 28 | D-7 grandfathered | 도메인 SKILL 4개 | `domain-scoped: true` | 위-13 |
| 29 | D-8 로컬 only | cc-regression 위치 | `.rkit/state/` 내부만 | 위-10 |
| 30 | NFR egress=deny | import http grep | 미허용 모듈 0건 | 위-12 |
| 31 | NFR PII grep | `pii_in_logs` 검사 | 0건 | 위-11 |
| 32 | NFR 검증 시간 | verify-policy | ≤ 30s | 위-14 |
| 33 | NFR PR-time 자동 | lib/ 신규 + 미동반 | 차단 | 위-5 |
| 34 | NFR sunset | never-gate transitional | sunset 명시 | 위-14 |
| 35 | 위-1 메시징 | CLAUDE.md Overview | 1줄 예고 + Data&Privacy 절 | 위-1, 17 |
| 36 | 위-2 P0 한정 | P1·P2 결정 | adopt 0건 | 위-2 |
| 37 | 위-3 C 자동 defer | 책임 중복 ≥3 | C decision = defer | 위-3 |
| 38 | 위-7 grandfathered | 도메인 SKILL | body-neutrality 위반 안 함 | 위-7 |
| **39** | **신규 manifest** | `policies/**/*.json` vs manifest.sots | 일치 | 위-9 |
| **40** | **신규 sunset 알림** | sunset ≤ 1 사이클 | WARN 출력 | 위-14 |
| **41** | **신규 salt race** | 두 프로세스 동시 호출 | 같은 salt (O_EXCL 통과) | 위-11 |
| **42** | **신규 lowercase 분기** | Linux `/Foo` vs `/foo` | 다른 fp | 위-11 |
| **43** | **신규 tag regex** | cc-regression entry | regex 위반 시 차단 | 위-10 |
| **44** | **신규 GDPR opt-in** | 묶음 E 최초 실행 | 프롬프트 표시 | 위-10 |
| **45** | **신규 SBOM** | `npm ci --ignore-scripts` 실행 | 외부 스크립트 0건 + 서명 검증 PASS | 위-12 (확장) |
| 46 | 회귀 사이클 1·1.5 | 기존 evals + smoke | PASS 유지 | — |

**합계 46 TC** (TC-46 회귀 포함). 17 위험 모두 1개 이상 TC 매핑.

---

## 6. 구현 순서 (커밋 분해, 3-PR 구조)

council frontend LOW + enterprise HIGH 반영. 3 PR로 분리.

### PR-1: 거버넌스 (필수, P0 결정 전)

```
C0  feat(policies): add manifest.json + never-gate.json + network-allowlist.json + decisions/cycle2-matrix.json   (FR-10, 11, 사용자 결정-1)
C1  feat(policies): extend locked-vocab.json scope (v1.1)                                                          (D-7)
C2  feat(scripts): extend verify-policy.js with pii-in-logs / network-egress / decisions-matrix / manifest-sync    (FR-12, sunset 인지)
C3  feat(scripts): add check-sunset.js + register Stop hook                                                        (사용자 결정-2)
C4  feat(scripts): add pdca-regression-purge.mjs (.lock + atomic + isTTY) + verify-status-schema.js (dynamic)      (FR-08, FR-12)
C5  feat(docs/policy): 5 policy docs (decision-format / pii-anonymization / gdpr-cc-regression / network-egress / supply-chain-sbom)  (D-8, FR-09, FR-14)
C6  test(cycle2): 7 smoke tests                                                                                    (TC-39~45)
C7  docs(pdca): cycle2 Design + matrix initial (11 pending)                                                        (본 Design)
```

### PR-2: P0 구현 (조건부, P0 adopt 시)

```
C8   feat(lib/core): version + context-budget + worktree-detector + session-ctx-fp + session-title-cache (PII anonymize)  (A adopt)
C9   feat(lib/domain): ports + guards + rules                                                                              (B adopt)
C10  feat(policies/version): generate version.json with BKIT_VERSION                                                       (CO-4 adopt)
C11  test(lib/core): smoke tests per module                                                                                (FR-07)
C12  docs(pdca): matrix update A/B/CO-4 adopt with evidence + decided_by                                                   (FR-11)
```

### PR-3: P1·P2 결정 갱신 (각 결정마다)

```
C13  docs(pdca): matrix C decision (defer 자동 권고 가능성 높음)
C14  docs(pdca): matrix D + CO-1 decision
C15  docs(pdca): matrix E + D-8 unblock 확인 후
C16  docs(pdca): matrix F + network-allowlist 평가 (P2, defer 권고)
C17  docs(pdca): matrix G + verify-status-schema --before 실행 (사이클 3 진입 게이트)
C18  docs(pdca): matrix CO-2 canary (P2, defer 권고)
C19  docs(pdca): matrix CO-3 28 SKILL classification (P1, defer to cycle 3+)
C20  docs(pdca): CLAUDE.md 1줄 예고 + Data & Privacy 절 (P0 adopt 확정 후)
```

**git tag 사이클 경계** (council infra MED-#7):
- `cycle2-start` (PR-1 머지 직후)
- `cycle2-end` (PR-3 마지막 머지)

### 6.2 결정 게이트 (v0.1 답습 + 정량화)

| 단계 | 후보 | adopt | partial_adopt | defer | reject |
|------|------|-------|--------------|-------|--------|
| A | core 5 | 5 모듈 검증 + 의존 그래프 OK + FR-09 익명화 | 일부 모듈 (예: version만) | bkit 의존 그래프 ≥10 노드 | audit/quality 책임 중복 ≥2건 |
| CO-4 | version | A.version + version.json 생성 | wrapper만 | A defer | A reject |
| B | domain | ports 인터페이스 ≥3 + mcu/mpu/wpf 매핑 100% | ports만, guards/rules 보류 | A 미결 또는 매핑 <80% | 본체 직접 의존 ≥1건 |
| C | orchestrator | 책임 중복 ≤2건 | 일부만 보조 | **책임 중복 ≥3건 (자동)** | 책임 중복 = 4건 |
| D | qa | 독립 옵션 + qa-phase SKILL body-neutrality PASS | qa 일부만 명령 | E 미결 또는 jsonl 회전 미정 | test-all.js 대체 시도 |
| E | cc-regression | FR-08 + D-8 + purge + retention + **opt-in 동작** | 메타만 | D-8 미결 | 영구 기록 요구 |
| CO-1 | jsonl rotation | D 또는 E adopt + 회전 정책 통합 | placeholder | D·E 모두 defer | 미적용 |
| F | infra | egress=deny + allowlist + 동의 + 패턴 14개 검증 | docs-code-scanner만 (offline) | NEVER_GATE 우회 ≥1건 | 외부 전송 필수 |
| G | status split | FR-12 호환 매트릭스 13/13 PASS | 일부 함수만 분할 | 호환 위반 ≥1건 | 책임 분리 불필요 |
| CO-2 | canary | 토큰 사전 + regex ≥3 + opt-in | placeholder | 인프라 0건 | 임베디드 무관 |
| CO-3 | 28 SKILL | 분류표 + body-neutrality PASS | 분류표만 | D-7 미결 또는 분류 <100% | 사이클 3+ 이월 |

---

## 7. 보안 고려사항

council 11 HIGH 모두 반영:

- [x] **GDPR Art.5/17** (위-10): FR-08 + D-8 + opt-in 프롬프트 + tag regex 강제
- [x] **PII 익명화** (위-11): FR-09 + salt O_EXCL + Windows icacls + lowercase win32만
- [x] **외부 송신 차단** (위-12): NFR egress=deny + 패턴 14개 + production node_modules 비면제
- [x] **SBOM** (사용자 결정-3 A): `npm ci --ignore-scripts` + `npm audit signatures` + lock 커밋
- [x] **device-salt 권한**: 0o600 (POSIX) + icacls (Windows)
- [x] **purge race 보호**: `.lock` + atomic rename + isTTY 검사
- [x] **사이클 1.5 정책 준수** (NFR): manifest + verify-policy 자동 검증
- [x] **카나리 정책 보류** (CO-2): 사이클 1.5 D-7 답습

---

## 8. 테스트 계획

### 8.1 시험 범위

| 종류 | 도구 |
|------|------|
| 정적 | `node scripts/verify-policy.js` (5+3+1=9 검사 — manifest-sync 추가) |
| 단위 | `node --test tests/cycle2/*.smoke.test.js` (7 파일) |
| 회귀 | 사이클 1·1.5 기존 평가 + smoke |
| 통합 (조건부) | P0 adopt 시 lib/core·lib/domain |
| 만료 알림 | `node scripts/check-sunset.js` (Stop 훅 자동) |
| SBOM | `npm ci --ignore-scripts` + `npm audit signatures` |

### 8.2 핵심 사례

- TC-10~13: GDPR
- TC-14~18, 41~42: PII 익명화 (salt race + lowercase 분기)
- TC-21~24: 결정 매트릭스 종결
- TC-30~34: NEVER_GATE 8개
- TC-32: ≤ 30s
- TC-39~40: manifest + sunset
- TC-43~45: tag regex + opt-in + SBOM
- TC-46: 사이클 1·1.5 회귀 0건

### 8.3 시간 측정 NFR

```bash
# 사이클 1.5 기준 측정 (사전)
time node scripts/verify-policy.js --check body-neutrality   # baseline
# 사이클 2 측정 (사후)
time node scripts/verify-policy.js                            # 8 검사 ≤ 30s NFR
time bun test evals/ tests/cycle2/                            # 합산 ≤ 2분
```

---

## 9. 컨벤션 적용

사이클 1.5 답습 + 본 사이클 확장:

| 항목 | 적용 |
|------|------|
| 신규 SoT 위치 | `policies/` + manifest.json 등록 의무 |
| JSON atomic write | tmpfile + fsync + rename (§3.0 공통 NFR) |
| 사례 시험 | `tests/cycle2/*.smoke.test.js` |
| 정책 문서 | `docs/policy/` |
| 커밋 메시지 | Conventional Commits, Co-Authored-By 미포함 |
| 결정 enum | lower_snake |
| PR 단위 | 3 PR (거버넌스·구현·결정 추적) |
| git tag | `cycle2-start`/`cycle2-end` |

---

## 10. 구현 가이드

### 10.1 진입 절차

1. PR-1 C0~C7 일괄: 거버넌스 인프라
2. P0 결정 게이트: A·B·CO-4 → adopt 시 PR-2
3. PR-2 C8~C12: lib/core + lib/domain 구현 (조건부)
4. P1·P2 평가 → PR-3 C13~C20: 각 결정 matrix 갱신
5. 종결 게이트: `verify-policy --check decisions-matrix` PASS = pending 0건
6. `/pdca analyze` 진입

### 10.2 사이클 3 진입 조건 (council enterprise 권고)

`_INDEX.md`에 명시:
```
cycle3_prerequisites:
  - verify-status-schema --before executed
  - all 11 candidates decision != pending
  - check-sunset.js exit 0
```

---

## 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 0.1 | 2026-04-28 | 초안. 13 FR + 8 DR + 17 Risk → 40 TC, 11×4 결정 셀 + 5 SoT + verify-policy 8 검사. 6 필수 + 5 조건부 커밋. | 노수장 |
| 0.2 | 2026-04-28 | 6인 council 18건 + 사용자 결정 3건(A·A·A 또는 B·A 변경 후) 반영. HIGH 11: salt race(O_EXCL+icacls), POSIX 충돌(win32만 lowercase), egress 패턴+8(undici/net/dgram/http2/WebSocket/EventSource + production node_modules 제외), tag regex, decided_by 필수, ARCHIVED 동적 파싱, purge race(.lock+isTTY), 공통 atomic write NFR, GDPR opt-in 프롬프트, partial→neutral+body-only, /pdca status 결정 분포. MEDIUM 7. LOW 4. FR 13→15(FR-14 SBOM, FR-15 sunset 알림). TC 40→46. 3-PR 구조(거버넌스·구현·결정). git tag 경계. policies/manifest.json + check-sunset.js + supply-chain-sbom.md 신규. | 노수장 + 6인 council |
