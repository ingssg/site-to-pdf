/**
 * PDF 생성 및 병합 유틸리티
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as fontkit from "@pdf-lib/fontkit";
import * as fs from "fs";
import * as path from "path";
import type {
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
   * 크롤링된 페이지들로부터 PDF 생성
   */
  async generatePDFs(pages: CrawledPage[]): Promise<PDFResult> {
    const individualPdfs: Buffer[] = [];
    const tableOfContents: TableOfContentsItem[] = [];
    let currentPage = 1;

    // 각 페이지를 개별 PDF로 변환
    for (const page of pages) {
      const pdf = await this.createPagePDF(page);
      individualPdfs.push(pdf);

      tableOfContents.push({
        title: page.title || page.url,
        url: page.url,
        pageNumber: currentPage,
      });

      // 대략적인 페이지 수 계산 (스크린샷 기반)
      currentPage += 1;
    }

    // 모든 PDF 병합 (페이지 정보도 함께 전달)
    const mergedPdf = await this.mergePDFs(
      individualPdfs,
      tableOfContents,
      pages
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
   * 단일 페이지를 PDF로 변환
   */
  private async createPagePDF(page: CrawledPage): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();

    // fontkit 등록 (텍스트 모드용)
    if (!page.screenshot) {
      const fontkitToRegister = (fontkit as any).default || fontkit;
      pdfDoc.registerFontkit(fontkitToRegister);
    }

    if (page.screenshot) {
      // Archive 모드: 스크린샷을 PDF에 삽입
      const image = await pdfDoc.embedPng(page.screenshot);
      const imagePage = pdfDoc.addPage([image.width, image.height]);

      imagePage.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    } else {
      // Fast/Standard 모드: 텍스트 콘텐츠를 PDF로 렌더링
      await this.createTextBasedPDF(pdfDoc, page);
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * 텍스트 기반 PDF 페이지 생성 (Fast/Standard 모드)
   */
  private async createTextBasedPDF(
    pdfDoc: PDFDocument,
    page: CrawledPage
  ): Promise<void> {
    // 한글 폰트 로드
    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NotoSansKR.ttf"
    );

    let koreanFont;
    let titleFont;

    if (fs.existsSync(fontPath)) {
      try {
        const fontBytes = fs.readFileSync(fontPath);
        koreanFont = await pdfDoc.embedFont(fontBytes);
        titleFont = await pdfDoc.embedFont(fontBytes);
        console.log("[PDF] 텍스트 모드 한글 폰트 로드 성공");
      } catch (error) {
        console.warn("[PDF] 폰트 로드 실패, 표준 폰트 사용:", error);
        koreanFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      }
    } else {
      console.warn("[PDF] 한글 폰트 파일 없음, 표준 폰트 사용");
      koreanFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

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
    pages: CrawledPage[]
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

    // 목차 페이지 추가 (옵션)
    let tocPageCount = 0;
    if (this.options.includeTableOfContents) {
      tocPageCount = await this.addTableOfContents(mergedPdf, toc);
    }

    // 모든 PDF 페이지 병합 및 헤더 추가
    for (let i = 0; i < pdfs.length; i++) {
      const pdfBuffer = pdfs[i];
      const pageInfo = pages[i];

      const pdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

      for (const page of copiedPages) {
        mergedPdf.addPage(page);
        // 각 페이지 상단에 헤더 추가
        await this.addPageHeader(
          mergedPdf,
          page,
          pageInfo,
          i + 1,
          pages.length
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
   * 목차 페이지 추가 (한글 폰트 임베드 방식)
   * @returns 목차 페이지 수
   */
  private async addTableOfContents(
    pdfDoc: PDFDocument,
    toc: TableOfContentsItem[]
  ): Promise<number> {
    // 한글 폰트 로드 (가변 폰트 사용)
    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NotoSansKR.ttf"
    );

    let regularFont;
    let boldFont;

    // 커스텀 폰트 시도
    const hasCustomFonts = fs.existsSync(fontPath);

    if (hasCustomFonts) {
      const fontBytes = fs.readFileSync(fontPath);

      // TTF 파일 유효성 확인
      const isValid = this.isValidTTF(fontBytes);

      if (isValid) {
        try {
          console.log("[PDF] 커스텀 폰트 임베드 시도:", {
            fontSize: fontBytes.length,
            fontPath,
          });

          // 가변 폰트는 동일한 파일을 두 번 임베드해도 됨
          regularFont = await pdfDoc.embedFont(fontBytes);
          console.log("[PDF] Regular 폰트 임베드 성공");

          boldFont = await pdfDoc.embedFont(fontBytes);
          console.log("[PDF] Bold 폰트 임베드 성공");
        } catch (error) {
          const errorMsg = `커스텀 폰트 임베드 실패: ${
            error instanceof Error ? error.message : String(error)
          }. 표준 폰트로 대체됩니다. 한글이 제대로 표시되지 않을 수 있습니다.`;
          console.warn("[PDF]", errorMsg);
          this.warnings.push(errorMsg);
          // fallback to standard fonts
          regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
          boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        }
      } else {
        const warningMsg =
          "폰트 파일이 유효한 TTF 형식이 아닙니다. 표준 폰트로 대체됩니다. 한글이 제대로 표시되지 않을 수 있습니다.";
        console.warn("[PDF]", warningMsg);
        this.warnings.push(warningMsg);
        regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      }
    } else {
      const warningMsg =
        "한글 폰트 파일을 찾을 수 없습니다. 표준 폰트를 사용합니다. 한글이 제대로 표시되지 않을 수 있습니다. NotoSansKR 폰트를 다운로드하여 public/fonts/ 디렉토리에 추가해주세요.";
      console.warn("[PDF]", warningMsg);
      this.warnings.push(warningMsg);
      regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

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

    // 목차 페이지 수 반환
    const tocPages = pdfDoc.getPages().length;
    return tocPages;
  }

  /**
   * 각 페이지 상단에 헤더 추가
   */
  private async addPageHeader(
    pdfDoc: PDFDocument,
    page: any,
    pageInfo: CrawledPage,
    pageNum: number,
    totalPages: number
  ): Promise<void> {
    try {
      // 한글 폰트 로드 (mergedPdf에서 폰트 임베드)
      const fontPath = path.join(
        process.cwd(),
        "public",
        "fonts",
        "NotoSansKR.ttf"
      );
      let font;

      if (fs.existsSync(fontPath)) {
        const fontBytes = fs.readFileSync(fontPath);
        if (this.isValidTTF(fontBytes)) {
          font = await pdfDoc.embedFont(fontBytes);
        } else {
          font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        }
      } else {
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }

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
  options?: Partial<PDFGenerationOptions>
): Promise<PDFResult> {
  const generator = new PDFGenerator({
    includeTableOfContents: true, // 이미지 기반 목차로 활성화
    pageSize: "A4",
    orientation: "portrait",
    quality: "medium",
    ...options,
  });

  return await generator.generatePDFs(pages);
}
