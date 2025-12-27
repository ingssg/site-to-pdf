# 🚀 SiteToPDF

> 웹사이트 → PDF 아카이빙 & AI 요약 서비스

웹사이트 전체를 재귀적으로 크롤링하여 깔끔하게 정리된 PDF 문서로 변환하고, LLM을 활용해 회사/서비스 요약을 제공하는 SaaS 서비스입니다.

## 📋 주요 기능

- ✅ **웹사이트 전체 크롤링**: Playwright를 사용한 재귀적 크롤링
- ✅ **PDF 변환**: 각 페이지를 고품질 PDF로 변환
- ✅ **PDF 병합**: 전체 사이트를 하나의 PDF로 병합 (목차 포함)
- ✅ **AI 요약**: OpenAI GPT-4를 사용한 비즈니스 인사이트 생성
- ✅ **다운로드**: 전체 PDF 또는 개별 PDF ZIP 다운로드

## 🛠️ 기술 스택

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **크롤링/PDF**: Playwright, pdf-lib
- **AI**: OpenAI GPT-4o-mini
- **Database**: Supabase (PostgreSQL)
- **배포**: Vercel + AWS Lambda

## 📁 프로젝트 구조

```
src/
├── app/                 # Next.js App Router
├── components/          # React 컴포넌트
│   ├── ui/             # shadcn/ui 컴포넌트
│   └── features/       # 기능별 컴포넌트
├── lib/                # 핵심 로직
│   ├── crawler/        # 웹 크롤링
│   ├── pdf/            # PDF 생성
│   ├── ai/             # AI 요약
│   └── db/             # Supabase 클라이언트
├── types/              # TypeScript 타입
└── utils/              # 헬퍼 함수
```

## 🔤 한글 폰트 설정

PDF에서 한글을 표시하려면 NotoSansKR 폰트 파일이 필요합니다.

### 자동 다운로드 (시도)
```bash
npm run download-fonts
```

### 수동 다운로드
1. [Google Fonts - Noto Sans KR](https://fonts.google.com/noto/specimen/Noto+Sans+KR) 접속
2. 우측 상단 **"Download family"** 버튼 클릭
3. 다운로드한 ZIP 파일 압축 해제
4. 다음 파일들을 `public/fonts/` 디렉토리에 복사:
   - `NotoSansKR-Regular.ttf`
   - `NotoSansKR-Bold.ttf`

폰트 파일이 없으면 표준 폰트(Helvetica)로 대체되며, 한글은 제대로 표시되지 않을 수 있습니다.

## 📖 사용 예시

```typescript
import { crawlWebsite } from '@/lib/crawler';
import { generatePDFFromPages } from '@/lib/pdf';
import { generateAISummary } from '@/lib/ai';

// 1. 웹사이트 크롤링
const result = await crawlWebsite({
  url: 'https://example.com',
  maxPages: 50,
  sameDomainOnly: true,
});

// 2. PDF 생성
const pdf = await generatePDFFromPages(result.pages);

// 3. AI 요약 생성
const summary = await generateAISummary(result.pages, 'detailed');
```

## 📄 라이선스

MIT License
