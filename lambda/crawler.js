/**
 * 웹사이트 크롤러 모듈
 * 기존 src/lib/crawler/index.ts를 Lambda 환경에 맞게 포팅
 */

const chromium = require("@sparticuz/chromium");
const { chromium: playwright } = require("playwright-core");

// 페이지 타입 감지 (로컬 환경의 page-filter.ts와 동일)
function detectPageType(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    if (
      pathname === "/" ||
      pathname === "/index" ||
      pathname === "/home" ||
      pathname === "/index.html"
    ) {
      return "Homepage";
    }

    if (
      pathname.includes("/product") ||
      pathname.includes("/shop") ||
      pathname.includes("/buy") ||
      pathname.includes("/store")
    ) {
      return "Product";
    }

    if (
      pathname.includes("/contact") ||
      pathname.includes("/support") ||
      pathname.includes("/help")
    ) {
      return "Contact";
    }

    if (
      pathname.includes("/about") ||
      pathname.includes("/team") ||
      pathname.includes("/company")
    ) {
      return "About";
    }

    if (
      pathname.includes("/blog") ||
      pathname.includes("/news") ||
      pathname.includes("/article") ||
      pathname.includes("/post")
    ) {
      return "Blog/News";
    }

    if (
      pathname.includes("/pricing") ||
      pathname.includes("/plans") ||
      pathname.includes("/price")
    ) {
      return "Pricing";
    }

    if (
      pathname.includes("/docs") ||
      pathname.includes("/documentation") ||
      pathname.includes("/guide")
    ) {
      return "Documentation";
    }

    if (pathname.includes("/feature") || pathname.includes("/solution")) {
      return "Features";
    }

    return "General";
  } catch {
    return "General";
  }
}

// 페이지 필터링 함수 (로컬 환경의 page-filter.ts와 동일)
function shouldExcludeByDefault(url) {
  const EXCLUDED_PATTERNS = [
    /\/(login|signin|sign-in|register|signup|sign-up|logout|signout|forgot-password|reset-password|verify|confirm|auth)/i,
    /\/(terms|privacy|cookie|disclaimer|legal|gdpr|ccpa|cppa)/i,
    /\/(404|error|not-found|500|503|maintenance|offline)/i,
    /\/(search|results)|\?.*page=|\?.*filter=|\?.*sort=/i,
    /\/(tag|category|archive|tags|categories)\//i,
    /\/(admin|dashboard|wp-admin|manage|settings|console)/i,
    /\/(cart|basket|checkout|payment|order|wishlist|favorites)/i,
    /\/(feed|rss|atom|api|sitemap|robots)/i,
    /\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|svg|mp4|mp3|avi|mov)$/i,
    /\/(event|promo|promotion|campaign|contest|giveaway|discount|sale|coupon)/i,
    /\/(apply|signup-form|trial|demo-request|contact-form|inquiry|consultation)/i,
  ];

  try {
    const urlObj = new URL(url);
    const fullPath =
      urlObj.pathname.toLowerCase() + urlObj.search.toLowerCase();
    return EXCLUDED_PATTERNS.some((pattern) => pattern.test(fullPath));
  } catch {
    return false;
  }
}

function normalizeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    let hostname = parsedUrl.hostname;
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }
    const normalizedOrigin = `${parsedUrl.protocol}//${hostname}${
      parsedUrl.port ? ":" + parsedUrl.port : ""
    }`;
    return normalizedOrigin + parsedUrl.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function isSameDomain(baseUrl, targetUrl) {
  try {
    const base = new URL(baseUrl);
    const target = new URL(targetUrl);
    const twoLevelTLDs = [
      "co.kr",
      "co.uk",
      "co.jp",
      "com.au",
      "com.br",
      "ne.jp",
      "or.kr",
      "re.kr",
      "go.kr",
    ];

    const getRootDomain = (hostname) => {
      const parts = hostname.split(".");
      if (parts.length >= 3) {
        const possibleTLD = parts.slice(-2).join(".");
        if (twoLevelTLDs.includes(possibleTLD)) {
          return parts.slice(-3).join(".");
        }
      }
      if (parts.length >= 2) {
        return parts.slice(-2).join(".");
      }
      return hostname;
    };

    return getRootDomain(base.hostname) === getRootDomain(target.hostname);
  } catch {
    return false;
  }
}

class WebCrawler {
  constructor(config, onProgress) {
    this.config = config;
    this.onProgress = onProgress;
    this.browser = null;
    this.browserDisconnected = false;
    this.visitedUrls = new Set();
    this.crawledPages = [];
    this.skippedUrls = new Set();
    this.openPages = [];
  }

  async crawl(crawlState) {
    const startTime = new Date();

    try {
      // Lambda 환경용 @sparticuz/chromium 설정
      const executablePath = await chromium.executablePath();
      console.log("[Crawler] Chromium 경로:", executablePath);

      const launchArgs = chromium.args.filter(
        (arg) => arg !== "--single-process"
      );

      this.browser = await playwright.launch({
        args: [
          ...launchArgs,
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
        executablePath: executablePath,
        headless: true,
        ignoreDefaultArgs: ["--disable-extensions"],
      });

      this.browser.on("disconnected", () => {
        this.browserDisconnected = true;
        console.warn("[Crawler] 브라우저 연결 끊김");
      });

      let nextState = null;
      try {
        nextState = await this.crawlQueue(this.config.url, crawlState);
      } catch (error) {
        console.error("[Crawler] 큐 처리 중 에러:", error);
        nextState = {
          queue: [],
          visitedUrls: Array.from(this.visitedUrls),
          skippedUrls: Array.from(this.skippedUrls),
        };
      }

      const endTime = new Date();

      if (this.config.crawlMode === "smart" && this.skippedUrls.size > 0) {
        console.log(
          `[Crawler] Smart Mode: Skipped ${this.skippedUrls.size} filtered URLs, Crawled ${this.crawledPages.length} important pages`
        );
      }

      return {
        pages: this.crawledPages,
        totalPages: this.crawledPages.length,
        startTime,
        endTime,
        crawlState: nextState,
      };
    } catch (error) {
      console.error("Crawl error:", error);
      throw error;
    } finally {
      await this.close();
    }
  }

  async crawlQueue(startUrl, crawlState) {
    const concurrency = Math.max(1, this.config.concurrentPages || 2);
    if (crawlState?.visitedUrls) {
      this.visitedUrls = new Set(crawlState.visitedUrls);
    }
    if (crawlState?.skippedUrls) {
      this.skippedUrls = new Set(crawlState.skippedUrls);
    }
    const queue =
      crawlState?.queue && crawlState.queue.length > 0
        ? crawlState.queue
        : [{ url: startUrl, depth: 0 }];
    const queuedUrls = new Set(queue.map((item) => normalizeUrl(item.url)));
    const inFlight = new Map();

    const enqueueLinks = (links, nextDepth) => {
      if (!links || links.length === 0) {
        return;
      }
      if (this.config.maxDepth && nextDepth > this.config.maxDepth) {
        return;
      }
      for (const link of links) {
        const normalizedLink = normalizeUrl(link);
        if (
          this.visitedUrls.has(normalizedLink) ||
          queuedUrls.has(normalizedLink)
        ) {
          continue;
        }
        if (this.config.crawlMode === "smart" && shouldExcludeByDefault(link)) {
          this.skippedUrls.add(normalizedLink);
          continue;
        }
        queuedUrls.add(normalizedLink);
        queue.push({ url: link, depth: nextDepth });
      }
    };

    while (
      (queue.length > 0 || inFlight.size > 0) &&
      this.crawledPages.length < this.config.maxPages
    ) {
      if (
        this.browserDisconnected ||
        !this.browser ||
        !this.browser.isConnected()
      ) {
        console.warn("[Crawler] 브라우저 연결 끊김 감지, 큐 처리 중단");
        if (inFlight.size > 0) {
          for (const { url, depth } of inFlight.values()) {
            if (!url) continue;
            const normalizedLink = normalizeUrl(url);
            if (
              this.visitedUrls.has(normalizedLink) ||
              queuedUrls.has(normalizedLink)
            ) {
              continue;
            }
            queuedUrls.add(normalizedLink);
            queue.push({ url, depth });
          }
        }
        break;
      }
      while (
        queue.length > 0 &&
        inFlight.size < concurrency &&
        this.crawledPages.length < this.config.maxPages
      ) {
        const { url, depth } = queue.shift();
        const promise = this.crawlPage(url, depth)
          .then((links) => {
            enqueueLinks(links, depth + 1);
          })
          .catch((error) => {
            console.error(`[Crawler] Failed to crawl ${url}:`, error);
          })
          .finally(() => {
            inFlight.delete(promise);
          });
        inFlight.set(promise, { url, depth });
      }

      if (inFlight.size > 0) {
        await Promise.race(inFlight.keys());
      }
    }

    if (inFlight.size > 0) {
      await Promise.allSettled(inFlight.keys());
      for (const { url, depth } of inFlight.values()) {
        if (!url) continue;
        const normalizedLink = normalizeUrl(url);
        if (
          this.visitedUrls.has(normalizedLink) ||
          queuedUrls.has(normalizedLink)
        ) {
          continue;
        }
        queuedUrls.add(normalizedLink);
        queue.push({ url, depth });
      }
    }

    return {
      queue,
      visitedUrls: Array.from(this.visitedUrls),
      skippedUrls: Array.from(this.skippedUrls),
    };
  }

  async crawlPage(url, depth) {
    const normalizedUrl = normalizeUrl(url);

    if (
      this.browserDisconnected ||
      !this.browser ||
      !this.browser.isConnected()
    ) {
      return [];
    }

    if (
      this.visitedUrls.has(normalizedUrl) ||
      this.crawledPages.length >= this.config.maxPages ||
      (this.config.maxDepth && depth > this.config.maxDepth)
    ) {
      return [];
    }

    if (this.config.sameDomainOnly && !isSameDomain(this.config.url, url)) {
      return [];
    }

    if (this.config.crawlMode === "smart" && shouldExcludeByDefault(url)) {
      this.skippedUrls.add(normalizedUrl);
      console.log(`[Crawler] Skipped (Smart Mode): ${url}`);
      return [];
    }

    this.visitedUrls.add(normalizedUrl);
    console.log(
      `[Crawler] Crawling (${this.crawledPages.length + 1}/${
        this.config.maxPages
      }): ${url}`
    );

    let page = null;
    let context = null;
    const cleanupContext = async () => {
      if (page) {
        const index = this.openPages.indexOf(page);
        if (index > -1) {
          this.openPages.splice(index, 1);
        }
        page = null;
      }
      if (context) {
        try {
          await context.close();
        } catch (error) {
          console.warn("[Crawler] 컨텍스트 닫기 중 에러:", error);
        }
        context = null;
      }
    };
    try {
      // 브라우저 연결 상태 확인
      if (!this.browser || !this.browser.isConnected()) {
        console.warn(`[Crawler] 브라우저가 닫혔습니다. 스킵: ${url}`);
        return [];
      }

      context = await this.browser.newContext();
      page = await context.newPage();
      this.openPages.push(page);

      await page.route("**/*", (route) => {
        const request = route.request();
        const resourceType = request.resourceType();
        const requestUrl = request.url();
        const blockedResourceTypes = new Set(["media", "font"]);
        const blockedUrlPatterns = [
          /doubleclick\.net/i,
          /googletagmanager\.com/i,
          /google-analytics\.com/i,
          /analytics\.google\.com/i,
          /facebook\.net/i,
          /hotjar\.com/i,
          /clarity\.ms/i,
          /sentry\.io/i,
        ];

        if (
          blockedResourceTypes.has(resourceType) ||
          blockedUrlPatterns.some((pattern) => pattern.test(requestUrl))
        ) {
          return route.abort();
        }
        return route.continue();
      });

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      await page.waitForTimeout(500);

      // 브라우저/페이지 연결 상태 확인
      if (!this.browser || !this.browser.isConnected() || page.isClosed()) {
        console.warn(`[Crawler] 브라우저/페이지가 닫혔습니다. 스킵: ${url}`);
        return [];
      }

      const title = await page.title();

      // 브라우저/페이지 연결 상태 확인
      if (!this.browser || !this.browser.isConnected() || page.isClosed()) {
        console.warn(`[Crawler] 브라우저/페이지가 닫혔습니다. 스킵: ${url}`);
        return [];
      }

      const content = await page.evaluate(() => {
        const unwantedSelectors = [
          "script",
          "style",
          "noscript",
          "iframe",
          "svg",
          "path",
          "img",
          "video",
          "audio",
          "canvas",
          "nav",
          "footer",
          'header[role="banner"]',
          ".ad",
          ".advertisement",
          '[class*="cookie"]',
          '[class*="popup"]',
          '[class*="modal"]',
        ];

        const bodyClone = document.body.cloneNode(true);

        unwantedSelectors.forEach((selector) => {
          bodyClone.querySelectorAll(selector).forEach((el) => el.remove());
        });

        const blockElements = bodyClone.querySelectorAll(
          "p, h1, h2, h3, h4, h5, h6, div, section, article, li, td, th, blockquote, pre"
        );

        const textParts = [];
        const processedElements = new Set();

        blockElements.forEach((el) => {
          if (processedElements.has(el)) return;

          const text = el.innerText?.trim();
          if (text && text.length > 0) {
            textParts.push(text);
            el.querySelectorAll("*").forEach((child) => {
              processedElements.add(child);
            });
            processedElements.add(el);
          }
        });

        let fullText = textParts.join("\n\n");
        fullText = fullText.replace(/[ \t]+/g, " ");
        fullText = fullText.replace(/\n{3,}/g, "\n\n");
        return fullText.trim();
      });

      // 브라우저 연결 상태 확인
      if (!this.browser || !this.browser.isConnected() || page.isClosed()) {
        console.warn(`[Crawler] 브라우저/페이지가 닫혔습니다. 스킵: ${url}`);
        return [];
      }

      await page.evaluate(() => {
        return document.fonts.ready;
      });

      // 브라우저 연결 상태 확인
      if (!this.browser || !this.browser.isConnected() || page.isClosed()) {
        console.warn(`[Crawler] 브라우저/페이지가 닫혔습니다. 스킵: ${url}`);
        return [];
      }

      await page.evaluate(() => {
        document.body.style.display = "none";
        void document.body.offsetHeight;
        document.body.style.display = "";
      });

      await page.waitForTimeout(1000);

      // 브라우저 연결 상태 확인
      if (!this.browser || !this.browser.isConnected() || page.isClosed()) {
        console.warn(`[Crawler] 브라우저/페이지가 닫혔습니다. 스킵: ${url}`);
        return [];
      }

      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll("img"));

        await Promise.all(
          images.map((img) => {
            if (img.complete && img.naturalHeight !== 0) {
              return Promise.resolve();
            }

            if (img.loading === "lazy") {
              img.loading = "eager";
            }

            if (img.srcset) {
              img.srcset = img.srcset;
            } else if (img.src) {
              img.src = img.src;
            }

            return new Promise((resolve) => {
              const timeout = setTimeout(() => resolve(), 5000);
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
                  resolve();
                };
              }
            });
          })
        );

        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      // 브라우저 연결 상태 확인
      if (!this.browser || !this.browser.isConnected() || page.isClosed()) {
        console.warn(`[Crawler] 브라우저/페이지가 닫혔습니다. 스킵: ${url}`);
        return [];
      }

      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);

      // 브라우저 연결 상태 확인
      if (!this.browser || !this.browser.isConnected() || page.isClosed()) {
        console.warn(`[Crawler] 브라우저/페이지가 닫혔습니다. 스킵: ${url}`);
        return [];
      }

      const screenshot = await page.screenshot({
        fullPage: false,
        type: "jpeg",
        quality: 50,
      });

      await page.evaluate(async () => {
        const allImages = Array.from(document.querySelectorAll("img"));
        allImages.forEach((img) => {
          if (img.loading === "lazy") {
            img.loading = "eager";
          }
          if (img.srcset) {
            const currentSrcset = img.srcset;
            img.srcset = "";
            img.srcset = currentSrcset;
          } else if (img.src) {
            const currentSrc = img.src;
            img.src = "";
            img.src = currentSrc;
          }
        });

        const elementsWithBlur = Array.from(document.querySelectorAll("*"));
        elementsWithBlur.forEach((el) => {
          const style = window.getComputedStyle(el);
          if (
            style.filter &&
            style.filter !== "none" &&
            style.filter.includes("blur")
          ) {
            el.style.filter = "none";
          }
        });

        const viewportHeight = window.innerHeight;
        let totalHeight = document.documentElement.scrollHeight;
        const scrollStep = viewportHeight * 0.8;
        let scrollPosition = 0;
        let lastHeight = 0;
        let stableCount = 0;

        while (scrollPosition < totalHeight || stableCount < 2) {
          window.scrollTo(0, scrollPosition);
          await new Promise((resolve) => setTimeout(resolve, 300));

          const visibleImages = Array.from(
            document.querySelectorAll("img")
          ).filter((img) => {
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
              return new Promise((resolve) => {
                if (
                  img.complete &&
                  img.naturalWidth > 0 &&
                  img.naturalHeight > 0
                ) {
                  resolve();
                  return;
                }

                const timeout = setTimeout(() => resolve(), 3000);
                const onLoad = () => {
                  clearTimeout(timeout);
                  img.removeEventListener("load", onLoad);
                  img.removeEventListener("error", onError);
                  resolve();
                };
                const onError = () => {
                  clearTimeout(timeout);
                  img.removeEventListener("load", onLoad);
                  img.removeEventListener("error", onError);
                  resolve();
                };
                img.addEventListener("load", onLoad);
                img.addEventListener("error", onError);
                if (img.src) {
                  const currentSrc = img.src;
                  img.src = "";
                  img.src = currentSrc;
                }
              });
            })
          );

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

        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const finalImages = Array.from(document.querySelectorAll("img"));
        await Promise.all(
          finalImages.map((img) => {
            return new Promise((resolve) => {
              if (
                img.complete &&
                img.naturalWidth > 0 &&
                img.naturalHeight > 0
              ) {
                resolve();
                return;
              }
              const timeout = setTimeout(() => resolve(), 2000);
              const onLoad = () => {
                clearTimeout(timeout);
                img.removeEventListener("load", onLoad);
                img.removeEventListener("error", onError);
                resolve();
              };
              const onError = () => {
                clearTimeout(timeout);
                img.removeEventListener("load", onLoad);
                img.removeEventListener("error", onError);
                resolve();
              };
              img.addEventListener("load", onLoad);
              img.addEventListener("error", onError);
            });
          })
        );

        window.scrollTo(0, 0);
        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      await page.waitForTimeout(1000);

      // 브라우저 연결 상태 확인
      if (!this.browser || !this.browser.isConnected() || page.isClosed()) {
        console.warn(`[Crawler] 브라우저/페이지가 닫혔습니다. 스킵: ${url}`);
        return [];
      }

      const fullPageScreenshot = await page.screenshot({
        fullPage: true,
        type: "jpeg",
        quality: 80,
      });

      if (this.crawledPages.length < this.config.maxPages) {
        this.crawledPages.push({
          url,
          title: title || url,
          content: content || "",
          screenshot: screenshot || null,
          fullPageScreenshot: fullPageScreenshot || null,
          timestamp: new Date(),
          depth,
          pageType: detectPageType(url),
        });
      }

      if (this.onProgress) {
        this.onProgress(this.crawledPages.length, this.config.maxPages, url);
      }

      // 브라우저 연결 상태 확인
      if (!this.browser || !this.browser.isConnected() || page.isClosed()) {
        console.warn(`[Crawler] 브라우저/페이지가 닫혔습니다. 스킵: ${url}`);
        return [];
      }

      // 링크 추출 (페이지 닫기 전에)
      const links = await page.$$eval("a[href]", (anchors) =>
        anchors.map((a) => a.href)
      );

      // 컨텍스트는 링크 추출 이후 즉시 정리 (페이지 누적 방지)

      const sameDomainLinks = [...new Set(links)].filter((link) => {
        try {
          const url = new URL(link);
          return (
            (url.protocol === "http:" || url.protocol === "https:") &&
            isSameDomain(this.config.url, link)
          );
        } catch {
          return false;
        }
      });

      await cleanupContext();

      console.log(
        `[Crawler] Found ${links.length} links on ${url} (${sameDomainLinks.length} same domain)`
      );

      return sameDomainLinks;
    } catch (error) {
      console.error(`[Crawler] Failed to crawl ${url}:`, error);
      return [];
    } finally {
      await cleanupContext();
    }
  }

  async close() {
    if (this.browser) {
      // 남아있는 페이지 정리 (일부 페이지가 닫히지 않은 경우)
      try {
        await Promise.all(
          this.openPages.map((page) => {
            try {
              return page.close();
            } catch {
              return Promise.resolve();
            }
          })
        );
        this.openPages = [];
      } catch (error) {
        console.warn("[Crawler] 페이지 정리 중 에러:", error);
      }

      try {
        if (this.browser.isConnected()) {
          await this.browser.close();
        }
      } catch (error) {
        console.warn("[Crawler] 브라우저 닫기 중 에러:", error);
      }
      this.browser = null;
    }
  }
}

module.exports = { WebCrawler };
