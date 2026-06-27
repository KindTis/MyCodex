# Codex 사용량 대시보드 설계

## 목적

개인 PC에서 실행되는 로컬 웹 앱으로 Codex 사용량과 현재 limit 사용률을 빠르게 확인한다. 대시보드는 `ccusage`가 계산한 Codex 토큰/비용 리포트와 `codex app-server`가 제공하는 rate limit 값을 함께 보여준다.

## 범위

첫 버전은 Codex 전용이다. 다른 coding agent CLI 사용량은 표시하지 않는다.

포함 기능:

- 오늘 Codex 토큰 사용량.
- 오늘 Codex 비용.
- 최근 7일 날짜별 토큰/비용 추이.
- 5시간 limit 사용률.
- 1주 limit 사용률.
- 데이터 상태와 마지막 갱신 시각.
- 파싱된 요약값과 에러 로그를 보여주는 디버그 페이지.
- 페이지 진입 시 즉시 조회 후 60초마다 자동 갱신.
- 개발용 `npm run dev`와 실제 사용용 `npm start`.

비포함 기능:

- 로그인 또는 사용자 관리.
- 외부 배포.
- 원본 JSON 전체 표시.
- Codex limit 절대값 추정.
- `ccusage` 대체 파서 직접 구현.
- Codex 외 다른 CLI 사용량 표시.

## 아키텍처

앱은 React/Vite 프론트엔드와 Node/Express 로컬 API 서버로 구성한다.

프론트엔드는 브라우저 UI만 담당한다. 로컬 CLI 실행, Codex App Server 호출, 에러 마스킹은 모두 백엔드에서 처리한다. 브라우저는 백엔드의 HTTP API만 호출한다.

백엔드는 다음 데이터 소스를 호출한다.

- `ccusage codex daily --json`: 오늘 사용량, 비용, 최근 7일 추이.
- `codex app-server`: JSON-RPC로 `account/rateLimits/read`를 호출해 5시간/1주 사용률을 조회한다.

`ccusage`는 프로젝트 의존성으로 설치하고 버전을 고정한다. 전역 설치나 `latest` 실행에 의존하지 않는다.

백엔드는 한 응답을 만들 때 두 데이터 소스를 독립적으로 조회한다. 한쪽이 실패해도 다른 한쪽의 성공 결과는 폐기하지 않는다.

MVP에서는 영구 저장소를 두지 않는다. 최근 에러 로그와 마지막 성공/실패 시각은 백엔드 프로세스 메모리에서만 유지해도 되며, 프로세스 재시작 시 초기화되어도 된다.

## 화면

### 대시보드 페이지 `/`

대시보드 페이지는 반복 확인이 쉬운 밀도 높은 운영 화면으로 만든다.

표시 항목:

- 오늘 총 토큰.
- 오늘 비용.
- 마지막 갱신 시각.
- 전체 데이터 상태: 정상, 부분 실패, 실패.
- 5시간 limit 사용률과 reset 시각.
- 1주 limit 사용률과 reset 시각.
- 추가 limit bucket이 있으면 보조 행으로 표시한다.
- 최근 7일 토큰/비용 추이.
- `ccusage`와 Codex App Server 각각의 성공/실패 상태.
- 다음 자동 갱신까지 남은 시간.
- 수동 새로고침 버튼.

추이 시각화는 별도 차트 라이브러리 없이 CSS/SVG 기반의 단순 막대 또는 선 차트로 구현한다. 첫 버전에서 필요한 것은 최근 7일의 상대적 추이를 읽는 것이므로 추가 차트 의존성은 두지 않는다.

상태 표시 규칙:

- 최초 진입 후 첫 응답 전에는 로딩 상태를 표시한다.
- 자동 갱신 또는 수동 새로고침이 진행 중이면 기존 화면을 유지하면서 갱신 중 상태를 표시한다.
- 새 응답을 받으면 화면은 최신 `/api/dashboard` 응답 기준으로 갱신한다.
- `ccusage`가 실패한 응답에서는 오늘 토큰, 오늘 비용, 최근 7일 추이 영역을 사용할 수 없음으로 표시한다.
- Codex App Server가 실패한 응답에서는 5시간/1주 limit 영역을 사용할 수 없음으로 표시한다.
- 실패한 데이터 소스의 이전 성공 값을 현재 값처럼 표시하지 않는다.
- 수동 새로고침 버튼은 갱신 중 중복 실행을 막는다.

### 디버그 페이지 `/debug`

디버그 페이지는 원본 JSON 전체를 노출하지 않는다.

표시 항목:

- `ccusage` 파싱 요약.
- Codex App Server rate limit 파싱 요약.
- 최근 에러 로그.
- 마지막 성공 시각.
- 마지막 실패 시각.

## API

### `GET /api/dashboard`

대시보드가 직접 사용하는 통합 응답을 반환한다.

응답 필드:

- `generatedAt`: 백엔드가 응답을 생성한 시각.
- `status`: `ok`, `partial`, `error`.
- `today`: 오늘 날짜, 토큰, 비용.
- `trend`: 최근 7일 날짜별 토큰/비용 배열.
- `limits`: limit bucket 배열.
- `sources`: `ccusage`와 `codexAppServer`의 개별 상태.

응답 불변 조건:

- `generatedAt`은 백엔드 응답 생성 시각이다.
- `status`는 두 데이터 소스가 모두 성공하면 `ok`, 정확히 한쪽만 성공하면 `partial`, 둘 다 실패하면 `error`다.
- `ccusage`가 실패하면 `today`는 `null`, `trend`는 빈 배열이다.
- Codex App Server가 실패하면 `limits`는 빈 배열이다.
- `sources.ccusage`와 `sources.codexAppServer`는 각각 `ok`, `message`, `checkedAt`을 가진다.
- `message`에는 사용자가 조치할 수 있는 수준의 요약만 담고, 원본 JSON이나 민감 정보를 담지 않는다.

대표 형태:

```json
{
  "generatedAt": "2026-06-26T01:34:00+09:00",
  "status": "ok",
  "today": {
    "date": "2026-06-26",
    "tokens": 123456,
    "costUsd": 1.23
  },
  "trend": [
    { "date": "2026-06-20", "tokens": 1000, "costUsd": 0.01 }
  ],
  "limits": [
    {
      "id": "codex",
      "name": "Codex",
      "planType": "pro",
      "primary": {
        "label": "5h",
        "usedPercent": 5,
        "resetsAt": "2026-06-26T04:12:19+09:00"
      },
      "secondary": {
        "label": "1w",
        "usedPercent": 1,
        "resetsAt": "2026-07-02T23:12:19+09:00"
      }
    }
  ],
  "sources": {
    "ccusage": {
      "ok": true,
      "message": null,
      "checkedAt": "2026-06-26T01:34:00+09:00"
    },
    "codexAppServer": {
      "ok": true,
      "message": null,
      "checkedAt": "2026-06-26T01:34:00+09:00"
    }
  }
}
```

### `GET /api/debug`

파싱된 요약과 에러 로그를 반환한다.

응답 필드:

- `generatedAt`.
- `ccusage.ok`.
- `ccusage.summary`.
- `codexAppServer.ok`.
- `codexAppServer.summary`.
- `errors`.

디버그 응답 규칙:

- `ccusage.summary`는 파싱된 일수, 오늘 행 존재 여부, 사용한 비용 필드명, 최근 7일 합계를 포함한다.
- `codexAppServer.summary`는 확인된 limit bucket 수, Codex bucket 존재 여부, primary/secondary window 분 단위와 사용률을 포함한다.
- `errors`는 최근 에러의 발생 시각, 데이터 소스, 요약 메시지를 포함한다.
- `errors`에도 원본 JSON 전체, 토큰, 인증값, 환경 변수 전체, 민감한 경로는 포함하지 않는다.

## 데이터 변환

### `ccusage`

백엔드는 고정된 로컬 의존성의 `ccusage` 실행 파일을 호출한다. 출력 JSON에서 Codex daily row를 읽어 로컬 PC 시간대 기준으로 오늘 행과 최근 7일 행을 만든다.

구현 전에 실제 `ccusage codex daily --json` 출력 샘플을 확인해 비용 필드명을 확정한다. 필드명이 예상과 다르면 파서 테스트를 먼저 조정한다.

정규화 규칙:

- 최근 7일 범위는 로컬 PC 날짜 기준으로 오늘과 직전 6일이다.
- `trend`는 날짜 오름차순으로 반환한다.
- `ccusage` 호출이 성공했지만 특정 날짜 행이 없으면 해당 날짜의 토큰과 비용은 0으로 채운다.
- 오늘 날짜 행이 없으면 오늘 토큰과 비용은 0으로 표시한다.
- 비용 값은 `ccusage`가 계산한 값을 숫자로 전달하고, 화면 표시용 반올림은 프론트엔드에서만 수행한다.
- 파서는 확인된 샘플 출력 기반으로 작성하고, 샘플과 다른 필수 필드 누락은 `ccusage` 소스 실패로 처리한다.

### Codex App Server

백엔드는 `codex app-server`를 stdio transport로 짧게 실행한다. 연결 후 `initialize`, `initialized`, `account/rateLimits/read` 순서로 호출하고 종료한다.

확인된 응답 구조:

- `rateLimits.limitId`: 예: `codex`.
- `rateLimits.planType`: 예: `pro`.
- `rateLimits.primary.usedPercent`: 5시간 사용률.
- `rateLimits.primary.windowDurationMins`: 300.
- `rateLimits.primary.resetsAt`: epoch seconds.
- `rateLimits.secondary.usedPercent`: 1주 사용률.
- `rateLimits.secondary.windowDurationMins`: 10080.
- `rateLimits.secondary.resetsAt`: epoch seconds.
- `rateLimitsByLimitId`: 추가 limit bucket 목록.

프론트엔드는 `usedPercent`를 그대로 표시한다. 남은 절대량은 계산하지 않는다.

정규화 규칙:

- 기본 표시는 `limitId`가 `codex`인 bucket을 대상으로 한다.
- `primary.usedPercent`는 5시간 limit 사용률, `secondary.usedPercent`는 1주 limit 사용률로 매핑한다.
- `resetsAt`이 epoch seconds이면 백엔드에서 ISO 시각으로 변환하고 프론트엔드는 로컬 시간으로 표시한다.
- `usedPercent`가 숫자가 아니거나 Codex bucket을 찾을 수 없으면 Codex App Server 소스 실패로 처리한다.
- 진행 막대의 시각적 최대값은 100%로 제한할 수 있지만, 텍스트에는 원본 `usedPercent` 값을 표시한다.
- 추가 limit bucket은 핵심 5시간/1주 표시보다 낮은 우선순위의 보조 행으로만 표시한다.

## 에러 처리

두 데이터 소스는 독립적으로 실패할 수 있다.

- `ccusage` 성공 + Codex App Server 실패: 토큰/비용/추이는 표시하고 limit 영역은 실패 상태로 표시한다.
- `ccusage` 실패 + Codex App Server 성공: limit은 표시하고 토큰/비용/추이는 실패 상태로 표시한다.
- 둘 다 실패: 전체 실패 상태를 표시한다.

백엔드는 에러 메시지를 사용자에게 필요한 수준으로 요약한다. 토큰, 인증값, 환경 변수, 경로에 포함된 민감 정보는 노출하지 않는다.

MVP에서는 마지막 성공 응답을 캐시해 실패 시 대체 표시하지 않는다. 캐시를 추가하면 "현재 값"과 "과거 성공 값"을 구분하는 UI가 필요하므로 첫 버전 범위에서는 제외한다.

외부 명령과 App Server 호출에는 유한한 timeout을 둔다. timeout, 비정상 종료, JSON 파싱 실패, 필수 필드 누락은 해당 데이터 소스의 실패로 처리한다.

## 테스트

필수 테스트:

- `ccusage` JSON 파서가 오늘 사용량과 최근 7일 추이를 만든다.
- `ccusage` JSON 파서가 로컬 PC 날짜 기준 최근 7일을 만들고 누락 날짜를 0으로 채운다.
- Codex App Server rate limit 파서가 5시간/1주 사용률을 만든다.
- Codex App Server rate limit 파서가 Codex bucket 누락과 잘못된 `usedPercent`를 실패로 처리한다.
- 두 데이터 소스 성공 시 `status`가 `ok`가 된다.
- 한쪽 데이터 소스만 실패하면 `status`가 `partial`이 된다.
- 양쪽 데이터 소스가 실패하면 `status`가 `error`가 된다.
- `/api/dashboard`가 통합 응답을 반환한다.
- `/api/debug`가 원본 JSON 전체 없이 요약과 에러 로그를 반환한다.
- 에러 메시지에 토큰, 인증값, 환경 변수 전체, 원본 JSON 전체가 포함되지 않는다.
- 자동 갱신 주기가 60초이며 수동 새로고침 중 중복 요청을 막는다.

수동 검증:

- `npm run dev`로 앱을 실행한다.
- `/`에서 오늘 토큰/비용, 최근 7일 추이, 5시간/1주 사용률을 확인한다.
- `/debug`에서 파싱 요약과 에러 로그를 확인한다.
- `npm run build`가 통과한다.
- `npm start`로 빌드된 앱이 실행된다.

## 승인 상태

- 요구사항: 승인됨.
- 본 설계 문서: 대리 승인으로 작성됨.
- 구현 계획: 미작성.
- 구현: 미진행.
