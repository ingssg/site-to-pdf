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
   * URL 정규화 (쿼리, 해시 제거 및 trailing slash 통일)
   */
  private normalizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      let hostname = parsedUrl.hostname;

      // www 제거 (www.naver.com과 naver.com을 같은 것으로 처리)
      if (hostname.startsWith('www.')) {
        hostname = hostname.slice(4);
      }

      const normalizedOrigin = `${parsedUrl.protocol}//${hostname}${parsedUrl.port ? ':' + parsedUrl.port : ''}`;
      // 쿼리 파라미터와 해시 제거, trailing slash 제거
      return normalizedOrigin + parsedUrl.pathname.replace(/\/$/, '');
    } catch {
      return url;
    }
  }

  /**
   * 개별 페이지 크롤링 (재귀)
   */
  private async crawlPage(url: string, depth: number): Promise<void> {
    const normalizedUrl = this.normalizeUrl(url);

    // 이미 방문했거나, 최대 페이지 수 도달 시 중단
    if (
      this.visitedUrls.has(normalizedUrl) ||
      this.crawledPages.length >= this.config.maxPages ||
      (this.config.maxDepth && depth > this.config.maxDepth)
    ) {
      return;
    }

    // 같은 도메인만 크롤링
    if (this.config.sameDomainOnly && !this.isSameDomain(url)) {
      return;
    }

    this.visitedUrls.add(normalizedUrl);
    console.log(`[Crawler] Crawling (${this.crawledPages.length + 1}/${this.config.maxPages}): ${url}`);

    try {
      const page = await this.browser!.newPage();

      // 페이지 로드 (더 빠른 타임아웃)
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      // 조금 더 기다려서 동적 콘텐츠 로딩
      await page.waitForTimeout(1000);

      // 페이지 정보 추출
      const title = await page.title();
      const content = await page.textContent('body');

      // 모드에 따라 스크린샷 생성 여부 결정
      // fast, standard: 스크린샷 없음 (텍스트만)
      // archive: 스크린샷 포함
      const mode = this.config.mode || 'archive';
      let screenshot: Buffer | undefined;

      if (mode === 'archive') {
        screenshot = await page.screenshot({
          fullPage: true,
          type: 'png',
        });
        console.log(`[Crawler] Screenshot captured for ${url}`);
      } else {
        console.log(`[Crawler] Skipping screenshot (${mode} mode) for ${url}`);
      }

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

      // 같은 도메인 링크만 필터링
      const sameDomainLinks = links.filter((link) => this.isSameDomain(link));

      console.log(
        `[Crawler] Found ${links.length} links on ${url} (${sameDomainLinks.length} same domain)`
      );

      // 재귀적으로 링크 크롤링
      for (const link of sameDomainLinks) {
        if (this.crawledPages.length < this.config.maxPages) {
          await this.crawlPage(link, depth + 1);
        } else {
          break;
        }
      }
    } catch (error) {
      console.error(`[Crawler] Failed to crawl ${url}:`, error);
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
   * 같은 도메인인지 확인 (서브도메인 포함)
   */
  private isSameDomain(url: string): boolean {
    try {
      const baseUrl = new URL(this.config.url);
      const targetUrl = new URL(url);

      // 루트 도메인 추출 (예: www.naver.com → naver.com, news.naver.com → naver.com)
      const getRootDomain = (hostname: string): string => {
        const parts = hostname.split('.');
        if (parts.length >= 2) {
          // 마지막 2개 부분만 (domain.com)
          return parts.slice(-2).join('.');
        }
        return hostname;
      };

      const baseDomain = getRootDomain(baseUrl.hostname);
      const targetDomain = getRootDomain(targetUrl.hostname);

      return baseDomain === targetDomain;
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
