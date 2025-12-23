/**
 * POST /api/crawl
 * 웹사이트 크롤링 API 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { crawlWebsite } from '@/lib/crawler';
import { generatePDFFromPages } from '@/lib/pdf';
import { generateAISummary } from '@/lib/ai';

// 요청 스키마 정의
const CrawlRequestSchema = z.object({
  url: z.string().url('유효한 URL을 입력해주세요'),
  maxPages: z.number().min(1).max(200).optional().default(10),
  detailLevel: z
    .enum(['basic', 'detailed', 'comprehensive'])
    .optional()
    .default('basic'),
  includePDF: z.boolean().optional().default(true),
  includeAI: z.boolean().optional().default(true),
});

type CrawlRequest = z.infer<typeof CrawlRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 바디 파싱 및 검증
    const body = await request.json();
    const validatedData = CrawlRequestSchema.parse(body);

    const { url, maxPages, detailLevel, includePDF, includeAI } =
      validatedData;

    console.log(`[API] 크롤링 시작: ${url} (최대 ${maxPages}페이지)`);

    // 2. 웹사이트 크롤링
    const crawlResult = await crawlWebsite({
      url,
      maxPages,
      sameDomainOnly: true,
    });

    console.log(
      `[API] 크롤링 완료: ${crawlResult.totalPages}페이지 수집됨`
    );

    // 3. PDF 생성 (옵션)
    let pdfResult = null;
    if (includePDF && crawlResult.pages.length > 0) {
      console.log('[API] PDF 생성 시작...');
      pdfResult = await generatePDFFromPages(crawlResult.pages);
      console.log(
        `[API] PDF 생성 완료: ${(pdfResult.totalSize / 1024 / 1024).toFixed(2)}MB`
      );
    }

    // 4. AI 요약 생성 (옵션)
    let aiSummary = null;
    if (includeAI && crawlResult.pages.length > 0) {
      console.log('[API] AI 요약 생성 시작...');
      aiSummary = await generateAISummary(crawlResult.pages, detailLevel);
      console.log('[API] AI 요약 생성 완료');
    }

    // 5. 응답 반환
    return NextResponse.json(
      {
        success: true,
        data: {
          crawl: {
            totalPages: crawlResult.totalPages,
            failedUrls: crawlResult.failedUrls,
            duration: `${
              (crawlResult.endTime.getTime() -
                crawlResult.startTime.getTime()) /
              1000
            }초`,
          },
          pdf: pdfResult
            ? {
                totalSize: pdfResult.totalSize,
                totalSizeMB: (pdfResult.totalSize / 1024 / 1024).toFixed(2),
                pageCount: pdfResult.tableOfContents.length,
                // PDF 데이터는 Base64로 인코딩하여 전달
                mergedPdf: pdfResult.mergedPdf.toString('base64'),
              }
            : null,
          summary: aiSummary,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 크롤링 에러:', error);

    // Zod 검증 에러
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '잘못된 요청입니다',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // 일반 에러
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 에러가 발생했습니다',
      },
      { status: 500 }
    );
  }
}

// GET 메서드는 지원하지 않음
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'POST 메서드만 지원합니다',
    },
    { status: 405 }
  );
}
