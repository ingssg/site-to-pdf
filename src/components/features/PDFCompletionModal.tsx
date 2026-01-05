"use client";

import Modal from "@/components/ui/modal";

interface PDFCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewResults: () => void;
  fileName?: string;
  fileSize?: string;
}

export default function PDFCompletionModal({
  isOpen,
  onClose,
  onViewResults,
  fileName = "website.pdf",
  fileSize = "2.4 MB",
}: PDFCompletionModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={true}>
      <div className="w-full p-6 sm:p-8 flex flex-col items-center text-center">
        {/* Success Icon with Pulse Effect */}
        <div className="relative mb-6 mt-2 flex items-center justify-center">
          <div className="absolute animate-ping rounded-full bg-primary/20 h-20 w-20"></div>
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Text Content */}
        <h3 className="text-2xl font-bold leading-tight text-slate-900 dark:text-white mb-2">
          분석 완료!
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-[260px]">
          비즈니스 인텔리전스 리포트와 AI 분석이 준비되었습니다.
        </p>

        {/* Document Preview Card */}
        <div className="w-full mb-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <div className="h-12 w-10 shrink-0 rounded bg-primary/10 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-primary"
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
          </div>
          <div className="flex flex-col items-start overflow-hidden flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate w-full text-left">
              {fileName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-left">
              {fileSize} • 방금 전
            </p>
          </div>
          <div className="ml-auto shrink-0">
            <svg
              className="w-5 h-5 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col w-full">
          <button
            onClick={onViewResults}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
            type="button"
          >
            결과 보기
          </button>
        </div>
      </div>
    </Modal>
  );
}

