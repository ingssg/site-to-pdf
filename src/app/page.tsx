import CrawlerForm from "@/components/features/CrawlerForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">SiteToPDF</h1>
          <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-3">
            웹사이트를 PDF로 변환하고 AI가 비즈니스 인사이트를 제공합니다
          </p>
          <p className="text-sm text-gray-600 max-w-xl mx-auto">
            VC 투자심사 · 영업 고객조사 · 경쟁사 분석을 5분 안에
          </p>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-green-600">✓</span>
              <span>무료 체험</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-green-600">✓</span>
              <span>2-3분 소요</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-green-600">✓</span>
              <span>데이터 저장 안함</span>
            </div>
          </div>
        </div>

        {/* Main Form */}
        <CrawlerForm />

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-3">🌐</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              전체 사이트 크롤링
            </h3>
            <p className="text-gray-700 text-sm">
              최대 50페이지를 자동으로 수집하고 스크린샷 캡처
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-3">📄</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              고품질 PDF 생성
            </h3>
            <p className="text-gray-700 text-sm">
              한글 폰트 지원, 자동 목차, 개별 페이지 다운로드
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              AI 비즈니스 분석
            </h3>
            <p className="text-gray-700 text-sm">
              비즈니스 모델, 강점, 개선점까지 상세 분석
            </p>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            이런 분들에게 추천합니다
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border-l-4 border-blue-500">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">
                💼 VC/PE 투자심사역
              </h3>
              <p className="text-gray-700 text-sm mb-3">
                투자 대상 기업의 웹사이트를 빠르게 분석하고 비즈니스 모델 파악
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>✓ 회사 개요 및 사업 모델 즉시 확인</li>
                <li>✓ 타겟 고객과 차별화 요소 분석</li>
                <li>✓ PDF로 저장하여 투자위원회 공유</li>
              </ul>
            </div>

            <div className="bg-white p-6 rounded-lg border-l-4 border-green-500">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">
                📊 B2B 영업팀
              </h3>
              <p className="text-gray-700 text-sm mb-3">
                미팅 전 잠재 고객사 웹사이트를 분석하여 맞춤형 제안 준비
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>✓ 고객사의 주요 서비스와 타겟 파악</li>
                <li>✓ Pain Point 분석으로 제안 포인트 도출</li>
                <li>✓ 팀원들과 공유 가능한 PDF 자료</li>
              </ul>
            </div>

            <div className="bg-white p-6 rounded-lg border-l-4 border-purple-500">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">
                🔍 컨설팅 펌
              </h3>
              <p className="text-gray-700 text-sm mb-3">
                경쟁사 분석, 시장 조사 시 여러 웹사이트를 체계적으로 정리
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>✓ 경쟁사 서비스 및 포지셔닝 비교</li>
                <li>✓ 시장 트렌드 파악용 자료 수집</li>
                <li>✓ 클라이언트 보고서에 활용</li>
              </ul>
            </div>

            <div className="bg-white p-6 rounded-lg border-l-4 border-orange-500">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">
                ⚖️ 법무팀/로펌
              </h3>
              <p className="text-gray-700 text-sm mb-3">
                특정 시점의 웹사이트 상태를 증거 자료로 보존
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>✓ 웹사이트 스크린샷 자동 캡처</li>
                <li>✓ 날짜 및 URL 기록 포함</li>
                <li>✓ 법적 증거 자료로 활용 가능</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
