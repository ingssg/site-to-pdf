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

      // 종합 분석 요약은 page 1
      if (aiSummary) {
        tocItems.push({ title: "종합 분석 요약", url: "AI Summary", pageNumber: 1 });
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
        GROWTH_OPPORTUNITIES: this.buildGrowthOpportunities(aiSummary),
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
        pages, // 전달된 모든 페이지 포함 (이미 선택된 페이지만 전달됨)
        domain,
        generatedDate,
        crawlMode
      );
      console.log("[PDF] 스크린샷 PDF 생성 완료");

      // 개별 페이지별 PDF 생성
      console.log("[PDF] 개별 페이지 PDF 생성 시작...");
      const individualPdfs: Buffer[] = await this.generateIndividualPagePDFs(
        pagesWithScreenshots,
        domain,
        generatedDate
      );
      console.log(`[PDF] ${individualPdfs.length}개 개별 페이지 PDF 생성 완료`);

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
   * Growth Opportunities HTML 생성
   */
  private buildGrowthOpportunities(aiSummary?: AISummary | null): string {
    if (!aiSummary?.growthOpportunities || aiSummary.growthOpportunities.length === 0) {
      return '<p style="color: #64748b; font-size: 12px;">정보 없음</p>';
    }

    return `
      <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
        ${aiSummary.growthOpportunities
          .map(
            (opportunity) => `
          <li style="display: flex; align-items: start; gap: 8px; font-size: 11px; line-height: 1.6; color: #334155;">
            <span style="color: #10b981; margin-top: 2px;">📈</span>
            <span>${this.escapeHtml(opportunity)}</span>
          </li>
        `
          )
          .join("")}
      </ul>
    `;
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

      // AI 비즈니스 인사이트 (없으면 기본 메시지)
      const aiInsight = page.pageSummary || "비즈니스 인사이트를 생성할 수 없습니다.";

      // 페이지 타입 감지
      const pageType = this.detectPageType(page.url);

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

            <!-- 스크린샷 -->
            <div class="screenshot-container">
              <img src="${screenshotBase64}" alt="${this.escapeHtml(page.title || "Screenshot")}">
            </div>

            <!-- 페이지 타입 배지 -->
            <div class="page-type-container">
              <span class="page-type-badge" style="background: ${pageType.color};">${pageType.type}</span>
            </div>

            <!-- AI 비즈니스 인사이트 -->
            <div class="business-insights-box">
              <div class="business-insights-header">
                <span class="material-symbols-outlined ai-icon">insights</span>
                <span class="business-insights-title">Business Insights</span>
              </div>
              <div class="business-insights-text">${aiInsight}</div>
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

    // 전달된 페이지는 이미 사용자가 선택한 페이지이므로 모두 포함
    // (PageSelector에서 AI 또는 수동으로 선택한 페이지만 전달됨)
    const filteredPages = pages;

    console.log(`[PDF] 스크린샷 PDF 생성: ${filteredPages.length}페이지`);

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
   * 개별 페이지별 PDF 생성 (page-section.html 템플릿 사용)
   */
  private async generateIndividualPagePDFs(
    pages: CrawledPage[],
    domain: string,
    generatedDate: string
  ): Promise<Buffer[]> {
    const individualPdfs: Buffer[] = [];
    const template = this.loadTemplate("page-section");

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageType = this.detectPageType(page.url);

      // 스크린샷을 base64로 인코딩
      const screenshotBase64 = page.screenshot
        ? `data:image/jpeg;base64,${page.screenshot.toString("base64")}`
        : "";

      // AI 비즈니스 인사이트
      const aiInsight = page.pageSummary || "비즈니스 인사이트를 생성할 수 없습니다.";

      // 변수 맵 구성
      const vars: Record<string, string> = {
        DOMAIN_NAME: domain,
        GENERATED_DATE: generatedDate,
        PAGE_INDEX: (i + 1).toString(),
        PAGE_TITLE: this.escapeHtml(page.title || "Untitled"),
        PAGE_URL: this.escapeHtml(page.url),
        SCREENSHOT_DATA_URL: screenshotBase64,
        PAGE_TYPE: pageType.type,
        PAGE_TYPE_COLOR: pageType.color,
        AI_SUMMARY: aiInsight, // pre-wrap이 적용되어 마크다운 포맷 유지
        PDF_PAGE_NUMBER: (i + 1).toString(),
      };

      // 템플릿 변수 치환
      const html = this.replaceTemplateVars(template, vars);

      // PDF 생성
      const pdfBuffer = await this.htmlToPDF(html);
      individualPdfs.push(pdfBuffer);
    }

    return individualPdfs;
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
