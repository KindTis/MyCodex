# 위임 패킷

## 단계

8. better-run-impl 실행

## 위임할 MyLoop 하위 스킬

better-run-impl

## 단계 목표

공식 구현 계획 문서에 따라 Codex 사용량 로컬 웹 대시보드를 구현하고, 구현 항목 매핑 문서를 작성 및 갱신하며, 검증관 검토를 통과시킨다.

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
- 구현 승인: 공식 스펙과 공식 구현 계획이 각각 better-spec-doc, better-impl-doc 단계를 통과했으므로, 사용자 대리 승인 범위 안에서 구현을 승인했다.
- 대리 진행 범위: 승인된 Codex 사용량 로컬 웹 대시보드 요구사항 안에서 코드, 테스트, 문서, 설정을 생성 또는 수정한다.
- 대리 불가 조건: 범위 확장, 외부 비용/계정 변경, 파괴적 파일 또는 git 이력 조작, 비공개/불안정 API를 안정 API처럼 전제하는 결정.

## 공식 입력 문서

- 스펙 문서: `C:/Users/tatis/Repos/MyCodex/docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- 구현 계획 문서: `C:/Users/tatis/Repos/MyCodex/docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`
- 구현 항목 매핑 문서: `C:/Users/tatis/Repos/MyCodex/docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`

## 수정 가능 문서와 파일

- 공식 구현 계획이 지정한 앱 코드, 테스트, 설정 파일.
- `C:/Users/tatis/Repos/MyCodex/docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`
- 구현 결과 보고에 필요한 `C:/Users/tatis/Repos/MyCodex/docs/myloop/codex-usage-dashboard/reports/better-run-impl.md`

## 읽기 전용 문서

- `C:/Users/tatis/Repos/MyCodex/docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- `C:/Users/tatis/Repos/MyCodex/docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`
- `C:/Users/tatis/Repos/MyCodex/docs/myloop/codex-usage-dashboard/source-of-truth.md`
- `C:/Users/tatis/Repos/MyCodex/docs/myloop/codex-usage-dashboard/myoneloop-plan.md`
- `C:/Users/tatis/Repos/MyCodex/docs/myloop/codex-usage-dashboard/context-log.md`

## 필수 게이트 문서

- `C:/Users/tatis/.codex/skills/myloop/SKILL.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-run-impl.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-run-impl-main-agent-before.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-run-impl-verifier.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-run-impl-main-agent-implement.md`
- `C:/Users/tatis/.codex/skills/myloop/references/better-run-impl-main-agent-after.md`
- `C:/Users/tatis/.codex/plugins/cache/openai-curated/superpowers/7fd3161c/skills/executing-plans/SKILL.md`

## 실행 제한

- 현재 브랜치가 `main`인지 확인한다. 현재 확인된 브랜치는 `main`이다.
- 실제 로컬 `ccusage codex daily --json` 사용량 데이터 조회는 별도 명시 승인이 없으면 실행하지 않는다.
- 구현과 자동 검증은 공개 문서 기반 정제 fixture, 단위 테스트, 통합 테스트, 빌드 검증을 중심으로 수행한다.
- `npm install`처럼 패키지 설치가 필요하면 네트워크와 패키지 설치 승인 정책을 따른다.
- git commit, git reset, git checkout, push, PR 생성은 수행하지 않는다.

## 종료 게이트

- 구현 항목 매핑 문서가 작성되고 최신 상태다.
- 검증관이 매핑 검토에서 `만족`으로 판정한 뒤 구현을 시작했다.
- 구현 계획서의 필수 구현 항목이 코드, 테스트, 설정, 문서에 반영됐다.
- 필요한 테스트 또는 확인 명령이 실행되고 결과가 구현 항목 매핑 문서에 기록됐다.
- 검증관이 구현 충실도와 코드 품질 리뷰를 모두 `만족`으로 판정했다.
- 미충족 필수 구현 항목, 보류 항목, 남은 리스크가 숨겨지지 않았다.

## 메인 에이전트에게 반환할 질문

- 구현 계획과 실제 코드/환경이 충돌해 임의 결정이 위험한 질문.
- 제3자 패키지가 실제 로컬 사용량 데이터를 읽어야 하는 검증을 실행해야 하는 경우.
- 구현 계획 범위 밖의 기능 확장이 필요한 질문.

## 필수 결과 패킷

- 구현 결과 상태: 완료 / 부분 완료 / 차단.
- 읽은 문서.
- 변경한 파일.
- 구현 항목 매핑 문서 경로.
- 검증관 최종 판정.
- 실행한 테스트 또는 확인 명령과 결과.
- 구현 항목 커버리지.
- 구현 가정.
- 보류 항목.
- 남은 리스크.
- MyOneLoop 실행 계획 갱신 요청.
- 권장 다음 액션.
