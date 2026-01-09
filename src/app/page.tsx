"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import CrawlerForm from "@/components/features/CrawlerForm";
import ResultDisplay from "@/components/features/ResultDisplay";
import PreviewImage from "@/components/ui/PreviewImage";

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
        <div className="flex items-center h-14 sm:h-16 px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-2.5 hover:opacity-80 transition-opacity"
          >
            <img
              src="/logo.png"
              alt="SiteToPDF"
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
            />
            <span className="text-slate-900 dark:text-white text-base sm:text-lg font-bold tracking-tight">
              SiteToPDF
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
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
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <a
                className="hidden sm:block text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors text-xs sm:text-sm font-bold"
                href="#"
              >
                로그인
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full pt-14 sm:pt-16">
        <section className="relative pt-6 sm:pt-8 md:pt-12 pb-8 sm:pb-12 md:pb-16 lg:pt-20 lg:pb-32 overflow-hidden">
          {/* Background Decoration */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
            <div className="absolute top-[10%] left-[10%] w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] md:w-[500px] md:h-[500px] bg-blue-200/20 dark:bg-blue-900/10 rounded-full blur-[100px]"></div>
            <div className="absolute top-[20%] right-[10%] w-[150px] h-[150px] sm:w-[250px] sm:h-[250px] md:w-[400px] md:h-[400px] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-[100px]"></div>
          </div>

          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 relative z-10">
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-12 lg:gap-16 items-start">
              {/* Left Column - Text Content */}
              <div className="flex flex-col text-center lg:text-left">
                {/* Badge */}
                <div className="inline-flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 md:py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-fit mx-auto lg:mx-0 shadow-sm mb-4 sm:mb-6 md:mb-8">
                  <span className="flex h-1.5 w-1.5 sm:h-2 sm:w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-primary"></span>
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-wide">
                    신규: AI 비즈니스 분석
                  </span>
                </div>

                {/* Heading */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-[3.5rem] leading-[1.1] font-extrabold text-slate-900 dark:text-white tracking-tight mb-3 sm:mb-4 md:mb-6">
                  어떤 웹사이트든{" "}
                  <span className="text-primary dark:text-blue-400">
                    전문 PDF로
                  </span>{" "}
                  변환하세요
                </h1>

                {/* Description */}
                <p className="text-sm sm:text-base md:text-lg lg:text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-4 sm:mb-6 md:mb-8 max-w-2xl mx-auto lg:mx-0 px-2 sm:px-0">
                  지저분한 스크린샷은 그만. 전체 웹페이지를 캡처하고, AI 요약을
                  생성하며, 아카이브 준비가 완료된 문서를 즉시 만들어보세요.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 md:gap-4 justify-center lg:justify-start mb-4 sm:mb-6 md:mb-8">
                  <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center justify-center h-11 sm:h-12 md:h-14 px-5 sm:px-6 md:px-8 rounded-xl bg-primary hover:bg-primary-dark transition-all shadow-xl shadow-blue-500/20 text-white text-xs sm:text-sm md:text-base font-bold tracking-wide group"
                  >
                    <span>첫 URL 변환하기</span>
                    <svg
                      className="ml-1.5 sm:ml-2 w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform"
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
                  <button className="inline-flex items-center justify-center h-11 sm:h-12 md:h-14 px-5 sm:px-6 md:px-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-white text-xs sm:text-sm md:text-base font-bold tracking-wide">
                    샘플 PDF 보기
                  </button>
                </div>

                {/* Trust Badges - 모바일에서는 아래로, 데스크톱에서는 여기 */}
                <div className="hidden lg:flex flex-col gap-2 sm:gap-3 md:gap-4 border-t border-slate-200 dark:border-slate-800 pt-3 sm:pt-4 md:pt-6">
                  <div className="flex flex-wrap gap-x-3 sm:gap-x-4 md:gap-x-6 gap-y-1.5 sm:gap-y-2 md:gap-y-3 justify-center lg:justify-start">
                    <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs md:text-sm font-medium">
                      <svg
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>무료 체험</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs md:text-sm font-medium">
                      <svg
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>2-3분 소요</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs md:text-sm font-medium">
                      <svg
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>데이터 저장 안함</span>
                    </div>
                  </div>
                  <p className="text-[9px] sm:text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium text-center lg:text-left mt-1 sm:mt-2 uppercase tracking-wider px-2 sm:px-0">
                    VC 투자심사 · B2B 영업 · 컨설팅 · 법무팀 전문
                  </p>
                </div>
              </div>

              {/* Right Column - Preview Image */}
              <PreviewImage />

              {/* Trust Badges - 모바일 전용 (예시 이미지 아래) */}
              <div className="flex lg:hidden flex-col gap-2 sm:gap-3 md:gap-4 border-t border-slate-200 dark:border-slate-800 pt-3 sm:pt-4 md:pt-6 order-3 col-span-1">
                <div className="flex flex-wrap gap-x-3 sm:gap-x-4 md:gap-x-6 gap-y-1.5 sm:gap-y-2 md:gap-y-3 justify-center">
                  <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs md:text-sm font-medium">
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>무료 체험</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs md:text-sm font-medium">
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>2-3분 소요</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs md:text-sm font-medium">
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>데이터 저장 안함</span>
                  </div>
                </div>
                <p className="text-[9px] sm:text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium text-center mt-1 sm:mt-2 uppercase tracking-wider px-2">
                  VC 투자심사 · B2B 영업 · 컨설팅 · 법무팀 전문
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="py-16 sm:py-20 md:py-24 lg:py-32 bg-white dark:bg-slate-900"
        >
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-4">
                강력한 기능
              </h2>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                비즈니스 분석부터 법적 증거 보존까지, 필요한 모든 기능을 제공합니다
              </p>
            </div>

            {/* Core Features Grid (3 cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-16 sm:mb-20">
              {/* Feature 1: AI 비즈니스 분석 */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 sm:p-8 hover:border-primary dark:hover:border-blue-400 transition-all">
                <span className="material-symbols-outlined text-5xl text-primary mb-4 block">
                  auto_awesome
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  AI 비즈니스 분석
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Claude AI가 웹사이트를 분석하여 비즈니스 모델, 강점, 성장 가능성을 자동으로 요약합니다.
                </p>
              </div>

              {/* Feature 2: 전체 사이트 PDF 변환 */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 sm:p-8 hover:border-primary dark:hover:border-blue-400 transition-all">
                <span className="material-symbols-outlined text-5xl text-primary mb-4 block">
                  description
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  전체 사이트 PDF 변환
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  최대 50페이지까지 자동 크롤링하여 전문적인 PDF 리포트를 생성합니다.
                </p>
              </div>

              {/* Feature 3: 스마트 필터링 */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 sm:p-8 hover:border-primary dark:hover:border-blue-400 transition-all">
                <span className="material-symbols-outlined text-5xl text-primary mb-4 block">
                  filter_list
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  스마트 필터링
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  AI가 중요한 페이지만 선별하여 불필요한 약관, SNS 링크 등을 자동 제외합니다.
                </p>
              </div>
            </div>

            {/* Use Cases Section */}
            <div className="text-center mb-8 sm:mb-12">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
                누가 사용하나요?
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                다양한 산업 전문가들이 SiteToPDF를 활용합니다
              </p>
            </div>

            {/* Use Cases Grid (4 cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Use Case 1: VC 투자심사 */}
              <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-all">
                <div className="text-4xl mb-3">🎯</div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  VC 투자심사
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  투자 검토 시 포트폴리오 기업 웹사이트를 빠르게 분석하고 리포트 생성
                </p>
              </div>

              {/* Use Case 2: B2B 영업팀 */}
              <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-all">
                <div className="text-4xl mb-3">📊</div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  B2B 영업팀
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  영업 미팅 전 고객사 웹사이트 분석으로 맞춤형 제안서 준비
                </p>
              </div>

              {/* Use Case 3: 컨설팅 */}
              <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-all">
                <div className="text-4xl mb-3">🔍</div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  컨설팅
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  클라이언트 비즈니스 모델 분석 및 경쟁사 조사 자료 수집
                </p>
              </div>

              {/* Use Case 4: 법무팀 */}
              <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-all">
                <div className="text-4xl mb-3">⚖️</div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  법무팀
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  법적 증거 보존을 위한 웹사이트 전체 아카이빙 (타임스탬프 포함)
                </p>
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

      {/* Results Display - Full Screen Overlay */}
      {showResults && resultData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f6f6f8] dark:bg-[#101322]">
          <ResultDisplay
            crawlResult={resultData.crawlResult}
            pdfResult={resultData.pdfResult}
          />
        </div>
      )}
    </div>
  );
}
