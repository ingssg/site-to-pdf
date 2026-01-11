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
import { getErrorInfo, inferErrorCode } from "@/constants/errorMessages";
import { ErrorCode } from "@/types/errors";

// Vercel Hobby 플랜: 최대 10초 타임아웃
// ⚠️ 주의: PDF 생성 작업이 10초를 초과하면 타임아웃됩니다
// 해결 방법: 페이지 수를 줄이거나 Pro 플랜으로 업그레이드 필요
export const maxDuration = 10;

// 요청 스키마 정의
const GeneratePDFRequestSchema = z.object({
  pages: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      content: z.string(),
      depth: z.number(),
      screenshot: z.any().optional(), // Buffer는 any로 처리
      fullPageScreenshot: z.any().optional(), // 전체 페이지 스크린샷 (법적 증거용)
      pageSummary: z.string().optional(), // 페이지별 AI 요약
      defaultChecked: z.boolean().optional(), // 필터링 체크 상태
    })
  ),
  detailLevel: z
    .enum(["basic", "detailed", "comprehensive"])
    .optional()
    .default("detailed"),
  crawlMode: z.enum(["full", "smart"]).optional().default("smart"), // 크롤링 모드
});

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 바디 파싱 및 검증
    const body = await request.json();
    const validatedData = GeneratePDFRequestSchema.parse(body);

    const { pages, detailLevel, crawlMode } = validatedData;

    // 2. SSE 스트림 생성
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const sendProgress = (message: string, percentage: number) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  message,
                  percentage,
                })}\n\n`
              )
            );
          };

          // Buffer 복원
          sendProgress("페이지 데이터 처리 중...", 10);
          const crawledPages: CrawledPage[] = pages.map((page) => {
            return {
              ...page,
              screenshot: page.screenshot
                ? page.screenshot.data
                  ? Buffer.from(page.screenshot.data) // JSON.stringify로 직렬화된 Buffer (배열)
                  : Buffer.from(page.screenshot, "base64") // base64 문자열
                : undefined,
              fullPageScreenshot: page.fullPageScreenshot
                ? page.fullPageScreenshot.data
                  ? Buffer.from(page.fullPageScreenshot.data) // JSON.stringify로 직렬화된 Buffer (배열)
                  : Buffer.from(page.fullPageScreenshot, "base64") // base64 문자열
                : undefined,
              timestamp: new Date(),
            };
          });

          // 각 페이지 AI 요약 생성 (병렬 처리)
          sendProgress("페이지별 AI 요약 생성 중...", 20);
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

          // 전체 사이트 AI 요약 생성
          sendProgress("전체 사이트 AI 요약 생성 중...", 40);
          const aiSummary = await generateAISummary(crawledPages, detailLevel);

          // PDF 생성
          sendProgress("PDF 문서 생성 중...", 60);
          const pdfResult = await generatePDFFromPages(
            crawledPages,
            { detailLevel, crawlMode },
            aiSummary
          );

          // ZIP 압축
          sendProgress("개별 PDF ZIP 생성 중...", 85);
          const zip = new JSZip();
          (pdfResult.individualPdfs || []).forEach((pdfBuffer, index) => {
            const pageNumber = index + 1;

            if (index === 0) {
              const filename = `${String(pageNumber).padStart(
                2,
                "0"
              )}_전체_요약.pdf`;
              zip.file(filename, pdfBuffer);
              return;
            }

            const pageIndex = index - 1;
            const page = crawledPages[pageIndex];
            if (!page) return;

            const baseName = `${String(pageNumber).padStart(2, "0")}_${
              page.title || "page"
            }`;
            const filename = `${baseName}.pdf`
              .replace(/[^a-zA-Z0-9가-힣._-]/g, "_")
              .slice(0, 100);

            zip.file(filename, pdfBuffer);
          });
          const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

          // 서버리스 환경 호환: /tmp 폴더 사용
          const fs = await import("fs");
          const path = await import("path");
          const crypto = await import("crypto");
          const os = await import("os");

          // 서버리스 환경에서 /tmp 폴더 사용 (읽기/쓰기 가능)
          // 로컬 개발 환경에서는 os.tmpdir() 사용
          const tempDir = process.env.VERCEL
            ? "/tmp" // Vercel 환경
            : process.env.AWS_LAMBDA_FUNCTION_NAME
            ? "/tmp" // AWS Lambda 환경
            : path.join(os.tmpdir(), "site-to-pdf"); // 로컬 개발 환경

          // 임시 디렉토리 생성 (로컬 환경에서만 필요)
          if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }
          }

          const zipFileId = crypto.randomUUID();
          const zipFilename = `${zipFileId}.zip`;
          const zipPath = path.join(tempDir, zipFilename);

          // 파일 저장
          fs.writeFileSync(zipPath, zipBuffer);

          // API 엔드포인트로 파일 제공 (서버리스 환경 호환)
          const zipDownloadUrl = `/api/download-file?fileId=${zipFileId}&type=zip&filename=${encodeURIComponent(
            generateFilename("zip")
          )}`;

          // 스크린샷 PDF도 동일하게 처리
          let screenshotPdfUrl = null;
          if (pdfResult.screenshotPdf) {
            const screenshotFileId = crypto.randomUUID();
            const screenshotFilename = `${screenshotFileId}_screenshots.pdf`;
            const screenshotPath = path.join(tempDir, screenshotFilename);
            fs.writeFileSync(screenshotPath, pdfResult.screenshotPdf);

            const domain = getDomain().replace(/\./g, "_");
            const date = new Date().toISOString().split("T")[0];
            const screenshotDownloadFilename = `${domain}_screenshots_${date}.pdf`;

            screenshotPdfUrl = `/api/download-file?fileId=${screenshotFileId}&type=screenshot&filename=${encodeURIComponent(
              screenshotDownloadFilename
            )}`;
          }

          // 파일명 생성 헬퍼 함수
          function generateFilename(ext: string): string {
            const domain = getDomain().replace(/\./g, "_");
            const date = new Date().toISOString().split("T")[0];
            return `${domain}_individual_pdfs_${date}.${ext}`;
          }

          function getDomain(): string {
            if (crawledPages.length > 0) {
              try {
                const url = new URL(crawledPages[0].url);
                return url.hostname.replace("www.", "");
              } catch {
                return "website";
              }
            }
            return "website";
          }

          // 완료
          sendProgress("완료!", 100);

          const completeData = {
            type: "complete",
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
                zipDownloadUrl: zipDownloadUrl, // ZIP 파일 다운로드 URL
                screenshotPdfUrl: screenshotPdfUrl, // 스크린샷 PDF 다운로드 URL
              },
              summary: aiSummary,
            },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(completeData)}\n\n`)
          );
          controller.close();
        } catch (error) {
          const errorCode =
            error instanceof Error
              ? inferErrorCode(error.message)
              : ErrorCode.PDF_GENERATION_FAILED;

          const errorInfo = getErrorInfo(
            errorCode,
            error instanceof Error ? error.message : undefined
          );

          const errorData = {
            type: "error",
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
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
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
    const errorCode =
      error instanceof Error
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
