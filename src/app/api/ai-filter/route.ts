/**
 * AI 필터링 API 엔드포인트
 * 크롤링된 페이지 중 비즈니스 분석에 필요한 핵심 페이지를 AI가 자동으로 선별
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { getErrorInfo, ErrorCode } from '@/constants/errorMessages';
import type { AIFilterResponse } from '@/types/api';

// Vercel Hobby 플랜: 최대 10초 타임아웃
export const maxDuration = 10;

// Request Schema
const AIFilterRequestSchema = z.object({
  pages: z.array(z.object({
    url: z.string(),
    title: z.string(),
    content: z.string(),
    pageType: z.string().optional(),
    importance: z.number().optional(),
  })),
});

// OpenAI 클라이언트
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 하드 제외 패턴 (9가지 - 100% 확실한 것만)
// 원칙: 콘텐츠 가치가 있을 수 있는 페이지는 AI가 판단하도록 허용
const HARD_EXCLUDE_PATTERNS = [
  /\/(login|signin|register|logout|auth)/i,           // 1. 인증
  /\/(privacy|terms|cookie-policy|legal)/i,           // 2. 법적 문서
  /\/(404|error|500|maintenance)/i,                   // 3. 에러 페이지
  /\/(search|\?.*page=|\?.*filter=|\?.*sort=)/i,      // 4. 검색/필터
  /\/(tag|category|archive)\//i,                      // 5. 태그/카테고리
  /\/(admin|dashboard|wp-admin|manage|console)/i,     // 6. 관리자
  /\/(cart|checkout|payment|wishlist|order)/i,        // 7. 전자상거래
  /\/(feed|rss|api|sitemap\.xml|robots\.txt)/i,       // 8. RSS/API
  /\.(pdf|zip|doc|docx|jpg|jpeg|png|gif|mp4|mp3)$/i,  // 9. 파일
  // 제거됨: 언어 패턴 (/ko/, /en/ 등) - 메인 페이지를 제외할 수 있어서 AI가 콘텐츠로 판단하도록 함
  // 주의: event, promo, apply, trial, career, blog 등은 콘텐츠 가치가 있을 수 있어서 AI가 판단
];

// 제목 키워드 제외 패턴 (명확한 것만)
const TITLE_EXCLUDE_KEYWORDS = [
  /^(로그인|sign\s*in|log\s*in|login)$/i,              // 로그인 (완전 일치)
  /^(회원가입|sign\s*up|register|join\s*us)$/i,        // 회원가입 (완전 일치)
  /고객센터|customer\s*center|customer\s*service|help\s*center|support\s*center/i,  // 고객센터
  /개인정보.*처리방침|privacy\s*policy/i,               // 개인정보처리방침
  /이용약관|terms.*service|terms.*use/i,                // 이용약관
  /404|not\s*found|page.*not.*found/i,                 // 404 페이지
];

// 콘텐츠 키워드 제외 (짧은 페이지 + 키워드 조합)
function shouldExcludeByContent(title: string, content: string): boolean {
  const contentLower = content.toLowerCase();
  const titleLower = title.toLowerCase();

  // 콘텐츠가 매우 짧고 (<300자) 명확한 키워드가 있으면 제외
  if (content.length < 300) {
    const shortPageKeywords = [
      /아이디.*비밀번호/i,                    // 로그인 폼
      /이메일.*비밀번호.*로그인/i,            // 로그인 폼
      /email.*password.*login/i,             // 로그인 폼 (영문)
      /username.*password.*sign\s*in/i,      // 로그인 폼 (영문)
    ];

    if (shortPageKeywords.some(pattern => pattern.test(content))) {
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 검증
    const body = await request.json();
    const { pages } = AIFilterRequestSchema.parse(body);

    console.log(`[AI Filter] ${pages.length}개 페이지 AI 필터링 시작`);

    // 2. 하드 제외 패턴 사전 필터링 (3단계: URL → 제목 → 콘텐츠)
    const eligiblePages = pages.filter(page => {
      // 2-1. URL 패턴 체크
      if (HARD_EXCLUDE_PATTERNS.some(pattern => pattern.test(page.url))) {
        console.log(`[AI Filter] URL 제외: ${page.url}`);
        return false;
      }

      // 2-2. 제목 키워드 체크
      if (TITLE_EXCLUDE_KEYWORDS.some(pattern => pattern.test(page.title))) {
        console.log(`[AI Filter] 제목 제외: ${page.title} (${page.url})`);
        return false;
      }

      // 2-3. 콘텐츠 키워드 체크
      if (shouldExcludeByContent(page.title, page.content)) {
        console.log(`[AI Filter] 콘텐츠 제외: ${page.title} (짧은 페이지 + 키워드)`);
        return false;
      }

      return true;
    });

    console.log(`[AI Filter] 사전 필터링 후: ${eligiblePages.length}개 페이지 (${pages.length - eligiblePages.length}개 제외됨)`);

    // 3. 페이지가 15개 이하면 AI 호출 없이 모두 반환
    if (eligiblePages.length <= 15) {
      const response: AIFilterResponse = {
        success: true,
        data: {
          selectedUrls: eligiblePages.map(p => p.url),
          reasoning: '페이지 수가 15개 이하로 모든 페이지를 선택했습니다.',
          processedCount: eligiblePages.length,
        },
      };
      return NextResponse.json(response);
    }

    // 4. AI 프롬프트 생성 (Few-shot Learning 적용)
    const systemMessage = `당신은 VC/PE 투자자, B2B 영업팀, 컨설팅 업계를 위한 웹사이트 분석 전문가입니다.
기업 실사(Due Diligence), 비즈니스 분석, 경쟁사 조사를 위해 가장 중요한 페이지를 선별하는 것이 목표입니다.

**핵심 원칙: 실제 콘텐츠 내용으로만 판단하세요**
URL이나 페이지 타입은 무시하고, 각 페이지의 실제 텍스트 내용을 읽고 평가하세요.

**최우선 정보 유형 (이런 내용이 있으면 필수 선택):**
⚠️⚠️⚠️ 최우선 원칙 (절대 잊지 마세요) ⚠️⚠️⚠️

**URL, 제목, 키워드는 절대 판단 기준이 아닙니다!**

다음과 같은 키워드가 URL이나 제목에 있어도 완전히 무시하세요:
- "채용", "career", "recruit", "jobs"
- "이벤트", "event", "프로모션", "promotion", "할인", "discount"
- "상담", "문의", "contact", "consultation", "apply", "신청"
- "블로그", "blog", "뉴스", "news", "공지", "notice"
- 그 외 어떤 키워드든 무시

**오직 페이지의 실제 콘텐츠 내용만 보고 판단하세요!**

평가 질문 (이것만 보세요):
1. 이 페이지에 회사/제품/서비스에 대한 구체적 정보가 있는가?
2. 이 정보가 비즈니스 분석에 도움이 되는가?
- YES → 선택
- NO → 제외

URL이 /career여도 회사 소개가 있으면 선택
URL이 /about여도 연락처만 있으면 제외
URL이 /event여도 제품 설명이 있으면 선택
URL이 /blog여도 비즈니스 전략 설명이 있으면 선택

---

다음 정보를 담은 페이지를 찾으면 반드시 선택하세요:
1. 회사 전반 소개 - 비전, 미션, 핵심 가치 제안, 사업 개요
2. 회사 배경 정보 - 팀 구성, 창립자, 투자 이력, 연혁
3. 제품/서비스 상세 - 주요 기능, 사용 방법, 기술 스택, 차별화 요소
4. 가격 정책 - 수익 모델, 플랜 구조, 가격대
5. 고객 증명 - 고객 사례, 성공 스토리, 추천사, 실적 데이터

**추가 가치 정보 (있으면 선택):**
- 제품 로드맵, 업데이트 계획
- 투자 유치, 파트너십 체결
- 시장 분석, 산업 트렌드, 비즈니스 전략
- 기술 아키텍처, 보안 정책

**반드시 제외 (콘텐츠 내용 기준):**

다음 조건을 **모두** 만족하는 페이지만 제외하세요:

1. **일시적 마케팅 이벤트**: 콘텐츠가 "기간 한정 할인", "경품 응모", "이벤트 참여" 같은 일회성 프로모션만 다룸
   - ⚠️ 단, 제품 설명이 함께 있으면 → 선택!

2. **빈 신청 폼**: 콘텐츠가 입력 폼(이름, 이메일, 전화번호)만 있고 제품/서비스 설명이 전혀 없음
   - ⚠️ 단, 제품 기능/특징 설명이 함께 있으면 → 선택!

3. **개별 직무 채용 공고**: 콘텐츠가 "자격요건, 우대사항, 복지" 같은 직무 조건만 나열
   - ⚠️ 단, 회사 소개/비전/문화/팀 구성이 함께 있으면 → 선택!

4. **내용 없는 목록 페이지**: 콘텐츠가 링크 리스트만 있고 실제 내용이 전혀 없음
   - ⚠️ 단, 각 항목에 요약 설명이 있으면 → 선택!

5. **인증/법적 페이지**: 콘텐츠가 로그인 폼, 약관, 개인정보처리방침 조문만 나열
   - 예외 없음 → 무조건 제외

**핵심 원칙 재확인:**
- URL이 /event, /career, /blog, /contact 등 어디든 상관없음
- 제목에 "이벤트", "채용", "상담" 등 키워드가 있어도 상관없음
- **오직 콘텐츠에 비즈니스 정보가 있는지만 확인**하세요

---

# 구체적인 예시 (Few-shot Learning)

## ✅ 반드시 선택해야 할 페이지들:

**예시 1: 제품 소개 + CTA**
제목: "에스티씨랩 | 가상대기실 솔루션 트래픽 폭주 관리 상담받기"
콘텐츠: "가상대기실 솔루션은 트래픽 폭주 시 사용자를 순차적으로 입장시켜 서버 다운을 방지합니다. 주요 기능: 1) 실시간 트래픽 모니터링 2) 자동 대기열 생성 3) 공정한 FIFO 알고리즘 4) 커스텀 대기 화면 5) API 연동 지원. 기술 스택: AWS CloudFront + Lambda@Edge. 고객사: 삼성, LG, 현대자동차 티켓팅 시스템 적용..."
→ **선택 이유**: 제목에 "상담받기"가 있지만, 제품의 기능 5가지, 기술 스택, 고객 사례가 포함되어 비즈니스 분석 가치가 높음

**예시 2: 가격 정책**
제목: "Pricing | 요금제 안내"
콘텐츠: "3가지 플랜 제공: Starter ($99/월) - 월 100만 요청, Basic ($299/월) - 월 500만 요청, Enterprise (맞춤 견적) - 무제한 요청. 모든 플랜에 24/7 고객 지원, API 무제한 호출 포함. 연간 결제 시 20% 할인..."
→ **선택 이유**: 수익 모델과 가격 구조가 명확히 드러나 투자 분석에 필수

**예시 3: 회사 소개**
제목: "About Us | 우리의 미션"
콘텐츠: "2018년 설립된 에스티씨랩은 대규모 트래픽 처리 전문 기업입니다. 팀: CEO 김철수(전 네이버 개발자 10년), CTO 이영희(AWS 공인 아키텍트). 투자: 2021년 시리즈 A 50억 유치(카카오벤처스). 비전: 모든 기업이 트래픽 걱정 없는 세상..."
→ **선택 이유**: 팀 배경, 투자 이력, 비전이 포함되어 실사(Due Diligence)에 필수

## ❌ 반드시 제외해야 할 페이지들:

**예시 4: 단순 프로모션**
제목: "무상 이벤트 신청하기 | 6월 한정"
콘텐츠: "6월 한 달간 신규 가입 고객에게 첫 달 무료! 지금 바로 신청하세요. 이벤트 기간: 2024.06.01 - 06.30. 이름, 이메일, 전화번호 입력 후 제출."
→ **제외 이유**: 한시적 프로모션으로 비즈니스 본질 파악에 도움 안 됨

**예시 5: 단순 신청 폼**
제목: "무료 상담 신청"
콘텐츠: "전문가와 1:1 상담을 원하시나요? 아래 정보를 입력하세요. [이름] [이메일] [전화번호] [회사명] [문의사항]"
→ **제외 이유**: 제품/서비스 설명 없이 폼만 있어 정보 가치 없음

**예시 6: 채용 공고**
제목: "Join Us | 채용 안내"
콘텐츠: "백엔드 개발자 모집. 자격요건: Node.js 3년 이상, AWS 경험자 우대. 지원 방법: careers@example.com으로 이력서 발송"
→ **제외 이유**: 채용 정보는 비즈니스 모델 분석과 무관

## ⚖️ 경계선 케이스 판단 기준:

**케이스 1: 70% 제품 설명 + 30% CTA**
→ **선택**: 비즈니스 정보가 충분하면 CTA는 무시

**케이스 2: 30% 간단한 소개 + 70% 신청 폼**
→ **제외**: 실질적 정보가 부족하면 제외

**핵심 기준**: 콘텐츠의 **정보 밀도**가 기준입니다. "이 페이지를 읽고 VC가 투자 결정에 도움이 되는가?"`;


    const userPrompt = `다음은 웹사이트에서 크롤링한 ${eligiblePages.length}개의 페이지 목록입니다.
각 페이지의 실제 콘텐츠를 분석하여 비즈니스 분석에 필요한 페이지만 선택해주세요.
(중요한 페이지가 5개뿐이면 5개만, 20개가 필요하면 20개 모두 선택하세요)

# 페이지 리스트:
${eligiblePages.map((page, index) => `
━━━ 페이지 ${index + 1} ━━━
URL: ${page.url}
제목: ${page.title}
타입: ${page.pageType || 'General'}
중요도 점수: ${page.importance || 'N/A'}/100

실제 콘텐츠:
${page.content}
━━━━━━━━━━━━━━
`).join('\n')}

# 분석 목적:
- VC/PE 투자자: 비즈니스 모델, 성장 가능성, 팀 역량, 시장 기회 파악
- B2B 영업팀: 제품 가치 제안, 가격 정책, 고객 성공 사례, 차별화 포인트
- 컨설턴트: 경쟁사 대비 강점, 시장 포지셔닝, 전략적 방향성

# 선택 기준:

**⚠️ 최우선 원칙 (절대 잊지 마세요):**
**URL, 제목, 키워드는 완전히 무시하고 콘텐츠 내용만 보세요!**

평가 방법:
1. 페이지 콘텐츠를 읽고 "회사/제품/가격/고객" 정보가 있는지 확인
2. 비즈니스 분석에 도움이 되는가?
3. YES → 선택, NO → 제외

구체적 기준:
- **정보 유형별 균형**: 5가지 정보(회사 소개, 배경, 제품, 가격, 고객)를 커버하도록 선택
- **콘텐츠 가치**: URL이 /career, /event, /blog, /contact 등 어디든 상관없이, 비즈니스 정보가 있으면 선택
- **중복 제거**: 같은 정보는 가장 상세한 1개만
- **유연한 선택**: 비즈니스 분석에 필요한 만큼만 (최소 5개 ~ 최대 제한 없음)

예시:
- URL이 /career여도 회사 소개/비전/문화가 있으면 → 선택
- URL이 /blog여도 제품 상세 설명이 있으면 → 선택
- URL이 /event여도 제품 기능 설명이 있으면 → 선택
- URL이 /about여도 연락처만 있으면 → 제외
- 제목에 "채용", "상담", "신청"이 있어도 콘텐츠 내용으로만 판단

**개수보다 질이 중요합니다. 콘텐츠 내용만 보세요.**

# 응답 형식 (JSON):
{
  "selectedUrls": [
    "https://example.com/",
    "https://example.com/about",
    "https://example.com/pricing",
    "https://example.com/products"
  ],
  "reasoning": "5가지 정보 유형 모두 커버: (1) 회사 소개 - 비전과 핵심 가치(Homepage), (2) 회사 배경 - 팀 구성 및 투자 이력(About), (3) 제품 상세 - 5가지 핵심 기능과 기술 스택(Products 페이지 2개), (4) 가격 정책 - 3개 플랜 구조(Pricing), (5) 고객 증명 - Fortune 500 사례 3개(Case Studies). 추가로 제품 로드맵을 다룬 블로그 1개 포함. 총 12페이지."
}

**중요**: 반드시 JSON 형식으로만 응답하고, reasoning에서 5가지 정보 유형별로 어떤 내용을 담은 페이지인지 설명하세요.`;

    // 5. OpenAI API 호출 (Few-shot Learning 적용)
    console.log('[AI Filter] OpenAI API 호출 중 (Few-shot + 긴 콘텐츠)...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // 0.2 → 0.1로 낮춰서 일관성 강화
      max_tokens: 2000, // 1500 → 2000으로 증가 (더 상세한 reasoning)
      response_format: { type: 'json_object' }, // JSON 모드 강제
    });

    // 6. 응답 파싱
    const responseText = completion.choices[0].message.content || '{}';
    const parsed = JSON.parse(responseText);

    // 7. 유효성 검증
    if (!parsed.selectedUrls || !Array.isArray(parsed.selectedUrls)) {
      throw new Error('Invalid AI response format: selectedUrls is missing or not an array');
    }

    console.log(`[AI Filter] AI 선택 완료: ${parsed.selectedUrls.length}개 페이지`);
    console.log(`[AI Filter] 선택 이유: ${parsed.reasoning}`);

    const response: AIFilterResponse = {
      success: true,
      data: {
        selectedUrls: parsed.selectedUrls,
        reasoning: parsed.reasoning || '',
        processedCount: eligiblePages.length,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[AI Filter] 에러:', error);

    // Zod 검증 에러
    if (error instanceof z.ZodError) {
      const errorInfo = getErrorInfo(
        ErrorCode.INVALID_PAGE_COUNT,
        '요청 데이터가 유효하지 않습니다'
      );
      return NextResponse.json(
        { success: false, error: errorInfo, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // OpenAI API 에러
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isRateLimit = errorMessage.toLowerCase().includes('rate') ||
                        errorMessage.toLowerCase().includes('quota');

    const errorCode = isRateLimit
      ? ErrorCode.AI_RATE_LIMIT
      : ErrorCode.AI_SERVICE_UNAVAILABLE;

    const errorInfo = getErrorInfo(errorCode, errorMessage);

    return NextResponse.json(
      { success: false, error: errorInfo, timestamp: new Date().toISOString() },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
