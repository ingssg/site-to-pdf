/**
 * PDF 생성 및 병합 유틸리티
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type {
  CrawledPage,
  PDFGenerationOptions,
  PDFResult,
  TableOfContentsItem,
} from '@/types';

export class PDFGenerator {
  private options: PDFGenerationOptions;

  constructor(options: PDFGenerationOptions) {
    this.options = {
      includeTableOfContents: true,
      pageSize: 'A4',
      orientation: 'portrait',
      quality: 'medium',
      ...options,
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

    // 모든 PDF 병합
    const mergedPdf = await this.mergePDFs(individualPdfs, tableOfContents);

    return {
      mergedPdf,
      individualPdfs,
      tableOfContents,
      totalSize: mergedPdf.length,
    };
  }

  /**
   * 단일 페이지를 PDF로 변환
   */
  private async createPagePDF(page: CrawledPage): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();

    if (page.screenshot) {
      // 스크린샷을 PDF에 삽입
      const image = await pdfDoc.embedPng(page.screenshot);
      const imagePage = pdfDoc.addPage([image.width, image.height]);

      imagePage.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    } else {
      // 스크린샷이 없으면 텍스트만
      const textPage = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      textPage.drawText(page.title || 'Untitled', {
        x: 50,
        y: textPage.getHeight() - 50,
        size: 20,
        font,
        color: rgb(0, 0, 0),
      });

      textPage.drawText(page.url, {
        x: 50,
        y: textPage.getHeight() - 80,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * 여러 PDF를 하나로 병합
   */
  private async mergePDFs(
    pdfs: Buffer[],
    toc: TableOfContentsItem[]
  ): Promise<Buffer> {
    const mergedPdf = await PDFDocument.create();

    // 목차 페이지 추가 (옵션)
    if (this.options.includeTableOfContents) {
      await this.addTableOfContents(mergedPdf, toc);
    }

    // 모든 PDF 페이지 병합
    for (const pdfBuffer of pdfs) {
      const pdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
  }

  /**
   * 목차 페이지 추가
   */
  private async addTableOfContents(
    pdfDoc: PDFDocument,
    toc: TableOfContentsItem[]
  ): Promise<void> {
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let yPosition = page.getHeight() - 50;

    // 목차 제목
    page.drawText('Table of Contents', {
      x: 50,
      y: yPosition,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });

    yPosition -= 40;

    // 목차 항목
    for (const item of toc) {
      if (yPosition < 50) break; // 페이지 넘침 방지

      const title =
        item.title.length > 60
          ? item.title.substring(0, 60) + '...'
          : item.title;

      page.drawText(`${item.pageNumber}. ${title}`, {
        x: 50,
        y: yPosition,
        size: 10,
        font: regularFont,
        color: rgb(0, 0, 0),
      });

      yPosition -= 20;
    }
  }
}

/**
 * PDF 생성 헬퍼 함수
 */
export async function generatePDFFromPages(
  pages: CrawledPage[],
  options?: Partial<PDFGenerationOptions>
): Promise<PDFResult> {
  const generator = new PDFGenerator({
    includeTableOfContents: true,
    pageSize: 'A4',
    orientation: 'portrait',
    quality: 'medium',
    ...options,
  });

  return await generator.generatePDFs(pages);
}
