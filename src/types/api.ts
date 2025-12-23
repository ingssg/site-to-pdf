/**
 * API 요청/응답 타입 정의
 */

import type { AISummary } from './index';

// POST /api/crawl 요청
export interface CrawlAPIRequest {
  url: string;
  maxPages?: number;
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
  includePDF?: boolean;
  includeAI?: boolean;
}

// POST /api/crawl 응답
export interface CrawlAPIResponse {
  success: true;
  data: {
    crawl: {
      totalPages: number;
      failedUrls: string[];
      duration: string;
    };
    pdf: {
      totalSize: number;
      totalSizeMB: string;
      pageCount: number;
      mergedPdf: string; // Base64 encoded
    } | null;
    summary: AISummary | null;
  };
}

// API 에러 응답
export interface APIErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

// POST /api/download 요청
export interface DownloadAPIRequest {
  pdfBase64: string;
  filename?: string;
}
