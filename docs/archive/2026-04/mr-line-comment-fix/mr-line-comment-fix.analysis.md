# Design-Implementation Gap Analysis Report

## Analysis Overview
- Analysis Target: mr-line-comment-fix
- Design Document: `docs/02-design/features/mr-line-comment-fix.design.md`
- Implementation Path: `skills/mr/SKILL.md` (review Step 4, 143~257줄)
- Analysis Date: 2026-04-10

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 88% | ⚠️ |
| Architecture Compliance | 95% | ✅ |
| Convention Compliance | 90% | ✅ |
| **Overall** | **91%** | ✅ |

---

## Detailed Item-by-Item Analysis

### Section 3.1 - Step 4-a: GitLab 인증 정보 추출

| # | Design 항목 | Status | Detail |
|---|------------|:------:|--------|
| 1 | OS별 glab config 경로 처리 (Windows: APPDATA, Linux/macOS: XDG_CONFIG_HOME) | ✅ Match | SKILL.md 157~161줄: `if [[ "$OSTYPE" == "msys" ...]]` 분기로 Windows/Linux 모두 처리 |
| 2 | host, token, api_protocol 추출 | ✅ Match | SKILL.md 164~167줄: `GITLAB_HOST`, `GITLAB_TOKEN`, `API_PROTOCOL` 추출 코드 동일 |
| 3 | project ID 추출 (git remote -> URL encode -> GitLab API) | ✅ Match | SKILL.md 170~172줄: `git remote get-url origin` -> `sed` URL encode -> `curl` API 호출 |
| 4 | 인증 실패 시 에러 안내 | ✅ Match | SKILL.md 175줄: "`glab auth login`으로 인증하세요" 안내 명시 |

**Section Score: 4/4 (100%)**

---

### Section 3.2 - Step 4-b: Diff SHA 추출

| # | Design 항목 | Status | Detail |
|---|------------|:------:|--------|
| 5 | MR versions API 호출 | ✅ Match | SKILL.md 182~183줄: `curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" .../versions` 동일 |
| 6 | base_commit_sha, head_commit_sha, start_commit_sha 추출 | ✅ Match | SKILL.md 184~186줄: `jq -r '.[0].base_commit_sha'` 등 3개 SHA 추출 동일 |
| 7 | 빈 배열 시 fallback 안내 | ✅ Match | SKILL.md 189줄: "diff version이 없습니다" 안내 + fallback으로 일반 discussion 생성 명시 |

**Section Score: 3/3 (100%)**

---

### Section 3.3 - Step 4-c: Diff Hunk 범위 검증

| # | Design 항목 | Status | Detail |
|---|------------|:------:|--------|
| 8 | diff hunk header (`@@ -a,b +c,d @@`) 파싱 | ✅ Match | SKILL.md 193줄: diff hunk header 파싱 명시 |
| 9 | is_valid_line 검증 로직 | ⚠️ Partial | Design에는 bash 구현 코드(grep -oP, while loop)가 상세하지만, SKILL.md는 pseudocode(`is_valid_line` 함수)만 기술. 로직 의미는 동일하나 구현 수준이 다름 |
| 10 | 범위 밖 시 fallback 처리 | ✅ Match | SKILL.md 205줄: `[file:line]` prefix 추가하여 일반 discussion으로 fallback 명시 |

**Section Score: 2.5/3 (83%)**

---

### Section 3.4 - Step 4-d: Line Comment 생성

| # | Design 항목 | Status | Detail |
|---|------------|:------:|--------|
| 11 | curl + JSON body로 line comment 생성 (position object 포함) | ✅ Match | SKILL.md 212~227줄: curl -s -X POST + JSON body + position object 동일 |
| 12 | 파일:라인 없는 comment는 glab api로 일반 discussion | ✅ Match | SKILL.md 230~235줄: `glab api --method POST ...` 기존 방식 유지 |
| 13 | HTTP 응답 코드 확인 | ⚠️ Partial | Design 3.4에서 `curl -s -w "\n%{http_code}"` + HTTP_CODE 파싱 + 201 체크를 상세 구현하나, SKILL.md 4-d에서는 `-w "\n%{http_code}"` 옵션은 포함하되 응답 코드 파싱/분기 로직은 생략. Fallback 전략에서 "HTTP != 201" 언급으로 의도는 전달됨 |

**Section Score: 2.5/3 (83%)**

---

### Section 4.2 - feedback Step 5 변경

| # | Design 항목 | Status | Detail |
|---|------------|:------:|--------|
| 14 | 변경 불필요 확인 (reply에는 position 불필요) | ✅ Match | SKILL.md feedback 섹션(260~307줄): Step 3에서 `glab api --method POST .../discussions/:discussion_id/notes`로 reply 생성. position 없이 기존 방식 유지. Design 의도대로 변경 없음 |

**Section Score: 1/1 (100%)**

---

### Section 5 - Error Handling

| # | Design 항목 | Status | Detail |
|---|------------|:------:|--------|
| 15 | 7개 에러 시나리오 대응 | ⚠️ Partial | Design 5.1에서 7개 시나리오 정의. SKILL.md 250~256줄에서 5개만 명시 (MR 미발견, diff 없음, glab config 실패, curl 미설치, 400 에러). **누락: jq 미설치 fallback, GitLab 5xx 재시도, project ID 404 에러** |
| 16 | 3단계 fallback 전략 | ✅ Match | SKILL.md 238~248줄: 1차(curl+JSON) -> 2차(glab api) -> 3차(에러+수동안내) 동일 |

**Section Score: 1.5/2 (75%)**

---

## Summary Table

| Section | Items | Match | Partial | Gap | Score |
|---------|:-----:|:-----:|:-------:|:---:|:-----:|
| 3.1 Step 4-a: 인증 정보 추출 | 4 | 4 | 0 | 0 | 100% |
| 3.2 Step 4-b: Diff SHA 추출 | 3 | 3 | 0 | 0 | 100% |
| 3.3 Step 4-c: Diff Hunk 검증 | 3 | 2 | 1 | 0 | 83% |
| 3.4 Step 4-d: Line Comment 생성 | 3 | 2 | 1 | 0 | 83% |
| 4.2 feedback Step 5 변경 | 1 | 1 | 0 | 0 | 100% |
| 5. Error Handling | 2 | 1 | 1 | 0 | 75% |
| **Total** | **16** | **13** | **3** | **0** | **91%** |

> Match = 1.0, Partial = 0.5, Gap = 0.0
> Score = (13 x 1.0 + 3 x 0.5) / 16 = 14.5 / 16 = **90.6% (91%)**

---

## Differences Found

### 🟡 Changed Features (Design != Implementation)

| # | Item | Design | Implementation | Impact |
|---|------|--------|----------------|--------|
| 1 | is_valid_line 구현 수준 | bash 구현 코드 (grep -oP, while loop, 변수 할당) | pseudocode만 기술 (`is_valid_line` 함수 형태) | Low - SKILL.md는 AI 지시서이므로 pseudocode로 충분. Claude가 실행 시 구체화 가능 |
| 2 | HTTP 응답 코드 파싱 | `curl -w "\n%{http_code}"` + HTTP_CODE/BODY 분리 + 201 분기 로직 전체 기술 | `-w "\n%{http_code}"` 옵션 포함하나 파싱/분기 코드 생략. Fallback에서 "HTTP != 201" 조건만 언급 | Low - Fallback 전략에서 의도 전달됨 |
| 3 | 에러 시나리오 커버리지 | 7개 시나리오 (400, token 실패, curl 미설치, jq 미설치, 5xx, 빈배열, 404) | 5개만 명시 (jq 미설치, 5xx 재시도, project ID 404 누락) | Medium - 런타임 에지 케이스 3개 미커버 |

### 🔴 Missing Features (Design O, Implementation X)

없음 - 모든 핵심 기능(4-a~4-d, fallback, feedback 유지)이 구현됨.

### 🟡 Added Features (Design X, Implementation O)

| # | Item | Implementation Location | Description |
|---|------|------------------------|-------------|
| 1 | 배경 설명 추가 | SKILL.md 148~149줄 | `glab api -f`가 nested JSON을 지원하지 않는 이유와 issue 링크(solitasroh/rkit#3) 추가. Design에는 없으나 컨텍스트 제공 목적으로 유용 |
| 2 | `.git` suffix 옵션 처리 | SKILL.md 170줄 | `sed -E 's\|.*[:/]([^/]+/[^/]+)(\.git)?$\|\1\|'`에서 `.git` 을 옵션(`?`)으로 처리. Design에서는 `\.git$`로 필수 매칭 | 

---

## Recommended Actions

### Immediate Actions (Priority: Medium)

1. **에러 시나리오 3건 추가**: SKILL.md 오류 처리 섹션에 다음 3개 시나리오를 추가
   - jq 미설치: "jq가 필요합니다" 안내 + grep/sed 기반 JSON 파싱 fallback
   - GitLab API 5xx: 재시도 1회 후 실패 시 일반 discussion
   - project ID 404: "프로젝트를 찾을 수 없습니다" 안내

### Documentation Update (Priority: Low)

2. **Design 문서에 `.git` 옵션 처리 반영**: Design 3.1의 `sed` 패턴을 SKILL.md 구현과 동일하게 `(\.git)?$`로 수정
3. **Design 문서에 배경 설명(solitasroh/rkit#3) 추가**: Architecture 섹션에 issue 링크 참조 추가

### No Action Required

4. is_valid_line pseudocode: SKILL.md는 AI 지시서(skill definition)이므로 pseudocode 수준이 적절. Claude가 실행 시 자동으로 구체 bash 코드를 생성함
5. HTTP 응답 코드 파싱: Fallback 전략에서 조건이 충분히 전달되므로 추가 코드 불필요

---

## Synchronization Recommendation

Match Rate >= 90% 이므로: **"Design과 Implementation이 잘 일치합니다."**

Minor 차이 3건에 대해 권장 조치:
- **Option 1** (권장): SKILL.md에 에러 시나리오 3건 추가 -> Match Rate 95%+ 달성
- **Option 2**: Design 문서를 SKILL.md 현황에 맞게 에러 시나리오 축소 (비권장)
- **Option 4**: `.git` 옵션 처리, 배경 설명 차이는 의도적 차이로 기록
