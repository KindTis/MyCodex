# 요구사항 정본

## 목표

`ccusage/ccusage`와 Codex App Server를 사용해 Codex 사용량과 현재 한도 사용률을 보여주는 개인용 로컬 웹 대시보드를 만든다.

## 사용자 요구사항

- 로컬 웹 앱으로 실행한다.
- Codex 사용량만 표시한다.
- 첫 화면에는 오늘 사용량, 날짜별 사용량 추이, 5시간/1주 limit 사용률을 표시한다.
- 오늘 사용량에는 토큰과 비용을 표시한다.
- 5시간/1주 limit은 남은 절대량이 아니라 `% 사용량`을 표시한다.
- 데이터는 페이지를 열 때 조회하고 1분마다 자동 갱신한다.
- `ccusage`는 프로젝트 의존성으로 설치하고 버전을 고정해서 실행한다.
- 날짜 기준은 로컬 PC 시간대를 따른다.
- 날짜별 추이 기본 범위는 최근 7일이다.
- 비용은 `ccusage`가 계산한 값을 그대로 표시한다.
- 화면은 대시보드와 디버그 상세의 두 페이지로 구성한다.
- 디버그 상세 페이지는 원본 JSON 전체가 아니라 파싱된 요약값과 에러 로그만 표시한다.
- 실행 명령은 개발용 `npm run dev`와 실제 사용용 `npm start`를 모두 제공한다.

## 승인된 요구사항

- React/Vite 프론트엔드와 Node/Express 로컬 API 서버 조합을 사용한다.
- `/` 대시보드에서 오늘 토큰/비용, 최근 7일 추이, 5시간/1주 사용률을 표시한다.
- `/debug`에서 파싱된 요약값과 에러 로그를 표시한다.
- `ccusage`는 토큰/비용/날짜별 추이에 사용한다.
- `codex app-server`의 `account/rateLimits/read`는 5시간/1주 limit `% 사용량`에 사용한다.
- 자동 갱신은 60초 주기로 수행한다.
- 부분 실패를 허용한다. `ccusage`와 Codex App Server 중 한쪽만 실패하면 성공한 데이터는 계속 표시한다.

## 비목표

- 로그인 또는 사용자 관리.
- 외부 배포.
- 원본 JSON 전체 표시.
- Codex 한도 절대값 추정.
- `ccusage` 대체 파서 직접 구현.
- Codex 외 다른 CLI 사용량 표시.

## 제약

- 사용자를 대상으로 하는 문서와 응답은 한국어로 작성한다.
- 파일 생성, 수정, 구현은 사용자 승인 후에만 진행한다.
- 개인 로컬 도구이므로 브라우저가 직접 CLI를 실행하지 않고 로컬 API 서버가 데이터 수집을 담당한다.
- `codex app-server` 프로토콜은 버전 변경 가능성이 있으므로 해당 연동은 방어적으로 처리한다.

## 성공 기준

- `npm run dev`로 개발 서버가 실행된다.
- `npm start`로 빌드된 로컬 앱이 실행된다.
- `/`에서 오늘 토큰, 오늘 비용, 최근 7일 추이, 5시간/1주 사용률이 표시된다.
- `/debug`에서 파싱 요약과 최근 에러 로그가 표시된다.
- 페이지 로드시 즉시 조회되고 이후 60초마다 자동 갱신된다.
- `ccusage` 실패와 Codex App Server 실패를 구분해 부분 실패 상태를 표시한다.
- 빌드와 테스트가 통과한다.

## 도메인 용어

- `ccusage`: 로컬 coding agent CLI 사용량을 읽어 토큰과 비용 리포트를 생성하는 도구.
- Codex App Server: `codex app-server`로 실행되는 로컬 JSON-RPC 인터페이스.
- 5h limit: Codex 응답의 `primary` rate limit window. 관측된 `windowDurationMins`는 300분.
- 1w limit: Codex 응답의 `secondary` rate limit window. 관측된 `windowDurationMins`는 10080분.
- 사용률: Codex App Server의 `usedPercent`.

## 승인된 결정

- 시각 보조 도구는 사용하지 않는다.
- 앱 형태는 로컬 웹 앱으로 한다.
- 데이터 범위는 Codex 전용으로 한다.
- 갱신 방식은 페이지 로드시 조회 후 1분마다 자동 갱신이다.
- `ccusage`는 프로젝트 의존성으로 고정한다.
- 시간대는 로컬 PC 시간대를 따른다.
- 날짜별 추이는 기본 최근 7일이다.
- 비용은 `ccusage` 계산값을 그대로 표시한다.
- 디버그 상세는 파싱 요약과 에러 로그만 표시한다.
- 실행 명령은 `npm run dev`와 `npm start`를 모두 제공한다.
- 사용자는 이후 승인 게이트를 에이전트가 사용자 대리자로 진행해도 된다고 승인했다.
- 차트는 별도 차트 라이브러리 없이 CSS/SVG 기반으로 구현한다.
- MVP에서는 마지막 성공 응답 캐시를 제공하지 않는다.

## 가정

- 사용자의 로컬 Codex 로그인 상태가 App Server 계정 조회에 사용할 수 있을 만큼 유효하다.
- `ccusage codex daily --json`은 오늘 사용량과 최근 7일 추이를 계산할 수 있는 JSON을 제공한다.
- `costUsd` 또는 동등한 비용 필드가 `ccusage` JSON에 포함된다. 실제 필드명은 구현 전에 샘플 출력으로 확인한다.

## 미해결 질문

- 없음. 실제 `ccusage codex daily --json` live 출력 확인은 별도 명시 승인 전까지 실행하지 않는다.

## 리스크

- `codex app-server` 스키마나 메서드가 Codex 버전 업데이트로 변경될 수 있다.
- App Server 조회는 네트워크 또는 인증 상태에 따라 실패할 수 있다.
- `ccusage` JSON 스키마가 버전에 따라 달라질 수 있으므로 의존성 고정과 파서 테스트가 필요하다.
- 비용 값은 `ccusage` 계산 기준에 의존한다.

## 공식 문서

- 스펙 문서: `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- 구현 계획 문서: `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`
- 구현 항목 매핑 문서: `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`

## 오케스트레이션 문서

- MyOneLoop 실행 계획: `docs/myloop/codex-usage-dashboard/myoneloop-plan.md`
- 컨텍스트 로그: `docs/myloop/codex-usage-dashboard/context-log.md`

## 승인 상태

- 요구사항: 대화에서 승인됨.
- 스펙: better-spec-doc 단계 완료.
- 구현 계획: better-impl-doc 단계 완료.
- 구현: better-run-impl 단계 완료. 사용자 대리 승인 범위 안에서 공식 구현 계획에 따른 구현과 검증을 완료했다.
