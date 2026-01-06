/**
 * HTML/CSS 기반 PDF 생성기 (Playwright 사용)
 * Stitch 디자인에 맞춘 PDF 생성
 */

import { chromium, Browser, Page } from "playwright";
import { PDFDocument } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import type {
  AISummary,
  CrawledPage,
  TableOfContentsItem,
  PDFResult,
} from "@/types";

interface HTMLPDFGeneratorOptions {
  includeTableOfContents?: boolean;
}

export class HTMLPDFGenerator {
  private browser: Browser | null = null;
  private options: HTMLPDFGeneratorOptions;

  constructor(options: HTMLPDFGeneratorOptions = {}) {
    this.options = {
      includeTableOfContents: true,
      ...options,
    };
  }

  /**
   * URL에서 도메인 추출
   */
  private getDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return "Website";
    }
  }

  /**
   * HTML 템플릿 로드
   */
  private loadTemplate(templateName: string): string {
    const templatePath = path.join(
      process.cwd(),
      "src/lib/pdf/templates",
      `${templateName}.html`
    );
    return fs.readFileSync(templatePath, "utf-8");
  }

  /**
   * 템플릿 변수 치환
   */
  private replaceTemplateVars(
    template: string,
    vars: Record<string, string>
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
    }
    return result;
  }

  /**
   * Playwright 브라우저 초기화
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
      });
    }
  }

  /**
   * HTML을 PDF로 변환
   */
  private async htmlToPDF(html: string): Promise<Buffer> {
    await this.initBrowser();
    const page = await this.browser!.newPage();

    await page.setContent(html, { waitUntil: "networkidle" });

    // 폰트 로딩 대기
    await page.evaluate(() => {
      return document.fonts.ready;
    });

    // 추가 대기 (렌더링 완료)
    await page.waitForTimeout(1000);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    await page.close();
    return Buffer.from(pdfBuffer);
  }

  /**
   * 표지 페이지 생성
   */
  private async generateCoverPage(
    firstPageUrl: string,
    generatedDate: string,
    pageNumber: number
  ): Promise<Buffer> {
    const domain = this.getDomainFromUrl(firstPageUrl);
    const template = this.loadTemplate("cover");

    const html = this.replaceTemplateVars(template, {
      COMPANY_NAME: domain,
      COMPANY_URL: firstPageUrl,
      GENERATED_DATE: generatedDate,
      PAGE_NUMBER: pageNumber.toString().padStart(2, "0"),
    });

    return await this.htmlToPDF(html);
  }

  /**
   * Executive Summary 페이지 생성
   */
  private async generateExecutiveSummaryPage(
    aiSummary: AISummary,
    domain: string,
    generatedDate: string,
    pageNumber: number
  ): Promise<Buffer> {
    const template = this.loadTemplate("executive-summary");

    // Problem Solved 항목 생성
    const problemSolvedText = aiSummary.problemSolved || "N/A";
    const problemSolvedItems = `
      <li class="problem-solved-item">
        <span class="material-symbols-outlined check-icon">check_circle</span>
        <span>${this.escapeHtml(problemSolvedText)}</span>
      </li>
    `;

    // Products & Services 생성
    const productsServices =
      (aiSummary.mainServices || [])
        .slice(0, 3)
        .map(
          (service) =>
            `<div class="product-item">
            <p class="product-name">${this.escapeHtml(service)}</p>
            <p class="product-desc">Core service offering</p>
          </div>`
        )
        .join("") ||
      '<div class="product-item"><p class="product-name">N/A</p></div>';

    // Target Customers 생성
    const targetCustomers = (aiSummary.targetCustomers || [])
      .map((customer) => `<span class="customer-tag">${customer}</span>`)
      .join("");

    const html = this.replaceTemplateVars(template, {
      DOMAIN_NAME: domain,
      GENERATED_DATE: generatedDate,
      COMPANY_OVERVIEW: this.escapeHtml(
        aiSummary.overview || aiSummary.oneLineSummary || "N/A"
      ),
      PROBLEM_SOLVED_ITEMS: problemSolvedItems,
      KEY_DIFFERENTIATORS: this.escapeHtml(
        (aiSummary.uniqueFeatures || []).join(", ") || "N/A"
      ),
      PRODUCTS_SERVICES: productsServices,
      TARGET_CUSTOMERS:
        targetCustomers || '<span class="customer-tag">N/A</span>',
      STAT_VALUE: "80%",
      STAT_LABEL: "Time Reduction",
      STAT_DESC: "Average savings in report generation time per analyst.",
      PAGE_NUMBER: pageNumber.toString().padStart(2, "0"),
    });

    return await this.htmlToPDF(html);
  }

  /**
   * 목차 페이지 생성
   */
  private async generateTOCPage(
    tocItems: TableOfContentsItem[],
    domain: string,
    generatedDate: string,
    pageNumber: number,
    reportId: string
  ): Promise<Buffer> {
    const template = this.loadTemplate("toc");

    const tocItemsHTML = tocItems
      .map((item, index) => {
        const isMainItem = !item.title.includes(".");
        const number = isMainItem
          ? String(index + 1).padStart(2, "0")
          : item.title.split(".")[0];

        if (isMainItem) {
          return `
            <div class="toc-item">
              <span class="toc-number">${number}</span>
              <span class="toc-title">${item.title}</span>
              <div class="toc-leader"></div>
              <span class="toc-page">${item.pageNumber}</span>
            </div>
          `;
        } else {
          return `
            <div class="toc-subitem">
              <span class="toc-subnumber">${number}</span>
              <span class="toc-subtitle">${item.title.replace(
                /^\d+\.\d+\s*/,
                ""
              )}</span>
              <div class="toc-subleader"></div>
              <span class="toc-subpage">${item.pageNumber}</span>
            </div>
          `;
        }
      })
      .join("");

    const html = this.replaceTemplateVars(template, {
      DOMAIN_NAME: domain,
      GENERATED_DATE: generatedDate,
      TOC_ITEMS: tocItemsHTML,
      REPORT_ID: reportId,
      PAGE_NUMBER: pageNumber.toString().padStart(2, "0"),
    });

    return await this.htmlToPDF(html);
  }

  /**
   * 상세 섹션 페이지 생성
   */
  private async generateDetailedSectionPage(
    sectionTitle: string,
    sectionNumber: string,
    content: string,
    aiSummary?: string,
    domain?: string,
    generatedDate?: string,
    pageNumber?: number
  ): Promise<Buffer> {
    const template = this.loadTemplate("detailed-section");

    const aiSummaryBox = aiSummary
      ? `
        <div class="ai-summary-box">
          <div class="ai-summary-header">
            <span class="material-symbols-outlined ai-icon">auto_awesome</span>
            <h3 class="ai-summary-title">AI Executive Summary</h3>
          </div>
          <p class="ai-summary-text">${aiSummary}</p>
        </div>
      `
      : "";

    // 콘텐츠가 비어있으면 빈 페이지 생성 방지
    if (
      !content ||
      content.trim() === "" ||
      content.trim() ===
        '<div class="content-section"><p class="content-text">No content available.</p></div>'
    ) {
      return Buffer.alloc(0); // 빈 버퍼 반환 (나중에 필터링)
    }

    const html = this.replaceTemplateVars(template, {
      DOMAIN_NAME: domain || "N/A",
      GENERATED_DATE: generatedDate || "N/A",
      SECTION_NUMBER: sectionNumber,
      SECTION_TITLE: sectionTitle,
      AI_SUMMARY_BOX: aiSummaryBox,
      CONTENT_SECTIONS: content,
      PAGE_NUMBER: (pageNumber || 1).toString().padStart(2, "0"),
      PAGE_NUMBER_START: (pageNumber || 1).toString(),
    });

    return await this.htmlToPDF(html);
  }

  /**
   * 부록 페이지 생성 (스크린샷)
   */
  private async generateAppendixPage(
    pages: CrawledPage[],
    domain: string,
    generatedDate: string,
    reportTitle: string,
    reportId: string,
    sectionNumber: string,
    pageNumber: number
  ): Promise<Buffer> {
    const template = this.loadTemplate("appendix");

    const screenshotItems = pages
      .filter((page) => page.screenshot)
      .map((page) => {
        const screenshotBase64 = page.screenshot
          ? `data:image/jpeg;base64,${page.screenshot.toString("base64")}`
          : "";

        return `
          <div class="screenshot-item">
            <div class="screenshot-header">
              <h3 class="screenshot-title">${page.title || "Untitled"}</h3>
              <span class="screenshot-url">${page.url}</span>
            </div>
            <div class="screenshot-image-container">
              <div class="screenshot-image">
                <img src="${screenshotBase64}" alt="${
          page.title || "Screenshot"
        }" />
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // 스크린샷이 없으면 빈 페이지 생성 방지
    if (!screenshotItems || screenshotItems.trim() === "") {
      return Buffer.alloc(0);
    }

    const html = this.replaceTemplateVars(template, {
      REPORT_TITLE: reportTitle,
      REPORT_ID: reportId,
      SECTION_NUMBER: sectionNumber,
      GENERATED_DATE: generatedDate,
      SCREENSHOT_ITEMS: screenshotItems,
      PAGE_NUMBER: pageNumber.toString().padStart(2, "0"),
      PAGE_NUMBER_START: pageNumber.toString(),
    });

    return await this.htmlToPDF(html);
  }

  /**
   * 단일 HTML 템플릿을 사용한 통합 PDF 생성 (메인 함수)
   */
  async generatePDFs(
    pages: CrawledPage[],
    aiSummary?: AISummary | null,
    crawlMode?: 'full' | 'smart'
  ): Promise<PDFResult> {
    try {
      await this.initBrowser();

      const firstPageUrl = pages[0]?.url || "";
      const domain = this.getDomainFromUrl(firstPageUrl);
      const generatedDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const reportId = `SPD-${Date.now().toString().slice(-8)}`;

      // 스크린샷이 있는 페이지 필터링
      const pagesWithScreenshots = pages.filter((page) => page.screenshot);

      // TOC 항목 생성
      const tocItems: TableOfContentsItem[] = [];

      // Executive Summary는 page 1
      if (aiSummary) {
        tocItems.push({ title: "Executive Summary", url: "AI Summary", pageNumber: 1 });
      }

      // 각 크롤링된 페이지를 목차에 추가 (page 2부터 시작)
      let pageNumber = 2;
      pagesWithScreenshots.forEach((page, index) => {
        tocItems.push({
          title: page.title || page.url,
          url: page.url,
          pageNumber: pageNumber,
        });
        pageNumber++;
      });

      // all-in-one.html 템플릿 로드
      const template = this.loadTemplate("all-in-one");

      // 변수 맵 구성
      const vars: Record<string, string> = {
        COMPANY_NAME: domain,
        COMPANY_URL: firstPageUrl,
        GENERATED_DATE: generatedDate,
        DOMAIN_NAME: domain,
        REPORT_ID: reportId,
        COMPANY_OVERVIEW: this.escapeHtml(
          aiSummary?.overview || aiSummary?.oneLineSummary || "N/A"
        ),
        PROBLEM_SOLVED_ITEMS: this.buildProblemSolvedItems(aiSummary),
        KEY_DIFFERENTIATORS: this.escapeHtml(
          (aiSummary?.uniqueFeatures || []).join(", ") || "N/A"
        ),
        PRODUCTS_SERVICES: this.buildProductsServices(aiSummary),
        TARGET_CUSTOMERS: this.buildTargetCustomers(aiSummary),
        STAT_VALUE: "80%",
        STAT_LABEL: "Time Reduction",
        STAT_DESC: "Average savings in report generation time per analyst.",
        TOC_ITEMS: this.buildTocItems(tocItems),
        PAGE_SECTIONS: this.buildPageSections(pagesWithScreenshots, domain, generatedDate),
      };

      // 템플릿 변수 치환
      const html = this.replaceTemplateVars(template, vars);

      // 단일 PDF 생성
      const pdfBuffer = await this.htmlToPDF(html);
      const totalSize = pdfBuffer.length;

      // 스크린샷 PDF 생성
      console.log("[PDF] 스크린샷 PDF 생성 시작...");
      const screenshotPdf = await this.generateScreenshotPDF(
        pages, // 모든 페이지 전달 (필터링은 generateScreenshotPDF에서 수행)
        domain,
        generatedDate,
        crawlMode // 크롤링 모드 전달
      );
      console.log("[PDF] 스크린샷 PDF 생성 완료");

      // 개별 PDF 생성 (전체 PDF를 각 섹션으로 분리)
      const individualPdfs: Buffer[] = [pdfBuffer]; // 현재는 전체 PDF만 반환

      // PDFResult 타입에 맞춰 반환
      return {
        mergedPdf: pdfBuffer,
        individualPdfs: individualPdfs,
        tableOfContents: tocItems,
        totalSize,
        warnings: [],
        screenshotPdf, // 스크린샷 PDF 추가
      };
    } finally {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  /**
   * Problem Solved 항목 HTML 생성
   */
  private buildProblemSolvedItems(aiSummary?: AISummary | null): string {
    if (!aiSummary?.problemSolved) {
      return `
        <li class="problem-solved-item">
          <span class="material-symbols-outlined check-icon">check_circle</span>
          <span>N/A</span>
        </li>
      `;
    }

    return `
      <li class="problem-solved-item">
        <span class="material-symbols-outlined check-icon">check_circle</span>
        <span>${this.escapeHtml(aiSummary.problemSolved)}</span>
      </li>
    `;
  }

  /**
   * Products & Services HTML 생성
   */
  private buildProductsServices(aiSummary?: AISummary | null): string {
    if (!aiSummary?.mainServices || aiSummary.mainServices.length === 0) {
      return '<div class="product-item"><p class="product-name">N/A</p></div>';
    }

    return aiSummary.mainServices
      .slice(0, 3)
      .map(
        (service) => `
          <div class="product-item">
            <p class="product-name">${this.escapeHtml(service)}</p>
            <p class="product-desc">Core service offering</p>
          </div>
        `
      )
      .join("");
  }

  /**
   * Target Customers HTML 생성
   */
  private buildTargetCustomers(aiSummary?: AISummary | null): string {
    if (!aiSummary?.targetCustomers || aiSummary.targetCustomers.length === 0) {
      return '<span class="customer-tag">N/A</span>';
    }

    return aiSummary.targetCustomers
      .map((customer) => `<span class="customer-tag">${this.escapeHtml(customer)}</span>`)
      .join("");
  }

  /**
   * TOC Items HTML 생성
   */
  private buildTocItems(tocItems: TableOfContentsItem[]): string {
    return tocItems
      .map((item, index) => {
        return `
          <div class="toc-item">
            <span class="toc-number">-</span>
            <span class="toc-title">${this.escapeHtml(item.title)}</span>
            <div class="toc-leader"></div>
            <span class="toc-page">page ${item.pageNumber}</span>
          </div>
        `;
      })
      .join("");
  }

  /**
   * URL에서 페이지 타입 감지
   */
  private detectPageType(url: string): { type: string; color: string } {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();

      // Homepage detection
      if (pathname === '/' || pathname === '/index' || pathname === '/home' || pathname === '/index.html') {
        return { type: 'Homepage', color: '#eff6ff' };
      }

      // Product pages
      if (pathname.includes('/product') || pathname.includes('/shop') || pathname.includes('/buy') || pathname.includes('/store')) {
        return { type: 'Product', color: '#f0fdf4' };
      }

      // Contact pages
      if (pathname.includes('/contact') || pathname.includes('/support') || pathname.includes('/help')) {
        return { type: 'Contact', color: '#fef3c7' };
      }

      // About pages
      if (pathname.includes('/about') || pathname.includes('/team') || pathname.includes('/company')) {
        return { type: 'About', color: '#fce7f3' };
      }

      // Blog/News pages
      if (pathname.includes('/blog') || pathname.includes('/news') || pathname.includes('/article') || pathname.includes('/post')) {
        return { type: 'Blog/News', color: '#f3e8ff' };
      }

      // Pricing pages
      if (pathname.includes('/pricing') || pathname.includes('/plans') || pathname.includes('/price')) {
        return { type: 'Pricing', color: '#dbeafe' };
      }

      // Documentation pages
      if (pathname.includes('/docs') || pathname.includes('/documentation') || pathname.includes('/guide')) {
        return { type: 'Documentation', color: '#e0f2fe' };
      }

      // Default
      return { type: 'General', color: '#f1f5f9' };
    } catch {
      return { type: 'General', color: '#f1f5f9' };
    }
  }

  /**
   * 퀵 인사이트 생성 (AI 요약의 핵심 1-2문장)
   */
  private generateQuickInsight(aiSummary: string): string {
    // AI 요약의 첫 2문장을 추출
    const sentences = aiSummary.split(/[.!?]\s+/);
    const insight = sentences.slice(0, 2).join('. ');
    return insight.length > 150 ? insight.substring(0, 150) + '...' : insight + '.';
  }

  /**
   * 컨텐츠 길이를 읽기 쉬운 형태로 변환
   */
  private formatContentLength(content: string): string {
    const length = content.length;
    if (length < 1000) return `${length} chars`;
    if (length < 10000) return `${(length / 1000).toFixed(1)}k chars`;
    return `${(length / 1000).toFixed(0)}k chars`;
  }

  /**
   * Page Sections HTML 생성 (각 페이지별 썸네일 + AI 요약)
   */
  private buildPageSections(
    pages: CrawledPage[],
    domain: string,
    generatedDate: string
  ): string {
    if (pages.length === 0) {
      return "";
    }

    let pageNumber = 2; // Page sections start from page 2 (after Executive Summary = page 1)
    const sections: string[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      // 스크린샷을 base64로 인코딩
      const screenshotBase64 = page.screenshot
        ? `data:image/jpeg;base64,${page.screenshot.toString("base64")}`
        : "";

      // AI 요약 (없으면 기본 메시지)
      const aiSummary = page.pageSummary || "No AI summary available for this page.";

      // 페이지 타입 감지
      const pageType = this.detectPageType(page.url);

      // 퀵 인사이트 생성
      const quickInsight = this.generateQuickInsight(aiSummary);

      // 메타데이터 추출
      const crawlTime = page.timestamp
        ? new Date(page.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Unknown';
      const depth = page.depth || 0;
      const contentLength = this.formatContentLength(page.content || '');

      sections.push(`
        <div class="page page-section">
          <div class="page-section-header">
            <div class="header-left">
              <div class="analysis-for-label">Analysis For</div>
              <div class="analysis-domain">${domain}</div>
            </div>
            <div class="header-right">
              <div class="date-label">Date Generated</div>
              <div class="date-value">${generatedDate}</div>
            </div>
          </div>
          <article class="page-section-article">
            <div class="page-title-section">
              <span class="page-number-label">Page ${i + 1}</span>
              <h2>${this.escapeHtml(page.title || "Untitled")}</h2>
              <div class="page-url">${this.escapeHtml(page.url)}</div>
            </div>

            <!-- 그리드 레이아웃: 썸네일 + 메타데이터 -->
            <div class="page-overview-grid">
              <!-- 왼쪽: 썸네일 -->
              <div class="screenshot-thumbnail">
                <img src="${screenshotBase64}" alt="${this.escapeHtml(page.title || "Screenshot")}">
              </div>

              <!-- 오른쪽: 메타데이터 -->
              <div class="page-metadata">
                <div>
                  <span class="page-type-badge" style="background: ${pageType.color};">${pageType.type}</span>
                </div>
                <div class="metadata-card">
                  <div class="metadata-label">Page Information</div>
                  <div class="metadata-items">
                    <div class="metadata-item">
                      <span class="metadata-icon">📅</span>
                      <div>
                        <div class="metadata-item-label">Crawled</div>
                        <div class="metadata-item-value">${crawlTime}</div>
                      </div>
                    </div>
                    <div class="metadata-item">
                      <span class="metadata-icon">🔗</span>
                      <div>
                        <div class="metadata-item-label">Depth Level</div>
                        <div class="metadata-item-value">Level ${depth}</div>
                      </div>
                    </div>
                    <div class="metadata-item">
                      <span class="metadata-icon">📊</span>
                      <div>
                        <div class="metadata-item-label">Content Size</div>
                        <div class="metadata-item-value">${contentLength}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 퀵 인사이트 -->
            <div class="quick-insights">
              <div class="quick-insights-icon">💡</div>
              <div class="quick-insights-content">
                <div class="quick-insights-label">Quick Insight</div>
                <div class="quick-insights-text">${this.escapeHtml(quickInsight)}</div>
              </div>
            </div>

            <!-- 전체 AI 요약 -->
            <div class="ai-summary-box">
              <div class="ai-summary-header">
                <span class="material-symbols-outlined ai-icon">psychology</span>
                <span class="ai-summary-title">AI Page Summary</span>
              </div>
              <div class="ai-summary-text">${this.escapeHtml(aiSummary)}</div>
            </div>
          </article>
          <div class="page-section-footer">
            <div class="footer-left">
              <span class="material-symbols-outlined lock-icon">lock</span>
              <span>CONFIDENTIAL - SiteToPDF Analysis Report</span>
            </div>
            <div class="page-number">Page ${pageNumber}</div>
          </div>
        </div>
      `);

      pageNumber++;
    }

    return sections.join("\n");
  }

  /**
   * 스크린샷 PDF 생성 (별도 PDF)
   */
  private async generateScreenshotPDF(
    pages: CrawledPage[],
    domain: string,
    generatedDate: string,
    crawlMode?: 'full' | 'smart'
  ): Promise<Buffer> {
    if (pages.length === 0) {
      return Buffer.alloc(0);
    }

    // 크롤링 모드에 따라 페이지 필터링
    // Full 모드: 모든 페이지 포함 (법적 증거 보존)
    // Smart 모드: 중요한 페이지만 포함 (defaultChecked !== false)
    const filteredPages = crawlMode === 'full'
      ? pages // Full 모드: 모든 페이지
      : pages.filter(p => p.defaultChecked !== false); // Smart 모드: 중요 페이지만

    console.log(`[PDF] 스크린샷 PDF 생성 (${crawlMode || 'smart'} 모드): ${filteredPages.length}/${pages.length}페이지`);

    if (filteredPages.length === 0) {
      return Buffer.alloc(0);
    }

    const template = this.loadTemplate("screenshot-pdf");

    // 스크린샷 페이지들 생성
    const screenshotPages = filteredPages
      .map((page, index) => {
        const screenshotBase64 = page.screenshot
          ? `data:image/jpeg;base64,${page.screenshot.toString("base64")}`
          : "";

        const pageNumber = index + 2; // Cover is page 1

        return `
          <div class="page screenshot-page">
            <div class="screenshot-header">
              <div class="screenshot-page-number">Screenshot ${index + 1} of ${filteredPages.length}</div>
              <h2 class="screenshot-title">${this.escapeHtml(page.title || "Untitled")}</h2>
              <div class="screenshot-url">${this.escapeHtml(page.url)}</div>
            </div>
            <div class="screenshot-container">
              <img src="${screenshotBase64}" alt="${this.escapeHtml(page.title || "Screenshot")}" class="screenshot-image">
            </div>
            <div class="screenshot-footer">
              <div class="screenshot-footer-left">
                <span class="screenshot-timestamp">Captured on ${generatedDate}</span>
              </div>
              <div class="screenshot-footer-right">Page ${pageNumber}</div>
            </div>
          </div>
        `;
      })
      .join("");

    const html = this.replaceTemplateVars(template, {
      DOMAIN_NAME: domain,
      TOTAL_PAGES: filteredPages.length.toString(),
      GENERATED_DATE: generatedDate,
      SCREENSHOT_PAGES: screenshotPages,
    });

    return await this.htmlToPDF(html);
  }

  /**
   * 개별 Detailed Section HTML 생성
   */
  private buildDetailedSection(
    title: string,
    sectionNumber: string,
    content: string,
    aiSummaryText?: string,
    domain?: string,
    generatedDate?: string,
    pageNumber?: number
  ): string {
    const aiSummaryBox = aiSummaryText
      ? `
        <div class="ai-summary-box">
          <div class="ai-summary-header">
            <span class="material-symbols-outlined ai-icon">auto_awesome</span>
            <h3 class="ai-summary-title">AI Executive Summary</h3>
          </div>
          <p class="ai-summary-text">${this.escapeHtml(aiSummaryText)}</p>
        </div>
      `
      : "";

    return `
      <div class="page detailed-page">
        <div class="detailed-header">
          <div class="header-left">
            <div class="analysis-for-label">Analysis For</div>
            <div class="analysis-domain">${domain || "N/A"}</div>
          </div>
          <div class="header-right">
            <div class="date-label">Date Generated</div>
            <div class="date-value">${generatedDate || "N/A"}</div>
          </div>
        </div>
        <article class="detailed-article">
          <div class="detailed-section-header">
            <span class="section-number">${sectionNumber}</span>
            <h2>${this.escapeHtml(title)}</h2>
          </div>
          ${aiSummaryBox}
          <div class="content-columns">
            ${content}
          </div>
        </article>
        <div class="detailed-footer">Page ${pageNumber || 4}</div>
      </div>
    `;
  }

  /**
   * Appendix Section HTML 생성
   */
  private buildAppendixSection(
    pages: CrawledPage[],
    domain: string,
    generatedDate: string,
    reportId: string,
    pageNumber?: number
  ): string {
    if (pages.length === 0) {
      return "";
    }

    const screenshotItems = pages
      .map((page) => {
        const screenshotBase64 = page.screenshot
          ? `data:image/jpeg;base64,${page.screenshot.toString("base64")}`
          : "";

        return `
          <div class="screenshot-item">
            <div class="screenshot-header">
              <h3 class="screenshot-title">${this.escapeHtml(page.title || "Untitled")}</h3>
              <span class="screenshot-url">${this.escapeHtml(page.url)}</span>
            </div>
            <div class="screenshot-image-container">
              <div class="screenshot-image">
                <img src="${screenshotBase64}" alt="${this.escapeHtml(page.title || "Screenshot")}" />
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="page appendix-page">
        <div class="appendix-header">
          <span class="report-title">${this.escapeHtml(domain)} Analysis</span>
          <div class="report-number">
            <span>Report #${reportId}</span>
          </div>
        </div>
        <div class="title-section">
          <div class="section-number">
            <span class="section-number-label">/Appendix</span>
            <h2>Website Evidence</h2>
          </div>
          <p class="section-description">
            Digital evidence captured during the automated due diligence process. These snapshots confirm the visible state of key pages at the time of report generation.
          </p>
        </div>
        <div class="screenshots-grid">
          ${screenshotItems}
        </div>
        <div class="appendix-footer">
          <div class="footer-left">
            <span>Generated ${generatedDate}</span>
          </div>
          <div class="appendix-footer-right">Page ${pageNumber || 6}</div>
        </div>
      </div>
    `;
  }

  /**
   * HTML 이스케이프
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * 상세 콘텐츠 포맷팅
   */
  private formatDetailedContent(items: any[]): string {
    if (!items || items.length === 0) {
      return '<div class="content-section"><p class="content-text">No content available.</p></div>';
    }

    return items
      .map((item, index) => {
        const name =
          typeof item === "string" ? item : item.name || `Item ${index + 1}`;
        const description =
          typeof item === "string" ? "" : item.description || "";
        return `
          <div class="content-section">
            <h4 class="content-subtitle">${this.escapeHtml(name)}</h4>
            ${
              description
                ? `<p class="content-text">${this.escapeHtml(description)}</p>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
