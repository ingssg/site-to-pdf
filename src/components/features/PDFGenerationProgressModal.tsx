"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";

interface PDFGenerationProgressModalProps {
  isOpen: boolean;
  progress: {
    message: string;
    percentage: number;
  } | null;
  status?: string | null;
  onClose?: () => void;
}

export default function PDFGenerationProgressModal({
  isOpen,
  progress,
  status,
  onClose,
}: PDFGenerationProgressModalProps) {
  const [pdfProgressValue, setPdfProgressValue] = useState<number>(0);
  const [aiProgressValue, setAiProgressValue] = useState<number>(0);

  // 모달이 열릴 때 시작 시간 기록
  useEffect(() => {
    if (!isOpen) {
      setPdfProgressValue(0);
      setAiProgressValue(0);
    }
  }, [isOpen]);

  const aiDone = status === "generating_pdf" || status === "completed";

  useEffect(() => {
    if (!isOpen || !progress) return;

    const message = progress.message || "";
    const percentage = Number.isFinite(progress.percentage)
      ? progress.percentage
      : 0;

    if (message.includes("PDF")) {
      setPdfProgressValue((prev) => Math.max(prev, percentage));
      return;
    }

    if (message.includes("요약") || message.includes("AI")) {
      setAiProgressValue((prev) => Math.max(prev, percentage));
      return;
    }

    // 분류되지 않은 메시지는 PDF 진행률로 취급
    setPdfProgressValue((prev) => Math.max(prev, percentage));
  }, [isOpen, progress?.message, progress?.percentage]);

  useEffect(() => {
    if (!isOpen) return;
    if (aiDone) {
      setAiProgressValue((prev) => Math.max(prev, 100));
    }
  }, [aiDone, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (status === "generating_pdf") {
      setPdfProgressValue((prev) => Math.max(prev, 30));
    }
  }, [isOpen, status]);

  const isAiMessage =
    !!progress?.message &&
    (progress.message.includes("요약") || progress.message.includes("AI"));
  const isPdfMessage =
    !!progress?.message &&
    (progress.message.includes("PDF") || progress.message.includes("ZIP"));

  const aiMessage = aiDone
    ? "AI 요약 완료!"
    : isAiMessage
    ? progress?.message
    : "AI 요약 준비 중...";

  const pdfMessage = isPdfMessage ? progress?.message : "PDF 생성 중";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose || (() => {})}
      showCloseButton={false}
    >
      <div className="w-full px-4 sm:px-6 pt-2 pb-4 sm:pb-6 md:pb-8 flex flex-col items-center relative">
        {/* Step Indicator */}
        <p className="text-primary text-xs sm:text-sm font-bold tracking-wide leading-normal text-center uppercase mb-1">
          Step 3 of 3
        </p>

        {/* Hero Image / Visual Interest */}
        <div className="flex justify-center my-4 sm:my-5 md:my-6">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full bg-[#f6f6f8] dark:bg-[#1a1d2d] flex items-center justify-center shadow-inner">
            <div
              className="absolute inset-0 rounded-full border-2 sm:border-3 md:border-4 border-primary/10 border-t-primary animate-spin"
              style={{ animationDuration: "3s" }}
            ></div>
            <span
              className="material-symbols-outlined text-3xl sm:text-4xl md:text-5xl text-primary"
              style={{
                fontVariationSettings:
                  "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48",
              }}
            >
              description
            </span>
            {/* Floating Badge */}
            <div className="absolute -bottom-0.5 sm:-bottom-1 -right-0.5 sm:-right-1 bg-white dark:bg-[#101322] p-1 sm:p-1.5 rounded-full shadow-lg">
              <div className="bg-primary text-white rounded-full p-1 sm:p-1.5 flex items-center justify-center">
                <span className="material-symbols-outlined text-sm sm:text-base md:text-lg">
                  auto_awesome
                </span>
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
                <span className="material-symbols-outlined text-slate-400 text-[16px] sm:text-[18px] md:text-[20px]">
                  picture_as_pdf
                </span>
                PDF 컴파일
              </div>
              <span className="text-primary font-bold tabular-nums text-xs sm:text-sm">
                {pdfProgressValue}%
              </span>
            </div>
            <div className="h-1.5 sm:h-2 w-full bg-[#f6f6f8] dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(19,55,236,0.5)] transition-all duration-300"
                style={{ width: `${pdfProgressValue}%` }}
              ></div>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium pl-5 sm:pl-7">
              {pdfMessage}
            </p>
          </div>

          {/* Task 2: AI Summarization */}
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                <span className="material-symbols-outlined text-primary text-[16px] sm:text-[18px] md:text-[20px]">
                  auto_awesome
                </span>
                AI 요약
              </div>
              <span className="text-primary font-bold tabular-nums text-xs sm:text-sm">
                {aiProgressValue}%
              </span>
            </div>
            <div className="h-1.5 sm:h-2 w-full bg-[#f6f6f8] dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(19,55,236,0.5)] transition-all duration-300"
                style={{ width: `${aiProgressValue}%` }}
              ></div>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium pl-5 sm:pl-7 flex items-center gap-1">
              {aiMessage}
            </p>
          </div>
        </div>

        {/* Spacer */}
        <div className="h-4 sm:h-6 md:h-8"></div>
      </div>
    </Modal>
  );
}
