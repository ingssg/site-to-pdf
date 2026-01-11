"use client";

import { useState } from "react";
import type {
  GeneratePDFRequest,
  GeneratePDFResponse,
  APIErrorResponse,
} from "@/types/api";
import type { AppError } from '@/types/errors';
import PDFGenerationProgressModal from "./PDFGenerationProgressModal";
import PDFCompletionModal from "./PDFCompletionModal";
import ErrorDisplay from "@/components/ui/ErrorDisplay";
import GuideModal from "@/components/ui/GuideModal";
import { ErrorCode, getErrorInfo, inferErrorCode } from '@/constants/errorMessages';

interface PageSelectorProps {
  pages: Array<{
    url: string;
    title: string;
    content: string;
    depth: number;
    screenshot?: any;
    fullPageScreenshot?: any; // 전체 페이지 스크린샷 (법적 증거용)
    defaultChecked?: boolean;
    importance?: number;
    exclusionReason?: string;
    pageType?: string;
  }>;
  onComplete: (result: GeneratePDFResponse) => void;
  onClose?: () => void;
  crawlMode?: "full" | "smart"; // 크롤링 모드
}

export default function PageSelector({
  pages,
  onComplete,
  onClose,
  crawlMode = "smart", // 기본값: smart 모드
}: PageSelectorProps) {
  // 기본값: defaultChecked가 true인 페이지만 선택됨 (스마트 필터링)
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(
    new Set(pages.filter((p) => p.defaultChecked !== false).map((p) => p.url))
  );
  const [generating, setGenerating] = useState(false);
  const [aiFiltering, setAiFiltering] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [completed, setCompleted] = useState(false);
  const [pdfResult, setPdfResult] = useState<GeneratePDFResponse | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedPagesForResult, setSelectedPagesForResult] = useState<typeof pages>([]);

  // PDF 생성 진행률 상태
  const [progress, setProgress] = useState<{
    message: string;
    percentage: number;
  } | null>(null);

  const togglePage = (url: string) => {
    const newSelected = new Set(selectedUrls);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedUrls(newSelected);
  };

  const toggleAll = () => {
    if (selectedUrls.size === pages.length) {
      // 전체 해제
      setSelectedUrls(new Set());
    } else {
      // 전체 선택
      setSelectedUrls(new Set(pages.map((p) => p.url)));
    }
  };

  // 필터 프리셋 적용
  const applyPreset = (preset: "all" | "recommended" | "core") => {
    let selected: string[] = [];

    switch (preset) {
      case "all":
        selected = pages.map((p) => p.url);
        break;
      case "recommended":
        selected = pages
          .filter((p) => (p.importance || 0) > 60)
          .map((p) => p.url);
        break;
      case "core":
        selected = pages
          .filter((p) => (p.importance || 0) > 70)
          .map((p) => p.url);
        break;
    }

    setSelectedUrls(new Set(selected));
  };

  // AI 자동 선택
  const handleAIFilter = async () => {
    setAiFiltering(true);
    setError(null);
    setShowReasoning(false); // 초기에 접혀있게 (명시적으로 false 설정)

    try {
      console.log('[PageSelector] AI 필터링 시작...');

      // API 호출용 데이터 준비 (콘텐츠 1500자로 증가 - 맥락 개선)
      const requestData = {
        pages: pages.map(page => ({
          url: page.url,
          title: page.title,
          content: page.content.substring(0, 1500),
          pageType: page.pageType,
          importance: page.importance,
        })),
      };

      const response = await fetch('/api/ai-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error('AI 필터링 API 호출 실패');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.userMessage || 'AI 필터링 실패');
      }

      console.log(`[AI Filter] API 응답:`, result.data.selectedUrls);
      console.log(`[AI Filter] pages 배열 URLs:`, pages.map(p => p.url));

      // 선택된 URL들이 실제 pages 배열에 있는지 확인
      const validUrls = result.data.selectedUrls.filter((url: string) =>
        pages.some(p => p.url === url)
      );
      const invalidUrls = result.data.selectedUrls.filter((url: string) =>
        !pages.some(p => p.url === url)
      );

      if (invalidUrls.length > 0) {
        console.error(`[AI Filter] ⚠️ pages 배열에 없는 URL이 선택됨:`, invalidUrls);
      }

      console.log(`[AI Filter] 유효한 URL: ${validUrls.length}개, 무효한 URL: ${invalidUrls.length}개`);

      // 선택된 URL들로 상태 업데이트 (유효한 URL만)
      setSelectedUrls(new Set(validUrls));

      // AI 선택 이유 저장 (기본 접힌 상태 유지)
      setAiReasoning(result.data.reasoning);
      // setShowReasoning(false); // 이미 위에서 false로 설정됨

      console.log(`[AI Filter] ${validUrls.length}개 선택 (${result.data.selectedUrls.length}개 중)`);
      console.log(`[AI Filter] 이유: ${result.data.reasoning}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'AI 자동 선택 실패';
      const errorData = getErrorInfo(inferErrorCode(errorMessage), errorMessage);
      setError(errorData);
      console.error('[PageSelector] AI 필터링 에러:', err);
    } finally {
      setAiFiltering(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (selectedUrls.size === 0) {
      setError(getErrorInfo(ErrorCode.NO_PAGES_SELECTED));
      return;
    }

    setGenerating(true);
    setError(null);
    setProgress(null);

    try {
      console.log(`[PageSelector] ========== PDF 생성 시작 ==========`);
      console.log(`[PageSelector] 선택된 URL 개수: ${selectedUrls.size}`);
      console.log(`[PageSelector] 선택된 URLs:`, Array.from(selectedUrls));
      console.log(`[PageSelector] 전체 pages 개수: ${pages.length}`);

      const selectedPages = pages.filter((p) => selectedUrls.has(p.url));

      console.log(`[PageSelector] 필터링된 selectedPages 개수: ${selectedPages.length}`);
      console.log(`[PageSelector] selectedPages titles:`, selectedPages.map(p => p.title));

      if (selectedPages.length !== selectedUrls.size) {
        console.error(`[PageSelector] ⚠️ 페이지 누락 발생! selectedUrls=${selectedUrls.size}, selectedPages=${selectedPages.length}`);
      }

      // 선택된 페이지 저장 (ResultDisplay에 전달용)
      setSelectedPagesForResult(selectedPages);

      const requestBody: GeneratePDFRequest = {
        pages: selectedPages,
        detailLevel: "detailed", // MVP: detailed 분석 (비즈니스 모델, 강점, 개선점 포함)
        crawlMode, // 크롤링 모드 전달
      };

      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("PDF 생성 요청 실패");
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
                console.log(
                  "[PDF Progress]",
                  data.message,
                  data.percentage + "%"
                );
                setProgress({
                  message: data.message,
                  percentage: data.percentage,
                });
              } else if (data.type === "complete") {
                // PDF 생성 완료
                console.log("[PDF Complete]", data);
                setProgress(null);
                setGenerating(false);
                setCompleted(true);
                setPdfResult(data as GeneratePDFResponse);
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
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-2rem)] relative overflow-visible">
      {/* 헤더 섹션 */}
      <header className="px-4 sm:px-6 pt-6 sm:pt-8 pb-2 flex flex-col shrink-0 z-20 relative">
        {/* X 버튼 */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 sm:top-0 right-2 sm:right-0 p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 z-10"
            aria-label="닫기"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Step Indicator */}
        <div className="flex justify-between items-center mb-4 sm:mb-6 pr-8 sm:pr-10">
          <div className="flex items-center gap-1.5 sm:gap-2 text-primary font-bold text-xs sm:text-sm bg-primary/10 pl-1.5 sm:pl-2 pr-2 sm:pr-3 py-1 sm:py-1.5 rounded-full">
            <svg
              className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-primary"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Step 2 of 3</span>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary/30"></div>
            <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary"></div>
            <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          </div>
        </div>

        {/* Title Area */}
        <div className="flex flex-col gap-1 mb-3 sm:mb-4">
          <div className="flex items-center justify-between relative">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#0d101b] dark:text-white leading-tight">
                페이지 선택
              </h1>
              <p className="text-xs sm:text-sm text-[#4c599a] dark:text-slate-400 font-medium">
                {pages.length}개 페이지 수집 완료
                <br />
                리포트에 포함할 페이지를 선택하세요
              </p>
            </div>
            {/* 사용방법 버튼 */}
            <div className="ml-2 sm:ml-4 flex-shrink-0">
              <button
                onClick={() => setShowGuide(true)}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                aria-label="사용방법"
              >
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
                <span className="hidden sm:inline">사용방법</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Guide Modal */}
      <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 pb-32 no-scrollbar">
        {/* 전체 선택 컨트롤 (Sticky) - 컴팩트 버전 */}
        <div className="sticky top-0 z-10 pt-1 pb-2 bg-white dark:bg-slate-800 space-y-2">
          <label className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedUrls.size === pages.length}
                onChange={toggleAll}
                className="custom-checkbox h-4 w-4 appearance-none rounded border-2 border-[#cfd3e7] dark:border-slate-600 bg-transparent text-primary checked:bg-primary checked:border-primary focus:ring-0 focus:ring-offset-0 transition-all"
                style={{
                  backgroundImage:
                    selectedUrls.size === pages.length
                      ? "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")"
                      : "none",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "70%",
                }}
              />
              <span className="font-semibold text-[#0d101b] dark:text-white text-xs sm:text-sm">
                전체 선택
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4c599a] dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {pages.length}
            </span>
          </label>

          {/* AI 자동 선택 버튼 - 프리미엄 (완료 후 숨김) */}
          {!aiReasoning && (
            <button
              onClick={handleAIFilter}
              disabled={aiFiltering || pages.length === 0}
              className="w-full px-3 py-2 text-xs font-bold bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 transition-colors border border-purple-200 dark:border-purple-800 flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed relative"
            >
            {aiFiltering ? (
              <>
                {/* AI 분석 중 애니메이션 */}
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="font-bold">AI가 페이지를 분석하고 있습니다</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] opacity-75">
                  <div className="w-1 h-1 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  <span className="ml-1">콘텐츠 기반 필터링 중</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-base">🤖</span>
                  <span>AI 자동 선택</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded shadow-sm">
                    ✨ Premium
                  </span>
                </div>
                <span className="text-[10px] font-normal opacity-75">
                  비즈니스 분석에 필요한 핵심 페이지만 자동 선별
                </span>
              </>
            )}
          </button>
          )}

          {/* AI 선택 이유 박스 - 컴팩트 */}
          {aiReasoning && (
            <div className="rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 overflow-hidden">
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🤖</span>
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                    AI가 {selectedUrls.size}개 페이지를 선택했습니다
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-purple-700 dark:text-purple-300 transition-transform ${
                    showReasoning ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showReasoning && (
                <div className="px-3 pb-3 pt-1 border-t border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {aiReasoning}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 페이지 리스트 */}
        <div className="flex flex-col gap-2 sm:gap-3">
          {pages.map((page, idx) => {
            const isSelected = selectedUrls.has(page.url);
            return (
              <label
                key={page.url}
                className={`group relative flex items-start gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer transition-all hover:border-primary/40 ${
                  !isSelected ? "opacity-70 hover:opacity-100" : ""
                }`}
              >
                <div className="pt-0.5 sm:pt-1 shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePage(page.url)}
                    className="custom-checkbox h-5 w-5 sm:h-6 sm:w-6 appearance-none rounded border-2 border-[#cfd3e7] dark:border-slate-600 bg-transparent text-primary checked:bg-primary checked:border-primary focus:ring-0 focus:ring-offset-0 transition-all"
                    style={{
                      backgroundImage: isSelected
                        ? "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")"
                        : "none",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: "70%",
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5 sm:gap-1">
                  <div className="flex justify-between items-start gap-1.5 sm:gap-2">
                    <h3 className="font-bold text-[#0d101b] dark:text-white truncate text-sm sm:text-base flex-1">
                      {page.title || "제목 없음"}
                    </h3>

                    {/* 우측 버튼 그룹 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* 페이지 타입 배지 */}
                      {page.pageType && page.pageType !== "General" && (
                        <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {page.pageType}
                        </span>
                      )}

                      {/* 사이트 확인 버튼 */}
                      <button
                        onClick={(e) => {
                          e.preventDefault(); // 체크박스 토글 방지
                          e.stopPropagation();
                          window.open(page.url, '_blank', 'noopener,noreferrer');
                        }}
                        className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors flex items-center gap-1"
                        title="새 탭에서 사이트 확인"
                      >
                        <svg
                          className="w-3 h-3 sm:w-3.5 sm:h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        <span className="hidden sm:inline">확인</span>
                      </button>
                    </div>
                  </div>

                  {/* 제외 이유만 표시 */}
                  {page.defaultChecked === false && page.exclusionReason && (
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        선택사항: {page.exclusionReason}
                      </span>
                    </div>
                  )}

                  <p className="text-[10px] sm:text-xs text-primary font-medium truncate bg-primary/5 dark:bg-primary/20 px-1 sm:px-1.5 py-0.5 rounded max-w-full">
                    {page.url}
                  </p>
                  <p className="text-xs sm:text-sm text-[#4c599a] dark:text-slate-400 leading-snug line-clamp-2 mt-0.5 sm:mt-1">
                    {page.content.slice(0, 150)}...
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </main>

      {/* PDF 생성 진행률 모달 */}
      {generating && !completed && (
        <PDFGenerationProgressModal
          isOpen={true}
          progress={progress}
          onClose={onClose}
        />
      )}

      {/* PDF 생성 완료 모달 */}
      {completed &&
        pdfResult &&
        (() => {
          // 파일명 생성
          const generateFilename = (extension: "pdf" | "zip") => {
            try {
              const firstPageUrl = pages[0]?.url || "website";
              const domain = new URL(firstPageUrl).hostname
                .replace("www.", "")
                .replace(/\./g, "_");
              const date = new Date().toISOString().split("T")[0];
              if (extension === "zip") {
                return `${domain}_business_intelligence_${date}_pages.zip`;
              }
              return `${domain}_business_intelligence_${date}.pdf`;
            } catch {
              const date = new Date().toISOString().split("T")[0];
              return extension === "zip"
                ? `business_intelligence_${date}_pages.zip`
                : `business_intelligence_${date}.pdf`;
            }
          };

          const fileName = pdfResult.data?.pdf?.mergedPdf
            ? generateFilename("pdf")
            : generateFilename("zip");
          const fileSize =
            pdfResult.data?.pdf?.totalSizeMB ||
            (pdfResult.data?.pdf?.mergedPdf ? "2.4 MB" : "24.8 MB");

          return (
            <PDFCompletionModal
              isOpen={true}
              onClose={() => {
                setCompleted(false);
                if (onClose) onClose();
              }}
              onViewResults={() => {
                setCompleted(false);
                // pdfResult에 selectedPages 정보 추가해서 전달
                if (pdfResult) {
                  onComplete({
                    ...pdfResult,
                    selectedPages: selectedPagesForResult,
                  } as any);
                }
              }}
              fileName={fileName}
              fileSize={fileSize}
            />
          );
        })()}

      {/* 하단 고정 영역 (팝업창 하단에 붙임) */}
      <div className="absolute bottom-0 left-0 w-full z-30">
        {/* Gradient fade */}
        <div className="h-6 sm:h-8 w-full bg-gradient-to-b from-transparent to-white dark:to-slate-800"></div>
        <div className="bg-white dark:bg-slate-800 px-4 sm:px-6 pb-6 sm:pb-8 pt-2">
          {/* 에러 표시 */}
          {error && (
            <ErrorDisplay
              error={error}
              onRetry={handleGeneratePDF}
              onDismiss={() => setError(null)}
              className="mb-3 sm:mb-4"
            />
          )}

          {/* PDF 생성 버튼 */}
          {!generating && (
            <button
              onClick={handleGeneratePDF}
              disabled={selectedUrls.size === 0}
              className="w-full bg-primary hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold text-base sm:text-lg py-3 sm:py-4 rounded-xl shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-between px-4 sm:px-6 group"
            >
              <span className="flex items-center gap-1.5 sm:gap-2">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
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
                PDF 생성
              </span>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm font-semibold bg-white/20 px-1.5 sm:px-2 py-0.5 rounded text-white">
                  {selectedUrls.size} selected
                </span>
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          )}

          <div className="text-center mt-2 sm:mt-3">
            <p className="text-[10px] sm:text-xs text-[#4c599a] dark:text-slate-500 font-medium">
              예상 생성 시간: ~30초
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
