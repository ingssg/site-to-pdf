# Lambda 크롤러 트러블슈팅

## 요약
Lambda에서 Playwright + `@sparticuz/chromium` 조합으로 크롤링 시, 첫 페이지만 처리하고 이후 페이지에서 브라우저/컨텍스트가 닫히는 문제가 발생했다.  
근본 원인은 `chromium.args`에 포함된 `--single-process`로 보이며, 이를 제거하자 다페이지 크롤링이 정상 동작했다.

## 증상
- 첫 페이지만 크롤링 후 종료
- 에러 로그 예시
  - `Target page, context or browser has been closed`
  - `browserContext.newPage: Target page, context or browser has been closed`

## 영향
- 크롤링이 1페이지에서 멈춰 전체 작업이 완료되지 않음
- PDF 생성 파이프라인까지 이어지지 않거나 불완전한 결과 생성

## 원인
- Lambda 환경에서 `@sparticuz/chromium`의 **single-process 모드**가 브라우저 안정성을 저하시킴
- 첫 페이지 처리 이후 컨텍스트/브라우저가 비정상적으로 종료됨

## 해결
### 1) `--single-process` 제거
`lambda/crawler.js`에서 Chromium 런치 인자에서 `--single-process`를 제거했다.

```js
const launchArgs = chromium.args.filter((arg) => arg !== "--single-process");
```

### 2) 브라우저 연결 끊김 로그 추가
브라우저 종료 시점을 파악하기 위해 `disconnected` 이벤트 로그를 추가했다.

```js
this.browser.on("disconnected", () => {
  console.warn("[Crawler] 브라우저 연결 끊김");
});
```

## 결과
다중 페이지 크롤링 정상 동작 확인.  
예시 로그 (요약):
- 10/10 페이지 크롤링 완료
- Smart Mode 필터링 정상 동작
- 작업 완료 후 브라우저 연결 종료 로그 출력

## 배치 끝(30%/40%)에서 멈추는 문제

- 증상: `60/60` 또는 `80/80` 직후 **진행률이 30%/40%에서 정지**
- 로그 패턴: `[Crawler] 브라우저 연결 끊김` 이후 Lambda 종료
- 원인: 브라우저 disconnect가 발생하면 **크롤러가 중단되며 배치 완료/재호출 로직이 실행되지 않음**
- 해결:
  - 브라우저 disconnect를 감지하면 **큐 처리 루프를 중단하고 현재 상태를 반환**
  - `crawl()`에서 큐 처리 에러를 **catch**하고 **부분 상태로 반환**
  - **진행 중(in-flight) URL을 큐로 복원**하여 다음 배치에서 재시도
  - 배치 종료/재호출 단계에 **로그 추가**로 실제 실행 여부 추적
- 기대 효과: 브라우저가 끊겨도 **배치 완료 처리 및 다음 배치 재호출**이 정상 진행됨

## 참고 사항
- `page.close()`는 Lambda + single-process 환경에서 브라우저 전체 종료를 유발할 수 있어 주의
- 컨텍스트는 링크 추출 후 즉시 정리하여 누적 리소스 문제를 방지

