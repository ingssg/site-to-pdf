# UI 상태/다운로드 개선 기록

이 문서는 진행률 표시, 용량 표기, 다운로드 동작, 스크린샷 PDF 넘버링 관련 수정 사항을 기록한다.

## 변경 요약

1. **AI 요약 진행률 100% 처리**

- `generating_pdf` 상태로 전환되면 AI 요약은 완료로 간주.
- 진행률 모달에서 **AI 요약 프로그레스바를 100%로 고정**.

2. **결과 화면 용량 단위 표기 보정**

- `totalSizeMB`, `zipSizeMB` 값에 단위가 없을 경우 **자동으로 `MB`를 붙임**.

3. **원본 스크린샷 PDF 다운로드 방식 통일**

- 브라우저 열기 대신 **항상 fetch → blob → 다운로드** 방식으로 변경.

4. **원본 스크린샷 PDF 페이지 넘버링**

- 표지는 **페이지 번호 없음**.
- 스크린샷 페이지는 **1부터 시작**.

5. **PDF 생성 팝업 문구/진행률 보정**

- `generating_pdf` 상태에서는 AI 요약 설명 문구를 **"AI 요약 완료!"**로 고정.
- "PDF 생성 준비 중..." → **"PDF 생성 중"**으로 변경.
- `generating_pdf` 진입 시 PDF 진행률을 **최소 30%**로 보정.

## 적용 위치

- `src/components/features/PDFGenerationProgressModal.tsx`
- `src/components/features/PageSelector.tsx`
- `src/components/features/ResultDisplay.tsx`
- `src/lib/pdf/html-generator.ts` / `src/lib/pdf/templates/screenshot-pdf.html`
## 진행 상황

- [x] AI 요약 진행률 100% 반영
- [x] 결과 화면 용량 단위 표기 보정
- [x] 원본 스크린샷 PDF 다운로드 방식 변경
- [x] 스크린샷 PDF 넘버링 기준 확인/유지
- [x] PDF 생성 팝업 문구/진행률 보정
