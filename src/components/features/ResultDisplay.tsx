"use client";

import { useState } from "react";
import type { GeneratePDFResponse } from "@/types/api";

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
      individualPdfsZip: string;
      zipDownloadUrl?: string; // 큰 ZIP 파일은 서버 URL로 제공
      warnings?: string[];
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

  // 파일명 생성 (예: stclab_website_analysis_2024-01-15.pdf)
  const generateFilename = (extension: "pdf" | "zip") => {
    try {
      // 첫 번째 페이지의 URL에서 도메인 추출
      const firstPageUrl = crawl.pages[0]?.url || "website";
      const domain = new URL(firstPageUrl).hostname
        .replace("www.", "")
        .replace(/\./g, "_"); // 점을 언더스코어로 변경

      // 날짜 (YYYY-MM-DD)
      const date = new Date().toISOString().split("T")[0];

      if (extension === "zip") {
        return `${domain}_website_analysis_${date}_pages.zip`;
      }
      return `${domain}_website_analysis_${date}.pdf`;
    } catch {
      const date = new Date().toISOString().split("T")[0];
      return extension === "zip"
        ? `website_analysis_${date}_pages.zip`
        : `website_analysis_${date}.pdf`;
    }
  };

  const handleDownloadPDF = async () => {
    // PDF가 너무 큰 경우
    if (pdf.mergedPdfTooLarge) {
      alert(
        `통합 PDF가 너무 큽니다 (${pdf.totalSizeMB}MB).\n대신 개별 PDF ZIP 파일을 다운로드해주세요.`
      );
      return;
    }

    if (!pdf.mergedPdf) {
      alert("PDF 데이터가 없습니다");
      return;
    }

    try {
      const filename = generateFilename("pdf");

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
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("PDF 다운로드 에러:", error);
      alert(
        "❌ PDF 다운로드에 실패했습니다.\n\n파일 크기가 너무 크거나 네트워크 문제일 수 있습니다.\n잠시 후 다시 시도해주세요."
      );
    }
  };

  const handleDownloadZIP = async () => {
    try {
      const filename = generateFilename("zip");

      // 서버에 저장된 ZIP 파일이 있으면 직접 다운로드
      if (pdf.zipDownloadUrl) {
        const a = document.createElement("a");
        a.href = pdf.zipDownloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Base64 ZIP이 있으면 변환해서 다운로드
      if (!pdf.individualPdfsZip) {
        alert(
          "⚠️ ZIP 파일을 찾을 수 없습니다.\n\n서버에서 ZIP 생성 중 문제가 발생했을 수 있습니다.\n다시 크롤링을 시도해주세요."
        );
        return;
      }

      // Base64를 Blob으로 변환
      const binaryString = window.atob(pdf.individualPdfsZip);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/zip" });

      // 다운로드
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("ZIP 다운로드 에러:", error);
      alert(
        "❌ ZIP 다운로드에 실패했습니다.\n\n파일 변환 중 문제가 발생했습니다.\n개별 PDF를 하나씩 다운로드하거나, 다시 시도해주세요."
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-green-600 text-2xl">✅</span>
          <div>
            <h3 className="font-semibold text-green-900 text-lg">
              크롤링 완료!
            </h3>
            <p className="text-green-700 text-sm mt-1">
              {crawl.totalPages}개 페이지를 {crawl.duration}에 수집했습니다
            </p>
          </div>
        </div>
      </div>

      {/* Crawl Stats */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          크롤링 정보
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600 dark:text-slate-400">
              수집 페이지
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {crawl.totalPages}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-slate-400">
              실패 페이지
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {crawl.failedUrls.length}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-slate-400">
              소요 시간
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {crawl.duration}
            </div>
          </div>
        </div>
      </div>

      {/* Crawled Pages List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900 dark:text-white">
            수집된 페이지 목록
          </h4>
          <button
            onClick={() => setShowPagesList(!showPagesList)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-2"
          >
            {showPagesList ? (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
                접기
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
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
                펼쳐보기
              </>
            )}
          </button>
        </div>
        {showPagesList && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {crawl.pages.map((page, idx) => (
              <details
                key={idx}
                className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
              >
                <summary className="cursor-pointer">
                  <div className="inline-flex items-start gap-3 w-full">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-semibold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-gray-900 dark:text-white truncate">
                        {page.title || "제목 없음"}
                      </h5>
                      <p className="text-sm text-blue-600 dark:text-blue-400 truncate">
                        {page.url}
                      </p>
                    </div>
                  </div>
                </summary>
                <div className="mt-4 pl-9 space-y-2">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700 dark:text-slate-300">
                      깊이:
                    </span>{" "}
                    <span className="text-gray-600 dark:text-slate-400">
                      {page.depth}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700 dark:text-slate-300">
                      텍스트 미리보기:
                    </span>
                    <p className="text-gray-600 dark:text-slate-400 mt-1 whitespace-pre-wrap line-clamp-6 bg-gray-50 dark:bg-slate-900/50 p-3 rounded">
                      {page.content.slice(0, 500)}
                      {page.content.length > 500 ? "..." : ""}
                    </p>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* PDF Download */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          PDF 다운로드
        </h4>
        <div className="space-y-4">
          {/* Merged PDF */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 pb-4">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                전체 사이트 PDF
              </div>
              <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                모든 페이지가 병합된 PDF (목차 포함)
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-500 mt-1">
                {pdf.totalSizeMB} MB · {pdf.pageCount}개 페이지
              </div>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              다운로드
            </button>
          </div>

          {/* Individual PDFs ZIP */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                개별 페이지 PDF (ZIP)
              </div>
              <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                각 페이지를 개별 PDF로 압축한 파일
              </div>
            </div>
            <button
              onClick={handleDownloadZIP}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              ZIP 다운로드
            </button>
          </div>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          AI 비즈니스 분석
        </h4>

        {/* Header Info */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="inline-block bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-sm font-semibold px-3 py-1 rounded">
              {summary.websiteType}
            </span>
            {summary.companyName && (
              <span className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm font-semibold px-3 py-1 rounded">
                {summary.companyName}
              </span>
            )}
          </div>
          <h5 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {summary.oneLineSummary}
          </h5>
          <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
            {summary.overview}
          </p>
        </div>

        <div className="space-y-6">
          {/* Problem Solved */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 dark:border-orange-400 p-4 rounded">
            <h5 className="font-medium text-orange-900 dark:text-orange-200 mb-2">
              💡 해결하는 문제
            </h5>
            <p className="text-gray-700 dark:text-slate-300">
              {summary.problemSolved}
            </p>
          </div>

          {/* Business Model */}
          {summary.businessModel && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                  비즈니스 타입
                </div>
                <div className="text-gray-800 dark:text-slate-200">
                  {summary.businessModel.type}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                  수익 모델
                </div>
                <div className="text-gray-800 dark:text-slate-200">
                  {summary.businessModel.revenueModel}
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-1">
                  가격대
                </div>
                <div className="text-gray-800 dark:text-slate-200">
                  {summary.businessModel.priceRange}
                </div>
              </div>
            </div>
          )}

          {/* Main Services */}
          {summary.mainServices.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                주요 서비스/제품
              </h5>
              <ul className="space-y-2">
                {summary.mainServices.map((service: string, idx: number) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 bg-gray-50 dark:bg-slate-900/50 p-3 rounded"
                  >
                    <span className="text-blue-600 dark:text-blue-400 mt-1 font-bold">
                      {idx + 1}.
                    </span>
                    <span className="text-gray-700 dark:text-slate-300">
                      {service}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Target Customers */}
          {summary.targetCustomers.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                타겟 고객
              </h5>
              <div className="space-y-2">
                {summary.targetCustomers.map(
                  (customer: string, idx: number) => (
                    <div
                      key={idx}
                      className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-3 rounded-lg text-gray-700 dark:text-slate-300"
                    >
                      👤 {customer}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Unique Features */}
          {summary.uniqueFeatures.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                차별화 요소
              </h5>
              <ul className="space-y-2">
                {summary.uniqueFeatures.map((feature: string, idx: number) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 p-3 border border-green-200 dark:border-green-800 rounded bg-green-50 dark:bg-green-900/20"
                  >
                    <span className="text-green-600 dark:text-green-400 mt-1">
                      ✓
                    </span>
                    <span className="text-gray-700 dark:text-slate-300">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Strengths & Improvements */}
          {(summary.keyStrengths || summary.improvementAreas) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {summary.keyStrengths && (
                <div className="border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <h5 className="font-medium text-green-900 dark:text-green-200 mb-3 flex items-center gap-2">
                    💪 핵심 강점
                  </h5>
                  <ul className="space-y-2 text-sm">
                    {summary.keyStrengths.map((item: string, idx: number) => (
                      <li
                        key={idx}
                        className="text-gray-700 dark:text-slate-300 leading-relaxed"
                      >
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.improvementAreas && (
                <div className="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                  <h5 className="font-medium text-amber-900 dark:text-amber-200 mb-3 flex items-center gap-2">
                    🔧 개선 영역
                  </h5>
                  <ul className="space-y-2 text-sm">
                    {summary.improvementAreas.map(
                      (item: string, idx: number) => (
                        <li
                          key={idx}
                          className="text-gray-700 dark:text-slate-300 leading-relaxed"
                        >
                          • {item}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Competitor Analysis */}
          {summary.competitorAnalysis && (
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <h5 className="font-medium text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                📊 경쟁 분석
              </h5>
              <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed">
                {summary.competitorAnalysis}
              </p>
            </div>
          )}

          {/* Actionable Insights */}
          {summary.actionableInsights &&
            summary.actionableInsights.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5">
                <h5 className="font-medium text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2 text-lg">
                  🎯 실행 제안
                </h5>
                <ul className="space-y-3">
                  {summary.actionableInsights.map(
                    (insight: string, idx: number) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3 rounded shadow-sm"
                      >
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-600 dark:bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-gray-800 dark:text-slate-200 leading-relaxed">
                          {insight}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

          {/* Market Opportunity */}
          {summary.marketOpportunity && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 dark:border-emerald-400 p-4 rounded">
              <h5 className="font-medium text-emerald-900 dark:text-emerald-200 mb-2 flex items-center gap-2">
                🚀 시장 기회
              </h5>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                {summary.marketOpportunity}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
