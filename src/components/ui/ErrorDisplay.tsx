"use client";

import { type AppError } from '@/types/errors';

interface ErrorDisplayProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className = '',
}: ErrorDisplayProps) {
  return (
    <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-red-600 dark:text-red-400 text-2xl">⚠️</span>
        <div className="flex-1">
          <h4 className="font-semibold text-red-900 dark:text-red-200 text-lg mb-2">
            {error.userMessage}
          </h4>

          {/* 에러 코드 표시 (디버깅용) */}
          <p className="text-xs text-red-700 dark:text-red-300 mb-3 font-mono">
            에러 코드: {error.code}
          </p>

          {/* 도움말 */}
          {error.helpText && error.helpText.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded p-3 mb-3">
              <p className="text-xs text-gray-700 dark:text-slate-300 font-medium mb-2">
                💡 문제 해결 방법:
              </p>
              <ul className="text-xs text-gray-600 dark:text-slate-400 space-y-1 ml-4">
                {error.helpText.map((tip, index) => (
                  <li key={index}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            {error.retryable && onRetry && (
              <button
                onClick={onRetry}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
              >
                다시 시도하기
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium py-2 px-4 rounded transition-colors"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
