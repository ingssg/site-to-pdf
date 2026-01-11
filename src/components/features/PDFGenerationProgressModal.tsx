"use client";

import { useState, useEffect, useRef } from "react";
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
  const startTimeRef = useRef<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number>(30);

  // 모달이 열릴 때 시작 시간 기록
  useEffect(() => {
    if (isOpen && !startTimeRef.current) {
      startTimeRef.current = Date.now();
    }
    if (!isOpen) {
      startTimeRef.current = null;
      setEstimatedTime(30);
    }
  }, [isOpen]);

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

  // 실제 경과 시간 기반 예상 남은 시간 계산
  useEffect(() => {
    if (!isOpen || !startTimeRef.current || !progress) return;

    const currentPercentage = progress.percentage;
    if (currentPercentage <= 0) {
      setEstimatedTime(30);
      return;
    }

    // 실제 경과 시간 계산
    const elapsedTime = (Date.now() - startTimeRef.current) / 1000; // 초 단위
    
    // 진행률 기반 선형 보간으로 전체 예상 시간 계산
    // elapsedTime / currentPercentage = totalTime / 100
    // totalTime = (elapsedTime / currentPercentage) * 100
    const estimatedTotalTime = (elapsedTime / currentPercentage) * 100;
    
    // 남은 시간 = 전체 예상 시간 - 경과 시간
    const remainingTime = estimatedTotalTime - elapsedTime;
    
    // 최소 3초, 최대 120초로 제한 (너무 작거나 큰 값 방지)
    const clampedTime = Math.max(3, Math.min(120, Math.ceil(remainingTime)));
    
    setEstimatedTime(clampedTime);
  }, [isOpen, progress?.percentage]);

  return (
    <Modal isOpen={isOpen} onClose={onClose || (() => {})} showCloseButton={false}>
      <div className="w-full px-4 sm:px-6 pt-2 pb-4 sm:pb-6 md:pb-8 flex flex-col items-center relative">
        {/* Step Indicator */}
        <p className="text-primary text-xs sm:text-sm font-bold tracking-wide leading-normal text-center uppercase mb-1">
          Step 3 of 3
        </p>

        {/* Hero Image / Visual Interest */}
        <div className="flex justify-center my-4 sm:my-5 md:my-6">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full bg-[#f6f6f8] dark:bg-[#1a1d2d] flex items-center justify-center shadow-inner">
            <div className="absolute inset-0 rounded-full border-2 sm:border-3 md:border-4 border-primary/10 border-t-primary animate-spin" style={{ animationDuration: "3s" }}></div>
            <span 
              className="material-symbols-outlined text-3xl sm:text-4xl md:text-5xl text-primary"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48" }}
            >
              description
            </span>
            {/* Floating Badge */}
            <div className="absolute -bottom-0.5 sm:-bottom-1 -right-0.5 sm:-right-1 bg-white dark:bg-[#101322] p-1 sm:p-1.5 rounded-full shadow-lg">
              <div className="bg-primary text-white rounded-full p-1 sm:p-1.5 flex items-center justify-center">
                <span className="material-symbols-outlined text-sm sm:text-base md:text-lg">auto_awesome</span>
              </div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-slate-900 dark:text-white text-lg sm:text-xl md:text-[24px] font-bold leading-tight text-center mb-1.5 sm:mb-2">
          PDF 생성 중
        </h2>

        {/* Sub-headline */}
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm md:text-base font-medium leading-relaxed text-center mb-4 sm:mb-6 md:mb-8 px-2">
          요청을 처리하는 동안 이 화면을 열어두세요.
        </p>

        {/* Progress Section Container */}
        <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 w-full">
          {/* Task 1: PDF Generation */}
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                <span className="material-symbols-outlined text-slate-400 text-[16px] sm:text-[18px] md:text-[20px]">picture_as_pdf</span>
                PDF 컴파일
              </div>
              <span className="text-primary font-bold tabular-nums text-xs sm:text-sm">
                {pdfProgress}%
              </span>
            </div>
            <div className="h-1.5 sm:h-2 w-full bg-[#f6f6f8] dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(19,55,236,0.5)] transition-all duration-300"
                style={{ width: `${pdfProgress}%` }}
              ></div>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium pl-5 sm:pl-7">
              벡터 에셋 렌더링 중...
            </p>
          </div>

          {/* Task 2: AI Summarization */}
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                <span className={`material-symbols-outlined text-primary text-[16px] sm:text-[18px] md:text-[20px] ${isAIGenerating ? "animate-pulse" : ""}`}>
                  auto_awesome
                </span>
                AI 요약
              </div>
              {isAIGenerating ? (
                <div className="h-3 w-3 sm:h-4 sm:w-4 border-2 border-slate-200 dark:border-slate-600 border-t-primary rounded-full animate-spin"></div>
              ) : (
                <span className="text-primary font-bold tabular-nums text-xs sm:text-sm">
                  {aiProgress}%
                </span>
              )}
            </div>
            {/* Indeterminate Progress Bar with Shimmer */}
            <div className="h-1.5 sm:h-2 w-full bg-[#f6f6f8] dark:bg-gray-700 rounded-full overflow-hidden relative">
              {isAIGenerating ? (
                <div 
                  className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-90 drop-shadow-[0_0_6px_rgba(19,55,236,0.5)]"
                  style={{
                    animation: 'shimmer 1.5s linear infinite'
                  }}
                ></div>
              ) : (
                <div
                  className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(19,55,236,0.5)] transition-all duration-300"
                  style={{ width: `${aiProgress}%` }}
                ></div>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium pl-5 sm:pl-7 flex items-center gap-1">
              핵심 인사이트 추출 중
              {isAIGenerating && <span className="animate-pulse">...</span>}
            </p>
          </div>
        </div>

        {/* Spacer */}
        <div className="h-4 sm:h-6 md:h-8"></div>

        {/* Footer Status */}
        <div className="bg-[#f6f6f8] dark:bg-[#1a1d2d] rounded-lg sm:rounded-xl p-2 sm:p-3 flex items-center justify-center gap-1.5 sm:gap-2 w-full">
          <span className="material-symbols-outlined text-slate-400 text-xs sm:text-sm">timer</span>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-semibold">
            예상 남은 시간:{" "}
            <span className="text-slate-800 dark:text-slate-200">~{estimatedTime}초</span>
          </p>
        </div>
      </div>
    </Modal>
  );
}

