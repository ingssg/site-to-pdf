"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import CrawlerForm from "@/components/features/CrawlerForm";
import ResultDisplay from "@/components/features/ResultDisplay";

const ThemeToggle = dynamic(() => import("@/components/ui/ThemeToggle"), {
  ssr: false,
});

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [resultData, setResultData] = useState<{
    crawlResult: any;
    pdfResult: any;
  } | null>(null);

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0f172a] antialiased">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full backdrop-blur-xl bg-white/70 dark:bg-[#0f172a]/80 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center h-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary text-white p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span className="text-slate-900 dark:text-white text-lg font-bold tracking-tight">
              SiteToPDF
            </span>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <a
                className="hover:text-primary dark:hover:text-blue-400 transition-colors"
                href="#features"
              >
                기능
              </a>
              <a
                className="hover:text-primary dark:hover:text-blue-400 transition-colors"
                href="#pricing"
              >
                가격
              </a>
              <a
                className="hover:text-primary dark:hover:text-blue-400 transition-colors"
                href="#enterprise"
              >
                기업용
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <a
                className="hidden sm:block text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors text-sm font-bold"
                href="#"
              >
                로그인
              </a>
              <a
                className="hidden sm:inline-flex items-center justify-center h-9 px-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition-opacity"
                href="#"
              >
                시작하기
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full pt-16">
        <section className="relative pt-12 pb-16 md:pt-20 lg:pt-32 lg:pb-32 overflow-hidden">
          {/* Background Decoration */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
            <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-blue-200/20 dark:bg-blue-900/10 rounded-full blur-[100px]"></div>
            <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-[100px]"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Column - Text Content */}
              <div className="flex flex-col text-center lg:text-left">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-fit mx-auto lg:mx-0 shadow-sm mb-8">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wide">
                    신규: AI 경영진 요약
                  </span>
                </div>

                {/* Heading */}
                <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.1] font-extrabold text-slate-900 dark:text-white tracking-tight mb-6">
                  어떤 웹사이트든{" "}
                  <span className="text-primary dark:text-blue-400">
                    전문 PDF로
                  </span>{" "}
                  변환하세요
                </h1>

                {/* Description */}
                <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-8 max-w-2xl mx-auto lg:mx-0">
                  지저분한 스크린샷은 그만. 전체 웹페이지를 캡처하고, AI 요약을
                  생성하며, 아카이브 준비가 완료된 문서를 즉시 만들어보세요.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                  <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center justify-center h-14 px-8 rounded-xl bg-primary hover:bg-primary-dark transition-all shadow-xl shadow-blue-500/20 text-white text-base font-bold tracking-wide group"
                  >
                    <span>첫 URL 변환하기</span>
                    <svg
                      className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </button>
                  <button className="inline-flex items-center justify-center h-14 px-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-white text-base font-bold tracking-wide">
                    샘플 PDF 보기
                  </button>
                </div>

                {/* Trust Badges */}
                <div className="flex flex-col gap-4 border-t border-slate-200 dark:border-slate-800 pt-6">
                  <div className="flex flex-wrap gap-x-6 gap-y-3 justify-center lg:justify-start">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-medium">
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
                      <span>타임스탬프 아카이빙</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-medium">
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
                      <span>AI 핵심 인사이트</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-medium">
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
                      <span>SOC-2 인증</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center lg:text-left mt-2 uppercase tracking-wider">
                    500명 이상의 분석가가 신뢰하는 서비스
                  </p>
                </div>
              </div>

              {/* Right Column - Preview Image */}
              <div className="relative lg:h-auto w-full max-w-lg mx-auto lg:max-w-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full blur-3xl -z-10"></div>
                <div className="rounded-xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden transform transition-transform hover:scale-[1.01] duration-500">
                  {/* Browser Mockup */}
                  <div className="flex items-center px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200/60 dark:border-slate-700">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="flex items-center justify-center w-full h-7 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-300 font-mono overflow-hidden whitespace-nowrap px-2">
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        sitetopdf.com/dashboard/preview/techcrunch-article
                      </div>
                    </div>
                  </div>
                  {/* Preview Content */}
                  <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-950 group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800"></div>
                    {/* Progress Card Overlay */}
                    <div className="absolute bottom-6 right-6 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-lg shadow-2xl ring-1 ring-black/5 dark:ring-white/10 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-900/30 text-primary">
                            <svg
                              className="w-5 h-5 animate-pulse"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.75c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white">
                              요약 생성 중
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-300">
                              텍스트 및 이미지 처리 중...
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-primary dark:text-blue-400">
                          85%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-3 overflow-hidden">
                        <div className="bg-primary h-1.5 rounded-full w-[85%] shadow-[0_0_10px_rgba(19,55,236,0.5)]"></div>
                      </div>
                      <div className="space-y-1.5 opacity-60">
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                        <div className="h-1.5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Crawler Form - Shown in modal */}
      {showModal && !showResults && (
        <CrawlerForm
          onClose={() => setShowModal(false)}
          onComplete={(data) => {
            setShowModal(false);
            setResultData(data);
            setShowResults(true);
          }}
        />
      )}

      {/* Results Display */}
      {showResults && resultData && (
        <ResultDisplay
          crawlResult={resultData.crawlResult}
          pdfResult={resultData.pdfResult}
        />
      )}
    </div>
  );
}
