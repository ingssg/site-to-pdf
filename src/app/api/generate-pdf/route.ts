/**
 * POST /api/generate-pdf
 * 선택된 페이지로 PDF 생성 API 엔드포인트
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import JSZip from "jszip";
import { generatePDFFromPages } from "@/lib/pdf";
import { generateAISummary } from "@/lib/ai";
import type { CrawledPage } from "@/types";

// 요청 스키마 정의
const GeneratePDFRequestSchema = z.object({
  pages: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      content: z.string(),
      depth: z.number(),
      screenshot: z.any().optional(), // Buffer는 any로 처리
    })
  ),
  detailLevel: z
    .enum(["basic", "detailed", "comprehensive"])
    .optional()
    .default("basic"),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 바디 파싱 및 검증
    const body = await request.json();
    const validatedData = GeneratePDFRequestSchema.parse(body);

    const { pages, detailLevel } = validatedData;

    console.log(
      `[API] PDF 생성 시작: ${pages.length}개 페이지 (상세도: ${detailLevel})`
    );

    // 2. Buffer 복원 (Base64 → Buffer)
    const crawledPages: CrawledPage[] = pages.map((page) => ({
      ...page,
      screenshot: page.screenshot
        ? Buffer.from(page.screenshot.data || page.screenshot, "base64")
        : undefined,
      timestamp: new Date(),
    }));

    // 3. 각 페이지 AI 요약 생성 (병렬 처리)
    console.log("[API] 각 페이지 AI 요약 생성 시작...");
    const pageSummaries = await Promise.all(
      crawledPages.map(async (page) => {
        // 각 페이지의 간단한 요약 생성
        // TODO: AI 모델로 페이지별 요약 구현
        return {
          url: page.url,
          title: page.title,
          summary: page.content.slice(0, 300), // 임시: 첫 300자
        };
      })
    );
    console.log("[API] 페이지별 AI 요약 완료");

    // 4. 전체 사이트 AI 요약 생성
    console.log("[API] 전체 사이트 AI 요약 생성 시작...");
    const aiSummary = await generateAISummary(crawledPages, detailLevel);
    console.log("[API] 전체 사이트 AI 요약 생성 완료");

    // 5. PDF 생성 (AI 요약 포함)
    console.log("[API] PDF 생성 시작...");
    const pdfResult = await generatePDFFromPages(
      crawledPages,
      undefined,
      aiSummary
    );
    console.log(
      `[API] PDF 생성 완료: ${(pdfResult.totalSize / 1024 / 1024).toFixed(
        2
      )}MB`
    );

    // 6. 개별 PDF를 ZIP으로 압축
    console.log("[API] 개별 PDF ZIP 생성 시작...");
    const zip = new JSZip();
    (pdfResult.individualPdfs || []).forEach((pdfBuffer, index) => {
      const page = crawledPages[index];
      if (!page) {
        console.warn(`[API] 페이지 ${index}를 찾을 수 없음. 스킵합니다.`);
        return;
      }
      const filename = `${index + 1}_${page.title || "page"}.pdf`
        .replace(/[^a-zA-Z0-9가-힣._-]/g, "_")
        .slice(0, 100);
      zip.file(filename, pdfBuffer);
    });
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const individualPdfsZipBase64 = zipBuffer.toString("base64");
    console.log(
      `[API] ZIP 생성 완료: ${(zipBuffer.length / 1024 / 1024).toFixed(2)}MB`
    );

    // 7. 응답 반환
    return NextResponse.json(
      {
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
          },
          summary: aiSummary,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] PDF 생성 에러:", error);

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
