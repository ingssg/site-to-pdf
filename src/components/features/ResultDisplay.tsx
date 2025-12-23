'use client';

import type { CrawlAPIResponse } from '@/types/api';

interface ResultDisplayProps {
  result: CrawlAPIResponse;
}

export default function ResultDisplay({ result }: ResultDisplayProps) {
  const { crawl, pdf, summary } = result.data;

  const handleDownloadPDF = async () => {
    if (!pdf) return;

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfBase64: pdf.mergedPdf,
          filename: 'website.pdf',
        }),
      });

      if (!response.ok) throw new Error('다운로드 실패');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'website.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('PDF 다운로드에 실패했습니다');
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-green-600 text-2xl">✅</span>
          <div>
            <h3 className="font-semibold text-green-900 text-lg">크롤링 완료!</h3>
            <p className="text-green-700 text-sm mt-1">
              {crawl.totalPages}개 페이지를 {crawl.duration}에 수집했습니다
            </p>
          </div>
        </div>
      </div>

      {/* Crawl Stats */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h4 className="font-semibold text-gray-900 mb-4">크롤링 정보</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600">수집 페이지</div>
            <div className="text-2xl font-bold text-blue-600">{crawl.totalPages}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">실패 페이지</div>
            <div className="text-2xl font-bold text-red-600">{crawl.failedUrls.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">소요 시간</div>
            <div className="text-2xl font-bold text-gray-900">{crawl.duration}</div>
          </div>
        </div>
      </div>

      {/* PDF Download */}
      {pdf && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="font-semibold text-gray-900 mb-4">PDF 다운로드</h4>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">파일 크기</div>
              <div className="text-lg font-semibold">{pdf.totalSizeMB} MB</div>
              <div className="text-sm text-gray-500 mt-1">{pdf.pageCount}개 페이지</div>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF 다운로드
            </button>
          </div>
        </div>
      )}

      {/* AI Summary */}
      {summary && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            AI 요약
          </h4>

          {summary.companyName && (
            <div className="mb-4">
              <span className="inline-block bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded">
                {summary.companyName}
              </span>
            </div>
          )}

          <div className="space-y-4">
            {/* Overview */}
            <div>
              <h5 className="font-medium text-gray-900 mb-2">개요</h5>
              <p className="text-gray-700 leading-relaxed">{summary.overview}</p>
            </div>

            {/* Main Services */}
            {summary.mainServices.length > 0 && (
              <div>
                <h5 className="font-medium text-gray-900 mb-2">주요 서비스</h5>
                <ul className="space-y-1">
                  {summary.mainServices.map((service, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span className="text-gray-700">{service}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Target Customers */}
            {summary.targetCustomers.length > 0 && (
              <div>
                <h5 className="font-medium text-gray-900 mb-2">타겟 고객</h5>
                <div className="flex flex-wrap gap-2">
                  {summary.targetCustomers.map((customer, idx) => (
                    <span key={idx} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                      {customer}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Unique Features */}
            {summary.uniqueFeatures.length > 0 && (
              <div>
                <h5 className="font-medium text-gray-900 mb-2">차별점</h5>
                <ul className="space-y-1">
                  {summary.uniqueFeatures.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* SWOT Analysis */}
            {summary.swotAnalysis && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-green-200 rounded-lg p-4">
                  <h6 className="font-medium text-green-900 mb-2">강점 (Strengths)</h6>
                  <ul className="space-y-1 text-sm">
                    {summary.swotAnalysis.strengths.map((item, idx) => (
                      <li key={idx} className="text-gray-700">• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="border border-red-200 rounded-lg p-4">
                  <h6 className="font-medium text-red-900 mb-2">약점 (Weaknesses)</h6>
                  <ul className="space-y-1 text-sm">
                    {summary.swotAnalysis.weaknesses.map((item, idx) => (
                      <li key={idx} className="text-gray-700">• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="border border-blue-200 rounded-lg p-4">
                  <h6 className="font-medium text-blue-900 mb-2">기회 (Opportunities)</h6>
                  <ul className="space-y-1 text-sm">
                    {summary.swotAnalysis.opportunities.map((item, idx) => (
                      <li key={idx} className="text-gray-700">• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="border border-orange-200 rounded-lg p-4">
                  <h6 className="font-medium text-orange-900 mb-2">위협 (Threats)</h6>
                  <ul className="space-y-1 text-sm">
                    {summary.swotAnalysis.threats.map((item, idx) => (
                      <li key={idx} className="text-gray-700">• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Competitor Analysis */}
            {summary.competitorAnalysis && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">경쟁사 분석</h5>
                <p className="text-gray-700 text-sm">{summary.competitorAnalysis}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
