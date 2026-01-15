# DB 타임아웃 대응 (크롤링 결과 저장)

## 문제
크롤링 완료 후 `jobs` 테이블에 결과를 저장할 때,
스크린샷(`screenshot`, `fullPageScreenshot`)을 **base64로 직접 저장**하면서
업데이트 payload가 커져 **DB statement timeout(57014)**가 발생했다.

## 해결 방식
스크린샷 이미지는 DB에 저장하지 않고 **Supabase Storage에 업로드**한 뒤,
DB에는 **URL만 저장**한다.

### 변경 요점
- 크롤링 단계에서:
  - `page.screenshot`, `page.fullPageScreenshot`을 Storage에 업로드
  - DB에는 `screenshotUrl`, `fullPageScreenshotUrl`만 저장
- PDF 생성 단계에서:
  - `screenshotUrl` / `fullPageScreenshotUrl`을 다시 다운로드해 Buffer로 복원

## 변경 위치
- `lambda/index.js`
  - 크롤링 결과 저장 시 Storage 업로드로 전환
  - PDF 생성 시 URL 기반 다운로드 로직 추가

## 기대 효과
- DB 업데이트 payload 크기 감소
- `statement timeout` 오류 감소
- 대용량 크롤링 요청(예: 200페이지)에서도 안정적으로 상태 업데이트 가능

## 참고
- Storage 업로드/다운로드 실패 시에도 작업은 계속 진행되며,
  해당 페이지는 스크린샷 없이 처리된다.

