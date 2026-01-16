/**
 * POST /api/jobs/[id]/generate-pdf
 * 선택된 페이지로 PDF 생성 트리거
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/db/supabase";
import { getErrorInfo, inferErrorCode } from "@/constants/errorMessages";
import { ErrorCode } from "@/types/errors";

// 요청 스키마 정의
const GeneratePDFRequestSchema = z.object({
  selectedPages: z.array(z.string()).optional().default([]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    // 1. 요청 바디 파싱 및 검증
    const body = await request.json();
    const validatedData = GeneratePDFRequestSchema.parse(body);
    const { selectedPages } = validatedData;

    // 2. 작업 상태 확인
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json(
        {
          success: false,
          error: { userMessage: '작업을 찾을 수 없습니다.' },
        },
        { status: 404 }
      );
    }

    // 크롤링 완료 상태인지 확인
    if (!['crawl_completed', 'page_selected'].includes(job.status)) {
      const errorMessage = `PDF 생성은 크롤링 완료 후에만 가능합니다. 현재 상태: ${job.status}`;
      return NextResponse.json(
        {
          success: false,
          error: {
            ...getErrorInfo(ErrorCode.CRAWL_NOT_COMPLETED, errorMessage),
          },
        },
        { status: 400 }
      );
    }

    // 3. 선택된 페이지 저장 및 상태 업데이트
    // selected_pages는 result JSONB 필드 안에 저장
    const currentResult = job.result || {};
    const updatedResult = {
      ...currentResult,
      selectedPages: selectedPages,
    };

    const updateData = {
      status: 'page_selected',
      result: updatedResult,
    };

    const { error: updateError } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId);

    if (updateError) {
      console.error('[Jobs] 페이지 선택 저장 실패:', updateError);
      console.error('[Jobs] 업데이트 데이터:', JSON.stringify(updateData, null, 2));
      console.error('[Jobs] 현재 작업 상태:', job.status);
      console.error('[Jobs] 현재 result:', JSON.stringify(job.result, null, 2));
      throw new Error(`페이지 선택 저장 실패: ${updateError.message} (코드: ${updateError.code})`);
    }

    // 4. Lambda 워커 비동기 호출 - PDF 생성 (action: 'generate-pdf')
    const lambdaUrl = process.env.LAMBDA_FUNCTION_URL;
    if (lambdaUrl) {
      fetch(lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, action: 'generate-pdf' }),
      }).catch((error) => {
        console.error('[Jobs] Lambda 호출 실패:', error);
      });
    } else {
      console.warn('[Jobs] LAMBDA_FUNCTION_URL이 설정되지 않았습니다.');
    }

    // 5. 즉시 응답
    return NextResponse.json({
      success: true,
      data: {
        jobId,
        status: 'page_selected',
        message: 'PDF 생성을 시작합니다.',
        selectedCount: selectedPages.length || job.result?.crawlResult?.totalPages || 0,
      },
    });
  } catch (error) {
    console.error("[Jobs] PDF 생성 트리거 에러:", error);

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

export const maxDuration = 10;
