# mr-line-comment-fix Design Document

> **Summary**: `/mr review` line comment의 glab api → curl + JSON body 전환 상세 설계
>
> **Project**: rkit
> **Version**: 0.9.13
> **Author**: 노수장
> **Date**: 2026-04-10
> **Status**: Draft
> **Planning Doc**: [mr-line-comment-fix.plan.md](../../01-plan/features/mr-line-comment-fix.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. `/mr review` Step 4에서 생성되는 discussion이 GitLab MR Changes 탭의 **정확한 코드 라인**에 부착되도록 한다
2. glab CLI 의존성을 최소화하면서 GitLab REST API를 직접 호출하는 안전한 패턴을 확립한다
3. 기존 glab api 기반 기능(resolve, reply 등)과의 호환성을 유지한다

### 1.2 Design Principles

- **최소 변경**: SKILL.md의 review Step 4와 feedback Step 5만 수정, 나머지 유지
- **Graceful Fallback**: curl/position 실패 시 일반 discussion으로 fallback
- **보안 우선**: TOKEN을 명령줄 argument로 노출하지 않음 (환경변수 또는 -H 헤더 사용)

---

## 2. Architecture

### 2.1 현재 구조 (문제)

```
/mr review Step 4
    │
    ▼
glab api --method POST "projects/:id/merge_requests/:iid/discussions"
  --field body="..."
  --field "position[base_sha]=..."    ← glab이 nested field를 무시
  --field "position[new_line]=42"     ← position: null로 전달됨
    │
    ▼
GitLab API: position=null → 일반 discussion 생성 (라인 미부착)
```

### 2.2 변경 후 구조 (해결)

```
/mr review Step 4
    │
    ├─── Step 4-a: GitLab 인증 정보 추출
    │      glab config에서 host, token 추출
    │
    ├─── Step 4-b: Diff SHA 추출
    │      GET /projects/:id/merge_requests/:iid/versions
    │      → base_commit_sha, head_commit_sha, start_commit_sha
    │
    ├─── Step 4-c: Diff hunk 범위 검증
    │      glab mr diff :iid → @@ hunk header 파싱
    │      → 각 comment의 new_line이 유효 범위인지 검증
    │
    └─── Step 4-d: Line comment 생성
           curl -s -X POST ".../discussions"
             -H "PRIVATE-TOKEN: $TOKEN"
             -H "Content-Type: application/json"
             -d '{"body":"...", "position":{...}}'
           │
           ├─ 성공 → line comment (Changes 탭에 표시)
           └─ 실패 → fallback: glab api -f body="..." (일반 discussion)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| Step 4-a (인증 추출) | glab CLI config | GitLab host URL, private token |
| Step 4-b (SHA 추출) | GitLab MR versions API | position에 필요한 3개 SHA |
| Step 4-c (hunk 검증) | glab mr diff | diff hunk에서 유효 라인 범위 추출 |
| Step 4-d (curl 호출) | curl, jq | JSON body 구성 및 API 호출 |

---

## 3. 상세 설계

### 3.1 Step 4-a: GitLab 인증 정보 추출

glab CLI의 설정 파일에서 현재 인증된 GitLab 인스턴스의 host와 token을 추출한다.

#### 방법 1: `glab auth status` 파싱 (권장)

```bash
# host 추출
GITLAB_HOST=$(glab auth status 2>&1 | grep -oP 'Logged in to \K[^\s]+')

# token은 config 파일에서 직접 추출
# Linux/macOS: ~/.config/glab-cli/config.yml
# Windows: %APPDATA%/glab-cli/config.yml
```

#### 방법 2: glab config 파일 직접 파싱

```yaml
# ~/.config/glab-cli/config.yml 구조
hosts:
  10.10.20.32:
    token: glpat-xxxxxxxxxxxx
    api_host: 10.10.20.32
    api_protocol: http
    git_protocol: ssh
```

```bash
# config 파일 경로 결정
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
  GLAB_CONFIG="$APPDATA/glab-cli/config.yml"
else
  GLAB_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/glab-cli/config.yml"
fi

# host/token/protocol 추출 (첫 번째 호스트 기준)
GITLAB_HOST=$(grep -A1 'hosts:' "$GLAB_CONFIG" | tail -1 | sed 's/[: ]//g')
GITLAB_TOKEN=$(grep -A5 "$GITLAB_HOST:" "$GLAB_CONFIG" | grep 'token:' | awk '{print $2}')
API_PROTOCOL=$(grep -A5 "$GITLAB_HOST:" "$GLAB_CONFIG" | grep 'api_protocol:' | awk '{print $2}')
GITLAB_URL="${API_PROTOCOL:-https}://${GITLAB_HOST}"
```

#### 프로젝트 ID 추출

```bash
# git remote에서 프로젝트 경로 추출 후 URL-encode
PROJECT_PATH=$(git remote get-url origin | sed -E 's|.*[:/]([^/]+/[^/]+)\.git$|\1|')
PROJECT_ID=$(curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "${GITLAB_URL}/api/v4/projects/$(echo $PROJECT_PATH | sed 's|/|%2F|g')" | jq -r '.id')
```

### 3.2 Step 4-b: Diff SHA 추출

GitLab MR versions API로 position에 필요한 3개 SHA를 추출한다.

```bash
# MR diff versions 조회
VERSIONS=$(curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "${GITLAB_URL}/api/v4/projects/${PROJECT_ID}/merge_requests/${MR_IID}/versions")

# 최신 version (배열의 첫 번째)에서 SHA 추출
BASE_SHA=$(echo "$VERSIONS" | jq -r '.[0].base_commit_sha')
HEAD_SHA=$(echo "$VERSIONS" | jq -r '.[0].head_commit_sha')
START_SHA=$(echo "$VERSIONS" | jq -r '.[0].start_commit_sha')
```

### 3.3 Step 4-c: Diff Hunk 범위 검증

각 comment의 `new_line`이 diff hunk의 유효 범위 내에 있는지 검증한다.

```bash
# diff에서 특정 파일의 hunk 범위 추출
# @@ -old_start,old_count +new_start,new_count @@ context
glab mr diff ${MR_IID} | grep -E "^(diff --git|\@\@)" | \
  while read line; do
    if [[ "$line" == "diff --git"* ]]; then
      CURRENT_FILE=$(echo "$line" | sed 's|.*b/||')
    elif [[ "$line" == "@@"* ]]; then
      # +new_start,new_count 추출
      NEW_RANGE=$(echo "$line" | grep -oP '\+\K[0-9]+(,[0-9]+)?')
      NEW_START=$(echo "$NEW_RANGE" | cut -d, -f1)
      NEW_COUNT=$(echo "$NEW_RANGE" | cut -d, -f2)
      NEW_END=$((NEW_START + ${NEW_COUNT:-1} - 1))
      echo "$CURRENT_FILE: valid range $NEW_START-$NEW_END"
    fi
  done
```

#### 검증 로직

```
is_valid_line(file, new_line):
  hunks = get_diff_hunks(file)
  for each hunk in hunks:
    if hunk.new_start <= new_line <= hunk.new_end:
      return true
  return false
```

- 유효 → line comment 생성 (position 포함)
- 무효 → fallback: 일반 discussion 생성 (body에 파일:라인 명시)

### 3.4 Step 4-d: Line Comment 생성 (curl)

```bash
# JSON body 구성
JSON_BODY=$(cat <<EOF
{
  "body": "${COMMENT_BODY}",
  "position": {
    "base_sha": "${BASE_SHA}",
    "start_sha": "${START_SHA}",
    "head_sha": "${HEAD_SHA}",
    "position_type": "text",
    "old_path": "${FILE_PATH}",
    "new_path": "${FILE_PATH}",
    "new_line": ${LINE_NUMBER}
  }
}
EOF
)

# API 호출
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${GITLAB_URL}/api/v4/projects/${PROJECT_ID}/merge_requests/${MR_IID}/discussions" \
  -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "201" ]]; then
  echo "Line comment 생성 성공: ${FILE_PATH}:${LINE_NUMBER}"
else
  echo "Line comment 실패 (HTTP $HTTP_CODE), fallback으로 일반 discussion 생성"
  # fallback: 일반 discussion
  glab api --method POST \
    "projects/:id/merge_requests/:iid/discussions" \
    --field body="[${FILE_PATH}:${LINE_NUMBER}] ${COMMENT_BODY}"
fi
```

---

## 4. SKILL.md 변경 사항

### 4.1 review Step 4 변경

**Before** (현재):
```markdown
#### Step 4: Discussion 생성 (사용자 확인 후)

리뷰어가 확인/수정한 comment를 GitLab discussion으로 생성한다:

\```bash
glab api --method POST \
  "projects/:id/merge_requests/:iid/discussions" \
  --field body="issue (blocking, safety): ISR 내 HAL_Delay() 사용 금지..."
\```
```

**After** (변경):
```markdown
#### Step 4: Line Comment Discussion 생성 (사용자 확인 후)

리뷰어가 확인/수정한 comment를 GitLab discussion으로 생성한다.
**파일:라인 정보가 있는 comment는 line comment로 생성**하여 Changes 탭에 표시한다.

##### Step 4-a: GitLab 인증 정보 추출

glab config에서 host, token, project ID를 추출한다:

\```bash
GLAB_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/glab-cli/config.yml"
GITLAB_HOST=$(grep -A1 'hosts:' "$GLAB_CONFIG" | tail -1 | sed 's/[: ]//g')
GITLAB_TOKEN=$(grep -A5 "$GITLAB_HOST:" "$GLAB_CONFIG" | grep 'token:' | awk '{print $2}')
API_PROTOCOL=$(grep -A5 "$GITLAB_HOST:" "$GLAB_CONFIG" | grep 'api_protocol:' | awk '{print $2}')
GITLAB_URL="${API_PROTOCOL:-https}://${GITLAB_HOST}"
PROJECT_PATH=$(git remote get-url origin | sed -E 's|.*[:/]([^/]+/[^/]+)\.git$|\1|')
PROJECT_ID=$(curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "${GITLAB_URL}/api/v4/projects/$(echo $PROJECT_PATH | sed 's|/|%2F|g')" | jq -r '.id')
\```

##### Step 4-b: Diff SHA 추출

\```bash
VERSIONS=$(curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "${GITLAB_URL}/api/v4/projects/${PROJECT_ID}/merge_requests/${MR_IID}/versions")
BASE_SHA=$(echo "$VERSIONS" | jq -r '.[0].base_commit_sha')
HEAD_SHA=$(echo "$VERSIONS" | jq -r '.[0].head_commit_sha')
START_SHA=$(echo "$VERSIONS" | jq -r '.[0].start_commit_sha')
\```

##### Step 4-c: Diff Hunk 범위 검증

\```bash
glab mr diff ${MR_IID}
\```

diff hunk header(`@@ -a,b +c,d @@`)를 파싱하여 각 comment의 new_line이
유효 범위 내에 있는지 검증한다. 범위 밖이면 fallback으로 일반 discussion 생성.

##### Step 4-d: Comment 생성

**파일:라인 정보가 있는 comment → curl + JSON body (line comment)**:

\```bash
curl -s -X POST "${GITLAB_URL}/api/v4/projects/${PROJECT_ID}/merge_requests/${MR_IID}/discussions" \
  -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "issue (blocking, safety): ISR 내 HAL_Delay() 사용 금지...",
    "position": {
      "base_sha": "'$BASE_SHA'",
      "start_sha": "'$START_SHA'",
      "head_sha": "'$HEAD_SHA'",
      "position_type": "text",
      "old_path": "src/uart.c",
      "new_path": "src/uart.c",
      "new_line": 42
    }
  }'
\```

**파일:라인 정보가 없는 comment → 기존 glab api (일반 discussion)**:

\```bash
glab api --method POST \
  "projects/:id/merge_requests/:iid/discussions" \
  --field body="praise: DMA 더블 버퍼링 구현이 교과서적입니다."
\```

**curl 실패 시 fallback** → body에 `[파일:라인]` prefix 추가 후 일반 discussion 생성.
```

### 4.2 feedback Step 5 변경

**feedback Step 3의 thread reply**는 기존 `glab api` 유지 (position 불필요, note 추가만):

```bash
glab api --method POST \
  "projects/:id/merge_requests/:iid/discussions/:discussion_id/notes" \
  --field body="Fixed in {commit-hash}. {수정 설명}"
```

> feedback에서는 기존 discussion에 reply를 추가하는 것이므로 position이 필요 없다.
> 따라서 **feedback Step 5는 변경 불필요**. Plan의 FR-05는 분석 결과 해당 없음으로 변경.

---

## 5. Error Handling

### 5.1 에러 시나리오 및 대응

| 시나리오 | HTTP Code | 대응 |
|----------|-----------|------|
| position의 line이 diff 범위 밖 | 400 | fallback: 일반 discussion + `[file:line]` prefix |
| glab config에서 token 추출 실패 | N/A | "glab auth login으로 인증하세요" 안내 |
| curl 미설치 | N/A | "curl이 필요합니다" 안내, glab api fallback |
| jq 미설치 | N/A | grep/sed 기반 JSON 파싱 fallback |
| GitLab API 응답 오류 (5xx) | 500+ | 재시도 1회 후 실패 시 일반 discussion |
| MR versions API 빈 배열 | 200 | "diff version이 없습니다" 안내, 일반 discussion |
| project ID 조회 실패 | 404 | "프로젝트를 찾을 수 없습니다" 안내 |

### 5.2 Fallback 전략 (3단계)

```
1차: curl + JSON body (line comment)
  │ 실패
  ▼
2차: glab api -f body="[file:line] ..." (일반 discussion, 위치 명시)
  │ 실패
  ▼
3차: 에러 메시지 출력 + 수동 생성 안내
```

---

## 6. Security Considerations

- [x] TOKEN을 curl `-H` 헤더로 전달 (명령줄 argument 아닌 헤더)
- [x] `ps aux`에 TOKEN 노출 방지: `-H "PRIVATE-TOKEN: $TOKEN"` 사용
- [x] glab config 파일 읽기 권한 확인 (600 permission)
- [x] JSON body의 사용자 입력(comment body) escape 처리

---

## 7. Test Plan

### 7.1 Test Scope

| Type | Target | Method |
|------|--------|--------|
| 수동 검증 | 실제 GitLab MR에 line comment 생성 | curl 명령 직접 실행 |
| 수동 검증 | fallback 동작 (잘못된 line number) | 범위 밖 line으로 테스트 |
| 수동 검증 | glab config 파싱 (Linux/Windows) | OS별 경로 확인 |

### 7.2 Test Cases

- [ ] Happy path: `/mr review`로 line comment가 Changes 탭에 정확히 표시됨
- [ ] Fallback: diff 범위 밖 line → 일반 discussion으로 생성됨
- [ ] 인증 실패: token 만료 시 적절한 에러 메시지 출력
- [ ] praise comment (파일:라인 없음): 기존 glab api로 일반 discussion 생성
- [ ] Windows 환경: APPDATA 경로에서 glab config 정상 파싱

---

## 8. Implementation Order

1. [ ] SKILL.md `review` Step 4를 4개 sub-step(4-a~4-d)으로 분리 및 재작성
2. [ ] glab config 파싱 로직 (Step 4-a) — OS별 경로 처리 포함
3. [ ] diff versions API SHA 추출 (Step 4-b)
4. [ ] diff hunk 범위 검증 (Step 4-c)
5. [ ] curl + JSON body line comment 생성 (Step 4-d) + fallback
6. [ ] feedback Step 5: 변경 불필요 확인 (FR-05 제외 문서화)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-10 | Initial draft | 노수장 |
