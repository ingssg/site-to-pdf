'use client';

import { useState } from 'react';
import type { CrawlAPIRequest, CrawlAPIResponse, APIErrorResponse } from '@/types/api';
import ResultDisplay from './ResultDisplay';

export default function CrawlerForm() {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [detailLevel, setDetailLevel] = useState<'basic' | 'detailed' | 'comprehensive'>('basic');
  const [includePDF, setIncludePDF] = useState(true);
  const [includeAI, setIncludeAI] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CrawlAPIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const requestBody: CrawlAPIRequest = {
        url,
        maxPages,
        detailLevel,
        includePDF,
        includeAI,
      };

      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as APIErrorResponse;
        throw new Error(errorData.error || '크롤링에 실패했습니다');
      }

      setResult(data as CrawlAPIResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 에러가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              웹사이트 URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
            />
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Max Pages */}
            <div>
              <label htmlFor="maxPages" className="block text-sm font-medium text-gray-700 mb-2">
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
            </div>

            {/* Detail Level */}
            <div>
              <label htmlFor="detailLevel" className="block text-sm font-medium text-gray-700 mb-2">
                AI 요약 상세도
              </label>
              <select
                id="detailLevel"
                value={detailLevel}
                onChange={(e) => setDetailLevel(e.target.value as any)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={!includeAI}
              >
                <option value="basic">기본</option>
                <option value="detailed">상세</option>
                <option value="comprehensive">매우 상세</option>
              </select>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includePDF}
                onChange={(e) => setIncludePDF(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">PDF 생성</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAI}
                onChange={(e) => setIncludeAI(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">AI 요약</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                크롤링 중...
              </>
            ) : (
              '크롤링 시작'
            )}
          </button>
        </form>

        {/* Error Display */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-red-600 text-xl">❌</span>
              <div>
                <h4 className="font-semibold text-red-900">에러 발생</h4>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Result Display */}
      {result && <ResultDisplay result={result} />}
    </div>
  );
}
