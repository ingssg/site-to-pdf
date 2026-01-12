# CMD 재정의 설정 가이드

## 현재 상황
- **에러**: `Runtime.InvalidEntrypoint`
- **원인**: "이미지 구성"에서 CMD 재정의가 설정되지 않음 (`-`)

## 해결 방법

### 1. 이미지 구성 편집

1. Lambda 콘솔 → `site-to-pdf-worker2` 함수 선택
2. **"이미지"** 탭 클릭 (현재 위치)
3. **"이미지 구성"** 섹션에서 **"편집"** 버튼 클릭

### 2. CMD 재정의 설정

**"CMD 재정의"** 필드에 다음을 입력:
```
index.handler
```

**중요**: 
- 따옴표 없이 입력
- `index.handler` 형식 (파일명.함수명)
- Dockerfile의 `CMD ["index.handler"]`와 일치해야 함

### 3. 저장

1. **"저장"** 버튼 클릭
2. 설정 적용까지 몇 초 대기

### 4. 테스트

1. **"테스트"** 탭 클릭
2. 테스트 이벤트 실행
3. CloudWatch Logs에서 에러 확인

## 예상 결과

### 성공 시
- `Runtime.InvalidEntrypoint` 에러가 사라짐
- `[Lambda] 워커 시작` 로그가 출력됨
- 함수가 정상적으로 실행됨

### 여전히 실패하는 경우
- CloudWatch Logs에서 새로운 에러 메시지 확인
- Dockerfile의 `CMD` 형식 확인
- `index.js`의 `exports.handler` 확인

## 참고

### Dockerfile CMD
현재 Dockerfile:
```dockerfile
CMD ["index.handler"]
```

### index.js 핸들러
```javascript
exports.handler = async (event) => {
  // ...
};
```

### CMD 재정의 형식
- ✅ 올바른 형식: `index.handler`
- ❌ 잘못된 형식: `["index.handler"]` (배열 형식 사용 안 함)
- ❌ 잘못된 형식: `node index.js` (이것도 안 됨)

## 추가 확인 사항

### ENTRYPOINT 재정의
- 일반적으로 비워두면 됨 (`-`)
- Dockerfile에 `ENTRYPOINT`가 있으면 그대로 사용

### WORKDIR 재정의
- 일반적으로 비워두면 됨 (`-`)
- Dockerfile에 `WORKDIR`가 있으면 그대로 사용

## 다음 단계

1. **"이미지 구성"** → **"편집"** 클릭
2. **"CMD 재정의"**에 `index.handler` 입력
3. **"저장"** 클릭
4. 테스트 실행
