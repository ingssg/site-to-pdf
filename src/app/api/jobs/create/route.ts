/**
 * POST /api/jobs/create
 * 작업 등록 API
 * Vercel Hobby 플랜: 10초 내 완료 보장
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/db/supabase";
import { getErrorInfo, inferErrorCode } from "@/constants/errorMessages";
import { ErrorCode } from "@/types/errors";

// 요청 스키마 정의
const CreateJobRequestSchema = z.object({
  url: z.string().url("유효한 URL을 입력해주세요"),
  maxPages: z.number().min(1).max(200).optional().default(30),
  crawlMode: z.enum(['full', 'smart']).optional().default('smart'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 바디 파싱 및 검증
    const body = await request.json();
    const validatedData = CreateJobRequestSchema.parse(body);

    const { url, maxPages, crawlMode } = validatedData;
    const lambdaUrl = process.env.LAMBDA_FUNCTION_URL || null;

    // 2. Supabase에 작업 등록
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        status: 'pending',
        config: {
          url,
          maxPages,
          crawlMode,
          lambdaUrl,
        },
        progress: {
          current: 0,
          total: maxPages,
          message: '작업 대기 중',
          percentage: 0,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('[Jobs] Supabase 에러:', error);
      throw new Error(`작업 등록 실패: ${error.message}`);
    }

    // 3. Lambda 워커 비동기 호출 - 크롤링만 수행 (action: 'crawl')
    const lambdaUrl = process.env.LAMBDA_FUNCTION_URL;
    if (lambdaUrl) {
      fetch(lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, action: 'crawl' }),
      }).catch((error) => {
        console.error('[Jobs] Lambda 호출 실패:', error);
        // 에러가 나도 작업은 등록되었으므로 계속 진행
      });
    } else {
      console.warn('[Jobs] LAMBDA_FUNCTION_URL이 설정되지 않았습니다.');
    }

    // 4. 즉시 작업 ID 반환 (10초 내 완료 보장)
    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        message: '작업이 등록되었습니다. 워커가 처리 중입니다.',
      },
    });
  } catch (error) {
    console.error("[Jobs] 작업 등록 에러:", error);

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

// Vercel Hobby 플랜: 10초 타임아웃
export const maxDuration = 10;
