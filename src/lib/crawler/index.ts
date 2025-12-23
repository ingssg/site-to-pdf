/**
 * 웹사이트 크롤러
 * Playwright를 사용하여 웹사이트를 재귀적으로 크롤링
 */

import { chromium, Browser, Page } from 'playwright';
import type { CrawlConfig, CrawledPage, CrawlResult } from '@/types';

export class WebCrawler {
  private browser: Browser | null = null;
  private visitedUrls: Set<string> = new Set();
  private crawledPages: CrawledPage[] = [];
  private config: CrawlConfig;

  constructor(config: CrawlConfig) {
    this.config = config;
  }

  /**
   * 크롤링 시작
   */
  async crawl(): Promise<CrawlResult> {
    const startTime = new Date();
    const failedUrls: string[] = [];

    try {
      // Playwright 브라우저 실행
      this.browser = await chromium.launch({
        headless: true,
      });

      // 시작 URL부터 크롤링
      await this.crawlPage(this.config.url, 0);

      const endTime = new Date();

      return {
        pages: this.crawledPages,
        totalPages: this.crawledPages.length,
        failedUrls,
        startTime,
        endTime,
      };
    } catch (error) {
      console.error('Crawl error:', error);
      throw error;
    } finally {
      await this.close();
    }
  }

  /**
   * 개별 페이지 크롤링 (재귀)
   */
  private async crawlPage(url: string, depth: number): Promise<void> {
    // 이미 방문했거나, 최대 페이지 수 도달 시 중단
    if (
      this.visitedUrls.has(url) ||
      this.crawledPages.length >= this.config.maxPages ||
      (this.config.maxDepth && depth > this.config.maxDepth)
    ) {
      return;
    }

    // 같은 도메인만 크롤링
    if (this.config.sameDomainOnly && !this.isSameDomain(url)) {
      return;
    }

    this.visitedUrls.add(url);

    try {
      const page = await this.browser!.newPage();

      // 페이지 로드 (네트워크 idle 대기)
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // 페이지 정보 추출
      const title = await page.title();
      const content = await page.textContent('body');
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
      });

      // 크롤링된 페이지 저장
      this.crawledPages.push({
        url,
        title,
        content: content || '',
        screenshot,
        timestamp: new Date(),
        depth,
      });

      // 페이지 내 링크 추출
      const links = await this.extractLinks(page);

      await page.close();

      // 재귀적으로 링크 크롤링
      for (const link of links) {
        if (this.crawledPages.length < this.config.maxPages) {
          await this.crawlPage(link, depth + 1);
        }
      }
    } catch (error) {
      console.error(`Failed to crawl ${url}:`, error);
    }
  }

  /**
   * 페이지에서 링크 추출
   */
  private async extractLinks(page: Page): Promise<string[]> {
    const links = await page.$$eval('a[href]', (anchors) =>
      anchors.map((a) => (a as HTMLAnchorElement).href)
    );

    // 중복 제거 및 필터링
    return [...new Set(links)].filter((link) => {
      try {
        const url = new URL(link);
        // http/https만 허용
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    });
  }

  /**
   * 같은 도메인인지 확인
   */
  private isSameDomain(url: string): boolean {
    try {
      const baseUrl = new URL(this.config.url);
      const targetUrl = new URL(url);
      return baseUrl.hostname === targetUrl.hostname;
    } catch {
      return false;
    }
  }

  /**
   * 브라우저 종료
   */
  private async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * 크롤링 헬퍼 함수
 */
export async function crawlWebsite(
  config: CrawlConfig
): Promise<CrawlResult> {
  const crawler = new WebCrawler(config);
  return await crawler.crawl();
}
