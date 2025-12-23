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

## 🚦 시작하기

### 1. 설치

```bash
npm install
npx playwright install chromium
```

### 2. 환경 변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 파일을 열어 필요한 API 키를 입력하세요:

- `OPENAI_API_KEY`: [OpenAI API](https://platform.openai.com/api-keys)에서 발급
- (선택) Supabase 키: [Supabase](https://app.supabase.com/)에서 프로젝트 생성

### 3. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인하세요.

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

## 🎯 MVP 로드맵 (4주)

- [x] **Week 1**: 환경 셋업 + 크롤러 기초
- [ ] **Week 2**: 재귀 크롤링 + PDF 병합
- [ ] **Week 3**: 프론트엔드 UI + LLM 연동
- [ ] **Week 4**: 배포 + 런칭 준비

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

## 📚 참고 문서

- [프로젝트 기획서](./docs/SiteToPDF_프로젝트_기획서.docx.pdf)
- [Playwright 문서](https://playwright.dev/docs/intro)
- [Next.js 문서](https://nextjs.org/docs)
- [OpenAI API 문서](https://platform.openai.com/docs)

## 👥 팀

- **담당**: 인석
- **감수**: 보석

## 📄 라이선스

MIT License
