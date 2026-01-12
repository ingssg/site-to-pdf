# AWS Lambda Node.js 20 베이스 이미지 사용
FROM public.ecr.aws/lambda/nodejs:20

# @sparticuz/chromium 실행에 필요한 시스템 라이브러리 설치
# Amazon Linux 2023는 dnf를 사용합니다
RUN dnf install -y \
  nss \
  atk \
  at-spi2-atk \
  cups-libs \
  gtk3 \
  libdrm \
  libxkbcommon \
  libXcomposite \
  libXdamage \
  libXrandr \
  mesa-libgbm \
  alsa-lib \
  libXtst \
  libXScrnSaver \
  pango \
  cairo \
  && dnf clean all

WORKDIR ${LAMBDA_TASK_ROOT}

# 의존성 파일 복사
COPY package*.json ./

# 의존성 설치
# @sparticuz/chromium이 Lambda용 Chromium 바이너리를 포함하므로 별도 설치 불필요
RUN npm ci --only=production

# Lambda 핸들러 코드 복사
COPY index.js crawler.js ai.js pdf.js ./

# CMD 제거 - AWS Lambda Node.js 베이스 이미지가 자동으로 index.handler를 찾습니다
# Lambda 콘솔에서 CMD 재정의를 명시적으로 설정하거나 비워두면 됩니다

CMD ["index.handler"]
