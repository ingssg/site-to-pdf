import CrawlerForm from '@/components/features/CrawlerForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            SiteToPDF
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            웹사이트를 PDF로 변환하고 AI가 핵심 내용을 요약해드립니다
          </p>
        </div>

        {/* Main Form */}
        <CrawlerForm />

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">🌐</div>
            <h3 className="text-lg font-semibold mb-2">전체 사이트 크롤링</h3>
            <p className="text-gray-600 text-sm">
              웹사이트의 모든 페이지를 자동으로 수집합니다
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">📄</div>
            <h3 className="text-lg font-semibold mb-2">고품질 PDF 생성</h3>
            <p className="text-gray-600 text-sm">
              깔끔한 PDF 문서로 변환 및 병합
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="text-lg font-semibold mb-2">AI 요약</h3>
            <p className="text-gray-600 text-sm">
              GPT-4가 핵심 내용을 자동으로 요약
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
