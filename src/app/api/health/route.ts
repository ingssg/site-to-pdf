/**
 * GET /api/health
 * 서버 상태 체크 API
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'SiteToPDF API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}
