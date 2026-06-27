# MyOneLoop 실행 계획

## 현재 단계

- 단계: 9. 최종 보고
- 상태: 완료
- 다음 액션: 사용자 요청에 따라 1분 후 컴퓨터 종료 명령을 실행한다.

## 공식 문서

- 스펙 문서: `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- 구현 계획 문서: `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`
- 구현 항목 매핑 문서: `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`

## 오케스트레이션 문서

- 요구사항 정본: `docs/myloop/codex-usage-dashboard/source-of-truth.md`
- MyOneLoop 실행 계획: `docs/myloop/codex-usage-dashboard/myoneloop-plan.md`
- 컨텍스트 로그: `docs/myloop/codex-usage-dashboard/context-log.md`

## 단계 목록

### 1. 요구사항 접수

- 상태: 완료
- 담당: 메인 에이전트
- 필수 하위 스킬: superpowers:brainstorming
- 입력: 사용자 컨셉과 대화 중 승인된 요구사항
- 산출물: `docs/myloop/codex-usage-dashboard/source-of-truth.md`
- 시작 조건: 사용자가 Codex 사용량 개인 대시보드 아이디어를 제시한다.
- 종료 게이트: 요구사항, 제약, 성공 기준, 미해결 항목, 승인 상태가 요구사항 정본에 기록되어 있다.
- 다음 액션: MyOneLoop 실행 계획과 컨텍스트 로그를 작성한다.

### 2. MyOneLoop 실행 계획 작성

- 상태: 완료
- 담당: 메인 에이전트
- 입력: `docs/myloop/codex-usage-dashboard/source-of-truth.md`
- 산출물: `docs/myloop/codex-usage-dashboard/myoneloop-plan.md`, `docs/myloop/codex-usage-dashboard/context-log.md`
- 시작 조건: 요구사항 정본 생성 승인이 있다.
- 종료 게이트: 단계 목록, 공식 문서 경로 칸, 다음 액션이 준비되어 있다.
- 다음 액션: 초기 스펙 문서 생성 또는 식별 승인을 확인한다.

### 3. 초기 스펙 식별 또는 작성

- 상태: 완료
- 담당: 메인 에이전트
- 필수 하위 스킬: superpowers:brainstorming
- 입력: `docs/myloop/codex-usage-dashboard/source-of-truth.md`, 기존 프로젝트 문서
- 산출물: `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- 시작 조건: 사용자가 공식 스펙 문서 생성 또는 식별을 승인한다.
- 종료 게이트: 공식 스펙 문서 경로가 이 실행 계획에 기록되어 있다.
- 다음 액션: better-spec-doc 단계 위임을 준비한다.

### 4. better-spec-doc 실행

- 상태: 완료
- 담당: 서브에이전트 A
- 모델: GPT-5.5 xHigh
- `/goal` 소유자: 서브에이전트 A
- 하위 스킬: MyLoop better-spec-doc
- 입력: `docs/myloop/codex-usage-dashboard/source-of-truth.md`, `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- 산출물: `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`, `docs/myloop/codex-usage-dashboard/reports/better-spec-doc.md`
- 시작 조건: 3단계가 완료되고 공식 스펙 문서 경로가 기록되어 있다.
- 종료 게이트: better-spec-doc 종료 게이트 통과, 서브에이전트 A 자기 점검, 메인 에이전트 검토 완료.
- 다음 액션: 개선된 스펙 문서를 기준으로 구현 계획 작성 단계로 이동한다.

### 5. 구현 계획 작성 또는 식별

- 상태: 완료
- 담당: 메인 에이전트
- 필수 하위 스킬: superpowers:writing-plans
- 입력: `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- 산출물: `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`
- 시작 조건: 4단계가 완료되어 개선된 공식 스펙 문서가 준비되어 있다.
- 종료 게이트: 공식 구현 계획 문서 경로가 이 실행 계획에 기록되어 있다.
- 다음 액션: better-impl-doc 단계 위임을 준비한다.

### 6. better-impl-doc 실행

- 상태: 완료
- 담당: 서브에이전트 A
- 모델: GPT-5.5 xHigh
- `/goal` 소유자: 서브에이전트 A
- 하위 스킬: MyLoop better-impl-doc
- 입력: `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`, `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`
- 산출물: `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`, `docs/myloop/codex-usage-dashboard/reports/better-impl-doc.md`
- 시작 조건: 5단계가 완료되어 공식 구현 계획 문서가 준비되어 있다.
- 종료 게이트: better-impl-doc 종료 게이트 통과, 서브에이전트 A 자기 점검, 메인 에이전트 검토 완료.
- 다음 액션: 구현 승인 단계로 이동한다.

### 7. 구현 승인

- 상태: 완료
- 담당: 메인 에이전트
- 입력: 공식 스펙 문서, 공식 구현 계획 문서
- 산출물: 구현 승인 상태: 승인됨
- 시작 조건: 6단계가 완료되어 승인 가능한 구현 계획이 준비되어 있다.
- 종료 게이트: 사용자의 대리 승인 지시에 따라 공식 구현 계획 범위 안에서 구현 승인 상태가 기록되어 있다.
- 다음 액션: 구현 승인 시 better-run-impl 단계 위임을 준비한다.

### 8. better-run-impl 실행

- 상태: 완료
- 담당: 서브에이전트 A
- 모델: GPT-5.5 xHigh
- `/goal` 소유자: 서브에이전트 A
- 하위 스킬: MyLoop better-run-impl
- 입력: 공식 구현 계획 문서
- 산출물: 구현 결과, `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`, `docs/myloop/codex-usage-dashboard/reports/better-run-impl.md`
- 시작 조건: 사용자가 구현을 명시적으로 승인했다.
- 종료 게이트: better-run-impl 종료 게이트 통과, 검증 증거 기록, 메인 에이전트 검토 완료.
- 다음 액션: 최종 보고 단계로 이동한다.

### 9. 최종 보고

- 상태: 완료
- 담당: 메인 에이전트
- 입력: 실행 계획, 컨텍스트 로그, 단계 보고서
- 산출물: 사용자 보고, `docs/myloop/codex-usage-dashboard/reports/final-report.md`
- 시작 조건: 구현 단계가 완료 또는 차단 상태로 정리되어 있다.
- 종료 게이트: 완료, 부분 완료, 차단, 되돌림 필요 상태 중 하나가 명확히 보고되어 있다.
- 다음 액션: 사용자 요청에 따라 1분 후 컴퓨터 종료 명령을 실행한다.

## 미해결 항목

- 없음. 실제 `ccusage` live 조회와 `/api/dashboard` live 확인은 별도 명시 승인 전까지 실행하지 않았다.

## 남은 리스크

- `codex app-server` API는 버전 변경 가능성이 있다.
- `ccusage` JSON 스키마는 의존성 고정 후 샘플 기반으로 검증해야 한다.
- 비용 표시는 `ccusage` 계산 기준에 의존한다.
- `npm install` 결과 npm audit 취약점 5개가 보고됐고, 패키지 고정 요구와 충돌 가능성이 있어 자동 수정하지 않았다.
