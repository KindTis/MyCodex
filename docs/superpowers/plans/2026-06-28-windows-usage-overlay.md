# Codex 사용량 윈도우 오버레이 구현 계획

> **에이전트용 실행 지침:** 이 계획을 실제 구현할 때는 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`를 사용해 작업 단위별로 진행한다. 단계 추적은 체크박스(`- [ ]`) 형식을 유지한다.

**목표:** 기존 Codex 사용량 대시보드의 데이터 수집 로직을 공유하면서, Windows에서 항상 위에 떠 있는 Electron 오버레이로 오늘 토큰, 오늘 비용, 5시간 limit, 1주 limit을 표시한다.

**아키텍처:** 웹 대시보드는 기존 Express HTTP 경로를 유지하고, Electron 오버레이는 main process에서 `dashboardService`를 직접 호출한다. 공통 타입과 표시 view model은 `shared/`로 이동해 웹, Electron IPC, renderer가 같은 계약을 사용한다.

**기술 스택:** TypeScript, React, Vite, Electron, Express, Vitest, React Testing Library, `ccusage`, Codex App Server

---

## 기준 문서

- 스펙: `docs/superpowers/specs/2026-06-28-windows-usage-overlay-design.md`
- 기존 웹 대시보드 계획: `docs/superpowers/plans/2026-06-26-codex-usage-dashboard.md`
- 기존 구현 지도: `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`

## 성공 기준

- `npm run test`가 통과한다.
- `npm run build`가 웹 renderer, 오버레이 renderer, Electron main/preload를 함께 빌드한다.
- `npm run dev:overlay`로 패키징 없이 오버레이를 개발 실행할 수 있다.
- `npm run start:overlay`로 빌드 후 오버레이를 실행할 수 있다.
- 오버레이 창은 `280 x 168`, `frame: false`, `alwaysOnTop: true`, `transparent: true`, `resizable: false` 조건을 만족한다.
- renderer 전역에는 `window.codexOverlay`만 노출되고, overlay 창과 settings 창은 서로 다른 IPC surface를 갖는다.
- 설정 저장, 창 위치 저장, 실행 로그, 종료 cleanup은 스펙의 실패 처리 규칙을 따른다.

## 범위

포함한다.

- Electron 기반 Windows 오버레이 앱.
- 오버레이 renderer와 설정 renderer를 위한 `overlay.html`, `settings.html`.
- 공통 대시보드 타입, 설정 타입, 표시 view model.
- Electron main/preload, IPC, native context menu, singleton settings window.
- 설정 JSON 저장소와 writer queue.
- 창 위치 저장과 복원 검증.
- 실행 로그와 1MB rotate.
- active child process 추적과 종료 시 best-effort cleanup.
- 자동 테스트와 수동 검증 체크리스트.

포함하지 않는다.

- 시스템 트레이 상주.
- OS 로그인 시 자동 실행.
- 앱 패키징과 설치 파일 생성.
- 실패 시 이전 성공값을 현재값처럼 표시하는 캐시 UI.
- 사용자 창 크기 조절.
- `ccusage` 또는 Codex App Server 장기 실행 프로세스 재사용.

## 파일 구조

생성할 파일:

- `shared/dashboardTypes.ts`
- `shared/overlaySettings.ts`
- `shared/usageSnapshot.ts`
- `shared/usageSnapshot.test.ts`
- `overlay.html`
- `settings.html`
- `tsconfig.electron.json`
- `electron/appLog.ts`
- `electron/appLog.test.ts`
- `electron/childTracker.ts`
- `electron/childTracker.test.ts`
- `electron/contextMenu.ts`
- `electron/contextMenu.test.ts`
- `electron/ipcContract.ts`
- `electron/ipcContract.test.ts`
- `electron/ipcHandlers.ts`
- `electron/ipcHandlers.test.ts`
- `electron/mainLifecycle.ts`
- `electron/mainLifecycle.test.ts`
- `electron/main.ts`
- `electron/preload.ts`
- `electron/preloadContract.ts`
- `electron/preloadContract.test.ts`
- `electron/rendererSecuritySmoke.test.ts`
- `electron/settingsStore.ts`
- `electron/settingsStore.test.ts`
- `electron/windowConfig.ts`
- `electron/windowConfig.test.ts`
- `electron/windowBounds.ts`
- `electron/windowBounds.test.ts`
- `src/windows/OverlayApp.tsx`
- `src/windows/OverlayApp.test.tsx`
- `src/windows/SettingsDialog.tsx`
- `src/windows/SettingsDialog.test.tsx`
- `src/windows/overlayMain.tsx`
- `src/windows/settingsMain.tsx`
- `src/windows/overlay.css`
- `src/windows/windowApi.ts`
- `src/windows/windowApi.test.ts`
- `docs/implementation/2026-06-28-windows-usage-overlay-implementation-map.md`
- `server/data/date.test.ts`
- `server/utils/process.test.ts`

수정할 파일:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.server.json`
- `vite.config.ts`
- `server/data/types.ts`
- `server/data/date.ts`
- `server/data/ccusage.ts`
- `server/data/ccusage.test.ts`
- `server/data/codexAppServer.ts`
- `server/data/codexAppServer.test.ts`
- `server/data/dashboardService.ts`
- `server/data/dashboardService.test.ts`
- `server/utils/process.ts`
- `src/api.ts`

## 핵심 계약

### 공통 대시보드 타입

`shared/dashboardTypes.ts`가 `DashboardResponse`, `DashboardRequest`, `DebugResponse`, `LimitBucket`, `LimitWindow`, `SourceStatus`의 단일 정의가 된다. `server/data/types.ts`는 서버 전용 report/debug helper 타입만 보유하고, 공통 응답 타입은 `shared/dashboardTypes.ts`에서 re-export하거나 import한다. `src/api.ts`는 대시보드 타입을 직접 선언하지 않는다.

### 공통 설정 타입

`shared/overlaySettings.ts`는 다음 타입과 validation 상수를 제공한다.

```ts
export type OverlaySettings = {
  panelAlphaPercent: number;
  refreshIntervalSeconds: number;
  windowPosition?: { x: number; y: number };
};

export type SettingsUpdateInput = {
  panelAlphaPercent: number;
  refreshIntervalSeconds: number;
};

export type SettingsUpdateResult =
  | { ok: true; settings: OverlaySettings }
  | {
      ok: false;
      formError?: string;
      fieldErrors: {
        panelAlphaPercent?: string;
        refreshIntervalSeconds?: string;
      };
    };
```

기본값은 `panelAlphaPercent: 50`, `refreshIntervalSeconds: 5`다. 허용 범위는 패널 알파 `20-100`, 갱신 주기 `5-300` 정수다.

### 표시 view model

`shared/usageSnapshot.ts`는 renderer가 직접 숫자 포맷과 상태 판정을 만들지 않게 다음 순수 함수를 제공한다.

```ts
export type UsageSnapshotInput =
  | { kind: "pending" }
  | { kind: "response"; response: DashboardResponse }
  | { kind: "exception"; caughtAt: Date };

export type UsageSnapshotViewModel = {
  statusTone: "pending" | "ok" | "fail";
  todayTokensText: string;
  todayCostText: string;
  fiveHourLimitText: string;
  fiveHourLimitFillPercent: number;
  oneWeekLimitText: string;
  oneWeekLimitFillPercent: number;
  updatedAtText: string;
};

export function toUsageSnapshotViewModel(input: UsageSnapshotInput): UsageSnapshotViewModel;
```

### Electron 실행 로그 경계

`server/data/debugStore.ts`의 전역 `debugStore`는 웹/API 디버그 응답용 메모리 상태만 관리한다. Electron 오버레이의 파일 로그는 `electron/appLog.ts`와 Electron main process가 담당하며, `<userData>/logs/app.log`에 기록한다. 두 로그 경로는 서로 대체하지 않는다.

Express 경로는 기존 전역 `dashboardService`와 전역 `debugStore`를 계속 사용한다. Electron 경로는 `createDashboardService()`를 새로 만들 때 Electron 전용 isolated `new DebugStore()`를 `store`로 주입한다. Electron `usage.getSnapshot`이 만든 성공/실패 debug 상태는 웹 `/api/debug` 응답에 노출되지 않는다. Electron source별 실패 로그는 `DashboardResponse.sources`를 기준으로 `appLog`에 남긴다.

필수 로그 이벤트는 다음 계약으로 구현한다.

| 이벤트 | 소유자 | 트리거 | 필수 기록 필드 | 검증 |
|---|---|---|---|---|
| 앱 시작/종료 | `electron/main.ts` | ready, 종료 cleanup 전후 | event, timestamp | 수동 검증 |
| 두 번째 실행 요청 | `electron/main.ts` | `second-instance` | event, timestamp | 수동 검증 |
| 설정 읽기/보정/저장 실패 | `electron/settingsStore.ts` 호출부 | load, normalization write, user write 실패 | event, sanitized message | `electron/settingsStore.test.ts`, 수동 로그 확인 |
| 창 위치 복원/보정/저장 실패 | `electron/main.ts`, `electron/windowBounds.ts` 호출부 | 창 생성, 이동 debounce, 종료 저장 | event, bounds summary, sanitized message | `electron/windowBounds.test.ts`, 수동 로그 확인 |
| 사용량 조회 시작/완료 | `electron/main.ts` | `usage.getSnapshot` IPC 처리 전후 | event, startedAt 또는 generatedAt, status, today summary, limit summary | 수동 로그 확인 |
| source별 실패 | `electron/main.ts` | `DashboardResponse.status`가 `partial` 또는 `error` | source, generatedAt, sanitized message | 수동 로그 확인 |
| 조회 예외와 IPC 처리 실패 | `electron/main.ts` | IPC handler throw | channel, sanitized message | 수동 로그 확인 |
| 종료 cleanup 실패 | `electron/main.ts`, `electron/childTracker.ts` 호출부 | 마지막 위치 저장, writer queue flush, active child cleanup 실패 | event, sanitized message | `electron/childTracker.test.ts`, 수동 로그 확인 |

`electron/appLog.ts`는 sanitize, append, rotate만 책임진다. 어떤 이벤트를 언제 남길지는 Electron main/settings/window lifecycle 경로가 책임진다.

### 종료 상태 IPC 계약

Electron main process가 shutdown을 시작하면 새 저장/조회 작업을 시작하지 않는다.

| 경로 | 종료 상태 동작 | 저장/조회 | 이벤트 | 로그 |
|---|---|---|---|---|
| `settings.update` | `{ ok: false, fieldErrors: {}, formError }` 반환 | 파일 write와 in-memory commit 없음 | `settings.changed` 없음 | sanitized log |
| `updateWindowPosition` | 반환값 없이 거부 | 파일 write 없음 | `settings.changed` 없음 | sanitized log |
| `usage.getSnapshot` | deterministic Error reject | `dashboardService.getDashboard()`와 reader 시작 없음 | 없음 | sanitized log |

`electron/ipcHandlers.ts`는 shutdown guard를 주입받아 이 계약을 테스트 가능한 단위로 구현한다. renderer는 `usage.getSnapshot` reject를 조회 예외로 받아 `toUsageSnapshotViewModel({ kind: "exception" })` 표시 규칙을 따른다.

종료 중 마지막 창 위치 저장은 IPC/일반 debounce 저장이 아니라 Electron main 내부의 종료 전용 final save다. Electron main은 shutdown guard를 먼저 세워 새 IPC를 막고, 현재 overlay bounds를 캡처한 뒤 `settingsStore.beginShutdown(finalWindowPosition)`에 한 번만 전달한다. 그 이후 일반 `updateWindowPosition()` 호출은 저장하지 않는다.

### IPC sender 권한 계약

preload surface 분리는 편의 계층이고, 최종 권한 검증은 Electron main process의 IPC handler가 수행한다. Main process는 생성한 BrowserWindow의 `webContents.id`를 `overlay` 또는 `settings` kind로 등록하고, handler마다 `event.sender.id`의 kind를 확인한다.

| IPC | 허용 sender kind | 거부 시 동작 |
|---|---|---|
| `usage.getSnapshot` | `overlay` | `dashboardService.getDashboard()` 호출 없이 deterministic Error reject |
| `settings.get` | `overlay`, `settings` | unknown/destroyed sender는 deterministic Error reject |
| `settings.update` | `settings` | 저장, in-memory commit, `settings.changed` 발행 없이 `{ ok: false, fieldErrors: {}, formError }` 반환 |
| `settings.changed` | main -> overlay event only | renderer에서 직접 호출할 channel 없음 |

unknown sender, destroyed window sender, 허용 kind와 다른 sender는 민감 IPC에서 모두 거부한다. 이 거부는 sanitized log 대상이며, 데이터 조회, 설정 저장, broadcast 같은 부수효과를 만들지 않는다.

## 작업 계획

### Task 1: 공통 타입과 TypeScript 빌드 경로 정리

**Files:**
- Create: `shared/dashboardTypes.ts`
- Modify: `server/data/types.ts`
- Modify: `src/api.ts`
- Modify: `tsconfig.json`
- Modify: `tsconfig.server.json`
- Modify: `package.json`

- [ ] **Step 1: 공통 타입 파일을 만든다**

`server/data/types.ts`와 `src/api.ts`에 중복된 대시보드 응답 타입을 `shared/dashboardTypes.ts`로 옮긴다. `DashboardRequest`도 공통 타입으로 함께 둔다.

- [ ] **Step 2: 서버 타입 파일을 서버 전용 타입으로 줄인다**

`server/data/types.ts`는 다음 항목을 `shared/dashboardTypes.ts`에서 import하고, `CcusageReport`, `CodexRateLimitReport`, `CcusageSummary`, `CodexAppServerSummary`, `empty*Summary`만 직접 유지한다.

```ts
export type {
  DashboardRequest,
  DashboardResponse,
  DebugResponse,
  LimitBucket,
  LimitWindow,
  SourceName,
  SourceStatus,
  TodayUsage,
  TrendPoint
} from "../../shared/dashboardTypes.js";
```

- [ ] **Step 3: 프론트엔드 API 타입 중복을 제거한다**

`src/api.ts`는 타입 선언을 삭제하고 다음 import를 사용한다.

```ts
import type { DashboardResponse, DebugResponse } from "../shared/dashboardTypes";
export type { DashboardResponse, DebugResponse } from "../shared/dashboardTypes";
```

- [ ] **Step 4: TypeScript include와 서버 출력 경로를 조정한다**

`tsconfig.json`의 `include`에 `shared`와 `electron`을 추가한다. `tsconfig.server.json`은 `shared`를 컴파일할 수 있도록 `rootDir`을 `"."`, `outDir`을 `"dist"`로 바꾸고 `include`에 `shared/**/*.ts`를 추가한다. `npm start`는 기존처럼 `node dist/server/index.js`를 유지한다.

- [ ] **Step 5: 타입 빌드를 검증한다**

Run: `npm run build`

Expected: 이 단계에서는 Electron 파일이 아직 없어도 웹/server 빌드가 유지된다. 실패한다면 실패가 `shared` import path 또는 server output path 문제인지 확인하고 이 task 안에서 해결한다.

### Task 2: 날짜, ccusage, Codex limit 계약을 스펙 수준으로 강화

**Files:**
- Modify: `server/data/date.ts`
- Create: `server/data/date.test.ts`
- Modify: `server/data/ccusage.ts`
- Modify: `server/data/ccusage.test.ts`
- Modify: `server/data/codexAppServer.ts`
- Modify: `server/data/codexAppServer.test.ts`
- Modify: `server/data/dashboardService.ts`
- Modify: `server/data/dashboardService.test.ts`

- [ ] **Step 1: 로컬 날짜 key validation 테스트를 작성한다**

`server/data/date.test.ts`에 다음 케이스를 추가한다.

- `2026-06-08`은 유효하다.
- `2026-6-8`은 무효다.
- `2026-02-30`은 무효다.
- 빈 문자열은 무효다.
- UTC 날짜와 로컬 날짜가 다를 수 있는 `new Date(2026, 5, 28, 0, 30, 0)`도 `getLocalDateKey()`가 로컬 생성자 기준 날짜를 반환한다.

- [ ] **Step 2: 날짜 validation helper를 구현한다**

`server/data/date.ts`에 `isValidLocalDateKey(value: string): boolean`을 추가한다. 정규식 `^\d{4}-\d{2}-\d{2}$`를 통과한 뒤 `new Date(year, month - 1, day)`로 실제 calendar date인지 확인한다.

- [ ] **Step 3: ccusage row validation 테스트를 작성한다**

`server/data/ccusage.test.ts`에 다음 케이스를 추가한다.

- non-today row라도 `date`가 잘못되면 throw한다.
- `totalTokens`가 `null`, 문자열, `NaN`, `Infinity`, 음수면 throw한다.
- 선택된 비용 필드가 `null`, 문자열, `NaN`, `Infinity`, 음수면 throw한다.
- payload에 `totalCost`가 하나라도 있으면 응답 단위 비용 필드는 `totalCost`이고, 해당 필드가 누락된 row가 있으면 throw한다.
- 오늘 row가 없고 나머지 row가 정상인 경우만 today를 0으로 정규화한다.

- [ ] **Step 4: ccusage parser를 강화한다**

`normalizeRow()`는 `isValidLocalDateKey(row.date)`, 0 이상 finite number token, 0 이상 finite number cost를 요구한다. `detectCostField()`가 `totalCost`를 우선하고 없을 때만 `costUSD`를 선택한다.

- [ ] **Step 5: Codex representative bucket validation 테스트를 작성한다**

`server/data/codexAppServer.test.ts`에 다음 케이스를 추가한다.

- `primary.usedPercent` 또는 `secondary.usedPercent`가 음수면 throw한다.
- `primary.windowDurationMins !== 300`이면 throw한다.
- `secondary.windowDurationMins !== 10080`이면 throw한다.
- `primary` 또는 `secondary`가 `null` 또는 누락이면 throw한다.
- 첫 bucket이 `chatgpt`이고 뒤에 `codex`가 있을 때도 `codex`만 대표로 사용한다.

- [ ] **Step 6: Codex parser를 강화한다**

`parseCodexRateLimits()`에서 대표 `codex` bucket의 `primary`와 `secondary`를 strict mode로 파싱하고, duration까지 검증한다. 추가 bucket은 기존처럼 best-effort로 파싱하되 대표 bucket fallback으로 사용하지 않는다.

- [ ] **Step 7: `generatedAt` 생성 시점을 응답 조립 완료 시점으로 이동한다**

현재 `dashboardService.getDashboard()`는 reader 실행 전에 `generatedAt`을 만든다. `Promise.allSettled()` 이후에 `const generatedAt = now().toISOString();`를 만들도록 바꾼다. `SourceStatus.checkedAt`도 같은 값을 사용한다.

- [ ] **Step 8: Electron isolated debug store 테스트를 작성한다**

`server/data/dashboardService.test.ts`에 Electron 전용 isolated `DebugStore`를 주입한 service 호출이 전역 `debugStore`와 웹 `/api/debug` 상태를 오염시키지 않는 테스트를 추가한다.

- [ ] **Step 9: 데이터 계약 테스트를 실행한다**

Run: `npm run test -- server/data/date.test.ts server/data/ccusage.test.ts server/data/codexAppServer.test.ts server/data/dashboardService.test.ts`

Expected: 모든 테스트 PASS.

### Task 3: 표시 요약 view model 추가

**Files:**
- Create: `shared/usageSnapshot.ts`
- Create: `shared/usageSnapshot.test.ts`

- [ ] **Step 1: 실패하는 view model 테스트를 작성한다**

`shared/usageSnapshot.test.ts`에 다음 케이스를 작성한다.

- `pending`은 `statusTone: "pending"`, 모든 값 `--`, `updatedAtText: "--:--:--"`를 반환한다.
- 두 source가 모두 성공인 response는 `statusTone: "ok"`를 반환한다.
- source 하나라도 실패한 response는 `statusTone: "fail"`를 반환한다.
- ccusage 실패 response는 오늘 토큰/비용이 `--`이고 limit 값은 표시한다.
- Codex App Server 실패 response는 오늘 토큰/비용이 표시되고 limit 값은 `--`다.
- `usedPercent: 123.4`는 text `123%`, fill `100`이다.
- 오늘 비용은 `$0.0000`처럼 소수 4자리 고정이다.
- 성공 response의 `generatedAt`은 로컬 `HH:mm:ss` 형식의 `updatedAtText`로 변환된다.
- `exception`은 `statusTone: "fail"`, 모든 값 `--`, `caughtAt`의 로컬 `HH:mm:ss`를 반환한다.

- [ ] **Step 2: 순수 함수를 구현한다**

`toUsageSnapshotViewModel()`은 오직 `DashboardResponse`와 `Date` 입력으로 문자열을 만든다. renderer에서 `Intl.NumberFormat`, percent clamp, Codex bucket 찾기, source 상태 판정을 다시 구현하지 않는다.

- [ ] **Step 3: view model 테스트를 실행한다**

Run: `npm run test -- shared/usageSnapshot.test.ts`

Expected: PASS.

### Task 4: active child process 추적 가능한 reader 경로 만들기

**Files:**
- Modify: `server/utils/process.ts`
- Create: `server/utils/process.test.ts`
- Modify: `server/data/ccusage.ts`
- Modify: `server/data/codexAppServer.ts`
- Modify: `server/data/ccusage.test.ts`
- Modify: `server/data/codexAppServer.test.ts`
- Create: `electron/childTracker.ts`
- Create: `electron/childTracker.test.ts`

- [ ] **Step 1: process helper 확장 테스트를 작성한다**

`runProcess()` 옵션에 `onChild?: (child: ChildProcess) => void`를 추가하는 테스트를 작성한다. child가 spawn된 직후 `onChild`가 한 번 호출되어야 한다.

- [ ] **Step 2: `runProcess()`에 child callback을 추가한다**

`server/utils/process.ts`의 `RunProcessOptions`에 `onChild`를 추가하고, `spawn()` 직후 호출한다.

- [ ] **Step 3: ccusage reader factory를 추가한다**

`server/data/ccusage.ts`에 `createCcusageDailyReader({ onChild } = {})`를 추가하고 기존 `readCcusageDaily`는 이 factory의 기본 인스턴스로 둔다. 기존 public behavior는 유지한다.

- [ ] **Step 4: Codex reader factory를 추가한다**

`server/data/codexAppServer.ts`에 `createCodexRateLimitsReader({ onChild } = {})`를 추가한다. `spawn()` 직후 `onChild(child)`를 호출하고 기존 `readCodexRateLimits`는 기본 인스턴스로 둔다.

- [ ] **Step 5: child tracker를 구현한다**

`electron/childTracker.ts`는 active child set을 관리한다. 완료된 child는 set에서 제거하고, `cleanup({ timeoutMs: 2000 })`은 남은 child에 `kill()`을 호출한 뒤 close/error/timeout 중 먼저 끝나는 결과를 기다린다.

- [ ] **Step 6: child tracker 테스트를 실행한다**

Run: `npm run test -- electron/childTracker.test.ts server/data/ccusage.test.ts server/data/codexAppServer.test.ts`

Expected: PASS.

### Task 5: Electron 빌드 스캐폴드와 실행 명령 추가

**Files:**
- Create: `tsconfig.electron.json`
- Create: `overlay.html`
- Create: `settings.html`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `src/windows/OverlayApp.tsx`
- Create: `src/windows/SettingsDialog.tsx`
- Create: `src/windows/overlayMain.tsx`
- Create: `src/windows/settingsMain.tsx`
- Create: `src/windows/overlay.css`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Electron 의존성을 추가한다**

Run: `npm install -D electron wait-on`

Expected: `package.json`과 `package-lock.json`에 `electron`, `wait-on`이 추가된다.

- [ ] **Step 2: Electron tsconfig를 만든다**

`tsconfig.electron.json`은 `rootDir: "."`, `outDir: "dist/electron"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `types: ["node"]`를 사용한다. include는 `electron/**/*.ts`, `server/**/*.ts`, `shared/**/*.ts`이고 exclude는 `**/*.test.ts`다.

- [ ] **Step 3: Vite multi-page input을 추가한다**

`vite.config.ts`의 `build.rollupOptions.input`에 `index.html`, `overlay.html`, `settings.html`을 등록한다. outDir은 기존 `dist/client`를 유지한다. 개발 서버는 `host: "127.0.0.1"`, `port: 5173`, `strictPort: true`를 명시해 Electron dev URL과 포트 계약이 어긋나지 않게 한다.

- [ ] **Step 4: overlay/settings HTML entry를 만든다**

`overlay.html`은 `src/windows/overlayMain.tsx`를 entry로 사용한다. `settings.html`은 `src/windows/settingsMain.tsx`를 entry로 사용한다. 두 HTML의 `lang`은 `ko`다.

- [ ] **Step 5: 최소 Electron/renderer stub을 만든다**

이 단계의 stub은 빌드 경로 검증용이다. Task 9-11에서 실제 창, IPC, renderer 동작으로 확장한다.

`electron/main.ts`:

```ts
import { app } from "electron";

void app.whenReady().then(() => {
  app.quit();
});
```

`electron/preload.ts`:

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("codexOverlay", {});
```

`src/windows/OverlayApp.tsx`:

```tsx
export function OverlayApp() {
  return <main className="overlay-panel">CODEX USAGE</main>;
}
```

`src/windows/SettingsDialog.tsx`:

```tsx
export function SettingsDialog() {
  return <main className="settings-panel">Overlay settings</main>;
}
```

`src/windows/overlayMain.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { OverlayApp } from "./OverlayApp";
import "./overlay.css";

createRoot(document.getElementById("root") as HTMLElement).render(<OverlayApp />);
```

`src/windows/settingsMain.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { SettingsDialog } from "./SettingsDialog";
import "./overlay.css";

createRoot(document.getElementById("root") as HTMLElement).render(<SettingsDialog />);
```

`src/windows/overlay.css`:

```css
body {
  margin: 0;
  background: transparent;
  color: #f4fff7;
  font-family: "Segoe UI", system-ui, sans-serif;
}
```

- [ ] **Step 6: package script를 추가한다**

`package.json` scripts를 다음 의도로 수정한다.

```json
{
  "build": "tsc -p tsconfig.server.json && tsc -p tsconfig.electron.json && vite build",
  "dev:overlay": "concurrently -k \"vite --host 127.0.0.1 --port 5173 --strictPort\" \"tsc -p tsconfig.electron.json --watch --preserveWatchOutput\" \"wait-on http://127.0.0.1:5173/overlay.html http://127.0.0.1:5173/settings.html dist/electron/electron/main.js && electron dist/electron/electron/main.js --dev\"",
  "start:overlay": "electron dist/electron/electron/main.js"
}
```

기존 `dev`, `start`, `test`, `test:watch`는 웹 대시보드용으로 유지한다.

- [ ] **Step 7: 빌드 스캐폴드를 검증한다**

Run: `npm run build`

Expected: PASS. 이 단계의 Electron 앱은 즉시 종료되는 stub이지만, TypeScript와 Vite multi-page build 경로는 모두 검증된다.

### Task 6: 설정 저장소 구현

**Files:**
- Create: `shared/overlaySettings.ts`
- Create: `electron/settingsStore.ts`
- Create: `electron/settingsStore.test.ts`

- [ ] **Step 1: 설정 validation 테스트를 작성한다**

`electron/settingsStore.test.ts`에 다음 케이스를 작성한다.

- 설정 파일이 없으면 기본 설정을 반환한다.
- 정상 JSON은 그대로 반환한다.
- 일부 필드가 범위 밖이면 해당 필드만 기본값으로 보정하고 정상 필드는 보존한다.
- `windowPosition`이 없으면 정상 설정으로 취급한다.
- `windowPosition`의 `x` 또는 `y`가 누락, 문자열, `NaN`, `Infinity`이면 `windowPosition`만 제거하고 다른 정상 필드는 보존한다.
- malformed JSON은 전체 기본 설정으로 대체한다.
- normalization write 실패 시 보정된 in-memory 설정을 반환하고 changed event는 발생하지 않는다.
- `settings.update` 입력이 문자열 숫자, `NaN`, `Infinity`, 비정수, 누락 필드를 포함하면 `{ ok: false, fieldErrors }`를 반환한다.
- 입력이 plain object가 아니거나 extra field를 포함하면 `{ ok: false, fieldErrors: {}, formError }`를 반환한다.
- 사용자 설정 파일 write 실패는 in-memory commit 없이 `{ ok: false, fieldErrors: {}, formError }`를 반환한다.
- 정상 저장은 기존 `windowPosition`을 보존한다.
- 창 위치 저장은 `settings.changed` 이벤트를 발행하지 않는다.
- 설정 저장과 창 위치 저장이 연속으로 들어와도 서로의 필드를 덮어쓰지 않는다.
- 일반 실행 중 창 위치 write 실패는 in-memory `windowPosition`을 유지한다.
- `beginShutdown(finalWindowPosition)`은 종료 전용 마지막 위치 저장을 writer queue에 한 번만 넣고 flush 대상에 포함한다.
- 종료 전용 마지막 위치 저장은 `settings.changed` 이벤트를 발행하지 않는다.
- 종료 전용 마지막 위치 저장 write 실패는 sanitized log 대상이며 종료를 막지 않는다.
- `beginShutdown()` 이후 일반 `settings.update`와 일반 `updateWindowPosition`은 저장하지 않는다.
- `shuttingDown` 이후 `settings.update`는 `{ ok: false, fieldErrors: {}, formError }`를 반환하고 `settings.changed` 이벤트를 발행하지 않는다.

- [ ] **Step 2: 공통 설정 타입과 validation 함수를 만든다**

`shared/overlaySettings.ts`는 `DEFAULT_OVERLAY_SETTINGS`, `validateSettingsUpdateInput()`, `normalizeStoredSettings()`를 제공한다. field error 메시지는 짧은 한국어 문장으로 고정한다. `normalizeStoredSettings()`는 사용자 편집 필드와 `windowPosition` shape를 함께 검증하되, malformed `windowPosition`은 전체 설정 초기화가 아니라 `windowPosition` 제거로 보정한다.

- [ ] **Step 3: writer queue를 구현한다**

`electron/settingsStore.ts`는 `load()`, `get()`, `updateEditableSettings()`, `updateWindowPosition()`, `flush()`, `beginShutdown(finalWindowPosition?)`을 제공한다. 모든 파일 write는 내부 promise queue로 직렬화한다.

설정 파일 load 중 `windowPosition`이 보정되면 정규화 재저장과 sanitized log를 남긴다. 이 normalization write는 `settings.changed` 이벤트를 발행하지 않는다.

- [ ] **Step 4: 설정 저장소 테스트를 실행한다**

Run: `npm run test -- electron/settingsStore.test.ts`

Expected: PASS.

### Task 7: 실행 로그, 창 보안 설정, 창 위치 helper 추가

**Files:**
- Create: `electron/appLog.ts`
- Create: `electron/appLog.test.ts`
- Create: `electron/windowConfig.ts`
- Create: `electron/windowConfig.test.ts`
- Create: `electron/windowBounds.ts`
- Create: `electron/windowBounds.test.ts`

- [ ] **Step 1: 로그 테스트를 작성한다**

`electron/appLog.test.ts`에 다음 케이스를 작성한다.

- 로그 메시지에 `sanitizeMessage()`가 적용된다.
- `app.log`가 1MB 초과면 `app.previous.log`로 rotate하고 새 `app.log`를 시작한다.
- 보관 파일은 `app.previous.log` 하나만 유지한다.
- 로그 write 실패는 호출자를 crash시키지 않고 reject 또는 sanitized failure result로 표현한다.

- [ ] **Step 2: 로그 모듈을 구현한다**

`electron/appLog.ts`는 `createAppLog({ logDir })`를 제공한다. 로그 위치는 main process에서 `<userData>/logs`를 주입한다. 원본 JSON과 stack 전체를 기록하지 않는다.

- [ ] **Step 3: Electron window config 테스트를 작성한다**

`electron/windowConfig.test.ts`에 다음 케이스를 작성한다.

- overlay window 옵션은 `280 x 168`, `frame: false`, `alwaysOnTop: true`, `transparent: true`, `resizable: false`, `show: false`다.
- overlay/settings window 모두 `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `preload`, `additionalArguments`를 가진다.
- settings window 옵션은 `360 x 240`, `title: "Overlay settings"`, `resizable: false`다.
- 개발 모드 overlay kind는 strict port `5173`의 `http://127.0.0.1:5173/overlay.html`만 허용하고 `settings.html`은 거부한다.
- 개발 모드 settings kind는 strict port `5173`의 `http://127.0.0.1:5173/settings.html`만 허용하고 `overlay.html`은 거부한다.
- 빌드 모드 overlay kind는 `dist/client/overlay.html`만 허용하고 settings kind는 `dist/client/settings.html`만 허용한다.
- 각 kind는 서로의 HTML entry로 이동하려는 navigation을 거부한다.
- `openSettings`, `quit`, `close`용 IPC channel 또는 renderer API가 없다.

- [ ] **Step 4: Electron window config helper를 구현한다**

`electron/windowConfig.ts`는 BrowserWindow option 생성, renderer entry 결정, window kind별 navigation 허용 여부 판단을 순수 함수로 제공한다. `electron/main.ts`는 이 helper를 사용하고, `will-navigate`와 `setWindowOpenHandler`는 해당 window kind의 허용 URL 판단을 따른다.

- [ ] **Step 5: 창 위치 계산 테스트를 작성한다**

`electron/windowBounds.test.ts`에 다음 케이스를 작성한다.

- 저장된 `280 x 168` bounds 전체가 target display workArea 안에 있으면 그대로 복원한다.
- 좌, 상, 우, 하 중 하나라도 벗어나면 기본 위치로 보정한다.
- 기본 위치는 primary display workArea의 오른쪽 위 24px offset이다.
- malformed `windowPosition` shape 검증은 `windowBounds`가 아니라 `settingsStore`/`normalizeStoredSettings()` 책임이다.

- [ ] **Step 6: 창 위치 helper를 구현한다**

`electron/windowBounds.ts`는 Electron `screen` 객체에 직접 의존하지 않고 display-like input을 받는 순수 함수로 만든다. main process에서 `screen.getDisplayMatching(savedBounds)`와 `screen.getPrimaryDisplay()` 결과를 이 helper에 넘긴다. 이 helper는 이미 shape 검증을 통과한 finite `{ x, y }`만 입력으로 받는다.

- [ ] **Step 7: 로그, window config, bounds 테스트를 실행한다**

Run: `npm run test -- electron/appLog.test.ts electron/windowConfig.test.ts electron/windowBounds.test.ts`

Expected: PASS.

### Task 8: preload 계약과 renderer 전역 타입 구현

**Files:**
- Create: `electron/ipcContract.ts`
- Create: `electron/ipcContract.test.ts`
- Create: `electron/preloadContract.ts`
- Create: `electron/preloadContract.test.ts`
- Modify: `electron/preload.ts`
- Create: `src/windows/windowApi.ts`
- Create: `src/windows/windowApi.test.ts`

- [ ] **Step 1: IPC channel 상수를 정의한다**

`electron/ipcContract.ts`에 다음 channel만 둔다.

```ts
export const IPC_CHANNELS = {
  usageGetSnapshot: "usage.getSnapshot",
  settingsGet: "settings.get",
  settingsUpdate: "settings.update",
  settingsChanged: "settings.changed"
} as const;
```

설정 창 열기, 앱 종료, 창 닫기 channel은 만들지 않는다.

- [ ] **Step 2: preload surface 테스트를 작성한다**

`electron/preloadContract.test.ts`에서 overlay kind는 `usage.getSnapshot`, `settings.get`, `settings.onChanged`만 제공하고 `settings.update`를 제공하지 않는지 검증한다. settings kind는 `settings.get`, `settings.update`만 제공하고 `usage.getSnapshot`, `settings.onChanged`를 제공하지 않는지 검증한다.

- [ ] **Step 3: preload contract factory를 구현한다**

`createCodexOverlayApi(kind, ipcRendererLike)`를 만들고, `electron/preload.ts`는 `process.argv`의 `--codex-overlay-window=overlay` 또는 `--codex-overlay-window=settings` 값으로 kind를 결정해 `contextBridge.exposeInMainWorld("codexOverlay", api)`만 호출한다.

- [ ] **Step 4: renderer global 타입과 accessor를 만든다**

`src/windows/windowApi.ts`는 `getCodexOverlayApi()`를 제공한다. API가 없으면 명확한 Error를 throw한다. 이 파일에 `declare global { interface Window { codexOverlay?: ... } }`를 둔다.

- [ ] **Step 5: preload/window API 테스트를 실행한다**

Run: `npm run test -- electron/preloadContract.test.ts src/windows/windowApi.test.ts`

Expected: PASS.

### Task 9: Electron main process, IPC, window 보안 구현

**Files:**
- Modify: `electron/main.ts`
- Create: `electron/contextMenu.ts`
- Create: `electron/contextMenu.test.ts`
- Create: `electron/mainLifecycle.ts`
- Create: `electron/mainLifecycle.test.ts`
- Modify: `electron/ipcContract.ts`
- Create: `electron/ipcHandlers.ts`
- Create: `electron/ipcHandlers.test.ts`
- Modify: `electron/windowConfig.ts`
- Modify: `server/data/ccusage.ts`
- Modify: `server/data/codexAppServer.ts`

- [ ] **Step 1: main process service composition을 작성한다**

Electron main은 `createDashboardService()`에 child tracking 가능한 `createCcusageDailyReader()`와 `createCodexRateLimitsReader()`, Electron 전용 isolated `new DebugStore()`를 주입한다. Express 서버는 기존 기본 `dashboardService`와 전역 `debugStore`를 계속 사용한다.

- [ ] **Step 2: 단일 인스턴스 lock을 구현한다**

`electron/mainLifecycle.test.ts`에 다음 케이스를 작성한다.

- `requestSingleInstanceLock()` 획득 실패 시 overlay window, settings window, dashboardService, settingsStore, IPC handler를 만들지 않고 `app.quit()`만 호출한다.
- `second-instance` 이벤트는 기존 overlay window의 `show()`와 `focus()`만 호출한다.
- `second-instance` 이벤트는 새 overlay window, settings window, dashboardService, settingsStore, polling loop, writer queue를 만들지 않는다.

`app.requestSingleInstanceLock()` 실패 시 즉시 종료한다. `second-instance` 이벤트에서는 기존 overlay window를 `show()`와 `focus()`만 하고 새 polling loop나 settings store를 만들지 않는다.

`electron/mainLifecycle.ts`는 Electron app lifecycle을 테스트 가능한 함수로 분리한다. `electron/main.ts`는 실제 Electron `app`, BrowserWindow factory, service/settings factory를 이 lifecycle 함수에 주입한다.

- [ ] **Step 3: overlay BrowserWindow를 만든다**

overlay window 옵션은 `electron/windowConfig.ts`의 helper로 만들고, 값은 `width: 280`, `height: 168`, `frame: false`, `alwaysOnTop: true`, `transparent: true`, `resizable: false`, `show: false`, `webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload, additionalArguments: ["--codex-overlay-window=overlay"] }`를 사용한다. 최초 표시 순서는 저장된 위치 검증과 bounds 적용, renderer load, `ready-to-show` 이후 `show()`다. 최초 실행에서는 새 overlay window를 만든 뒤 이 순서로만 표시한다.

위치 복원은 `settingsStore.load()`가 정규화한 `windowPosition`만 사용한다. `windowPosition`이 malformed라서 제거되었거나 없으면 기본 오른쪽 위 위치를 사용한다. shape가 유효한 위치가 display workArea 밖이면 `windowBounds`가 기본 오른쪽 위 위치로 보정한다.

- [ ] **Step 4: settings BrowserWindow를 singleton으로 만든다**

settings window 옵션도 `electron/windowConfig.ts`의 helper로 만들고, 값은 `width: 360`, `height: 240`, `title: "Overlay settings"`, `resizable: false`, 동일 보안 옵션, `additionalArguments: ["--codex-overlay-window=settings"]`를 사용한다. 이미 열려 있으면 새 창을 만들지 않고 focus한다.

`electron/mainLifecycle.test.ts`에 settings window singleton 케이스를 추가한다.

- 첫 `Settings` action은 settings window factory를 한 번 호출한다.
- 두 번째 `Settings` action은 factory를 다시 호출하지 않고 기존 settings window의 `show()`와 `focus()`만 호출한다.
- settings window `closed` 이후 다시 `Settings` action을 호출하면 새 settings window를 한 번 만든다.
- settings singleton 경로는 새 dashboardService, settingsStore, writer queue를 만들지 않는다.

- [ ] **Step 5: renderer load 규칙을 구현한다**

`--dev`가 있으면 overlay window는 strict port `5173`의 `http://127.0.0.1:5173/overlay.html`만 로드하고, settings window는 `http://127.0.0.1:5173/settings.html`만 로드한다. 빌드 모드에서는 overlay window가 `dist/client/overlay.html`, settings window가 `dist/client/settings.html`을 `loadFile()`로 로드한다. 허용 URL/파일 판정은 `electron/windowConfig.ts`의 window kind별 helper와 같은 기준을 사용한다.

renderer load 실패(`did-fail-load` 또는 `loadURL`/`loadFile` reject)는 sanitized log를 남긴다. load 실패 상태에서는 빈 overlay를 성공처럼 보여주지 않는다.

- [ ] **Step 6: navigation hardening을 구현한다**

overlay/settings `webContents`에 `will-navigate`와 `setWindowOpenHandler`를 설정한다. 해당 window kind에 허용된 단일 entry URL이 아니면 navigation을 막고, 새 창 생성은 항상 `deny`한다. overlay window가 `settings.html`로, settings window가 `overlay.html`로 이동하려는 경우도 차단한다.

- [ ] **Step 7: IPC handler 테스트를 작성한다**

`electron/ipcHandlers.test.ts`에 다음 케이스를 작성한다.

- 정상 `usage.getSnapshot`은 `dashboardService.getDashboard()` 결과를 반환한다.
- 정상 `usage.getSnapshot`을 두 번 호출하면 `dashboardService.getDashboard()`를 두 번 호출하고, 각 호출 결과를 그대로 반환한다.
- `dashboardService.getDashboard()`가 `partial` 또는 `error` 응답을 반환하면 조회 완료 로그와 실패 source별 sanitized log를 남기고 IPC/조회 예외 로그는 남기지 않는다.
- `dashboardService.getDashboard()`가 throw하면 IPC/조회 예외 로그를 남기고 reject한다.
- settings sender가 `usage.getSnapshot`을 호출하면 `dashboardService.getDashboard()`와 reader를 시작하지 않고 deterministic Error reject를 반환한다.
- shutdown 이후 `usage.getSnapshot`은 `dashboardService.getDashboard()`와 reader를 시작하지 않고 deterministic Error reject를 반환한다.
- overlay sender와 settings sender 모두 `settings.get`을 호출할 수 있다.
- 정상 `settings.update` 성공은 overlay window에 `settings.changed` 이벤트를 한 번 보낸다.
- overlay sender가 `settings.update`를 호출하면 저장과 `settings.changed` 이벤트 없이 `{ ok: false, fieldErrors: {}, formError }`를 반환한다.
- unknown 또는 destroyed sender는 민감 IPC에서 저장/조회/broadcast 없이 거부된다.
- shutdown 이후 `settings.update`는 `{ ok: false, fieldErrors: {}, formError }`를 반환하고 저장과 `settings.changed` 이벤트를 수행하지 않는다.
- shutdown 이후 `updateWindowPosition`은 파일 저장을 수행하지 않고 sanitized log만 남긴다.

- [ ] **Step 8: IPC handler를 등록한다**

`electron/ipcHandlers.ts`는 `usage.getSnapshot`, `settings.get`, `settings.update` handler를 만든다. `usage.getSnapshot`은 shutting down 상태가 아니면 `dashboardService.getDashboard()`를 호출한다. 호출 전에는 로그 전용 `startedAt`을 남기고, 응답 반환 시에는 `generatedAt`, `status`, 오늘 토큰/비용 요약, 5시간/1주 사용률 요약을 로그에 남긴다. response가 `partial` 또는 `error`이면 실패 source별 sanitized log를 남긴다. 조회 자체가 throw하면 sanitized 예외 로그를 남기고 throw한다.

`usage.getSnapshot` handler는 snapshot cache, last-success fallback, memoized promise를 갖지 않는다. 허용된 overlay sender와 shutdown 아님 조건에서는 호출마다 새 `dashboardService.getDashboard()` 결과를 반환한다.

Electron source별 실패 로그는 Electron 전용 service가 반환한 `DashboardResponse.sources`만 사용한다. 이 로그 기록은 웹 전역 `debugStore`나 `/api/debug` 상태를 갱신하지 않는다.

`settings.get`은 보정된 전체 설정을 반환한다. `settings.update`는 settings window에서 온 호출만 처리하고 성공 시 overlay window에 `settings.changed` payload를 보낸다.

- 모든 IPC handler는 `IPC sender 권한 계약`을 먼저 검사한다. preload에 노출되지 않은 API라도 renderer가 직접 channel을 호출할 수 있다고 가정하고 main process에서 다시 거부한다.
- shutdown 이후 `settings.update`, `updateWindowPosition`, `usage.getSnapshot`은 `종료 상태 IPC 계약`을 따른다.

- [ ] **Step 9: native context menu를 연결한다**

`electron/contextMenu.test.ts`에 다음 케이스를 작성한다.

- overlay `webContents.on("context-menu", ...)` handler가 등록된다.
- handler는 Electron native `Menu` factory로 `Settings`, `Quit` 항목을 만든다.
- handler는 Electron native `Menu.popup()`을 한 번 호출한다.
- `Settings` click은 main process 내부 settings singleton open 함수만 호출한다.
- `Quit` click은 main process 내부 quit 함수만 호출한다.
- renderer preload/API/IPC에는 context menu, open settings, quit 경로가 없다.

`electron/contextMenu.ts`는 native context menu 생성과 handler 등록을 테스트 가능한 함수로 제공한다. overlay `webContents`의 `context-menu` 이벤트에서 main process가 native `Menu`를 열고 `Settings`, `Quit` 항목을 표시한다. renderer DOM 메뉴는 만들지 않는다.

- [ ] **Step 10: 창 위치 저장과 종료 경로를 연결한다**

overlay `moved` 또는 `move` 이벤트에서 500ms debounce 후 일반 `settingsStore.updateWindowPosition()`을 호출한다. 앱 종료 시작 시 main-level shutdown guard를 먼저 세워 새 IPC와 새 debounce 저장을 막고, pending debounce를 취소한 뒤 현재 overlay bounds를 캡처한다. 이후 `settingsStore.beginShutdown(finalWindowPosition)`을 호출해 종료 전용 마지막 위치 저장을 writer queue에 한 번만 넣고 flush한다. 마지막 위치 저장, writer queue flush, active child cleanup은 최대 2초 수행한 뒤 종료한다.

`electron/mainLifecycle.test.ts`에 fake timer 기반 창 이동 debounce 케이스를 추가한다. 연속 `move`/`moved` 이벤트 중에는 저장하지 않고, 마지막 이벤트 후 500ms가 지나면 마지막 bounds의 `{ x, y }`만 한 번 `settingsStore.updateWindowPosition()`으로 저장한다. 종료 시작 시에는 pending debounce를 취소하고 `beginShutdown(finalWindowPosition)` 경로만 사용한다.

- [ ] **Step 11: Electron 로그 이벤트 경계를 연결한다**

`debugStore`는 웹/API 디버그 응답용으로 유지하고 Electron 파일 로그에 의존하지 않는다. Electron main/settings/window lifecycle 경로는 `Electron 실행 로그 경계` 표의 필수 이벤트를 `appLog`로 기록한다. 로그 메시지는 `sanitizeMessage()`를 통과한 요약만 남긴다.

overlay lifecycle 로그에는 위치 복원 결과, renderer load 성공/실패, 최초 `show()` 실행 여부를 포함한다. 두 번째 실행 요청은 기존 창이 숨겨져 있더라도 `show()` 후 `focus()`만 수행하고 새 창을 만들지 않았음을 로그에 남긴다.

위치 복원 로그는 `windowPosition` shape 보정과 display workArea 밖 bounds 보정을 구분한다. 두 경우 모두 `settings.changed` 이벤트를 발행하지 않는다.

- [ ] **Step 12: Electron main build와 IPC/window config 테스트를 검증한다**

Run: `npm run build`

Run: `npm run test -- electron/ipcHandlers.test.ts electron/windowConfig.test.ts`

Expected: 둘 다 PASS.

### Task 10: 오버레이 renderer와 polling 구현

**Files:**
- Modify: `src/windows/OverlayApp.tsx`
- Create: `src/windows/OverlayApp.test.tsx`
- Modify: `src/windows/overlayMain.tsx`
- Modify: `src/windows/overlay.css`

- [ ] **Step 1: renderer polling 테스트를 작성한다**

`src/windows/OverlayApp.test.tsx`에 다음 케이스를 작성한다.

- mount 직후 `settings.get()`을 호출해 저장된 `panelAlphaPercent`와 `refreshIntervalSeconds`를 읽는다.
- mount 직후 `usage.getSnapshot()`을 한 번 호출한다.
- 저장된 `panelAlphaPercent`가 초기 hydration 후 패널 CSS 변수에 반영된다.
- 저장된 `refreshIntervalSeconds`가 첫 polling interval 생성에 사용된다.
- `settings.get()`이 실패하면 기본 설정 `panelAlphaPercent: 50`, `refreshIntervalSeconds: 5`로 fallback하고 polling은 계속 시작한다.
- 기본 설정 `refreshIntervalSeconds: 5`이면 5초 뒤 다시 호출한다.
- 진행 중인 조회가 끝나지 않았을 때 timer tick이 와도 두 번째 조회를 시작하지 않는다.
- settings.changed payload를 받으면 `settings.get()` 재호출 없이 panel alpha와 polling interval을 바꾼다.
- unmount 후 interval이 제거되고 `settings.onChanged` unsubscribe가 호출된다.
- unmount 후 늦게 완료된 snapshot은 화면 상태를 갱신하지 않는다.
- `usage.getSnapshot()` 예외는 `toUsageSnapshotViewModel({ kind: "exception" })` 결과를 표시한다.

- [ ] **Step 2: 오버레이 UI를 구현한다**

오버레이는 mount 시 `settings.get()`과 첫 `usage.getSnapshot()`을 시작한다. 첫 사용량 조회는 저장 설정 hydration과 독립적으로 즉시 시작한다. polling interval은 `settings.get()` 성공 후 저장된 `refreshIntervalSeconds`로 만들고, `settings.get()` 실패 시 기본 5초로 만든다. 패널 알파는 hydration 전 기본 50%를 쓰고, `settings.get()` 성공 후 저장된 `panelAlphaPercent`를 적용한다.

오버레이는 `UsageSnapshotViewModel`만 렌더링한다. 화면 텍스트는 `CODEX USAGE`, `TODAY TOKENS`, `TODAY COST`, `5H LIMIT`, `1W LIMIT`과 값, 마지막 갱신 시각만 둔다. 실패 원인 문장은 표시하지 않는다.

- [ ] **Step 3: CSS를 구현한다**

`src/windows/overlay.css`는 `body`를 투명 배경으로 두고, 패널에만 `background: rgba(24, 33, 29, var(--panel-alpha))`를 적용한다. 창 전체 drag는 `-webkit-app-region: drag`, 값 선택이나 설정 창 버튼 영역은 `-webkit-app-region: no-drag`를 사용한다. status spine과 status dot은 `pending`, `ok`, `fail` tone에 따라 색을 바꾼다.

- [ ] **Step 4: renderer entry를 만든다**

`src/windows/overlayMain.tsx`는 `OverlayApp`을 `#root`에 mount하고 `overlay.css`만 import한다. 웹 대시보드의 `src/styles.css`는 import하지 않는다.

- [ ] **Step 5: 오버레이 테스트를 실행한다**

Run: `npm run test -- src/windows/OverlayApp.test.tsx`

Expected: PASS.

### Task 11: 설정 다이얼로그 renderer 구현

**Files:**
- Modify: `src/windows/SettingsDialog.tsx`
- Create: `src/windows/SettingsDialog.test.tsx`
- Modify: `src/windows/settingsMain.tsx`
- Modify: `src/windows/overlay.css`

- [ ] **Step 1: 설정 다이얼로그 테스트를 작성한다**

`src/windows/SettingsDialog.test.tsx`에 다음 케이스를 작성한다.

- mount 시 `settings.get()`으로 초기값을 채운다.
- 패널 배경 투명도 slider와 number 표시가 같은 값을 공유한다.
- 갱신 주기 number input이 초 단위 정수를 보낸다.
- 저장 성공 시 `window.close()`를 호출한다.
- field error가 있으면 해당 필드 아래에 짧게 표시하고 창을 닫지 않는다.
- form error가 있으면 하단에 표시하고 창을 닫지 않는다.
- Cancel은 `settings.update()` 없이 `window.close()`를 호출한다.

- [ ] **Step 2: SettingsDialog를 구현한다**

설정 창은 `settings.update({ panelAlphaPercent, refreshIntervalSeconds })`만 호출한다. 창 닫기 IPC를 만들지 않고 저장 성공 또는 Cancel에서 `window.close()`를 호출한다.

- [ ] **Step 3: settings renderer entry를 만든다**

`src/windows/settingsMain.tsx`는 `SettingsDialog`를 mount한다. 설정 창은 불투명 일반 배경을 사용하고 오버레이 패널 알파를 적용하지 않는다.

- [ ] **Step 4: 설정 다이얼로그 테스트를 실행한다**

Run: `npm run test -- src/windows/SettingsDialog.test.tsx`

Expected: PASS.

### Task 12: 빌드, 보안, 통합 검증 테스트 보강

**Files:**
- Modify: `electron/contextMenu.test.ts`
- Modify: `electron/preloadContract.test.ts`
- Modify: `electron/ipcHandlers.test.ts`
- Modify: `electron/mainLifecycle.test.ts`
- Create: `electron/rendererSecuritySmoke.test.ts`
- Modify: `electron/windowConfig.test.ts`
- Modify: `electron/windowBounds.test.ts`
- Modify: `src/windows/OverlayApp.test.tsx`
- Modify: `package.json`

- [ ] **Step 1: IPC surface 보안 테스트를 보강한다**

overlay API에는 `settings.update`가 없고, settings API에는 `usage.getSnapshot`과 `settings.onChanged`가 없음을 테스트한다. 어느 API에도 `openSettings`, `quit`, `close` 같은 window control 함수가 없어야 한다.

- [ ] **Step 2: Electron window 보안 테스트를 보강한다**

`electron/windowConfig.test.ts`에서 overlay/settings BrowserWindow option의 보안 플래그, window kind별 `additionalArguments`, dev/build 허용 entry, navigation deny 기준을 다시 확인한다. overlay kind는 `settings.html`을 거부하고 settings kind는 `overlay.html`을 거부해야 한다.

- [ ] **Step 3: renderer global isolation smoke 테스트를 추가한다**

`electron/rendererSecuritySmoke.test.ts`는 실제 Electron BrowserWindow를 테스트 harness로 띄워 overlay/settings renderer main world를 각각 probe한다. 각 window에서 `typeof window.codexOverlay === "object"`, `typeof process === "undefined"`, `typeof require === "undefined"`, `typeof ipcRenderer === "undefined"`를 확인한다. 이 테스트는 preload surface 테스트와 별개로 renderer 격리 계약을 검증한다.

- [ ] **Step 4: dev overlay command 계약을 확인한다**

`package.json`의 `dev:overlay`는 Vite를 `--host 127.0.0.1 --port 5173 --strictPort`로 실행하고, Electron 실행 전 `wait-on`으로 `http://127.0.0.1:5173/overlay.html`, `http://127.0.0.1:5173/settings.html`, `dist/electron/electron/main.js`를 모두 기다린다.

- [ ] **Step 5: shutdown IPC 계약 테스트를 보강한다**

`electron/ipcHandlers.test.ts`에서 shutdown 이후 `settings.update`, `updateWindowPosition`, `usage.getSnapshot`이 새 저장/조회 작업을 시작하지 않고, `settings.changed` 이벤트를 발행하지 않는지 확인한다.

- [ ] **Step 6: IPC sender authorization 테스트를 보강한다**

`electron/ipcHandlers.test.ts`에서 `usage.getSnapshot`, `settings.get`, `settings.update`의 sender kind별 허용/거부 matrix를 확인한다. 거부된 호출은 저장, 조회, `settings.changed` 발행을 수행하지 않아야 한다.

- [ ] **Step 7: 단일 인스턴스 lifecycle 테스트를 보강한다**

`electron/mainLifecycle.test.ts`에서 lock 실패와 `second-instance` 경로가 새 window, service, settings writer, polling loop를 만들지 않는지 확인한다.

- [ ] **Step 8: settings window singleton lifecycle 테스트를 보강한다**

`electron/mainLifecycle.test.ts`에서 `Settings` action 반복 호출이 새 settings window를 만들지 않고 기존 창을 `show()`/`focus()`만 하는지, `closed` 이후에는 새 창을 만들 수 있는지 확인한다.

- [ ] **Step 9: window move debounce lifecycle 테스트를 보강한다**

`electron/mainLifecycle.test.ts`에서 연속 `move`/`moved` 이벤트가 500ms debounce 후 마지막 위치 한 번만 저장하는지 fake timer로 확인한다. 종료 시작 시 pending debounce가 취소되고 final save 경로와 중복 저장되지 않아야 한다.

- [ ] **Step 10: native context menu handler 테스트를 보강한다**

`electron/contextMenu.test.ts`에서 overlay `webContents`의 `context-menu` 이벤트가 native `Menu`를 만들고 `Menu.popup()`을 한 번 호출하는지, `Settings`와 `Quit` action이 main process 내부 함수만 호출하는지 확인한다. renderer DOM 메뉴나 renderer IPC 경로는 만들지 않는다.

- [ ] **Step 11: 로그 이벤트 커버리지 체크리스트를 확인한다**

`Electron 실행 로그 경계` 표의 이벤트가 Task 7/9/13 검증 항목에 각각 연결되어 있는지 확인한다. 자동화하기 어려운 로그 이벤트는 Task 13 수동 검증 항목에 남긴다.

`electron/ipcHandlers.test.ts`의 fake `appLog` recorder로 `partial`/`error` 정상 응답의 source별 실패 로그와 `usage.getSnapshot()` throw의 IPC/조회 예외 로그가 서로 다른 이벤트로 기록되는지 확인한다.

- [ ] **Step 12: build command를 실행한다**

Run: `npm run build`

Expected: PASS. `dist/client/index.html`, `dist/client/overlay.html`, `dist/client/settings.html`, `dist/server/index.js`, `dist/electron/electron/main.js`, `dist/electron/electron/preload.js`가 생성된다.

- [ ] **Step 13: 전체 테스트를 실행한다**

Run: `npm run test`

Expected: PASS.

### Task 13: 수동 검증

**Files:**
- 소스 변경 없음.

- [ ] **Step 1: 개발 모드 오버레이를 실행한다**

Run: `npm run dev:overlay`

Expected: Vite dev server와 Electron overlay가 실행된다.

- [ ] **Step 2: 창 동작을 확인한다**

확인 항목:

- borderless 창이다.
- 항상 위에 떠 있다.
- 창 크기는 `280 x 168`로 고정이다.
- 창 전체를 드래그해 위치를 옮길 수 있다.
- 최초 실행에서 renderer load 이후 overlay window가 실제로 표시된다.
- 두 번째 실행 시 기존 overlay window가 숨겨져 있어도 다시 표시되고 focus된다.
- 오른쪽 클릭 메뉴에 `Settings`, `Quit`가 있다.
- `Quit`는 앱 프로세스를 종료한다.

- [ ] **Step 3: 표시 상태를 확인한다**

확인 항목:

- 첫 조회 전 값은 `--`, 마지막 갱신은 `--:--:--`다.
- 둘 다 성공하면 상태등과 spine이 초록색이다.
- ccusage 또는 Codex App Server 중 하나라도 실패하면 상태등과 spine이 빨간색이다.
- 실패 원인은 화면에 길게 표시되지 않고 로그에 남는다.
- 로그 파일에는 조회 시작, 조회 완료, 실패 source별 sanitized message가 구분되어 남는다.

- [ ] **Step 4: 설정 동작을 확인한다**

확인 항목:

- Settings 메뉴는 singleton 설정 창을 연다.
- 패널 배경 투명도를 바꾸면 오버레이 패널 배경에만 즉시 적용된다.
- 갱신 주기를 바꾸면 기존 polling timer가 새 주기로 바뀐다.
- 앱 재시작 후 설정값과 창 위치가 유지된다.
- 저장된 창 위치가 display workArea 밖이면 기본 오른쪽 위 위치로 보정된다.
- 설정 파일 보정, 사용자 설정 저장 실패, 창 위치 저장 실패는 화면 상태 변경 없이 sanitized log로 남는다.

- [ ] **Step 5: 빌드 후 실행을 확인한다**

Run: `npm run build`

Expected: PASS.

Run: `npm run start:overlay`

Expected: 빌드된 `overlay.html`과 `settings.html`을 사용해 오버레이가 실행된다.

- [ ] **Step 6: 수동 검증 증거를 남긴다**

Task 13의 각 확인 항목은 Task 14 구현 매핑 문서에 PASS/FAIL, 실행 명령, 확인 시각, 로그 파일 경로 또는 관찰 근거를 함께 기록한다. 실패 항목은 재현 절차와 관련 로그 이벤트 이름을 남긴다.

### Task 14: 구현 항목 매핑 문서 작성

**Files:**
- Create: `docs/implementation/2026-06-28-windows-usage-overlay-implementation-map.md`

- [ ] **Step 1: 실제 구현 파일 목록을 기록한다**

스펙의 주요 요구사항별로 실제 파일 경로를 매핑한다. 자동 테스트 결과를 실행 전 PASS로 쓰지 않는다.

- [ ] **Step 2: 자동 검증 결과를 기록한다**

다음 명령의 실제 결과를 기록한다.

```bash
npm run test
npm run build
```

- [ ] **Step 3: 수동 검증 결과를 기록한다**

`npm run dev:overlay`, `npm run start:overlay`, 창 동작, 설정 저장, 로그 파일 확인 결과를 PASS/FAIL로 기록한다. 로그 파일 확인에는 앱 시작/종료, 조회 시작/완료, source별 실패, 설정 변경, 위치 저장/보정, cleanup 실패 여부를 포함한다.

## 테스트 매트릭스

필수 자동 테스트:

- 공통 타입을 웹 API와 Electron IPC가 함께 사용한다.
- `generatedAt`은 두 reader settle 이후 생성된다.
- ccusage 날짜는 정확한 `YYYY-MM-DD` 실제 calendar date여야 한다.
- ccusage today row가 없으면 오늘 토큰과 비용이 0으로 표시된다.
- non-today malformed row도 ccusage 소스 실패가 된다.
- Codex 대표 bucket은 `id === "codex"`만 사용한다.
- Codex 대표 bucket의 `usedPercent`는 0 이상 finite number여야 한다.
- Codex 대표 bucket의 duration은 5시간 `300`, 1주 `10080`이어야 한다.
- 표시 view model은 pending, response, exception을 모두 처리한다.
- 표시 view model은 성공 response의 `generatedAt`을 로컬 `HH:mm:ss` `updatedAtText`로 변환한다.
- 단일 상태등은 두 source가 모두 성공할 때만 초록색이다.
- settings store는 기본값, 정상 저장값, 범위 밖 값, malformed JSON, write 실패를 처리한다.
- malformed `windowPosition`은 다른 정상 설정 필드를 보존한 채 제거되고 normalization write 대상이 된다.
- settings update validation은 문자열 숫자, `NaN`, `Infinity`, 누락 필드, extra field를 거부한다.
- settings changed 이벤트는 사용자 설정 저장 성공에만 발생한다.
- 창 위치 저장은 settings changed 이벤트를 발생시키지 않는다.
- 창 이동 이벤트가 연속으로 발생해도 마지막 이동 후 500ms 전에는 위치 저장을 반복하지 않고, 마지막 위치만 한 번 저장한다.
- shutdown 이후 `settings.update`, `updateWindowPosition`, `usage.getSnapshot`은 새 저장/조회 작업을 시작하지 않고 정해진 실패 계약을 따른다.
- 각 `usage.getSnapshot()` IPC 호출은 캐시된 이전 성공값이 아니라 새 `dashboardService.getDashboard()` 호출 결과를 반환한다.
- 종료 전용 마지막 창 위치 저장은 `beginShutdown(finalWindowPosition)`으로 한 번만 수행되고, 일반 `updateWindowPosition` 저장 금지 규칙과 구분된다.
- overlay renderer는 mount 시 `settings.get()`으로 저장 설정을 hydration하고 저장된 갱신 주기로 첫 polling interval을 만든다.
- renderer cleanup 이후 polling timer와 settings listener가 제거된다.
- 진행 중 조회가 있을 때 polling tick은 새 조회를 시작하지 않는다.
- preload는 window kind별로 허용된 API만 노출한다.
- renderer main world에는 `window.codexOverlay` 외에 `process`, `require`, `ipcRenderer` 같은 Node/Electron 전역이 없다.
- main IPC handler는 `event.sender`의 window kind를 검증해 채널별 허용 sender만 처리한다.
- 단일 인스턴스 lock 실패와 `second-instance` 경로는 새 window, service, polling loop, settings writer를 만들지 않는다.
- Settings action 반복 호출은 새 settings window를 만들지 않고 기존 창을 `show()`/`focus()`만 하며, 닫힌 뒤에는 새 settings window를 만들 수 있다.
- overlay context menu는 renderer DOM/IPC가 아니라 main process native `Menu` handler로 처리되며 `Menu.popup()`을 호출한다.
- overlay/settings BrowserWindow option은 보안 플래그와 window kind별 preload argument를 고정한다.
- overlay window는 `show: false`로 생성하되 renderer ready 이후 실제로 `show()`된다.
- overlay/settings navigation은 각 window kind에 허용된 단일 entry 외 URL과 새 창 생성을 차단한다.
- renderer load 실패는 sanitized log로 남고 빈 overlay를 성공 상태처럼 표시하지 않는다.
- windowPosition shape validation은 settings store가 담당하고, display workArea bounds validation은 window bounds helper가 담당한다.
- 로그 모듈은 sanitize와 rotate를 수행한다.
- Electron 파일 로그와 웹 `debugStore`는 서로 다른 책임을 가진다.
- Electron `dashboardService`는 전역 `debugStore` 대신 isolated `DebugStore`를 사용해 웹 `/api/debug` 상태를 오염시키지 않는다.
- Electron main/settings/window lifecycle은 필수 로그 이벤트를 sanitized summary로 기록한다.
- `partial`/`error` 정상 응답의 source별 실패 로그와 `usage.getSnapshot()` throw의 IPC/조회 예외 로그는 구분된다.
- child tracker는 shutdown cleanup을 수행한다.

필수 수동 검증:

- `npm run dev:overlay`로 오버레이를 실행한다.
- `npm run dev:overlay`는 Vite strict port `5173`, `overlay.html`, `settings.html` readiness를 기준으로 Electron을 실행한다.
- `npm run build` 후 `npm run start:overlay`로 오버레이를 실행한다.
- borderless, always on top, transparent, fixed size를 확인한다.
- 창 드래그와 위치 복원을 확인한다.
- native context menu와 singleton settings window를 확인한다.
- 설정 변경 즉시 반영과 재시작 후 유지 여부를 확인한다.
- 로그 파일 `<userData>/logs/app.log`에 앱 시작, 조회, 설정 변경, 실패 source가 기록되는지 확인한다.

## 남은 리스크

- `npm run dev:overlay`는 Electron main TypeScript watch 결과를 자동 재시작하지 않는다. main process 변경 후에는 Electron 프로세스를 재실행해야 한다.
- Electron 의존성 설치는 구현 시점의 package registry 상태에 의존한다. `package-lock.json`에 잠긴 버전을 기준으로 재현한다.
- 실제 Codex App Server 응답 스키마가 기존 fixture와 달라지면 parser 강화 작업에서 실패할 수 있다.
- 5초 polling은 child process 생성 비용과 로그 증가를 만들 수 있다. 이 최적화는 스펙상 후속 검토 항목이다.

## 자기 점검

- 스펙의 공통 타입 요구사항은 Task 1에서 다룬다.
- Windows 로컬 날짜와 strict `ccusage` validation은 Task 2에서 다룬다.
- 표시 문자열, 단일 상태등, progress clamp는 Task 3에서 다룬다.
- 종료 중 active child cleanup은 Task 4와 Task 9에서 다룬다.
- Electron 실행 명령과 build 경로는 Task 5에서 다룬다.
- 설정 저장 규칙과 writer queue는 Task 6에서 다룬다.
- 로그와 위치 복원은 Task 7과 Task 9에서 다룬다.
- IPC surface, preload 보안, renderer global 제한은 Task 8과 Task 12에서 다룬다.
- overlay 창 동작, native context menu, settings singleton은 Task 9에서 다룬다.
- polling single-flight와 cleanup은 Task 10에서 다룬다.
- 설정 다이얼로그 UI는 Task 11에서 다룬다.
- 자동/수동 검증과 구현 매핑은 Task 12, Task 13, Task 14에서 다룬다.

## 실행 메모

이 문서는 구현 계획이다. 실제 구현, git commit, push, PR 생성은 별도 요청이 있을 때만 진행한다.
