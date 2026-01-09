/**
 * AI 필터링 API 엔드포인트
 * 크롤링된 페이지 중 비즈니스 분석에 중요한 10-15개를 AI가 자동으로 선별
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { getErrorInfo, ErrorCode } from '@/constants/errorMessages';
import type { AIFilterResponse } from '@/types/api';

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

// 하드 제외 패턴 (10가지)
const HARD_EXCLUDE_PATTERNS = [
  /\/(login|signin|register|logout|auth)/i,           // 1. 인증
  /\/(privacy|terms|cookie-policy|legal)/i,           // 2. 법적 문서
  /\/(404|error|500|maintenance)/i,                   // 3. 에러 페이지
  /\/(search|\?.*page=|\?.*filter=|\?.*sort=)/i,      // 4. 검색/필터
  /\/(tag|category|archive)\//i,                      // 5. 태그/카테고리
  /\/(en|ko|ja|zh|fr|de|es)\//i,                      // 6. 언어 중복
  /\/(admin|dashboard|wp-admin|manage|console)/i,     // 7. 관리자
  /\/(cart|checkout|payment|wishlist|order)/i,        // 8. 전자상거래
  /\/(feed|rss|api|sitemap\.xml|robots\.txt)/i,       // 9. RSS/API
  /\.(pdf|zip|doc|docx|jpg|jpeg|png|gif|mp4|mp3)$/i,  // 10. 파일
];

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 검증
    const body = await request.json();
    const { pages } = AIFilterRequestSchema.parse(body);

    console.log(`[AI Filter] ${pages.length}개 페이지 AI 필터링 시작`);

    // 2. 하드 제외 패턴 사전 필터링 (토큰 절약)
    const eligiblePages = pages.filter(page => {
      return !HARD_EXCLUDE_PATTERNS.some(pattern => pattern.test(page.url));
    });

    console.log(`[AI Filter] 사전 필터링 후: ${eligiblePages.length}개 페이지`);

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

    // 4. AI 프롬프트 생성
    const systemMessage = `당신은 VC/PE 투자자, B2B 영업팀, 컨설팅 업계를 위한 웹사이트 분석 전문가입니다.
기업 실사(Due Diligence), 비즈니스 분석, 경쟁사 조사를 위해 가장 중요한 페이지를 선별하는 것이 목표입니다.

**핵심 원칙: 실제 콘텐츠 내용으로만 판단하세요**
URL이나 페이지 타입은 무시하고, 각 페이지의 실제 텍스트 내용을 읽고 평가하세요.

**최우선 정보 유형 (이런 내용이 있으면 필수 선택):**
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

**반드시 제외:**
- 채용 공고, 단순 이벤트, 사무실 소식
- 내용 없는 보도자료 리스트 (제목만 나열)
- 로그인, 회원가입, 법적 문서

**평가 방법:**
- 각 페이지 콘텐츠를 읽고 어떤 정보를 담고 있는지 파악
- URL(/about, /blog 등)은 참고만 하고, 내용이 핵심
- 블로그든 뭐든 "회사 소개" 내용이 있으면 그게 About 페이지
- "제품 상세 설명"이 있으면 그게 Product 페이지`;

    const userPrompt = `다음은 웹사이트에서 크롤링한 ${eligiblePages.length}개의 페이지 목록입니다.
각 페이지의 실제 콘텐츠를 분석하여 비즈니스 분석에 가장 중요한 10-15개만 선택해주세요.

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

# 선택 기준 (콘텐츠 내용 기반):
1. **최우선**: 각 페이지 콘텐츠를 읽고 "회사 소개", "제품 설명", "가격 정책", "고객 사례" 정보가 있는지 확인
2. **정보 유형별 균형**: 5가지 정보 유형(회사 소개, 배경, 제품, 가격, 고객)을 모두 커버하도록 선택
3. **블로그 주의**: 블로그는 비즈니스 전략/제품 로드맵 같은 명확한 가치가 있을 때만 추가
4. 중복 정보는 가장 상세한 1개만
5. 정확히 10-15개 선택

**핵심**: URL이 /blog여도 "제품 상세 설명"이 있으면 선택. URL이 /about여도 단순 연락처뿐이면 제외.
콘텐츠 내용이 전부입니다.

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

    // 5. OpenAI API 호출
    console.log('[AI Filter] OpenAI API 호출 중...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2, // 더 낮은 온도로 정확성 강화
      max_tokens: 1500, // 더 상세한 reasoning을 위해 증가
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
