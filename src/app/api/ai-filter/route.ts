/**
 * AI 필터링 API 엔드포인트
 * 크롤링된 페이지 중 비즈니스 분석에 중요한 10-15개를 AI가 자동으로 선별
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getErrorInfo, ErrorCode } from "@/constants/errorMessages";
import type { AIFilterResponse } from "@/types/api";

// Request Schema
const AIFilterRequestSchema = z.object({
  pages: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      content: z.string(),
      pageType: z.string().optional(),
      importance: z.number().optional(),
    })
  ),
});

// OpenAI 클라이언트
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 하드 제외 패턴 (10가지 - 확실한 것만)
// 주의: 너무 aggressive하게 제외하면 제품 설명 페이지까지 걸러질 수 있음
const HARD_EXCLUDE_PATTERNS = [
  /\/(login|signin|register|logout|auth)/i, // 1. 인증
  /\/(privacy|terms|cookie-policy|legal)/i, // 2. 법적 문서
  /\/(404|error|500|maintenance)/i, // 3. 에러 페이지
  /\/(search|\?.*page=|\?.*filter=|\?.*sort=)/i, // 4. 검색/필터
  /\/(tag|category|archive)\//i, // 5. 태그/카테고리
  /\/(en|ko|ja|zh|fr|de|es)\//i, // 6. 언어 중복
  /\/(admin|dashboard|wp-admin|manage|console)/i, // 7. 관리자
  /\/(cart|checkout|payment|wishlist|order)/i, // 8. 전자상거래
  /\/(feed|rss|api|sitemap\.xml|robots\.txt)/i, // 9. RSS/API
  /\.(pdf|zip|doc|docx|jpg|jpeg|png|gif|mp4|mp3)$/i, // 10. 파일
  // 주의: event, promo, apply, trial 등은 제품 설명 페이지일 수 있어서 AI가 콘텐츠로 판단하도록 함
];

const AI_FILTER_MODEL = process.env.AI_FILTER_MODEL || "gpt-4.1-mini";
const MAX_CONTENT_CHARS_PER_PAGE = 8000;

const AI_FILTER_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["selectedPages", "reasoning"],
  properties: {
    selectedPages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pageId", "score", "category", "confidence", "reason"],
        properties: {
          pageId: { type: "integer" },
          score: { type: "integer", minimum: 0, maximum: 10 },
          category: {
            type: "string",
            enum: [
              "company_overview",
              "company_background",
              "product_service",
              "pricing_revenue",
              "customer_proof",
              "strategy_market",
              "technology_security",
              "other_business_critical",
            ],
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          reason: { type: "string" },
        },
      },
    },
    reasoning: { type: "string" },
  },
} as const;

// 제목 키워드 제외 패턴 (명확한 것만)
const TITLE_EXCLUDE_KEYWORDS = [
  /^(로그인|sign\s*in|log\s*in|login)$/i, // 로그인 (완전 일치)
  /^(회원가입|sign\s*up|register|join\s*us)$/i, // 회원가입 (완전 일치)
  /고객센터|customer\s*center|customer\s*service|help\s*center|support\s*center/i, // 고객센터
  /개인정보.*처리방침|privacy\s*policy/i, // 개인정보처리방침
  /이용약관|terms.*service|terms.*use/i, // 이용약관
  /404|not\s*found|page.*not.*found/i, // 404 페이지
];

// 콘텐츠 키워드 제외 (짧은 페이지 + 키워드 조합)
function shouldExcludeByContent(title: string, content: string): boolean {
  // 콘텐츠가 매우 짧고 (<300자) 명확한 키워드가 있으면 제외
  if (content.length < 300) {
    const shortPageKeywords = [
      /아이디.*비밀번호/i, // 로그인 폼
      /이메일.*비밀번호.*로그인/i, // 로그인 폼
      /email.*password.*login/i, // 로그인 폼 (영문)
      /username.*password.*sign\s*in/i, // 로그인 폼 (영문)
    ];

    if (shortPageKeywords.some((pattern) => pattern.test(content))) {
      return true;
    }
  }

  return false;
}

function createContentEvidence(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= MAX_CONTENT_CHARS_PER_PAGE) {
    return normalized;
  }

  const headLength = 4200;
  const middleLength = 1600;
  const tailLength = MAX_CONTENT_CHARS_PER_PAGE - headLength - middleLength;
  const middleStart = Math.max(
    headLength,
    Math.floor(normalized.length / 2 - middleLength / 2)
  );

  return [
    normalized.slice(0, headLength),
    "\n[중간 발췌]\n",
    normalized.slice(middleStart, middleStart + middleLength),
    "\n[후반 발췌]\n",
    normalized.slice(-tailLength),
  ].join("");
}

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 검증
    const body = await request.json();
    const { pages } = AIFilterRequestSchema.parse(body);

    console.log(`[AI Filter] ${pages.length}개 페이지 AI 필터링 시작`);

    // 2. 하드 제외 패턴 사전 필터링 (3단계: URL → 제목 → 콘텐츠)
    const eligiblePages = pages.filter((page) => {
      // 2-1. URL 패턴 체크
      if (HARD_EXCLUDE_PATTERNS.some((pattern) => pattern.test(page.url))) {
        console.log(`[AI Filter] URL 제외: ${page.url}`);
        return false;
      }

      // 2-2. 제목 키워드 체크
      if (TITLE_EXCLUDE_KEYWORDS.some((pattern) => pattern.test(page.title))) {
        console.log(`[AI Filter] 제목 제외: ${page.title} (${page.url})`);
        return false;
      }

      // 2-3. 콘텐츠 키워드 체크
      if (shouldExcludeByContent(page.title, page.content)) {
        console.log(
          `[AI Filter] 콘텐츠 제외: ${page.title} (짧은 페이지 + 키워드)`
        );
        return false;
      }

      return true;
    });

    console.log(
      `[AI Filter] 사전 필터링 후: ${eligiblePages.length}개 페이지 (${
        pages.length - eligiblePages.length
      }개 제외됨)`
    );

    const pagesForAI = eligiblePages.map((page, index) => ({
      pageId: index + 1,
      ...page,
      contentEvidence: createContentEvidence(page.content),
    }));

    // 3. AI 프롬프트 생성: 정확도와 재현성을 우선하는 실사 기준 루브릭
    const systemMessage = `당신은 투자 실사, B2B 영업 리서치, 경쟁사 분석을 위한 웹사이트 페이지 선별 전문가입니다.
목표는 PDF/리포트에 포함할 "비즈니스 분석 핵심 페이지"만 자동 선별하는 것입니다.

판단 원칙:
- 각 페이지의 실제 콘텐츠 증거를 최우선으로 판단합니다. URL, 제목, pageType, importance는 보조 신호입니다.
- 선택 개수에는 제한이 없습니다. 가치 있는 페이지는 모두 선택하고, 정보 가치가 낮은 페이지는 제외하세요.
- 애매한 페이지를 많이 포함하는 것보다, 실사/영업 분석에 직접 도움이 되는 페이지를 신뢰성 있게 고르는 것이 중요합니다.
- 반드시 입력에 있는 pageId만 반환하세요. URL을 새로 만들거나 수정하지 마세요.

핵심 정보 유형:
1. company_overview: 회사/서비스 개요, 미션, 가치 제안, 시장 포지셔닝
2. company_background: 창업자, 팀, 연혁, 투자 이력, 조직 역량
3. product_service: 제품/서비스 기능, 사용 사례, 기술 차별점, 솔루션 상세
4. pricing_revenue: 요금제, 가격, 수익 모델, 플랜 구조
5. customer_proof: 고객사, 사례, 성과 지표, 추천사, 도입 실적
6. strategy_market: 로드맵, 파트너십, 시장/전략 인사이트
7. technology_security: 기술 아키텍처, 보안, 컴플라이언스, 인프라

점수 기준:
- 9-10: 투자자나 B2B 영업팀이 반드시 읽어야 하는 핵심 페이지
- 7-8: 위 핵심 정보 중 하나 이상을 구체적 근거와 함께 담은 페이지
- 5-6: 일부 유용하지만 중복이 있거나 정보 밀도가 낮은 페이지
- 0-4: 단순 안내, 목록, 폼, 채용, 이벤트, 법적 문서, 로그인, 정보 부족 페이지

선택 규칙:
- score 7 이상만 selectedPages에 포함하세요.
- 가격/제품/고객사례/회사배경/기술보안처럼 희소하고 의사결정 가치가 높은 정보는 우선 선택하세요.
- 같은 정보를 반복하는 페이지가 여러 개면 가장 상세하고 증거가 풍부한 페이지만 선택하세요.
- 제목에 "상담", "신청", "무료", "체험"이 있어도 제품/가격/고객/기술 설명이 충분하면 선택하세요.
- 프로모션, 이벤트, 단순 신청 폼, 채용 공고, 블로그 목록, 보도자료 목록은 구체적 비즈니스 인사이트가 없으면 제외하세요.
- 블로그/뉴스도 제품 로드맵, 고객 성과, 시장 전략, 기술 차별화 같은 실질 정보가 있으면 선택하세요.

reason은 선택 결과가 어떤 핵심 정보 유형을 커버하는지 간결하게 설명하세요.`;

    const userPrompt = `다음은 웹사이트에서 크롤링한 ${
      pagesForAI.length
    }개의 페이지 목록입니다.
각 페이지의 실제 콘텐츠 증거를 분석하여 비즈니스 분석에 필요한 핵심 페이지만 선택하세요.
선택 수 제한은 없습니다. pageId는 반드시 아래 목록에 있는 값만 사용하세요.

# 페이지 리스트:
${pagesForAI
  .map(
    (page) => `
━━━ pageId ${page.pageId} ━━━
URL: ${page.url}
제목: ${page.title}
타입: ${page.pageType || "General"}
중요도 점수: ${page.importance || "N/A"}/100

콘텐츠 증거:
${page.contentEvidence}
━━━━━━━━━━━━━━
`
  )
  .join("\n")}
`;

    // 4. OpenAI API 호출
    console.log(
      `[AI Filter] OpenAI API 호출 중 (${AI_FILTER_MODEL}, structured outputs, ${pagesForAI.length}개 페이지)...`
    );
    const completion = await openai.chat.completions.create({
      model: AI_FILTER_MODEL,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 3000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "business_page_selection",
          strict: true,
          schema: AI_FILTER_RESPONSE_SCHEMA,
        },
      },
    });

    // 5. 응답 파싱
    const responseText = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(responseText);

    // 6. 유효성 검증
    if (!parsed.selectedPages || !Array.isArray(parsed.selectedPages)) {
      throw new Error(
        "Invalid AI response format: selectedPages is missing or not an array"
      );
    }

    const pageById = new Map(pagesForAI.map((page) => [page.pageId, page]));
    const selectedUrls = parsed.selectedPages
      .map((selection: { pageId: number }) => pageById.get(selection.pageId))
      .filter(Boolean)
      .map((page: (typeof pagesForAI)[number]) => page.url);

    console.log(
      `[AI Filter] AI 선택 완료: ${selectedUrls.length}개 페이지`
    );
    console.log(`[AI Filter] 선택 이유: ${parsed.reasoning}`);

    const response: AIFilterResponse = {
      success: true,
      data: {
        selectedUrls,
        reasoning: parsed.reasoning || "",
        processedCount: eligiblePages.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[AI Filter] 에러:", error);

    // Zod 검증 에러
    if (error instanceof z.ZodError) {
      const errorInfo = getErrorInfo(
        ErrorCode.INVALID_PAGE_COUNT,
        "요청 데이터가 유효하지 않습니다"
      );
      return NextResponse.json(
        {
          success: false,
          error: errorInfo,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // OpenAI API 에러
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isRateLimit =
      errorMessage.toLowerCase().includes("rate") ||
      errorMessage.toLowerCase().includes("quota");

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
