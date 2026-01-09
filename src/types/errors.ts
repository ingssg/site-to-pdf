/**
 * 에러 타입 및 코드 정의
 */

// 에러 카테고리
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',      // 입력 검증 에러
  NETWORK = 'NETWORK',            // 네트워크 에러
  CRAWLING = 'CRAWLING',          // 크롤링 에러
  PDF_GENERATION = 'PDF_GENERATION', // PDF 생성 에러
  FILE_OPERATION = 'FILE_OPERATION', // 파일 다운로드 에러
  AI_SERVICE = 'AI_SERVICE',      // AI 서비스 에러
  SYSTEM = 'SYSTEM',              // 시스템 에러
}

// 에러 코드
export enum ErrorCode {
  // Validation (1000번대)
  INVALID_URL = 'INVALID_URL',
  INVALID_PAGE_COUNT = 'INVALID_PAGE_COUNT',
  NO_PAGES_SELECTED = 'NO_PAGES_SELECTED',

  // Network (2000번대)
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',

  // Crawling (3000번대)
  CRAWL_BLOCKED_BY_ROBOTS = 'CRAWL_BLOCKED_BY_ROBOTS',
  CRAWL_NO_PAGES_FOUND = 'CRAWL_NO_PAGES_FOUND',
  CRAWL_TIMEOUT = 'CRAWL_TIMEOUT',
  CRAWL_CAPTCHA_DETECTED = 'CRAWL_CAPTCHA_DETECTED',

  // PDF Generation (4000번대)
  PDF_SIZE_TOO_LARGE = 'PDF_SIZE_TOO_LARGE',
  PDF_GENERATION_FAILED = 'PDF_GENERATION_FAILED',
  AI_SUMMARY_FAILED = 'AI_SUMMARY_FAILED',

  // File Operation (5000번대)
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  // AI Service (6000번대)
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  AI_RATE_LIMIT = 'AI_RATE_LIMIT',

  // System (9000번대)
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// 에러 세부 정보
export interface AppError {
  category: ErrorCategory;
  code: ErrorCode;
  message: string;
  userMessage: string;      // 사용자에게 표시할 메시지
  helpText?: string[];      // 문제 해결 도움말
  retryable: boolean;       // 재시도 가능 여부
  technicalDetails?: string; // 기술적 세부 정보 (로깅용)
}

// API 에러 응답 타입
export interface EnhancedAPIErrorResponse {
  success: false;
  error: AppError;
  timestamp: string;
}
