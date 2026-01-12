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
        fullPageScreenshot?: any; // 전체 페이지 스크린샷 (법적 증거용)
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
        zipDownloadUrl: string; // 개별 PDF ZIP 파일 다운로드 URL
        screenshotPdfUrl?: string | null; // 스크린샷 PDF 다운로드 URL
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
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

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
    setProgress({
      current: 0,
      total: maxPages,
      url: url,
      percentage: 0,
    });

    try {
      // 1. 작업 등록
      const createJobResponse = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, maxPages, crawlMode }),
      });

      if (!createJobResponse.ok) {
        const errorData: APIErrorResponse = await createJobResponse.json();
        throw new Error(errorData.error?.userMessage || "작업 등록 실패");
      }

      const { data: { jobId } } = await createJobResponse.json();
      console.log(`[Frontend] 작업 등록 완료: ${jobId}`);
      setCurrentJobId(jobId);

      // 2. 폴링 시작
      let pollInterval: NodeJS.Timeout | null = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/jobs/${jobId}/status`);
          const statusData = await statusResponse.json();

          if (!statusData.success) {
            throw new Error(statusData.error?.userMessage || "상태 확인 실패");
          }

          const { status, progress: jobProgress, result, error: jobError } = statusData.data;

          // 진행률 업데이트
          if (jobProgress) {
            setProgress({
              current: jobProgress.current || 0,
              total: jobProgress.total || maxPages,
              url: jobProgress.message || "",
              percentage: jobProgress.percentage || 0,
            });
          }

          // 크롤링 완료 처리 (Step 1 완료 → Step 2 페이지 선택으로 이동)
          if (status === "crawl_completed" && result) {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            setProgress(null);
            setLoading(false);

            // 크롤링 결과를 기존 형식으로 변환 (PageSelector로 전달)
            const crawlResult: CrawlAPIResponse = {
              success: true,
              data: {
                crawl: {
                  totalPages: result.crawlResult.totalPages,
                  failedUrls: result.crawlResult.failedUrls || [],
                  duration: "0초",
                  crawlMode: crawlMode,
                  pages: (result.crawlResult.pages || []).map((page: {
                    url: string;
                    title: string;
                    content: string;
                    depth: number;
                    screenshot?: string;
                    fullPageScreenshot?: string;
                    pageType?: string;
                  }) => ({
                    url: page.url,
                    title: page.title,
                    content: page.content,
                    depth: page.depth,
                    screenshot: page.screenshot, // base64 string
                    fullPageScreenshot: page.fullPageScreenshot,
                    pageType: page.pageType,
                    defaultChecked: true,
                    importance: 50,
                  })),
                },
              },
            };
            setCrawlResult(crawlResult);
            // pdfResult는 아직 없음 - PageSelector에서 PDF 생성 후 설정됨
          }

          // PDF 생성 완료 처리 (Step 3 완료)
          if (status === "completed" && result) {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            setProgress(null);
            setLoading(false);

            // 결과를 기존 형식으로 변환
            const pdfResult: GeneratePDFResponse = {
              success: true,
              data: {
                pdf: {
                  mergedPdf: result.pdfUrl,
                  mergedPdfTooLarge: false,
                  zipDownloadUrl: result.zipUrl,
                  screenshotPdfUrl: result.screenshotPdfUrl || null,
                  warnings: [],
                  // Lambda 이전 버전과 동일: 실제 값 사용
                  pageCount: result.pageCount || result.processedPages || result.crawlResult?.totalPages || 0,
                  totalSize: result.totalSize || 0,
                  totalSizeMB: result.totalSizeMB ? `${result.totalSizeMB} MB` : "0 MB",
                  // ZIP 파일 정보 (Lambda 이전 버전과 동일)
                  zipSize: result.zipSize || 0,
                  zipSizeMB: result.zipSizeMB ? `${result.zipSizeMB} MB` : "0 MB",
                  individualPdfCount: result.individualPdfCount || result.processedPages || result.crawlResult?.totalPages || 0,
                },
                summary: result.summary,
              },
            };
            setPdfResult(pdfResult);
          }

          // 실패 처리
          if (status === "failed") {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            setProgress(null);
            throw new Error(jobError || "작업 실패");
          }
        } catch (err) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          setProgress(null);
          const errorMessage = err instanceof Error ? err.message : "상태 확인 실패";
          const errorData = getErrorInfo(inferErrorCode(errorMessage), errorMessage);
          setError(errorData);
        }
      }, 2000); // 2초마다 폴링

      // Lambda 15분 타임아웃을 넘기지 않도록 15분 후 강제 종료
      setTimeout(() => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
          setLoading(false);
          setError(getErrorInfo(inferErrorCode("작업 시간이 초과되었습니다."), "작업 시간이 초과되었습니다."));
        }
      }, 15 * 60 * 1000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "알 수 없는 에러가 발생했습니다";
      const errorData = getErrorInfo(inferErrorCode(errorMessage), errorMessage);
      setError(errorData);
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

  // 크롤링 완료 후 페이지 선택 단계 (Step 2)
  if (crawlResult && !pdfResult && currentJobId) {
    return (
      <Modal isOpen={true} onClose={onClose || (() => {})}>
        <PageSelector
          pages={crawlResult.data.crawl.pages}
          onComplete={handlePDFComplete}
          onClose={onClose || (() => {})}
          crawlMode={crawlMode}
          jobId={currentJobId} // Lambda PDF 생성용 jobId 전달
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
              max="200"
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mt-1">
              <span>1</span>
              <span>200</span>
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
