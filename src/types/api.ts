/**
 * API 요청/응답 타입 정의
 */

import type { AISummary } from './index';

// 크롤링 모드
export type CrawlMode = 'fast' | 'standard' | 'archive';

// POST /api/crawl 요청
export interface CrawlAPIRequest {
  url: string;
  maxPages?: number;
  mode?: CrawlMode; // 크롤링 모드 (기본값: archive)
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
      pages: Array<{
        url: string;
        title: string;
        content: string; // 텍스트 콘텐츠
        depth: number;
      }>;
    };
    pdf: {
      totalSize: number;
      totalSizeMB: string;
      pageCount: number;
      mergedPdf: string; // Base64 encoded
      individualPdfsZip: string; // Base64 encoded ZIP file
      warnings?: string[]; // 경고 메시지 (예: 폰트 파일 없음)
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
