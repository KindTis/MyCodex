# Codex 사용량 대시보드 구현 계획

> 에이전트용 실행 지침: 이 문서는 구현 단계의 공식 계획이다. 실제 구현은 MyOneLoop `better-run-impl` 단계에서만 진행한다. 구현 에이전트는 작업별 체크박스를 갱신하며 진행하고, 큰 작업 단위에는 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`를 사용한다.

## 목표

개인 PC에서 실행되는 로컬 웹 대시보드를 만든다. 대시보드는 `ccusage`가 계산한 Codex 토큰/비용 사용량과 `codex app-server`의 `account/rateLimits/read` 결과에서 얻은 5시간/1주 limit 사용률을 함께 표시한다.

## 범위

포함한다.

- `/` 대시보드 페이지.
- `/debug` 디버그 상세 페이지.
- 오늘 Codex 토큰 사용량.
- 오늘 Codex 비용.
- 최근 7일 날짜별 토큰/비용 추이.
- 5시간 limit 사용률과 1주 limit 사용률.
- 추가 limit bucket의 보조 표시.
- 데이터 소스별 성공/실패 상태.
- 페이지 진입 즉시 조회와 60초 자동 갱신.
- 수동 새로고침과 중복 요청 방지.
- 파싱된 요약값, 최근 에러 로그, 마지막 성공/실패 시각.
- 개발용 `npm run dev`와 실제 사용용 `npm start`.

포함하지 않는다.

- 로그인 또는 사용자 관리.
- 외부 배포.
- 원본 JSON 전체 표시.
- Codex limit 절대량 추정.
- `ccusage` 대체 파서 직접 구현.
- Codex 외 다른 CLI 사용량 표시.
- 실패 시 마지막 성공 응답을 현재 값처럼 표시하는 캐시.
- 별도 차트 라이브러리.

## 핵심 아키텍처

- 프론트엔드: React/Vite.
- 백엔드: Node/Express 로컬 API 서버.
- 브라우저는 CLI나 App Server를 직접 실행하지 않는다.
- Express 서버가 `ccusage` 실행, `codex app-server` JSON-RPC 호출, 데이터 정규화, 에러 마스킹을 담당한다.
- 두 데이터 소스는 한 응답 안에서 독립적으로 조회한다. 한쪽이 실패해도 다른 한쪽 성공 결과는 폐기하지 않는다.
- 영구 저장소는 두지 않는다. 최근 에러와 마지막 성공/실패 시각은 백엔드 프로세스 메모리에만 둔다.
- 날짜 기준은 로컬 PC 시간대다.

## 기술 스택

- TypeScript
- React
- Vite
- Express
- Vitest
- React Testing Library
- `ccusage@20.0.14`
- 로컬 `codex app-server`

## 파일 구조

생성할 파일:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.server.json`
- `vite.config.ts`
- `index.html`
- `server/index.ts`
- `server/data/types.ts`
- `server/data/date.ts`
- `server/data/ccusage.ts`
- `server/data/codexAppServer.ts`
- `server/data/debugStore.ts`
- `server/data/dashboardService.ts`
- `server/utils/process.ts`
- `server/utils/sanitize.ts`
- `tests/fixtures/ccusage-daily.json`
- `tests/fixtures/codex-rate-limits.json`
- `server/data/ccusage.test.ts`
- `server/data/codexAppServer.test.ts`
- `server/data/dashboardService.test.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/api.ts`
- `src/useDashboardData.ts`
- `src/useDashboardData.test.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/DebugPage.tsx`
- `src/components/MetricCard.tsx`
- `src/components/LimitMeter.tsx`
- `src/components/SourceStatusPanel.tsx`
- `src/components/TrendChart.tsx`
- `src/styles.css`
- `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`

## API 계약

### `GET /api/dashboard`

대시보드가 직접 사용하는 통합 응답이다.

```ts
type SourceName = "ccusage" | "codexAppServer";
type DashboardStatus = "ok" | "partial" | "error";

type SourceStatus = {
  ok: boolean;
  message: string | null;
  checkedAt: string;
};

type DashboardResponse = {
  generatedAt: string;
  status: DashboardStatus;
  today: { date: string; tokens: number; costUsd: number } | null;
  trend: Array<{ date: string; tokens: number; costUsd: number }>;
  limits: Array<{
    id: string;
    name: string;
    planType: string | null;
    primary: LimitWindow | null;
    secondary: LimitWindow | null;
  }>;
  sources: Record<SourceName, SourceStatus>;
};

type LimitWindow = {
  label: "5h" | "1w";
  usedPercent: number;
  resetsAt: string | null;
  windowDurationMins: number | null;
};
```

불변 조건:

- `generatedAt`은 백엔드 응답 생성 시각이다.
- 두 데이터 소스가 모두 성공하면 `status`는 `ok`다.
- 정확히 한쪽만 성공하면 `status`는 `partial`이다.
- 둘 다 실패하면 `status`는 `error`다.
- `ccusage`가 실패하면 `today`는 `null`, `trend`는 빈 배열이다.
- Codex App Server가 실패하면 `limits`는 빈 배열이다.
- 실패 메시지는 사용자 조치에 필요한 요약만 포함한다.
- 실패 메시지에는 토큰, 인증값, 환경 변수 전체, 원본 JSON 전체, 민감한 사용자 경로를 포함하지 않는다.

### `GET /api/debug`

디버그 상세 페이지가 사용하는 응답이다. 원본 JSON 전체는 절대 반환하지 않는다.

```ts
type DebugResponse = {
  generatedAt: string;
  ccusage: {
    ok: boolean;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    summary: {
      rows: number;
      todayMatched: boolean;
      costField: "totalCost" | "costUSD" | "none" | "other";
      sevenDayTokens: number;
      sevenDayCostUsd: number;
    };
  };
  codexAppServer: {
    ok: boolean;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    summary: {
      bucketIds: string[];
      hasCodexBucket: boolean;
      primaryWindowDurationMins: number | null;
      secondaryWindowDurationMins: number | null;
      primaryUsedPercent: number | null;
      secondaryUsedPercent: number | null;
    };
  };
  errors: Array<{
    at: string;
    source: SourceName;
    message: string;
  }>;
};
```

불변 조건:

- `ccusage.summary`는 파싱된 일수, 오늘 행 존재 여부, 사용한 비용 필드명, 최근 7일 합계를 포함한다.
- `codexAppServer.summary`는 확인된 bucket id 목록, Codex bucket 존재 여부, primary/secondary window 분 단위와 사용률을 포함한다.
- `lastSuccessAt`과 `lastFailureAt`은 백엔드 프로세스 메모리 기준이며 재시작 시 초기화되어도 된다.
- `errors`는 최근 에러의 발생 시각, 데이터 소스, 요약 메시지만 포함한다.
- 원본 JSON 전체, 토큰, 인증값, 환경 변수 전체, 민감한 사용자 경로는 포함하지 않는다.

## 데이터 정규화 규칙

### `ccusage`

- 프로젝트 의존성으로 설치된 고정 버전 `ccusage@20.0.14`를 실행한다.
- 전역 `ccusage`나 `latest` 실행에 의존하지 않는다.
- 실행 명령은 로컬 bin을 사용해 `ccusage codex daily --json`과 동등하게 호출한다.
- 구현 초기에 실제 로컬 출력 샘플을 확인하는 것은 별도 명시 승인이 있을 때만 수행한다.
- 자동 구현/검증에서는 공개 문서와 정제 fixture를 기준으로 작성한다.
- 출력 row 배열은 `daily` 또는 `data` 위치를 우선 지원한다.
- row의 필수 필드는 `date`, `totalTokens`, 비용 필드다.
- 비용 필드는 공개 `ccusage` JSON 문서에서 확인한 `totalCost`와 `costUSD`를 우선 지원한다.
- 별도 승인으로 실제 샘플을 확인했을 때 다른 비용 필드를 쓰면 parser와 테스트를 먼저 조정한다.
- 최근 7일 범위는 로컬 PC 날짜 기준 오늘과 직전 6일이다.
- `trend`는 날짜 오름차순이다.
- 특정 날짜 row가 없으면 해당 날짜의 토큰과 비용은 0이다.
- 오늘 row가 없으면 오늘 토큰과 비용은 0이다.
- 필수 필드 누락, JSON 파싱 실패, 비정상 종료, timeout은 `ccusage` 소스 실패로 처리한다.

### Codex App Server

- 백엔드는 `codex app-server`를 stdio transport로 짧게 실행한다.
- JSON-RPC 요청은 Codex App Server 문서와 실측에 맞춰 `jsonrpc` 필드를 생략하고 `id`, `method`, `params`만 보낸다.
- 호출 순서는 `initialize`, `initialized`, `account/rateLimits/read`다.
- 호출에는 유한한 timeout을 둔다. 초기값은 20초다.
- timeout, 프로세스 오류, JSON 파싱 실패, 필수 필드 누락은 Codex App Server 소스 실패로 처리한다.
- 기본 표시는 `limitId === "codex"` bucket이다.
- `primary.usedPercent`는 5시간 limit 사용률이다.
- `secondary.usedPercent`는 1주 limit 사용률이다.
- `resetsAt`이 epoch seconds이면 백엔드에서 ISO 문자열로 변환한다.
- 진행 막대의 시각적 최대값은 100%로 제한할 수 있다.
- 텍스트에는 원본 `usedPercent` 값을 표시한다.
- `usedPercent`가 숫자가 아니거나 Codex bucket을 찾을 수 없으면 Codex App Server 소스 실패로 처리한다.
- `limits` 배열은 Codex bucket을 먼저 두고, 추가 bucket은 뒤에 둔다.

## 에러와 디버그 상태

- `server/utils/sanitize.ts`는 에러 메시지에서 bearer token, OpenAI/Codex 관련 token, API key, 환경 변수 값, `C:\Users\<사용자>` 또는 `/Users/<사용자>` 형태의 사용자 경로를 마스킹한다.
- `server/data/debugStore.ts`는 소스별 `lastSuccessAt`, `lastFailureAt`, 최근 에러 최대 20개를 메모리에 저장한다.
- `dashboardService`는 성공 시 해당 소스의 `lastSuccessAt`을 갱신한다.
- `dashboardService`는 실패 시 해당 소스의 `lastFailureAt`을 갱신하고 에러 로그를 남긴다.
- `dashboardService`는 실패 메시지를 `SourceStatus.message`에 넣기 전에 반드시 sanitization을 거친다.
- Express의 예기치 못한 500 응답도 raw error를 그대로 반환하지 않는다.

## UI 상태 규칙

대시보드:

- 최초 진입 후 첫 응답 전에는 로딩 상태를 표시한다.
- 자동 갱신이나 수동 새로고침 중에는 기존 화면을 유지하고 갱신 중 상태를 표시한다.
- 수동 새로고침 버튼은 요청 진행 중 중복 실행을 막는다.
- 새 `/api/dashboard` 응답을 받으면 화면은 그 최신 응답만 기준으로 갱신한다.
- `ccusage`가 실패한 응답에서는 오늘 토큰, 오늘 비용, 최근 7일 추이 영역을 사용할 수 없음으로 표시한다.
- Codex App Server가 실패한 응답에서는 5시간/1주 limit 영역을 사용할 수 없음으로 표시한다.
- 실패한 데이터 소스의 이전 성공 값을 현재 값처럼 표시하지 않는다.
- `ccusage`와 Codex App Server 각각의 성공/실패 상태와 메시지를 별도 패널에 표시한다.
- 다음 자동 갱신까지 남은 시간은 화면에서 1초 단위로 갱신한다.

디버그 페이지:

- `ccusage` 파싱 요약을 표시한다.
- Codex App Server 파싱 요약을 표시한다.
- 최근 에러 로그를 표시한다.
- 각 데이터 소스의 마지막 성공 시각과 마지막 실패 시각을 표시한다.
- 원본 JSON 전체를 표시하지 않는다.

## 작업 계획

### Task 1. 프로젝트 스캐폴드

파일:

- `package.json`
- `tsconfig.json`
- `tsconfig.server.json`
- `vite.config.ts`
- `index.html`

작업:

- [ ] `package.json`을 작성한다.
- [ ] `ccusage`는 `"20.0.14"`로 고정한다.
- [ ] `express`, `react`, `react-dom`을 runtime dependency로 둔다.
- [ ] `typescript`, `vite`, `vitest`, `tsx`, `concurrently`, React Testing Library 관련 패키지를 dev dependency로 둔다.
- [ ] script는 `dev`, `build`, `start`, `test`, `test:watch`를 제공한다.
- [ ] `npm run dev`는 Express와 Vite를 함께 실행한다.
- [ ] Vite dev server는 `/api`를 Express `http://127.0.0.1:4317`로 proxy한다.
- [ ] `npm start`는 빌드된 Express 서버를 실행하고 정적 Vite build를 serve한다.
- [ ] `index.html`의 `lang`은 `ko`다.

검증:

- [ ] `npm install`이 성공하고 `package-lock.json`이 생성된다.
- [ ] `npm run build`는 아직 소스가 없어서 실패할 수 있다. 실패 사유가 누락 소스 파일이면 다음 작업으로 진행한다.

### Task 2. 샘플 확인과 fixture 준비

파일:

- `tests/fixtures/ccusage-daily.json`
- `tests/fixtures/codex-rate-limits.json`

작업:

- [ ] 공개 `ccusage` JSON 문서의 daily output 구조를 기준으로 정제된 `ccusage` fixture를 작성한다.
- [ ] 실제 로컬 `ccusage codex daily --json` 출력 확인은 별도 명시 승인이 없으면 실행하지 않는다.
- [ ] 실제 출력 확인을 하지 못했다는 점을 구현 매핑 문서의 남은 리스크에 기록한다.
- [ ] Codex App Server fixture는 기존 조사 결과의 `rateLimits`, `rateLimitsByLimitId`, `primary`, `secondary`, `usedPercent`, `windowDurationMins`, `resetsAt`, `planType`만 포함하는 정제본으로 작성한다.
- [ ] 실제 `ccusage` 실행이 인증, 로컬 데이터 없음, 또는 환경 문제로 불가능하면 이 단계에서 막지 않는다. 대신 공개 문서 또는 기존 조사 기반 fixture를 사용하고 남은 리스크에 기록한다.

검증:

- [ ] fixture에 원본 JSON 전체, token, 인증값, 환경 변수 전체, 민감한 사용자 경로가 없다.
- [ ] fixture가 스펙의 필수 파싱 조건을 테스트할 수 있다.

### Task 3. 공유 타입, 날짜, 프로세스, sanitization, debug store

파일:

- `server/data/types.ts`
- `server/data/date.ts`
- `server/utils/process.ts`
- `server/utils/sanitize.ts`
- `server/data/debugStore.ts`

작업:

- [ ] API 계약의 타입을 정의한다.
- [ ] 로컬 날짜 key 생성 함수와 최근 7일 날짜 key 생성 함수를 작성한다.
- [ ] epoch seconds를 ISO 문자열로 바꾸는 함수를 작성한다.
- [ ] timeout이 있는 child process 실행 helper를 작성한다.
- [ ] stdout JSON 파싱 helper를 작성한다.
- [ ] 에러 메시지 sanitization helper를 작성한다.
- [ ] debug store에 최근 에러, 소스별 마지막 성공 시각, 마지막 실패 시각을 저장한다.
- [ ] 테스트 초기화를 위한 debug store clear 함수는 테스트 전용으로만 export한다.

검증:

- [ ] sanitization 테스트 또는 service 테스트에서 token과 사용자 경로가 redaction 되는지 확인한다.

### Task 4. `ccusage` 파서와 실행기

파일:

- `server/data/ccusage.test.ts`
- `server/data/ccusage.ts`

작업:

- [ ] 테스트를 먼저 작성한다.
- [ ] 오늘 사용량을 로컬 날짜 기준으로 찾는 테스트를 작성한다.
- [ ] 최근 7일 추이를 날짜 오름차순으로 만들고 누락 날짜를 0으로 채우는 테스트를 작성한다.
- [ ] 확인된 비용 필드를 읽는 테스트를 작성한다.
- [ ] 후보 비용 필드 `totalCost`, `costUSD` 중 샘플과 맞는 필드를 우선 지원한다.
- [ ] 샘플이 다른 비용 필드를 사용하면 `costField: "other"`를 기록하고 parser와 테스트에 명시적으로 반영한다.
- [ ] 필수 필드가 잘못되면 throw 하는 테스트를 작성한다.
- [ ] 프로젝트 로컬 bin의 `ccusage`를 실행하는 함수를 작성한다.
- [ ] 실행 timeout은 20초로 둔다.

검증:

- [ ] `npm run test -- server/data/ccusage.test.ts`가 통과한다.

### Task 5. Codex App Server 파서와 JSON-RPC 클라이언트

파일:

- `server/data/codexAppServer.test.ts`
- `server/data/codexAppServer.ts`

작업:

- [ ] 테스트를 먼저 작성한다.
- [ ] Codex bucket을 5시간/1주 window로 매핑하는 테스트를 작성한다.
- [ ] 추가 bucket이 있을 때 Codex bucket이 먼저 반환되는 테스트를 작성한다.
- [ ] Codex bucket 누락을 실패로 처리하는 테스트를 작성한다.
- [ ] 잘못된 `usedPercent`를 실패로 처리하는 테스트를 작성한다.
- [ ] `resetsAt` epoch seconds를 ISO 문자열로 바꾸는 테스트를 작성한다.
- [ ] `codex app-server`를 stdio로 실행하는 클라이언트를 작성한다.
- [ ] JSON-RPC 요청은 `jsonrpc` 필드를 생략하고 `id`, `method`, `params`만 보낸다.
- [ ] `initialize`, `initialized`, `account/rateLimits/read` 순서로 호출한다.
- [ ] timeout은 20초로 둔다.
- [ ] stderr를 포함한 에러는 상위 service에서 sanitization 될 수 있게 Error로 전달한다.

검증:

- [ ] `npm run test -- server/data/codexAppServer.test.ts`가 통과한다.

### Task 6. 대시보드 service와 디버그 응답

파일:

- `server/data/dashboardService.test.ts`
- `server/data/dashboardService.ts`

작업:

- [ ] 테스트를 먼저 작성한다.
- [ ] 두 데이터 소스 성공 시 `status: "ok"` 테스트를 작성한다.
- [ ] `ccusage`만 실패하면 `status: "partial"`, `today: null`, `trend: []` 테스트를 작성한다.
- [ ] Codex App Server만 실패하면 `status: "partial"`, `limits: []` 테스트를 작성한다.
- [ ] 둘 다 실패하면 `status: "error"` 테스트를 작성한다.
- [ ] 실패한 소스 메시지가 sanitization 되는 테스트를 작성한다.
- [ ] 성공 시 `lastSuccessAt`, 실패 시 `lastFailureAt`이 갱신되는 테스트를 작성한다.
- [ ] `/api/debug` payload가 파싱 요약, 최근 에러, 마지막 성공/실패 시각을 포함하는 테스트를 작성한다.
- [ ] `/api/debug` payload에 원본 JSON 전체가 없다는 테스트를 작성한다.
- [ ] `Promise.allSettled`로 두 데이터 소스를 독립 조회한다.

검증:

- [ ] `npm run test -- server/data/dashboardService.test.ts`가 통과한다.

### Task 7. Express API 서버

파일:

- `server/index.ts`

작업:

- [ ] `GET /api/dashboard`를 구현한다.
- [ ] `GET /api/debug`를 구현한다.
- [ ] production build의 정적 파일을 serve한다.
- [ ] SPA fallback은 `/api` 라우트 뒤에 둔다.
- [ ] listen 주소는 `127.0.0.1`, 기본 port는 `4317`이다.
- [ ] 예기치 못한 500 응답도 sanitization 된 메시지만 반환한다.

검증:

- [ ] `npm run dev`에서 Express가 `http://127.0.0.1:4317`에 뜬다.
- [ ] Vite가 `http://127.0.0.1:5173`에 뜬다.

### Task 8. 프론트엔드 API 클라이언트와 polling hook

파일:

- `src/api.ts`
- `src/useDashboardData.ts`
- `src/useDashboardData.test.tsx`

작업:

- [ ] `fetchDashboard()`와 `fetchDebug()`를 작성한다.
- [ ] page load 시 즉시 조회하는 hook을 작성한다.
- [ ] 60초 자동 갱신을 구현한다.
- [ ] 수동 새로고침을 노출한다.
- [ ] 요청 진행 중 중복 refresh를 무시한다.
- [ ] 갱신 중에는 기존 data를 유지하고 `refreshing`을 true로 둔다.
- [ ] 다음 자동 갱신까지 남은 초를 1초 단위로 갱신한다.
- [ ] fetch 자체가 실패하면 error banner에 쓸 message를 상태로 둔다.

검증:

- [ ] mount 직후 fetch가 호출되는 테스트를 작성한다.
- [ ] 60초 뒤 fetch가 다시 호출되는 테스트를 작성한다.
- [ ] 진행 중 refresh 중복 호출이 추가 fetch를 만들지 않는 테스트를 작성한다.
- [ ] countdown 값이 1초 단위로 변하는 테스트를 작성한다.
- [ ] `npm run test -- src/useDashboardData.test.tsx`가 통과한다.

### Task 9. 대시보드 UI

파일:

- `src/main.tsx`
- `src/App.tsx`
- `src/pages/DashboardPage.tsx`
- `src/components/MetricCard.tsx`
- `src/components/LimitMeter.tsx`
- `src/components/SourceStatusPanel.tsx`
- `src/components/TrendChart.tsx`
- `src/styles.css`

작업:

- [ ] React entry와 app shell을 작성한다.
- [ ] `/`와 `/debug` 경로를 분기한다.
- [ ] 상단 navigation을 제공한다.
- [ ] 오늘 토큰 metric을 표시한다.
- [ ] 오늘 비용 metric을 USD로 표시한다.
- [ ] 마지막 갱신 시각을 표시한다.
- [ ] 전체 상태 `ok`, `partial`, `error`를 표시한다.
- [ ] 다음 자동 갱신까지 남은 시간을 표시한다.
- [ ] 수동 새로고침 버튼을 표시하고 갱신 중 disable 한다.
- [ ] 5시간/1주 limit 사용률을 meter와 텍스트로 표시한다.
- [ ] meter width는 0-100 범위로 clamp 하되 텍스트는 원본 `usedPercent`를 표시한다.
- [ ] 추가 limit bucket은 주요 Codex bucket보다 낮은 우선순위로 표시한다.
- [ ] 최근 7일 추이를 CSS/SVG 기반으로 표시한다.
- [ ] `ccusage` 실패 시 오늘 토큰, 오늘 비용, 추이를 사용할 수 없음으로 표시한다.
- [ ] Codex App Server 실패 시 limit 영역을 사용할 수 없음으로 표시한다.
- [ ] 데이터 소스별 성공/실패 상태와 메시지를 표시한다.
- [ ] 실패한 데이터 소스의 이전 성공 값을 현재 값처럼 표시하지 않는다.
- [ ] 화면에 노출되는 텍스트는 한국어로 작성한다.

검증:

- [ ] React Testing Library 또는 수동 확인으로 부분 실패 상태가 올바르게 보이는지 확인한다.
- [ ] `npm run build`는 `DebugPage` 작성 전까지 실패할 수 있다. 실패 사유가 `DebugPage` 누락이면 Task 10으로 진행한다.

### Task 10. 디버그 페이지

파일:

- `src/pages/DebugPage.tsx`
- `src/styles.css`

작업:

- [ ] `fetchDebug()`로 디버그 응답을 조회한다.
- [ ] `ccusage` 파싱 요약을 표시한다.
- [ ] Codex App Server 파싱 요약을 표시한다.
- [ ] 각 소스의 마지막 성공 시각과 마지막 실패 시각을 표시한다.
- [ ] 최근 에러 로그를 표시한다.
- [ ] 원본 JSON 전체를 화면에 표시하지 않는다.
- [ ] 화면에 노출되는 텍스트는 한국어로 작성한다.

검증:

- [ ] `npm run build`가 통과한다.

### Task 11. 전체 검증

작업:

- [ ] 전체 테스트를 실행한다.
- [ ] production build를 실행한다.
- [ ] production server를 실행한다.
- [ ] `/api/dashboard`를 조회한다.
- [ ] `/api/debug`를 조회한다.
- [ ] 브라우저에서 `/`를 확인한다.
- [ ] 브라우저에서 `/debug`를 확인한다.

검증:

- [ ] `npm run test`가 통과한다.
- [ ] `npm run build`가 통과한다.
- [ ] `npm start`가 `http://127.0.0.1:4317`에서 실행된다.
- [ ] `/api/dashboard`가 계약과 맞는 JSON을 반환한다.
- [ ] `/api/debug`가 원본 JSON 전체 없이 요약과 에러 로그를 반환한다.
- [ ] `/`에서 오늘 토큰/비용, 최근 7일 추이, 5시간/1주 사용률, 데이터 소스별 상태가 보인다.
- [ ] `/debug`에서 파싱 요약, 최근 에러, 마지막 성공/실패 시각이 보인다.
- [ ] 한 데이터 소스가 실패해도 성공한 데이터 소스 영역은 표시된다.
- [ ] 실패한 데이터 소스의 이전 성공 값은 현재 값처럼 표시되지 않는다.

### Task 12. 구현 항목 매핑 문서

파일:

- `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`

작업:

- [ ] 구현이 끝난 뒤 실제 생성된 파일과 검증 결과를 기준으로 매핑 문서를 작성한다.
- [ ] 검증 결과는 실제 실행 후의 PASS/FAIL로만 기록한다.
- [ ] 검증 전 PASS를 미리 쓰지 않는다.

매핑에 포함할 항목:

- 오늘 토큰/비용.
- 최근 7일 추이.
- 5시간/1주 사용률.
- 데이터 소스별 부분 실패 처리.
- 디버그 요약.
- 최근 에러 로그.
- 마지막 성공/실패 시각.
- 60초 자동 갱신.
- 수동 새로고침 중복 요청 방지.
- 개발/실행 명령.

검증:

- [ ] 매핑 문서가 공식 스펙 문서와 공식 구현 계획 문서 경로를 포함한다.
- [ ] 매핑 문서가 실제 검증 명령과 결과를 포함한다.

## 테스트 매트릭스

필수 자동 테스트:

- `ccusage` JSON 파서가 오늘 사용량과 최근 7일 추이를 만든다.
- `ccusage` JSON 파서가 로컬 PC 날짜 기준 최근 7일을 만들고 누락 날짜를 0으로 채운다.
- `ccusage` JSON 파서가 확인된 비용 필드를 사용한다.
- `ccusage` JSON 파서가 필수 필드 누락을 실패로 처리한다.
- Codex App Server rate limit 파서가 5시간/1주 사용률을 만든다.
- Codex App Server rate limit 파서가 Codex bucket을 먼저 반환한다.
- Codex App Server rate limit 파서가 Codex bucket 누락과 잘못된 `usedPercent`를 실패로 처리한다.
- 두 데이터 소스 성공 시 `status`가 `ok`가 된다.
- 한쪽 데이터 소스만 실패하면 `status`가 `partial`이 된다.
- 양쪽 데이터 소스가 실패하면 `status`가 `error`가 된다.
- 실패 메시지가 sanitization 된다.
- `/api/debug` 응답이 마지막 성공/실패 시각을 포함한다.
- `/api/debug` 응답이 원본 JSON 전체 없이 요약과 에러 로그를 반환한다.
- 자동 갱신 주기가 60초다.
- 다음 자동 갱신 countdown이 갱신된다.
- 수동 새로고침 중 중복 요청을 막는다.

필수 수동 검증:

- `npm run dev`로 앱을 실행한다.
- `/`에서 오늘 토큰/비용, 최근 7일 추이, 5시간/1주 사용률을 확인한다.
- `/`에서 데이터 소스별 성공/실패 상태를 확인한다.
- `/debug`에서 파싱 요약, 최근 에러, 마지막 성공/실패 시각을 확인한다.
- `npm run build`가 통과한다.
- `npm start`로 빌드된 앱이 실행된다.

## 스펙 확인 필요 항목

- 실제 로컬 `ccusage codex daily --json` 비용 필드명은 별도 명시 승인이 있을 때만 로컬 데이터로 확인한다.
- 자동 구현/검증에서는 공개 문서와 정제 fixture 근거를 구현 단계 결과 패킷에 기록해야 한다.
- `codex app-server` 프로토콜 또는 `account/rateLimits/read` 응답 구조가 현재 조사와 다르면 안정 API처럼 전제하지 말고 구현 단계에서 차단 또는 리스크로 반환해야 한다.

## 남은 리스크

- `ccusage` JSON 스키마가 고정 버전 안에서도 문서와 다를 수 있다.
- Codex App Server는 버전 변경 가능성이 있다.
- 로컬 Codex 로그인 상태나 네트워크 상태에 따라 App Server 조회가 실패할 수 있다.
- 비용 값은 `ccusage` 계산 기준에 의존한다.
- 실제 구현 전에는 구현 항목 매핑 문서의 PASS/FAIL을 확정할 수 없다.

## 자기 점검

- 오늘 토큰/비용: Task 4, Task 6, Task 9에서 다룬다.
- 최근 7일 추이: Task 4, Task 9에서 다룬다.
- 5시간/1주 사용률: Task 5, Task 9에서 다룬다.
- 페이지 로드시 즉시 조회와 60초 갱신: Task 8에서 다룬다.
- 프로젝트 고정 `ccusage`: Task 1, Task 2, Task 4에서 다룬다.
- 로컬 PC 시간대: Task 3, Task 4에서 다룬다.
- 두 페이지 구성: Task 9, Task 10에서 다룬다.
- 파싱 요약, 최근 에러, 마지막 성공/실패 시각: Task 6, Task 10에서 다룬다.
- 부분 실패 처리: Task 6, Task 9에서 다룬다.
- 실패한 데이터의 이전 성공값 미표시: Task 6, Task 9, Task 11에서 다룬다.
- `npm run dev`와 `npm start`: Task 1, Task 7, Task 11에서 다룬다.
- MVP 범위 초과 기능: 계획에 포함하지 않았다.

## 실행 메모

이 계획은 MyOneLoop `better-impl-doc` 단계가 끝난 뒤 구현 승인 단계에서 검토한다. 구현, git commit, push, PR 생성은 이 문서만으로 승인된 것이 아니다.
