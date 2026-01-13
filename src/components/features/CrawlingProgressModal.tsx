"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";
import GuideModal from "@/components/ui/GuideModal";

interface CrawlingProgressModalProps {
  isOpen: boolean;
  progress: {
    current: number;
    total: number;
    url: string;
    percentage: number;
  } | null;
  onClose?: () => void;
}

export default function CrawlingProgressModal({
  isOpen,
  progress,
  onClose,
}: CrawlingProgressModalProps) {
  const [showGuide, setShowGuide] = useState(false);
  const percentage = progress?.percentage || 0;

  // URL에서 경로만 추출
  const getUrlPath = (url: string | undefined): string => {
    if (!url) return "크롤링 준비 중...";
    try {
      // 이미 경로만 있는 경우 (예: "/products")
      if (url.startsWith("/")) {
        return url;
      }
      // 전체 URL인 경우 경로만 추출
      const urlObj = new URL(url);
      return urlObj.pathname || "/";
    } catch {
      // URL 파싱 실패 시 원본 반환 (이미 경로일 수 있음)
      return url;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose || (() => {})}>
      <div className="w-full p-4 sm:p-6 md:p-8 flex flex-col items-center relative">
        {/* Guide Button - Top Right */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
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

        {/* Step Indicator */}
        <div className="flex flex-col items-center w-full mb-4 sm:mb-6 md:mb-8">
          <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-2 sm:mb-3">
            Step 1 of 3
          </span>
          <div className="flex flex-row items-center justify-center gap-1.5 sm:gap-2">
            <div className="h-1 sm:h-1.5 w-6 sm:w-8 rounded-full bg-primary transition-all duration-300"></div>
            <div className="h-1 sm:h-1.5 w-1.5 sm:w-2 rounded-full bg-slate-200 dark:bg-slate-600"></div>
            <div className="h-1 sm:h-1.5 w-1.5 sm:w-2 rounded-full bg-slate-200 dark:bg-slate-600"></div>
          </div>
        </div>

        {/* Circular Progress Ring */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 mb-4 sm:mb-6 md:mb-8 flex items-center justify-center">
          <svg
            className="w-full h-full transform -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              className="text-slate-100 dark:text-slate-700"
              cx="50"
              cy="50"
              fill="none"
              r="45"
              stroke="currentColor"
              strokeWidth="6"
            ></circle>
            <circle
              className="text-primary transition-all duration-1000 ease-out"
              cx="50"
              cy="50"
              fill="none"
              r="45"
              stroke="currentColor"
              strokeDasharray="283"
              strokeDashoffset={283 - (283 * percentage) / 100}
              strokeLinecap="round"
              strokeWidth="6"
            ></circle>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              {percentage}%
            </span>
          </div>
          <div className="absolute inset-0 rounded-full border-2 sm:border-4 border-primary/20 animate-ping opacity-20"></div>
        </div>

        {/* Text Content */}
        <div className="flex flex-col items-center text-center w-full mb-4 sm:mb-6 space-y-1.5 sm:space-y-2">
          <h2 className="text-slate-900 dark:text-white text-base sm:text-lg md:text-xl font-bold leading-tight">
            웹사이트 크롤링 중...
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-normal leading-relaxed max-w-[260px] px-2">
            웹사이트 페이지를 수집하고 있습니다.
          </p>
        </div>

        {/* Active Process Chip */}
        <div className="w-full mb-4 sm:mb-6 px-2 sm:px-4">
          <div className="flex items-center justify-center w-full">
            <div className="flex h-9 sm:h-10 md:h-11 w-full items-center justify-center gap-x-2 sm:gap-x-2.5 rounded-full bg-slate-100 dark:bg-slate-700/50 pl-3 sm:pl-4 pr-4 sm:pr-5 py-1.5 sm:py-2 border border-slate-200 dark:border-slate-600/50">
              <span className="material-symbols-outlined text-primary text-[16px] sm:text-[18px] animate-spin flex-shrink-0">
                sync
              </span>
              <p className="text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium leading-normal truncate">
                {getUrlPath(progress?.url)}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Warning */}
        <div className="mt-1 sm:mt-2 text-center">
          <p className="text-slate-400 dark:text-slate-500 text-[10px] sm:text-xs font-medium">
            앱을 닫지 마세요
          </p>
        </div>
      </div>

      {/* Guide Modal */}
      <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </Modal>
  );
}
