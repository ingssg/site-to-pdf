# Lambda Container Image 배포 가이드

## 개요

Playwright를 Lambda에서 사용하기 위한 Container Image 방식입니다.
브라우저 바이너리가 이미지에 포함되어 있어 별도의 Layer 설정이 필요 없습니다.

## 전제 조건

- AWS CLI 설치 및 구성
- Docker 설치
- ECR 접근 권한

## 배포 방법

### 1. ECR 리포지토리 생성

```bash
aws ecr create-repository \
  --repository-name site-to-pdf-lambda-worker \
  --region ap-northeast-2
```

### 2. 이미지 빌드 및 푸시

```bash
cd lambda
chmod +x build-and-push.sh
./build-and-push.sh
```

또는 수동으로:

```bash
# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.ap-northeast-2.amazonaws.com

# 이미지 빌드
docker build -t site-to-pdf-lambda-worker:latest .

# 이미지 태그
docker tag site-to-pdf-lambda-worker:latest \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.ap-northeast-2.amazonaws.com/site-to-pdf-lambda-worker:latest

# ECR에 푸시
docker push \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.ap-northeast-2.amazonaws.com/site-to-pdf-lambda-worker:latest
```

### 3. Lambda 함수 설정

1. AWS Lambda 콘솔 → 함수 선택
2. "Code" 탭 → "Container image" 선택
3. "Browse images" 클릭
4. ECR 리포지토리에서 이미지 선택
5. "Deploy" 클릭

### 4. 환경 변수 설정

Lambda 함수에 다음 환경 변수를 설정:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

### 5. 메모리 및 타임아웃 설정

- **Memory**: 2048 MB (2GB) 이상 권장
- **Timeout**: 900초 (15분) - Lambda 최대값
- **Ephemeral storage**: 2048 MB (2GB) 이상 권장

## 이미지 크기

- 예상 크기: ~1.5GB (Playwright + Chromium 포함)
- ECR 스토리지 비용: 약 $0.10/GB/월

## 장점

✅ 브라우저 바이너리가 이미 포함됨
✅ 공식 Playwright 이미지 사용 가능
✅ Layer 설정 불필요
✅ 더 안정적인 실행 환경

## 단점

⚠️ 이미지 크기가 큼 (~1.5GB)
⚠️ 빌드 시간이 길 수 있음
⚠️ ECR 스토리지 비용 발생
