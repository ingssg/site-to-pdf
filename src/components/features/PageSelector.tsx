'use client';

import { useState } from 'react';
import type { GeneratePDFRequest, GeneratePDFResponse, APIErrorResponse } from '@/types/api';

interface PageSelectorProps {
  pages: Array<{
    url: string;
    title: string;
    content: string;
    depth: number;
    screenshot?: any;
  }>;
  onComplete: (result: GeneratePDFResponse) => void;
}

export default function PageSelector({ pages, onComplete }: PageSelectorProps) {
  // 기본값: 모든 페이지 선택됨
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(
    new Set(pages.map((p) => p.url))
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF 생성 진행률 상태
  const [progress, setProgress] = useState<{
    message: string;
    percentage: number;
  } | null>(null);

  const togglePage = (url: string) => {
    const newSelected = new Set(selectedUrls);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedUrls(newSelected);
  };

  const toggleAll = () => {
    if (selectedUrls.size === pages.length) {
      // 전체 해제
      setSelectedUrls(new Set());
    } else {
      // 전체 선택
      setSelectedUrls(new Set(pages.map((p) => p.url)));
    }
  };

  const handleGeneratePDF = async () => {
    if (selectedUrls.size === 0) {
      alert('최소 1개 이상의 페이지를 선택해주세요');
      return;
    }

    setGenerating(true);
    setError(null);
    setProgress(null);

    try {
      const selectedPages = pages.filter((p) => selectedUrls.has(p.url));

      const requestBody: GeneratePDFRequest = {
        pages: selectedPages,
        detailLevel: 'basic', // 기본 AI 요약 사용
      };

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('PDF 생성 요청 실패');
      }

      // SSE 스트림 읽기
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('응답을 읽을 수 없습니다');
      }

      let buffer = '';  // 불완전한 chunk를 모으는 버퍼

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // 버퍼에 새 chunk 추가
        buffer += decoder.decode(value, { stream: true });

        // 완전한 라인들만 추출 (마지막 불완전한 라인은 버퍼에 보관)
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // 마지막 불완전한 라인은 버퍼에 유지

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              const data = JSON.parse(jsonStr);

              if (data.type === 'progress') {
                // 진행률 업데이트
                console.log('[PDF Progress]', data.message, data.percentage + '%');
                setProgress({
                  message: data.message,
                  percentage: data.percentage,
                });
              } else if (data.type === 'complete') {
                // PDF 생성 완료
                console.log('[PDF Complete]', data);
                setProgress(null);
                onComplete(data as GeneratePDFResponse);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error('[SSE Parse Error]', parseError, 'Line:', line);
              // JSON 파싱 에러는 무시하고 계속 진행
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 에러가 발생했습니다');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      {/* 헤더 - 직관적인 설명 */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-2xl font-bold text-gray-900 mb-3">
          📋 PDF에 포함할 페이지 선택
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm text-blue-900 font-medium">
            💡 사용 방법
          </p>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>기본 설정:</strong> 모든 페이지가 선택되어 있습니다</li>
            <li><strong>제외하려면:</strong> 불필요한 페이지의 체크박스를 클릭해서 해제하세요</li>
            <li><strong>법적 증거/완전 보존:</strong> 그대로 두고 PDF 생성 버튼을 누르세요</li>
            <li><strong>맞춤형:</strong> 개인정보처리방침, 이용약관 등은 제외해도 좋습니다</li>
          </ul>
        </div>
      </div>

      {/* 통계 및 액션 버튼 */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-blue-600 text-lg">{selectedUrls.size}</span>
          <span className="mx-1">/ {pages.length}</span>
          <span>페이지 선택됨</span>
        </div>
        <button
          onClick={toggleAll}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
        >
          {selectedUrls.size === pages.length ? '전체 해제' : '전체 선택'}
        </button>
      </div>

      {/* 페이지 목록 */}
      <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
        {pages.map((page, idx) => {
          const isSelected = selectedUrls.has(page.url);
          return (
            <label
              key={page.url}
              className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => togglePage(page.url)}
                className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-200 text-gray-700 rounded-full flex items-center justify-center text-xs font-semibold">
                    {idx + 1}
                  </span>
                  <h4 className="font-medium text-gray-900 truncate">
                    {page.title || '제목 없음'}
                  </h4>
                </div>
                <p className="text-sm text-blue-600 truncate">{page.url}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {page.content.slice(0, 150)}...
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {/* PDF 생성 진행률 표시 */}
      {generating && progress && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-green-900">
              {progress.message}
            </div>
            <div className="text-green-700 font-bold text-lg">
              {progress.percentage}%
            </div>
          </div>

          {/* 프로그레스바 */}
          <div className="w-full bg-green-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-green-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-600 text-xl">❌</span>
            <div className="flex-1">
              <h4 className="font-semibold text-red-900">PDF 생성 실패</h4>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <p className="text-gray-600 text-xs mt-2">
                💡 크롤링한 데이터는 보존되어 있습니다. 아래 버튼을 눌러 PDF 생성을 다시 시도하세요.
              </p>
            </div>
          </div>
          <button
            onClick={handleGeneratePDF}
            disabled={generating}
            className="mt-4 w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            🔄 PDF 생성 재시도 (크롤링 없이)
          </button>
        </div>
      )}

      {/* PDF 생성 버튼 */}
      <button
        onClick={handleGeneratePDF}
        disabled={generating || selectedUrls.size === 0}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 text-lg"
      >
        {generating ? (
          <>
            <svg
              className="animate-spin h-6 w-6 text-white"
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
            PDF 생성 중... (AI 요약 + PDF 변환)
          </>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            선택한 {selectedUrls.size}개 페이지로 PDF 생성
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center mt-3">
        선택한 페이지만 AI 요약 및 PDF에 포함됩니다
      </p>
    </div>
  );
}
