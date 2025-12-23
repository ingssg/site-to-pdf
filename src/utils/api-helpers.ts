/**
 * API 헬퍼 함수들
 */

import { NextResponse } from 'next/server';
import type { APIErrorResponse } from '@/types/api';

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
  error: string,
  status: number = 500,
  details?: unknown
): NextResponse<APIErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * 유효하지 않은 메서드 응답
 */
export function methodNotAllowedResponse(allowedMethods: string[]) {
  return NextResponse.json(
    {
      success: false,
      error: `허용되지 않는 메서드입니다. 허용된 메서드: ${allowedMethods.join(', ')}`,
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
  return NextResponse.json(
    {
      success: false,
      error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
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
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 401 }
  );
}
