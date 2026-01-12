"use client";

import { useState, useEffect } from "react";
import type { GeneratePDFResponse } from "@/types/api";
import type { AppError } from "@/types/errors";
import ErrorDisplay from "@/components/ui/ErrorDisplay";
import SummaryCard from "@/components/ui/SummaryCard";
import DownloadCard from "@/components/ui/DownloadCard";
import { ErrorCode, getErrorInfo } from "@/constants/errorMessages";
import { generateFilename, getDomainFromUrl } from "@/utils/filename";

interface ResultDisplayProps {
  crawlResult: {
    totalPages: number;
    failedUrls: string[];
    duration: string;
    pages: Array<{
      url: string;
      title: string;
      content: string;
      depth: number;
    }>;
  };
  pdfResult: {
    pdf: {
      totalSize: number;
      totalSizeMB: string;
      pageCount: number;
      mergedPdf: string | null;
      mergedPdfTooLarge?: boolean;
      zipDownloadUrl: string; // 개별 PDF ZIP 파일 다운로드 URL
      screenshotPdfUrl?: string | null; // 스크린샷 PDF 다운로드 URL
      warnings?: string[];
      // Lambda 버전 추가 필드
      zipSize?: number;
      zipSizeMB?: string;
      individualPdfCount?: number;
    };
    summary: any;
  };
}

export default function ResultDisplay({
  crawlResult,
  pdfResult,
}: ResultDisplayProps) {
  const { pdf, summary } = pdfResult;
  const crawl = crawlResult;
  const [showPagesList, setShowPagesList] = useState(false);
  const [downloadError, setDownloadError] = useState<AppError | null>(null);
  const [faviconSrc, setFaviconSrc] = useState<string>("");

  // 도메인 추출
  const getDomain = () => {
    try {
      const firstPageUrl = crawl.pages[0]?.url || "website";
      return getDomainFromUrl(firstPageUrl);
    } catch {
      return "website";
    }
  };

  const handleDownloadPDF = async () => {
    if (pdf.mergedPdfTooLarge) {
      setDownloadError(getErrorInfo(ErrorCode.PDF_SIZE_TOO_LARGE));
      return;
    }

    if (!pdf.mergedPdf) {
      setDownloadError(
        getErrorInfo(ErrorCode.DOWNLOAD_FAILED, "PDF data is missing")
      );
      return;
    }

    try {
      const filename = generateFilename("pdf", getDomain());
      
      // Lambda 버전: mergedPdf가 URL인 경우 fetch로 가져와서 다운로드
      // Lambda 이전 버전: mergedPdf가 base64인 경우 /api/download 사용
      if (pdf.mergedPdf.startsWith('http://') || pdf.mergedPdf.startsWith('https://')) {
        // URL인 경우 (Lambda 버전) - fetch로 가져와서 Blob으로 처리
        const response = await fetch(pdf.mergedPdf);
        if (!response.ok) throw new Error("PDF 다운로드 실패");
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // base64인 경우 (Lambda 이전 버전)
        const response = await fetch("/api/download", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pdfBase64: pdf.mergedPdf,
            filename: filename,
          }),
        });

        if (!response.ok) throw new Error("다운로드 실패");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("PDF 다운로드 실패:", error);
      setDownloadError(
        getErrorInfo(
          ErrorCode.DOWNLOAD_FAILED,
          error instanceof Error ? error.message : undefined
        )
      );
    }
  };

  const handleDownloadZIP = async () => {
    try {
      const filename = generateFilename("zip", getDomain());

      if (!pdf.zipDownloadUrl) {
        setDownloadError(
          getErrorInfo(ErrorCode.DOWNLOAD_FAILED, "ZIP download URL is missing")
        );
        return;
      }

      // 서버에 저장된 ZIP 파일 다운로드
      const a = document.createElement("a");
      a.href = pdf.zipDownloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("ZIP 다운로드 실패:", error);
      setDownloadError(
        getErrorInfo(
          ErrorCode.DOWNLOAD_FAILED,
          error instanceof Error ? error.message : undefined
        )
      );
    }
  };

  const handleDownloadScreenshotPDF = async () => {
    if (!pdf.screenshotPdfUrl) {
      setDownloadError(
        getErrorInfo(ErrorCode.DOWNLOAD_FAILED, "Screenshot PDF URL is missing")
      );
      return;
    }

    try {
      const domain = getDomain().replace(/\./g, "_");
      const date = new Date().toISOString().split("T")[0];
      const filename = `${domain}_screenshots_${date}.pdf`;

      // 서버에 저장된 스크린샷 PDF 다운로드
      const a = document.createElement("a");
      a.href = pdf.screenshotPdfUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("스크린샷 PDF 다운로드 실패:", error);
      setDownloadError(
        getErrorInfo(
          ErrorCode.DOWNLOAD_FAILED,
          error instanceof Error ? error.message : undefined
        )
      );
    }
  };

  const domain = getDomain();

  // 파비콘 URL 생성
  const getFaviconUrl = () => {
    try {
      const firstPageUrl = crawl.pages[0]?.url || "";
      const urlObj = new URL(firstPageUrl);
      const domainForFavicon = urlObj.hostname;
      const origin = urlObj.origin;
      // 여러 파비콘 소스 시도 (onError로 fallback)
      return {
        google: `https://www.google.com/s2/favicons?domain=${domainForFavicon}&sz=64`,
        direct: `${origin}/favicon.ico`,
        fallback:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🌐%3C/text%3E%3C/svg%3E",
      };
    } catch {
      return {
        google: "",
        direct: "",
        fallback:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🌐%3C/text%3E%3C/svg%3E",
      };
    }
  };

  const faviconUrls = getFaviconUrl();

  // 파비콘 초기화 (Google API 먼저 시도)
  useEffect(() => {
    if (!faviconSrc && faviconUrls.google) {
      setFaviconSrc(faviconUrls.google);
    }
  }, [faviconSrc, faviconUrls.google]);

  // 파비콘 로드 실패 시 fallback
  const handleFaviconError = () => {
    if (faviconSrc === faviconUrls.google && faviconUrls.direct) {
      // Google API 실패 → 직접 favicon.ico 시도
      setFaviconSrc(faviconUrls.direct);
    } else if (faviconSrc === faviconUrls.direct && faviconUrls.fallback) {
      // favicon.ico도 실패 → 기본 아이콘 사용
      setFaviconSrc(faviconUrls.fallback);
    }
  };

  // 페이지 목록 표시 로직: 기본 3개, 펼치면 최대 5개 + 스크롤
  const getDisplayedPages = () => {
    if (!showPagesList) {
      return crawl.pages.slice(0, 3);
    }
    return crawl.pages.slice(0, 5);
  };

  const displayedPages = getDisplayedPages();
  const hasMorePages = crawl.pages.length > (showPagesList ? 5 : 3);

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0f172a] text-[#0d101b] dark:text-[#f8f9fc] font-display antialiased pb-24">
      {/* Header - Same as Landing Page */}
      <header className="fixed top-0 z-50 w-full backdrop-blur-xl bg-white/70 dark:bg-[#0f172a]/80 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center h-14 sm:h-16 px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto justify-between">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 sm:gap-2.5 hover:opacity-80 transition-opacity"
          >
            <img
              src="/logo.png"
              alt="SiteToPDF"
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
            />
            <span className="text-slate-900 dark:text-white text-base sm:text-lg font-bold tracking-tight">
              SiteToPDF
            </span>
          </button>
          <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
            <nav className="hidden md:flex gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <a
                className="hover:text-primary dark:hover:text-blue-400 transition-colors"
                href="#features"
              >
                기능
              </a>
              <a
                className="hover:text-primary dark:hover:text-blue-400 transition-colors"
                href="#pricing"
              >
                가격
              </a>
              <a
                className="hover:text-primary dark:hover:text-blue-400 transition-colors"
                href="#enterprise"
              >
                기업용
              </a>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3">
              <a
                className="hidden sm:block text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors text-xs sm:text-sm font-bold"
                href="#"
              >
                로그인
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 space-y-6 pt-20 sm:pt-24">
        {/* ActionPanel / Status Indicator */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 w-10 h-10 flex items-center justify-center shrink-0">
              <svg
                className="w-6 h-6 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold leading-tight">분석 완료</p>
              <p className="text-[#4c599a] dark:text-[#94a3b8] text-sm mt-1 leading-normal">
                <span className="font-bold text-primary">{domain}</span>을(를)
                성공적으로 처리했습니다. AI 요약 및 문서가 아래에 준비되어
                있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* AI Summary Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <h2 className="text-xl font-bold tracking-tight">
              AI 비즈니스 분석
            </h2>
          </div>

          {/* Main Overview Card */}
          <div className="bg-white dark:bg-[#1a1d2d] rounded-xl p-6 shadow-sm border border-[#cfd3e7] dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">회사 개요</h3>
              {faviconSrc ? (
                <img
                  src={faviconSrc}
                  alt={`${domain} favicon`}
                  className="w-8 h-8 rounded object-contain"
                  onError={handleFaviconError}
                />
              ) : null}
            </div>
            <p className="text-[#0d101b] dark:text-[#f8f9fc] text-[15px] leading-relaxed font-medium">
              {summary?.overview ||
                "웹사이트 분석이 완료되었습니다. 주요 내용은 아래 섹션에서 확인할 수 있습니다."}
            </p>
          </div>

          {/* Accordions for Detailed Breakdown */}
          <div className="flex flex-col gap-3">
            {/* Key Products / Main Services */}
            {(summary?.products || summary?.mainServices) && (
              <SummaryCard
                title="주요 제품 / 서비스"
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                }
              >
                <ul className="space-y-3">
                  {(summary.mainServices || summary.products || []).map(
                    (item: string, idx: number) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-[#4c599a] dark:text-[#b0b8d6]"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
                        <span>{item}</span>
                      </li>
                    )
                  )}
                </ul>
              </SummaryCard>
            )}

            {/* Target Customers */}
            {summary?.targetCustomers && summary.targetCustomers.length > 0 && (
              <details
                open
                className="group rounded-xl bg-white dark:bg-[#1a1d2d] border border-[#cfd3e7] dark:border-white/10 overflow-hidden shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between p-4 list-none [&::-webkit-details-marker]:hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[#e7e9f3] dark:bg-white/10 text-[#0d101b] dark:text-white">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-[#0d101b] dark:text-[#f8f9fc]">
                      타겟 고객
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-[#0d101b] dark:text-white transition-transform duration-300 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="px-5 pb-5 pt-1 text-sm text-[#4c599a] dark:text-[#b0b8d6] leading-normal">
                  {Array.isArray(summary.targetCustomers)
                    ? summary.targetCustomers.join(", ")
                    : summary.targetCustomers}
                </div>
              </details>
            )}

            {/* Value Propositions / Unique Features */}
            {(summary?.valueProps || summary?.uniqueFeatures) && (
              <details
                open
                className="group rounded-xl bg-white dark:bg-[#1a1d2d] border border-[#cfd3e7] dark:border-white/10 overflow-hidden shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between p-4 list-none [&::-webkit-details-marker]:hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[#e7e9f3] dark:bg-white/10 text-[#0d101b] dark:text-white">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-[#0d101b] dark:text-[#f8f9fc]">
                      주요 가치 제안
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-[#0d101b] dark:text-white transition-transform duration-300 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="px-5 pb-5 pt-1">
                  {summary.uniqueFeatures &&
                  summary.uniqueFeatures.length > 0 ? (
                    <ul className="space-y-3">
                      {summary.uniqueFeatures.map(
                        (feature: string, idx: number) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-[#4c599a] dark:text-[#b0b8d6]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
                            <span>{feature}</span>
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#4c599a] dark:text-[#b0b8d6] leading-normal">
                      {summary.valueProps}
                    </p>
                  )}
                </div>
              </details>
            )}

            {/* Problem Solved */}
            {summary?.problemSolved && (
              <details
                open
                className="group rounded-xl bg-white dark:bg-[#1a1d2d] border border-[#cfd3e7] dark:border-white/10 overflow-hidden shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between p-4 list-none [&::-webkit-details-marker]:hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[#e7e9f3] dark:bg-white/10 text-[#0d101b] dark:text-white">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-[#0d101b] dark:text-[#f8f9fc]">
                      해결하는 문제
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-[#0d101b] dark:text-white transition-transform duration-300 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="px-5 pb-5 pt-1 text-sm text-[#4c599a] dark:text-[#b0b8d6] leading-normal">
                  {summary.problemSolved}
                </div>
              </details>
            )}

            {/* Business Model */}
            {summary?.businessModel && (
              <details
                open
                className="group rounded-xl bg-white dark:bg-[#1a1d2d] border border-[#cfd3e7] dark:border-white/10 overflow-hidden shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between p-4 list-none [&::-webkit-details-marker]:hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[#e7e9f3] dark:bg-white/10 text-[#0d101b] dark:text-white">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-[#0d101b] dark:text-[#f8f9fc]">
                      비즈니스 모델
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-[#0d101b] dark:text-white transition-transform duration-300 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="px-5 pb-5 pt-1">
                  <div className="space-y-2 text-sm text-[#4c599a] dark:text-[#b0b8d6]">
                    {summary.businessModel.type && (
                      <p>
                        <strong className="text-[#0d101b] dark:text-white">
                          타입:
                        </strong>{" "}
                        {summary.businessModel.type}
                      </p>
                    )}
                    {summary.businessModel.revenueModel && (
                      <p>
                        <strong className="text-[#0d101b] dark:text-white">
                          수익 모델:
                        </strong>{" "}
                        {summary.businessModel.revenueModel}
                      </p>
                    )}
                    {summary.businessModel.priceRange && (
                      <p>
                        <strong className="text-[#0d101b] dark:text-white">
                          가격대:
                        </strong>{" "}
                        {summary.businessModel.priceRange}
                      </p>
                    )}
                  </div>
                </div>
              </details>
            )}

            {/* Key Strengths */}
            {summary?.keyStrengths && summary.keyStrengths.length > 0 && (
              <details
                open
                className="group rounded-xl bg-white dark:bg-[#1a1d2d] border border-[#cfd3e7] dark:border-white/10 overflow-hidden shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between p-4 list-none [&::-webkit-details-marker]:hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[#e7e9f3] dark:bg-white/10 text-[#0d101b] dark:text-white">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-[#0d101b] dark:text-[#f8f9fc]">
                      핵심 강점
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-[#0d101b] dark:text-white transition-transform duration-300 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="px-5 pb-5 pt-1">
                  <ul className="space-y-3">
                    {summary.keyStrengths.map(
                      (strength: string, idx: number) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm text-[#4c599a] dark:text-[#b0b8d6]"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
                          <span>{strength}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </details>
            )}

            {/* Growth Opportunities */}
            {summary?.growthOpportunities &&
              summary.growthOpportunities.length > 0 && (
                <details
                  open
                  className="group rounded-xl bg-white dark:bg-[#1a1d2d] border border-[#cfd3e7] dark:border-white/10 overflow-hidden shadow-sm"
                >
                  <summary className="flex cursor-pointer items-center justify-between p-4 list-none [&::-webkit-details-marker]:hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-[#e7e9f3] dark:bg-white/10 text-[#0d101b] dark:text-white">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                          />
                        </svg>
                      </div>
                      <p className="text-base font-bold text-[#0d101b] dark:text-[#f8f9fc]">
                        성장 가능성
                      </p>
                    </div>
                    <svg
                      className="w-6 h-6 text-[#0d101b] dark:text-white transition-transform duration-300 group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </summary>
                  <div className="px-5 pb-5 pt-1">
                    <ul className="space-y-3">
                      {summary.growthOpportunities.map(
                        (opportunity: string, idx: number) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-[#4c599a] dark:text-[#b0b8d6]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
                            <span>{opportunity}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </details>
              )}

            {/* Competitor Analysis */}
            {summary?.competitorAnalysis && (
              <details
                open
                className="group rounded-xl bg-white dark:bg-[#1a1d2d] border border-[#cfd3e7] dark:border-white/10 overflow-hidden shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between p-4 list-none [&::-webkit-details-marker]:hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[#e7e9f3] dark:bg-white/10 text-[#0d101b] dark:text-white">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-[#0d101b] dark:text-[#f8f9fc]">
                      경쟁 분석
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-[#0d101b] dark:text-white transition-transform duration-300 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="px-5 pb-5 pt-1 text-sm text-[#4c599a] dark:text-[#b0b8d6] leading-normal">
                  {summary.competitorAnalysis}
                </div>
              </details>
            )}

            {/* Actionable Insights */}
            {summary?.actionableInsights &&
              summary.actionableInsights.length > 0 && (
                <details
                  open
                  className="group rounded-xl bg-white dark:bg-[#1a1d2d] border border-[#cfd3e7] dark:border-white/10 overflow-hidden shadow-sm"
                >
                  <summary className="flex cursor-pointer items-center justify-between p-4 list-none [&::-webkit-details-marker]:hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-[#e7e9f3] dark:bg-white/10 text-[#0d101b] dark:text-white">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                          />
                        </svg>
                      </div>
                      <p className="text-base font-bold text-[#0d101b] dark:text-[#f8f9fc]">
                        실행 제안
                      </p>
                    </div>
                    <svg
                      className="w-6 h-6 text-[#0d101b] dark:text-white transition-transform duration-300 group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </summary>
                  <div className="px-5 pb-5 pt-1">
                    <ul className="space-y-3">
                      {summary.actionableInsights.map(
                        (insight: string, idx: number) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-[#4c599a] dark:text-[#b0b8d6]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
                            <span>{insight}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </details>
              )}

            {/* Market Opportunity */}
            {summary?.marketOpportunity && (
              <details
                open
                className="group rounded-xl bg-white dark:bg-[#1a1d2d] border border-[#cfd3e7] dark:border-white/10 overflow-hidden shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between p-4 list-none [&::-webkit-details-marker]:hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[#e7e9f3] dark:bg-white/10 text-[#0d101b] dark:text-white">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-[#0d101b] dark:text-[#f8f9fc]">
                      시장 기회
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-[#0d101b] dark:text-white transition-transform duration-300 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="px-5 pb-5 pt-1 text-sm text-[#4c599a] dark:text-[#b0b8d6] leading-normal">
                  {summary.marketOpportunity}
                </div>
              </details>
            )}
          </div>
        </section>

        {/* Error Display */}
        {downloadError && (
          <ErrorDisplay
            error={downloadError}
            onDismiss={() => setDownloadError(null)}
            className="mb-4"
          />
        )}

        {/* Download Section */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-bold tracking-tight">다운로드</h2>
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded">
              내보내기 준비 완료
            </span>
          </div>
          <div className="grid gap-3">
            {/* Full PDF Card */}
            <DownloadCard
              title="전체 웹사이트 PDF"
              description={`${pdf.pageCount} 페이지 • ${pdf.totalSizeMB} MB • 단일 파일`}
              icon={
                <svg
                  className="w-7 h-7 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
              iconBgColor="bg-red-50 dark:bg-red-900/20"
              iconBorderColor="border-red-100 dark:border-red-900/30"
              onClick={handleDownloadPDF}
            />

            {/* ZIP Card */}
            <DownloadCard
              title="개별 페이지 PDF"
              description={`ZIP 아카이브 • ${pdf.zipSizeMB || pdf.totalSizeMB} MB • ${pdf.individualPdfCount || pdf.pageCount}개 파일`}
              icon={
                <svg
                  className="w-7 h-7 text-amber-600 dark:text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
              }
              iconBgColor="bg-amber-50 dark:bg-amber-900/20"
              iconBorderColor="border-amber-100 dark:border-amber-900/30"
              onClick={handleDownloadZIP}
            />

            {/* Screenshot PDF Card */}
            {pdf.screenshotPdfUrl && (
              <DownloadCard
                title="원본 스크린샷 PDF"
                description={`법적 증거용 • 원본 품질 • ${pdf.pageCount}개 스크린샷`}
                icon={
                  <svg
                    className="w-7 h-7 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                }
                iconBgColor="bg-blue-50 dark:bg-blue-900/20"
                iconBorderColor="border-blue-100 dark:border-blue-900/30"
                onClick={handleDownloadScreenshotPDF}
              />
            )}
          </div>
        </section>

        {/* Included Pages List */}
        <section className="pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#4c599a] dark:text-[#94a3b8] px-1 mb-3">
            포함된 페이지 ({crawl.pages.length})
          </h3>
          <div className="bg-white dark:bg-[#1a1d2d] rounded-xl border border-[#cfd3e7] dark:border-white/10 overflow-hidden">
            <div
              className={`divide-y divide-[#cfd3e7]/50 dark:divide-white/10 ${
                showPagesList && hasMorePages
                  ? "max-h-[400px] overflow-y-auto"
                  : ""
              }`}
            >
              {displayedPages.map((page, idx) => (
                <div
                  key={page.url}
                  className="px-4 py-3 flex justify-between items-center group hover:bg-[#f8f9fc] dark:hover:bg-white/5 cursor-default transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-[18px] h-[18px] text-[#cfd3e7]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-[#0d101b] dark:text-[#f8f9fc] truncate">
                        {page.title || `페이지 ${idx + 1}`}
                      </span>
                      <span className="text-xs text-[#4c599a] dark:text-[#94a3b8] truncate mt-0.5">
                        {page.url}
                      </span>
                    </div>
                  </div>
                  <svg
                    className="w-[18px] h-[18px] text-green-500 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              ))}
              {showPagesList && hasMorePages && (
                <>
                  {crawl.pages.slice(5).map((page, idx) => (
                    <div
                      key={page.url}
                      className="px-4 py-3 flex justify-between items-center group hover:bg-[#f8f9fc] dark:hover:bg-white/5 cursor-default transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className="w-[18px] h-[18px] text-[#cfd3e7]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-[#0d101b] dark:text-[#f8f9fc] truncate">
                            {page.title || `페이지 ${idx + 6}`}
                          </span>
                          <span className="text-xs text-[#4c599a] dark:text-[#94a3b8] truncate mt-0.5">
                            {page.url}
                          </span>
                        </div>
                      </div>
                      <svg
                        className="w-[18px] h-[18px] text-green-500 shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ))}
                </>
              )}
            </div>
            {crawl.pages.length > 3 && (
              <div
                onClick={() => setShowPagesList(!showPagesList)}
                className="bg-[#f8f9fc] dark:bg-white/5 px-4 py-3 text-center border-t border-[#cfd3e7]/50 dark:border-white/10 cursor-pointer hover:bg-[#e7e9f3] dark:hover:bg-white/10 transition-colors"
              >
                <span className="text-sm font-bold text-primary">
                  {showPagesList
                    ? "접기"
                    : `모든 ${crawl.pages.length}개 페이지 보기`}
                </span>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#f6f6f8]/90 dark:bg-[#101322]/90 backdrop-blur-md border-t border-[#cfd3e7] dark:border-white/10 z-40">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => window.location.reload()}
            className="w-full h-12 rounded-lg bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            새 요약 시작
          </button>
        </div>
      </div>
    </div>
  );
}
