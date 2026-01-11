/**
 * GET /api/jobs/[id]/status
 * 작업 상태 확인 API
 * Vercel Hobby 플랜: 10초 내 완료 보장
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { getErrorInfo, inferErrorCode } from "@/constants/errorMessages";
import { ErrorCode } from "@/types/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error: getErrorInfo(ErrorCode.INVALID_URL, "작업 ID가 필요합니다"),
        },
        { status: 400 }
      );
    }

    // Supabase에서 작업 상태 조회
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('[Jobs] Supabase 에러:', error);
      
      if (error.code === 'PGRST116') {
        // 작업을 찾을 수 없음
        return NextResponse.json(
          {
            success: false,
            error: getErrorInfo(ErrorCode.UNKNOWN_ERROR, "작업을 찾을 수 없습니다"),
          },
          { status: 404 }
        );
      }

      throw new Error(`작업 상태 조회 실패: ${error.message}`);
    }

    // 작업 상태 반환
    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at,
      },
    });
  } catch (error) {
    console.error("[Jobs] 작업 상태 조회 에러:", error);

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

// Vercel Hobby 플랜: 10초 타임아웃
export const maxDuration = 10;
