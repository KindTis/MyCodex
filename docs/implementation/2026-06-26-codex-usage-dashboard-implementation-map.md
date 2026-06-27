# Codex 사용량 대시보드 구현 항목 매핑

## 기준 문서

- 요구사항 정본: `docs/myloop/codex-usage-dashboard/source-of-truth.md`
- 공식 스펙 문서: `docs/superpowers/specs/2026-06-26-codex-usage-dashboard-design.md`
- 공식 구현 계획 문서: `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`
- 위임 패킷: `docs/myloop/codex-usage-dashboard/handoffs/better-run-impl.md`

## 구현 항목 매핑표

| 구현 항목 ID | 구현 계획서 항목 | 수용 기준 | 구현 대상 | 구현 상태 | 검증 방법 | 검증 결과 | 보류 사유 |
|---|---|---|---|---|---|---|---|
| IMPL-01 | Task 1. 프로젝트 스캐폴드 | React/Vite, Express, TypeScript, Vitest 기반 프로젝트가 생성되고 `ccusage`가 `20.0.14`로 고정된다. `dev`, `build`, `start`, `test`, `test:watch` 스크립트가 제공된다. Vite `/api` proxy는 `127.0.0.1:4317`을 향한다. `index.html`의 `lang`은 `ko`다. | `.gitignore`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.server.json`, `vite.config.ts`, `index.html` | 구현 | `npm install`, `npm run build`, 파일 내용 확인 | 통과 | |
| IMPL-02 | Task 2. 샘플 확인과 fixture 준비 | 정제된 `ccusage` daily fixture와 Codex App Server rate limit fixture가 생성된다. 실제 로컬 `ccusage codex daily --json` 조회는 실행하지 않는다. fixture에는 원본 JSON 전체, token, 인증값, 환경 변수 전체, 민감한 사용자 경로가 없다. | `tests/fixtures/ccusage-daily.json`, `tests/fixtures/codex-rate-limits.json` | 구현 | fixture 내용 확인, 관련 parser/service 테스트 | 통과 | |
| IMPL-03 | Task 3. 공유 타입, 날짜, 프로세스, sanitization, debug store | API 계약 타입, 로컬 날짜 key, 최근 7일 날짜 key, epoch seconds 변환, timeout child process helper, JSON parsing helper, sanitization, 메모리 debug store가 구현된다. 테스트용 clear 함수는 테스트 전용으로 export된다. | `server/data/types.ts`, `server/data/date.ts`, `server/utils/process.ts`, `server/utils/sanitize.ts`, `server/data/debugStore.ts` | 구현 | `npm test`의 `dashboardService` 및 sanitization 관련 테스트 | 통과 | |
| IMPL-04 | Task 4. `ccusage` 파서와 실행기 | `daily` 또는 `data` row 배열에서 최근 7일 추이를 만들고 누락 날짜를 0으로 채운다. 오늘 row가 없으면 오늘 사용량은 0이다. 비용 필드 `totalCost`, `costUSD`를 우선 지원한다. 필수 필드 누락, JSON 파싱 실패, 비정상 종료, timeout은 실패로 처리한다. 로컬 bin `ccusage codex daily --json` 실행 함수가 있다. | `server/data/ccusage.ts`, `server/data/ccusage.test.ts`, `tests/fixtures/ccusage-daily.json` | 구현 | `npm test`의 `server/data/ccusage.test.ts` | 통과 | |
| IMPL-05 | Task 5. Codex App Server 파서와 JSON-RPC 클라이언트 | `limitId === "codex"` bucket을 primary 5시간, secondary 1주 window로 매핑한다. Codex bucket을 먼저 반환한다. bucket 누락 또는 잘못된 `usedPercent`는 실패 처리한다. `resetsAt` epoch seconds는 ISO 문자열로 변환한다. JSON-RPC 요청은 `jsonrpc` 필드 없이 `initialize`, `initialized`, `account/rateLimits/read` 순서로 보낸다. | `server/data/codexAppServer.ts`, `server/data/codexAppServer.test.ts`, `tests/fixtures/codex-rate-limits.json` | 구현 | `npm test`의 `server/data/codexAppServer.test.ts` | 통과 | |
| IMPL-06 | Task 6. 대시보드 service와 디버그 응답 | 두 소스 성공 시 `ok`, 한쪽 실패 시 `partial`, 모두 실패 시 `error`를 반환한다. 실패한 ccusage는 `today: null`, `trend: []`가 된다. 실패한 Codex App Server는 `limits: []`가 된다. 실패 메시지는 sanitization 된다. debug 응답은 파싱 요약, 최근 에러, 마지막 성공/실패 시각을 포함하고 원본 JSON 전체를 반환하지 않는다. 두 데이터 소스는 독립 조회된다. | `server/data/dashboardService.ts`, `server/data/dashboardService.test.ts` | 구현 | `npm test`의 `server/data/dashboardService.test.ts` | 통과 | |
| IMPL-07 | Task 7. Express API 서버 | `GET /api/dashboard`, `GET /api/debug`가 구현된다. production build 정적 파일을 serve한다. SPA fallback은 `/api` 뒤에 둔다. 기본 listen 주소는 `127.0.0.1:4317`이다. 예기치 못한 500도 sanitization 된 메시지만 반환한다. | `server/index.ts`, `server/index.test.ts` | 구현 | `npm test`의 mock service 라우트 테스트, `npm run build`, `npm start` 기동 확인 | 통과 | |
| IMPL-08 | Task 8. 프론트엔드 API 클라이언트와 polling hook | `fetchDashboard`, `fetchDebug`, 페이지 진입 즉시 조회, 60초 자동 갱신, 수동 새로고침, 진행 중 중복 요청 방지, 기존 data 유지 refresh 상태, 1초 countdown, fetch 실패 메시지 상태가 구현된다. | `src/api.ts`, `src/useDashboardData.ts`, `src/useDashboardData.test.tsx` | 구현 | `npm test`의 `src/useDashboardData.test.tsx` | 통과 | |
| IMPL-09 | Task 9. 대시보드 UI | `/`에서 오늘 토큰, 오늘 비용, 마지막 갱신, 전체 상태, 다음 자동 갱신, 수동 새로고침, 5시간/1주 limit meter와 원본 퍼센트 텍스트, 추가 bucket, 최근 7일 CSS/SVG 추이, 소스별 성공/실패 상태와 메시지를 한국어로 표시한다. 실패한 소스의 이전 성공 값을 현재 값처럼 표시하지 않는다. | `src/main.tsx`, `src/App.tsx`, `src/pages/DashboardPage.tsx`, `src/pages/DashboardPage.test.tsx`, `src/components/MetricCard.tsx`, `src/components/LimitMeter.tsx`, `src/components/SourceStatusPanel.tsx`, `src/components/TrendChart.tsx`, `src/styles.css` | 구현 | `npm test`의 `src/pages/DashboardPage.test.tsx`, `npm run build` | 통과 | |
| IMPL-10 | Task 10. 디버그 페이지 | `/debug`에서 `ccusage` 파싱 요약, Codex App Server 파싱 요약, 각 소스의 마지막 성공/실패 시각, 최근 에러 로그를 한국어로 표시한다. 원본 JSON 전체를 화면에 표시하지 않는다. | `src/pages/DebugPage.tsx`, `src/pages/DebugPage.test.tsx`, `src/styles.css` | 구현 | `npm test`의 `src/pages/DebugPage.test.tsx`, `npm run build` | 통과 | |
| IMPL-11 | Task 11. 전체 검증 | 전체 테스트, production build, production server, `/api/dashboard`, `/api/debug`, `/`, `/debug` 확인을 수행한다. 실제 `ccusage` 로컬 사용량 조회는 별도 승인 전까지 실행하지 않고 mock/fixture로 검증한다. | 테스트 명령, 빌드 명령, 로컬 서버 기동 확인 | 구현 | `npm test`, `npm run build`, `npm start` 기동 확인, mock/fixture API/UI 테스트 | 통과 | |
| IMPL-12 | Task 12. 구현 항목 매핑 문서 | 구현 전 매핑 문서가 존재하고, 구현 후 실제 생성 파일과 검증 결과가 최신 상태로 갱신된다. 검증 전 PASS/FAIL을 미리 쓰지 않는다. | `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md` | 구현 | 문서 내용 확인, 검증 결과 갱신 확인 | 통과 | |

## 구현 가정

- 검증관 서브에이전트 생성 도구가 현재 세션에 노출되지 않아, `better-run-impl-verifier.md`의 역할 기준을 별도 검토 기록으로 적용한다.
- 구현 계획서의 `Task 12. 구현 항목 매핑 문서`는 구현 후 작성으로 되어 있으나, MyLoop `better-run-impl` 시작 게이트가 구현 전 매핑 문서 작성을 요구한다. 따라서 이 문서를 구현 전 초기 매핑으로 작성하고, 구현 후 실제 상태와 검증 결과를 갱신한다.
- 실제 로컬 `ccusage codex daily --json` 사용량 데이터 조회는 위임 패킷에서 금지되어 있으므로 실행하지 않는다. parser 검증은 공개 문서 기반 정제 fixture와 mock으로 수행한다.
- 저장소에 앱 코드가 없으므로 공식 구현 계획의 생성 대상 파일을 새로 만든다.
- Codex App Server 실제 호출은 로컬 인증/실사용 상태에 의존하므로 자동 테스트에서는 fixture와 mock process로 검증하고, runtime 코드는 방어적으로 구현한다.

## 보류 항목

- 현재 없음. 실제 `ccusage` 로컬 데이터 조회는 승인 범위 밖 검증이므로 보류가 아니라 실행하지 않는 검증 제한으로 기록한다.

## 구현 계획서 모순

- 구현 계획서 Task 12는 "구현이 끝난 뒤" 매핑 문서를 작성한다고 되어 있지만, MyLoop 게이트는 구현 전 매핑 작성과 검증관 매핑 검토 통과를 요구한다. 상위 게이트를 우선해 구현 전 초기 매핑 문서를 작성하고, 구현 후 결과를 갱신한다.

## 검증 요약

- `npm install`: 통과. `package-lock.json` 생성. npm audit가 5개 취약점(3 moderate, 1 high, 1 critical)을 보고했으나 audit fix는 구현 계획 범위 밖이라 실행하지 않음.
- `npm test -- src/pages/DashboardPage.test.tsx`: 통과. 1개 테스트 통과.
- `npm test`: 통과. 7개 test file, 25개 테스트 통과.
- `npm run build`: 통과. `tsc -p tsconfig.server.json`와 Vite production build 통과.
- `npm start` 기동 확인: 통과. `PORT=4318`에서 `Codex usage dashboard listening on http://127.0.0.1:4318` 로그 확인 후 종료.
- `/api/dashboard` live 조회와 `/` live 화면 확인은 실행하지 않음. 해당 요청은 실제 로컬 `ccusage codex daily --json` 사용량 데이터 조회를 유발하므로 위임 패킷 제한을 우선했다.
- `/api/dashboard`, `/api/debug`, 대시보드 UI, 디버그 UI는 mock service, mock fetch, 정제 fixture 기반 자동 테스트로 검증했다.

## 남은 리스크

- 실제 `ccusage` JSON 스키마가 정제 fixture와 다를 수 있다.
- Codex App Server 스키마 또는 runtime 동작이 조사 시점과 다를 수 있다.
- 실제 `/api/dashboard`와 `/` live 확인은 별도 승인 전까지 실행하지 않았다.
- `npm install` 결과 npm audit 취약점 5개가 보고됐다. 강제 업데이트는 패키지 버전 변경을 수반할 수 있어 수행하지 않았다.
- 검증관 전용 서브에이전트 생성 도구가 노출되지 않아 검증 독립성은 역할 분리 기록으로 보완한다.

## 검증관 매핑 검토 기록

판정: 만족

### 검토 요청

* 유형: 매핑 검토 요청
* 검토 대상: `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`

### 검토 범위

* 검토한 문서: `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`, `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`
* 보충한 추가 근거: 저장소 파일 목록과 현재 브랜치 `main` 확인
* 판단하지 못한 항목: 검증관 전용 서브에이전트 생성 도구가 노출되지 않아 별도 프로세스 검토는 수행하지 못함

### 검토 결과

* 매핑 검토 판정: 만족
* 구현 충실도 판정: 해당 없음
* 코드 품질 리뷰 판정: 해당 없음
* 종합 판정: 해당 없음
* 보류: 없음
* 해당 없음: 구현 결과 검토는 구현 후 수행

### 필수 보완

* 없음

### 선택 보완 또는 추가 리스크

* 검증관 전용 서브에이전트 도구 부재는 최종 결과 패킷의 남은 리스크에도 남긴다.

### 검증관 최종 의견

* 구현 계획서의 Task 1-12가 구현 항목 ID IMPL-01-IMPL-12로 누락 없이 매핑되어 있다.
* 각 항목의 구현 대상 파일, 수용 기준, 검증 방법이 구현 전 검토 가능한 수준으로 구체적이다.
* 실제 로컬 `ccusage` 사용량 조회 금지, mock/fixture 검증, 구현 전 매핑 작성과 구현 후 갱신 해석이 명확히 기록되어 있다.
* 구현 계획 밖 기능 확장이나 과도한 구조 변경 계획은 확인되지 않았다.

## 검증관 구현 결과 검토 기록

판정: 만족

### 검토 요청

* 유형: 구현 결과 검토 요청
* 검토 대상: `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`, `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`

### 검토 범위

* 검토한 문서: 공식 구현 계획 문서, 구현 항목 매핑 문서, 생성된 코드/테스트/설정 파일 목록, 실행한 검증 명령 결과
* 보충한 추가 근거: `npm test` 7개 test file/25개 테스트 통과, `npm run build` 통과, `npm start` 기동 로그 확인, `node_modules/.bin/ccusage` 및 `node_modules/.bin/ccusage.cmd` 존재 확인
* 판단하지 못한 항목: 실제 `/api/dashboard` live 조회와 `/` live 화면 확인. 해당 동작은 실제 로컬 `ccusage codex daily --json` 사용량 데이터 조회를 유발하므로 위임 패킷 제한에 따라 실행하지 않음

### 검토 결과

* 매핑 검토 판정: 해당 없음
* 구현 충실도 판정: 만족
* 코드 품질 리뷰 판정: 만족
* 종합 판정: 만족
* 보류: 없음
* 해당 없음: 실제 사용량 데이터 live 조회

### 필수 보완

* 없음

### 선택 보완 또는 추가 리스크

* npm audit가 5개 취약점을 보고했다. 구현 계획 범위 안에서 `ccusage@20.0.14` 고정 요구를 깨지 않고 해소할 수 있는지 별도 판단이 필요하다.
* 실제 로컬 `ccusage` 출력 스키마와 Codex App Server runtime 스키마는 별도 승인 후 live 확인해야 한다.

### 검증관 최종 의견

* IMPL-01부터 IMPL-12까지 구현 상태와 검증 결과가 최신으로 기록되어 있다.
* 공식 구현 계획의 필수 구현 항목은 코드, 테스트, 설정, 문서에 연결되어 있다.
* 실제 로컬 사용량 조회 금지 조건을 위반하지 않고 parser, service, API, UI를 mock/fixture 기반으로 검증했다.
* 구현 계획 밖 기능 확장이나 과도한 리팩터링은 확인되지 않는다.
