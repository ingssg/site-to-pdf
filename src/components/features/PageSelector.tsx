"use client";

import { useState, useEffect, useRef } from "react";
import type {
  GeneratePDFRequest,
  GeneratePDFResponse,
  APIErrorResponse,
} from "@/types/api";
import PDFGenerationProgressModal from "./PDFGenerationProgressModal";
import PDFCompletionModal from "./PDFCompletionModal";

interface PageSelectorProps {
  pages: Array<{
    url: string;
    title: string;
    content: string;
    depth: number;
    screenshot?: any;
  }>;
  onComplete: (result: GeneratePDFResponse) => void;
  onClose?: () => void;
}

export default function PageSelector({
  pages,
  onComplete,
  onClose,
}: PageSelectorProps) {
  // 기본값: 모든 페이지 선택됨
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(
    new Set(pages.map((p) => p.url))
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [pdfResult, setPdfResult] = useState<GeneratePDFResponse | null>(null);
  const [showUsageGuide, setShowUsageGuide] = useState(false);
  const usageGuideRef = useRef<HTMLDivElement>(null);
  const usageGuideButtonRef = useRef<HTMLButtonElement>(null);

  // 사용 방법 팝업 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showUsageGuide &&
        usageGuideRef.current &&
        usageGuideButtonRef.current &&
        !usageGuideRef.current.contains(event.target as Node) &&
        !usageGuideButtonRef.current.contains(event.target as Node)
      ) {
        setShowUsageGuide(false);
      }
    };

    if (showUsageGuide) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUsageGuide]);

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

  const handleGeneratePDF = async () => {
    if (selectedUrls.size === 0) {
      alert("최소 1개 이상의 페이지를 선택해주세요");
      return;
    }

    setGenerating(true);
    setError(null);
    setProgress(null);

    try {
      const selectedPages = pages.filter((p) => selectedUrls.has(p.url));

      const requestBody: GeneratePDFRequest = {
        pages: selectedPages,
        detailLevel: "detailed", // MVP: detailed 분석 (비즈니스 모델, 강점, 개선점 포함)
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
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error("[SSE Parse Error]", parseError, "Line:", line);
              // JSON 파싱 에러는 무시하고 계속 진행
            }
          }
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 에러가 발생했습니다"
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-2rem)] relative overflow-visible">
      {/* 헤더 섹션 */}
      <header className="px-6 pt-8 pb-2 flex flex-col shrink-0 z-20 relative">
        {/* X 버튼 */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 z-10"
            aria-label="닫기"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Step Indicator */}
        <div className="flex justify-between items-center mb-6 pr-10">
          <div className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/10 pl-2 pr-3 py-1.5 rounded-full">
            <svg
              className="w-[18px] h-[18px] text-primary"
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
          <div className="flex gap-2">
            <div className="h-2 w-2 rounded-full bg-primary/30"></div>
            <div className="h-2 w-2 rounded-full bg-primary"></div>
            <div className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          </div>
        </div>

        {/* Title Area */}
        <div className="flex flex-col gap-1 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold text-[#0d101b] dark:text-white leading-tight">
                페이지 선택
              </h1>
              <p className="text-sm text-[#4c599a] dark:text-slate-400 font-medium">
                {pages.length}개 페이지 수집 완료
                <br />
                리포트에 포함할 페이지를 선택하세요
              </p>
            </div>
            {/* 사용 방법 버튼 */}
            <button
              ref={usageGuideButtonRef}
              onClick={() => setShowUsageGuide(!showUsageGuide)}
              className="ml-4 flex-shrink-0 px-3 py-1.5 text-xs font-medium text-[#4c599a] dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
              aria-label="사용 방법"
            >
              💡 사용 방법
            </button>
          </div>
        </div>

        {/* 사용 방법 팝업 */}
        {showUsageGuide && (
          <div
            ref={usageGuideRef}
            className="absolute top-full right-0 mt-2 z-50 w-72 max-w-[calc(100vw-3rem)] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4"
          >
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-[#0d101b] dark:text-white mb-2">
                사용 방법
              </h4>
              <ul className="text-xs text-[#4c599a] dark:text-slate-400 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span>
                    <strong>기본 설정:</strong> 모든 페이지가 선택되어 있습니다
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span>
                    <strong>제외하려면:</strong> 불필요한 페이지의 체크박스를
                    클릭해서 해제하세요
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span>
                    <strong>법적 증거/완전 보존:</strong> 그대로 두고 PDF 생성
                    버튼을 누르세요
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span>
                    <strong>맞춤형:</strong> 개인정보처리방침, 이용약관 등은
                    제외해도 좋습니다
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </header>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto px-4 pb-32 no-scrollbar">
        {/* 전체 선택 컨트롤 (Sticky) */}
        <div className="sticky top-0 z-10 pt-2 pb-4 bg-white dark:bg-slate-800">
          <label className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer active:scale-[0.99] transition-transform">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedUrls.size === pages.length}
                onChange={toggleAll}
                className="custom-checkbox h-6 w-6 appearance-none rounded border-2 border-[#cfd3e7] dark:border-slate-600 bg-transparent text-primary checked:bg-primary checked:border-primary focus:ring-0 focus:ring-offset-0 transition-all"
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
              <span className="font-bold text-[#0d101b] dark:text-white text-base">
                전체 페이지 선택
              </span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#4c599a] dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
              {pages.length} Total
            </span>
          </label>
        </div>

        {/* 페이지 리스트 */}
        <div className="flex flex-col gap-3">
          {pages.map((page, idx) => {
            const isSelected = selectedUrls.has(page.url);
            return (
              <label
                key={page.url}
                className={`group relative flex items-start gap-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer transition-all hover:border-primary/40 ${
                  !isSelected ? "opacity-70 hover:opacity-100" : ""
                }`}
              >
                <div className="pt-1 shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePage(page.url)}
                    className="custom-checkbox h-6 w-6 appearance-none rounded border-2 border-[#cfd3e7] dark:border-slate-600 bg-transparent text-primary checked:bg-primary checked:border-primary focus:ring-0 focus:ring-offset-0 transition-all"
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
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-[#0d101b] dark:text-white truncate text-base">
                      {page.title || "제목 없음"}
                    </h3>
                  </div>
                  <p className="text-xs text-primary font-medium truncate bg-primary/5 dark:bg-primary/20 w-fit px-1.5 py-0.5 rounded">
                    {page.url}
                  </p>
                  <p className="text-sm text-[#4c599a] dark:text-slate-400 leading-snug line-clamp-2 mt-1">
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
                onComplete(pdfResult);
              }}
              fileName={fileName}
              fileSize={fileSize}
            />
          );
        })()}

      {/* 하단 고정 영역 (팝업창 하단에 붙임) */}
      <div className="absolute bottom-0 left-0 w-full z-30">
        {/* Gradient fade */}
        <div className="h-8 w-full bg-gradient-to-b from-transparent to-white dark:to-slate-800"></div>
        <div className="bg-white dark:bg-slate-800 px-6 pb-8 pt-2">
          {/* 에러 표시 */}
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-red-600 dark:text-red-400 text-xl">
                  ❌
                </span>
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 dark:text-red-200">
                    PDF 생성 실패
                  </h4>
                  <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                    {error}
                  </p>
                  <p className="text-gray-600 dark:text-slate-400 text-xs mt-2">
                    💡 크롤링한 데이터는 보존되어 있습니다. 아래 버튼을 눌러 PDF
                    생성을 다시 시도하세요.
                  </p>
                </div>
              </div>
              <button
                onClick={handleGeneratePDF}
                disabled={generating}
                className="mt-4 w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                🔄 PDF 생성 재시도 (크롤링 없이)
              </button>
            </div>
          )}

          {/* PDF 생성 버튼 */}
          {!generating && (
            <button
              onClick={handleGeneratePDF}
              disabled={selectedUrls.size === 0}
              className="w-full bg-primary hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold text-lg py-4 rounded-xl shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-between px-6 group"
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-6 h-6"
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
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold bg-white/20 px-2 py-0.5 rounded text-white">
                  {selectedUrls.size} selected
                </span>
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
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

          <div className="text-center mt-3">
            <p className="text-xs text-[#4c599a] dark:text-slate-500 font-medium">
              예상 생성 시간: ~30초
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
