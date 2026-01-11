/**
 * POST /api/crawl
 * 웹사이트 크롤링 API 엔드포인트
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { crawlWebsite } from "@/lib/crawler";
import { enrichPagesWithFilterMetadata } from "@/lib/crawler/page-filter";
import { getErrorInfo, inferErrorCode } from '@/constants/errorMessages';
import { ErrorCode } from '@/types/errors';

// Vercel Hobby 플랜: 최대 10초 타임아웃
// ⚠️ 주의: 크롤링 작업이 10초를 초과하면 타임아웃됩니다
// 해결 방법: 페이지 수를 줄이거나 Pro 플랜으로 업그레이드 필요
export const maxDuration = 10;

// 요청 스키마 정의
const CrawlRequestSchema = z.object({
  url: z.string().url("유효한 URL을 입력해주세요"),
  maxPages: z.number().min(1).max(200).optional().default(30), // Business 플랜: 최대 200페이지
  crawlMode: z.enum(['full', 'smart']).optional().default('smart'), // 크롤링 모드
});

type CrawlRequest = z.infer<typeof CrawlRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 바디 파싱 및 검증
    const body = await request.json();
    const validatedData = CrawlRequestSchema.parse(body);

    const { url, maxPages, crawlMode } = validatedData;

    // 2. SSE 스트림 생성
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 진행 상황 콜백
          const onProgress = (current: number, total: number, currentUrl: string) => {
            const progressData = {
              type: 'progress',
              current,
              total,
              url: currentUrl,
              percentage: Math.round((current / total) * 100),
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`)
            );
          };

          // 크롤링 시작
          const crawlResult = await crawlWebsite({
            url,
            maxPages,
            sameDomainOnly: true,
            crawlMode, // 크롤링 모드 전달
          }, onProgress);

          // 페이지에 필터 메타데이터 추가
          const enrichedPages = enrichPagesWithFilterMetadata(crawlResult.pages);

          // 완료 데이터 전송
          const completeData = {
            type: 'complete',
            success: true,
            data: {
              crawl: {
                totalPages: crawlResult.totalPages,
                failedUrls: crawlResult.failedUrls,
                crawlMode, // 크롤링 모드 전달
                duration: `${
                  (crawlResult.endTime.getTime() -
                    crawlResult.startTime.getTime()) /
                  1000
                }초`,
                pages: enrichedPages.map((page) => ({
                  url: page.url,
                  title: page.title,
                  content: page.content,
                  depth: page.depth,
                  screenshot: page.screenshot, // viewport 스크린샷 (프레젠테이션용)
                  fullPageScreenshot: page.fullPageScreenshot, // 전체 페이지 스크린샷 (법적 증거용)
                  defaultChecked: page.defaultChecked, // 기본 체크 상태
                  importance: page.importance, // 중요도 점수
                  exclusionReason: page.exclusionReason, // 체크 해제 이유
                  pageType: page.pageType, // 페이지 타입
                })),
              },
            },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(completeData)}\n\n`)
          );
          controller.close();
        } catch (error) {
          const errorCode = error instanceof Error
            ? inferErrorCode(error.message)
            : ErrorCode.UNKNOWN_ERROR;

          const errorInfo = getErrorInfo(
            errorCode,
            error instanceof Error ? error.message : undefined
          );

          const errorData = {
            type: 'error',
            error: errorInfo,
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
          );
          controller.close();
        }
      },
    });

    // SSE 응답 반환
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error("[API] 크롤링 에러:", error);

    // Zod 검증 에러
    if (error instanceof z.ZodError) {
      const errorInfo = getErrorInfo(ErrorCode.INVALID_URL);
      return NextResponse.json(
        {
          success: false,
          error: errorInfo,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // 일반 에러
    const errorCode = error instanceof Error
      ? inferErrorCode(error.message)
      : ErrorCode.UNKNOWN_ERROR;

    const errorInfo = getErrorInfo(
      errorCode,
      error instanceof Error ? error.message : undefined
    );

    return NextResponse.json(
      {
        success: false,
        error: errorInfo,
        timestamp: new Date().toISOString(),
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
      error: "POST 메서드만 지원합니다",
    },
    { status: 405 }
  );
}
