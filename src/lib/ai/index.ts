/**
 * AI 요약 생성 (OpenAI GPT-4)
 */

import OpenAI from 'openai';
import type { AISummary, AISummaryRequest, CrawledPage } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  const basePrompt = `다음은 어떤 웹사이트의 전체 내용입니다. 이 웹사이트를 분석하여 다음 정보를 JSON 형식으로 제공해주세요:

웹사이트 내용:
${content}

---

다음 형식으로 JSON을 작성해주세요:`;

  if (detailLevel === 'basic') {
    return (
      basePrompt +
      `
{
  "companyName": "회사명 (없으면 null)",
  "overview": "이 웹사이트/회사에 대한 간단한 설명 (2-3문장)",
  "mainServices": ["주요 서비스 1", "주요 서비스 2", ...],
  "targetCustomers": ["타겟 고객 1", "타겟 고객 2", ...],
  "uniqueFeatures": ["차별점 1", "차별점 2", ...]
}`
    );
  }

  if (detailLevel === 'detailed') {
    return (
      basePrompt +
      `
{
  "companyName": "회사명 (없으면 null)",
  "overview": "이 웹사이트/회사에 대한 상세한 설명 (5-7문장)",
  "mainServices": ["주요 서비스 1", "주요 서비스 2", ...],
  "targetCustomers": ["타겟 고객 1", "타겟 고객 2", ...],
  "uniqueFeatures": ["차별점 1", "차별점 2", ...],
  "swotAnalysis": {
    "strengths": ["강점 1", "강점 2", ...],
    "weaknesses": ["약점 1", "약점 2", ...],
    "opportunities": ["기회 1", "기회 2", ...],
    "threats": ["위협 1", "위협 2", ...]
  }
}`
    );
  }

  // comprehensive
  return (
    basePrompt +
    `
{
  "companyName": "회사명 (없으면 null)",
  "overview": "이 웹사이트/회사에 대한 매우 상세한 설명 (10문장 이상)",
  "mainServices": ["주요 서비스 1 (상세 설명)", ...],
  "targetCustomers": ["타겟 고객 1 (상세 설명)", ...],
  "uniqueFeatures": ["차별점 1 (상세 설명)", ...],
  "swotAnalysis": {
    "strengths": ["강점 1 (상세 설명)", ...],
    "weaknesses": ["약점 1 (상세 설명)", ...],
    "opportunities": ["기회 1 (상세 설명)", ...],
    "threats": ["위협 1 (상세 설명)", ...]
  },
  "competitorAnalysis": "경쟁사 분석 및 시장 포지셔닝 (3-5문장)"
}`
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

    return {
      companyName: parsed.companyName || undefined,
      overview: parsed.overview || '요약을 생성할 수 없습니다.',
      mainServices: parsed.mainServices || [],
      targetCustomers: parsed.targetCustomers || [],
      uniqueFeatures: parsed.uniqueFeatures || [],
      swotAnalysis:
        detailLevel !== 'basic' ? parsed.swotAnalysis : undefined,
      competitorAnalysis:
        detailLevel === 'comprehensive'
          ? parsed.competitorAnalysis
          : undefined,
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    // 파싱 실패 시 기본 응답
    return {
      overview: rawResponse,
      mainServices: [],
      targetCustomers: [],
      uniqueFeatures: [],
    };
  }
}
