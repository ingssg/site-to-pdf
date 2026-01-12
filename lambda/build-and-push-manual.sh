#!/bin/bash
# Lambda Container Image 수동 빌드 및 푸시 스크립트
# AWS CLI 없이 Docker만 사용하는 경우

set -e

echo "⚠️  이 스크립트는 AWS CLI 없이 Docker만 사용합니다."
echo "ECR 리포지토리 이름과 AWS 계정 ID를 직접 입력해야 합니다."
echo ""

# 설정 (사용자가 수정 필요)
read -p "AWS 계정 ID를 입력하세요: " AWS_ACCOUNT_ID
read -p "AWS 리전을 입력하세요 (기본값: ap-northeast-2): " AWS_REGION
AWS_REGION=${AWS_REGION:-ap-northeast-2}
read -p "ECR 리포지토리 이름을 입력하세요 (기본값: site-to-pdf-lambda-worker): " ECR_REPOSITORY
ECR_REPOSITORY=${ECR_REPOSITORY:-site-to-pdf-lambda-worker}
IMAGE_TAG="latest"

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"

echo ""
echo "=== 설정 확인 ==="
echo "AWS 계정 ID: ${AWS_ACCOUNT_ID}"
echo "리전: ${AWS_REGION}"
echo "ECR 리포지토리: ${ECR_REPOSITORY}"
echo "이미지 URI: ${ECR_URI}"
echo ""

read -p "계속하시겠습니까? (y/n): " confirm
if [ "$confirm" != "y" ]; then
  echo "취소되었습니다."
  exit 0
fi

echo ""
echo "=== 1. Docker 이미지 빌드 ==="
docker build -t ${ECR_REPOSITORY}:${IMAGE_TAG} .

echo ""
echo "=== 2. 이미지 태그 ==="
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}

echo ""
echo "=== 3. ECR 로그인 ==="
echo "다음 명령어를 실행하여 ECR에 로그인하세요:"
echo "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}"
echo ""
read -p "ECR 로그인을 완료하셨나요? (y/n): " login_confirm

if [ "$login_confirm" != "y" ]; then
  echo "ECR 로그인 후 다음 명령어를 실행하세요:"
  echo "docker push ${ECR_URI}:${IMAGE_TAG}"
  exit 0
fi

echo ""
echo "=== 4. ECR에 이미지 푸시 ==="
docker push ${ECR_URI}:${IMAGE_TAG}

echo ""
echo "✅ 이미지 푸시 완료!"
echo "Lambda 함수에서 다음 이미지 URI를 사용하세요:"
echo "${ECR_URI}:${IMAGE_TAG}"
