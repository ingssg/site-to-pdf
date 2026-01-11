"use client";

import { ReactNode } from "react";

interface SummaryCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function SummaryCard({
  title,
  icon,
  children,
  defaultOpen = true,
}: SummaryCardProps) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl bg-white dark:bg-[#1a1d2d] border border-[#cfd3e7] dark:border-white/10 overflow-hidden shadow-sm"
    >
      <summary className="flex cursor-pointer items-center justify-between p-4 list-none [&::-webkit-details-marker]:hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-[#e7e9f3] dark:bg-white/10 text-[#0d101b] dark:text-white">
            {icon}
          </div>
          <p className="text-base font-bold text-[#0d101b] dark:text-[#f8f9fc]">
            {title}
          </p>
        </div>
        <svg
          className="w-6 h-6 text-[#0d101b] dark:text-white transition-transform duration-300 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>
      <div className="px-5 pb-5 pt-1">{children}</div>
    </details>
  );
}
