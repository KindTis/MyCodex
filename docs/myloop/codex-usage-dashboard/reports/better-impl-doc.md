# better-impl-doc 단계 보고서

## 상태

완료.

## 루프 횟수

3회.

## 읽은 문서

- `docs/myloop/codex-usage-dashboard/handoffs/better-impl-doc.md`
- `C:/Users/tatis/.codex/skills/myloop/SKILL.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-impl-doc.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-impl-doc-main-agent.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-impl-doc-interrogator.md`
- `C:/Users/tatis/.agents/skills/grilling/SKILL.md`
- `C:/Users/tatis/.agents/skills/domain-modeling/SKILL.md`
- `docs/myloop/codex-usage-dashboard/source-of-truth.md`
- `docs/myloop/codex-usage-dashboard/context-log.md`
- `docs/myloop/codex-usage-dashboard/myoneloop-plan.md`
- `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`

## 변경한 문서

- `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`

## 개선 요약

- 구현 계획을 스펙 대응 중심으로 재구성했다.
- API 계약, 데이터 정규화 규칙, 에러/디버그 상태, UI 상태 규칙을 구현 전에 확인할 수 있게 명확히 했다.
- 마지막 성공/실패 시각 요구를 구현 계획에 반영했다.
- `SourceStatusPanel`을 추가해 데이터 소스별 성공/실패 상태 표시를 별도 컴포넌트로 분리했다.
- 구현 매핑 문서가 실제 실행 후 PASS/FAIL만 기록하도록 계획을 보강했다.
- 메인 에이전트 직접 검토에서 Codex App Server의 `jsonrpc` 필드 포함 지시가 문서와 실측에 맞지 않음을 확인하고, `jsonrpc` 필드를 생략하도록 수정했다.

## 하위 MyLoop 최종 판단

심문관 기준 최종 판단은 `종료 가능`.

별도 심문관 생성 도구가 서브에이전트 환경에서 노출되지 않아, 서브에이전트 A가 심문관 역할 라운드를 같은 에이전트 안에서 분리 수행했다.

## 메인 에이전트 자기 점검

구현 계획은 공식 스펙의 오늘 토큰/비용, 최근 7일 추이, 5시간/1주 사용률, 60초 갱신, 부분 실패, 디버그 요약, 마지막 성공/실패 시각, `ccusage` 고정 버전, `npm run dev`/`npm start` 요구를 작업과 검증 기준에 매핑한다. MVP 범위 밖 기능은 비목표로 남아 있다.

## 검증 증거

- 메인 에이전트가 수정된 구현 계획을 직접 읽었다.
- 핵심 키워드 검색에서 `ccusage`, Codex App Server, `/debug`, 60초 갱신, `partial`, `error`, `npm start` 관련 작업이 포함되어 있음을 확인했다.
- placeholder 검색에서 `TBD`, `TODO`, `미실행` 같은 금지 placeholder가 남아 있지 않음을 확인했다.
- Codex App Server JSON-RPC 요청 형식의 모순을 직접 수정했다.
- UTF-8 BOM 없음은 이전 단계에서 확인되었고, 새 문서는 동일한 도구 체인으로 생성했다.

## 자동 진행 위임 범위 충족 여부

충족. 승인된 Codex 사용량 로컬 웹 대시보드 요구사항 안에서 공식 구현 계획 문서만 개선했다. 범위 확장, 외부 비용/계정 변경, git 이력 조작은 하지 않았다.

## 미해결 질문

- 구현 초기에 실제 `ccusage codex daily --json` 비용 필드명을 안전하게 확인해야 한다.
- App Server 프로토콜 또는 응답 구조가 조사 결과와 다르면 구현 단계에서 차단 또는 리스크로 반환해야 한다.

## 남은 리스크

- `ccusage` JSON 스키마 변경 가능성.
- Codex App Server 버전 변경 가능성.
- 로컬 인증 또는 네트워크 상태에 따른 App Server 실패 가능성.
- 구현 전에는 구현 매핑 문서의 PASS/FAIL을 확정할 수 없다.

## 권장 다음 액션

7단계 구현 승인 상태를 기록하고, 승인된 대리 권한 범위 안에서 8단계 better-run-impl 위임을 준비한다.
