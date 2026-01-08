/**
 * AI 요약 생성 (OpenAI GPT-4)
 */

import OpenAI from 'openai';
import type { AISummary, AISummaryRequest, CrawledPage } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 개별 페이지의 비즈니스 인사이트 생성 (투자자/파트너 관점)
 */
export async function generatePageSummary(
  page: CrawledPage
): Promise<string> {
  const prompt = `당신은 투자자, 파트너, 구직자 등 외부 분석가를 위한 웹페이지 분석 전문가입니다.
다음 웹페이지를 분석하여 비즈니스 의사결정에 필요한 핵심 정보를 제공해주세요.

URL: ${page.url}
제목: ${page.title}

내용:
${page.content.substring(0, 2500)}

다음 형식으로 분석해주세요:

**페이지 역할:** [이 페이지의 비즈니스 목적을 1문장으로 설명]

**핵심 인사이트:**
• [구체적 수치/데이터가 있는 핵심 정보 1]
• [핵심 정보 2]
• [핵심 정보 3]
• [핵심 정보 4]

분석 원칙:
- 페이지에서 실제 확인된 정보만 사용 (추측 금지)
- 가능하면 구체적 수치 포함 (가격, 고객 수, 성장률, 인증, 파트너십 등)
- 투자자/파트너 관점에서 중요한 비즈니스 정보 우선
- 회사 개선점이 아닌 외부 분석자에게 유용한 정보
- 각 인사이트는 1줄로 간결하게
- 한국어로 작성

출력: 위 형식 그대로 출력 (추가 설명 없이)`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 비즈니스 분석 전문가로, 투자자와 파트너에게 유용한 인사이트를 제공합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // 일관성 있는 요약을 위해 낮게 설정
      max_tokens: 300, // 조금 더 긴 분석
    });

    return completion.choices[0].message.content?.trim() || '분석을 생성할 수 없습니다.';
  } catch (error) {
    console.error('[AI] Page summary generation failed:', error);
    return '페이지 분석 실패';
  }
}

/**
 * 크롤링된 페이지들로부터 AI 요약 생성
 */
export async function generateAISummary(
  pages: CrawledPage[],
  detailLevel: 'basic' | 'detailed' | 'comprehensive' = 'basic'
): Promise<AISummary> {
  // 모든 페이지의 콘텐츠를 합침
  const combinedContent = pages
    .map((page) => `URL: ${page.url}\nTitle: ${page.title}\n\n${page.content}`)
    .join('\n\n---\n\n');

  // 콘텐츠가 너무 길면 요약 (GPT-4 토큰 제한)
  const truncatedContent =
    combinedContent.length > 30000
      ? combinedContent.substring(0, 30000) + '...'
      : combinedContent;

  const prompt = generatePrompt(detailLevel, truncatedContent);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 가성비 좋은 모델
      messages: [
        {
          role: 'system',
          content:
            '당신은 웹사이트를 분석하고 비즈니스 인사이트를 제공하는 전문가입니다. 한국어로 답변하세요.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: detailLevel === 'comprehensive' ? 2000 : 1000,
    });

    const result = completion.choices[0].message.content;
    return parseAISummary(result || '', detailLevel);
  } catch (error) {
    console.error('AI summary generation failed:', error);
    throw new Error('AI 요약 생성에 실패했습니다.');
  }
}

/**
 * 프롬프트 생성
 */
function generatePrompt(
  detailLevel: 'basic' | 'detailed' | 'comprehensive',
  content: string
): string {
  const basePrompt = `당신은 웹사이트 분석 전문가입니다. 다음 웹사이트의 내용을 분석하여 비즈니스 인사이트를 제공해주세요.

# 분석 대상 웹사이트 내용:
${content}

---

# 분석 지침:
1. 먼저 이 웹사이트의 타입을 파악하세요 (SaaS, 이커머스, 블로그, 뉴스, 커뮤니티, 포트폴리오, 기업소개 등)
2. 웹사이트가 해결하려는 핵심 문제를 식별하세요
3. 타겟 고객을 구체적인 페르소나로 정의하세요 (예: "30대 스타트업 창업자", "중소기업 마케팅 담당자")
4. 비즈니스 모델과 수익 구조를 파악하세요
5. 경쟁사 대비 차별화 요소를 찾으세요
6. 객관적이고 구체적인 근거를 바탕으로 분석하세요

# 출력 형식 (JSON):`;

  if (detailLevel === 'basic') {
    return (
      basePrompt +
      `
{
  "websiteType": "웹사이트 타입 (SaaS/이커머스/블로그/뉴스/커뮤니티/포트폴리오/기업소개 등)",
  "companyName": "회사/서비스명 (없으면 null)",
  "oneLineSummary": "핵심 가치 제안을 30자 이내로 요약",
  "overview": "웹사이트에 대한 간단한 설명 (3-4문장)",
  "problemSolved": "이 웹사이트/서비스가 해결하는 핵심 문제",
  "mainServices": ["핵심 서비스/제품 1", "핵심 서비스/제품 2", "핵심 서비스/제품 3"],
  "targetCustomers": ["구체적 페르소나 1 (예: 30대 프리랜서 디자이너)", "구체적 페르소나 2"],
  "uniqueFeatures": ["차별화 요소 1", "차별화 요소 2", "차별화 요소 3"]
}

중요: 추측하지 말고 웹사이트에서 실제로 확인되는 정보만 포함하세요.`
    );
  }

  if (detailLevel === 'detailed') {
    return (
      basePrompt +
      `
{
  "websiteType": "웹사이트 타입 (SaaS/이커머스/블로그/뉴스/커뮤니티/포트폴리오/기업소개 등)",
  "companyName": "회사/서비스명 (없으면 null)",
  "oneLineSummary": "핵심 가치 제안을 30자 이내로 요약",
  "overview": "웹사이트에 대한 상세한 설명 (6-8문장)",
  "businessModel": {
    "type": "비즈니스 타입 (B2B/B2C/B2B2C/C2C/B2G 등)",
    "revenueModel": "수익 모델 (구독/일회성 구매/광고/프리미엄/커미션/라이선스 등)",
    "priceRange": "가격대 (무료/저가/중가/고가/다양)"
  },
  "problemSolved": "이 웹사이트/서비스가 해결하는 핵심 문제 (구체적으로)",
  "mainServices": ["핵심 서비스/제품 1 (간단한 설명 포함)", "핵심 서비스/제품 2", "핵심 서비스/제품 3"],
  "targetCustomers": ["구체적 페르소나 1 (직업, 연령대, 니즈 포함)", "구체적 페르소나 2"],
  "uniqueFeatures": ["차별화 요소 1 (구체적 근거)", "차별화 요소 2", "차별화 요소 3"],
  "keyStrengths": [
    "강점 1: 구체적인 설명과 근거",
    "강점 2: 구체적인 설명과 근거",
    "강점 3: 구체적인 설명과 근거"
  ],
  "growthOpportunities": [
    "성장 기회 1: 확장 가능한 영역과 시장 잠재력 (예: 신규 고객층, 새로운 시장, 추가 서비스)",
    "성장 기회 2: 미개척 영역과 예상 성장 가능성",
    "성장 기회 3: 투자/협업 기회 및 스케일업 방향"
  ]
}

중요:
- 강점과 성장 기회는 웹사이트에서 실제로 관찰된 내용을 바탕으로 작성하세요
- 투자자/파트너 관점에서 이 회사의 성장 가능성과 확장 영역을 분석하세요
- 추측이나 일반론이 아닌 구체적이고 실행 가능한 인사이트를 제공하세요`
    );
  }

  // comprehensive
  return (
    basePrompt +
    `
{
  "websiteType": "웹사이트 타입 (SaaS/이커머스/블로그/뉴스/커뮤니티/포트폴리오/기업소개 등)",
  "companyName": "회사/서비스명 (없으면 null)",
  "oneLineSummary": "핵심 가치 제안을 30자 이내로 요약",
  "overview": "웹사이트에 대한 매우 상세한 설명 (10-12문장, 비즈니스 배경, 주요 특징, 시장 포지셔닝 포함)",
  "businessModel": {
    "type": "비즈니스 타입 (B2B/B2C/B2B2C/C2C/B2G 등) - 근거 포함",
    "revenueModel": "수익 모델 상세 설명 (구독/일회성/광고/프리미엄/커미션 등, 가능하면 가격 정보 포함)",
    "priceRange": "가격대 및 가격 전략 분석"
  },
  "problemSolved": "이 웹사이트/서비스가 해결하는 핵심 문제 (고객의 pain point 구체적으로)",
  "mainServices": [
    "핵심 서비스 1: 상세 설명, 타겟, 특징",
    "핵심 서비스 2: 상세 설명, 타겟, 특징",
    "핵심 서비스 3: 상세 설명, 타겟, 특징"
  ],
  "targetCustomers": [
    "페르소나 1: 직업, 연령대, 소득 수준, 구체적 니즈, 사용 시나리오",
    "페르소나 2: 직업, 연령대, 소득 수준, 구체적 니즈, 사용 시나리오"
  ],
  "uniqueFeatures": [
    "차별화 요소 1: 구체적 설명 및 경쟁 우위",
    "차별화 요소 2: 구체적 설명 및 경쟁 우위",
    "차별화 요소 3: 구체적 설명 및 경쟁 우위"
  ],
  "keyStrengths": [
    "강점 1: 구체적 근거와 데이터, 왜 강점인지 분석",
    "강점 2: 구체적 근거와 데이터, 왜 강점인지 분석",
    "강점 3: 구체적 근거와 데이터, 왜 강점인지 분석"
  ],
  "growthOpportunities": [
    "성장 기회 1: 미개척 시장/고객층, 확장 가능성, 예상 임팩트 (투자자 관점)",
    "성장 기회 2: 신규 서비스 영역, 수익 다각화 기회, 시장 규모 추정",
    "성장 기회 3: 파트너십/인수합병 기회, 글로벌 확장 가능성"
  ],
  "competitorAnalysis": "경쟁 환경 분석: 주요 경쟁사, 시장 포지셔닝, 경쟁 우위 및 열위 요소 (5-7문장)",
  "actionableInsights": [
    "실행 가능한 제안 1: 구체적 액션 아이템과 기대 효과",
    "실행 가능한 제안 2: 구체적 액션 아이템과 기대 효과",
    "실행 가능한 제안 3: 구체적 액션 아이템과 기대 효과"
  ],
  "marketOpportunity": "시장 기회 분석: 성장 가능성, 진출 가능한 새로운 시장, 확장 기회 (4-6문장)"
}

중요 원칙:
1. 모든 분석은 웹사이트에서 실제로 확인된 내용을 기반으로 하세요
2. 추측보다는 관찰된 사실과 합리적 추론을 제시하세요
3. 일반적이고 뻔한 내용보다 구체적이고 실행 가능한 인사이트를 제공하세요
4. 비즈니스 의사결정에 도움이 되는 정보에 집중하세요`
  );
}

/**
 * AI 응답 파싱
 */
function parseAISummary(
  rawResponse: string,
  detailLevel: 'basic' | 'detailed' | 'comprehensive'
): AISummary {
  try {
    // JSON 블록 추출 (```json ... ``` 형식일 수 있음)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON을 찾을 수 없습니다.');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 기본 필드 (모든 레벨)
    const summary: AISummary = {
      websiteType: parsed.websiteType || '알 수 없음',
      companyName: parsed.companyName || undefined,
      oneLineSummary: parsed.oneLineSummary || '정보 없음',
      overview: parsed.overview || '요약을 생성할 수 없습니다.',
      problemSolved: parsed.problemSolved || '정보 없음',
      mainServices: parsed.mainServices || [],
      targetCustomers: parsed.targetCustomers || [],
      uniqueFeatures: parsed.uniqueFeatures || [],
    };

    // detailed, comprehensive 레벨 추가 필드
    if (detailLevel === 'detailed' || detailLevel === 'comprehensive') {
      summary.businessModel = parsed.businessModel;
      summary.keyStrengths = parsed.keyStrengths;
      summary.growthOpportunities = parsed.growthOpportunities;
    }

    // comprehensive 레벨 전용 필드
    if (detailLevel === 'comprehensive') {
      summary.competitorAnalysis = parsed.competitorAnalysis;
      summary.actionableInsights = parsed.actionableInsights;
      summary.marketOpportunity = parsed.marketOpportunity;
    }

    return summary;
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Raw response:', rawResponse);

    // 파싱 실패 시 기본 응답
    return {
      websiteType: '분석 실패',
      oneLineSummary: '분석에 실패했습니다',
      overview: rawResponse.substring(0, 500),
      problemSolved: '정보 없음',
      mainServices: [],
      targetCustomers: [],
      uniqueFeatures: [],
    };
  }
}
