# Container Image Handler 설정 찾기

## 현재 상황
Container Image를 사용하는 Lambda 함수에서는 Handler 설정이 일반 설정 페이지에 없습니다.

## Handler 설정 위치

### 방법 1: Code 탭에서 확인 (권장)

1. Lambda 콘솔 → `site-to-pdf-worker2` 함수 선택
2. **"Code"** 탭 클릭
3. **"Image configuration"** 또는 **"이미지 구성"** 섹션 확인
4. 여기에 **Handler** 필드가 있을 수 있습니다

### 방법 2: 런타임 설정에서 확인

1. **"구성"** 탭 클릭
2. 왼쪽 메뉴에서 **"런타임 설정"** 또는 **"Runtime settings"** 클릭
3. **"편집"** 클릭
4. **Handler** 필드 확인:
   - 비워두기 (권장) 또는
   - `index.handler` 입력

### 방법 3: Container Image는 Handler가 자동 설정됨

Container Image를 사용할 때는:
- Dockerfile의 `CMD ["index.handler"]`가 자동으로 사용됩니다
- 별도로 Handler를 설정하지 않아도 됩니다
- **하지만** `Runtime.InvalidEntrypoint` 에러가 발생하면 명시적으로 설정해야 합니다

## 해결 방법

### 옵션 1: Handler를 비워두기 (기본값 사용)

1. **"구성"** 탭 → **"런타임 설정"** 클릭
2. **"편집"** 클릭
3. **Handler** 필드를 **비워두기** (빈 값)
4. **"저장"** 클릭

### 옵션 2: Handler 명시적으로 설정

1. **"구성"** 탭 → **"런타임 설정"** 클릭
2. **"편집"** 클릭
3. **Handler**: `index.handler` 입력
4. **"저장"** 클릭

## 확인 방법

### Dockerfile 확인
현재 Dockerfile의 CMD는 올바릅니다:
```dockerfile
CMD ["index.handler"]
```

### index.js 확인
핸들러가 올바르게 export되어 있는지 확인:
```javascript
exports.handler = async (event) => {
  // ...
};
```

## 다음 단계

1. **"구성"** 탭 → **"런타임 설정"** 클릭
2. Handler 필드 확인 및 수정
3. **"저장"** 클릭
4. 테스트 실행

## 참고

- Container Image를 사용할 때는 Handler가 이미지 설정에서 관리됩니다
- `Runtime.InvalidEntrypoint` 에러는 보통 Handler 설정 문제입니다
- Handler를 비워두면 Dockerfile의 `CMD`가 자동으로 사용됩니다
