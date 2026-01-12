# AWS CLI 설치 가이드 (macOS)

## Homebrew를 사용한 설치 (가장 간단)

```bash
brew install awscli
```

## 설치 확인

```bash
aws --version
```

## AWS 자격 증명 설정

```bash
aws configure
```

다음 정보를 입력:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `ap-northeast-2`
- Default output format: `json`

## 설치 후

```bash
cd lambda
chmod +x build-and-push.sh
./build-and-push.sh
```
