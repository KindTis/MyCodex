# 위임 패킷

## 단계

4. better-spec-doc 실행

## 위임할 MyLoop 하위 스킬

better-spec-doc

## 단계 목표

공식 스펙 문서가 구현 계획 작성 기준으로 충분한지 검토하고, 불명확하거나 과한 범위를 수정해 개선된 공식 스펙 문서로 만든다.

대상은 게임 스펙이 아니라 Codex 사용량 로컬 웹 대시보드 스펙이다. 하위 역할 문서의 게임 특화 기준은 앱의 핵심 사용자 흐름, 데이터 규칙, UI/UX, 에러 처리, 테스트 가능성, MVP 범위 명확성에 대응해 검토한다. 역할 문서를 적용할 수 없는 항목은 임의로 꾸미지 말고 남은 리스크로 반환한다.

## 서브에이전트 A

- 모델: GPT-5.5 xHigh
- 단계별 MyLoop `/goal` 소유자: 서브에이전트 A

## 권위 문서

- 요구사항 정본: `C:/Users/tatis/Repos/MyCodex/docs/myloop/codex-usage-dashboard/source-of-truth.md`
- 컨텍스트 로그: `C:/Users/tatis/Repos/MyCodex/docs/myloop/codex-usage-dashboard/context-log.md`
- MyOneLoop 실행 계획: `C:/Users/tatis/Repos/MyCodex/docs/myloop/codex-usage-dashboard/myoneloop-plan.md`

## 초기 승인과 자동 진행 위임

- 초기 스펙 사용자 승인: 사용자가 설계 섹션과 문서 생성을 승인했다.
- 이후 자동 진행 위임: 사용자는 이후 승인 게이트를 에이전트가 사용자 대리자로 진행해도 된다고 승인했다.
- 대리 진행 범위: 승인된 Codex 사용량 로컬 웹 대시보드 요구사항 안에서 문서 개선, 구현 계획 작성, 구현 진행 여부 판단.
- 대리 불가 조건: 범위 확장, 외부 비용/계정 변경, 파괴적 파일 또는 git 이력 조작, 비공개/불안정 API를 안정 API처럼 전제하는 결정.

## 공식 입력 문서

- 스펙 문서: `C:/Users/tatis/Repos/MyCodex/docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- 구현 계획 문서: 없음
- 구현 항목 매핑 문서: 없음

## 수정 가능 문서

- `C:/Users/tatis/Repos/MyCodex/docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`

## 읽기 전용 문서

- `C:/Users/tatis/Repos/MyCodex/docs/myloop/codex-usage-dashboard/source-of-truth.md`
- `C:/Users/tatis/Repos/MyCodex/docs/myloop/codex-usage-dashboard/myoneloop-plan.md`
- `C:/Users/tatis/Repos/MyCodex/docs/myloop/codex-usage-dashboard/context-log.md`

## 필수 게이트 문서

- `C:/Users/tatis/.codex/skills/myloop/SKILL.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-spec-doc.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-spec-doc-main-agent.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-spec-doc-interrogator.md`

## 종료 게이트

- 심문관이 최신 스펙 문서를 `/grilling` 세션과 `/domain-modeling` 스킬로 검토하고 `종료 가능`으로 판정했다.
- 서브에이전트 A가 메인 에이전트 역할 문서 기준으로 스펙 문서를 직접 확인했다.
- 핵심 사용자 흐름, 주요 선택, 데이터 소스, 상태 전이, 예외 상황, UI/UX, 피드백, 테스트 기준이 구현자가 바로 작업할 수 있을 정도로 명확하다.
- MVP 범위와 후속 확장 후보가 구분되어 있다.
- 구현 리스크, 설계 리스크, 유지보수 리스크가 숨겨지지 않았다.
- 미결정 항목, 후속 검토 항목, 남은 리스크가 숨겨지지 않았다.

## 메인 에이전트에게 반환할 질문

- 승인된 요구사항과 충돌해 사용자의 직접 판단이 필요한 질문.
- App Server 또는 `ccusage`의 실제 출력 확인 없이는 확정할 수 없는 질문.
- 구현 범위 확장이 필요한 질문.

## 필수 결과 패킷

- 단계 상태.
- 해당되는 경우 루프 횟수.
- 읽은 문서.
- 변경한 문서.
- 공식 문서 경로.
- 하위 MyLoop 최종 판단 또는 검증 결과.
- 메인 에이전트 역할 자기 점검 결과.
- 검증 증거.
- 초기 자동 진행 위임 범위 충족 여부.
- MyOneLoop 실행 계획 갱신 요청.
- 미해결 질문.
- 남은 리스크.
- 권장 다음 액션.
