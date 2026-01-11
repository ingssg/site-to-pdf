/**
 * HTML/CSS 기반 PDF 생성기 (Playwright 사용)
 * 로컬 환경의 src/lib/pdf/html-generator.ts를 Lambda 환경에 맞게 완전 포팅
 * 절대 간소화하지 않음 - 모든 기능 포함
 */

const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');

// HTML 템플릿 (인라인으로 포함 - Lambda는 파일 시스템 접근 제한적)
const ALL_IN_ONE_TEMPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Business Intelligence Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
  <style>
    /* ==================== GLOBAL STYLES ==================== */
    @page {
      size: A4;
      margin: 0;
    }

    /* Page counter for automatic numbering */
    body {
      counter-reset: page-number;
    }

    .page {
      counter-increment: page-number;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 210mm;
      font-family: 'Manrope', sans-serif;
      background: #ffffff;
      color: #111827;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      page-break-after: always;
      position: relative;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* ==================== COVER PAGE ==================== */
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 40mm 20mm;
    }

    .cover-watermark {
      position: absolute;
      top: 20mm;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3em;
      color: #9ca3af;
      text-transform: uppercase;
    }

    .cover-title {
      text-align: center;
      margin-bottom: 40mm;
    }

    .cover-title h1 {
      font-family: 'Merriweather', serif;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 10mm;
      color: #0f172a;
    }

    .cover-prepared {
      text-align: center;
      margin-bottom: 5mm;
    }

    .cover-prepared-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 3mm;
    }

    .cover-company {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2mm;
    }

    .cover-url {
      font-size: 14px;
      color: #1337ec;
      text-decoration: none;
    }

    .cover-footer {
      position: absolute;
      bottom: 15mm;
      left: 0;
      right: 0;
      text-align: center;
    }

    .cover-date {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3mm;
    }

    .cover-powered {
      font-size: 9px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .cover-powered strong {
      color: #0f172a;
      font-weight: 700;
    }

    /* ==================== EXECUTIVE SUMMARY PAGE ==================== */
    .exec-summary-page {
      padding: 0;
    }

    .primary-bar {
      width: 100%;
      height: 6px;
      background: #1337ec;
    }

    .exec-header {
      padding: 10mm 8mm 4mm;
      border-bottom: 1px solid #f3f4f6;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .exec-header-left {
      display: flex;
      flex-direction: column;
    }

    .confidential-label {
      font-size: 9px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      margin-bottom: 1mm;
    }

    .domain-name {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      letter-spacing: 0.05em;
    }

    .exec-header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .generated-label {
      font-size: 9px;
      font-weight: 500;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .generated-date {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
    }

    .exec-content {
      padding: 8mm 10mm 15mm;
    }

    .exec-title-section {
      margin-bottom: 8mm;
    }

    .exec-title-section h1 {
      font-family: 'Merriweather', serif;
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.02em;
      margin-bottom: 2mm;
    }

    .exec-subtitle {
      font-size: 14px;
      color: #6b7280;
      font-weight: 500;
    }

    .exec-main-grid {
      display: grid;
      grid-template-columns: 7fr 5fr;
      gap: 8mm;
    }

    .exec-left-column {
      display: flex;
      flex-direction: column;
      gap: 8mm;
    }

    .exec-right-column {
      display: flex;
      flex-direction: column;
      gap: 8mm;
    }

    .exec-section {
      display: flex;
      flex-direction: column;
      gap: 2mm;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 2mm;
      margin-bottom: 1mm;
    }

    .section-indicator {
      width: 4px;
      height: 12px;
      background: #1337ec;
      border-radius: 2px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .section-content {
      font-family: 'Merriweather', serif;
      font-size: 12px;
      line-height: 1.6;
      color: #374151;
      text-align: justify;
    }

    .problem-solved-box {
      background: #f9fafb;
      padding: 4mm;
      border-left: 2px solid #e5e7eb;
    }

    .problem-solved-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 2mm;
    }

    .problem-solved-item {
      font-size: 11px;
      line-height: 1.4;
      color: #374151;
      display: flex;
      align-items: flex-start;
      gap: 2mm;
    }

    .check-icon {
      font-size: 14px;
      color: #1337ec;
      flex-shrink: 0;
      margin-top: 0.5mm;
    }

    .products-services {
      display: flex;
      flex-direction: column;
      gap: 3mm;
    }

    .products-title {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 1mm;
    }

    .product-item {
      display: flex;
      flex-direction: column;
      gap: 0.5mm;
    }

    .product-name {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
    }

    .product-desc {
      font-size: 10px;
      color: #6b7280;
      line-height: 1.4;
    }

    .target-customers {
      display: flex;
      flex-direction: column;
      gap: 3mm;
    }

    .customer-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 2mm;
    }

    .customer-tag {
      background: #f3f4f6;
      color: #374151;
      font-size: 10px;
      font-weight: 600;
      padding: 1mm 2mm;
      border-radius: 2px;
      border: 1px solid #e5e7eb;
    }

    .exec-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 4mm 8mm;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #9ca3af;
      font-weight: 500;
      background: #ffffff;
    }

    .exec-footer-left {
      display: flex;
      align-items: center;
      gap: 2mm;
    }

    .exec-footer-right {
      font-size: 9px;
      font-weight: 700;
      color: #9ca3af;
    }

    .footer-icon {
      font-size: 14px;
      color: #1337ec;
    }

    /* ==================== TOC PAGE ==================== */
    .toc-page {
      padding: 8mm 10mm;
    }

    .toc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 4mm;
      margin-bottom: 8mm;
    }

    .toc-header-left {
      display: flex;
      flex-direction: column;
    }

    .source-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      font-weight: 700;
      color: #94a3b8;
      margin-bottom: 1mm;
    }

    .toc-header-right {
      text-align: right;
    }

    .toc-title-section {
      margin-bottom: 12mm;
    }

    .toc-title-section h2 {
      font-size: 36px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      line-height: 1;
      margin-bottom: 3mm;
    }

    .toc-subtitle {
      font-size: 14px;
      color: #64748b;
      font-weight: 500;
    }

    .toc-list {
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
    }

    .toc-item {
      display: flex;
      align-items: baseline;
      width: 100%;
      line-height: 1.2;
    }

    .toc-number {
      width: 8mm;
      font-size: 16px;
      font-weight: 700;
      color: #1337ec;
    }

    .toc-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.01em;
    }

    .toc-leader {
      flex-grow: 1;
      border-bottom: 2px dotted #d1d5db;
      margin: 0 2mm;
      position: relative;
      top: -1mm;
    }

    .toc-page-num {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    /* ==================== PAGE SECTION STYLES ==================== */
    .page-section {
      padding: 20mm 18mm 25mm;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .page-section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }

    .page-section-article {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .page-title-section {
      margin-bottom: 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .page-title-content {
      flex: 1;
    }

    .page-title-section h2 {
      font-family: 'Merriweather', serif;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
      margin-bottom: 4px;
    }

    .page-url {
      font-size: 8px;
      color: #64748b;
      font-family: monospace;
      word-break: break-all;
    }

    .screenshot-container {
      width: 100%;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 12px;
      background: #f9fafb;
      padding: 4px;
    }

    .screenshot-container img {
      width: 100%;
      height: auto;
      display: block;
      max-height: 120mm;
      object-fit: contain;
      object-position: top;
    }

    .page-type-container {
      margin-bottom: 12px;
    }

    .page-type-badge {
      display: inline-block;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 10px;
      border-radius: 3px;
      color: #000000;
    }

    .business-insights-box {
      background: #f8fafc;
      border-top: 2px solid #e2e8f0;
      border-bottom: 2px solid #e2e8f0;
      padding: 16px;
      margin-bottom: 16px;
    }

    .business-insights-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      color: #1337ec;
    }

    .business-insights-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #0f172a;
    }

    .business-insights-text {
      font-size: 11px;
      line-height: 1.7;
      color: #374151;
      font-weight: 400;
      font-family: 'Manrope', sans-serif;
      white-space: pre-wrap;
    }

    .page-section-footer {
      margin-top: auto;
      padding: 16px 0;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #9ca3af;
      font-family: 'Manrope', sans-serif;
      font-weight: 500;
    }

    .page-section-footer .lock-icon {
      font-size: 14px;
      color: #1337ec;
    }

    .page-section-footer .page-number {
      font-size: 9px;
      font-weight: 700;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <!-- COVER PAGE -->
  <div class="page cover-page">
    <div class="cover-watermark">CONFIDENTIAL AUDIT</div>
    <div class="cover-title">
      <h1>Website<br>Analysis<br>Report</h1>
    </div>
    <div class="cover-prepared">
      <div class="cover-prepared-label">Prepared For</div>
      <div class="cover-company">{{COMPANY_NAME}}</div>
      <a href="{{COMPANY_URL}}" class="cover-url">{{COMPANY_URL}}</a>
    </div>
    <div class="cover-footer">
      <div class="cover-date">Generated on {{GENERATED_DATE}}</div>
      <div class="cover-powered">Powered by <strong>SiteToPDF</strong></div>
    </div>
  </div>

  <!-- TABLE OF CONTENTS PAGE -->
  <div class="page toc-page">
    <div class="toc-header">
      <div class="toc-header-left">
        <span class="source-label">Source Website</span>
        <span class="domain-name">{{DOMAIN_NAME}}</span>
      </div>
      <div class="toc-header-right">
        <span class="source-label">Generated</span>
        <span class="domain-name">{{GENERATED_DATE}}</span>
      </div>
    </div>
    <div class="toc-title-section">
      <h2>Table of Contents</h2>
      <p class="toc-subtitle">Comprehensive business analysis & website report.</p>
    </div>
    <div class="toc-list">
      {{TOC_ITEMS}}
    </div>
  </div>

  <!-- EXECUTIVE SUMMARY PAGE -->
  <div class="page exec-summary-page">
    <div class="primary-bar"></div>
    <div class="exec-header">
      <div class="exec-header-left">
        <span class="confidential-label">Confidential Report</span>
        <span class="domain-name">{{DOMAIN_NAME}}</span>
      </div>
      <div class="exec-header-right">
        <span class="generated-label">Generated on</span>
        <span class="generated-date">{{GENERATED_DATE}}</span>
      </div>
    </div>
    <div class="exec-content">
      <div class="exec-title-section">
        <h1>종합 분석 요약</h1>
        <p class="exec-subtitle">비즈니스 성과 및 시장 포지셔닝에 대한 종합적인 분석</p>
      </div>
      <div class="exec-main-grid">
        <div class="exec-left-column">
          <div class="exec-section">
            <div class="section-header">
              <div class="section-indicator"></div>
              <h3 class="section-title">회사 개요</h3>
            </div>
            <p class="section-content">{{COMPANY_OVERVIEW}}</p>
          </div>
          <div class="exec-section">
            <div class="section-header">
              <div class="section-indicator"></div>
              <h3 class="section-title">해결하는 문제</h3>
            </div>
            <div class="problem-solved-box">
              <ul class="problem-solved-list">
                {{PROBLEM_SOLVED_ITEMS}}
              </ul>
            </div>
          </div>
          <div class="exec-section">
            <div class="section-header">
              <div class="section-indicator"></div>
              <h3 class="section-title">핵심 차별화 요소</h3>
            </div>
            <p class="section-content">{{KEY_DIFFERENTIATORS}}</p>
          </div>
        </div>
        <div class="exec-right-column">
          <div class="products-services">
            <h3 class="products-title">주요 제품/서비스</h3>
            {{PRODUCTS_SERVICES}}
          </div>
          <div class="target-customers">
            <h3 class="products-title">타겟 고객</h3>
            <div class="customer-tags">
              {{TARGET_CUSTOMERS}}
            </div>
          </div>
          <div class="growth-opportunities-box">
            <h3 class="products-title">성장 가능성</h3>
            <div class="growth-list">
              {{GROWTH_OPPORTUNITIES}}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="exec-footer">
      <div class="exec-footer-left">
        <span class="material-symbols-outlined footer-icon">picture_as_pdf</span>
        <span>SiteToPDF AI Analysis • Private & Confidential</span>
      </div>
      <div class="exec-footer-right">Page 1</div>
    </div>
  </div>

  <!-- PAGE SECTIONS (THUMBNAIL + AI SUMMARY) -->
  {{PAGE_SECTIONS}}
</body>
</html>`;

const SCREENSHOT_PDF_TEMPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Screenshot Archive</title>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Manrope', sans-serif;
    }

    .page {
      width: 210mm;
      height: 297mm;
      page-break-after: always;
      position: relative;
      background: #ffffff;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* Cover Page Styles */
    .cover-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      padding: 40mm;
      text-align: center;
    }

    .cover-icon {
      font-size: 64px;
      margin-bottom: 24px;
      opacity: 0.9;
    }

    .cover-title {
      font-size: 36px;
      font-weight: 800;
      margin-bottom: 16px;
      letter-spacing: -0.02em;
    }

    .cover-subtitle {
      font-size: 18px;
      font-weight: 400;
      opacity: 0.9;
      margin-bottom: 8px;
    }

    .cover-domain {
      font-size: 14px;
      font-weight: 500;
      opacity: 0.7;
      font-family: monospace;
      margin-bottom: 40px;
    }

    .cover-meta {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 12px;
      opacity: 0.8;
    }

    .cover-meta-item {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .cover-footer {
      position: absolute;
      bottom: 20mm;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 10px;
      opacity: 0.7;
    }

    .cover-page-number {
      position: absolute;
      bottom: 10mm;
      right: 20mm;
      font-size: 9px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.8);
    }

    /* Screenshot Page Styles */
    .screenshot-page {
      padding: 15mm 15mm 20mm;
      display: flex;
      flex-direction: column;
    }

    .screenshot-header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .screenshot-page-number {
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .screenshot-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
      font-family: 'Merriweather', serif;
    }

    .screenshot-url {
      font-size: 9px;
      color: #64748b;
      font-family: monospace;
      word-break: break-all;
    }

    .screenshot-container {
      flex: 1;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 12px 0;
      min-height: 0;
    }

    .screenshot-image {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      background: #f9fafb;
      padding: 4px;
      object-fit: contain;
    }

    .screenshot-footer {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8px;
      color: #9ca3af;
    }

    .screenshot-footer-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .screenshot-footer-right {
      font-weight: 700;
    }

    .screenshot-timestamp {
      font-size: 8px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="page cover-page">
    <div class="cover-icon">📸</div>
    <h1 class="cover-title">Screenshot Archive</h1>
    <div class="cover-subtitle">Original Website Evidence</div>
    <div class="cover-domain">{{DOMAIN_NAME}}</div>
    <div class="cover-meta">
      <div class="cover-meta-item">
        <span>📄</span>
        <span>{{TOTAL_PAGES}} Pages Captured</span>
      </div>
      <div class="cover-meta-item">
        <span>📅</span>
        <span>Generated on {{GENERATED_DATE}}</span>
      </div>
      <div class="cover-meta-item">
        <span>🔒</span>
        <span>Confidential Evidence Document</span>
      </div>
    </div>
    <div class="cover-footer">
      Powered by SiteToPDF | AI-Enhanced Website Archiving
    </div>
    <div class="cover-page-number">Page 1</div>
  </div>

  <!-- Screenshot Pages -->
  {{SCREENSHOT_PAGES}}
</body>
</html>`;

class HTMLPDFGenerator {
  constructor(options = {}) {
    this.options = {
      includeTableOfContents: true,
      ...options,
    };
    this.browser = null;
  }

  getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Website';
    }
  }

  replaceTemplateVars(template, vars) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
    } catch {
      return 'N/A';
    }
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
      });
    }
  }

  async htmlToPDF(html) {
    await this.initBrowser();
    const page = await this.browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      return document.fonts.ready;
    });

    await page.waitForTimeout(1000);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
    });

    await page.close();
    return Buffer.from(pdfBuffer);
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  }

  detectPageType(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();

      if (pathname === '/' || pathname === '/index' || pathname === '/home' || pathname === '/index.html') {
        return { type: 'Homepage', color: '#eff6ff' };
      }

      if (pathname.includes('/product') || pathname.includes('/shop') || pathname.includes('/buy') || pathname.includes('/store')) {
        return { type: 'Product', color: '#f0fdf4' };
      }

      if (pathname.includes('/contact') || pathname.includes('/support') || pathname.includes('/help')) {
        return { type: 'Contact', color: '#fef3c7' };
      }

      if (pathname.includes('/about') || pathname.includes('/team') || pathname.includes('/company')) {
        return { type: 'About', color: '#fce7f3' };
      }

      if (pathname.includes('/blog') || pathname.includes('/news') || pathname.includes('/article') || pathname.includes('/post')) {
        return { type: 'Blog/News', color: '#f3e8ff' };
      }

      if (pathname.includes('/pricing') || pathname.includes('/plans') || pathname.includes('/price')) {
        return { type: 'Pricing', color: '#dbeafe' };
      }

      if (pathname.includes('/docs') || pathname.includes('/documentation') || pathname.includes('/guide')) {
        return { type: 'Documentation', color: '#e0f2fe' };
      }

      return { type: 'General', color: '#f1f5f9' };
    } catch {
      return { type: 'General', color: '#f1f5f9' };
    }
  }

  buildProblemSolvedItems(aiSummary) {
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

  buildProductsServices(aiSummary) {
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
      .join('');
  }

  buildTargetCustomers(aiSummary) {
    if (!aiSummary?.targetCustomers || aiSummary.targetCustomers.length === 0) {
      return '<span class="customer-tag">N/A</span>';
    }

    return aiSummary.targetCustomers
      .map((customer) => `<span class="customer-tag">${this.escapeHtml(customer)}</span>`)
      .join('');
  }

  buildGrowthOpportunities(aiSummary) {
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
          .join('')}
      </ul>
    `;
  }

  buildTocItems(tocItems) {
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
      .join('');
  }

  buildPageSections(pages, domain, generatedDate) {
    if (pages.length === 0) {
      return '';
    }

    let pageNumber = 2;
    const sections = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      const screenshotBase64 = page.screenshot
        ? `data:image/jpeg;base64,${page.screenshot.toString('base64')}`
        : '';

      const aiInsight = page.pageSummary || '비즈니스 인사이트를 생성할 수 없습니다.';

      const pageType = this.detectPageType(page.url);

      const captureTimestamp = this.formatTimestamp(page.timestamp);

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
              <h2>${this.escapeHtml(page.title || 'Untitled')}</h2>
              <div class="page-url">${this.escapeHtml(page.url)}</div>
              <div style="font-size: 7px; color: #9ca3af; margin-top: 2px; font-family: monospace;">Captured: ${captureTimestamp}</div>
            </div>

            <!-- 스크린샷 -->
            <div class="screenshot-container">
              <img src="${screenshotBase64}" alt="${this.escapeHtml(page.title || 'Screenshot')}">
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

    return sections.join('\n');
  }

  async generateScreenshotPDF(pages, domain, generatedDate, crawlMode) {
    if (pages.length === 0) {
      return Buffer.alloc(0);
    }

    const filteredPages = pages;

    console.log(`[PDF] 스크린샷 PDF 생성: ${filteredPages.length}페이지`);

    if (filteredPages.length === 0) {
      return Buffer.alloc(0);
    }

    const screenshotPages = filteredPages
      .map((page, index) => {
        const hasFullPage = !!page.fullPageScreenshot;
        const hasScreenshot = !!page.screenshot;
        const screenshotBuffer = page.fullPageScreenshot || page.screenshot;
        const screenshotBase64 = screenshotBuffer
          ? `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`
          : '';

        console.log(`[스크린샷 PDF] 페이지 ${index + 1}: fullPage=${hasFullPage}, screenshot=${hasScreenshot}, using=${hasFullPage ? 'fullPage' : 'viewport'}`);

        const pageNumber = index + 2;
        const captureTimestamp = this.formatTimestamp(page.timestamp);

        return `
          <div class="page screenshot-page">
            <div class="screenshot-header">
              <div class="screenshot-page-number">Screenshot ${index + 1} of ${filteredPages.length}</div>
              <h2 class="screenshot-title">${this.escapeHtml(page.title || 'Untitled')}</h2>
              <div class="screenshot-url">${this.escapeHtml(page.url)}</div>
            </div>
            <div class="screenshot-container">
              <img src="${screenshotBase64}" alt="${this.escapeHtml(page.title || 'Screenshot')}" class="screenshot-image">
            </div>
            <div class="screenshot-footer">
              <div class="screenshot-footer-left">
                <span class="screenshot-timestamp">Captured: ${captureTimestamp}</span>
              </div>
              <div class="screenshot-footer-right">Page ${pageNumber}</div>
            </div>
          </div>
        `;
      })
      .join('');

    const html = this.replaceTemplateVars(SCREENSHOT_PDF_TEMPLATE, {
      DOMAIN_NAME: domain,
      TOTAL_PAGES: filteredPages.length.toString(),
      GENERATED_DATE: generatedDate,
      SCREENSHOT_PAGES: screenshotPages,
    });

    return await this.htmlToPDF(html);
  }

  async extractIndividualPDFsFromMerged(mergedPdfBuffer, pageCount, pageStructure, creationDate) {
    const individualPdfs = [];

    const sourcePdf = await PDFDocument.load(mergedPdfBuffer);
    const totalPages = sourcePdf.getPageCount();

    const sourceCreationDate = creationDate || sourcePdf.getCreationDate() || new Date();

    console.log(`[PDF] 통합 PDF 총 페이지 수: ${totalPages}`);
    console.log(`[PDF] 페이지 구조 정보 사용:`);
    console.log(`  - 표지: ${pageStructure.coverPages}페이지 (index 0)`);
    console.log(`  - 목차: ${pageStructure.tocPages}페이지 (index 1~${pageStructure.tocPages})`);
    console.log(`  - 종합 분석 요약: ${pageStructure.summaryPages}페이지 (index ${pageStructure.summaryPageIndex})`);
    console.log(`  - 개별 페이지들: ${pageCount}페이지 (index ${pageStructure.individualPagesStartIndex}~)`);

    if (pageStructure.summaryPageIndex < totalPages) {
      const summaryPdf = await PDFDocument.create();
      summaryPdf.setCreationDate(sourceCreationDate);
      summaryPdf.setModificationDate(sourceCreationDate);
      const summaryPages = await summaryPdf.copyPages(sourcePdf, [pageStructure.summaryPageIndex]);
      summaryPages.forEach((page) => summaryPdf.addPage(page));
      const summaryPdfBytes = await summaryPdf.save();
      individualPdfs.push(Buffer.from(summaryPdfBytes));
      console.log(`[PDF] 전체 요약 PDF 추출: 페이지 ${pageStructure.summaryPageIndex}`);
    } else {
      console.warn(`[PDF] 종합 분석 요약 페이지 추출 실패: 인덱스 ${pageStructure.summaryPageIndex}가 총 페이지 수 ${totalPages}를 초과`);
    }

    for (let i = 0; i < pageCount; i++) {
      const pageIndex = pageStructure.individualPagesStartIndex + i;

      if (pageIndex < totalPages) {
        const pagePdf = await PDFDocument.create();
        pagePdf.setCreationDate(sourceCreationDate);
        pagePdf.setModificationDate(sourceCreationDate);
        const pages = await pagePdf.copyPages(sourcePdf, [pageIndex]);
        pages.forEach((page) => pagePdf.addPage(page));
        const pagePdfBytes = await pagePdf.save();
        individualPdfs.push(Buffer.from(pagePdfBytes));
        console.log(`[PDF] 페이지 ${i + 1} PDF 추출: 페이지 ${pageIndex}`);
      } else {
        console.warn(`[PDF] 페이지 ${i + 1} 추출 실패: 인덱스 ${pageIndex}가 총 페이지 수 ${totalPages}를 초과`);
      }
    }

    return individualPdfs;
  }

  async generatePDFs(pages, aiSummary, crawlMode) {
    try {
      await this.initBrowser();

      const firstPageUrl = pages[0]?.url || '';
      const domain = this.getDomainFromUrl(firstPageUrl);
      const generatedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const reportId = `SPD-${Date.now().toString().slice(-8)}`;

      const pagesWithScreenshots = pages.filter((page) => page.screenshot);

      const tocItems = [];

      if (aiSummary) {
        tocItems.push({ title: '종합 분석 요약', url: 'AI Summary', pageNumber: 1 });
      }

      let pageNumber = 2;
      pagesWithScreenshots.forEach((page, index) => {
        tocItems.push({
          title: page.title || page.url,
          url: page.url,
          pageNumber: pageNumber,
        });
        pageNumber++;
      });

      const vars = {
        COMPANY_NAME: domain,
        COMPANY_URL: firstPageUrl,
        GENERATED_DATE: generatedDate,
        DOMAIN_NAME: domain,
        REPORT_ID: reportId,
        COMPANY_OVERVIEW: this.escapeHtml(
          aiSummary?.overview || aiSummary?.oneLineSummary || 'N/A'
        ),
        PROBLEM_SOLVED_ITEMS: this.buildProblemSolvedItems(aiSummary),
        KEY_DIFFERENTIATORS: this.escapeHtml(
          (aiSummary?.uniqueFeatures || []).join(', ') || 'N/A'
        ),
        PRODUCTS_SERVICES: this.buildProductsServices(aiSummary),
        TARGET_CUSTOMERS: this.buildTargetCustomers(aiSummary),
        GROWTH_OPPORTUNITIES: this.buildGrowthOpportunities(aiSummary),
        TOC_ITEMS: this.buildTocItems(tocItems),
        PAGE_SECTIONS: this.buildPageSections(pagesWithScreenshots, domain, generatedDate),
      };

      const html = this.replaceTemplateVars(ALL_IN_ONE_TEMPLATE, vars);

      const pdfBuffer = await this.htmlToPDF(html);

      const sourcePdf = await PDFDocument.load(pdfBuffer);
      const creationDate = new Date();
      sourcePdf.setCreationDate(creationDate);
      sourcePdf.setModificationDate(creationDate);
      const pdfWithMetadata = await sourcePdf.save();
      const finalPdfBuffer = Buffer.from(pdfWithMetadata);
      const totalSize = finalPdfBuffer.length;

      const sourcePdfForStructure = await PDFDocument.load(finalPdfBuffer);
      const totalPages = sourcePdfForStructure.getPageCount();

      const sourceCreationDate = sourcePdfForStructure.getCreationDate();

      const coverPages = 1;
      const tocPages = Math.max(1, totalPages - pagesWithScreenshots.length - 2);
      const summaryPages = 1;

      const pageStructure = {
        coverPages,
        tocPages,
        summaryPages,
        summaryPageIndex: coverPages + tocPages,
        individualPagesStartIndex: coverPages + tocPages + summaryPages,
      };

      console.log(`[PDF] 통합 PDF 생성 완료: ${totalPages}페이지`);
      console.log(`[PDF] 페이지 구조: 표지(${coverPages}) + 목차(${tocPages}) + 종합분석(${summaryPages}) + 개별페이지(${pagesWithScreenshots.length})`);
      console.log(`[PDF] 종합 분석 요약 인덱스: ${pageStructure.summaryPageIndex}`);
      console.log(`[PDF] 개별 페이지 시작 인덱스: ${pageStructure.individualPagesStartIndex}`);

      console.log('[PDF] 스크린샷 PDF 생성 시작...');
      const screenshotPdf = await this.generateScreenshotPDF(
        pages,
        domain,
        generatedDate,
        crawlMode
      );
      console.log('[PDF] 스크린샷 PDF 생성 완료');

      console.log('[PDF] 통합 PDF에서 개별 PDF 추출 시작...');
      const individualPdfs = await this.extractIndividualPDFsFromMerged(
        finalPdfBuffer,
        pagesWithScreenshots.length,
        pageStructure,
        sourceCreationDate
      );
      console.log(`[PDF] 총 ${individualPdfs.length}개 PDF 추출 완료 (전체요약 1개 + 페이지 ${pagesWithScreenshots.length}개)`);

      return {
        mergedPdf: finalPdfBuffer,
        individualPdfs: individualPdfs,
        tableOfContents: tocItems,
        totalSize,
        warnings: [],
        screenshotPdf,
      };
    } finally {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = { HTMLPDFGenerator };
