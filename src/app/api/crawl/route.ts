/**
 * POST /api/crawl
 * 웹사이트 크롤링 API 엔드포인트
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { crawlWebsite } from "@/lib/crawler";
import { enrichPagesWithFilterMetadata } from "@/lib/crawler/page-filter";

// 요청 스키마 정의
const CrawlRequestSchema = z.object({
  url: z.string().url("유효한 URL을 입력해주세요"),
  maxPages: z.number().min(1).max(50).optional().default(30), // MVP: 무료 버전은 50페이지 제한
  crawlMode: z.enum(['full', 'smart']).optional().default('smart'), // 크롤링 모드
});

type CrawlRequest = z.infer<typeof CrawlRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 바디 파싱 및 검증
    const body = await request.json();
    const validatedData = CrawlRequestSchema.parse(body);

    const { url, maxPages, crawlMode } = validatedData;

    console.log(
      `[API] 크롤링 시작: ${url} (최대 ${maxPages}페이지, 모드: ${crawlMode})`
    );

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

          console.log(`[API] 크롤링 완료: ${crawlResult.totalPages}페이지 수집됨`);

          // 페이지에 필터 메타데이터 추가
          // 전체 모드와 스마트 모드 모두 동일하게 점수 기반 필터링 적용
          const enrichedPages = enrichPagesWithFilterMetadata(crawlResult.pages);

          console.log(`[API] 필터링 완료 (${crawlMode} 모드): ${enrichedPages.filter(p => p.defaultChecked).length}/${enrichedPages.length}페이지 추천`);

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
                  screenshot: page.screenshot, // 스크린샷 데이터 포함
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
          const errorData = {
            type: 'error',
            error: error instanceof Error ? error.message : '크롤링 실패',
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
      return NextResponse.json(
        {
          success: false,
          error: "잘못된 요청입니다",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    // 일반 에러
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "알 수 없는 에러가 발생했습니다",
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
