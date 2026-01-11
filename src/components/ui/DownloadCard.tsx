"use client";

import { ReactNode } from "react";

interface DownloadCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  iconBgColor?: string;
  iconBorderColor?: string;
  onClick: () => void;
  onButtonClick?: (e: React.MouseEvent) => void;
}

export default function DownloadCard({
  title,
  description,
  icon,
  iconBgColor = "bg-red-50 dark:bg-red-900/20",
  iconBorderColor = "border-red-100 dark:border-red-900/30",
  onClick,
  onButtonClick,
}: DownloadCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#1a1d2d] p-4 rounded-xl shadow-sm border border-[#cfd3e7] dark:border-white/10 flex items-center justify-between group cursor-pointer hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-lg ${iconBgColor} flex items-center justify-center shrink-0 border ${iconBorderColor}`}
        >
          {icon}
        </div>
        <div className="flex flex-col">
          <p className="font-bold text-base text-[#0d101b] dark:text-[#f8f9fc]">
            {title}
          </p>
          <p className="text-xs text-[#4c599a] dark:text-[#94a3b8] mt-0.5 font-medium">
            {description}
          </p>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onButtonClick?.(e);
          onClick();
        }}
        className="w-9 h-9 rounded-full bg-[#f8f9fc] dark:bg-[#101322] border border-[#cfd3e7] dark:border-white/10 text-[#0d101b] dark:text-white hover:bg-primary hover:text-white hover:border-primary flex items-center justify-center transition-all"
        aria-label={`${title} 다운로드`}
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
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </button>
    </div>
  );
}
