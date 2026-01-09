/**
 * API 헬퍼 함수들
 */

import { NextResponse } from 'next/server';
import type { APIErrorResponse } from '@/types/api';
import type { AppError } from '@/types/errors';
import { ErrorCode, getErrorInfo, inferErrorCode } from '@/constants/errorMessages';

/**
 * 성공 응답 생성
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * 에러 응답 생성
 */
export function errorResponse(
  error: string | AppError,
  status: number = 500
): NextResponse<APIErrorResponse> {
  const errorData = typeof error === 'string'
    ? getErrorInfo(inferErrorCode(error), error)
    : error;

  const response: APIErrorResponse = {
    success: false,
    error: errorData,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status });
}

/**
 * 유효하지 않은 메서드 응답
 */
export function methodNotAllowedResponse(allowedMethods: string[]) {
  const errorData = getErrorInfo(
    ErrorCode.UNKNOWN_ERROR,
    `허용되지 않는 메서드입니다. 허용된 메서드: ${allowedMethods.join(', ')}`
  );

  return NextResponse.json(
    {
      success: false,
      error: errorData,
      timestamp: new Date().toISOString(),
    },
    {
      status: 405,
      headers: {
        Allow: allowedMethods.join(', '),
      },
    }
  );
}

/**
 * Rate Limit 초과 응답
 */
export function rateLimitResponse(retryAfter: number = 60) {
  const errorData = getErrorInfo(ErrorCode.AI_RATE_LIMIT);

  return NextResponse.json(
    {
      success: false,
      error: errorData,
      timestamp: new Date().toISOString(),
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}

/**
 * 인증 필요 응답
 */
export function unauthorizedResponse(message: string = '인증이 필요합니다') {
  const errorData = getErrorInfo(ErrorCode.UNKNOWN_ERROR, message);

  return NextResponse.json(
    {
      success: false,
      error: errorData,
      timestamp: new Date().toISOString(),
    },
    { status: 401 }
  );
}
