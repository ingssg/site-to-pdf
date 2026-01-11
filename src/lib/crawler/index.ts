/**
 * 웹사이트 크롤러
 * Playwright를 사용하여 웹사이트를 재귀적으로 크롤링
 */

import { chromium, Browser, Page } from 'playwright';
import type { CrawlConfig, CrawledPage, CrawlResult } from '@/types';
import { shouldExcludeByDefault } from './page-filter';

export class WebCrawler {
  private browser: Browser | null = null;
  private visitedUrls: Set<string> = new Set();
  private crawledPages: CrawledPage[] = [];
  private config: CrawlConfig;
  private onProgress?: (current: number, total: number, url: string) => void;
  private skippedUrls: Set<string> = new Set(); // 스마트 모드에서 제외된 URL 추적
  private readonly CONCURRENT_LIMIT = 5; // 동시에 5개 페이지 크롤링

  constructor(config: CrawlConfig, onProgress?: (current: number, total: number, url: string) => void) {
    this.config = config;
    this.onProgress = onProgress;
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

      // 스마트 모드 통계 출력
      if (this.config.crawlMode === 'smart' && this.skippedUrls.size > 0) {
        console.log(`[Crawler] 🎯 Smart Mode: Skipped ${this.skippedUrls.size} filtered URLs, Crawled ${this.crawledPages.length} important pages`);
      }

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

    // 스마트 모드: 명백히 불필요한 페이지만 제외 (보수적 접근)
    if (this.config.crawlMode === 'smart' && shouldExcludeByDefault(url)) {
      this.skippedUrls.add(normalizedUrl);
      console.log(`[Crawler] 🚫 Skipped (Smart Mode): ${url}`);
      return;
    }

    this.visitedUrls.add(normalizedUrl);
    console.log(`[Crawler] Crawling (${this.crawledPages.length + 1}/${this.config.maxPages}): ${url}`);

    try {
      const page = await this.browser!.newPage();

      // 페이지 로드 (DOM 로드만 대기 - 속도 최적화)
      await page.goto(url, {
        waitUntil: 'domcontentloaded',  // networkidle → domcontentloaded (빠른 로딩)
        timeout: 15000,  // 15초 타임아웃
      });

      // 짧은 대기 (렌더링 안정화)
      await page.waitForTimeout(500);  // 0.5초만

      // 페이지 정보 추출
      const title = await page.title();

      // HTML 태그를 제거하고 깔끔한 텍스트만 추출
      const content = await page.evaluate(() => {
        // 불필요한 요소 제거
        const unwantedSelectors = [
          'script',
          'style',
          'noscript',
          'iframe',
          'svg',
          'path',
          'img',
          'video',
          'audio',
          'canvas',
          'nav',
          'footer',
          'header[role="banner"]',
          '.ad',
          '.advertisement',
          '[class*="cookie"]',
          '[class*="popup"]',
          '[class*="modal"]',
        ];

        // body 클론 생성
        const bodyClone = document.body.cloneNode(true) as HTMLElement;

        // 불필요한 요소 제거
        unwantedSelectors.forEach((selector) => {
          bodyClone.querySelectorAll(selector).forEach((el) => el.remove());
        });

        // 블록 레벨 요소들을 순회하며 텍스트 추출
        const blockElements = bodyClone.querySelectorAll(
          'p, h1, h2, h3, h4, h5, h6, div, section, article, li, td, th, blockquote, pre'
        );

        const textParts: string[] = [];
        const processedElements = new Set<Element>();

        // 각 블록 요소의 텍스트 추출
        blockElements.forEach((el) => {
          // 이미 처리된 요소나 그 자식이면 스킵
          if (processedElements.has(el)) return;

          const text = (el as HTMLElement).innerText?.trim();
          if (text && text.length > 0) {
            textParts.push(text);

            // 이 요소의 모든 자식도 처리됨으로 표시
            el.querySelectorAll('*').forEach((child) => {
              processedElements.add(child);
            });
            processedElements.add(el);
          }
        });

        // 텍스트 조합
        let fullText = textParts.join('\n\n');

        // 연속된 공백을 하나로
        fullText = fullText.replace(/[ \t]+/g, ' ');

        // 연속된 줄바꿈을 최대 2개로
        fullText = fullText.replace(/\n{3,}/g, '\n\n');

        // 앞뒤 공백 제거
        fullText = fullText.trim();

        return fullText;
      });

      // 웹 폰트 로딩 완료 대기 (한글 폰트 렌더링 문제 해결)
      console.log(`[Crawler] Waiting for fonts to load for ${url}`);

      await page.evaluate(() => {
        return document.fonts.ready;
      });

      // 폰트 로드 후 강제 리플로우 (브라우저가 폰트를 실제 적용하도록)
      await page.evaluate(() => {
        document.body.style.display = 'none';
        // Force reflow
        void document.body.offsetHeight;
        document.body.style.display = '';
      });

      // 짧은 대기 시간 (폰트 렌더링 안정화 - 속도 최적화)
      await page.waitForTimeout(1000);  // 5초 → 1초로 단축

      console.log(`[Crawler] Fonts loaded and applied, waiting for images to load for ${url}`);

      // 이미지 로딩 완료 대기 (블러 처리 방지)
      await page.evaluate(async () => {
        // 모든 이미지 요소 찾기
        const images = Array.from(document.querySelectorAll('img'));
        
        // 각 이미지가 완전히 로드될 때까지 대기
        await Promise.all(
          images.map((img) => {
            // 이미 로드된 이미지는 즉시 반환
            if (img.complete && img.naturalHeight !== 0) {
              return Promise.resolve();
            }
            
            // lazy loading 이미지 강제 로드
            if (img.loading === 'lazy') {
              img.loading = 'eager';
            }
            
            // srcset이 있으면 srcset 사용, 없으면 src 사용
            if (img.srcset) {
              img.srcset = img.srcset;
            } else if (img.src) {
              img.src = img.src;
            }
            
            // 이미지 로드 완료 대기
            return new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                console.warn(`Image load timeout: ${img.src}`);
                resolve(); // 타임아웃되어도 계속 진행
              }, 5000); // 5초 타임아웃
              
              if (img.complete && img.naturalHeight !== 0) {
                clearTimeout(timeout);
                resolve();
              } else {
                img.onload = () => {
                  clearTimeout(timeout);
                  resolve();
                };
                img.onerror = () => {
                  clearTimeout(timeout);
                  resolve(); // 에러가 나도 계속 진행
                };
              }
            });
          })
        );
        
        // 배경 이미지도 로드 대기
        const elementsWithBg = Array.from(document.querySelectorAll('*')).filter((el) => {
          const style = window.getComputedStyle(el);
          return style.backgroundImage && style.backgroundImage !== 'none';
        });
        
        // 추가 렌더링 대기
        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      console.log(`[Crawler] Images loaded, taking screenshot for ${url}`);

      // 16:9 비율 스크린샷 (모니터 크기, 상단만 캡처) - 전체 웹사이트 PDF용
      await page.setViewportSize({ width: 1920, height: 1080 });

      // 이미지 로딩 후 추가 대기 (렌더링 안정화)
      await page.waitForTimeout(500);

      const screenshot = await page.screenshot({
        fullPage: false, // viewport 크기만 캡처
        type: 'jpeg',
        quality: 80,
      });
      console.log(`[Crawler] Screenshot (viewport) captured for ${url} (${(screenshot.length / 1024).toFixed(1)}KB, 1920x1080)`);

      // 전체 페이지 스크린샷 (원본 스크린샷 PDF용 - 법적 증거)
      // 전체 페이지 스크린샷을 위해 스크롤하여 모든 이미지 로드
      console.log(`[Crawler] Loading all images for full-page screenshot for ${url}`);
      await page.evaluate(async () => {
        // 1. 모든 lazy loading 이미지를 eager로 변경
        const allImages = Array.from(document.querySelectorAll('img'));
        allImages.forEach((img) => {
          if (img.loading === 'lazy') {
            img.loading = 'eager';
          }
          // srcset이 있으면 강제 리로드
          if (img.srcset) {
            const currentSrcset = img.srcset;
            img.srcset = '';
            img.srcset = currentSrcset;
          } else if (img.src) {
            const currentSrc = img.src;
            img.src = '';
            img.src = currentSrc;
          }
        });

        // 2. CSS blur 필터 제거 (임시로)
        const elementsWithBlur = Array.from(document.querySelectorAll('*'));
        const originalFilters: Map<Element, string> = new Map();
        elementsWithBlur.forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.filter && style.filter !== 'none' && style.filter.includes('blur')) {
            originalFilters.set(el, style.filter);
            (el as HTMLElement).style.filter = 'none';
          }
        });

        // 3. 페이지를 섹션별로 나누어 스크롤하며 이미지 로드
        const viewportHeight = window.innerHeight;
        let totalHeight = document.documentElement.scrollHeight;
        const scrollStep = viewportHeight * 0.8; // 80%씩 겹치며 스크롤
        let scrollPosition = 0;
        let lastHeight = 0;
        let stableCount = 0;

        while (scrollPosition < totalHeight || stableCount < 2) {
          window.scrollTo(0, scrollPosition);
          await new Promise((resolve) => setTimeout(resolve, 300)); // 스크롤 안정화 대기

          // 현재 뷰포트 내의 모든 이미지가 로드될 때까지 대기
          const visibleImages = Array.from(document.querySelectorAll('img')).filter((img) => {
            const rect = img.getBoundingClientRect();
            return (
              rect.top < window.innerHeight &&
              rect.bottom > 0 &&
              rect.left < window.innerWidth &&
              rect.right > 0
            );
          });

          await Promise.all(
            visibleImages.map((img) => {
              return new Promise<void>((resolve) => {
                // 이미 로드된 이미지
                if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
                  resolve();
                  return;
                }

                // 이미지 로드 대기
                const timeout = setTimeout(() => {
                  console.warn(`Image load timeout: ${img.src}`);
                  resolve(); // 타임아웃되어도 계속 진행
                }, 3000);

                const onLoad = () => {
                  clearTimeout(timeout);
                  img.removeEventListener('load', onLoad);
                  img.removeEventListener('error', onError);
                  resolve();
                };

                const onError = () => {
                  clearTimeout(timeout);
                  img.removeEventListener('load', onLoad);
                  img.removeEventListener('error', onError);
                  resolve(); // 에러가 나도 계속 진행
                };

                img.addEventListener('load', onLoad);
                img.addEventListener('error', onError);

                // 이미지 강제 리로드 시도
                if (img.src) {
                  const currentSrc = img.src;
                  img.src = '';
                  img.src = currentSrc;
                }
              });
            })
          );

          // 배경 이미지도 확인
          const visibleElements = Array.from(document.querySelectorAll('*')).filter((el) => {
            const rect = el.getBoundingClientRect();
            return (
              rect.top < window.innerHeight &&
              rect.bottom > 0 &&
              rect.left < window.innerWidth &&
              rect.right > 0
            );
          });

          visibleElements.forEach((el) => {
            const style = window.getComputedStyle(el);
            if (style.backgroundImage && style.backgroundImage !== 'none') {
              // 배경 이미지가 있는 경우 추가 대기
            }
          });

          // 동적 콘텐츠로 인한 높이 변경 대응
          const currentHeight = document.documentElement.scrollHeight;
          if (currentHeight === lastHeight) {
            stableCount++;
          } else {
            stableCount = 0;
            lastHeight = currentHeight;
            totalHeight = currentHeight;
          }

          scrollPosition += scrollStep;
        }

        // 4. 페이지 끝까지 한 번 더 스크롤하여 모든 콘텐츠 로드
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 5. 모든 이미지 최종 확인
        const finalImages = Array.from(document.querySelectorAll('img'));
        await Promise.all(
          finalImages.map((img) => {
            return new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
                resolve();
                return;
              }

              const timeout = setTimeout(() => resolve(), 2000);
              const onLoad = () => {
                clearTimeout(timeout);
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve();
              };
              const onError = () => {
                clearTimeout(timeout);
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve();
              };
              img.addEventListener('load', onLoad);
              img.addEventListener('error', onError);
            });
          })
        );

        // 6. 다시 맨 위로 스크롤
        window.scrollTo(0, 0);
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 7. CSS blur 필터 복원 (스크린샷 후에는 필요 없지만 일단 복원)
        // 실제로는 스크린샷을 찍기 전에 제거된 상태로 유지하는 것이 좋음
        // originalFilters.forEach((filter, el) => {
        //   (el as HTMLElement).style.filter = filter;
        // });
      });

      // 추가 렌더링 안정화 대기
      await page.waitForTimeout(1000);

      const fullPageScreenshot = await page.screenshot({
        fullPage: true, // 페이지 전체 캡처
        type: 'jpeg',
        quality: 80,
      });
      console.log(`[Crawler] Screenshot (fullPage) captured for ${url} (${(fullPageScreenshot.length / 1024).toFixed(1)}KB)`);

      // 크롤링된 페이지 저장 (병렬 처리 경쟁 조건 방지)
      if (this.crawledPages.length < this.config.maxPages) {
        this.crawledPages.push({
          url,
          title,
          content: content || '',
          screenshot,
          fullPageScreenshot, // 전체 페이지 스크린샷 추가
          timestamp: new Date(),
          depth,
        });
      } else {
        // 최대 페이지 수 도달, 페이지 닫기
        await page.close();
        return;
      }

      // 진행 상황 콜백 호출
      if (this.onProgress) {
        this.onProgress(this.crawledPages.length, this.config.maxPages, url);
      }

      // 페이지 내 링크 추출
      const links = await this.extractLinks(page);

      await page.close();

      // 같은 도메인 링크만 필터링
      const sameDomainLinks = links.filter((link) => this.isSameDomain(link));

      console.log(
        `[Crawler] Found ${links.length} links on ${url} (${sameDomainLinks.length} same domain)`
      );

      // 병렬로 링크 크롤링 (CONCURRENT_LIMIT개씩 동시 처리)
      for (let i = 0; i < sameDomainLinks.length; i += this.CONCURRENT_LIMIT) {
        // 최대 페이지 수 도달 시 중단
        if (this.crawledPages.length >= this.config.maxPages) {
          break;
        }

        // 배치 단위로 링크 추출
        const batch = sameDomainLinks.slice(i, i + this.CONCURRENT_LIMIT);

        // 병렬 처리 (최대 5개 동시)
        await Promise.all(
          batch.map(async (link) => {
            // 각 크롤링 시작 시점에 다시 체크
            if (this.crawledPages.length < this.config.maxPages) {
              await this.crawlPage(link, depth + 1);
            }
          })
        );

        console.log(`[Crawler] Batch completed: ${this.crawledPages.length}/${this.config.maxPages} pages`);
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

      // 2단계 TLD 리스트 (co.kr, co.uk, com.au 등)
      const twoLevelTLDs = ['co.kr', 'co.uk', 'co.jp', 'com.au', 'com.br', 'ne.jp', 'or.kr', 're.kr', 'go.kr'];

      // 루트 도메인 추출 (2단계 TLD 고려)
      const getRootDomain = (hostname: string): string => {
        const parts = hostname.split('.');

        // 2단계 TLD 확인 (예: co.kr)
        if (parts.length >= 3) {
          const possibleTLD = parts.slice(-2).join('.');
          if (twoLevelTLDs.includes(possibleTLD)) {
            // 2단계 TLD인 경우: 마지막 3개 (예: mangocreative.co.kr)
            return parts.slice(-3).join('.');
          }
        }

        // 일반 TLD인 경우: 마지막 2개 (예: naver.com)
        if (parts.length >= 2) {
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
  config: CrawlConfig,
  onProgress?: (current: number, total: number, url: string) => void
): Promise<CrawlResult> {
  const crawler = new WebCrawler(config, onProgress);
  return await crawler.crawl();
}
