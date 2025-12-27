'use client';

import { useState, useEffect } from 'react';
import type { CrawlAPIRequest, CrawlAPIResponse, APIErrorResponse } from '@/types/api';
import ResultDisplay from './ResultDisplay';

export default function CrawlerForm() {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [mode, setMode] = useState<'fast' | 'standard' | 'archive'>('fast');
  const [detailLevel, setDetailLevel] = useState<'basic' | 'detailed' | 'comprehensive'>('basic');
  const [includePDF, setIncludePDF] = useState(false); // Fast 모드 기본값 false
  const [includeAI, setIncludeAI] = useState(true); // Fast 모드 기본값 true

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CrawlAPIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 모드 변경 시 기본값 자동 조정
  useEffect(() => {
    if (mode === 'fast') {
      setIncludePDF(false);
      setIncludeAI(true);
    } else if (mode === 'standard') {
      setIncludePDF(true);
      setIncludeAI(true);
    } else if (mode === 'archive') {
      setIncludePDF(true);
      setIncludeAI(false);
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const requestBody: CrawlAPIRequest = {
        url,
        maxPages,
        mode,
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900"
              required
            />
          </div>

          {/* Mode Selection */}
          <div>
            <label htmlFor="mode" className="block text-sm font-medium text-gray-700 mb-2">
              크롤링 모드
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'fast' | 'standard' | 'archive')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
            >
              <option value="fast">⚡ Fast - 빠른 AI 분석 (텍스트만)</option>
              <option value="standard">📄 Standard - 텍스트 PDF</option>
              <option value="archive">🗄️ Archive - 완전 보존 (스크린샷)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {mode === 'fast' && '텍스트만 크롤링하여 AI 요약을 빠르게 제공합니다.'}
              {mode === 'standard' && '텍스트 기반 PDF와 AI 요약을 제공합니다.'}
              {mode === 'archive' && '스크린샷을 포함한 완전한 아카이브 PDF를 생성합니다.'}
            </p>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
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
