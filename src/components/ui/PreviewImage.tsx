export default function PreviewImage() {
  return (
    <div className="relative lg:h-auto w-full max-w-lg mx-auto lg:max-w-none order-2 lg:order-2">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full blur-3xl -z-10"></div>
      <div className="rounded-lg sm:rounded-xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden transform transition-transform hover:scale-[1.01] duration-500">
        {/* Browser Mockup */}
        <div className="flex items-center px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200/60 dark:border-slate-700">
          <div className="flex space-x-1 sm:space-x-1.5 md:space-x-2">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full bg-red-400/80"></div>
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full bg-amber-400/80"></div>
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full bg-green-400/80"></div>
          </div>
          <div className="flex-1 mx-1.5 sm:mx-2 md:mx-4">
            <div className="flex items-center justify-center w-full h-5 sm:h-6 md:h-7 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-700 text-[8px] sm:text-[9px] md:text-[10px] text-slate-500 dark:text-slate-300 font-mono overflow-hidden whitespace-nowrap px-1 sm:px-1.5 md:px-2">
              <svg
                className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 mr-0.5 sm:mr-1"
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
        {/* Preview Content with Modal Overlay */}
        <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-950 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800"></div>

          {/* PDF Generation Progress Modal Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/40 dark:bg-gray-900/60 backdrop-blur-sm p-1.5 sm:p-2 md:p-3">
            <div className="w-full max-w-[180px] sm:max-w-[220px] md:max-w-[240px] lg:max-w-[260px] bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden">
              <div className="w-full px-2 sm:px-2.5 md:px-3 lg:px-4 pt-1 sm:pt-1.5 md:pt-2 pb-1.5 sm:pb-2 md:pb-2.5 lg:pb-3 flex flex-col items-center relative">
                {/* Step Indicator */}
                <p className="text-primary text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-bold tracking-wide leading-normal text-center uppercase mb-0.5">
                  Step 3 of 3
                </p>

                {/* Hero Image / Visual Interest */}
                <div className="flex justify-center my-1.5 sm:my-2 md:my-2.5 lg:my-3">
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 rounded-full bg-[#f6f6f8] dark:bg-[#1a1d2d] flex items-center justify-center shadow-inner">
                    <div
                      className="absolute inset-0 rounded-full border-2 border-primary/10 border-t-primary animate-spin"
                      style={{ animationDuration: "3s" }}
                    ></div>
                    <span
                      className="material-symbols-outlined text-lg sm:text-xl md:text-2xl lg:text-3xl text-primary"
                      style={{
                        fontVariationSettings:
                          "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48",
                      }}
                    >
                      description
                    </span>
                    {/* Floating Badge */}
                    <div className="absolute -bottom-0.5 -right-0.5 bg-white dark:bg-[#101322] p-0.5 sm:p-1 rounded-full shadow-lg">
                      <div className="bg-primary text-white rounded-full p-0.5 sm:p-1 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[9px] sm:text-[10px] md:text-xs lg:text-sm">
                          auto_awesome
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Headline */}
                <h2 className="text-slate-900 dark:text-white text-xs sm:text-sm md:text-base lg:text-lg font-bold leading-tight text-center mb-0.5 sm:mb-1">
                  PDF 생성 중
                </h2>

                {/* Sub-headline */}
                <p className="text-slate-500 dark:text-slate-400 text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-medium leading-relaxed text-center mb-1.5 sm:mb-2 md:mb-2.5 lg:mb-3 px-1 sm:px-1.5">
                  요청을 처리하는 동안 이 화면을 열어두세요.
                </p>

                {/* Progress Section Container */}
                <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-3 w-full">
                  {/* Task 1: PDF Generation */}
                  <div className="flex flex-col gap-0.5 sm:gap-1">
                    <div className="flex items-center justify-between text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs">
                      <div className="flex items-center gap-0.5 sm:gap-1 text-slate-800 dark:text-slate-200 font-semibold">
                        <span className="material-symbols-outlined text-slate-400 text-[11px] sm:text-[12px] md:text-[14px] lg:text-[16px]">
                          picture_as_pdf
                        </span>
                        PDF 컴파일
                      </div>
                      <span className="text-primary font-bold tabular-nums text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs">
                        85%
                      </span>
                    </div>
                    <div className="h-0.5 sm:h-1 w-full bg-[#f6f6f8] dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(19,55,236,0.5)] transition-all duration-300"
                        style={{ width: "85%" }}
                      ></div>
                    </div>
                    <p className="text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] text-slate-400 dark:text-slate-500 font-medium pl-2.5 sm:pl-3 md:pl-4">
                      벡터 에셋 렌더링 중...
                    </p>
                  </div>

                  {/* Task 2: AI Summarization */}
                  <div className="flex flex-col gap-0.5 sm:gap-1">
                    <div className="flex items-center justify-between text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs">
                      <div className="flex items-center gap-0.5 sm:gap-1 text-slate-800 dark:text-slate-200 font-semibold">
                        <span className="material-symbols-outlined text-primary text-[11px] sm:text-[12px] md:text-[14px] lg:text-[16px] animate-pulse">
                          auto_awesome
                        </span>
                        AI 요약
                      </div>
                      <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 md:h-2.5 md:w-2.5 lg:h-3 lg:w-3 border-2 border-slate-200 dark:border-slate-600 border-t-primary rounded-full animate-spin"></div>
                    </div>
                    {/* Indeterminate Progress Bar with Shimmer */}
                    <div className="h-0.5 sm:h-1 w-full bg-[#f6f6f8] dark:bg-gray-700 rounded-full overflow-hidden relative">
                      <div
                        className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-90 drop-shadow-[0_0_6px_rgba(19,55,236,0.5)]"
                        style={{
                          animation: "shimmer 1.5s linear infinite",
                        }}
                      ></div>
                    </div>
                    <p className="text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] text-slate-400 dark:text-slate-500 font-medium pl-2.5 sm:pl-3 md:pl-4 flex items-center gap-0.5">
                      핵심 인사이트 추출 중
                      <span className="animate-pulse">...</span>
                    </p>
                  </div>
                </div>

                {/* Spacer */}
                <div className="h-1.5 sm:h-2 md:h-2.5 lg:h-3"></div>

                {/* Footer Status */}
                <div className="bg-[#f6f6f8] dark:bg-[#1a1d2d] rounded-lg p-1 sm:p-1.5 md:p-2 flex items-center justify-center gap-0.5 sm:gap-1 w-full">
                  <span className="material-symbols-outlined text-slate-400 text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs">
                    timer
                  </span>
                  <p className="text-slate-500 dark:text-slate-400 text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-semibold">
                    예상 남은 시간:{" "}
                    <span className="text-slate-800 dark:text-slate-200">
                      ~15초
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
