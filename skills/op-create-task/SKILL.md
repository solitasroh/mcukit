---
name: op-create-task
classification: workflow
classification-reason: OpenProject MCP 도구를 사용한 구조화된 태스크 생성 워크플로
description: |
  OpenProject에 새 작업 패키지를 대화형으로 생성합니다.
  프로젝트, 유형, 우선순위, 담당자를 MCP 도구로 조회하여 선택하고,
  팀 규칙(담당자 필수, Bug는 재현 절차 포함)을 자동 적용합니다.

  Triggers: op-create-task, 태스크 생성, 작업 생성, create task, 새 작업,
  OP 태스크 만들어, work package 생성, 작업 만들어줘
user-invocable: true
argument-hint: "[project-identifier]"
---

# op-create-task — 태스크 생성

OpenProject MCP 도구를 사용하여 대화형으로 작업 패키지를 생성하라.

## PDCA 연동

PDCA Plan이 활성화되어 있으면:
- Plan 문서의 제목을 subject 기본값으로 제안
- Plan Executive Summary를 description에 포함 제안
- Feature 신규 개발: type=Feature 제안, 리팩토링/개선: type=Task 제안

## 절차

### Step 1: 프로젝트 선택

- 인자가 주어지면 해당 프로젝트를 사용한다.
- 인자가 없으면 `list_projects`로 목록을 조회하여 사용자에게 선택하게 한다.
- 프로젝트가 0개이면: "접근 가능한 프로젝트가 없습니다." 출력 후 종료.

### Step 2: 제목 입력

- 사용자에게 작업 패키지 제목(subject)을 입력받는다.
- PDCA Plan이 활성화되어 있으면 Plan 제목을 기본값으로 제안한다.
- **검증**: 빈 문자열이면 "제목은 필수입니다. 다시 입력해주세요." 안내.

### Step 3: 유형 선택

- `list_types`로 유형 목록을 조회하여 사용자에게 선택하게 한다.
- **Bug 유형 선택 시**: Step 7(설명)에서 재현 절차 템플릿을 자동 안내한다.

### Step 4: 우선순위 선택

- `list_priorities`로 우선순위 목록을 조회하여 사용자에게 선택하게 한다.

### Step 5: 담당자 선택 (필수)

- `list_users`로 사용자 목록을 조회하여 선택하게 한다.
- **팀 규칙**: 담당자는 반드시 지정해야 한다. 미지정은 허용하지 않는다.
- "팀 규칙에 따라 담당자는 필수입니다. 목록에서 선택해주세요." 안내.

### Step 6: 날짜 입력 (선택)

- 시작일과 종료일을 입력받는다. 입력하지 않으면 미설정.
- **형식 검증**: YYYY-MM-DD 형식이 아니면 "날짜는 YYYY-MM-DD 형식으로 입력해주세요. (예: 2026-04-15)" 안내.

### Step 7: 설명 입력 (선택, Bug일 때 필수)

- Bug 유형이 아니면: 설명을 선택적으로 입력받는다.
- PDCA Plan이 있으면 Executive Summary를 description에 포함할지 제안한다.
- **Bug 유형이면**: 아래 재현 절차 템플릿을 먼저 보여주고 입력을 요청한다:

  ```
  팀 규칙에 따라 Bug 유형은 재현 절차를 포함해야 합니다.
  아래 양식을 참고하여 설명을 작성해주세요:

  ## 재현 절차
  1. ...
  2. ...

  ## 예상 결과
  - ...

  ## 실제 결과
  - ...

  ## 환경
  - OS:
  - 버전:
  ```

### Step 8: 생성 실행

- 위 입력값을 아래 파라미터 매핑에 따라 `create_work_package`를 호출한다.

## 파라미터 매핑

| 사용자 입력 | API 파라미터 | 타입 | 필수 |
|-------------|-------------|------|:----:|
| 프로젝트 선택 | project_id | integer | O |
| 제목 | subject | string | O |
| 유형 선택 | type_id | integer | O |
| 우선순위 선택 | priority_id | integer | O |
| 담당자 선택 | assignee_id | integer | O |
| 시작일 | start_date | string (YYYY-MM-DD) | X |
| 종료일 | due_date | string (YYYY-MM-DD) | X |
| 설명 | description | string (markdown) | Bug만 필수 |

## 오류 처리

- MCP 도구 호출 실패 (연결 오류):
  "OpenProject MCP 서버에 연결할 수 없습니다. /mcp 명령으로 서버 상태를 확인하세요."
- 인증 오류 (401):
  "API 키가 유효하지 않습니다. 플러그인을 재설치하여 API 키를 다시 입력하세요."
- 권한 오류 (403):
  "작업 패키지 생성 권한이 없습니다. OpenProject 관리자에게 권한을 요청하세요."
- 생성 실패 (400):
  "입력값에 오류가 있습니다. 오류 메시지: {error_message}"

## 출력 형식

### 성공 시

작업 패키지가 생성되었습니다:

| 항목 | 값 |
|------|-----|
| ID | #{id} |
| 프로젝트 | {project_name} |
| 제목 | {subject} |
| 유형 | {type} |
| 우선순위 | {priority} |
| 담당자 | {assignee} |
| 시작일 | {start_date 또는 "미설정"} |
| 종료일 | {due_date 또는 "미설정"} |
| 상태 | New |

OpenProject에서 확인: {work_package_url}

### 실패 시

작업 패키지 생성에 실패했습니다.
- 원인: {error_message}
- 조치: {에러 유형에 따른 안내}
