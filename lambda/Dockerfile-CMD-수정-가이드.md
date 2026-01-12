# Dockerfile CMD 수정 가이드

## 문제 발견
Dockerfile의 `CMD ["index.handler"]`가 주석 처리되어 있었습니다!

## 수정 내용
```dockerfile
# 수정 전
# CMD ["index.handler"]

# 수정 후
CMD ["index.handler"]
```

## 다음 단계

### 1. Docker 이미지 재빌드 및 푸시
```bash
cd lambda
./build-and-push.sh
```

### 2. Lambda 함수에 새 이미지 배포
1. Lambda 콘솔 → `site-to-pdf-worker2` 함수 선택
2. **"이미지"** 탭 클릭
3. **"새 이미지 배포"** 버튼 클릭
4. 최신 이미지 태그 선택 (`latest`)
5. **"저장"** 클릭

### 3. 이미지 구성 확인
1. **"이미지 구성"** 섹션 확인
2. **"CMD 재정의"** 필드:
   - **비워두기** (`-`) 권장
   - 또는 `index.handler` 입력

### 4. 테스트
1. **"테스트"** 탭 클릭
2. **동기식**으로 테스트 실행
3. CloudWatch Logs에서 에러 확인

## 예상 결과

### 성공 시
- `Runtime.InvalidEntrypoint` 에러가 사라짐
- `[Lambda] 워커 시작` 로그가 출력됨
- 함수가 정상적으로 실행됨

### 여전히 실패하는 경우
- CloudWatch Logs에서 새로운 에러 메시지 확인
- Lambda 콘솔의 CMD 재정의 설정 확인

## 참고

### AWS Lambda Node.js 베이스 이미지
- `public.ecr.aws/lambda/nodejs:20` 베이스 이미지는 자동으로 `index.handler`를 찾습니다
- 하지만 CMD를 명시적으로 설정하는 것이 더 안전합니다
- CMD 형식: `CMD ["index.handler"]` (배열 형식)

### Lambda 콘솔 CMD 재정의
- CMD 재정의를 비워두면 Dockerfile의 CMD가 사용됩니다
- CMD 재정의를 설정하면 Dockerfile의 CMD를 덮어씁니다
