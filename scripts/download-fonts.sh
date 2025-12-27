#!/bin/bash
# NotoSansKR 폰트 다운로드 스크립트

set -e

FONT_DIR="public/fonts"
mkdir -p "$FONT_DIR"

echo "NotoSansKR 폰트 다운로드 중..."

# Google Fonts에서 직접 다운로드 (ZIP 파일)
TEMP_ZIP="/tmp/noto-sans-kr-fonts.zip"

# 방법 1: Google Fonts API를 통한 다운로드 시도
echo "Google Fonts에서 다운로드 시도 중..."
curl -L "https://fonts.google.com/download?family=Noto%20Sans%20KR" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o "$TEMP_ZIP" || {
  echo "자동 다운로드 실패. 수동 다운로드가 필요합니다."
  echo ""
  echo "수동 다운로드 방법:"
  echo "1. https://fonts.google.com/noto/specimen/Noto+Sans+KR 접속"
  echo "2. 우측 상단 'Download family' 버튼 클릭"
  echo "3. 다운로드한 ZIP 파일을 압축 해제"
  echo "4. 다음 파일들을 $FONT_DIR/ 에 복사:"
  echo "   - NotoSansKR-Regular.ttf"
  echo "   - NotoSansKR-Bold.ttf"
  exit 1
}

# ZIP 파일 확인
if [ ! -f "$TEMP_ZIP" ] || file "$TEMP_ZIP" | grep -q "HTML"; then
  echo "다운로드한 파일이 유효한 ZIP이 아닙니다."
  echo "수동 다운로드를 진행해주세요."
  rm -f "$TEMP_ZIP"
  exit 1
fi

# ZIP 파일 압축 해제
echo "폰트 파일 추출 중..."
unzip -j "$TEMP_ZIP" "*.ttf" -d "$FONT_DIR/" 2>/dev/null || {
  echo "ZIP 파일에서 TTF 추출 실패. 수동 다운로드가 필요합니다."
  rm -f "$TEMP_ZIP"
  exit 1
}

# 필요한 파일 확인
if [ -f "$FONT_DIR/NotoSansKR-Regular.ttf" ] && [ -f "$FONT_DIR/NotoSansKR-Bold.ttf" ]; then
  echo "✓ 폰트 다운로드 완료!"
  echo "  - $FONT_DIR/NotoSansKR-Regular.ttf"
  echo "  - $FONT_DIR/NotoSansKR-Bold.ttf"
  rm -f "$TEMP_ZIP"
else
  echo "필요한 폰트 파일을 찾을 수 없습니다."
  echo "수동 다운로드를 진행해주세요."
  rm -f "$TEMP_ZIP"
  exit 1
fi

