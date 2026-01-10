"use client";

import { useState } from "react";
import type {
  CrawlAPIRequest,
  CrawlAPIResponse,
  APIErrorResponse,
  GeneratePDFResponse,
} from "@/types/api";
import type { AppError } from '@/types/errors';
import Modal from "@/components/ui/modal";
import GuideModal from "@/components/ui/GuideModal";
import CrawlingProgressModal from "./CrawlingProgressModal";
import PageSelector from "./PageSelector";
import ResultDisplay from "./ResultDisplay";
import ErrorDisplay from "@/components/ui/ErrorDisplay";
import { inferErrorCode, getErrorInfo } from '@/constants/errorMessages';

interface CrawlerFormProps {
  onClose?: () => void;
  onComplete?: (data: {
    crawlResult: {
      totalPages: number;
      failedUrls: string[];
      duration: string;
      pages: Array<{
        url: string;
        title: string;
        content: string;
        depth: number;
        screenshot?: any;
        pageSummary?: string;
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
        zipDownloadUrl?: string;
        warnings?: string[];
      };
      summary: any;
    };
  }) => void;
}

export default function CrawlerForm({
  onClose,
  onComplete,
}: CrawlerFormProps = {}) {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(30);
  const [crawlMode, setCrawlMode] = useState<'full' | 'smart'>('smart');

  const [loading, setLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlAPIResponse | null>(null);
  const [pdfResult, setPdfResult] = useState<GeneratePDFResponse | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // 진행률 상태
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    url: string;
    percentage: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCrawlResult(null);
    setPdfResult(null);
    // 크롤링 시작 시 즉시 진행 모달 표시를 위해 초기 progress 설정
    setProgress({
      current: 0,
      total: maxPages,
      url: url,
      percentage: 0,
    });

    try {
      const requestBody: CrawlAPIRequest = {
        url,
        maxPages,
        crawlMode, // 크롤링 모드 전달
      };

      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("크롤링 요청 실패");
      }

      // SSE 스트림 읽기
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("응답을 읽을 수 없습니다");
      }

      let buffer = ""; // 불완전한 chunk를 모으는 버퍼

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // 버퍼에 새 chunk 추가
        buffer += decoder.decode(value, { stream: true });

        // 완전한 라인들만 추출 (마지막 불완전한 라인은 버퍼에 보관)
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 마지막 불완전한 라인은 버퍼에 유지

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              const data = JSON.parse(jsonStr);

              if (data.type === "progress") {
                // 진행률 업데이트
                setProgress({
                  current: data.current,
                  total: data.total,
                  url: data.url,
                  percentage: data.percentage,
                });
              } else if (data.type === "complete") {
                // 크롤링 완료
                setCrawlResult(data as CrawlAPIResponse);
                setProgress(null);
              } else if (data.type === "error") {
                // data.error가 AppError 객체인 경우와 문자열인 경우 모두 처리
                const errorData = typeof data.error === 'string'
                  ? getErrorInfo(inferErrorCode(data.error), data.error)
                  : data.error;
                setError(errorData);
                throw new Error(errorData.userMessage);
              }
            } catch (parseError) {
              console.error("[SSE Parse Error]", parseError, "Line:", line);
              // JSON 파싱 에러는 무시하고 계속 진행
            }
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "알 수 없는 에러가 발생했습니다";
      const errorData = getErrorInfo(inferErrorCode(errorMessage), errorMessage);
      setError(errorData);
    } finally {
      setLoading(false);
    }
  };

  const handlePDFComplete = (result: any) => {
    setPdfResult(result);
    if (onComplete && crawlResult) {
      // selectedPages가 있으면 그것을 사용, 없으면 전체 페이지
      const selectedPages = result.selectedPages || crawlResult.data.crawl.pages;

      onComplete({
        crawlResult: {
          ...crawlResult.data.crawl,
          pages: selectedPages, // 선택된 페이지만 전달
          totalPages: selectedPages.length, // 선택된 페이지 수로 변경
        },
        pdfResult: {
          pdf: result.data.pdf,
          summary: result.data.summary,
        },
      });
    }
  };

  // 모달이 열려있고 크롤링 중일 때
  if (loading && progress) {
    return <CrawlingProgressModal isOpen={true} progress={progress} />;
  }

  // 크롤링 완료 후 페이지 선택 단계
  if (crawlResult && !pdfResult) {
    return (
      <Modal isOpen={true} onClose={onClose || (() => {})}>
        <PageSelector
          pages={crawlResult.data.crawl.pages}
          onComplete={handlePDFComplete}
          onClose={onClose || (() => {})}
          crawlMode={crawlMode} // 크롤링 모드 전달
        />
      </Modal>
    );
  }

  // PDF 생성 완료는 PageSelector에서 완료 모달을 표시하므로 여기서는 처리하지 않음

  // 초기 폼 (URL 입력)
  return (
    <>
      <Modal isOpen={true} onClose={onClose || (() => {})} showCloseButton={true}>
        <div className="w-full p-6 sm:p-8">
          {/* Header with Guide Button */}
          <div className="flex items-center justify-between mb-6 pr-10">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              웹사이트 크롤링
            </h2>
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
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
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              사용방법
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div>
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
            >
              웹사이트 URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 dark:text-white bg-white dark:bg-slate-800"
              required
            />
          </div>

          {/* Max Pages */}
          <div>
            <label
              htmlFor="maxPages"
              className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
            >
              최대 페이지 수: {maxPages}
            </label>
            <input
              type="range"
              id="maxPages"
              min="1"
              max="50"
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mt-1">
              <span>1</span>
              <span>50</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              💡 크롤링 후 PDF에 포함할 페이지를 직접 선택할 수 있습니다
            </p>
          </div>

          {/* Crawl Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
              크롤링 모드
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Smart Mode */}
              <button
                type="button"
                onClick={() => setCrawlMode('smart')}
                className={`relative p-4 border-2 rounded-lg transition-all text-left ${
                  crawlMode === 'smart'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      스마트 모드
                    </h3>
                  </div>
                  {crawlMode === 'smart' && (
                    <span className="text-blue-500">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
                  비즈니스 분석용. 중요한 페이지만 포함하여 핵심 내용에 집중
                </p>
              </button>

              {/* Full Mode */}
              <button
                type="button"
                onClick={() => setCrawlMode('full')}
                className={`relative p-4 border-2 rounded-lg transition-all text-left ${
                  crawlMode === 'full'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📁</span>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      전체 아카이브
                    </h3>
                  </div>
                  {crawlMode === 'full' && (
                    <span className="text-blue-500">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
                  법적 증거 보존용. 모든 페이지를 스크린샷 PDF에 완전 보존
                </p>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              💡 {crawlMode === 'smart' ? '영업팀/투자심사역에게 추천' : '법무팀/로펌에게 추천'}
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
          >
            크롤링 시작
          </button>
        </form>

          {/* Error Display */}
          {error && (
            <ErrorDisplay
              error={error}
              onRetry={() => {
                setError(null);
                setCrawlResult(null);
                setPdfResult(null);
              }}
              className="mt-6"
            />
          )}
        </div>
      </Modal>

      {/* Guide Modal */}
      <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </>
  );
}
