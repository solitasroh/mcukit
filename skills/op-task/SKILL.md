---
name: op-task
classification: workflow
classification-reason: OpenProject MCP 도구를 사용한 구조화된 태스크 관리 워크플로
description: |
  OpenProject 태스크를 조회하고 관리합니다.
  상태 변경, comment 추가, 시간 기록, 담당자 변경을 지원합니다.
  "my"를 인자로 주면 본인 할당 태스크 목록을 조회합니다.

  Triggers: op-task, 태스크 조회, 작업 상세, task detail, OP #,
  상태 변경, 완료 처리, 시간 기록, time entry, comment 추가,
  내 작업, my tasks, 할당된 작업, 내 할일
user-invocable: true
argument-hint: "[work-package-id or 'my']"
---

# op-task — 태스크 관리

OpenProject MCP 도구를 사용하여 태스크를 조회하고 관리한다.

## 사용법

- `/op-task 1234` — 태스크 #1234 상세 조회
- `/op-task my` — 내 할당 태스크 목록
- "OP #1234 완료 처리해줘" — 자연어 상태 변경
- "시간 2시간 기록해줘" — 자연어 시간 기록

## 절차

### 태스크 상세 조회 (인자: work-package-id)

1. `get_work_package` (또는 `search_work_packages`)로 태스크를 조회한다.
   - 숫자 ID: 직접 조회
   - 텍스트: `search_work_packages`로 검색

2. 상세 정보를 테이블로 출력한다:

   | 항목 | 값 |
   |------|-----|
   | ID | #{id} |
   | 프로젝트 | {project} |
   | 제목 | {subject} |
   | 유형 | {type} |
   | 상태 | {status} |
   | 우선순위 | {priority} |
   | 담당자 | {assignee} |
   | 시작일 | {start_date} |
   | 기한 | {due_date} |
   | 완료율 | {percentageDone}% |

3. 설명이 있으면 요약하여 표시한다.

4. 다음 동작을 제안한다:
   "상태 변경 / comment 추가 / 시간 기록 / PDCA 시작 중 원하시는 게 있나요?"

### 내 할당 태스크 (인자: 'my')

1. `list_work_packages`로 조회한다 (filter: assignee=current user, status=open).
2. 목록을 테이블로 출력한다:

   | # | 프로젝트 | 제목 | 유형 | 우선순위 | 기한 |
   |---|---------|------|------|---------|------|
   | #{id} | {project} | {subject} | {type} | {priority} | {due_date} |

3. 기한 초과 태스크는 기한을 **굵게** 표시한다.
4. 태스크가 0개이면: "할당된 열린 작업이 없습니다." 출력.

### 상태 변경

사용자가 상태 변경을 요청하면:

1. `list_statuses`로 가용 상태 목록을 조회한다.
2. 사용자에게 변경할 상태를 선택하게 한다.
3. comment에 변경 사유를 입력받는다 (**팀 규칙**: 상태 변경 시 comment 필수).
4. `update_work_package`로 상태를 변경한다 (status_id + comment).
5. 결과를 출력한다: "태스크 #{id} 상태가 {old_status} → {new_status}로 변경되었습니다."

### comment 추가

사용자가 comment 추가를 요청하면:

1. 사용자에게 comment 내용을 입력받는다.
2. `update_work_package`로 comment를 추가한다.
3. 결과를 출력한다: "태스크 #{id}에 comment가 추가되었습니다."

### 시간 기록

사용자가 시간 기록을 요청하면:

1. `list_time_entry_activities`로 활동 유형 목록을 조회한다.
2. 아래 정보를 입력받는다:
   - 시간 (hours): 0.5 단위 권장
   - 활동 유형: 목록에서 선택
   - 날짜 (spent_on): 기본값 오늘, YYYY-MM-DD 형식
   - comment: 수행한 작업 내용 (필수)
3. `create_time_entry`로 시간을 기록한다.
4. 결과를 출력한다: "태스크 #{id}에 {hours}시간이 기록되었습니다. ({activity_type})"

## PDCA 연동

태스크 상세 조회 후 사용자가 "PDCA 시작"을 선택하면:

- Bug 태스크: description의 재현 절차·예상/실제 결과를 PDCA Plan 컨텍스트로 전달
- Feature/Task 태스크: subject + description을 Plan 요구사항 컨텍스트로 전달
- `/pdca plan {feature-name}` 실행을 안내 (feature-name은 OP subject 기반)

PDCA Report 완료 후 OP 태스크가 연결되어 있으면:
- "OP 태스크 #{id}를 Closed로 변경하시겠습니까?" 제안
- "시간을 기록하시겠습니까?" 제안

## 오류 처리

- MCP 연결 오류: "OpenProject MCP 서버에 연결할 수 없습니다. /mcp 명령으로 서버 상태를 확인하세요."
- 인증 오류 (401): "API 키가 유효하지 않습니다. 플러그인을 재설치하여 API 키를 다시 입력하세요."
- 권한 오류 (403): "해당 태스크에 대한 접근 권한이 없습니다. OpenProject 관리자에게 권한을 요청하세요."
- 태스크 미발견 (404): "태스크 #{id}를 찾을 수 없습니다. 번호를 확인해주세요."
