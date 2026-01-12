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
      crawlMode?: 'full' | 'smart'; // 크롤링 모드
      pages: Array<{
        url: string;
        title: string;
        content: string; // 텍스트 콘텐츠
        depth: number;
        screenshot?: Buffer | string; // 스크린샷 데이터 (viewport) - Buffer 또는 base64 string
        fullPageScreenshot?: Buffer | string; // 전체 페이지 스크린샷 (법적 증거용)
        pageSummary?: string; // 페이지별 AI 요약
        pageType?: string; // 페이지 타입
        defaultChecked?: boolean; // 기본 선택 여부
        importance?: number; // 중요도
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
      mergedPdf: string | null; // Base64 encoded (50MB 이상일 경우 null) 또는 URL (Lambda 버전)
      mergedPdfTooLarge?: boolean;
      zipDownloadUrl: string; // 개별 PDF ZIP 파일 다운로드 URL
      screenshotPdfUrl?: string | null; // 스크린샷 PDF 다운로드 URL
      warnings?: string[]; // 경고 메시지 (예: 폰트 파일 없음)
      // Lambda 버전 추가 필드
      zipSize?: number; // ZIP 파일 크기 (bytes)
      zipSizeMB?: string; // ZIP 파일 크기 (MB, 숫자만)
      individualPdfCount?: number; // 개별 PDF 파일 개수
      screenshotPdfCount?: number; // 스크린샷 PDF 개수
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
