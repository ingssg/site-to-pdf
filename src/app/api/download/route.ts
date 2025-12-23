/**
 * POST /api/download
 * PDF 파일 다운로드 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const DownloadRequestSchema = z.object({
  pdfBase64: z.string(),
  filename: z.string().optional().default('website.pdf'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfBase64, filename } = DownloadRequestSchema.parse(body);

    // Base64를 Buffer로 변환
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // PDF 파일로 응답
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[API] 다운로드 에러:', error);

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

    return NextResponse.json(
      {
        success: false,
        error: '다운로드에 실패했습니다',
      },
      { status: 500 }
    );
  }
}
