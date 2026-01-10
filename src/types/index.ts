/**
 * SiteToPDF 프로젝트 타입 정의
 */

// 크롤링 관련 타입
export type CrawlMode = 'full' | 'smart';

export interface CrawlConfig {
  url: string;
  maxPages: number;
  maxDepth?: number;
  sameDomainOnly: boolean;
  excludePatterns?: string[];
  crawlMode?: CrawlMode; // 'full': 전체 크롤링 (법적 증거), 'smart': 스마트 모드 (비즈니스 분석)
}

export interface CrawledPage {
  url: string;
  title: string;
  content: string;
  screenshot?: Buffer; // 페이지 스크린샷 1920x1080 viewport (전체 웹사이트 PDF용)
  fullPageScreenshot?: Buffer; // 전체 페이지 스크린샷 (원본 스크린샷 PDF용 - 법적 증거)
  pageSummary?: string; // 페이지별 AI 요약 (3-4줄)
  timestamp: Date;
  depth: number;
  // 필터링 관련 필드
  defaultChecked?: boolean; // 기본 체크 상태 (true = 추천, false = 선택사항)
  importance?: number; // 중요도 점수 (0-100)
  exclusionReason?: string; // 체크 해제 이유 (예: "로그인 페이지", "약관 페이지")
  pageType?: string; // 페이지 타입 (예: "Homepage", "Product", "Contact")
}

export interface CrawlResult {
  pages: CrawledPage[];
  totalPages: number;
  failedUrls: string[];
  startTime: Date;
  endTime: Date;
}

// PDF 관련 타입
export interface PDFGenerationOptions {
  includeTableOfContents: boolean;
  pageSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  quality?: 'low' | 'medium' | 'high';
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
  crawlMode?: CrawlMode; // 크롤링 모드 (스크린샷 PDF 생성에 영향)
}

export interface PDFResult {
  mergedPdf: Buffer;
  individualPdfs?: Buffer[];
  tableOfContents: TableOfContentsItem[];
  totalSize: number;
  warnings?: string[]; // 경고 메시지 (예: 폰트 파일 없음)
  screenshotPdf?: Buffer; // 스크린샷 전용 PDF
}

export interface TableOfContentsItem {
  title: string;
  url: string;
  pageNumber: number;
}

// AI 요약 관련 타입
export interface AISummaryRequest {
  content: string;
  url: string;
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
}

export interface AISummary {
  // 웹사이트 기본 정보
  websiteType: string; // SaaS, 이커머스, 블로그, 뉴스, 커뮤니티, 포트폴리오, 기업소개 등
  companyName?: string;
  oneLineSummary: string; // 핵심 가치 제안 (30자 이내)
  overview: string; // 상세 설명

  // 비즈니스 모델
  businessModel?: {
    type: string; // B2B, B2C, B2B2C, C2C 등
    revenueModel?: string; // 구독, 일회성, 광고, 프리미엄, 커미션 등
    priceRange?: string; // 가격대 (무료, 저가, 중가, 고가)
  };

  // 핵심 정보
  problemSolved: string; // 해결하는 문제
  mainServices: string[]; // 주요 서비스/제품
  targetCustomers: string[]; // 타겟 고객 (구체적 페르소나)
  uniqueFeatures: string[]; // 차별화 요소

  // 심화 분석 (detailed, comprehensive)
  keyStrengths?: string[]; // 강점 3가지 (구체적 근거 포함)
  growthOpportunities?: string[]; // 성장 가능성 3가지 (투자자/파트너 관점)
  competitorAnalysis?: string; // 경쟁사 분석 및 시장 포지셔닝

  // 실행 인사이트 (comprehensive)
  actionableInsights?: string[]; // 추천 액션 아이템
  marketOpportunity?: string; // 시장 기회
}

// Job/Task 관련 타입
export interface CrawlJob {
  id: string;
  userId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  config: CrawlConfig;
  result?: CrawlResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// 사용자 플랜 타입
export type UserPlan = 'free' | 'pro' | 'business' | 'enterprise';

export interface UserQuota {
  plan: UserPlan;
  monthlyLimit: number;
  usedThisMonth: number;
  maxPagesPerCrawl: number;
}
