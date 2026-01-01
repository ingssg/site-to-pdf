/**
 * PDF 생성 및 병합 유틸리티
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as fontkit from "@pdf-lib/fontkit";
import * as fs from "fs";
import * as path from "path";
import type {
  AISummary,
  CrawledPage,
  PDFGenerationOptions,
  PDFResult,
  TableOfContentsItem,
} from "@/types";

export class PDFGenerator {
  private options: PDFGenerationOptions;
  private warnings: string[] = [];

  constructor(options: PDFGenerationOptions) {
    this.options = {
      pageSize: "A4",
      orientation: "portrait",
      quality: "medium",
      ...options, // includeTableOfContents는 options에서 필수로 제공됨
    };
  }

  /**
   * 크롤링된 페이지들로부터 PDF 생성 (최적화: 폰트 1회 임베드)
   */
  async generatePDFs(
    pages: CrawledPage[],
    aiSummary?: AISummary | null
  ): Promise<PDFResult> {
    // 하나의 PDF 문서 생성 (폰트 중복 방지)
    const pdfDoc = await PDFDocument.create();

    // fontkit 등록
    const fontkitToRegister = (fontkit as any).default || fontkit;
    pdfDoc.registerFontkit(fontkitToRegister);
    console.log("[PDF] fontkit 등록 성공");

    // 폰트 1회만 로드 (9.9MB → 재사용)
    const { regularFont, boldFont } = await this.loadFonts(pdfDoc);
    console.log("[PDF] 폰트 로드 완료 - 모든 페이지에서 재사용");

    const tableOfContents: TableOfContentsItem[] = [];
    let pageNumber = 1;

    // AI 요약 페이지 추가 (첫 페이지)
    if (aiSummary) {
      await this.addAISummaryPage(pdfDoc, aiSummary, regularFont, boldFont);
      pageNumber++;
    }

    // 목차 페이지 추가 (옵션)
    if (this.options.includeTableOfContents) {
      // 목차 항목 생성 (AI 요약 포함)
      const tocItems: TableOfContentsItem[] = [];

      // AI 요약을 첫 번째 항목으로 추가
      if (aiSummary) {
        tocItems.push({
          title: 'AI Business Analysis',
          url: 'AI Summary',
          pageNumber: 1,
        });
      }

      // 나머지 페이지들 추가
      pages.forEach((page, idx) => {
        tocItems.push({
          title: page.title || page.url,
          url: page.url,
          pageNumber: idx + 1 + (aiSummary ? 1 : 0) + 1,  // AI요약(1) + 목차(1) + 현재페이지
        });
      });

      const tocPageCount = await this.addTableOfContents(
        pdfDoc,
        tocItems,
        regularFont,
        boldFont
      );
      pageNumber += tocPageCount;
    }

    // 각 페이지를 통합 PDF에 직접 추가 (폰트 재사용)
    for (const page of pages) {
      await this.addPageToPDF(pdfDoc, page, regularFont, boldFont);

      tableOfContents.push({
        title: page.title || page.url,
        url: page.url,
        pageNumber: pageNumber,
      });

      pageNumber++;
    }

    // 통합 PDF 저장
    const mergedPdfBytes = await pdfDoc.save();
    const mergedPdf = Buffer.from(mergedPdfBytes);

    console.log(
      `[PDF] 통합 PDF 생성 완료: ${(mergedPdf.length / 1024 / 1024).toFixed(
        2
      )}MB (폰트 1회 임베드)`
    );

    // 개별 PDF 추출 (통합 PDF에서 페이지별로 분리)
    const individualPdfs = await this.extractIndividualPDFs(
      pdfDoc,
      aiSummary ? 1 : 0,
      this.options.includeTableOfContents ? 1 : 0
    );

    return {
      mergedPdf,
      individualPdfs,
      tableOfContents,
      totalSize: mergedPdf.length,
      warnings: this.warnings.length > 0 ? [...this.warnings] : undefined,
    };
  }

  /**
   * PDF 문서에 페이지 추가 (폰트 재사용)
   */
  private async addPageToPDF(
    pdfDoc: PDFDocument,
    page: CrawledPage,
    regularFont: any,
    boldFont: any
  ): Promise<void> {
    if (page.screenshot) {
      // 1. 스크린샷 페이지 (A4 사이즈에 맞춤)
      const image = await pdfDoc.embedPng(page.screenshot);

      // A4 사이즈 (595 x 842)
      const A4_WIDTH = 595;
      const A4_HEIGHT = 842;
      const MARGIN = 40;

      const maxWidth = A4_WIDTH - 2 * MARGIN;
      const maxHeight = A4_HEIGHT - 2 * MARGIN;

      // 이미지 비율 계산
      const imageRatio = image.width / image.height;
      const pageRatio = maxWidth / maxHeight;

      let drawWidth, drawHeight;

      if (imageRatio > pageRatio) {
        // 이미지가 더 넓음 -> 가로 기준으로 맞춤
        drawWidth = maxWidth;
        drawHeight = maxWidth / imageRatio;
      } else {
        // 이미지가 더 높음 -> 세로 기준으로 맞춤
        drawHeight = maxHeight;
        drawWidth = maxHeight * imageRatio;
      }

      // A4 페이지 생성
      const imagePage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

      // 중앙 정렬
      const x = (A4_WIDTH - drawWidth) / 2;
      const y = (A4_HEIGHT - drawHeight) / 2;

      imagePage.drawImage(image, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      });

      // 2. 페이지 요약 페이지 (AI 분석 결과)
      if (page.pageSummary) {
        await this.addPageSummaryPage(pdfDoc, page, regularFont, boldFont);
      }
    } else {
      // Fast/Standard 모드: 텍스트 콘텐츠를 PDF로 렌더링
      await this.addTextBasedPage(pdfDoc, page, regularFont, boldFont);
    }
  }

  /**
   * 페이지 요약 페이지 추가 (스크린샷 다음 페이지)
   */
  private async addPageSummaryPage(
    pdfDoc: PDFDocument,
    page: CrawledPage,
    regularFont: any,
    boldFont: any
  ): Promise<void> {
    const pageWidth = 595; // A4
    const pageHeight = 842;
    const margin = 60;
    const summaryPage = pdfDoc.addPage([pageWidth, pageHeight]);

    let yPosition = pageHeight - margin;

    // 제목: "페이지 요약"
    summaryPage.drawText('📄 페이지 요약', {
      x: margin,
      y: yPosition,
      size: 20,
      font: boldFont,
      color: rgb(0, 0.4, 0.8),
    });
    yPosition -= 40;

    // 페이지 제목
    const title = page.title || 'Untitled';
    const maxWidth = pageWidth - 2 * margin;
    const titleLines = this.wrapText(title, boldFont, 16, maxWidth);
    for (const line of titleLines) {
      summaryPage.drawText(line, {
        x: margin,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 24;
    }

    // URL
    yPosition -= 10;
    const urlLines = this.wrapText(page.url, regularFont, 10, maxWidth);
    for (const urlLine of urlLines) {
      summaryPage.drawText(urlLine, {
        x: margin,
        y: yPosition,
        size: 10,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 14;
    }
    yPosition -= 16;

    // 구분선
    summaryPage.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: pageWidth - margin, y: yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    yPosition -= 30;

    // AI 요약 텍스트
    const summary = page.pageSummary || '요약 없음';
    const summaryLines = this.wrapText(summary, regularFont, 14, maxWidth);

    for (const line of summaryLines) {
      if (yPosition < margin + 20) {
        // 페이지 넘김 필요
        break;
      }
      summaryPage.drawText(line, {
        x: margin,
        y: yPosition,
        size: 14,
        font: regularFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 22;
    }

    // 하단 워터마크
    summaryPage.drawText('AI로 생성된 요약입니다', {
      x: margin,
      y: 30,
      size: 9,
      font: regularFont,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  /**
   * 텍스트 기반 PDF 페이지 추가 (Fast/Standard 모드) - 폰트 재사용
   */
  private async addTextBasedPage(
    pdfDoc: PDFDocument,
    page: CrawledPage,
    koreanFont: any,
    titleFont: any
  ): Promise<void> {

    // A4 페이지 생성
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 50;
    const maxWidth = pageWidth - 2 * margin;
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // 제목 렌더링
    const title = page.title || "Untitled";
    const titleSize = 18;
    yPosition -= titleSize;
    currentPage.drawText(title.substring(0, 100), {
      x: margin,
      y: yPosition,
      size: titleSize,
      font: titleFont,
      color: rgb(0, 0, 0),
      maxWidth,
    });

    // URL 렌더링
    yPosition -= 25;
    currentPage.drawText(page.url.substring(0, 80), {
      x: margin,
      y: yPosition,
      size: 9,
      font: koreanFont,
      color: rgb(0.4, 0.4, 0.4),
      maxWidth,
    });

    // 구분선
    yPosition -= 20;
    currentPage.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: pageWidth - margin, y: yPosition },
      color: rgb(0.8, 0.8, 0.8),
      thickness: 1,
    });

    // 콘텐츠 렌더링
    yPosition -= 30;
    const contentSize = 11;
    const lineHeight = contentSize + 4;

    // 텍스트를 줄바꿈하여 렌더링
    const content = page.content.trim();
    const lines = this.wrapText(content, koreanFont, contentSize, maxWidth);

    for (const line of lines) {
      // 페이지가 부족하면 새 페이지 추가
      if (yPosition < margin + lineHeight) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }

      currentPage.drawText(line, {
        x: margin,
        y: yPosition,
        size: contentSize,
        font: koreanFont,
        color: rgb(0, 0, 0),
        maxWidth,
      });

      yPosition -= lineHeight;
    }
  }

  /**
   * 통합 PDF에서 개별 페이지를 추출하여 개별 PDF 생성
   */
  private async extractIndividualPDFs(
    sourcePdf: PDFDocument,
    aiSummaryPages: number,
    tocPages: number
  ): Promise<Buffer[]> {
    const individualPdfs: Buffer[] = [];
    const totalPages = sourcePdf.getPageCount();
    const startPage = aiSummaryPages + tocPages;

    console.log(
      `[PDF] 개별 PDF 추출 시작 (${startPage + 1}페이지부터 ${totalPages}페이지까지)`
    );

    // AI 요약과 목차를 제외한 각 페이지를 개별 PDF로 추출
    for (let i = startPage; i < totalPages; i++) {
      const newPdf = await PDFDocument.create();

      // fontkit 등록
      const fontkitToRegister = (fontkit as any).default || fontkit;
      newPdf.registerFontkit(fontkitToRegister);

      // 페이지 복사 (폰트는 자동으로 포함됨)
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [i]);
      newPdf.addPage(copiedPage);

      const pdfBytes = await newPdf.save();
      individualPdfs.push(Buffer.from(pdfBytes));
    }

    console.log(`[PDF] ${individualPdfs.length}개 개별 PDF 추출 완료`);
    return individualPdfs;
  }

  /**
   * 텍스트를 특정 너비에 맞게 줄바꿈
   */
  private wrapText(
    text: string,
    font: any,
    fontSize: number,
    maxWidth: number
  ): string[] {
    const lines: string[] = [];
    const paragraphs = text.split("\n");

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        lines.push("");
        continue;
      }

      const words = paragraph.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    // 최대 300줄로 제한 (너무 긴 페이지 방지)
    return lines.slice(0, 300);
  }

  /**
   * 여러 PDF를 하나로 병합
   */
  private async mergePDFs(
    pdfs: Buffer[],
    toc: TableOfContentsItem[],
    pages: CrawledPage[],
    aiSummary?: AISummary | null
  ): Promise<Buffer> {
    const mergedPdf = await PDFDocument.create();

    // fontkit 등록 (커스텀 폰트 임베드에 필요)
    // 문서 생성 직후에 등록해야 함
    try {
      // fontkit이 default export인지 named export인지 확인
      const fontkitToRegister = (fontkit as any).default || fontkit;
      mergedPdf.registerFontkit(fontkitToRegister);
      console.log("[PDF] fontkit 등록 성공");
    } catch (error) {
      console.error("[PDF] fontkit 등록 에러:", error);
      throw error;
    }

    // 한글 폰트를 한 번만 로드하여 재사용 (중복 임베드 방지)
    const { regularFont, boldFont } = await this.loadFonts(mergedPdf);

    // AI 요약 페이지 추가 (첫 페이지)
    if (aiSummary) {
      await this.addAISummaryPage(mergedPdf, aiSummary, regularFont, boldFont);
    }

    // 목차 페이지 추가 (옵션)
    let tocPageCount = 0;
    if (this.options.includeTableOfContents) {
      tocPageCount = await this.addTableOfContents(mergedPdf, toc, regularFont, boldFont);
    }

    // 모든 PDF 페이지 병합 및 헤더 추가
    for (let i = 0; i < pdfs.length; i++) {
      const pdfBuffer = pdfs[i];
      const pageInfo = pages[i];

      const pdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

      for (const page of copiedPages) {
        mergedPdf.addPage(page);
        // 각 페이지 상단에 헤더 추가 (폰트 재사용)
        await this.addPageHeader(
          page,
          pageInfo,
          i + 1,
          pages.length,
          regularFont
        );
      }
    }

    // PDF 북마크 추가 (현재 pdf-lib의 저수준 API 이슈로 비활성화)
    // TODO: pdf-lib의 북마크 API가 안정화되면 다시 활성화
    // await this.addBookmarks(mergedPdf, toc, tocPageCount);

    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
  }

  /**
   * TTF 파일이 유효한지 확인 (TTF 시그니처 체크)
   */
  private isValidTTF(buffer: Buffer): boolean {
    // TTF 파일은 'OTTO' 또는 'ttcf' 또는 0x00010000으로 시작
    if (buffer.length < 4) return false;
    const signature = buffer.readUInt32BE(0);
    return (
      signature === 0x4f54544f || // 'OTTO'
      signature === 0x74746366 || // 'ttcf'
      signature === 0x00010000
    ); // TrueType
  }

  /**
   * 한글 폰트를 로드하여 PDF에 임베드 (한 번만 호출)
   */
  private async loadFonts(pdfDoc: PDFDocument): Promise<{
    regularFont: any;
    boldFont: any;
  }> {
    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NotoSansKR.ttf"
    );

    let regularFont;
    let boldFont;

    if (fs.existsSync(fontPath)) {
      try {
        const fontBytes = fs.readFileSync(fontPath);
        if (!this.isValidTTF(fontBytes)) {
          throw new Error("유효하지 않은 TTF 파일");
        }

        console.log("[PDF] 한글 폰트 임베드 시작 (1회)");
        regularFont = await pdfDoc.embedFont(fontBytes);
        boldFont = await pdfDoc.embedFont(fontBytes);
        console.log("[PDF] 한글 폰트 임베드 완료 (재사용됨)");
      } catch (error) {
        console.warn("[PDF] 한글 폰트 로드 실패, 표준 폰트 사용:", error);
        const warningMsg = "한글 폰트 로드 실패. 표준 폰트를 사용합니다.";
        this.warnings.push(warningMsg);
        regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      }
    } else {
      const warningMsg = "한글 폰트 파일을 찾을 수 없습니다. 표준 폰트를 사용합니다.";
      console.warn("[PDF]", warningMsg);
      this.warnings.push(warningMsg);
      regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    return { regularFont, boldFont };
  }

  /**
   * AI 요약 페이지 추가 (Executive Summary)
   */
  private async addAISummaryPage(
    pdfDoc: PDFDocument,
    aiSummary: AISummary,
    regularFont: any,
    boldFont: any
  ): Promise<void> {
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;

    // 타이틀
    page.drawText("AI Business Analysis", {
      x: margin,
      y: y,
      size: 24,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 40;

    // 웹사이트 타입 & 회사명
    const typeText = `[${aiSummary.websiteType}]`;
    page.drawText(typeText, {
      x: margin,
      y: y,
      size: 11,
      font: regularFont,
      color: rgb(0.4, 0.2, 0.6),
    });

    if (aiSummary.companyName) {
      const typeWidth = regularFont.widthOfTextAtSize(typeText, 11);
      page.drawText(aiSummary.companyName, {
        x: margin + typeWidth + 15,
        y: y,
        size: 11,
        font: boldFont,
        color: rgb(0.2, 0.4, 0.8),
      });
    }
    y -= 30;

    // 한 줄 요약 (큰 글씨)
    page.drawText(aiSummary.oneLineSummary, {
      x: margin,
      y: y,
      size: 16,
      font: boldFont,
      color: rgb(0, 0, 0),
      maxWidth: width - 2 * margin,
    });
    y -= 35;

    // Overview
    page.drawText("Overview", {
      x: margin,
      y: y,
      size: 12,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 18;

    const overviewLines = this.wrapTextSimple(
      aiSummary.overview,
      regularFont,
      10,
      width - 2 * margin
    );
    for (const line of overviewLines.slice(0, 5)) {
      page.drawText(line, {
        x: margin,
        y: y,
        size: 10,
        font: regularFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 14;
    }
    y -= 10;

    // 비즈니스 모델 (있으면)
    if (aiSummary.businessModel) {
      page.drawText("Business Model", {
        x: margin,
        y: y,
        size: 12,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 18;

      const bm = aiSummary.businessModel;
      const items = [
        `Type: ${bm.type || "N/A"}`,
        `Revenue: ${bm.revenueModel || "N/A"}`,
        `Price: ${bm.priceRange || "N/A"}`,
      ];

      for (const item of items) {
        page.drawText(`• ${item}`, {
          x: margin + 10,
          y: y,
          size: 9,
          font: regularFont,
          color: rgb(0.3, 0.3, 0.3),
        });
        y -= 14;
      }
      y -= 10;
    }

    // 해결하는 문제
    if (y > 150) {
      page.drawText("Problem Solved", {
        x: margin,
        y: y,
        size: 12,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 18;

      const problemLines = this.wrapTextSimple(
        aiSummary.problemSolved,
        regularFont,
        10,
        width - 2 * margin
      );
      for (const line of problemLines.slice(0, 3)) {
        page.drawText(line, {
          x: margin,
          y: y,
          size: 10,
          font: regularFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= 14;
      }
      y -= 10;
    }

    // 주요 서비스
    if (aiSummary.mainServices.length > 0 && y > 120) {
      page.drawText("Main Services", {
        x: margin,
        y: y,
        size: 12,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 18;

      for (const service of aiSummary.mainServices.slice(0, 3)) {
        page.drawText(`• ${service.substring(0, 60)}`, {
          x: margin + 10,
          y: y,
          size: 9,
          font: regularFont,
          color: rgb(0.3, 0.3, 0.3),
          maxWidth: width - 2 * margin - 10,
        });
        y -= 14;
      }
      y -= 10;
    }

    // 타겟 고객
    if (aiSummary.targetCustomers.length > 0 && y > 100) {
      page.drawText("Target Customers", {
        x: margin,
        y: y,
        size: 12,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 18;

      for (const customer of aiSummary.targetCustomers.slice(0, 2)) {
        page.drawText(`• ${customer.substring(0, 60)}`, {
          x: margin + 10,
          y: y,
          size: 9,
          font: regularFont,
          color: rgb(0.3, 0.3, 0.3),
          maxWidth: width - 2 * margin - 10,
        });
        y -= 14;
      }
      y -= 10;
    }

    // 차별점
    if (aiSummary.uniqueFeatures.length > 0 && y > 80) {
      page.drawText("Key Differentiators", {
        x: margin,
        y: y,
        size: 12,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 18;

      for (const feature of aiSummary.uniqueFeatures.slice(0, 3)) {
        page.drawText(`✓ ${feature.substring(0, 60)}`, {
          x: margin + 10,
          y: y,
          size: 9,
          font: regularFont,
          color: rgb(0, 0.5, 0),
          maxWidth: width - 2 * margin - 10,
        });
        y -= 14;
      }
    }

    // 하단에 생성 정보
    page.drawText(
      `Generated by SiteToPDF | ${new Date().toISOString().split("T")[0]}`,
      {
        x: margin,
        y: 30,
        size: 8,
        font: regularFont,
        color: rgb(0.5, 0.5, 0.5),
      }
    );
  }

  /**
   * 간단한 텍스트 줄바꿈 (AI Summary용)
   */
  private wrapTextSimple(
    text: string,
    font: any,
    fontSize: number,
    maxWidth: number
  ): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);

      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * 목차 페이지 추가 (한글 폰트 임베드 방식)
   * @returns 목차 페이지 수
   */
  private async addTableOfContents(
    pdfDoc: PDFDocument,
    toc: TableOfContentsItem[],
    regularFont: any,
    boldFont: any
  ): Promise<number> {
    // 목차 추가 전 페이지 수 기록
    const pagesBefore = pdfDoc.getPages().length;

    // 목차 페이지 추가
    let currentPage = pdfDoc.addPage([595, 842]); // A4 size
    let yPosition = currentPage.getHeight() - 50;

    // 목차 제목 (폰트가 없으면 영어만 표시)
    const hasKoreanFont =
      this.warnings.length === 0 ||
      !this.warnings.some((w) => w.includes("폰트") || w.includes("한글"));
    const tocTitle = hasKoreanFont
      ? "목차 (Table of Contents)"
      : "Table of Contents";

    currentPage.drawText(tocTitle, {
      x: 50,
      y: yPosition,
      size: 24,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 40;

    // 목차 항목
    for (const item of toc) {
      if (yPosition < 50) {
        // 페이지 넘침 시 새 페이지
        currentPage = pdfDoc.addPage([595, 842]);
        yPosition = currentPage.getHeight() - 50;
      }

      // 폰트가 없으면 한글이 깨질 수 있으므로 URL이나 영어만 사용
      let displayTitle = item.title || item.url;

      // 한글 폰트가 없고 제목에 한글이 있으면 URL 사용
      if (!hasKoreanFont && /[가-힣]/.test(displayTitle)) {
        // URL에서 도메인 추출 또는 간단한 텍스트 사용
        try {
          const urlObj = new URL(item.url);
          displayTitle = `${urlObj.hostname}${urlObj.pathname}`;
        } catch {
          // URL 파싱 실패 시 영어/숫자만 추출
          displayTitle =
            displayTitle.replace(/[^a-zA-Z0-9\s\-_\.]/g, "") || item.url;
        }
      }

      const maxTitleLength = 70;
      if (displayTitle.length > maxTitleLength) {
        displayTitle = displayTitle.substring(0, maxTitleLength) + "...";
      }

      // 페이지 번호 (굵게)
      currentPage.drawText(`${item.pageNumber}.`, {
        x: 50,
        y: yPosition,
        size: 11,
        font: boldFont,
        color: rgb(0.15, 0.39, 0.92), // 파란색
      });

      // 제목 (일반)
      currentPage.drawText(displayTitle, {
        x: 80,
        y: yPosition,
        size: 10,
        font: regularFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      yPosition -= 20;
    }

    // 목차 페이지 수 반환 (추가된 페이지 수만)
    const tocPages = pdfDoc.getPages().length - pagesBefore;
    console.log(`[PDF] 목차 ${tocPages}페이지 추가됨`);
    return tocPages;
  }

  /**
   * 각 페이지 상단에 헤더 추가
   */
  private async addPageHeader(
    page: any,
    pageInfo: CrawledPage,
    pageNum: number,
    totalPages: number,
    font: any
  ): Promise<void> {
    try {
      const { width, height } = page.getSize();
      const headerHeight = 60;
      const padding = 10;

      // 반투명 배경
      page.drawRectangle({
        x: 0,
        y: height - headerHeight,
        width: width,
        height: headerHeight,
        color: rgb(0.95, 0.95, 0.95),
        opacity: 0.9,
      });

      // 페이지 번호
      page.drawText(`${pageNum} / ${totalPages}`, {
        x: padding,
        y: height - 20,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });

      // 제목 (한글 지원)
      const title = pageInfo.title || "Untitled";
      const maxTitleLength = 50;
      const displayTitle =
        title.length > maxTitleLength
          ? title.substring(0, maxTitleLength) + "..."
          : title;

      page.drawText(displayTitle, {
        x: padding,
        y: height - 38,
        size: 12,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });

      // URL
      const url = pageInfo.url;
      const maxUrlLength = 60;
      const displayUrl =
        url.length > maxUrlLength
          ? url.substring(0, maxUrlLength) + "..."
          : url;

      page.drawText(displayUrl, {
        x: padding,
        y: height - 52,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    } catch (error) {
      console.warn("[PDF] 헤더 추가 실패:", error);
      // 헤더 추가 실패해도 계속 진행
    }
  }

  /**
   * PDF 북마크 추가 (왼쪽 사이드바 네비게이션)
   *
   * NOTE: 현재 pdf-lib의 저수준 API 이슈로 비활성화됨
   * pdf-lib는 북마크를 직접 지원하지 않으며, 저수준 API 사용 시 에러 발생
   * 향후 pdf-lib 업데이트 또는 다른 라이브러리 사용 시 재구현 필요
   */
  /*
  private async addBookmarks(
    pdfDoc: PDFDocument,
    toc: TableOfContentsItem[],
    tocPageCount: number
  ): Promise<void> {
    try {
      const pages = pdfDoc.getPages();

      // PDF 아웃라인 구조 생성
      const outlineDict = pdfDoc.context.obj({
        Type: 'Outlines',
        Count: toc.length,
      });

      const outlineRef = pdfDoc.context.register(outlineDict);

      let prevOutlineItemRef: any = null;
      let firstOutlineItemRef: any = null;

      // 각 페이지에 대한 북마크 추가
      for (let i = 0; i < toc.length; i++) {
        const item = toc[i];
        // 목차 페이지 수만큼 오프셋 추가
        const targetPageIndex = tocPageCount + i;

        if (targetPageIndex < pages.length) {
          const targetPage = pages[targetPageIndex];
          const targetPageRef = targetPage.ref;

          const outlineItem = pdfDoc.context.obj({
            Title: item.title || item.url,
            Parent: outlineRef,
            Dest: [targetPageRef, 'XYZ', null, null, null],
          });

          if (prevOutlineItemRef) {
            outlineItem.set('Prev', prevOutlineItemRef);
            const prevItem = pdfDoc.context.lookup(prevOutlineItemRef);
            prevItem.set('Next', pdfDoc.context.register(outlineItem));
          }

          const outlineItemRef = pdfDoc.context.register(outlineItem);

          if (i === 0) {
            firstOutlineItemRef = outlineItemRef;
          }

          prevOutlineItemRef = outlineItemRef;
        }
      }

      // 첫 번째와 마지막 항목 설정
      if (firstOutlineItemRef && prevOutlineItemRef) {
        outlineDict.set('First', firstOutlineItemRef);
        outlineDict.set('Last', prevOutlineItemRef);
      }

      // 카탈로그에 아웃라인 추가
      const catalog = pdfDoc.catalog;
      catalog.set('Outlines', outlineRef);

      // 북마크 패널을 기본으로 표시
      catalog.set('PageMode', 'UseOutlines');

      console.log('[PDF] 북마크 추가 완료:', toc.length, '개');
    } catch (error) {
      console.warn('[PDF] 북마크 추가 실패:', error);
      // 북마크 추가 실패해도 계속 진행
    }
  }
  */
}

/**
 * PDF 생성 헬퍼 함수
 */
export async function generatePDFFromPages(
  pages: CrawledPage[],
  options?: Partial<PDFGenerationOptions>,
  aiSummary?: AISummary | null
): Promise<PDFResult> {
  const generator = new PDFGenerator({
    includeTableOfContents: true, // 이미지 기반 목차로 활성화
    pageSize: "A4",
    orientation: "portrait",
    quality: "medium",
    ...options,
  });

  return await generator.generatePDFs(pages, aiSummary);
}
