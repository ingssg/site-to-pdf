# Runtime.InvalidEntrypoint 최종 해결 가이드

## 현재 상황
- CMD 주석 처리 여부와 관계없이 `Runtime.InvalidEntrypoint` 에러 발생
- 비동기식 호출은 "성공"하지만 실제로는 함수가 실행되지 않음
- CloudWatch Logs에서 계속 에러 발생

## 가능한 원인

### 1. Lambda 콘솔 CMD 재정의 설정 문제
Lambda 콘솔에서 CMD 재정의를 설정했지만 형식이 잘못되었을 수 있습니다.

### 2. 베이스 이미지 ENTRYPOINT 충돌
AWS Lambda Node.js 베이스 이미지의 ENTRYPOINT와 CMD가 충돌할 수 있습니다.

### 3. 이미지 배포 문제
이미지가 제대로 배포되지 않았을 수 있습니다.

## 해결 방법

### 방법 1: Lambda 콘솔에서 CMD 재정의 제거 (권장)

AWS Lambda Node.js 베이스 이미지를 사용할 때는 **CMD 재정의를 비워두는 것**이 가장 안전합니다.

**단계:**
1. Lambda 콘솔 → `site-to-pdf-worker2` 함수 선택
2. **"이미지"** 탭 클릭
3. **"이미지 구성"** → **"편집"** 클릭
4. **"CMD 재정의"** 필드를 **완전히 비워두기** (`-`로 설정)
5. **"저장"** 클릭

### 방법 2: Dockerfile에서 CMD 제거

AWS Lambda Node.js 베이스 이미지는 자동으로 `index.handler`를 찾습니다.

**Dockerfile 수정:**
```dockerfile
# Lambda 핸들러 코드 복사
COPY index.js crawler.js ai.js pdf.js ./

# CMD 제거 - 베이스 이미지가 자동으로 index.handler를 찾습니다
# CMD ["index.handler"]
```

그 다음:
1. 이미지 재빌드 및 푸시
2. Lambda 함수에 새 이미지 배포

### 방법 3: ENTRYPOINT 명시 (고급)

베이스 이미지의 ENTRYPOINT를 확인하고 명시적으로 설정:

```dockerfile
# 베이스 이미지의 ENTRYPOINT 확인 필요
# 일반적으로 /lambda-entrypoint.sh 또는 /var/runtime/bootstrap
```

하지만 이 방법은 복잡하므로 권장하지 않습니다.

## 권장 해결 순서

### 1단계: Lambda 콘솔 CMD 재정의 확인
1. Lambda 콘솔 → **"이미지"** 탭
2. **"이미지 구성"** 확인
3. **"CMD 재정의"** 필드:
   - 현재 값이 무엇인지 확인
   - **비워두기** (`-`)로 설정
4. **"저장"** 클릭

### 2단계: 테스트
1. **"테스트"** 탭에서 **동기식**으로 테스트
2. CloudWatch Logs 확인

### 3단계: 여전히 실패하면 Dockerfile 수정
1. Dockerfile에서 CMD 주석 처리
2. 이미지 재빌드 및 푸시
3. Lambda 함수에 새 이미지 배포
4. 다시 테스트

## 확인 사항

### Lambda 콘솔에서 확인
- **"이미지 구성"** → **"CMD 재정의"** 값이 무엇인지
- **"이미지 URI"**가 최신 이미지를 가리키는지
- **"아키텍처"**가 `x86_64`인지 (또는 빌드한 아키텍처와 일치하는지)

### CloudWatch Logs에서 확인
- `Runtime.InvalidEntrypoint` 에러 메시지 전체
- `ProcessSpawnFailed` 에러 메시지 전체
- 다른 에러 메시지가 있는지

## 참고

### AWS Lambda Node.js 베이스 이미지
- `public.ecr.aws/lambda/nodejs:20`는 자동으로 `index.handler`를 찾습니다
- CMD를 설정하지 않아도 작동합니다
- Container Image를 사용할 때는 Lambda 콘솔에서 CMD 재정의를 비워두는 것이 안전합니다

### CMD 재정의 형식
- Lambda 콘솔에서 CMD 재정의를 설정할 때는 문자열 형식 사용: `index.handler`
- Dockerfile에서는 배열 형식 사용: `CMD ["index.handler"]`

## 다음 단계

1. **먼저**: Lambda 콘솔에서 CMD 재정의를 비워두고 테스트
2. **여전히 실패하면**: Dockerfile에서 CMD 제거하고 이미지 재빌드
3. **그래도 실패하면**: CloudWatch Logs의 전체 에러 메시지 공유
