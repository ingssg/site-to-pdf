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

// 하드 제외 패턴 (10가지 - 확실한 것만)
// 주의: 너무 aggressive하게 제외하면 제품 설명 페이지까지 걸러질 수 있음
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
  // 주의: event, promo, apply, trial 등은 제품 설명 페이지일 수 있어서 AI가 콘텐츠로 판단하도록 함
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

**반드시 제외 (이런 페이지는 절대 선택하지 마세요):**
1. 마케팅/프로모션: 이벤트, 할인, 무상 체험, 캠페인, 경품, 프로모션
   - 예: "무상 이벤트 신청", "할인 행사", "프로모션", "이벤트 참여하기"
2. 단순 신청 폼: 콘텐츠가 신청 폼(이름, 이메일, 전화번호)만 있는 페이지
   - 예: "무료 상담 신청" (단, 제품 상세 설명이 없는 경우만)
3. 채용/내부: 채용 공고, 사무실 소식, 회사 소식
4. 단순 목록: 내용 없는 보도자료 리스트, 블로그 목록
5. 인증/법적: 로그인, 회원가입, 약관, 개인정보처리방침

**중요한 예외 처리:**
- 제목에 "상담받기", "신청하기"가 있어도, 콘텐츠에 **제품/서비스 상세 설명**(기능, 가격, 기술 스택, 사용 사례)이 충분하면 선택하세요
- 예: "가상대기실 솔루션 상담받기" 페이지에 솔루션 기능 5가지, 기술 아키텍처, 고객 사례가 있으면 → 선택
- 예: "무료 상담 신청하기" 페이지에 이름/이메일 입력란만 있고 설명 2줄뿐이면 → 제외
- **핵심**: CTA 키워드보다 실제 비즈니스 정보의 양과 질이 우선입니다.

**평가 방법:**
- 각 페이지 콘텐츠를 읽고 어떤 정보를 담고 있는지 파악
- URL(/about, /blog 등)은 참고만 하고, 내용이 핵심
- 블로그든 뭐든 "회사 소개" 내용이 있으면 그게 About 페이지
- "제품 상세 설명"이 있으면 그게 Product 페이지

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
4. **CTA 페이지 판단**: 제목에 "상담받기", "신청하기"가 있어도 콘텐츠를 먼저 확인
   - 제품/서비스 상세 설명이 충분하면 → 선택
   - 단순 신청 폼(이름/이메일/전화번호)만 있으면 → 제외
5. **마케팅 프로모션 제외**: "이벤트", "할인", "무상", "프로모션", "캠페인" 키워드가 주된 내용이면 제외
6. 중복 정보는 가장 상세한 1개만
7. 정확히 10-15개 선택

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
