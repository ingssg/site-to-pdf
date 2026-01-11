/**
 * GET /api/download-file
 * 임시 저장된 파일 다운로드 API
 * 서버리스 환경 호환: /tmp 폴더에서 파일 제공
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get("fileId");
    const type = searchParams.get("type"); // "zip" or "screenshot"
    const filename = searchParams.get("filename") || "download";

    if (!fileId || !type) {
      return NextResponse.json(
        { error: "fileId and type are required" },
        { status: 400 }
      );
    }

    // 서버리스 환경에서 /tmp 폴더 사용
    const tempDir = process.env.VERCEL
      ? "/tmp" // Vercel 환경
      : process.env.AWS_LAMBDA_FUNCTION_NAME
      ? "/tmp" // AWS Lambda 환경
      : path.join(os.tmpdir(), "site-to-pdf"); // 로컬 개발 환경

    // 파일 경로 구성
    const fileExtension = type === "zip" ? ".zip" : "_screenshots.pdf";
    const filePath = path.join(tempDir, `${fileId}${fileExtension}`);

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found or expired" },
        { status: 404 }
      );
    }

    // 파일 읽기
    const fileBuffer = fs.readFileSync(filePath);
    
    // Content-Type 설정
    const contentType =
      type === "zip"
        ? "application/zip"
        : "application/pdf";

    // 파일 삭제 (다운로드 후 정리)
    try {
      fs.unlinkSync(filePath);
    } catch (deleteError) {
      // 삭제 실패해도 다운로드는 계속 진행
    }

    // 파일 응답
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[API] 파일 다운로드 에러:", error);
    return NextResponse.json(
      {
        error: "Failed to download file",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
