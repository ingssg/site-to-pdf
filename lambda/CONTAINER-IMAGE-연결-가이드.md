# Lambda Container Image 연결 가이드 (한글)

## 목차

1. [ECR 이미지 URI 확인](#1-ecr-이미지-uri-확인)
2. [기존 함수를 Container Image로 변경](#2-기존-함수를-container-image로-변경)
3. [새 함수를 Container Image로 생성](#3-새-함수를-container-image로-생성)

---

## 1. ECR 이미지 URI 확인

### 방법 A: AWS 콘솔에서 확인

1. **AWS 콘솔** → **ECR** (Elastic Container Registry) 메뉴
2. 왼쪽 메뉴에서 **"리포지토리"** 클릭
3. `site-to-pdf-lambda-worker` 리포지토리 클릭
4. 이미지 목록에서 `latest` 태그 클릭
5. **"이미지 URI 복사"** 버튼 클릭
   - 형식: `058264344830.dkr.ecr.ap-northeast-2.amazonaws.com/site-to-pdf-lambda-worker:latest`

### 방법 B: 터미널에서 확인

```bash
aws ecr describe-repositories \
  --repository-names site-to-pdf-lambda-worker \
  --region ap-northeast-2 \
  --query 'repositories[0].repositoryUri' \
  --output text
```

---

## 2. 기존 함수를 Container Image로 변경

### 단계별 가이드

#### 2-1. Lambda 함수 페이지 접속

1. **AWS 콘솔** → **Lambda** 메뉴
2. 함수 목록에서 `site-to-pdf-worker` 클릭

#### 2-2. 코드 소스 탭에서 변경

1. 상단 탭에서 **"코드 소스"** 클릭
2. 오른쪽 상단의 **"에서 업로드"** 버튼 클릭
3. 드롭다운 메뉴에서 **"Container image"** 선택
   - ⚠️ 만약 "Container image" 옵션이 보이지 않으면, 아래 "새 함수 생성" 방법 사용

#### 2-3. ECR 이미지 선택

1. **"이미지 URI 입력"** 또는 **"이미지 찾아보기"** 클릭
2. ECR 리포지토리에서 이미지 선택:
   - **리포지토리**: `site-to-pdf-lambda-worker`
   - **이미지 태그**: `latest`
3. **"선택"** 또는 **"저장"** 클릭

#### 2-4. 배포

1. 이미지 선택 후 **"배포"** 버튼 클릭
2. 배포 완료까지 대기 (몇 분 소요)

---

## 3. 새 함수를 Container Image로 생성

기존 함수에서 Container Image 옵션이 보이지 않으면 새 함수를 생성하세요.

### 단계별 가이드

#### 3-1. 함수 생성 시작

1. **AWS 콘솔** → **Lambda** 메뉴
2. 오른쪽 상단의 **"함수 생성"** 버튼 클릭

#### 3-2. 함수 생성 방식 선택

1. **"컨테이너 이미지"** 옵션 선택
2. **"함수 이름"** 입력: `site-to-pdf-worker` (또는 원하는 이름)
3. **"컨테이너 이미지 URI"** 입력:
   ```
   058264344830.dkr.ecr.ap-northeast-2.amazonaws.com/site-to-pdf-lambda-worker:latest
   ```
   - 위 URI는 예시입니다. 실제 ECR URI를 사용하세요.

#### 3-3. 실행 역할 설정

1. **"실행 역할"** 섹션에서:
   - 기존 역할 사용: `site-to-pdf-worker-role-lolpzmvx` 선택
   - 또는 새 역할 생성

#### 3-4. 함수 생성

1. 하단의 **"함수 생성"** 버튼 클릭
2. 함수 생성 완료까지 대기

---

## 4. 함수 설정 확인

### 4-1. 일반 구성

1. **"구성"** 탭 → **"일반 구성"** 클릭
2. **"편집"** 클릭
3. 다음 설정 확인/변경:
   - **메모리**: `2048 MB` (2GB) 이상
   - **제한 시간**: `900초` (15분)
   - **에피소드 스토리지**: `2048 MB` (2GB) 이상
4. **"저장"** 클릭

### 4-2. 환경 변수

1. **"구성"** 탭 → **"환경 변수"** 클릭
2. 다음 변수들이 설정되어 있는지 확인:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
3. 없으면 **"편집"** → **"환경 변수 추가"**로 추가

### 4-3. 함수 URL

1. **"구성"** 탭 → **"함수 URL"** 클릭
2. Function URL이 있는지 확인
3. 없으면 **"생성"** 클릭:
   - **인증 유형**: `NONE`
   - **CORS**: 필요시 설정
4. 생성된 URL을 복사하여 Vercel 환경 변수에 설정

---

## 5. 테스트

### 5-1. 테스트 이벤트 생성

1. **"테스트"** 탭 클릭
2. **"새 이벤트 생성"** 클릭
3. 이벤트 이름: `test-container-image`
4. 이벤트 JSON:
   ```json
   {
     "body": "{\"jobId\":\"test-123\"}"
   }
   ```
5. **"저장"** 클릭

### 5-2. 테스트 실행

1. **"테스트"** 버튼 클릭
2. 실행 결과 확인
3. **"모니터링"** 탭에서 CloudWatch Logs 확인

---

## 문제 해결

### Container Image 옵션이 보이지 않는 경우

- Lambda 함수가 ZIP 배포 방식으로 생성된 경우, Container Image로 변경할 수 없을 수 있습니다
- 해결: 새 함수를 Container Image로 생성하고, 기존 함수의 환경 변수와 Function URL을 복사

### 이미지를 찾을 수 없는 경우

- ECR 리포지토리와 이미지 태그 확인
- 이미지가 같은 리전(ap-northeast-2)에 있는지 확인
- ECR 리포지토리 권한 확인

### 빌드 실패하는 경우

- Dockerfile 문법 확인
- CloudWatch Logs에서 상세 에러 확인

---

## 다음 단계

Container Image 연결이 완료되면:

1. ✅ 환경 변수 설정 확인
2. ✅ 메모리/타임아웃 설정 확인
3. ✅ Function URL 확인
4. ✅ 테스트 실행
5. ✅ Vercel에서 실제 크롤링 테스트
