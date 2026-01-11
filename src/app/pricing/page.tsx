"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const ThemeToggle = dynamic(() => import("@/components/ui/ThemeToggle"), {
  ssr: false,
});

interface PricingPlan {
  name: string;
  price: string;
  priceNote?: string;
  features: {
    crawling: string;
    aiSummary: string;
    other: string;
  };
  popular?: boolean;
  buttonText: string;
}

const plans: PricingPlan[] = [
  {
    name: "Free",
    price: "₩0",
    features: {
      crawling: "월 3회, 50페이지",
      aiSummary: "기본 요약",
      other: "워터마크",
    },
    buttonText: "무료로 시작하기",
  },
  {
    name: "Pro",
    price: "₩15,000",
    priceNote: "/월",
    features: {
      crawling: "월 30회, 100페이지",
      aiSummary: "상세 요약",
      other: "AI 필터링 제공",
    },
    popular: true,
    buttonText: "구독하기",
  },
  {
    name: "Business",
    price: "₩50,000",
    priceNote: "/월",
    features: {
      crawling: "무제한, 200페이지",
      aiSummary: "SWOT, 경쟁분석",
      other: "API, 팀 기능",
    },
    buttonText: "구독하기",
  },
  {
    name: "건당 구매",
    price: "₩3,000",
    priceNote: "/건",
    features: {
      crawling: "50페이지",
      aiSummary: "상세 요약",
      other: "비회원 가능",
    },
    buttonText: "구매하기",
  },
];

export default function PricingPage() {
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
              <Link
                className="hover:text-primary dark:hover:text-blue-400 transition-colors"
                href="/#features"
              >
                기능
              </Link>
              <Link
                className="hover:text-primary dark:hover:text-blue-400 transition-colors"
                href="/pricing"
              >
                가격
              </Link>
              <Link
                className="hover:text-primary dark:hover:text-blue-400 transition-colors"
                href="/#enterprise"
              >
                기업용
              </Link>
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
        <section className="py-12 sm:py-16 md:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-12 sm:mb-16 md:mb-20">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white mb-4 sm:mb-6">
                간단하고 투명한 가격
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                필요한 만큼만 사용하세요. 무료로 시작하고 필요에 따라 업그레이드하세요.
              </p>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {plans.map((plan, index) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl border-2 p-6 sm:p-8 transition-all ${
                    plan.popular
                      ? "border-primary dark:border-blue-400 bg-white dark:bg-slate-800 shadow-xl scale-105"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary dark:hover:border-blue-400"
                  }`}
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-white text-xs font-bold px-4 py-1 rounded-full">
                        인기
                      </span>
                    </div>
                  )}

                  {/* Plan Name */}
                  <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                    {plan.name}
                  </h3>

                  {/* Price */}
                  <div className="mb-6 sm:mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white">
                        {plan.price}
                      </span>
                      {plan.priceNote && (
                        <span className="text-lg sm:text-xl text-slate-600 dark:text-slate-400">
                          {plan.priceNote}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-4 mb-8 sm:mb-10">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-primary dark:text-blue-400 mt-0.5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          크롤링
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {plan.features.crawling}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-primary dark:text-blue-400 mt-0.5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          AI 요약
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {plan.features.aiSummary}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-primary dark:text-blue-400 mt-0.5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          기타
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {plan.features.other}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    className={`w-full py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-base transition-all ${
                      plan.popular
                        ? "bg-primary hover:bg-primary-dark text-white shadow-lg shadow-blue-500/20"
                        : plan.name === "Free"
                        ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600"
                        : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
                    }`}
                  >
                    {plan.buttonText}
                  </button>
                </div>
              ))}
            </div>

            {/* Additional Info */}
            <div className="mt-12 sm:mt-16 text-center">
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-4">
                모든 플랜에는 다음이 포함됩니다:
              </p>
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  무료 체험
                </span>
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  언제든지 취소 가능
                </span>
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  고객 지원
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
