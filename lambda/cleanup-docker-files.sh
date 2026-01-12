#!/bin/bash
# Docker 관련 충돌 파일 정리 스크립트

echo "=== Docker 관련 충돌 파일 정리 ==="
echo ""
echo "다음 파일들을 제거해야 합니다:"
echo ""

# 확인할 파일 목록
FILES=(
  "/usr/local/bin/hub-tool"
  "/usr/local/bin/kubectl.docker"
  "/usr/local/cli-plugins/docker-compose"
)

for file in "${FILES[@]}"; do
  if [ -e "$file" ] || [ -L "$file" ]; then
    echo "  발견: $file"
    echo "  제거 명령어: sudo rm $file"
  fi
done

echo ""
echo "위 파일들을 제거한 후 다음 명령어로 Docker를 재설치하세요:"
echo "  brew install --cask docker"
echo ""
echo "또는 수동으로 제거:"
echo "  sudo rm /usr/local/bin/hub-tool"
echo "  sudo rm /usr/local/bin/kubectl.docker"
echo "  sudo rm -rf /usr/local/cli-plugins/docker-compose"
