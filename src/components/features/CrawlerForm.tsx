"use client";

import { useState } from "react";
import type {
  CrawlAPIRequest,
  CrawlAPIResponse,
  APIErrorResponse,
  GeneratePDFResponse,
} from "@/types/api";
import PageSelector from "./PageSelector";
import ResultDisplay from "./ResultDisplay";

export default function CrawlerForm() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(30);

  const [loading, setLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlAPIResponse | null>(null);
  const [pdfResult, setPdfResult] = useState<GeneratePDFResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 진행률 상태
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    url: string;
    percentage: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCrawlResult(null);
    setPdfResult(null);
    setProgress(null);

    try {
      const requestBody: CrawlAPIRequest = {
        url,
        maxPages,
      };

      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("크롤링 요청 실패");
      }

      // SSE 스트림 읽기
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("응답을 읽을 수 없습니다");
      }

      let buffer = ""; // 불완전한 chunk를 모으는 버퍼

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // 버퍼에 새 chunk 추가
        buffer += decoder.decode(value, { stream: true });

        // 완전한 라인들만 추출 (마지막 불완전한 라인은 버퍼에 보관)
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 마지막 불완전한 라인은 버퍼에 유지

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              const data = JSON.parse(jsonStr);

              if (data.type === "progress") {
                // 진행률 업데이트
                setProgress({
                  current: data.current,
                  total: data.total,
                  url: data.url,
                  percentage: data.percentage,
                });
              } else if (data.type === "complete") {
                // 크롤링 완료
                setCrawlResult(data as CrawlAPIResponse);
                setProgress(null);
              } else if (data.type === "error") {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error("[SSE Parse Error]", parseError, "Line:", line);
              // JSON 파싱 에러는 무시하고 계속 진행
            }
          }
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 에러가 발생했습니다"
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePDFComplete = (result: GeneratePDFResponse) => {
    setPdfResult(result);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div>
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              웹사이트 URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900"
              required
            />
          </div>

          {/* Max Pages */}
          <div>
            <label
              htmlFor="maxPages"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              최대 페이지 수: {maxPages}
            </label>
            <input
              type="range"
              id="maxPages"
              min="1"
              max="50"
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>50</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 크롤링 후 PDF에 포함할 페이지를 직접 선택할 수 있습니다
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
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
                크롤링 중...
              </>
            ) : (
              "크롤링 시작"
            )}
          </button>
        </form>

        {/* 크롤링 진행률 표시 */}
        {loading && progress && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-blue-900">
                페이지 크롤링 중: {progress.current} / {progress.total}
              </div>
              <div className="text-blue-700 font-bold text-lg">
                {progress.percentage}%
              </div>
            </div>

            {/* 프로그레스바 */}
            <div className="w-full bg-blue-200 rounded-full h-3 mb-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            {/* 현재 크롤링 중인 URL */}
            <div className="text-sm text-blue-700 truncate">
              <span className="font-medium">현재:</span> {progress.url}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <span className="text-red-600 text-2xl">⚠️</span>
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 text-lg mb-2">
                  크롤링 실패
                </h4>
                <p className="text-red-700 text-sm mb-3">{error}</p>

                {/* 도움말 */}
                <div className="bg-white rounded p-3 mb-3">
                  <p className="text-xs text-gray-700 font-medium mb-2">
                    💡 문제 해결 방법:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1 ml-4">
                    <li>• URL이 올바른지 확인해주세요 (https:// 포함)</li>
                    <li>• 웹사이트가 robots.txt로 크롤링을 차단하지 않는지 확인</li>
                    <li>• 페이지 수를 줄여보세요 (10-20페이지 권장)</li>
                    <li>• 잠시 후 다시 시도해주세요</li>
                  </ul>
                </div>

                {/* 재시도 버튼 */}
                <button
                  onClick={() => {
                    setError(null);
                    setCrawlResult(null);
                    setPdfResult(null);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
                >
                  다시 시도하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 크롤링 성공 → 페이지 선택 */}
      {crawlResult && !pdfResult && (
        <div className="mt-8">
          <PageSelector
            pages={crawlResult.data.crawl.pages}
            onComplete={handlePDFComplete}
          />
        </div>
      )}

      {/* PDF 생성 완료 → 결과 표시 */}
      {pdfResult && crawlResult && (
        <ResultDisplay
          crawlResult={crawlResult.data.crawl}
          pdfResult={pdfResult.data}
        />
      )}
    </div>
  );
}
