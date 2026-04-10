# mr-line-comment-fix Planning Document

> **Summary**: GitLab MR line comment 생성 시 `glab api -f`의 nested field 미지원 문제를 `curl` 기반으로 해결
>
> **Project**: rkit
> **Version**: 0.9.13
> **Author**: 노수장
> **Date**: 2026-04-10
> **Status**: Draft
> **Issue**: solitasroh/rkit#3

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | `glab api -f`가 nested JSON field(`position[new_line]` 등)를 지원하지 않아, MR line comment의 position이 무시되고 일반 discussion으로 생성됨 |
| **Solution** | `/mr review` Step 4와 `/mr feedback` Step 5의 discussion 생성 로직을 `glab api -f` → `curl -X POST` + JSON body 방식으로 변경 |
| **Function/UX Effect** | 리뷰어가 생성한 comment가 Changes 탭의 정확한 코드 라인에 표시되어, 코드 리뷰 효율이 크게 향상됨 |
| **Core Value** | AI 코드 리뷰 결과가 실제 코드 위치에 연결되어, MR 스킬의 핵심 가치인 "정확한 라인 리뷰"가 완성됨 |

---

## 1. Overview

### 1.1 Purpose

`/mr review`에서 AI가 생성한 코드 리뷰 comment를 GitLab MR의 **정확한 코드 라인**에 부착하는 기능을 복원한다. 현재 `glab api -f` 플래그의 한계로 인해 모든 comment가 일반 discussion으로 생성되어, 리뷰어와 개발자가 어떤 코드를 지적하는지 직관적으로 파악할 수 없다.

### 1.2 Background

- **glab CLI v1.46.1**의 `-f/--field` 플래그는 flat key=value만 지원
- GitLab `/discussions` API의 `position` 파라미터는 nested JSON object 형식 필수
- `position[new_line]` 등 bracket notation이 nested object로 변환되지 않아 position이 null로 처리됨
- `curl` + JSON body 방식으로는 정상 동작이 이미 확인됨 (Issue #3 재현 결과)

### 1.3 Related Documents

- Issue: solitasroh/rkit#3
- Skill: `skills/mr/SKILL.md`
- Template: `templates/mr-review-comment.template.md`

---

## 2. Scope

### 2.1 In Scope

- [x] `/mr review` Step 4: Discussion 생성 로직을 curl 기반으로 변경
- [x] `/mr feedback` Step 5: Thread reply에서 position이 필요한 경우 curl 기반으로 변경
- [x] glab config에서 GitLab URL/TOKEN 추출 로직 추가
- [x] diff version API로 SHA 값(base_sha, start_sha, head_sha) 자동 추출
- [x] diff hunk 범위 검증 로직 추가 (유효하지 않은 line number 방지)

### 2.2 Out of Scope

- `/mr verify` Step 4: Resolve (position 불필요, 기존 glab api 유지)
- `/mr create`, `/mr status`, `/mr approve`, `/mr merge` (영향 없음)
- glab CLI 자체의 nested field 지원 패치 (upstream 이슈)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `/mr review` Step 4에서 line comment 생성 시 curl + JSON body 사용 | High | Pending |
| FR-02 | glab config(`~/.config/glab-cli/config.yml`)에서 host/token 자동 추출 | High | Pending |
| FR-03 | `projects/:id/merge_requests/:iid/versions` API로 diff SHA 자동 추출 | High | Pending |
| FR-04 | diff hunk header(`@@ -a,b +c,d @@`) 파싱으로 유효 라인 범위 검증 | Medium | Pending |
| FR-05 | `/mr feedback` Step 5에서 position 포함 reply 시 curl 사용 | Medium | Pending |
| FR-06 | position이 유효하지 않은 경우 fallback으로 일반 discussion 생성 | Low | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 호환성 | glab CLI v1.40+ 환경에서 동작 | glab version 확인 |
| 호환성 | GitLab CE/EE self-hosted 및 gitlab.com 모두 지원 | URL 패턴 자동 감지 |
| 보안 | TOKEN이 curl 명령에 노출되지 않도록 stdin 또는 환경변수 사용 | 코드 리뷰 |
| 안정성 | curl 실패 시 glab api fallback (일반 discussion) | 에러 핸들링 검증 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `/mr review`로 생성된 comment가 GitLab MR Changes 탭의 정확한 라인에 표시됨
- [ ] glab config에서 자동으로 host/token을 추출하여 curl 호출 성공
- [ ] diff SHA가 자동 추출되어 수동 입력 불필요
- [ ] diff hunk 범위 밖 라인에 대해 fallback 처리됨

### 4.2 Quality Criteria

- [ ] SKILL.md 내 변경된 Step의 코드 예시가 정확히 동작
- [ ] 기존 glab api 기반 기능(resolve, reply 등)에 영향 없음
- [ ] TOKEN 노출 없는 안전한 curl 호출

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| glab config 파일 경로가 OS별로 다름 | Medium | Medium | Linux/macOS/Windows 경로 모두 확인, `glab config get` 명령 우선 사용 |
| GitLab API 버전에 따라 position 스키마 차이 | Low | Low | GitLab 13.0+ 기준으로 구현 (대부분의 self-hosted 포함) |
| diff hunk 파싱 실패 시 잘못된 line number 전달 | Medium | Medium | 파싱 실패 시 fallback으로 일반 discussion 생성 |
| curl이 설치되지 않은 환경 | Low | Low | Windows에서도 Git Bash/WSL에 curl 포함, 미설치 시 안내 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | ☐ |
| **Dynamic** | Feature-based modules | Web apps | ☐ |
| **Enterprise** | Strict layer separation | Complex architectures | ☐ |

> N/A - rkit 플러그인 내부 스킬 수정이므로 프로젝트 레벨 선택 불필요

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| API 호출 방식 | glab api -f / curl + JSON / glab api --input | curl + JSON | glab api -f는 nested field 미지원, --input은 버전 의존성 높음 |
| Token 추출 | glab config 파일 직접 파싱 / `glab auth status` 파싱 | glab config 파일 파싱 | 안정적이고 프로그래매틱한 접근 |
| SHA 추출 | MR versions API / git rev-parse | MR versions API | GitLab 서버 기준 SHA가 정확 |
| 라인 검증 | diff hunk 파싱 / 검증 없이 전송 후 에러 처리 | diff hunk 파싱 | 400 에러 사전 방지 |

### 6.3 변경 대상 파일

```
skills/mr/SKILL.md
├── review [MR-IID] → Step 4: Discussion 생성 로직 변경
│   - glab api -f → curl -X POST + JSON body
│   - diff SHA 추출 로직 추가
│   - diff hunk 검증 로직 추가
└── feedback [MR-IID] → Step 5: position 포함 reply 시 curl 사용
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` has coding conventions section
- [x] rkit 스킬 작성 규칙 (`skills/*/SKILL.md` 형식)
- [x] Conventional Comments 형식 (`templates/mr-review-comment.template.md`)

### 7.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **curl 호출 패턴** | missing | glab config 기반 curl 호출 표준 패턴 | High |
| **에러 핸들링** | exists (glab 기반) | curl HTTP 응답 코드별 처리 패턴 | Medium |
| **fallback 전략** | missing | curl 실패 시 glab api fallback 규칙 | Medium |

---

## 8. Implementation Strategy

### 8.1 curl 호출 패턴 (핵심)

```bash
# 1. glab config에서 token/host 추출
GITLAB_HOST=$(grep -A5 "hosts:" ~/.config/glab-cli/config.yml | grep -oP '^\s+\K[^:]+' | head -1)
GITLAB_TOKEN=$(grep -A2 "$GITLAB_HOST" ~/.config/glab-cli/config.yml | grep token | awk '{print $2}')

# 2. diff versions에서 SHA 추출
VERSIONS=$(curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "${GITLAB_URL}/api/v4/projects/${PROJECT_ID}/merge_requests/${MR_IID}/versions")
BASE_SHA=$(echo "$VERSIONS" | jq -r '.[0].base_commit_sha')
HEAD_SHA=$(echo "$VERSIONS" | jq -r '.[0].head_commit_sha')
START_SHA=$(echo "$VERSIONS" | jq -r '.[0].start_commit_sha')

# 3. line comment 생성 (curl + JSON body)
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
```

### 8.2 구현 순서

1. SKILL.md의 `review` Step 4 로직 변경 (curl 기반 line comment)
2. glab config 추출 로직 문서화
3. diff versions API SHA 추출 로직 문서화
4. diff hunk 범위 검증 로직 추가
5. `feedback` Step 5 로직 변경 (position 포함 reply)
6. fallback 처리 (curl 실패 → 일반 discussion)

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`mr-line-comment-fix.design.md`)
2. [ ] SKILL.md 수정 구현
3. [ ] 실제 GitLab MR에서 테스트

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-10 | Initial draft (Issue #3 기반) | 노수장 |
