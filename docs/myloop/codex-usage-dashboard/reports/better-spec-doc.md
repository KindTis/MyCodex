# better-spec-doc 단계 보고서

## 상태

완료.

## 루프 횟수

2회.

## 읽은 문서

- `docs/myloop/codex-usage-dashboard/handoffs/better-spec-doc.md`
- `C:/Users/tatis/.codex/skills/myloop/SKILL.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-spec-doc.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-spec-doc-main-agent.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-spec-doc-interrogator.md`
- `docs/myloop/codex-usage-dashboard/source-of-truth.md`
- `docs/myloop/codex-usage-dashboard/context-log.md`
- `docs/myloop/codex-usage-dashboard/myoneloop-plan.md`
- `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- `C:/Users/tatis/.agents/skills/grilling/SKILL.md`
- `C:/Users/tatis/.agents/skills/domain-modeling/SKILL.md`

## 변경한 문서

- `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`

## 개선 요약

- 백엔드가 두 데이터 소스를 독립적으로 조회하고 부분 실패를 허용한다는 아키텍처 규칙을 명확히 했다.
- 백엔드 메모리에만 최근 에러 로그와 마지막 성공/실패 시각을 유지한다는 MVP 저장 범위를 명확히 했다.
- 대시보드 상태 표시 규칙을 추가했다.
- `/api/dashboard` 응답 불변 조건을 추가했다.
- `/api/debug` 요약과 에러 로그 표시 규칙을 추가했다.
- `ccusage` 날짜 정규화와 누락 날짜 처리 규칙을 추가했다.
- Codex App Server rate limit 정규화 규칙을 추가했다.
- timeout, 비정상 종료, JSON 파싱 실패, 필수 필드 누락 처리 기준을 추가했다.
- 테스트 기준을 확장했다.

## 하위 MyLoop 최종 판단

심문관 기준 최종 판단은 `종료 가능`.

별도 심문관 생성 도구가 서브에이전트 환경에서 노출되지 않아, 서브에이전트 A가 `better-spec-doc-interrogator.md`, `/grilling`, `/domain-modeling` 지침을 읽고 같은 세션 안에서 역할을 분리해 검토했다.

## 메인 에이전트 자기 점검

핵심 사용자 흐름, 데이터 소스, 상태 전이, 예외 상황, UI/UX, 디버그 페이지, 테스트 기준이 구현 계획 작성 가능한 수준으로 명확해졌다. MVP 범위와 비포함 기능이 구분되어 있고, `ccusage`와 Codex App Server 변경 리스크가 숨겨지지 않았다.

## 검증 증거

- 최신 스펙 문서를 다시 읽어 변경 내용을 확인했다.
- 주요 반영 위치를 확인했다.
  - 상태 표시 규칙.
  - 응답 불변 조건.
  - 디버그 응답 규칙.
  - 데이터 정규화 규칙.
  - timeout 처리.
  - 추가 테스트 기준.
- UTF-8 BOM 없음이 확인되었다.
- 문서 단계이므로 코드 테스트는 실행하지 않았다.

## 자동 진행 위임 범위 충족 여부

충족. 승인된 Codex 사용량 로컬 웹 대시보드 요구사항 안에서 공식 스펙만 개선했다. 범위 확장, 외부 비용/계정 변경, git 이력 조작, 비공개/불안정 API를 안정 API처럼 전제하는 결정은 하지 않았다.

## 미해결 질문

- 공식 구현 계획 문서 경로.
- 구현 전에 실제 `ccusage codex daily --json` 출력 샘플로 비용 필드명을 확정해야 한다.
- 구현 시점에 고정할 `ccusage` 정확한 버전.

## 남은 리스크

- `ccusage` JSON 스키마 변경 가능성.
- `codex app-server` 프로토콜 또는 응답 구조 변경 가능성.
- 로컬 Codex 인증 상태에 따른 App Server 실패 가능성.
- 이번 단계에서는 실제 외부 명령 출력을 새로 검증하지 않았다.

## 권장 다음 액션

5단계에서 구현 계획 문서를 작성한다. 첫 구현 항목은 `ccusage` 샘플 fixture 확보, App Server rate limit fixture 확보, 파서 테스트, `/api/dashboard` 계약 테스트, UI 상태 테스트로 쪼개는 것이 적절하다.
