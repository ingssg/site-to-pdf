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

  return (
    <Modal isOpen={isOpen} onClose={onClose || (() => {})}>
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
          Crawling Website...
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-relaxed max-w-[260px]">
          We are mapping out pages for you to select. This usually takes less than a minute.
        </p>
      </div>

      {/* Active Process Chip */}
      <div className="w-full mb-6">
        <div className="flex items-center justify-center w-full">
          <div className="flex h-9 max-w-full items-center justify-center gap-x-2.5 rounded-full bg-slate-100 dark:bg-slate-700/50 pl-3 pr-4 py-1 border border-slate-200 dark:border-slate-600/50">
            <svg
              className="text-primary text-[18px] animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-slate-700 dark:text-slate-200 text-xs font-mono font-medium leading-normal truncate">
              Processing: {progress?.url || ""}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Warning */}
      <div className="mt-2 text-center">
        <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">
          Please do not close the app
        </p>
      </div>
    </Modal>
  );
}

