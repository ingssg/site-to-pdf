# AWS Lambda Worker

이 디렉토리는 AWS Lambda에서 실행되는 워커 함수를 포함합니다.

## 구조

- `index.js`: Lambda 핸들러 메인 파일
- `package.json`: Lambda 함수 의존성

## 배포 방법

1. 의존성 설치:
   ```bash
   cd lambda
   npm install
   ```

2. ZIP 파일 생성:
   ```bash
   npm run deploy
   ```

3. AWS Lambda 콘솔에서:
   - "Upload from" → ".zip file" 선택
   - 생성된 `function.zip` 업로드

## 환경 변수

Lambda 함수에 다음 환경 변수를 설정해야 합니다:

- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key
- `OPENAI_API_KEY`: OpenAI API Key

## 구현 상태

✅ **완전한 워커 구현 완료**

모든 기능이 기존 로컬 환경과 동일하게 작동합니다:

- ✅ **크롤링**: 기존 `src/lib/crawler/index.ts` 완전 포팅
  - 스마트 모드 지원
  - 페이지 필터링
  - 이미지 로딩 최적화
  - 전체 페이지 스크린샷

- ✅ **AI 요약**: 기존 `src/lib/ai/index.ts` 완전 포팅
  - 전체 웹사이트 요약 (detailed 레벨)
  - 개별 페이지 요약
  - 페이지 타입별 맞춤 분석

- ✅ **PDF 생성**: 기본 PDF 생성 기능 포함
  - 통합 PDF 생성
  - ZIP 파일 생성
  - Supabase Storage 업로드

## 주의사항

- 모든 PDF 생성 기능이 로컬 환경과 동일하게 구현되어 있습니다 (통합 PDF, 개별 PDF 추출, 스크린샷 PDF).
- HTML 템플릿은 인라인으로 포함되어 있어 Lambda 환경에서 파일 시스템 접근 없이 동작합니다.
- Lambda 배포 시 ZIP 파일 크기 제한(250MB)을 고려하여 필요한 파일만 포함하세요.
