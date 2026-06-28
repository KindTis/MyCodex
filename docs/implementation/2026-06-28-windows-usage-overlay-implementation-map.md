# Codex 사용량 윈도우 오버레이 구현 항목 매핑

## 기준 문서

- 구현 계획서: `docs/superpowers/plans/2026-06-28-windows-usage-overlay.md`
- 기준 스펙: `docs/superpowers/specs/2026-06-28-windows-usage-overlay-design.md`
- 기존 웹 대시보드 구현 지도: `docs/implementation/2026-06-26-codex-usage-dashboard-implementation-map.md`

## 구현 항목 매핑표

| 구현 항목 ID | 구현 계획서 항목 | 수용 기준 | 구현 대상 | 구현 상태 | 검증 방법 | 검증 결과 | 보류 사유 |
|---|---|---|---|---|---|---|---|
| IMPL-01 | Task 1. 공통 타입과 TypeScript 빌드 경로 정리 | 대시보드 응답/요청/debug 타입의 단일 정의가 `shared/dashboardTypes.ts`에 있고, 웹 API와 서버가 같은 타입을 사용한다. 서버 출력 경로는 `dist/server/index.js`를 유지한다. | `shared/dashboardTypes.ts`, `server/data/types.ts`, `src/api.ts`, `tsconfig.json`, `tsconfig.server.json`, `package.json` | 구현 | `npm run build` | 통과 | |
| IMPL-02 | Task 2. 날짜, ccusage, Codex limit 계약 강화 | 로컬 날짜 key validation, ccusage row strict validation, Codex 대표 bucket strict validation, settle 이후 `generatedAt`, Electron isolated debug store가 테스트로 고정된다. | `server/data/date.ts`, `server/data/date.test.ts`, `server/data/ccusage.ts`, `server/data/ccusage.test.ts`, `server/data/codexAppServer.ts`, `server/data/codexAppServer.test.ts`, `server/data/dashboardService.ts`, `server/data/dashboardService.test.ts` | 구현 | `npm run test -- server/data/date.test.ts server/data/ccusage.test.ts server/data/codexAppServer.test.ts server/data/dashboardService.test.ts` | 통과 | |
| IMPL-03 | Task 3. 표시 요약 view model 추가 | `toUsageSnapshotViewModel()`이 pending/response/exception, 단일 상태등, 토큰/비용/limit/시간 포맷, progress clamp를 순수 함수로 처리한다. | `shared/usageSnapshot.ts`, `shared/usageSnapshot.test.ts` | 구현 | `npm run test -- shared/usageSnapshot.test.ts` | 통과 | |
| IMPL-04 | Task 4. active child process 추적 가능한 reader 경로 | `runProcess()`와 ccusage/Codex reader가 `onChild`를 지원하고, Electron child tracker가 active child cleanup을 수행한다. | `server/utils/process.ts`, `server/utils/process.test.ts`, `server/data/ccusage.ts`, `server/data/codexAppServer.ts`, `server/data/ccusage.test.ts`, `server/data/codexAppServer.test.ts`, `electron/childTracker.ts`, `electron/childTracker.test.ts` | 구현 | `npm run test -- electron/childTracker.test.ts server/data/ccusage.test.ts server/data/codexAppServer.test.ts` | 통과 | |
| IMPL-05 | Task 5. Electron 빌드 스캐폴드와 실행 명령 | Electron과 `wait-on`이 devDependency로 추가되고, overlay/settings HTML entry, Electron tsconfig, Vite multi-page build, `dev:overlay`, `start:overlay` 스크립트 계약이 생긴다. `dev:overlay`/`start:overlay` 실제 실행 검증은 IMPL-13에서 수행한다. | `package.json`, `package-lock.json`, `tsconfig.electron.json`, `overlay.html`, `settings.html`, `electron/main.ts`, `electron/preload.ts`, `electron/preload.cjs`, `scripts/copy-electron-preload.cjs`, `src/windows/OverlayApp.tsx`, `src/windows/SettingsDialog.tsx`, `src/windows/overlayMain.tsx`, `src/windows/settingsMain.tsx`, `src/windows/overlay.css`, `vite.config.ts` | 구현 | `npm run build`; 기대 결과: TypeScript server/Electron build와 Vite multi-page build가 통과하고 `dist/client/index.html`, `dist/client/overlay.html`, `dist/client/settings.html`, `dist/server/index.js`, `dist/electron/electron/main.js`, `dist/electron/electron/preload.js`, `dist/electron/electron/preload.cjs` 생성 | 통과 | |
| IMPL-06 | Task 6. 설정 저장소 구현 | 설정 기본값/validation/normalization, writer queue, changed event, windowPosition 보존, shutdown guard가 스펙 계약대로 동작한다. | `shared/overlaySettings.ts`, `electron/settingsStore.ts`, `electron/settingsStore.test.ts` | 구현 | `npm run test -- electron/settingsStore.test.ts` | 통과 | |
| IMPL-07 | Task 7. 실행 로그, 창 보안 설정, 창 위치 helper | Electron 로그 sanitize/rotate, BrowserWindow 보안 옵션과 entry 허용 규칙, display workArea 기반 위치 복원/보정 helper가 구현된다. | `electron/appLog.ts`, `electron/appLog.test.ts`, `electron/windowConfig.ts`, `electron/windowConfig.test.ts`, `electron/windowBounds.ts`, `electron/windowBounds.test.ts` | 구현 | `npm run test -- electron/appLog.test.ts electron/windowConfig.test.ts electron/windowBounds.test.ts` | 통과 | |
| IMPL-08 | Task 8. preload 계약과 renderer 전역 타입 | `window.codexOverlay` 하나만 노출하고, overlay/settings window별 IPC surface가 분리되며 renderer accessor가 타입으로 고정된다. | `electron/ipcContract.ts`, `electron/ipcContract.test.ts`, `electron/preloadContract.ts`, `electron/preloadContract.test.ts`, `electron/preload.ts`, `electron/preload.cjs`, `src/windows/windowApi.ts`, `src/windows/windowApi.test.ts` | 구현 | `npm run test -- electron/preloadContract.test.ts src/windows/windowApi.test.ts electron/rendererSecuritySmoke.test.ts` | 통과 | |
| IMPL-09 | Task 9. Electron main process, IPC, window 보안 | Electron main이 isolated dashboard service, single instance, overlay/settings windows, navigation hardening, authorized IPC, native context menu, move debounce, shutdown cleanup, 필수 로그 이벤트를 연결한다. | `electron/main.ts`, `electron/mainLifecycle.ts`, `electron/mainLifecycle.test.ts`, `electron/ipcHandlers.ts`, `electron/ipcHandlers.test.ts`, `electron/contextMenu.ts`, `electron/contextMenu.test.ts`, `electron/windowConfig.ts`, `server/data/ccusage.ts`, `server/data/codexAppServer.ts` | 구현 | `npm run build`, `npm run test -- electron/ipcHandlers.test.ts electron/windowConfig.test.ts` | 통과 | |
| IMPL-10 | Task 10. 오버레이 renderer와 polling | overlay renderer가 설정 hydration, 즉시 조회, 저장 주기 polling, single-flight, settings.changed 반영, cleanup, exception 표시를 구현한다. | `src/windows/OverlayApp.tsx`, `src/windows/OverlayApp.test.tsx`, `src/windows/overlayMain.tsx`, `src/windows/overlay.css` | 구현 | `npm run test -- src/windows/OverlayApp.test.tsx` | 통과 | |
| IMPL-11 | Task 11. 설정 다이얼로그 renderer | settings renderer가 초기 설정 조회, slider/number 상태, 저장/취소, field/form error, `window.close()` 닫기 규칙을 구현한다. | `src/windows/SettingsDialog.tsx`, `src/windows/SettingsDialog.test.tsx`, `src/windows/settingsMain.tsx`, `src/windows/overlay.css` | 구현 | `npm run test -- src/windows/SettingsDialog.test.tsx` | 통과 | |
| IMPL-12 | Task 12. 빌드, 보안, 통합 검증 테스트 보강 | IPC surface, renderer global isolation, shutdown/sender auth matrix, lifecycle singleton/debounce, context menu, 로그 구분, `dev:overlay` strict port/wait-on 계약, build 산출물, 전체 build/test가 검증된다. | `electron/rendererSecuritySmoke.test.ts`, `electron/contextMenu.test.ts`, `electron/preloadContract.test.ts`, `electron/ipcHandlers.test.ts`, `electron/mainLifecycle.test.ts`, `electron/windowConfig.test.ts`, `electron/windowBounds.test.ts`, `src/windows/OverlayApp.test.tsx`, `package.json`, `vite.config.ts`, `scripts/copy-electron-preload.cjs` | 구현 | `npm run build`; 기대 산출물: `dist/client/index.html`, `dist/client/overlay.html`, `dist/client/settings.html`, `dist/server/index.js`, `dist/electron/electron/main.js`, `dist/electron/electron/preload.js`, `dist/electron/electron/preload.cjs`. `npm run test`; 기대 결과: 전체 Vitest PASS | 통과. 실제 BrowserWindow probe도 `electron/rendererSecuritySmoke.test.ts`에서 통과 | |
| IMPL-13 | Task 13. 수동 검증 | `dev:overlay`와 `start:overlay` 실행, 창 속성, 드래그/위치 복원, 두 번째 실행 focus, native context menu, settings singleton, 표시 상태, 설정 저장/실패 처리, 로그 이벤트를 실제 환경에서 확인하고 PASS/FAIL 증거를 기록한다. | `docs/implementation/2026-06-28-windows-usage-overlay-implementation-map.md` | 구현 | 아래 `수동 검증 체크리스트`의 각 항목에 PASS/FAIL, 실행 명령, 확인 시각, 로그 파일 경로 또는 관찰 근거 기록 | 통과. 직접 마우스 클릭/드래그가 필요한 항목은 자동 테스트 근거를 함께 기록 | |
| IMPL-14 | Task 14. 구현 항목 매핑 문서 작성 | 구현 전 매핑 문서가 존재하고, 구현 후 실제 파일 목록/자동 검증/수동 검증 결과가 최신 상태로 갱신된다. | `docs/implementation/2026-06-28-windows-usage-overlay-implementation-map.md` | 구현 | 문서 내용 확인, 구현 후 검증 결과 갱신 확인 | 통과 | |

## 구현 가정

- 사용자 요청에 "작업 공간은 main을 유지 하세요."가 명시되어 있으므로 현재 `main` 브랜치와 기존 워크스페이스에서 구현한다. 별도 worktree나 브랜치를 만들지 않는다.
- 저장소에 이미 미커밋 변경이 있으므로, 계획서 범위 밖 파일은 되돌리거나 정리하지 않는다. 겹치는 파일은 현재 내용을 기준으로 최소 변경한다.
- `npm install -D electron wait-on`은 IMPL-05의 구현 단계다. 검증 명령은 `npm run build`로 분리하고, 네트워크/패키지 레지스트리 접근이 필요하면 승인된 방식으로 실행한다.
- Electron 실창 수동 검증은 현재 데스크톱 세션에서 PowerShell 기반 프로세스/Win32/log probe로 확인 가능한 범위까지 수행한다. 직접 마우스 클릭/드래그가 필요한 항목은 기존 자동 테스트 근거를 함께 남긴다.

## 수동 검증 체크리스트

IMPL-13 수행 후 각 항목에 PASS/FAIL, 실행 명령, 확인 시각, 로그 파일 경로 또는 관찰 근거를 기록한다. 실패 항목은 재현 절차와 관련 로그 이벤트 이름을 함께 남긴다.

| 항목 | 검증 내용 | 결과 | 근거 |
|---|---|---|---|
| MANUAL-01 | `npm run dev:overlay`로 Vite dev server와 Electron overlay가 실행된다. | PASS | 2026-06-28 18:37, 18:39 KST 실행. `127.0.0.1:5173` listen 확인: `LocalPort=5173`, `OwningProcess=31888`. Electron log에 `app-started`, `overlay-window-shown`, `usage-started`, `usage-completed`, `usage-source-failed` 기록. |
| MANUAL-02 | overlay 창은 borderless, always on top, transparent, fixed `280 x 188`, resizable false 조건을 만족한다. | PASS | 2026-06-28 18:58 KST `npm run start:overlay` 실행 후 Win32 probe: `Width=280`, `Height=188`, `HasCaption=False`, `HasThickFrame=False`, `TopMost=True`, `Layered=True`. `electron/windowConfig.test.ts`도 통과. |
| MANUAL-03 | 창 전체 드래그와 위치 저장/재시작 복원을 확인한다. display workArea 밖 저장 위치는 기본 오른쪽 위로 보정된다. | PASS | 위치 복원 로그 확인: 최초 `reason=default`, 이후 `reason=saved`, 저장 좌표 `x=1616,y=24`와 `x=1599,y=65` 복원. display 보정/debounce/final save 경로는 `electron/windowBounds.test.ts`, `electron/mainLifecycle.test.ts` 통과. 직접 마우스 드래그는 자동화하지 않음. |
| MANUAL-04 | 최초 실행에서 renderer load 이후 overlay가 표시되고, 두 번째 실행은 새 창을 만들지 않고 기존 overlay를 show/focus한다. | PASS | 2026-06-28 18:38 KST 두 번째 `npm run start:overlay` 실행. 두 번째 npm process는 종료되고 log에 `second-instance` 및 `show-focus-existing-overlay` 기록. |
| MANUAL-05 | 오른쪽 클릭 native context menu에 `Settings`, `Quit`가 있고, `Quit`는 앱 프로세스를 종료한다. | PASS | native click 실관찰은 자동화하지 않음. `electron/contextMenu.test.ts`가 `Settings`, `Quit` template과 action 호출을 검증하고 전체 테스트 통과. |
| MANUAL-06 | 첫 조회 전 값은 `--`, 마지막 갱신은 `--:--:--`이고, 성공/부분 실패/예외 상태에서 상태등과 spine 색이 스펙대로 바뀐다. 실패 원인 문장은 화면에 길게 표시되지 않는다. | PASS | 실제 log에서 부분 실패 조회 흐름 확인: `usage-completed`, `status=partial`, `limits.fiveHour=67`, `limits.oneWeek=25`, ccusage 실패 메시지 sanitized 기록. 표시 view model과 renderer 상태는 `shared/usageSnapshot.test.ts`, `src/windows/OverlayApp.test.tsx` 통과. |
| MANUAL-07 | 로그 파일에 앱 시작/종료, 조회 시작/완료, 실패 source별 sanitized message, IPC/조회 예외가 구분되어 남는다. | PASS | 로그 파일: `C:\Users\tatis\AppData\Roaming\mycodex-usage-dashboard\logs\app.log`. 확인 이벤트: `app-started`, `overlay-window-bounds`, `overlay-window-shown`, `usage-started`, `usage-completed`, `usage-source-failed`, `second-instance`. 종료/IPC 예외/조회 예외 로그 경로는 `electron/appLog.test.ts`, `electron/ipcHandlers.test.ts` 통과. |
| MANUAL-08 | `Settings` 메뉴는 singleton 설정 창을 열고, 반복 호출은 기존 창을 show/focus한다. | PASS | native click 실관찰은 자동화하지 않음. `electron/mainLifecycle.test.ts`가 settings singleton show/focus 경로를 검증하고 전체 테스트 통과. |
| MANUAL-09 | 패널 배경 투명도 변경은 오버레이 패널에 즉시 적용되고, 갱신 주기 변경은 기존 polling timer를 새 주기로 바꾼다. | PASS | renderer 동작은 `src/windows/OverlayApp.test.tsx`, `src/windows/SettingsDialog.test.tsx`가 검증. 실제 overlay renderer 조회 로그가 남아 preload와 renderer 실행 경로가 동작함을 확인. |
| MANUAL-10 | 설정값과 창 위치가 앱 재시작 후 유지된다. | PASS | `npm run start:overlay` 재실행에서 `overlay-window-bounds`가 `reason=saved`로 기록됨. 설정 파일 저장/복원/보존 계약은 `electron/settingsStore.test.ts` 통과. |
| MANUAL-11 | 설정 파일 보정, 사용자 설정 저장 실패, 창 위치 저장 실패는 화면 상태 변경 없이 sanitized log로 남는다. | PASS | 실패 경로는 `electron/settingsStore.test.ts`, `electron/appLog.test.ts`, `electron/ipcHandlers.test.ts`가 검증. 실제 ccusage timeout은 `usage-source-failed`에 sanitized message로 기록됨. |
| MANUAL-12 | `npm run build` 후 `npm run start:overlay`가 빌드된 `overlay.html`과 `settings.html`로 오버레이를 실행한다. | PASS | 2026-06-28 18:35 KST `npm run build` PASS 후 `npm run start:overlay` 실행. `overlay-window-shown`, `usage-started`, `usage-completed` 로그 확인. `dist/client/overlay.html` asset path는 `./assets/...`로 확인. |

## 보류 항목

- 없음.

## 구현 계획서 모순

- Task 14는 계획서 끝에서 매핑 문서를 작성하도록 되어 있지만, MyLoop `better-run-impl` 게이트는 구현 전 매핑 문서 작성과 검증관 매핑 검토를 요구한다. 상위 게이트를 우선해 이 문서를 구현 전에 만들고, 구현 후 실제 결과로 갱신한다.
- `superpowers:executing-plans` 지침은 main/master에서 시작하지 말라고 하지만, 이번 요청은 사용자가 명시적으로 `main` 유지 실행을 승인했다. 따라서 브랜치를 전환하지 않는다.

## 검증 요약

- 구현 전 매핑 문서 작성: 통과. 검증관 매핑 검토 `만족`.
- `npm run build`: 통과. `dist/client/index.html`, `dist/client/overlay.html`, `dist/client/settings.html`, `dist/server/index.js`, `dist/electron/electron/main.js`, `dist/electron/electron/preload.js`, `dist/electron/electron/preload.cjs` 생성 확인.
- `npm run test`: 통과. 24개 test file, 129개 테스트 통과.
- `electron/rendererSecuritySmoke.test.ts`: 통과. 실제 BrowserWindow probe가 빌드된 `dist/electron/electron/preload.cjs`로 `window.codexOverlay`만 노출되고 Node/Electron 전역이 없는 것을 확인.
- `npm run start:overlay`: 통과. 빌드된 overlay 실행, Win32 창 속성, renderer usage 로그 확인.
- `npm run dev:overlay`: 통과. strict port `5173` listen, Electron overlay 실행, renderer usage 로그 확인.

## 남은 리스크

- `npm install`/Electron 버전 조정 결과 npm audit가 6개 취약점(3 moderate, 2 high, 1 critical)을 보고했다. `npm audit fix --force`는 계획 범위와 버전 고정을 흔들 수 있어 실행하지 않았다.
- 실제 Codex App Server와 `ccusage` runtime 스키마가 fixture와 다르면 strict validation 강화 후 실제 조회에서 실패할 수 있다.
- native context menu 클릭, 직접 마우스 드래그, settings 창 반복 클릭은 현재 세션에서 수동 UI 조작 대신 자동 테스트와 로그 기반 검증으로 보완했다.

## 검증관 매핑 검토 기록

판정: 만족

### 검토 요청

* 유형: 매핑 검토 요청
* 검토 대상: `docs/superpowers/plans/2026-06-28-windows-usage-overlay.md`, `docs/implementation/2026-06-28-windows-usage-overlay-implementation-map.md`

### 검토 범위

* 검토한 문서: 구현 계획서 전체, 구현 항목 매핑 문서 전체
* 보충한 추가 근거: 없음
* 재검토 범위: 전체
* 판단하지 못한 항목: 실제 구현 결과, 테스트 실행 결과, 수동 검증 결과

### 검토 결과

* 매핑 검토 판정: 만족
* 구현 충실도 판정: 해당 없음
* 보류: 해당 없음

### 필수 보완

* 해당 없음

### 선택 보완 또는 추가 리스크

* 수동 검증 항목은 구현 후 PASS/FAIL 근거를 반드시 채워야 한다.

### 검증관 최종 의견

* 구현 계획서의 Task 1-14, 핵심 계약, 자동/수동 검증 범위가 구현 전 검토 가능한 수준으로 연결되어 있다.

## 검증관 구현 결과 검토 기록

판정: 만족

### 검토 요청

* 유형: 구현 결과 검토 요청
* 검토 대상: `docs/superpowers/plans/2026-06-28-windows-usage-overlay.md`, `docs/implementation/2026-06-28-windows-usage-overlay-implementation-map.md`

### 검토 범위

* 검토한 문서: 구현 계획서 전체, 구현 항목 매핑 문서 전체
* 보충한 추가 근거: `package.json`, `vite.config.ts`, `electron/main.ts`, `electron/preload.cjs`, `scripts/copy-electron-preload.cjs`, `electron/rendererSecuritySmoke.test.ts`, 빌드 산출물 존재, `app.log` 최신 이벤트
* 재검토 범위: 전체
* 판단하지 못한 항목: 해당 없음

### 검토 결과

* 매핑 검토 판정: 만족
* 구현 충실도 판정: 만족
* 보류: 없음

### 필수 보완

* 해당 없음

### 선택 보완 또는 추가 리스크

* native context menu 클릭, 직접 마우스 드래그, settings 창 반복 클릭은 매핑 문서상 자동 테스트와 로그 기반 근거로 보완되어 있다. 별도 사람이 실제 UI를 조작한 증거가 필요하다면 추가 기록하면 된다.
* npm audit 취약점은 매핑 문서에 남은 리스크로 기록되어 있으며, 이번 계획의 구현 충실도 필수 항목은 아니다.

### 검증관 최종 의견

* 이전 불만족 사유였던 IMPL-12의 실제 BrowserWindow preload probe와 IMPL-13의 `start:overlay`/`dev:overlay` 실실행 근거가 보강됐다.
* 구현 계획서의 필수 성공 기준인 `npm run build`, `npm run test`, overlay 실행, 창 속성, 두 번째 실행, 로그 이벤트 확인이 매핑 문서와 보충 근거로 확인된다.
* 추가된 `preload.cjs`/복사 스크립트는 Electron 런타임 preload 경로를 충족하기 위한 구현 세부사항으로 보이며, 계획서의 보안/IPC surface 요구와 충돌하지 않는다.
