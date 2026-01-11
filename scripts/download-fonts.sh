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

# 여러 소스에서 다운로드 시도 (안정성 향상)
DOWNLOAD_SUCCESS=false

# 방법 1: jsDelivr CDN (가장 안정적)
echo "jsDelivr CDN에서 다운로드 시도 중..."
JSDELIVR_URL="https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf"
if curl -L -f -s "$JSDELIVR_URL" -o "$FONT_DIR/NotoSansKR.ttf" 2>/dev/null; then
  if [ -f "$FONT_DIR/NotoSansKR.ttf" ] && [ -s "$FONT_DIR/NotoSansKR.ttf" ]; then
    echo "✓ jsDelivr에서 폰트 다운로드 완료!"
    DOWNLOAD_SUCCESS=true
  fi
fi

# 방법 2: GitHub Raw (fallback)
if [ "$DOWNLOAD_SUCCESS" = false ]; then
  echo "GitHub Raw에서 다운로드 시도 중..."
  GITHUB_RAW_URL="https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf"
  if curl -L -f -s "$GITHUB_RAW_URL" -o "$FONT_DIR/NotoSansKR.ttf" 2>/dev/null; then
    if [ -f "$FONT_DIR/NotoSansKR.ttf" ] && [ -s "$FONT_DIR/NotoSansKR.ttf" ]; then
      echo "✓ GitHub Raw에서 폰트 다운로드 완료!"
      DOWNLOAD_SUCCESS=true
    fi
  fi
fi

# 방법 3: Google Fonts API (마지막 시도)
if [ "$DOWNLOAD_SUCCESS" = false ]; then
  echo "Google Fonts API에서 다운로드 시도 중..."
  TEMP_ZIP="/tmp/noto-sans-kr-fonts.zip"
  if curl -L -f -s "https://fonts.google.com/download?family=Noto%20Sans%20KR" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    -o "$TEMP_ZIP" 2>/dev/null; then
    if [ -f "$TEMP_ZIP" ] && ! file "$TEMP_ZIP" 2>/dev/null | grep -q "HTML"; then
      if unzip -j "$TEMP_ZIP" "*.ttf" -d "$FONT_DIR/" 2>/dev/null; then
        if [ -f "$FONT_DIR/NotoSansKR-Regular.ttf" ] || [ -f "$FONT_DIR/NotoSansKR.ttf" ]; then
          echo "✓ Google Fonts에서 폰트 다운로드 완료!"
          DOWNLOAD_SUCCESS=true
        fi
      fi
      rm -f "$TEMP_ZIP"
    fi
  fi
fi

# 최종 확인
if [ "$DOWNLOAD_SUCCESS" = true ]; then
  echo "✓ 폰트 다운로드 성공!"
  ls -lh "$FONT_DIR"/*.{ttf,otf} 2>/dev/null | awk '{print "  - " $9}'
  exit 0
else
  echo "⚠️  모든 다운로드 소스 실패. 폰트 없이 빌드를 계속합니다."
  echo "   PDF에서 한글이 제대로 표시되지 않을 수 있습니다."
  echo ""
  echo "📝 수동으로 폰트 파일 추가 방법:"
  echo "   1. https://fonts.google.com/noto/specimen/Noto+Sans+KR 접속"
  echo "   2. 우측 상단 'Download family' 버튼 클릭"
  echo "   3. 다운로드한 ZIP 파일을 압축 해제"
  echo "   4. 다음 파일 중 하나를 $FONT_DIR/ 에 복사:"
  echo "      - NotoSansKR.ttf"
  echo "      - NotoSansKR-Regular.ttf"
  echo "      - NotoSansCJKkr-Regular.otf (선택사항)"
  exit 0
fi


