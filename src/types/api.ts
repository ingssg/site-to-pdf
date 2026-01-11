/**
 * API 요청/응답 타입 정의
 */

import type { AISummary } from './index';
import type { AppError } from './errors';

// POST /api/crawl 요청
export interface CrawlAPIRequest {
  url: string;
  maxPages?: number;
  crawlMode?: 'full' | 'smart'; // 크롤링 모드
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
        screenshot?: Buffer; // 스크린샷 데이터 (viewport)
        fullPageScreenshot?: Buffer; // 전체 페이지 스크린샷 (법적 증거용)
        pageSummary?: string; // 페이지별 AI 요약
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
    fullPageScreenshot?: Buffer; // 전체 페이지 스크린샷 (법적 증거용)
    pageSummary?: string; // 페이지별 AI 요약
  }>;
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
  crawlMode?: 'full' | 'smart'; // 크롤링 모드
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
      zipDownloadUrl: string; // 개별 PDF ZIP 파일 다운로드 URL
      screenshotPdfUrl?: string | null; // 스크린샷 PDF 다운로드 URL
      warnings?: string[]; // 경고 메시지 (예: 폰트 파일 없음)
    };
    summary: AISummary;
  };
}

// API 에러 응답
export interface APIErrorResponse {
  success: false;
  error: AppError;
  timestamp: string;
}

// POST /api/download 요청
export interface DownloadAPIRequest {
  pdfBase64: string;
  filename?: string;
}

// POST /api/ai-filter 요청
export interface AIFilterRequest {
  pages: Array<{
    url: string;
    title: string;
    content: string;
    pageType?: string;
    importance?: number;
  }>;
}

// POST /api/ai-filter 응답
export interface AIFilterResponse {
  success: true;
  data: {
    selectedUrls: string[];
    reasoning: string;
    processedCount: number;
  };
}
