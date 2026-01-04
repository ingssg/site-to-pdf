'use client';

import { useState } from 'react';
import type { GeneratePDFRequest, GeneratePDFResponse, APIErrorResponse } from '@/types/api';
import PDFGenerationProgressModal from './PDFGenerationProgressModal';
import PDFCompletionModal from './PDFCompletionModal';

interface PageSelectorProps {
  pages: Array<{
    url: string;
    title: string;
    content: string;
    depth: number;
    screenshot?: any;
  }>;
  onComplete: (result: GeneratePDFResponse) => void;
  onClose?: () => void;
}

export default function PageSelector({ pages, onComplete, onClose }: PageSelectorProps) {
  // 기본값: 모든 페이지 선택됨
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(
    new Set(pages.map((p) => p.url))
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [pdfResult, setPdfResult] = useState<GeneratePDFResponse | null>(null);
  const [showUsageGuide, setShowUsageGuide] = useState(false);

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
                setGenerating(false);
                setCompleted(true);
                setPdfResult(data as GeneratePDFResponse);
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
    <div className="flex flex-col h-full max-h-[calc(100vh-2rem)] relative overflow-hidden">
      {/* X 버튼 */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 z-10"
          aria-label="닫기"
        >
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
      
      {/* 헤더 - 직관적인 설명 */}
      <div className="p-6 sm:p-8 pb-6 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          📋 PDF에 포함할 페이지 선택
        </h3>
        {/* 사용 방법 토글 */}
        <button
          onClick={() => setShowUsageGuide(!showUsageGuide)}
          className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-900 dark:text-blue-200 font-medium">
              💡 사용 방법
            </span>
          </div>
          <svg
            className={`w-5 h-5 text-blue-600 dark:text-blue-400 transition-transform ${showUsageGuide ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {showUsageGuide && (
          <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li><strong>기본 설정:</strong> 모든 페이지가 선택되어 있습니다</li>
              <li><strong>제외하려면:</strong> 불필요한 페이지의 체크박스를 클릭해서 해제하세요</li>
              <li><strong>법적 증거/완전 보존:</strong> 그대로 두고 PDF 생성 버튼을 누르세요</li>
              <li><strong>맞춤형:</strong> 개인정보처리방침, 이용약관 등은 제외해도 좋습니다</li>
            </ul>
          </div>
        )}
      </div>

      {/* 통계 및 액션 버튼 */}
      <div className="flex items-center justify-between px-6 sm:px-8 pt-6 pb-4 flex-shrink-0">
        <div className="text-sm text-gray-600 dark:text-slate-400">
          <span className="font-semibold text-blue-600 dark:text-blue-400 text-lg">{selectedUrls.size}</span>
          <span className="mx-1">/ {pages.length}</span>
          <span>페이지 선택됨</span>
        </div>
        <button
          onClick={toggleAll}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium underline"
        >
          {selectedUrls.size === pages.length ? '전체 해제' : '전체 선택'}
        </button>
      </div>

      {/* 페이지 목록 - 스크롤 가능 영역 */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-8">
        <div className="space-y-3 pb-4">
        {pages.map((page, idx) => {
          const isSelected = selectedUrls.has(page.url);
          return (
            <label
              key={page.url}
              className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'
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
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-full flex items-center justify-center text-xs font-semibold">
                    {idx + 1}
                  </span>
                  <h4 className="font-medium text-gray-900 dark:text-white truncate">
                    {page.title || '제목 없음'}
                  </h4>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 truncate">{page.url}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {page.content.slice(0, 150)}...
                </p>
              </div>
            </label>
          );
        })}
        </div>
      </div>

      {/* PDF 생성 진행률 모달 */}
      {generating && !completed && (
        <PDFGenerationProgressModal
          isOpen={true}
          progress={progress}
          onClose={onClose}
        />
      )}

      {/* PDF 생성 완료 모달 */}
      {completed && pdfResult && (
        <PDFCompletionModal
          isOpen={true}
          onClose={() => {
            setCompleted(false);
            if (onClose) onClose();
          }}
          onViewResults={() => {
            setCompleted(false);
            onComplete(pdfResult);
          }}
          fileName={pdfResult.data?.mergedPdf ? "website.pdf" : "website.zip"}
          fileSize={pdfResult.data?.mergedPdf ? "2.4 MB" : "24.8 MB"}
        />
      )}

      {/* 하단 고정 영역 (팝업창 하단에 붙임) */}
      <div className="flex-shrink-0 px-6 sm:px-8 pt-4 pb-6 sm:pb-8 border-t border-gray-200 dark:border-slate-700">

        {/* 에러 표시 */}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-red-600 dark:text-red-400 text-xl">❌</span>
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 dark:text-red-200">PDF 생성 실패</h4>
                <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
                <p className="text-gray-600 dark:text-slate-400 text-xs mt-2">
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
        {!generating && (
          <button
            onClick={handleGeneratePDF}
            disabled={selectedUrls.size === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            선택한 {selectedUrls.size}개 페이지로 PDF 생성
          </button>
        )}

        <p className="text-xs text-gray-500 dark:text-slate-400 text-center mt-3">
          선택한 페이지만 AI 요약 및 PDF에 포함됩니다
        </p>
      </div>
    </div>
  );
}
