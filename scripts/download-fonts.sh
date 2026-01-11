#!/bin/bash
# NotoSansKR 폰트 다운로드 스크립트

FONT_DIR="public/fonts"
mkdir -p "$FONT_DIR"

echo "NotoSansKR 폰트 확인 중..."

# 이미 폰트 파일이 있는지 확인
if [ -f "$FONT_DIR/NotoSansKR.ttf" ] || [ -f "$FONT_DIR/NotoSansKR-Regular.ttf" ] || [ -f "$FONT_DIR/NotoSansCJKkr-Regular.otf" ]; then
  echo "✓ 폰트 파일이 이미 존재합니다. 다운로드를 건너뜁니다."
  exit 0
fi

echo "폰트 파일이 없습니다. 다운로드를 시도합니다..."

# Google Fonts에서 직접 다운로드 (ZIP 파일)
TEMP_ZIP="/tmp/noto-sans-kr-fonts.zip"

# 방법 1: Google Fonts API를 통한 다운로드 시도
echo "Google Fonts에서 다운로드 시도 중..."
curl -L "https://fonts.google.com/download?family=Noto%20Sans%20KR" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o "$TEMP_ZIP" 2>/dev/null || {
  echo "⚠️  자동 다운로드 실패. 폰트 없이 빌드를 계속합니다."
  echo "   PDF에서 한글이 제대로 표시되지 않을 수 있습니다."
  echo ""
  echo "수동 다운로드 방법:"
  echo "1. https://fonts.google.com/noto/specimen/Noto+Sans+KR 접속"
  echo "2. 우측 상단 'Download family' 버튼 클릭"
  echo "3. 다운로드한 ZIP 파일을 압축 해제"
  echo "4. 다음 파일들을 $FONT_DIR/ 에 복사:"
  echo "   - NotoSansKR-Regular.ttf"
  echo "   - NotoSansKR-Bold.ttf"
  rm -f "$TEMP_ZIP"
  exit 0
}

# ZIP 파일 확인
if [ ! -f "$TEMP_ZIP" ] || file "$TEMP_ZIP" 2>/dev/null | grep -q "HTML"; then
  echo "⚠️  다운로드한 파일이 유효한 ZIP이 아닙니다. 폰트 없이 빌드를 계속합니다."
  rm -f "$TEMP_ZIP"
  exit 0
fi

# ZIP 파일 압축 해제
echo "폰트 파일 추출 중..."
unzip -j "$TEMP_ZIP" "*.ttf" -d "$FONT_DIR/" 2>/dev/null || {
  echo "⚠️  ZIP 파일에서 TTF 추출 실패. 폰트 없이 빌드를 계속합니다."
  rm -f "$TEMP_ZIP"
  exit 0
}

# 필요한 파일 확인
if [ -f "$FONT_DIR/NotoSansKR-Regular.ttf" ] && [ -f "$FONT_DIR/NotoSansKR-Bold.ttf" ]; then
  echo "✓ 폰트 다운로드 완료!"
  echo "  - $FONT_DIR/NotoSansKR-Regular.ttf"
  echo "  - $FONT_DIR/NotoSansKR-Bold.ttf"
  rm -f "$TEMP_ZIP"
else
  echo "⚠️  필요한 폰트 파일을 찾을 수 없습니다. 폰트 없이 빌드를 계속합니다."
  rm -f "$TEMP_ZIP"
  exit 0
fi


