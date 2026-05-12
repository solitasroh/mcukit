# Supply Chain 보안 정책 (FR-14, 사용자 결정-3 A)

> 적용 대상: `package.json`, `package-lock.json`, CI 빌드 파이프라인

## 핵심 원칙

**npm 의존성은 변조 가능. 설치 스크립트는 외부 서버 접속 흔한 경로.**

## 의무 사항

### 1. `npm ci --ignore-scripts` 사용

```bash
# YES
npm ci --ignore-scripts

# NO
npm install              # postinstall 실행 → 외부 송신 위험
npm install --no-save    # 동상
```

설치 스크립트(`postinstall`, `preinstall`, `install`) 실행 거부. 패키지가 설치 시점에 외부 서버 호출하는 공격 경로 차단.

### 2. `npm audit signatures` 실행

```bash
npm audit signatures
```

각 패키지의 npm 서명 검증. 변조된 패키지 감지.

### 3. `package-lock.json` 커밋 의무

- 해시 고정으로 의존성 트리 변조 감지
- lock 변경 시 PR review 의무

### 4. CI 파이프라인

```yaml
- name: install
  run: npm ci --ignore-scripts
- name: audit signatures
  run: npm audit signatures
- name: verify-policy
  run: node scripts/verify-policy.js
```

## 자동 검증 (향후)

`verify-policy.js`에 SBOM 검사 추가 후보:
- `npm ci --ignore-scripts` 흔적 확인 (CI 로그)
- `package-lock.json` 해시 변조 감지

## 공격 시나리오 차단

| 시나리오 | 차단 메커니즘 |
|---------|--------------|
| 악성 postinstall 외부 호출 | `--ignore-scripts` |
| 변조된 패키지 설치 | `npm audit signatures` |
| 의존성 트리 swap | `package-lock.json` 해시 |
| 의존성 자체의 fetch | `policies/network-allowlist.json` (production node_modules 비면제) |
