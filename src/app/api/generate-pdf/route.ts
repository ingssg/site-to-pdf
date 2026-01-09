/**
 * POST /api/generate-pdf
 * 선택된 페이지로 PDF 생성 API 엔드포인트
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import JSZip from "jszip";
import { generatePDFFromPages } from "@/lib/pdf";
import { generateAISummary, generatePageSummary } from "@/lib/ai";
import type { CrawledPage } from "@/types";
import { getErrorInfo, inferErrorCode } from '@/constants/errorMessages';
import { ErrorCode } from '@/types/errors';

// 요청 스키마 정의
const GeneratePDFRequestSchema = z.object({
  pages: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      content: z.string(),
      depth: z.number(),
      screenshot: z.any().optional(), // Buffer는 any로 처리
      pageSummary: z.string().optional(), // 페이지별 AI 요약
      defaultChecked: z.boolean().optional(), // 필터링 체크 상태
    })
  ),
  detailLevel: z
    .enum(["basic", "detailed", "comprehensive"])
    .optional()
    .default("detailed"),
  crawlMode: z.enum(['full', 'smart']).optional().default('smart'), // 크롤링 모드
});

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 바디 파싱 및 검증
    const body = await request.json();
    const validatedData = GeneratePDFRequestSchema.parse(body);

    const { pages, detailLevel, crawlMode } = validatedData;

    console.log(
      `[API] PDF 생성 시작: ${pages.length}개 페이지 (상세도: ${detailLevel}, 모드: ${crawlMode})`
    );

    // 2. SSE 스트림 생성
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const sendProgress = (message: string, percentage: number) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'progress', message, percentage })}\n\n`)
            );
          };

          // Buffer 복원
          sendProgress('페이지 데이터 처리 중...', 10);
          const crawledPages: CrawledPage[] = pages.map((page) => ({
            ...page,
            screenshot: page.screenshot
              ? Buffer.from(page.screenshot.data || page.screenshot, "base64")
              : undefined,
            timestamp: new Date(),
          }));

          // 각 페이지 AI 요약 생성 (병렬 처리)
          // 필터링되지 않은 페이지(defaultChecked === true)만 AI 요약 생성
          sendProgress('페이지별 AI 요약 생성 중...', 20);
          console.log("[API] 페이지별 AI 요약 생성 시작...");

          await Promise.all(
            crawledPages.map(async (page) => {
              if (page.defaultChecked !== false) {
                // defaultChecked가 true이거나 undefined인 경우 요약 생성
                page.pageSummary = await generatePageSummary(page);
              } else {
                // 필터링된 페이지는 요약 생성 안 함
                page.pageSummary = undefined;
              }
            })
          );

          const summaryCount = crawledPages.filter(p => p.pageSummary).length;
          console.log(`[API] 페이지별 AI 요약 생성 완료 (${summaryCount}/${crawledPages.length}페이지)`);

          // 전체 사이트 AI 요약 생성
          sendProgress('전체 사이트 AI 요약 생성 중...', 40);
          console.log("[API] 전체 사이트 AI 요약 생성 시작...");
          const aiSummary = await generateAISummary(crawledPages, detailLevel);
          console.log("[API] 전체 사이트 AI 요약 생성 완료");

          // PDF 생성
          sendProgress('PDF 문서 생성 중...', 60);
          console.log("[API] PDF 생성 시작...");
          const pdfResult = await generatePDFFromPages(
            crawledPages,
            { detailLevel, crawlMode }, // crawlMode 전달
            aiSummary
          );
          console.log(
            `[API] PDF 생성 완료: ${(pdfResult.totalSize / 1024 / 1024).toFixed(
              2
            )}MB`
          );

          // ZIP 압축 (각 페이지당 1개 PDF)
          sendProgress('개별 PDF ZIP 생성 중...', 85);
          console.log("[API] 개별 PDF ZIP 생성 시작...");
          const zip = new JSZip();
          (pdfResult.individualPdfs || []).forEach((pdfBuffer, index) => {
            const page = crawledPages[index];
            if (!page) {
              console.warn(`[API] PDF ${index}에 해당하는 페이지를 찾을 수 없음. 스킵합니다.`);
              return;
            }

            const baseName = `${index + 1}_${page.title || "page"}`;
            const filename = `${baseName}.pdf`
              .replace(/[^a-zA-Z0-9가-힣._-]/g, "_")
              .slice(0, 100);

            zip.file(filename, pdfBuffer);
          });
          const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

          // ZIP이 50MB 이상이면 서버에 저장하고 URL 제공
          const zipSizeMB = zipBuffer.length / 1024 / 1024;
          console.log(`[API] ZIP 생성 완료: ${zipSizeMB.toFixed(2)}MB`);

          let individualPdfsZipBase64 = '';
          let zipDownloadUrl = '';

          if (zipSizeMB > 50) {
            // 서버에 임시 저장 (공용 폴더)
            const fs = await import('fs');
            const path = await import('path');
            const crypto = await import('crypto');

            const tempDir = path.join(process.cwd(), 'public', 'temp');
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }

            const zipFilename = `${crypto.randomUUID()}.zip`;
            const zipPath = path.join(tempDir, zipFilename);
            fs.writeFileSync(zipPath, zipBuffer);

            zipDownloadUrl = `/temp/${zipFilename}`;
            console.log(`[API] ZIP 파일이 너무 커서 서버에 저장: ${zipDownloadUrl}`);
          } else {
            individualPdfsZipBase64 = zipBuffer.toString("base64");
          }

          // 완료
          sendProgress('완료!', 100);

          // 스크린샷 PDF base64 인코딩
          const screenshotPdfBase64 = pdfResult.screenshotPdf
            ? pdfResult.screenshotPdf.toString("base64")
            : null;

          const completeData = {
            type: 'complete',
            success: true,
            data: {
              pdf: {
                totalSize: pdfResult.totalSize,
                totalSizeMB: (pdfResult.totalSize / 1024 / 1024).toFixed(2),
                pageCount: pdfResult.tableOfContents.length,
                warnings: pdfResult.warnings,
                mergedPdf:
                  pdfResult.totalSize < 50 * 1024 * 1024
                    ? pdfResult.mergedPdf.toString("base64")
                    : null,
                mergedPdfTooLarge: pdfResult.totalSize >= 50 * 1024 * 1024,
                individualPdfsZip: individualPdfsZipBase64,
                zipDownloadUrl: zipDownloadUrl, // 큰 ZIP은 URL로 제공
                screenshotPdf: screenshotPdfBase64, // 스크린샷 PDF 추가
              },
              summary: aiSummary,
            },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(completeData)}\n\n`)
          );
          controller.close();
        } catch (error) {
          const errorCode = error instanceof Error
            ? inferErrorCode(error.message)
            : ErrorCode.PDF_GENERATION_FAILED;

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
    console.error("[API] PDF 생성 에러:", error);

    // Zod 검증 에러
    if (error instanceof z.ZodError) {
      const errorInfo = getErrorInfo(ErrorCode.INVALID_PAGE_COUNT);
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
      : ErrorCode.PDF_GENERATION_FAILED;

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
