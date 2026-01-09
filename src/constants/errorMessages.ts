/**
 * 에러 메시지 및 도움말 상수
 */

import { ErrorCode, ErrorCategory, type AppError } from '@/types/errors';

// ErrorCode를 re-export하여 다른 파일에서 쉽게 import 가능하도록 함
export { ErrorCode, ErrorCategory, type AppError } from '@/types/errors';

export const ERROR_MESSAGES: Record<ErrorCode, Omit<AppError, 'technicalDetails'>> = {
  // Validation Errors
  [ErrorCode.INVALID_URL]: {
    category: ErrorCategory.VALIDATION,
    code: ErrorCode.INVALID_URL,
    message: 'Invalid URL format',
    userMessage: '올바른 URL 형식이 아닙니다',
    helpText: [
      'URL이 https:// 또는 http://로 시작하는지 확인하세요',
      '예시: https://example.com',
      '공백이나 특수문자가 포함되지 않았는지 확인하세요',
    ],
    retryable: true,
  },

  [ErrorCode.INVALID_PAGE_COUNT]: {
    category: ErrorCategory.VALIDATION,
    code: ErrorCode.INVALID_PAGE_COUNT,
    message: 'Invalid page count',
    userMessage: '페이지 수가 유효하지 않습니다',
    helpText: [
      '1~50페이지 사이의 값을 선택해주세요',
      '무료 버전은 최대 50페이지까지 지원합니다',
    ],
    retryable: true,
  },

  [ErrorCode.NO_PAGES_SELECTED]: {
    category: ErrorCategory.VALIDATION,
    code: ErrorCode.NO_PAGES_SELECTED,
    message: 'No pages selected',
    userMessage: '선택된 페이지가 없습니다',
    helpText: [
      '최소 1개 이상의 페이지를 선택해주세요',
    ],
    retryable: true,
  },

  // Network Errors
  [ErrorCode.NETWORK_TIMEOUT]: {
    category: ErrorCategory.NETWORK,
    code: ErrorCode.NETWORK_TIMEOUT,
    message: 'Network timeout',
    userMessage: '네트워크 연결 시간이 초과되었습니다',
    helpText: [
      '인터넷 연결을 확인해주세요',
      '웹사이트가 응답하지 않을 수 있습니다',
      '잠시 후 다시 시도해주세요',
    ],
    retryable: true,
  },

  [ErrorCode.NETWORK_UNREACHABLE]: {
    category: ErrorCategory.NETWORK,
    code: ErrorCode.NETWORK_UNREACHABLE,
    message: 'Network unreachable',
    userMessage: '웹사이트에 접근할 수 없습니다',
    helpText: [
      '웹사이트가 정상적으로 작동하는지 확인해주세요',
      'VPN을 사용 중이라면 잠시 해제 후 시도해주세요',
      '방화벽 설정을 확인해주세요',
    ],
    retryable: true,
  },

  [ErrorCode.DNS_RESOLUTION_FAILED]: {
    category: ErrorCategory.NETWORK,
    code: ErrorCode.DNS_RESOLUTION_FAILED,
    message: 'DNS resolution failed',
    userMessage: '도메인을 찾을 수 없습니다',
    helpText: [
      'URL 철자를 다시 확인해주세요',
      '웹사이트가 존재하는지 확인해주세요',
      'DNS 서버가 정상 작동하는지 확인해주세요',
    ],
    retryable: true,
  },

  // Crawling Errors
  [ErrorCode.CRAWL_BLOCKED_BY_ROBOTS]: {
    category: ErrorCategory.CRAWLING,
    code: ErrorCode.CRAWL_BLOCKED_BY_ROBOTS,
    message: 'Crawling blocked by robots.txt',
    userMessage: '웹사이트가 크롤링을 차단했습니다',
    helpText: [
      '해당 웹사이트는 robots.txt로 자동 수집을 차단합니다',
      '웹사이트 관리자에게 문의하거나',
      '다른 웹사이트로 시도해주세요',
    ],
    retryable: false,
  },

  [ErrorCode.CRAWL_NO_PAGES_FOUND]: {
    category: ErrorCategory.CRAWLING,
    code: ErrorCode.CRAWL_NO_PAGES_FOUND,
    message: 'No pages found',
    userMessage: '수집할 페이지를 찾을 수 없습니다',
    helpText: [
      'URL이 올바른지 확인해주세요',
      '웹사이트가 정상적으로 로드되는지 확인해주세요',
      '로그인이 필요한 페이지인지 확인해주세요',
    ],
    retryable: true,
  },

  [ErrorCode.CRAWL_TIMEOUT]: {
    category: ErrorCategory.CRAWLING,
    code: ErrorCode.CRAWL_TIMEOUT,
    message: 'Crawling timeout',
    userMessage: '크롤링 시간이 초과되었습니다',
    helpText: [
      '웹사이트 응답이 느릴 수 있습니다',
      '페이지 수를 줄여서 다시 시도해주세요 (10-20페이지 권장)',
      '잠시 후 다시 시도해주세요',
    ],
    retryable: true,
  },

  [ErrorCode.CRAWL_CAPTCHA_DETECTED]: {
    category: ErrorCategory.CRAWLING,
    code: ErrorCode.CRAWL_CAPTCHA_DETECTED,
    message: 'CAPTCHA detected',
    userMessage: '웹사이트에서 보안 검증을 요구합니다',
    helpText: [
      '해당 웹사이트는 자동 접근을 차단합니다',
      '다른 웹사이트로 시도하거나',
      '잠시 후 다시 시도해주세요',
    ],
    retryable: false,
  },

  // PDF Generation Errors
  [ErrorCode.PDF_SIZE_TOO_LARGE]: {
    category: ErrorCategory.PDF_GENERATION,
    code: ErrorCode.PDF_SIZE_TOO_LARGE,
    message: 'PDF size too large',
    userMessage: 'PDF 파일 크기가 너무 큽니다',
    helpText: [
      '선택한 페이지 수를 줄여주세요',
      '개별 PDF ZIP 다운로드를 이용해주세요',
      '통합 PDF는 50MB 이하로 제한됩니다',
    ],
    retryable: false,
  },

  [ErrorCode.PDF_GENERATION_FAILED]: {
    category: ErrorCategory.PDF_GENERATION,
    code: ErrorCode.PDF_GENERATION_FAILED,
    message: 'PDF generation failed',
    userMessage: 'PDF 생성에 실패했습니다',
    helpText: [
      '크롤링한 데이터는 보존되어 있습니다',
      '다시 시도 버튼을 눌러주세요 (크롤링 없이 PDF만 재생성)',
      '문제가 지속되면 고객센터로 문의해주세요',
    ],
    retryable: true,
  },

  [ErrorCode.AI_SUMMARY_FAILED]: {
    category: ErrorCategory.PDF_GENERATION,
    code: ErrorCode.AI_SUMMARY_FAILED,
    message: 'AI summary generation failed',
    userMessage: 'AI 요약 생성에 실패했습니다',
    helpText: [
      'AI 요약 없이 PDF를 생성할 수 있습니다',
      '잠시 후 다시 시도해주세요',
      '서비스가 일시적으로 과부하 상태일 수 있습니다',
    ],
    retryable: true,
  },

  // File Operation Errors
  [ErrorCode.DOWNLOAD_FAILED]: {
    category: ErrorCategory.FILE_OPERATION,
    code: ErrorCode.DOWNLOAD_FAILED,
    message: 'Download failed',
    userMessage: '다운로드에 실패했습니다',
    helpText: [
      '브라우저 팝업 차단을 해제해주세요',
      '디스크 용량을 확인해주세요',
      '다시 시도해주세요',
    ],
    retryable: true,
  },

  [ErrorCode.FILE_TOO_LARGE]: {
    category: ErrorCategory.FILE_OPERATION,
    code: ErrorCode.FILE_TOO_LARGE,
    message: 'File too large',
    userMessage: '파일 크기가 너무 큽니다',
    helpText: [
      '개별 PDF ZIP 다운로드를 이용해주세요',
      '선택한 페이지 수를 줄여주세요',
    ],
    retryable: false,
  },

  // AI Service Errors
  [ErrorCode.AI_SERVICE_UNAVAILABLE]: {
    category: ErrorCategory.AI_SERVICE,
    code: ErrorCode.AI_SERVICE_UNAVAILABLE,
    message: 'AI service unavailable',
    userMessage: 'AI 서비스를 사용할 수 없습니다',
    helpText: [
      'AI 요약 없이 PDF를 생성할 수 있습니다',
      '잠시 후 다시 시도해주세요',
      'Claude API 서비스 상태를 확인해주세요',
    ],
    retryable: true,
  },

  [ErrorCode.AI_RATE_LIMIT]: {
    category: ErrorCategory.AI_SERVICE,
    code: ErrorCode.AI_RATE_LIMIT,
    message: 'AI rate limit exceeded',
    userMessage: 'AI 요청 한도를 초과했습니다',
    helpText: [
      '잠시 후 다시 시도해주세요 (1-2분 대기)',
      'AI 요약 없이 PDF를 생성할 수 있습니다',
    ],
    retryable: true,
  },

  // System Errors
  [ErrorCode.UNKNOWN_ERROR]: {
    category: ErrorCategory.SYSTEM,
    code: ErrorCode.UNKNOWN_ERROR,
    message: 'Unknown error occurred',
    userMessage: '알 수 없는 오류가 발생했습니다',
    helpText: [
      '잠시 후 다시 시도해주세요',
      '문제가 지속되면 고객센터로 문의해주세요',
      '브라우저를 새로고침 해보세요',
    ],
    retryable: true,
  },
};

// 에러 코드로 에러 정보 가져오기
export function getErrorInfo(code: ErrorCode, technicalDetails?: string): AppError {
  const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
  return {
    ...errorInfo,
    technicalDetails,
  };
}

// 에러 메시지에서 에러 코드 추론 (기존 에러 메시지 호환성)
export function inferErrorCode(message: string): ErrorCode {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('url') && (lowerMessage.includes('유효') || lowerMessage.includes('invalid'))) {
    return ErrorCode.INVALID_URL;
  }
  if (lowerMessage.includes('robots.txt') || lowerMessage.includes('차단')) {
    return ErrorCode.CRAWL_BLOCKED_BY_ROBOTS;
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('시간') || lowerMessage.includes('초과')) {
    return ErrorCode.NETWORK_TIMEOUT;
  }
  if (lowerMessage.includes('pdf') && lowerMessage.includes('실패')) {
    return ErrorCode.PDF_GENERATION_FAILED;
  }
  if (lowerMessage.includes('다운로드')) {
    return ErrorCode.DOWNLOAD_FAILED;
  }
  if (lowerMessage.includes('dns') || lowerMessage.includes('도메인')) {
    return ErrorCode.DNS_RESOLUTION_FAILED;
  }
  if (lowerMessage.includes('captcha')) {
    return ErrorCode.CRAWL_CAPTCHA_DETECTED;
  }
  if (lowerMessage.includes('크롤링') && lowerMessage.includes('실패')) {
    return ErrorCode.CRAWL_NO_PAGES_FOUND;
  }

  return ErrorCode.UNKNOWN_ERROR;
}
