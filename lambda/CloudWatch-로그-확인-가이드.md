# CloudWatch 로그 확인 가이드

## 현재 상황
Lambda 함수가 실패하고 있습니다. CloudWatch 로그에서 정확한 원인을 확인해야 합니다.

## 확인 방법

### 방법 1: LogStream 링크 클릭 (가장 빠름)
1. CloudWatch 테이블에서 **LogStream** 컬럼의 링크 클릭
2. 해당 로그 스트림의 전체 로그 확인
3. 에러 메시지와 스택 트레이스 확인

### 방법 2: Lambda 콘솔에서 확인
1. Lambda 콘솔 → `site-to-pdf-worker2` 함수 선택
2. **"모니터링"** 탭 클릭
3. **"CloudWatch에서 로그 보기"** 클릭
4. 최신 로그 스트림 선택
5. 에러가 발생한 로그 확인

### 방법 3: RequestId로 검색
1. CloudWatch Logs → Log groups → `/aws/lambda/site-to-pdf-worker2` 선택
2. 검색창에 RequestId 입력 (예: `b15ba4aa-dfe9-4932-8715-b324c8e10395`)
3. 해당 호출의 전체 로그 확인

## 확인해야 할 내용

### 1. 에러 메시지 전체
```
Crawl error: browserType.launch: Executable doesn't exist at ...
```
이 에러의 **전체 경로**를 확인하세요.

### 2. 브라우저 경로 로그
다음 로그가 있는지 확인:
```
[Crawler] Playwright 브라우저 경로: /var/task/.cache/ms-playwright/...
```
또는
```
[Crawler] 브라우저 경로 자동 감지 실패, 기본 설정 사용
```

### 3. Playwright 설치 로그
Docker 빌드 시 Playwright 설치가 성공했는지 확인:
```
Installing Chromium...
```

### 4. 환경 변수 확인
다음 환경 변수가 설정되어 있는지 확인:
- `PLAYWRIGHT_BROWSERS_PATH`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## 예상되는 문제들

### 문제 1: 브라우저가 설치되지 않음
**증상**: `Executable doesn't exist` 에러
**원인**: Docker 이미지에 Chromium이 제대로 설치되지 않음
**해결**: Docker 이미지 재빌드 필요

### 문제 2: 브라우저 경로 불일치
**증상**: `Executable doesn't exist` 에러, 하지만 브라우저는 설치됨
**원인**: `PLAYWRIGHT_BROWSERS_PATH` 환경 변수가 잘못 설정됨
**해결**: Lambda 함수의 환경 변수 확인

### 문제 3: 권한 문제
**증상**: 브라우저 파일에 접근할 수 없음
**원인**: 파일 권한 문제
**해결**: Dockerfile에서 권한 설정 확인

## 다음 단계
1. **LogStream 링크 클릭**하여 상세 로그 확인
2. **에러 메시지 전체** 복사
3. **브라우저 경로 로그** 확인
4. 결과를 알려주시면 추가 해결 방법 제시
