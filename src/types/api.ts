/**
 * API 요청/응답 타입 정의
 */

import type { AISummary } from './index';

// POST /api/crawl 요청
export interface CrawlAPIRequest {
  url: string;
  maxPages?: number;
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
}

// POST /api/crawl 응답 (크롤링만)
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
        screenshot?: Buffer; // 스크린샷 데이터
      }>;
    };
  };
}

// POST /api/generate-pdf 요청
export interface GeneratePDFRequest {
  pages: Array<{
    url: string;
    title: string;
    content: string;
    depth: number;
    screenshot?: Buffer;
  }>;
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
}

// POST /api/generate-pdf 응답
export interface GeneratePDFResponse {
  success: true;
  data: {
    pdf: {
      totalSize: number;
      totalSizeMB: string;
      pageCount: number;
      mergedPdf: string | null; // Base64 encoded (50MB 이상일 경우 null)
      mergedPdfTooLarge?: boolean;
      individualPdfsZip: string; // Base64 encoded ZIP file
      warnings?: string[]; // 경고 메시지 (예: 폰트 파일 없음)
    };
    summary: AISummary;
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
