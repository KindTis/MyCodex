# Codex 사용량 윈도우 오버레이 설계

## 목적

기존 Codex 사용량 대시보드의 데이터 수집과 정규화 로직을 공통으로 사용하면서, 윈도우 데스크톱에서 항상 위에 떠 있는 작은 오버레이 앱으로 오늘 토큰, 오늘 비용, 5시간 limit 사용률, 1주 limit 사용률을 빠르게 확인한다.

웹 대시보드와 윈도우 앱은 같은 사용량 데이터를 읽되 표시 방식만 다르다. 데이터 수집, 에러 마스킹, limit 정규화, 타입 계약은 한 곳에서 관리한다.

여기서 “오늘”은 앱이 실행되는 Windows 로컬 날짜 `YYYY-MM-DD` 기준이다. `ccusage` daily row의 `date`와 Windows 로컬 날짜 키를 exact match해 오늘 토큰과 오늘 비용을 고른다.
`ccusage` 조회가 성공했지만 Windows 로컬 오늘 날짜의 row가 없으면 오늘 토큰은 0, 오늘 비용은 0으로 정규화한다.

## 범위

포함 기능:

- 윈도우 앱은 Electron 기반으로 구현한다.
- 앱 시작 시 즉시 사용량을 조회하고, 기본 5초마다 자동 갱신한다.
- 오늘 토큰, 오늘 비용, 5시간 limit 사용률, 1주 limit 사용률을 표시한다.
- 창은 타이틀바 없는 borderless 창이다.
- 창은 항상 always on top이다.
- 창 자체를 드래그해 위치를 옮길 수 있다.
- 창은 투명 배경을 사용하고, 패널 배경만 기본 50% 알파로 표시한다.
- 창에서 마우스 오른쪽 클릭 시 설정, 나가기 메뉴를 표시한다.
- 설정을 클릭하면 설정 다이얼로그를 열고 패널 배경 투명도와 갱신 주기를 수정할 수 있다.
- 설정값은 앱 재시작 후에도 유지한다.
- 앱서버와 ccusage 상태는 개별 텍스트가 아니라 단일 상태등으로 표시한다.
- 앱서버 또는 ccusage 중 하나라도 실패하면 상태등은 빨간색이다. 둘 다 성공해야 초록색이다.
- 디버깅을 위해 실행 로그를 파일로 남긴다.
- 패키징 없이 실행할 수 있는 공식 개발 명령과 빌드 후 실행 명령을 제공한다.

비포함 기능:

- 시스템 트레이 상주.
- OS 로그인 시 자동 실행.
- 앱 패키징과 설치 파일 생성.
- Codex 외 다른 CLI 사용량 표시.
- limit 절대 잔여량 추정.
- 실패 시 이전 성공값을 현재값처럼 대체 표시하는 캐시 UI.
- 사용자 창 크기 조절.
- `ccusage` 또는 Codex App Server의 장기 실행 프로세스 재사용.

## 결정 사항

윈도우 앱 기술은 Electron을 사용한다. 기존 React/Vite 화면 자산과 TypeScript 생태계를 재사용할 수 있고, borderless, always on top, 투명 배경, 창 드래그, context menu, 설정 다이얼로그 같은 OS 창 제어 요구사항을 직접 지원한다.

윈도우 앱은 기존 Express 서버에 HTTP로 붙지 않고 Electron main process에서 공통 사용량 모듈을 직접 호출한다. 이렇게 하면 데스크톱 오버레이 실행을 위해 별도 로컬 포트를 열 필요가 없다. 웹 앱은 계속 Express HTTP 어댑터를 사용한다.

MVP에서는 기존 `dashboardService` 호출 방식을 그대로 사용한다. `usage.getSnapshot()`이 실행될 때마다 최신 사용량을 조회하며, 이 과정에서 `ccusage`와 Codex App Server 호출이 새로 발생할 수 있다. 장기 실행 프로세스 재사용, 백그라운드 캐시, 증분 갱신 최적화는 이번 범위에서 제외한다.

설정은 Electron의 `app.getPath("userData")` 아래 JSON 파일로 저장한다. 기본값은 패널 배경 투명도 50%, 갱신 주기 5초다. 패널 배경 투명도는 20-100%, 갱신 주기는 5-300초 범위로 제한한다.

윈도우 오버레이 앱은 단일 인스턴스만 허용한다. Electron main process는 `app.requestSingleInstanceLock()`을 사용한다. 두 번째 실행이 들어오면 새 overlay 창과 새 polling loop를 만들지 않고 두 번째 프로세스는 종료한다. 기존 overlay window는 show/focus한다.

오버레이 창 위치도 같은 설정 저장소에 `windowPosition`으로 저장한다. 창 크기는 MVP에서 고정 크기 `280 x 168`이며 사용자가 조절할 수 없다. 저장된 위치는 다음 실행에서 적용하기 전에 저장된 `x`, `y`와 고정 크기 `280 x 168`로 `savedBounds`를 만들고, Electron `screen.getDisplayMatching(savedBounds)`가 반환한 display를 target display로 삼아 검증한다. `savedBounds` 전체가 target display의 workArea 안에 완전히 포함될 때만 유효하다. 일부라도 벗어나면 주 모니터 오른쪽 위 24px 오프셋의 기본 위치로 보정하고, 보정 사실을 로그에 남긴다.

우클릭 메뉴의 나가기는 창 숨김이 아니라 앱 프로세스 종료다.

자동 갱신은 single-flight polling으로 동작한다. 이전 사용량 조회가 끝나지 않았을 때 다음 polling tick이 오면 새 조회를 시작하지 않고 해당 tick은 건너뛴다. 진행 중인 조회는 취소하지 않고 `dashboardService`의 timeout과 실패 처리 규칙에 맡긴다. 화면의 마지막 갱신 시각은 성공과 실패를 구분하지 않고 마지막으로 완료된 조회 응답의 `generatedAt`을 기준으로 표시한다.

단, 앱 종료 경로에서는 새 `usage.getSnapshot()` 처리를 시작하지 않는다. 이미 진행 중인 조회가 만든 `ccusage` 또는 Codex App Server child process는 main process가 추적하고 best-effort로 종료한다. 종료 중 child cleanup은 최대 2초만 기다리고, 실패하면 sanitized 로그를 남긴 뒤 종료를 계속한다.

기존 `npm run dev`는 웹 대시보드 전용 명령으로 유지한다. 윈도우 오버레이의 공식 개발 실행 명령은 `npm run dev:overlay`다. 빌드 후 패키징 없이 실행하는 공식 명령은 `npm run start:overlay`다. Electron은 프로젝트 의존성으로 고정된 실행 파일을 사용하고, 전역 설치된 Electron에 의존하지 않는다.

개발 모드에서 Electron main process는 Vite dev server의 overlay renderer URL을 로드한다. 빌드 후 실행 모드에서 Electron main process는 Vite가 생성한 정적 renderer 파일을 `loadFile`로 로드한다. 설정 다이얼로그도 같은 기준을 따른다.

오버레이 창과 설정 창은 같은 renderer 보안 기준을 사용한다. `webPreferences`는 `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`를 기본으로 한다. preload는 `contextBridge`로 허용된 API만 노출한다. renderer에서 `process`, `require`, `ipcRenderer`, Node `fs/path/child_process` 같은 객체에 직접 접근할 수 없어야 한다.
Electron main process는 overlay/settings `webContents`에서 허용된 renderer 진입점 외 navigation을 차단한다. `will-navigate`는 허용 URL이 아니면 `preventDefault()`로 막고, `setWindowOpenHandler`는 모든 새 창 생성을 deny한다.

## 모듈 구조

공통 모듈의 목표는 데이터 계약과 조회 인터페이스를 한 곳에 두고, 웹과 윈도우 앱이 표시 어댑터만 다르게 갖도록 하는 것이다.

예상 구조:

```text
overlay.html
settings.html
shared/
  dashboardTypes.ts
  usageSnapshot.ts
server/
  data/
    dashboardService.ts
electron/
  main.ts
  preload.ts
  settingsStore.ts
  appLog.ts
src/
  api.ts
  pages/
    DashboardPage.tsx
  windows/
    OverlayApp.tsx
    SettingsDialog.tsx
```

`overlay.html`은 오버레이 renderer 진입점이다. `settings.html`은 설정 다이얼로그 renderer 진입점이다. 웹 대시보드의 `index.html`과 분리해 오버레이용 CSS, 드래그 영역, 창 크기 전제를 웹 대시보드에 섞지 않는다.

`shared/dashboardTypes.ts`는 `DashboardResponse`, `LimitBucket`, `LimitWindow`, `SourceStatus` 같은 웹과 윈도우 앱 공통 타입을 제공한다. 현재 `server/data/types.ts`와 `src/api.ts`에 중복된 대시보드 응답 타입은 이 공통 타입으로 합친다.

`DashboardResponse.generatedAt`은 두 데이터 소스 호출이 모두 settle되고 응답 객체를 조립한 완료 시각이다. 조회 시작 시각이 아니다. `SourceStatus.checkedAt`은 해당 통합 응답의 `generatedAt`과 같은 완료 시각을 사용한다. 웹 API와 Electron IPC 모두에서 `generatedAt`과 `checkedAt`은 ISO 8601 문자열이다.

`shared/usageSnapshot.ts`는 표시 계층이 바로 쓰기 쉬운 요약값을 만든다. 예를 들어 오늘 토큰 문자열, 오늘 비용 문자열, 5시간 사용률, 1주 사용률, 단일 상태등 색상, 마지막 갱신 시각을 계산한다. 이 모듈은 순수 함수로 두어 웹과 윈도우 앱 테스트에서 같이 검증한다. 데이터 소스 실패 판정과 실패 로그 기준은 만들지 않는다.

`shared/usageSnapshot.ts`는 pending, 정상 응답, 조회 예외를 모두 같은 표시 view model로 변환한다.

```ts
type UsageSnapshotInput =
  | { kind: "pending" }
  | { kind: "response"; response: DashboardResponse }
  | { kind: "exception"; caughtAt: Date };

type UsageSnapshotViewModel = {
  statusTone: "pending" | "ok" | "fail";
  todayTokensText: string;
  todayCostText: string;
  fiveHourLimitText: string;
  fiveHourLimitFillPercent: number;
  oneWeekLimitText: string;
  oneWeekLimitFillPercent: number;
  updatedAtText: string;
};
```

renderer는 표시 문자열, status tone, progress fill 값을 직접 만들지 않고 `UsageSnapshotViewModel`만 렌더링한다. `kind: "exception"`의 `caughtAt`은 renderer가 예외를 포착한 시각을 주입한다.
`kind: "response"`의 시간값은 `DashboardResponse.generatedAt` ISO 문자열을 파싱해 로컬 `HH:mm:ss`로 표시한다. `kind: "exception"`의 `caughtAt`만 renderer 내부 `Date`로 받는다.

표시 문자열 포맷은 `shared/usageSnapshot.ts`에서만 만든다.

- 오늘 토큰: `en-US` 기준 천 단위 쉼표를 넣은 정수 문자열. 예: `123,456`.
- 오늘 비용: `$` 접두어와 소수 4자리 고정. 예: `$1.2345`, `$0.0000`.
- 5시간/1주 limit 사용률: `Math.round(usedPercent)` 정수와 `%` 접미어. 예: `42%`.
- 5시간/1주 progress bar fill: `usedPercent`를 0-100 범위로 clamp한 값.
- `usedPercent`는 0 이상 finite number여야 한다. 100 초과는 허용한다.
- `usedPercent`가 100을 넘으면 progress bar는 100%로 채우고, 텍스트는 반올림한 실제 값을 표시한다. 예: `123%`.
- 마지막 갱신 시각: 로컬 시간 기준 24시간제 `HH:mm:ss`.
- 사용할 수 없는 숫자 값: `--`.
- 첫 조회 전 마지막 갱신 시각: `--:--:--`.

Codex limit 데이터 계약 검증의 단일 권위자는 `dashboardService`다. 오버레이의 대표 limit은 `limits` 배열에서 `id === "codex"`인 `LimitBucket`만 사용한다. `limits[0]`이나 첫 번째 성공 bucket으로 fallback하지 않는다. 대표 Codex bucket에서는 `primary.usedPercent`와 `secondary.usedPercent`가 0 이상 finite number여야 한다. 누락, `null`, 문자열, `NaN`, `Infinity`, 음수는 Codex App Server 소스 실패로 정규화한다. 대표 Codex bucket에서는 `primary.windowDurationMins === 300`, `secondary.windowDurationMins === 10080`도 필수다. 누락이나 `null`도 불일치로 처리한다.

`server/data/dashboardService.ts`는 기존처럼 ccusage와 Codex App Server를 독립적으로 호출하고 `DashboardResponse`를 만든다. Electron main process와 Express API는 같은 `dashboardService` 인터페이스를 호출한다. `dashboardService`는 두 데이터 소스 호출이 settle된 뒤 `generatedAt`을 만든다.

`dashboardService`는 웹과 오버레이 모두에서 같은 Windows 로컬 날짜 키를 사용해 오늘 row를 선택한다. UTC 날짜 경계를 사용하지 않는다.
`ccusage` 소스가 성공했고 오늘 row만 없으면 `ccusage` 실패로 보지 않는다. `today`는 토큰 0, 비용 0으로 만들고, row 미매칭 여부는 디버그 또는 로그용 요약 신호로만 남긴다.
파싱 대상 `ccusage` daily row 전체는 `date`, `totalTokens`, 선택된 비용 필드가 유효해야 한다. `date`는 정확히 `YYYY-MM-DD` 형식의 실제 calendar date 문자열이어야 한다. 예를 들어 `2026-6-8`, `2026-02-30`, 빈 문자열은 잘못된 date다. `date` 누락, 잘못된 `date`, `totalTokens` 누락, `null`, 문자열, `NaN`, `Infinity`, 음수, 선택된 비용 필드의 누락 또는 비정상 값, malformed daily 구조는 ccusage 소스 실패로 처리한다. 비용 필드는 응답 단위로 `totalCost`를 우선 사용하고, `totalCost`가 없으면 `costUSD`를 사용한다. 오늘 row가 없는 경우만 예외적으로 0으로 정규화한다.
`dashboardService`는 Codex 대표 limit의 `primary.usedPercent`와 `secondary.usedPercent`가 0 이상 finite number인지 검증한다. 또한 `primary.windowDurationMins === 300`, `secondary.windowDurationMins === 10080`을 검증한다. 누락, `null`, 비숫자, 비finite 값, 음수, duration 불일치는 Codex App Server 소스 실패로 처리한다.

`electron/settingsStore.ts`는 설정 JSON 파일의 유일한 writer다. 설정 다이얼로그 저장과 창 위치 저장은 모두 `settingsStore` 메서드를 통해서만 파일을 수정한다. `settingsStore`는 최신 in-memory `OverlaySettings`를 기준으로 부분 변경을 merge한 뒤 저장하며, 파일 쓰기는 내부 큐로 직렬화한다.
설정 파일 읽기 시 필드 단위 validation을 수행한다. 일부 필드만 잘못되었으면 잘못된 필드만 기본값으로 보정하고 정상 필드는 보존한다. JSON parse 자체가 실패하면 전체 기본 `OverlaySettings`로 대체한다. 보정이 발생하면 정규화된 전체 `OverlaySettings`를 `settingsStore` writer 큐로 다시 저장하고 로그를 남긴다.
설정 파일 읽기 보정 재저장은 내부 normalization write이며 `settings.changed` 이벤트를 발행하지 않는다. overlay/settings renderer는 `settings.get()` 응답으로 보정된 전체 `OverlaySettings`를 받는다.
설정 파일 읽기 보정 재저장이 실패해도 보정된 `OverlaySettings`는 in-memory에 유지하고 `settings.get()`은 보정된 값을 반환한다. 이 실패는 sanitized 로그만 남기는 best-effort 실패로 처리하며, `settings.changed` 이벤트와 polling timer 재시작은 발생하지 않는다.
일반 실행 중 `updateWindowPosition(position)` 파일 write가 실패해도 최신 `windowPosition`은 in-memory에 유지한다. 이 실패는 sanitized 로그만 남기며, `settings.changed` 이벤트와 polling timer 재시작은 발생하지 않는다. 다음 `settingsStore` 저장은 최신 in-memory `windowPosition`을 보존한다.

## 데이터 흐름

웹 앱:

```text
React page -> src/api.ts -> Express /api/dashboard -> dashboardService -> ccusage + Codex App Server
```

윈도우 앱:

```text
Overlay renderer from overlay.html -> preload IPC -> Electron main -> dashboardService -> ccusage + Codex App Server
```

윈도우 앱 renderer는 Node API나 로컬 명령을 직접 호출하지 않는다. renderer는 preload가 `window.codexOverlay`에 노출한 작은 IPC 인터페이스만 사용한다.

각 `usage.getSnapshot()` 호출은 `dashboardService`를 통해 새 snapshot을 만든다. 이전 성공 응답을 현재값처럼 재사용하지 않으며, 장기 실행 `ccusage` 또는 Codex App Server 프로세스를 유지하지 않는다. 조회 시간이 갱신 주기보다 길어지면 single-flight 규칙에 따라 중첩 조회 없이 tick을 건너뛴다.

`dashboardService`가 짧게 실행하는 reader child process는 main process가 종료 정리를 위해 추적할 수 있어야 한다. 일반 polling 중에는 진행 중인 reader를 취소하지 않지만, 앱 종료 중에는 active child process cleanup을 시도한다.

오버레이 우클릭 메뉴는 Electron main process가 소유한다. main process는 overlay `webContents`의 context menu 이벤트에서 native `Menu`를 열고 `Settings`, `Quit` 항목을 표시한다. renderer는 custom context menu를 만들지 않는다. 메뉴 항목은 IPC를 거치지 않고 main process 내부 함수를 직접 호출한다.

설정 다이얼로그는 singleton window로 관리한다. 이미 설정 창이 열려 있을 때 `Settings`를 다시 선택하면 새 창을 만들지 않고 기존 설정 창을 focus한다. 설정 창이 닫히면 main process의 설정 창 참조를 비운다.

renderer 로딩 규칙:

- 개발 모드: `npm run dev:overlay`가 Vite dev server와 Electron을 함께 실행하고, overlay 창은 Vite의 `overlay.html` URL을 로드한다.
- 개발 모드 설정 창: 설정 다이얼로그는 Vite의 `settings.html` URL을 로드한다.
- 빌드 후 실행 모드: `npm run build`가 웹 renderer, 오버레이 renderer, Electron main/preload를 모두 빌드한다.
- 빌드 후 실행 모드 overlay 창: `npm run start:overlay`가 빌드된 `overlay.html`을 `loadFile`로 로드한다.
- 빌드 후 실행 모드 설정 창: 설정 다이얼로그는 빌드된 `settings.html`을 `loadFile`로 로드한다.
- 개발 모드에서 허용 URL은 지정된 Vite dev server의 `overlay.html`과 `settings.html`뿐이다.
- 빌드 후 실행 모드에서 허용 URL은 `loadFile`로 연 로컬 `overlay.html`과 `settings.html`뿐이다.
- 허용되지 않은 URL로 navigation되거나 새 창을 열려고 하면 차단하고 `window.codexOverlay` API를 노출하지 않는다.

오버레이 renderer는 polling timer와 `inFlight` 상태를 소유한다. 앱 시작 시 즉시 `usage.getSnapshot()`을 한 번 호출하고, 이후 저장된 갱신 주기마다 같은 호출을 반복한다. `inFlight`가 `true`인 동안 도착한 timer tick은 무시한다. 설정 변경으로 갱신 주기가 바뀌면 기존 timer를 중지하고 새 timer를 만들되, 이미 진행 중인 조회는 그대로 완료시킨다.

오버레이 renderer는 polling effect cleanup에서 interval 또는 timeout을 해제한다. React unmount, HMR 재마운트, window reload/close 이후에는 기존 renderer 인스턴스의 timer가 남아 있으면 안 된다. 진행 중인 `usage.getSnapshot()`을 취소하지는 않지만, generation id 또는 mounted flag를 사용해 비활성화된 renderer 인스턴스에 늦게 도착한 응답을 화면 상태에 반영하지 않는다.

필수 IPC 인터페이스:

preload가 노출하는 전역은 `window.codexOverlay` 하나다. 창별 필수 인터페이스는 다음 하위 namespace로 제한한다.

- overlay window:
  - `window.codexOverlay.usage.getSnapshot()`: 현재 사용량 조회.
  - `window.codexOverlay.settings.get()`: 저장된 설정 조회.
  - `window.codexOverlay.settings.onChanged(handler)`: 저장된 설정 변경 이벤트를 구독하고 unsubscribe 함수를 반환.
- settings window:
  - `window.codexOverlay.settings.get()`: 저장된 설정 조회.
  - `window.codexOverlay.settings.update(nextSettings)`: 패널 배경 투명도와 갱신 주기 저장.

renderer에는 설정 창 열기나 앱 종료 같은 window 제어 IPC를 노출하지 않는다. 설정 열기와 앱 종료는 native context menu의 main process 내부 함수로만 수행한다.
설정 다이얼로그 닫기도 별도 IPC를 만들지 않는다. 설정 다이얼로그 renderer는 저장 성공 또는 `Cancel` 클릭 시 브라우저 기본 `window.close()`를 호출한다.
overlay window에는 `settings.update`를 노출하지 않는다. settings window에는 `usage.getSnapshot`과 `settings.onChanged`를 노출하지 않는다.

설정 IPC 계약:

```ts
type OverlaySettings = {
  panelAlphaPercent: number;
  refreshIntervalSeconds: number;
  windowPosition?: {
    x: number;
    y: number;
  };
};

type SettingsUpdateInput = {
  panelAlphaPercent: number;
  refreshIntervalSeconds: number;
};

type SettingsUpdateResult =
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

`settings.update(nextSettings)`의 입력은 `SettingsUpdateInput`이다. `panelAlphaPercent`는 20-100 정수 퍼센트다. `refreshIntervalSeconds`는 5-300 정수 초다. 사용자가 설정 다이얼로그에서 범위 밖 값을 저장하면 `settings.update(nextSettings)`는 `{ ok: false, fieldErrors }`를 반환하고 파일을 저장하지 않는다. 이 경우 `settings.changed` 이벤트도 보내지 않는다.

Electron main process의 `settings.update` IPC handler는 `nextSettings`를 런타임에서 검증한다. `nextSettings`는 `panelAlphaPercent`와 `refreshIntervalSeconds`만 own property로 가진 plain object여야 하며, 두 값은 누락되지 않은 finite integer여야 한다. 문자열 숫자, `NaN`, `Infinity`, 비정수, 누락 필드, extra field, 배열, `null`은 잘못된 입력이다. 필드 값 문제는 `fieldErrors`에 담고, plain object 아님, 배열, `null`, extra field 같은 payload shape 문제는 `formError`에 담는다. 잘못된 입력은 `{ ok: false, fieldErrors, formError? }`로 반환하고 파일 저장과 `settings.changed` 이벤트를 수행하지 않는다.

`settings.update(nextSettings)`는 사용자 편집 가능 필드인 `panelAlphaPercent`와 `refreshIntervalSeconds`만 갱신한다. 기존 `windowPosition`은 보존하고, 성공 응답의 `settings`에는 보존된 `windowPosition`을 포함한 전체 `OverlaySettings`를 반환한다. 창 위치 저장은 설정 다이얼로그가 아니라 Electron main process의 내부 창 이동 저장 경로에서 처리한다.
`settings.update(nextSettings)`는 설정 저장과 결과 반환만 담당한다. 설정 다이얼로그 창을 직접 닫는 부수효과를 갖지 않는다.

사용자 설정 저장 성공 기준은 파일 write 완료다. `settings.update(nextSettings)`는 validation 통과 후 candidate `OverlaySettings`를 만들고, 파일 write가 성공한 뒤에만 in-memory 설정을 commit하고 `{ ok: true, settings }`를 반환한다. 파일 write가 실패하면 `{ ok: false, fieldErrors: {}, formError }`를 반환하고 in-memory 설정을 바꾸지 않으며 `settings.changed` 이벤트도 보내지 않는다.

설정 저장소 메서드는 개념적으로 `updateEditableSettings(input: SettingsUpdateInput)`과 `updateWindowPosition(position: { x: number; y: number })`로 나뉜다. 두 메서드는 모두 최신 in-memory 설정에 부분 변경을 merge하고, 다른 필드를 덮어쓰지 않는다.

`settings.onChanged`의 signature는 `(handler: (settings: OverlaySettings) => void) => () => void`다. `settings.changed` 이벤트 payload는 전체 `OverlaySettings`이며, 오버레이 renderer는 이 payload의 `panelAlphaPercent`와 `refreshIntervalSeconds`를 즉시 적용한다. 이벤트 수신 후 다시 `settings.get()`을 호출하지 않는다. 반환된 unsubscribe 함수는 해당 handler의 `settings.changed` IPC listener를 제거한다.

설정 변경 이벤트 규칙:

- 설정 다이얼로그는 `settings.update(nextSettings)` 성공 응답을 받은 뒤 닫힌다.
- Electron main process는 설정 다이얼로그의 `panelAlphaPercent` 또는 `refreshIntervalSeconds` 저장이 파일 write까지 성공하면 열린 오버레이 window에 전체 `OverlaySettings` payload와 함께 `settings.changed` 이벤트를 보낸다.
- 오버레이 renderer는 `settings.changed` payload를 받으면 패널 배경 알파를 즉시 갱신한다.
- 오버레이 renderer는 `settings.changed` payload를 받으면 기존 polling timer를 중지하고 새 갱신 주기로 timer를 다시 만든다.
- 설정 변경 이벤트가 도착했을 때 조회가 진행 중이면 진행 중인 조회는 취소하지 않는다.
- 오버레이 renderer는 React effect cleanup, HMR 재마운트, 창 reload 시 `settings.onChanged`가 반환한 unsubscribe를 호출한다.
- 오버레이 renderer는 React effect cleanup, HMR 재마운트, 창 reload 시 polling timer도 해제한다.
- `settings.update`가 validation 실패로 `{ ok: false, fieldErrors, formError? }`를 반환한 경우에는 `settings.changed` 이벤트를 보내지 않고 listener 상태도 바꾸지 않는다.
- `settings.update`가 파일 write 실패로 `{ ok: false, fieldErrors: {}, formError }`를 반환한 경우에도 `settings.changed` 이벤트를 보내지 않는다.
- `settings.changed` 이벤트는 `panelAlphaPercent` 또는 `refreshIntervalSeconds` 저장 성공에만 발행한다.
- 설정 파일 읽기 보정 재저장은 `settings.changed` 이벤트를 보내지 않는다.
- `updateWindowPosition(position)`은 파일 저장과 로그만 수행하고 `settings.changed` 이벤트를 보내지 않는다.

## 윈도우 오버레이 화면

오버레이는 작은 운영 위젯으로 만든다. 정보 밀도를 높이고, 장식 요소는 최소화한다.

### 디자인 목적

이 창의 사용자는 Codex로 작업 중인 개발자다. 창의 단일 목적은 사용자의 윈도우 화면 한쪽에서 주요 사용량과 위험 상태를 계속 보여주는 것이다. 사용자가 앱을 읽기 위해 작업 흐름을 멈추면 실패한 디자인으로 본다.

디자인 방향은 작은 데스크톱 계기판이다. 상태등은 실제 장비의 파일럿 램프처럼 즉시 읽히고, 숫자는 코드 편집기와 터미널 위에서도 흐릿해지지 않아야 한다. 화면을 점유하지 않도록 조용해야 하지만, 하나라도 실패했을 때는 빨간 상태등만으로도 즉시 알아차릴 수 있어야 한다.

### 시각 토큰

색상:

- `panelGlass`: `#18211D`를 기본 배경색으로 사용하고 CSS 알파 50%를 적용한다. 이 투명도는 패널 배경에만 적용하며 텍스트, 상태등, progress bar에는 적용하지 않는다.
- `panelStroke`: `#A8B8AD`를 28% 투명도로 사용해 창 외곽과 내부 구분선을 만든다.
- `textPrimary`: `#F4FFF7`를 주요 숫자와 상태 텍스트에 사용한다.
- `textMuted`: `#A9B8AE`를 보조 라벨과 마지막 갱신 시각에 사용한다.
- `statusPending`: `#A9B8AE`를 첫 조회 전 초기 대기 상태등에 사용한다.
- `statusOk`: `#44D07B`를 정상 상태등에 사용한다.
- `statusFail`: `#FF4B4B`를 실패 상태등에 사용한다.
- `limitAccent`: `#7DB7FF`를 5시간/1주 limit 막대의 보조 강조색으로 사용한다.

타이포그래피:

- 숫자와 비용은 tabular number를 지원하는 system monospace 계열을 사용한다. 예: `ui-monospace`, `SFMono-Regular`, `Cascadia Mono`, `Consolas`.
- 라벨과 설정 다이얼로그 본문은 Windows 기본 UI 계열을 사용한다. 예: `Segoe UI`, `system-ui`.
- 오버레이의 큰 숫자는 20-24px, 라벨은 10-11px, 보조 정보는 11-12px를 기준으로 한다.
- 숫자는 행마다 같은 x축에 정렬한다. 토큰 자리수가 바뀌어도 레이아웃이 흔들리지 않아야 한다.

형태:

- 기본 창 크기는 `280 x 168`이다.
- 창 크기는 MVP에서 고정이며 사용자가 조절할 수 없다.
- 기본 위치는 주 모니터의 오른쪽 위이며 화면 가장자리에서 24px 떨어진다.
- 모서리 반경은 8px 이하로 제한한다.
- 창 내부 padding은 12px다.
- 클릭 가능한 컨트롤은 아이콘 또는 짧은 라벨만 사용한다. 일반 표시 영역에는 설명 문장을 넣지 않는다.

시그니처 요소:

- 왼쪽에 4px 상태 spine을 둔다. 정상일 때는 `statusOk`, 실패일 때는 `statusFail`이다.
- 상태 spine 상단에는 같은 색의 원형 상태등을 둔다.
- 이 spine은 창 전체 상태를 한눈에 읽게 하는 유일한 강한 장식이다. 나머지 색과 형태는 숫자를 방해하지 않게 절제한다.

### 레이아웃

기본 오버레이 레이아웃:

```text
┌──────────────────────────────────┐
│●  CODEX USAGE           14:32:08 │
││                                  │
││  TODAY TOKENS        123,456     │
││  TODAY COST            $1.2345   │
││                                  │
││  5H LIMIT                 42%    │
││  [████████░░░░░░░░]              │
││  1W LIMIT                 17%    │
││  [███░░░░░░░░░░░░░]              │
└──────────────────────────────────┘
```

상단 행:

- 왼쪽에는 상태등과 `CODEX USAGE` 라벨을 둔다.
- 오른쪽에는 마지막 갱신 시각을 `HH:mm:ss`로 표시한다.
- 별도 새로고침 버튼은 기본 오버레이에 두지 않는다. 5초 갱신 앱에서 상시 버튼은 시각적 잡음이 크다.

숫자 영역:

- 오늘 토큰과 오늘 비용은 2행으로 표시한다.
- 라벨은 왼쪽, 값은 오른쪽 정렬한다.
- 값이 unavailable이면 값 자리에 `--`를 표시한다.
- 오늘 토큰과 오늘 비용의 문자열 포맷은 `shared/usageSnapshot.ts` 규칙을 따른다.

limit 영역:

- 5시간과 1주 limit은 각 1행 숫자와 얇은 진행 막대로 표시한다.
- 진행 막대는 높이 4px 이하로 둔다.
- 대표 limit 값은 `id === "codex"`인 bucket의 `primary`와 `secondary`만 사용한다.
- Codex bucket이 없거나 대표 bucket의 `usedPercent`가 0 이상 finite number가 아니면 `dashboardService`가 Codex App Server 소스 실패로 정규화한다. 오버레이는 5시간/1주 limit 값은 `--`로 표시하며 progress bar는 비운다.
- `primary.windowDurationMins`가 300이 아니거나 `secondary.windowDurationMins`가 10080이 아니면 5시간/1주 limit 값은 `--`로 표시하고 progress bar는 비운다. 누락이나 `null`도 실패다.
- `usedPercent`가 100을 넘으면 막대는 가득 채우고 텍스트는 `shared/usageSnapshot.ts`가 만든 반올림 퍼센트를 표시한다.

빨간 상태:

- 상태등과 spine만 빨간색으로 바꾼다.
- 실패 문장은 오버레이에 길게 표시하지 않는다.
- 사용할 수 없는 값은 `--`로 표시한다.
- 상세 원인은 로그 파일에 남긴다.

드래그와 클릭:

- 오버레이의 빈 영역과 표시 영역 전체는 드래그 가능하다.
- 우클릭은 어느 위치에서든 main process가 소유한 native context menu를 연다.
- renderer는 우클릭 메뉴 DOM을 직접 렌더링하지 않는다.
- 설정 다이얼로그나 메뉴 항목은 드래그 제외 영역이다.

표시 항목:

- 단일 상태등: 첫 조회 전 대기 색, 정상 초록색, 실패 빨간색.
- 오늘 토큰.
- 오늘 비용.
- 5시간 limit 사용률.
- 1주 limit 사용률.
- 마지막 갱신 시각.

상태등 규칙:

- 첫 `usage.getSnapshot()` 응답 전에는 상태등과 spine을 `statusPending` 색으로 표시한다.
- 첫 응답 전에는 오늘 토큰, 오늘 비용, 5시간 limit, 1주 limit 값을 모두 `--`로 표시한다.
- 첫 응답 전 마지막 갱신 시각은 `--:--:--`로 표시한다.
- 첫 응답이 완료된 뒤부터 초록색 또는 빨간색 상태등 규칙을 적용한다.
- `usage.getSnapshot()`이 응답 없이 예외로 끝나면 상태등과 spine은 빨간색으로 표시하고 모든 값은 `--`로 표시한다.
- 조회 예외 상태의 마지막 갱신 시각은 예외를 포착한 renderer 로컬 시각을 `HH:mm:ss`로 표시한다.
- `sources.ccusage.ok === true`이고 `sources.codexAppServer.ok === true`이면 초록색이다.
- 둘 중 하나라도 `false`이면 빨간색이다.
- 빨간색 상태에서 상세 원인은 기본 화면에 길게 표시하지 않는다.
- 상세 원인은 실행 로그와 필요 시 개발용 로그 파일에서 확인한다.

창 동작:

- `frame: false`로 타이틀바를 제거한다.
- `alwaysOnTop: true`를 사용한다.
- `resizable: false`를 사용한다.
- 앱은 `requestSingleInstanceLock()`으로 단일 인스턴스를 유지한다.
- 두 번째 실행은 새 창을 만들지 않고 기존 overlay window를 show/focus한 뒤 종료한다.
- `BrowserWindow`는 `transparent: true`를 사용하고 창 전체 `opacity`는 변경하지 않는다.
- 기본 패널 배경 알파는 `0.5`다.
- 드래그 가능한 영역은 창 배경 전체로 둔다.
- 값 선택, 버튼, 메뉴처럼 클릭 가능한 컨트롤은 드래그 제외 영역으로 둔다.
- 창 위치는 저장했다가 다음 실행에 복원한다.
- 창 위치 저장은 설정 다이얼로그 저장과 분리된 Electron main process 내부 경로로 처리한다.
- 창 이동 이벤트가 발생하면 마지막 이동 후 500ms 동안 추가 이동이 없을 때 현재 `x`, `y`를 `windowPosition`으로 저장한다.
- 앱 종료 시 현재 창 위치를 한 번 더 저장한다.
- 앱 종료는 마지막 `windowPosition` 저장과 `settingsStore` writer 큐 flush가 끝날 때까지 기다린 뒤 진행한다.
- 앱 종료 시작 시 `shuttingDown` 상태를 세우고 pending 위치 debounce를 취소한다.
- 종료 시작 후에는 마지막 `windowPosition` 저장만 writer 큐에 넣는다.
- 앱 종료 중에는 새 사용량 조회 IPC를 받지 않고, active reader child process를 best-effort로 종료한다.
- 저장된 창 위치의 전체 `280 x 168` bounds가 `screen.getDisplayMatching(savedBounds)`로 선택한 target display workArea 안에 완전히 포함되지 않으면 기본 위치로 복원한다.
- overlay `webContents`의 context menu 이벤트는 main process가 native menu로 처리한다.
- 설정 다이얼로그는 main process가 singleton으로 관리한다.

## 설정 다이얼로그

설정 다이얼로그는 오버레이와 별도 Electron window로 연다. 오버레이의 패널 배경 투명도와 입력 처리가 설정 UI를 방해하지 않도록 분리한다.

설정 다이얼로그는 동시에 하나만 열 수 있다. 이미 열린 상태에서 다시 열기를 요청하면 기존 창을 앞으로 가져오고 focus한다.

설정 다이얼로그는 저장 성공 후 renderer에서 `window.close()`를 호출해 닫는다. `Cancel`은 저장 없이 `window.close()`만 호출한다. 별도 `settings.close()` 또는 window close IPC는 만들지 않는다. 창이 닫히면 main process의 `closed` 이벤트에서 singleton 참조를 비운다.

설정 다이얼로그 디자인:

- 기본 크기는 `360 x 240`이다.
- 일반 불투명 창으로 표시한다. 설정 창에는 오버레이 패널 배경 투명도를 적용하지 않는다.
- 타이틀은 `Overlay settings`로 둔다.
- 패널 배경 투명도는 슬라이더와 숫자 퍼센트 값을 함께 표시한다.
- 갱신 주기는 stepper 또는 number input으로 표시하고 단위는 초로 고정한다.
- 하단에는 `Save`와 `Cancel` 버튼을 둔다.
- 저장 성공 시 다이얼로그를 닫고 오버레이에 즉시 반영한다.
- 저장 성공 시 `settings.update` 응답을 받은 뒤 renderer가 `window.close()`를 호출한다.
- `Cancel`은 저장하지 않고 renderer가 `window.close()`를 호출한다.
- 잘못된 입력은 저장하지 않고 `settings.update`가 반환한 `fieldErrors` 메시지를 해당 필드 아래에 짧게 표시한다.
- `settings.update`가 `formError`를 반환하면 설정 다이얼로그 하단에 짧게 표시한다.
- `settings.update`가 파일 write 실패 `formError`를 반환하면 설정 다이얼로그를 닫지 않는다.

설정 항목:

- 패널 배경 투명도: 20-100%, 기본 50%.
- 갱신 주기: 5-300초, 기본 5초.

설정 저장 규칙:

- 저장 즉시 오버레이 창에 적용한다.
- 갱신 주기를 바꾸면 기존 polling timer를 중지하고 새 주기로 다시 시작한다.
- 설정 파일을 읽을 때 잘못된 파일이나 범위 밖 저장값은 기본값으로 보정하고 로그에 남긴다.
- 설정 파일 읽기 보정은 in-memory에만 머물지 않고 정규화된 전체 `OverlaySettings`를 파일에 다시 저장한다.
- 설정 파일 읽기 보정 재저장은 내부 normalization write이며 polling timer를 재시작하지 않는다.
- `settings.get()`은 보정된 전체 `OverlaySettings`를 반환한다.
- 설정 파일 읽기 보정 재저장이 실패해도 in-memory 보정값을 유지하고 `settings.get()`은 보정된 값을 반환한다.
- 일부 설정 필드만 잘못된 경우 잘못된 필드만 기본값으로 보정하고 정상 필드는 보존한다.
- JSON parse 실패는 전체 기본 설정으로 대체해 저장한다.
- 설정 다이얼로그에서 사용자가 저장한 범위 밖 값은 보정하지 않고 저장을 거부한다.
- `settings.update` IPC 입력이 정확한 plain object 형태가 아니거나 필수 필드가 finite integer가 아니면 저장을 거부한다.
- 설정 다이얼로그 저장은 기존 `windowPosition`을 삭제하거나 변경하지 않는다.
- 창 위치 저장은 창 이동 후 500ms debounce와 앱 종료 시 마지막 저장으로 처리한다.
- 설정 다이얼로그 저장과 창 위치 저장은 같은 `settingsStore` writer 큐에서 직렬화한다.
- 설정 다이얼로그 저장과 창 위치 저장이 연속으로 발생해도 서로의 필드를 보존한다.
- 일반 실행 중 창 위치 저장 파일 write가 실패해도 최신 `windowPosition`은 in-memory에 유지한다.
- 앱 종료 중 마지막 창 위치 저장도 같은 `settingsStore` writer 큐에 직렬화하고, 큐 flush가 끝난 뒤 종료한다.
- `shuttingDown` 이후 들어온 `settings.update`는 저장하지 않고 `{ ok: false, fieldErrors: {}, formError }`를 반환한다.
- `shuttingDown` 이후 들어온 `updateWindowPosition`은 저장하지 않고 sanitized 로그만 남긴다.
- `shuttingDown` 이후에는 `settings.changed` 이벤트를 보내지 않는다.
- 일반 실행 중 사용자 설정 파일 write가 실패하면 in-memory 설정을 commit하지 않고 `{ ok: false, fieldErrors: {}, formError }`를 반환한다.
- 설정 다이얼로그 저장이 성공하면 Electron main process가 오버레이 window에 `settings.changed` 이벤트를 보낸다.
- 창 위치 저장은 `settings.changed` 이벤트를 보내지 않는다.

## 실행 로그

디버깅용 실행 로그는 Electron main process에서 파일로 남긴다.

로그 위치:

```text
<electron userData>/logs/app.log
```

로그에 남길 이벤트:

- 앱 시작과 종료.
- 두 번째 실행 요청을 감지해 기존 overlay window를 focus하고 새 인스턴스를 종료한 경우.
- 설정 파일 읽기, 저장, 보정.
- 설정 파일 읽기 보정 후 정규화된 설정을 다시 저장한 경우.
- 설정 파일 읽기 보정 재저장 실패: sanitized message.
- malformed JSON을 전체 기본 설정으로 대체한 경우.
- 일반 실행 중 사용자 설정 파일 write 실패: sanitized message.
- 일반 실행 중 창 위치 저장 파일 write 실패: sanitized message.
- 오버레이 창 생성, 위치 복원, 위치 저장.
- 창 이동 후 debounce로 위치를 저장한 경우와 앱 종료 시 마지막 위치를 저장한 경우.
- 저장된 창 위치의 전체 bounds가 target display workArea 밖으로 일부라도 벗어나 기본 위치로 보정된 경우.
- 설정 다이얼로그 열기와 닫기.
- 사용량 조회 시작: 로그 전용 `startedAt`.
- 사용량 조회 완료: `usage.getSnapshot()`이 응답을 반환한 경우의 `generatedAt`, 응답 전체 상태, 오늘 토큰, 오늘 비용, 5시간/1주 사용률.
- 데이터 소스 실패: 응답 `status`가 `partial` 또는 `error`이면 실패한 source별 이름, sanitized message, 응답 `generatedAt`.
- 사용량 조회 예외: `usage.getSnapshot()` 자체가 응답을 반환하지 못한 경우의 sanitized message.
- 앱 종료 중 마지막 위치 저장 또는 writer 큐 flush 실패: sanitized message.
- 앱 종료 중 active reader child process cleanup 실패: sanitized message.
- 앱 종료 중 거부된 `settings.update` 또는 `updateWindowPosition`: sanitized message.
- IPC 처리 실패.

로그 보안 규칙:

- 원본 ccusage JSON 전체를 기록하지 않는다.
- 인증 토큰, 환경 변수 전체, 사용자 홈 경로의 민감한 하위 경로를 기록하지 않는다.
- 기존 `sanitizeMessage` 규칙을 로그에도 적용한다.
- 실패 stack 전체는 기본 기록하지 않고, 사용자가 조치 가능한 요약 메시지를 기록한다.

로그 크기 규칙:

- `app.log`가 1MB를 넘으면 `app.previous.log`로 교체하고 새 로그 파일을 시작한다.
- 보관 파일은 1개만 둔다.

## 에러 처리

ccusage와 Codex App Server는 독립적으로 실패할 수 있다. `dashboardService`의 기존 부분 실패 모델은 유지한다.

윈도우 오버레이의 상태 표시는 단순화한다.

- 첫 조회 전: 상태등과 spine은 대기 색, 모든 값은 `--`, 마지막 갱신 시각은 `--:--:--`.
- 조회 예외: 상태등과 spine은 빨간색, 모든 값은 `--`, 마지막 갱신 시각은 예외를 포착한 로컬 시각.
- 둘 다 성공: 상태등 초록색, 모든 값 표시.
- ccusage만 실패: 상태등 빨간색, 오늘 토큰/비용은 사용할 수 없음으로 표시, limit 값은 표시.
- Codex App Server만 실패: 상태등 빨간색, 오늘 토큰/비용은 표시, limit 값은 사용할 수 없음으로 표시.
- 둘 다 실패: 상태등 빨간색, 모든 값은 사용할 수 없음으로 표시.

Codex App Server 응답에 `id === "codex"`인 대표 bucket이 없거나 대표 bucket의 `usedPercent` 또는 window duration이 유효하지 않으면 Codex App Server 소스 실패와 같은 표시 규칙을 적용한다. 다른 bucket으로 대체 표시하지 않는다.

`ccusage` 조회가 성공했지만 오늘 row가 없으면 ccusage 실패로 보지 않는다. 오늘 토큰은 `0`, 오늘 비용은 `$0.0000`으로 표시한다.
파싱 대상 daily row 중 하나라도 `date`, `totalTokens`, 선택된 비용 필드가 유효하지 않으면 ccusage 소스 실패와 같은 표시 규칙을 적용한다.
비용 값은 `dashboardService`가 응답 단위로 선택한 비용 필드에서 읽는다. `totalCost`가 있으면 `totalCost`, 없으면 `costUSD`를 사용하며, 선택된 필드가 파싱 대상 daily row 중 하나에서라도 유효하지 않으면 ccusage 소스 실패다.

실패한 데이터 소스의 이전 성공값은 현재값처럼 표시하지 않는다. 이전 성공값 캐시는 이번 범위에서 제외한다.

`usage.getSnapshot()` 자체가 예외로 끝난 경우에도 이전 성공값을 유지하지 않는다. renderer는 예외 상태를 표시하고 다음 polling tick에서 다시 조회를 시도한다.

조회가 지연되어 다음 polling tick을 건너뛴 경우에도 현재 화면을 임시 성공이나 실패로 바꾸지 않는다. 화면은 마지막으로 완료된 조회 결과를 유지하고, 진행 중인 조회가 완료되면 그 응답 기준으로 상태등, 값, 마지막 갱신 시각을 한 번에 갱신한다.

단, renderer unmount, HMR 재마운트, window reload/close 이후에 완료된 이전 renderer 인스턴스의 지연 응답은 무시한다. 비활성 renderer의 완료 결과는 새 renderer 상태를 덮어쓸 수 없다.

로그에서는 IPC 호출 성공 여부와 데이터 소스 성공 여부를 분리한다. `dashboardService`가 `partial` 또는 `error` 응답을 정상 반환한 경우에도 조회 완료 로그를 남기고, 실패한 데이터 소스별 sanitized message를 별도 로그 이벤트로 남긴다. `usage.getSnapshot()` 자체가 예외로 끝난 경우에만 IPC 또는 조회 예외 로그로 기록한다.

## 테스트와 검증

필수 자동 테스트:

- 공통 타입을 웹 API와 Electron IPC가 함께 사용한다.
- 표시 요약 함수가 오늘 토큰, 오늘 비용, 5시간/1주 limit, 단일 상태등 값을 만든다.
- 표시 요약 함수가 `pending`, `response`, `exception` 입력을 모두 `UsageSnapshotViewModel`으로 변환한다.
- 표시 요약 함수가 토큰 쉼표, 비용 소수 4자리, limit 반올림 퍼센트, `HH:mm:ss`, unavailable placeholder를 고정 포맷으로 만든다.
- 오늘 토큰과 오늘 비용은 Windows 로컬 날짜 `YYYY-MM-DD`와 `ccusage` daily row `date`가 일치하는 row에서 나온다.
- `ccusage` daily row `date`는 정확히 `YYYY-MM-DD` 형식의 실제 calendar date 문자열이어야 하며, 오늘 row 매칭은 exact match다.
- UTC 날짜와 Windows 로컬 날짜가 다른 시각에도 오늘 row 선택은 Windows 로컬 날짜 기준이다.
- `ccusage` 성공 응답에 오늘 row가 없으면 오늘 토큰은 `0`, 오늘 비용은 `$0.0000`으로 표시하고 unavailable로 보지 않는다.
- 파싱 대상 daily row 전체의 `date`, `totalTokens`, 선택된 비용 필드가 유효해야 하며, non-today row malformed도 ccusage 소스 실패로 정규화된다.
- `dashboardService`는 ccusage 비용 필드로 `totalCost`를 우선하고 없으면 `costUSD`를 사용한다. 둘 다 없거나 선택된 필드가 유효하지 않으면 ccusage 소스 실패로 정규화된다.
- 표시 요약 함수가 `usedPercent` 100 초과 시 progress bar 값은 100으로 clamp하고 텍스트는 반올림한 실제 퍼센트를 유지한다.
- `dashboardService`가 대표 limit으로 `id === "codex"` bucket만 사용하고 첫 bucket fallback을 하지 않는다.
- `dashboardService`가 Codex bucket 누락, `primary.usedPercent`/`secondary.usedPercent` 비정상 값, `primary.windowDurationMins`/`secondary.windowDurationMins` 불일치를 Codex App Server 소스 실패로 정규화한다.
- 표시 요약 함수는 `DashboardResponse.sources.codexAppServer.ok === false`인 응답을 받아 limit 값을 placeholder로 렌더링한다.
- 단일 상태등은 두 데이터 소스가 모두 성공할 때만 초록색이다.
- ccusage 또는 Codex App Server 중 하나라도 실패하면 상태등은 빨간색이다.
- 첫 사용량 조회 응답 전에는 상태등과 spine이 대기 색이고 모든 값이 placeholder다.
- `usage.getSnapshot()` 예외 시 상태등과 spine이 빨간색이고 모든 값이 placeholder이며 마지막 갱신 시각은 예외 포착 시각이다.
- 설정 저장소가 기본값, 정상 저장값, 범위 밖 값을 처리한다.
- 설정 파일 읽기 중 일부 필드만 잘못된 경우 정상 필드는 보존하고 잘못된 필드만 기본값으로 보정한 뒤 파일에 다시 저장한다.
- malformed JSON 설정 파일은 전체 기본 설정으로 대체 저장한다.
- 설정 파일 읽기 보정 재저장이 실패해도 `settings.get()`은 보정된 in-memory 설정을 반환하고 `settings.changed` 이벤트를 발행하지 않는다.
- 설정 다이얼로그에서 범위 밖 값을 저장하면 `settings.update`가 `{ ok: false, fieldErrors }`를 반환하고 파일을 저장하지 않는다.
- 문자열 숫자, `NaN`, `Infinity`, 누락 필드, 비정수 `settings.update` 입력은 `{ ok: false, fieldErrors }`를 반환하고 파일 저장과 `settings.changed` 이벤트를 수행하지 않는다.
- plain object 아님, 배열, `null`, extra field 같은 payload shape 오류는 `{ ok: false, fieldErrors: {}, formError }`를 반환하고 파일 저장과 `settings.changed` 이벤트를 수행하지 않는다.
- 일반 실행 중 사용자 설정 파일 write 실패는 `{ ok: false, fieldErrors: {}, formError }`를 반환하고 in-memory 설정 commit과 `settings.changed` 이벤트를 수행하지 않는다.
- 정상 설정 저장은 `{ ok: true, settings }`를 반환하고 `settings.changed` 이벤트를 보낸다.
- 정상 설정 저장은 기존 `windowPosition`을 보존한다.
- `settings.changed` 이벤트는 전체 `OverlaySettings` payload를 전달하고, 오버레이 renderer는 이벤트 후 `settings.get()`을 다시 호출하지 않는다.
- 설정 파일 읽기 보정 재저장은 `settings.changed` 이벤트를 발행하지 않고, `settings.get()`은 보정된 설정을 반환한다.
- `settings.onChanged`가 반환한 unsubscribe를 호출하면 해당 handler가 제거되고, renderer 재마운트 후 설정 변경 이벤트가 중복 처리되지 않는다.
- renderer cleanup 이후 polling timer가 제거되어 재마운트 후 중복 polling이 발생하지 않는다.
- renderer cleanup 이후 늦게 완료된 `usage.getSnapshot()` 결과는 화면 상태를 갱신하지 않는다.
- 설정 다이얼로그 저장과 창 위치 저장이 연속 또는 동시에 요청되어도 `panelAlphaPercent`, `refreshIntervalSeconds`, `windowPosition`이 서로 되돌려지지 않는다.
- 창 위치 저장은 `settings.changed` 이벤트를 발행하지 않고 polling timer를 재시작하지 않는다.
- 일반 실행 중 창 위치 저장 파일 write가 실패해도 최신 `windowPosition`은 in-memory에 유지되고 다음 `settingsStore` 저장 때 보존된다.
- 저장된 창 위치는 `screen.getDisplayMatching(savedBounds)`로 선택한 target display의 workArea 안에 전체 `280 x 168` bounds가 완전히 포함될 때만 복원하고, 좌/상/우/하 중 일부라도 벗어나면 기본 위치로 보정한다.
- 창 이동 이벤트가 연속으로 발생해도 마지막 이동 후 500ms가 지나기 전에는 위치 파일을 반복 저장하지 않는다.
- 앱 종료 시 마지막 창 위치를 저장한다.
- 앱 종료는 마지막 창 위치 저장과 `settingsStore` writer 큐 flush가 완료된 뒤 진행된다.
- 앱 종료 중 위치 저장 또는 writer 큐 flush가 실패하면 sanitized 로그를 남긴다.
- 앱 종료 시작 시 pending 위치 debounce를 취소하고, 종료 시작 후 새 `settings.update`와 `updateWindowPosition` 저장을 수행하지 않는다.
- 앱 종료 시작 후에는 `settings.changed` 이벤트를 발행하지 않는다.
- 앱 종료 중 새 `usage.getSnapshot()` 처리를 시작하지 않고 active reader child process cleanup을 시도한다.
- active reader child process cleanup은 최대 2초만 기다리고, 실패하면 sanitized 로그를 남긴다.
- 로그 모듈이 메시지를 sanitize하고 1MB 초과 시 rotate한다.
- `partial` 또는 `error` 응답이 정상 반환되면 실패한 source별 sanitized message가 로그에 남는다.
- `usage.getSnapshot()` 자체가 예외로 실패하면 IPC 또는 조회 예외 로그가 남는다.
- 오버레이 창과 설정 창이 `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`로 생성된다.
- renderer 전역에는 `window.codexOverlay`만 IPC API로 노출되고 `process`, `require`, `ipcRenderer`에 직접 접근할 수 없다.
- `window.codexOverlay`에는 `usage`와 `settings` namespace만 있고 앱 종료 또는 설정 창 열기 IPC는 없다.
- overlay window에는 `settings.update`가 없고, settings window에는 `usage.getSnapshot`과 `settings.onChanged`가 없다.
- overlay/settings `webContents`는 허용된 `overlay.html` 또는 `settings.html` 외 URL로 navigation할 수 없고 `window.open`으로 새 창을 만들 수 없다.
- 설정 다이얼로그 닫기는 close IPC 없이 renderer `window.close()`로 처리되고, `settings.update`는 창 닫기 부수효과를 갖지 않는다.
- overlay context menu 이벤트는 renderer DOM 메뉴가 아니라 main process native menu handler로 처리된다.
- 설정 다이얼로그가 이미 열린 상태에서 `Settings`를 다시 선택하면 새 창을 만들지 않고 기존 창을 focus한다.
- 두 번째 앱 실행이 들어와도 새 overlay 창, 새 polling loop, 새 settings writer를 만들지 않는다.
- Electron main의 사용량 조회 IPC가 `dashboardService` 결과를 반환한다.
- Electron IPC의 `DashboardResponse.generatedAt`과 `SourceStatus.checkedAt`도 웹 API와 동일한 ISO 8601 문자열이다.
- 각 `usage.getSnapshot()` 호출은 캐시된 이전 성공값이 아니라 `dashboardService`의 새 응답을 반환한다.
- 지연된 reader가 완료된 뒤 만들어진 `DashboardResponse.generatedAt`은 조회 시작 시각이 아니라 응답 조립 완료 시각이다.
- 갱신 주기를 변경하면 polling 간격이 바뀐다.
- 설정 다이얼로그 저장 성공 시 오버레이 renderer가 `settings.changed` 이벤트를 받아 패널 배경 알파를 갱신한다.
- 설정 다이얼로그 저장 성공 시 오버레이 renderer가 기존 polling timer를 중지하고 새 주기로 다시 시작한다.
- 사용량 조회가 진행 중일 때 다음 polling tick이 와도 두 번째 `usage.getSnapshot()` 호출을 시작하지 않는다.
- 지연된 조회가 완료되면 마지막 갱신 시각은 완료된 응답의 `generatedAt`으로 갱신된다.
- `npm run build`가 웹 renderer, 오버레이 renderer, Electron main/preload 빌드를 함께 검증한다.

수동 검증:

- `npm run dev:overlay`로 윈도우 오버레이 앱을 실행한다.
- 윈도우 앱 실행 시 borderless 창이 뜬다.
- 창이 항상 다른 창보다 위에 있다.
- 창 전체를 드래그해 위치를 옮길 수 있다.
- 창 크기는 `280 x 168`로 고정되어 사용자가 조절할 수 없다.
- 저장된 창 위치의 전체 창 bounds가 target display workArea 밖으로 일부라도 벗어나면 다음 실행에서 기본 오른쪽 위 위치로 보정된다.
- 기본 패널 배경 알파가 50%이고 텍스트와 상태등은 불투명하다.
- 오른쪽 클릭 메뉴에 설정과 나가기가 보인다.
- 설정에서 패널 배경 투명도와 갱신 주기를 변경하면 즉시 적용된다.
- 나가기를 누르면 앱 프로세스가 종료된다.
- 우클릭 메뉴는 renderer DOM 메뉴가 아니라 native context menu로 열린다.
- 로그 파일에 앱 시작, 조회 성공 또는 실패, 설정 변경이 기록된다.
- `npm run build` 후 `npm run start:overlay`로 빌드된 오버레이 앱이 실행된다.

## 구현 순서

1. 공통 타입과 표시 요약 함수를 추가하고 기존 웹 앱 타입 중복을 제거한다.
2. 기존 웹 앱이 공통 타입으로 같은 화면을 유지하는지 검증한다.
3. `overlay.html`, `settings.html`, Electron main/preload 빌드 경로와 `dev:overlay`, `start:overlay` 명령을 추가한다.
4. Electron main, preload, overlay renderer의 최소 실행 경로를 추가한다.
5. Electron main에서 `dashboardService`를 직접 호출하는 IPC를 추가한다.
6. borderless, always on top, 투명 배경과 패널 알파, 창 드래그, 위치 저장을 구현한다.
7. 우클릭 메뉴와 설정 다이얼로그를 구현한다.
8. 실행 로그와 로그 rotate를 구현한다.
9. 자동 테스트와 수동 검증을 수행한다.

## 후속 검토 항목

- 5초 갱신 주기에서 프로세스 생성 비용, 로그 증가, CPU/배터리 사용량이 실제 사용에 부담이 되는지 계측한다.
- 부담이 확인되면 Codex App Server 장기 실행 연결 재사용, `ccusage` 호출 주기 분리, snapshot cache와 stale 표시 UI를 별도 설계한다.

## 승인 상태

- 추천 아키텍처: 승인됨.
- 단일 상태등 요구사항: 승인됨.
- 실행 로그 요구사항: 승인됨.
- 본 스펙 문서: 작성됨.
- 구현 계획: 미작성.
- 구현: 미진행.
