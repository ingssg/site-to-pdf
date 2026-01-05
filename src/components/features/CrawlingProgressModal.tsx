"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";

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
  const percentage = progress?.percentage || 0;
  
  // URL에서 경로만 추출
  const getUrlPath = (url: string | undefined): string => {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      return urlObj.pathname || "/";
    } catch {
      // URL 파싱 실패 시 원본 반환
      return url;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose || (() => {})}>
      <div className="w-full p-6 sm:p-8 flex flex-col items-center relative">
        {/* Step Indicator */}
        <div className="flex flex-col items-center w-full mb-8">
        <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-3">
          Step 1 of 3
        </span>
        <div className="flex flex-row items-center justify-center gap-2">
          <div className="h-1.5 w-8 rounded-full bg-primary transition-all duration-300"></div>
          <div className="h-1.5 w-2 rounded-full bg-slate-200 dark:bg-slate-600"></div>
          <div className="h-1.5 w-2 rounded-full bg-slate-200 dark:bg-slate-600"></div>
        </div>
      </div>

      {/* Circular Progress Ring */}
      <div className="relative w-40 h-40 mb-8 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
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
          <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            {percentage}%
          </span>
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping opacity-20"></div>
      </div>

      {/* Text Content */}
      <div className="flex flex-col items-center text-center w-full mb-6 space-y-2">
        <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight">
          웹사이트 크롤링 중...
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-relaxed max-w-[260px]">
          선택할 페이지를 매핑하고 있습니다. 보통 1분 이내에 완료됩니다.
        </p>
      </div>

      {/* Active Process Chip */}
      <div className="w-full mb-6 px-4">
        <div className="flex items-center justify-center w-full">
          <div className="flex h-11 w-full items-center justify-center gap-x-2.5 rounded-full bg-slate-100 dark:bg-slate-700/50 pl-4 pr-5 py-2 border border-slate-200 dark:border-slate-600/50">
            <span className="material-symbols-outlined text-primary text-[18px] animate-spin">sync</span>
            <p className="text-slate-700 dark:text-slate-200 text-sm font-medium leading-normal">
              Processing: {getUrlPath(progress?.url)}
            </p>
          </div>
        </div>
      </div>

        {/* Footer Warning */}
        <div className="mt-2 text-center">
          <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">
            앱을 닫지 마세요
          </p>
        </div>
      </div>
    </Modal>
  );
}

