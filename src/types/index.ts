/**
 * SiteToPDF 프로젝트 타입 정의
 */

// 크롤링 관련 타입
export interface CrawlConfig {
  url: string;
  maxPages: number;
  maxDepth?: number;
  sameDomainOnly: boolean;
  excludePatterns?: string[];
}

export interface CrawledPage {
  url: string;
  title: string;
  content: string;
  screenshot?: Buffer;
  timestamp: Date;
  depth: number;
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
}

export interface PDFResult {
  mergedPdf: Buffer;
  individualPdfs?: Buffer[];
  tableOfContents: TableOfContentsItem[];
  totalSize: number;
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
  companyName?: string;
  overview: string;
  mainServices: string[];
  targetCustomers: string[];
  uniqueFeatures: string[];
  swotAnalysis?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  competitorAnalysis?: string;
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
