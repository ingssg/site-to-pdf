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
    this.visitedUrls = new Set();
    this.crawledPages = [];
    this.skippedUrls = new Set();
    this.CONCURRENT_LIMIT = 5;
    this.openPages = []; // 열려있는 페이지 추적
  }

  async crawl() {
    const startTime = new Date();
    const failedUrls = [];

    try {
      // Lambda 환경용 @sparticuz/chromium 설정
      const executablePath = await chromium.executablePath();
      console.log("[Crawler] Chromium 경로:", executablePath);

      this.browser = await playwright.launch({
        args: [
          ...chromium.args,
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-setuid-sandbox",
          "--no-sandbox",
        ],
        executablePath: executablePath,
        headless: true,
        ignoreDefaultArgs: ["--disable-extensions"],
      });

      await this.crawlPage(this.config.url, 0);

      const endTime = new Date();

      if (this.config.crawlMode === "smart" && this.skippedUrls.size > 0) {
        console.log(
          `[Crawler] Smart Mode: Skipped ${this.skippedUrls.size} filtered URLs, Crawled ${this.crawledPages.length} important pages`
        );
      }

      return {
        pages: this.crawledPages,
        totalPages: this.crawledPages.length,
        failedUrls,
        startTime,
        endTime,
      };
    } catch (error) {
      console.error("Crawl error:", error);
      throw error;
    } finally {
      await this.close();
    }
  }

  async crawlPage(url, depth) {
    const normalizedUrl = normalizeUrl(url);

    // 브라우저 상태 확인
    if (!this.browser || !this.browser.isConnected()) {
      console.warn(
        `[Crawler] 브라우저가 닫혔습니다. 새 페이지 생성 불가: ${url}`
      );
      return;
    }

    if (
      this.visitedUrls.has(normalizedUrl) ||
      this.crawledPages.length >= this.config.maxPages ||
      (this.config.maxDepth && depth > this.config.maxDepth)
    ) {
      return;
    }

    if (this.config.sameDomainOnly && !isSameDomain(this.config.url, url)) {
      return;
    }

    if (this.config.crawlMode === "smart" && shouldExcludeByDefault(url)) {
      this.skippedUrls.add(normalizedUrl);
      console.log(`[Crawler] Skipped (Smart Mode): ${url}`);
      return;
    }

    this.visitedUrls.add(normalizedUrl);
    console.log(
      `[Crawler] Crawling (${this.crawledPages.length + 1}/${
        this.config.maxPages
      }): ${url}`
    );

    let page = null;
    try {
      // 브라우저 상태 재확인
      if (!this.browser || !this.browser.isConnected()) {
        console.error("[Crawler] 브라우저가 닫혔습니다. 새 페이지 생성 불가.");
        return;
      }

      page = await this.browser.newPage();
      this.openPages.push(page); // 페이지 추적

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      await page.waitForTimeout(500);

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(`[Crawler] 페이지가 이미 닫혔습니다: ${url}`);
        return;
      }

      // 브라우저 상태 확인 (page.evaluate 전)
      if (!this.browser || !this.browser.isConnected()) {
        console.error("[Crawler] 브라우저가 닫혔습니다. 크롤링 중단.");
        return;
      }

      const title = await page.title();

      // 페이지 상태 재확인
      if (page.isClosed()) {
        console.warn(`[Crawler] 페이지가 닫혔습니다 (title 후): ${url}`);
        return;
      }

      // 브라우저 상태 재확인
      if (!this.browser || !this.browser.isConnected()) {
        console.warn(
          `[Crawler] 브라우저가 닫혔습니다: ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      let content;
      try {
        // 페이지 상태 확인 (evaluate 전)
        if (page.isClosed()) {
          console.warn(
            `[Crawler] 페이지가 닫혔습니다 (content 추출 전): ${url}. 다음 페이지로 계속 진행.`
          );
          return; // 해당 페이지만 스킵하고 계속 진행
        }

        // 브라우저 상태 확인
        if (!this.browser || !this.browser.isConnected()) {
          console.warn(
            `[Crawler] 브라우저가 닫혔습니다 (content 추출 전): ${url}. 다음 페이지로 계속 진행.`
          );
          return; // 해당 페이지만 스킵하고 계속 진행
        }

        content = await page.evaluate(() => {
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
      } catch (error) {
        if (
          error.message &&
          (error.message.includes("closed") ||
            error.message.includes("Target page") ||
            error.message.includes("browser"))
        ) {
          console.warn(
            `[Crawler] 페이지가 닫혔습니다 (content 추출 실패): ${url}. 다음 페이지로 계속 진행.`,
            error.message
          );
          return; // 해당 페이지만 스킵하고 계속 진행
        }
        console.error(
          `[Crawler] content 추출 중 예상치 못한 에러: ${url}`,
          error
        );
        // 예상치 못한 에러도 해당 페이지만 스킵하고 계속 진행
        return;
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (content 추출 후): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (fonts.ready 전): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      // 브라우저 상태 확인
      if (!this.browser || !this.browser.isConnected()) {
        console.warn(
          `[Crawler] 브라우저가 닫혔습니다 (fonts.ready 전): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      try {
        await page.evaluate(() => {
          return document.fonts.ready;
        });
      } catch (error) {
        if (
          error.message &&
          (error.message.includes("closed") ||
            error.message.includes("Target page") ||
            error.message.includes("browser"))
        ) {
          console.warn(
            `[Crawler] 페이지가 닫혔습니다 (fonts.ready 실패): ${url}. 다음 페이지로 계속 진행.`,
            error.message
          );
          return; // 해당 페이지만 스킵하고 계속 진행
        }
        console.error(
          `[Crawler] fonts.ready 중 예상치 못한 에러: ${url}`,
          error
        );
        // 예상치 못한 에러도 해당 페이지만 스킵하고 계속 진행
        return;
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (fonts.ready 후): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      // 브라우저 상태 확인
      if (!this.browser || !this.browser.isConnected()) {
        console.warn(
          `[Crawler] 브라우저가 닫혔습니다 (body style 전): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      try {
        if (page.isClosed()) {
          console.warn(
            `[Crawler] 페이지가 닫혔습니다 (body style 전): ${url}. 다음 페이지로 계속 진행.`
          );
          return;
        }
        await page.evaluate(() => {
          document.body.style.display = "none";
          void document.body.offsetHeight;
          document.body.style.display = "";
        });
      } catch (error) {
        if (
          error.message &&
          (error.message.includes("closed") ||
            error.message.includes("Target page") ||
            error.message.includes("browser"))
        ) {
          console.warn(
            `[Crawler] 페이지가 닫혔습니다 (body style 실패): ${url}. 다음 페이지로 계속 진행.`,
            error.message
          );
          return; // 해당 페이지만 스킵하고 계속 진행
        }
        console.error(
          `[Crawler] body style 중 예상치 못한 에러: ${url}`,
          error
        );
        // 예상치 못한 에러도 해당 페이지만 스킵하고 계속 진행
        return;
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (body style 후): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      await page.waitForTimeout(1000);

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (이미지 로딩 전): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      // 브라우저 상태 확인
      if (!this.browser || !this.browser.isConnected()) {
        console.warn(
          `[Crawler] 브라우저가 닫혔습니다 (이미지 로딩 전): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      try {
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
      } catch (error) {
        if (
          error.message &&
          (error.message.includes("closed") ||
            error.message.includes("Target page") ||
            error.message.includes("browser"))
        ) {
          console.warn(
            `[Crawler] 페이지가 닫혔습니다 (이미지 로딩 실패): ${url}. 다음 페이지로 계속 진행.`,
            error.message
          );
          return; // 해당 페이지만 스킵하고 계속 진행
        }
        console.error(
          `[Crawler] 이미지 로딩 중 예상치 못한 에러: ${url}`,
          error
        );
        // 예상치 못한 에러도 해당 페이지만 스킵하고 계속 진행
        return;
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (이미지 로딩 후): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      // 브라우저 상태 확인
      if (!this.browser || !this.browser.isConnected()) {
        console.error("[Crawler] 브라우저가 닫혔습니다. 크롤링 중단.");
        return;
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (viewport 설정 전): ${url}`
        );
        return;
      }

      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (viewport 설정 후): ${url}`
        );
        return;
      }

      // 브라우저 상태 확인
      if (!this.browser || !this.browser.isConnected()) {
        console.error("[Crawler] 브라우저가 닫혔습니다. 크롤링 중단.");
        return;
      }

      let screenshot;
      try {
        screenshot = await page.screenshot({
          fullPage: false,
          type: "jpeg",
          quality: 80,
        });
      } catch (error) {
        if (
          error.message &&
          (error.message.includes("closed") ||
            error.message.includes("Target page"))
        ) {
          console.warn(
            `[Crawler] 페이지가 닫혔습니다 (스크린샷 실패): ${url}. 다음 페이지로 계속 진행.`
          );
          return; // 해당 페이지만 스킵하고 계속 진행
        }
        throw error;
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(`[Crawler] 페이지가 닫혔습니다 (스크린샷 후): ${url}`);
        return;
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (전체 페이지 이미지 로딩 전): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      // 브라우저 상태 확인
      if (!this.browser || !this.browser.isConnected()) {
        console.warn(
          `[Crawler] 브라우저가 닫혔습니다 (전체 페이지 이미지 로딩 전): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      // 전체 페이지 스크린샷을 위한 이미지 로딩
      try {
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
      } catch (error) {
        if (
          error.message &&
          (error.message.includes("closed") ||
            error.message.includes("Target page") ||
            error.message.includes("browser"))
        ) {
          console.warn(
            `[Crawler] 페이지가 닫혔습니다 (전체 페이지 이미지 로딩 실패): ${url}. 다음 페이지로 계속 진행.`,
            error.message
          );
          return; // 해당 페이지만 스킵하고 계속 진행
        }
        console.error(
          `[Crawler] 전체 페이지 이미지 로딩 중 예상치 못한 에러: ${url}`,
          error
        );
        // 예상치 못한 에러도 해당 페이지만 스킵하고 계속 진행
        return;
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (전체 페이지 이미지 로딩 후): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      await page.waitForTimeout(1000);

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (전체 페이지 스크린샷 전): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      let fullPageScreenshot;
      try {
        fullPageScreenshot = await page.screenshot({
          fullPage: true,
          type: "jpeg",
          quality: 80,
        });
      } catch (error) {
        if (
          error.message &&
          (error.message.includes("closed") ||
            error.message.includes("Target page") ||
            error.message.includes("browser"))
        ) {
          console.warn(
            `[Crawler] 페이지가 닫혔습니다 (전체 페이지 스크린샷 실패): ${url}. 다음 페이지로 계속 진행.`,
            error.message
          );
          return; // 해당 페이지만 스킵하고 계속 진행
        }
        console.error(
          `[Crawler] 전체 페이지 스크린샷 중 예상치 못한 에러: ${url}`,
          error
        );
        // 예상치 못한 에러도 해당 페이지만 스킵하고 계속 진행
        return;
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (전체 페이지 스크린샷 후): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      // 크롤링한 데이터 저장 (에러가 발생해도 가능한 데이터는 저장)
      if (this.crawledPages.length < this.config.maxPages) {
        try {
          this.crawledPages.push({
            url,
            title: title || url,
            content: content || "",
            screenshot: screenshot || null,
            fullPageScreenshot: fullPageScreenshot || null,
            timestamp: new Date(),
            depth,
            pageType: detectPageType(url), // 페이지 타입 추가
          });
        } catch (error) {
          console.error(`[Crawler] 데이터 저장 중 에러: ${url}`, error);
          // 데이터 저장 실패해도 계속 진행
        }
      } else {
        // maxPages에 도달했어도 페이지를 닫지 않음
        // 브라우저가 닫히는 것을 방지하기 위함
        return;
      }

      if (this.onProgress) {
        this.onProgress(this.crawledPages.length, this.config.maxPages, url);
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (링크 추출 전): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      // 브라우저 상태 확인
      if (!this.browser || !this.browser.isConnected()) {
        console.warn(
          `[Crawler] 브라우저가 닫혔습니다 (링크 추출 전): ${url}. 다음 페이지로 계속 진행.`
        );
        return;
      }

      let links = [];
      try {
        links = await page.$$eval("a[href]", (anchors) =>
          anchors.map((a) => a.href)
        );
      } catch (error) {
        if (
          error.message &&
          (error.message.includes("closed") ||
            error.message.includes("Target page") ||
            error.message.includes("browser"))
        ) {
          console.warn(
            `[Crawler] 페이지가 닫혔습니다 (링크 추출 실패): ${url}. 다음 페이지로 계속 진행.`,
            error.message
          );
          // 링크 추출 실패해도 이미 크롤링한 데이터는 저장
          links = [];
        } else {
          console.error(
            `[Crawler] 링크 추출 중 예상치 못한 에러: ${url}`,
            error
          );
          links = [];
        }
        // 에러가 발생해도 이미 크롤링한 데이터는 저장하고 계속 진행
      }

      // 페이지 상태 확인
      if (page.isClosed()) {
        console.warn(
          `[Crawler] 페이지가 닫혔습니다 (링크 추출 후): ${url}. 다음 페이지로 계속 진행.`
        );
        // 링크 추출 후 페이지가 닫혔어도 이미 크롤링한 데이터는 저장
      }

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

      console.log(
        `[Crawler] Found ${links.length} links on ${url} (${sameDomainLinks.length} same domain)`
      );

      // 브라우저 상태 확인
      if (!this.browser || !this.browser.isConnected()) {
        console.error("[Crawler] 브라우저가 이미 닫혔습니다. 크롤링 중단.");
        return;
      }

      // 근본 해결: 페이지를 닫지 않고 계속 사용
      // @sparticuz/chromium의 single-process 모드에서 page.close()가 브라우저를 닫을 수 있음
      // 페이지를 닫지 않으면 브라우저가 안정적으로 유지됨
      // Lambda 환경에서는 메모리가 충분하므로 (2048MB) 페이지를 열어두어도 문제 없음
      // 페이지는 finally 블록에서 일괄 정리됨

      // 동시 크롤링 대신 순차 처리로 변경 (브라우저 안정성 향상)
      for (const link of sameDomainLinks) {
        if (this.crawledPages.length >= this.config.maxPages) {
          break;
        }

        // 브라우저 상태 확인
        if (!this.browser || !this.browser.isConnected()) {
          console.warn(
            `[Crawler] 브라우저가 닫혔습니다. 링크 크롤링 중단: ${url}`
          );
          break;
        }

        await this.crawlPage(link, depth + 1);

        console.log(
          `[Crawler] Progress: ${this.crawledPages.length}/${this.config.maxPages} pages`
        );
      }
    } catch (error) {
      console.error(`[Crawler] Failed to crawl ${url}:`, error);
      // 페이지를 닫지 않음 - 브라우저가 닫히는 것을 방지
      // 모든 페이지는 finally 블록에서 일괄 정리됨
    }
  }

  async close() {
    if (this.browser) {
      // 추적 중인 모든 페이지를 닫기
      try {
        await Promise.all(
          this.openPages.map((page) => {
            try {
              return page.close();
            } catch (error) {
              // 페이지가 이미 닫혔거나 에러가 발생해도 계속 진행
              return Promise.resolve();
            }
          })
        );
        this.openPages = [];
      } catch (error) {
        console.warn("[Crawler] 페이지 정리 중 에러:", error);
      }

      // 브라우저 닫기
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
