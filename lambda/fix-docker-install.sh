#!/bin/bash
# Docker 설치 문제 해결 스크립트

echo "=== Docker 설치 문제 해결 ==="
echo ""

# 1. 남아있는 hub-tool 링크 제거
if [ -L /usr/local/bin/hub-tool ]; then
  echo "1. hub-tool 심볼릭 링크 제거 중..."
  sudo rm /usr/local/bin/hub-tool
  echo "   ✅ 제거 완료"
else
  echo "1. hub-tool 링크가 없습니다."
fi

# 2. Docker Desktop 재설치
echo ""
echo "2. Docker Desktop 재설치 중..."
echo "   다음 명령어를 실행하세요:"
echo "   brew install --cask docker"
echo ""
echo "   또는 Docker Desktop을 직접 다운로드:"
echo "   https://www.docker.com/products/docker-desktop/"
