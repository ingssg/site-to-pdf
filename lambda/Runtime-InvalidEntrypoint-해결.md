# Runtime.InvalidEntrypoint 에러 해결 가이드

## 현재 에러
- **에러 타입**: `Runtime.InvalidEntrypoint`
- **RequestId**: `c8e4589a-7103-4999-83ea-a9725f59a9f1`
- **Timestamp**: `2026-01-11T14:16:16.238Z`

## 원인
Lambda Container Image를 사용할 때 Handler 설정이 잘못되었습니다.

## 해결 방법

### 1. Lambda 함수 설정 확인 및 수정

1. **AWS Lambda 콘솔** 접속
2. `site-to-pdf-worker2` 함수 선택
3. **"구성"** 탭 클릭
4. **"일반 구성"** 섹션 확인
5. **"편집"** 클릭

### 2. Handler 설정 확인

Container Image를 사용할 때는 **Handler를 비워두거나 올바르게 설정**해야 합니다.

#### 옵션 1: Handler 비우기 (권장)
- **Handler** 필드를 **비워두기** (빈 값)
- AWS Lambda가 Dockerfile의 `CMD`를 자동으로 사용합니다

#### 옵션 2: Handler 명시
- **Handler**: `index.handler` 입력
- Dockerfile의 `CMD ["index.handler"]`와 일치해야 합니다

### 3. Image Configuration 확인

1. **"구성"** 탭 → **"일반 구성"** 클릭
2. **"편집"** 클릭
3. **"이미지"** 섹션 확인:
   - **이미지 URI**: ECR 이미지 URI가 올바른지 확인
   - **이미지 태그**: `latest` 또는 특정 태그 확인

### 4. Dockerfile CMD 확인

현재 Dockerfile의 CMD는 올바릅니다:
```dockerfile
CMD ["index.handler"]
```

이것은 `index.js` 파일의 `exports.handler` 함수를 가리킵니다.

### 5. 파일 구조 확인

Lambda 함수에 다음 파일들이 포함되어 있는지 확인:
- ✅ `index.js` (핸들러 파일)
- ✅ `crawler.js`
- ✅ `ai.js`
- ✅ `pdf.js`
- ✅ `package.json`

Dockerfile에서 이 파일들이 복사되는지 확인:
```dockerfile
COPY index.js crawler.js ai.js pdf.js ./
```

## 단계별 해결 체크리스트

### ✅ 1단계: Lambda 함수 설정 확인
- [ ] Lambda 콘솔 → `site-to-pdf-worker2` 함수 선택
- [ ] **"구성"** 탭 → **"일반 구성"** 클릭
- [ ] **Handler** 필드 확인:
  - 비어있거나
  - `index.handler`로 설정되어 있는지 확인

### ✅ 2단계: Handler 수정 (필요시)
- [ ] **"편집"** 클릭
- [ ] **Handler** 필드:
  - **비워두기** (권장) 또는
  - `index.handler` 입력
- [ ] **"저장"** 클릭

### ✅ 3단계: 이미지 재배포 확인
- [ ] **"Code"** 탭 확인
- [ ] 최신 이미지가 배포되었는지 확인
- [ ] 필요시 **"Deploy new image"** 클릭

### ✅ 4단계: 테스트
- [ ] Lambda 콘솔 → **"테스트"** 탭
- [ ] 테스트 이벤트 실행
- [ ] CloudWatch Logs에서 에러 확인

## 예상 결과

### 성공 시
- `Runtime.InvalidEntrypoint` 에러가 사라짐
- `[Lambda] 워커 시작` 로그가 출력됨
- 함수가 정상적으로 실행됨

### 여전히 실패하는 경우
- CloudWatch Logs에서 새로운 에러 메시지 확인
- Dockerfile의 `CMD` 형식 확인
- `index.js`의 `exports.handler` 확인

## 추가 확인 사항

### Dockerfile CMD 형식
올바른 형식:
```dockerfile
CMD ["index.handler"]
```

잘못된 형식:
```dockerfile
CMD ["node", "index.js"]  # ❌ 이렇게 하면 안 됩니다
CMD index.handler         # ❌ 이렇게도 안 됩니다
```

### index.js 핸들러 형식
올바른 형식:
```javascript
exports.handler = async (event) => {
  // ...
};
```

## 참고
- AWS Lambda Container Image는 베이스 이미지 `public.ecr.aws/lambda/nodejs:20`를 사용할 때 자동으로 `index.handler`를 찾습니다.
- Handler를 명시적으로 설정하지 않아도 Dockerfile의 `CMD`가 사용됩니다.
- 하지만 Lambda 함수 설정에서 Handler가 잘못 설정되어 있으면 `Runtime.InvalidEntrypoint` 에러가 발생할 수 있습니다.
