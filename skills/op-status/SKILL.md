---
name: op-status
classification: workflow
classification-reason: OpenProject MCP 도구를 사용한 구조화된 프로젝트 현황 조회
description: |
  OpenProject 프로젝트 현황을 요약합니다.
  프로젝트별 열린 작업 수, 기한 초과 작업을 표 형태로 보여줍니다.
  인자 없이 실행하면 전체 프로젝트, 인자가 있으면 해당 프로젝트만 조회합니다.

  Triggers: op-status, 프로젝트 현황, project status, 작업 현황, 기한 초과,
  overdue, 열린 작업, open tasks, OP 현황
user-invocable: true
argument-hint: "[project-identifier]"
---

# op-status — 프로젝트 현황 조회

OpenProject MCP 도구를 사용하여 프로젝트 현황을 조회하고 요약하라.

## 절차

1. `list_projects`로 프로젝트 목록을 조회한다.
   - 인자가 주어지면 해당 identifier/name과 일치하는 프로젝트만 필터링한다.
   - 프로젝트가 0개이면 아래 메시지를 출력하고 종료:
     "등록된 프로젝트가 없거나 접근 권한이 없습니다. /mcp 명령으로 서버 연결 상태를 확인하세요."

2. 각 프로젝트에 대해 `list_work_packages`를 호출한다.
   - 필터: status가 Closed/Rejected가 아닌 작업 (열린 상태)
   - 상태 이름은 `list_statuses`로 조회하여 확인한다.
   - 프로젝트가 10개를 초과하면:
     열린 작업이 많은 상위 10개만 표시하고
     "전체 {N}개 프로젝트 중 열린 작업이 많은 상위 10개를 표시합니다." 안내를 추가한다.

3. 기한 초과 판정: due_date가 오늘 날짜보다 이전이고 status가 열린 상태인 작업.

## 오류 처리

- MCP 도구 호출 실패 (연결 오류):
  "OpenProject MCP 서버에 연결할 수 없습니다. /mcp 명령으로 서버 상태를 확인하세요."
- 인증 오류 (401):
  "API 키가 유효하지 않습니다. 플러그인을 재설치하여 API 키를 다시 입력하세요."
- 권한 오류 (403):
  "해당 프로젝트에 대한 접근 권한이 없습니다. OpenProject 관리자에게 권한을 요청하세요."

## 출력 형식

### 정상 결과

| 프로젝트 | 식별자 | 열린 작업 | 기한 초과 | 최근 업데이트 |
|----------|--------|-----------|-----------|---------------|
| {name} | {identifier} | {count}개 | **{overdue}건** | {updated_at} |

기한 초과가 0이면 "없음"으로 표시. 1건 이상이면 굵게(**N건**) 표시.

### 기한 초과 상세 (기한 초과 작업이 1건 이상일 때)

테이블 아래에 상세 목록을 추가한다:

**기한 초과 작업 상세:**
- [#{id}] {subject} (기한: {due_date}, 담당: {assignee}, 프로젝트: {project})
