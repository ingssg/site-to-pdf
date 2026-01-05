"use client";

import Modal from "@/components/ui/modal";

interface PDFGenerationProgressModalProps {
  isOpen: boolean;
  progress: {
    message: string;
    percentage: number;
  } | null;
  onClose?: () => void;
}

export default function PDFGenerationProgressModal({
  isOpen,
  progress,
  onClose,
}: PDFGenerationProgressModalProps) {
  // PDF 생성과 AI 요약 진행률 분리
  const pdfProgress = progress?.message.includes("PDF") 
    ? progress.percentage 
    : progress?.message.includes("요약") || progress?.message.includes("AI")
    ? 0
    : progress?.percentage || 0;
  
  const aiProgress = progress?.message.includes("요약") || progress?.message.includes("AI")
    ? progress.percentage
    : progress?.message.includes("PDF")
    ? 100
    : 0;

  const isAIGenerating = progress?.message.includes("요약") || progress?.message.includes("AI");

  return (
    <Modal isOpen={isOpen} onClose={onClose || (() => {})} showCloseButton={false}>
      <div className="w-full p-6 sm:p-8 flex flex-col items-center relative">
        {/* Step Indicator */}
        <p className="text-primary text-sm font-bold tracking-wide leading-normal text-center uppercase mb-1">
          Step 3 of 3
        </p>

        {/* Hero Image / Visual Interest */}
        <div className="flex justify-center my-6">
          <div className="relative w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shadow-inner">
            <div className="absolute inset-0 rounded-full border-4 border-primary/10 border-t-primary animate-spin" style={{ animationDuration: "3s" }}></div>
            <svg
              className="w-12 h-12 text-primary"
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
            {/* Floating Badge */}
            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-lg">
              <div className="bg-primary text-white rounded-full p-1.5 flex items-center justify-center">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.75c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight text-center mb-2">
          PDF 생성 중
        </h2>

        {/* Sub-headline */}
        <p className="text-slate-500 dark:text-slate-400 text-base font-medium leading-relaxed text-center mb-8 px-2">
          요청을 처리하는 동안 이 화면을 열어두세요.
        </p>

        {/* Progress Section Container */}
        <div className="flex flex-col gap-6 w-full">
          {/* Task 1: PDF Generation */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                <svg
                  className="w-5 h-5 text-slate-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
                PDF 컴파일
              </div>
              <span className="text-primary font-bold tabular-nums">
                {pdfProgress}%
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(19,55,236,0.5)] transition-all duration-300"
                style={{ width: `${pdfProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium pl-7">
              {pdfProgress < 100 ? "벡터 에셋 렌더링 중..." : "완료"}
            </p>
          </div>

          {/* Task 2: AI Summarization */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                <svg
                  className={`w-5 h-5 text-primary ${isAIGenerating ? "animate-pulse" : ""}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.75c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                AI 비즈니스 분석
              </div>
              {isAIGenerating ? (
                <div className="h-4 w-4 border-2 border-slate-200 dark:border-slate-600 border-t-primary rounded-full animate-spin"></div>
              ) : (
                <span className="text-primary font-bold tabular-nums">
                  {aiProgress}%
                </span>
              )}
            </div>
            {/* Indeterminate Progress Bar */}
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
              {isAIGenerating ? (
                <div className="absolute top-0 left-0 h-full w-1/3 bg-primary/40 rounded-full animate-slide"></div>
              ) : (
                <div
                  className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(19,55,236,0.5)] transition-all duration-300"
                  style={{ width: `${aiProgress}%` }}
                ></div>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium pl-7 flex items-center gap-1">
              {isAIGenerating ? (
                <>
                  핵심 인사이트 추출 중
                  <span className="animate-pulse">...</span>
                </>
              ) : (
                aiProgress < 100 ? "대기 중..." : "완료"
              )}
            </p>
          </div>
        </div>

        {/* Spacer */}
        <div className="h-8"></div>

        {/* Footer Status */}
        <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-3 flex items-center justify-center gap-2 w-full">
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
            예상 남은 시간:{" "}
            <span className="text-slate-800 dark:text-slate-200">
              ~{Math.max(5, 30 - Math.floor((progress?.percentage || 0) / 3.33))}초
            </span>
          </p>
        </div>
      </div>

    </Modal>
  );
}

