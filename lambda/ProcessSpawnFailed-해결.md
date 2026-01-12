# ProcessSpawnFailed 에러 해결 가이드

## 현재 에러
- **에러 타입**: `Runtime.InvalidEntrypoint`
- **에러 메시지**: `ProcessSpawnFailed`
- **원인**: Lambda가 핸들러 프로세스를 시작하지 못함

## 가능한 원인

### 1. CMD 재정의 형식 문제
Lambda 콘솔에서 CMD 재정의를 설정할 때 형식이 잘못되었을 수 있습니다.

### 2. Dockerfile CMD 형식 문제
AWS Lambda Node.js 베이스 이미지를 사용할 때는 특별한 형식이 필요합니다.

## 해결 방법

### 방법 1: CMD 재정의를 비워두기 (권장)

AWS Lambda Node.js 베이스 이미지(`public.ecr.aws/lambda/nodejs:20`)를 사용할 때는:
- Dockerfile의 `CMD`가 자동으로 사용됩니다
- Lambda 콘솔에서 CMD 재정의를 **비워두는 것**이 더 안전할 수 있습니다

**단계:**
1. Lambda 콘솔 → **"이미지"** 탭
2. **"이미지 구성"** → **"편집"** 클릭
3. **"CMD 재정의"** 필드를 **비워두기** (`-`로 설정)
4. **"저장"** 클릭

### 방법 2: Dockerfile CMD 수정

현재 Dockerfile:
```dockerfile
CMD ["index.handler"]
```

이것은 올바른 형식이지만, AWS Lambda Node.js 베이스 이미지를 사용할 때는 다음과 같이 시도해볼 수 있습니다:

**옵션 A: CMD 제거 (베이스 이미지 기본값 사용)**
```dockerfile
# CMD를 제거하면 베이스 이미지가 자동으로 index.handler를 찾습니다
# CMD ["index.handler"]  # 이 줄을 주석 처리하거나 삭제
```

**옵션 B: ENTRYPOINT 명시 (필요시)**
```dockerfile
# 베이스 이미지의 ENTRYPOINT를 그대로 사용
# ENTRYPOINT는 설정하지 않음
CMD ["index.handler"]
```

### 방법 3: CMD 재정의 형식 변경

Lambda 콘솔에서 CMD 재정의를 설정할 때:
- ✅ 올바른 형식: `index.handler` (문자열)
- ❌ 잘못된 형식: `["index.handler"]` (배열 형식)
- ❌ 잘못된 형식: `/var/task/index.handler` (절대 경로)

## 단계별 해결 체크리스트

### ✅ 1단계: CMD 재정의 확인
1. Lambda 콘솔 → **"이미지"** 탭
2. **"이미지 구성"** 섹션 확인
3. **"CMD 재정의"** 값 확인:
   - 현재: `index.handler` 또는 다른 값
   - 변경: **비워두기** (`-`)

### ✅ 2단계: Dockerfile 확인
현재 Dockerfile의 CMD는 올바릅니다:
```dockerfile
CMD ["index.handler"]
```

### ✅ 3단계: 이미지 재빌드 (필요시)
CMD 재정의를 비워두고도 에러가 발생하면:
1. Dockerfile에서 CMD를 주석 처리
2. 이미지 재빌드 및 푸시
3. Lambda 함수에 새 이미지 배포

### ✅ 4단계: 테스트
1. **"테스트"** 탭에서 테스트 실행
2. CloudWatch Logs에서 에러 확인

## 예상 결과

### 성공 시
- `Runtime.InvalidEntrypoint` 에러가 사라짐
- `ProcessSpawnFailed` 에러가 사라짐
- `[Lambda] 워커 시작` 로그가 출력됨

### 여전히 실패하는 경우
- CloudWatch Logs에서 새로운 에러 메시지 확인
- Dockerfile의 CMD 형식 재확인
- 베이스 이미지 변경 고려

## 추가 확인 사항

### index.js 파일 확인
핸들러가 올바르게 export되어 있는지 확인:
```javascript
exports.handler = async (event) => {
  // ...
};
```

### 파일 권한 확인
Dockerfile에서 파일이 올바르게 복사되는지 확인:
```dockerfile
COPY index.js crawler.js ai.js pdf.js ./
```

## 권장 해결 순서

1. **먼저 시도**: Lambda 콘솔에서 CMD 재정의를 **비워두기** (`-`)
2. **여전히 실패하면**: Dockerfile에서 CMD를 주석 처리하고 이미지 재빌드
3. **그래도 실패하면**: CloudWatch Logs의 전체 에러 메시지 확인
