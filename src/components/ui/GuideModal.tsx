"use client";

import Modal from "./modal";

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuideModal({ isOpen, onClose }: GuideModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={true}>
      <div className="w-full max-w-3xl p-6 sm:p-8 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📖 사용방법
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            SiteToPDF 완벽 가이드 - AI 자동 필터링부터 PDF 다운로드까지
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              1️⃣ URL 입력 및 크롤링 모드 선택
            </h3>
            <p className="text-sm text-gray-700 dark:text-slate-300 mb-3 leading-relaxed">
              분석하고 싶은 웹사이트 URL을 입력하고, 목적에 맞는 크롤링 모드를
              선택하세요.
            </p>
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🎯</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    스마트 모드 (추천)
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 pl-6">
                  비즈니스 분석용. 중요한 페이지만 선별하여 핵심 내용에
                  집중합니다. 불필요한 약관, SNS 링크 등을 자동 제외합니다.
                  <br />
                  <span className="text-blue-600 dark:text-blue-400">
                    ✓ VC/투자심사, B2B 영업, 컨설팅 추천
                  </span>
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">📁</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    전체 아카이브 모드
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 pl-6">
                  법적 증거 보존용. 모든 페이지를 빠짐없이 스크린샷 PDF로 완전
                  보존합니다.
                  <br />
                  <span className="text-blue-600 dark:text-blue-400">
                    ✓ 법무팀, 로펌, 컴플라이언스 추천
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              2️⃣ 🤖 AI 자동 필터링 (프리미엄 기능)
            </h3>
            <p className="text-sm text-gray-700 dark:text-slate-300 mb-3 leading-relaxed">
              크롤링 완료 후, AI가 비즈니스 분석에 필요한 핵심 페이지만 자동으로
              선택합니다.
            </p>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 font-bold">
                  •
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    콘텐츠 기반 분석
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    URL이 아닌 실제 페이지 내용을 읽고 중요도를 판단합니다
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 font-bold">
                  •
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    5가지 핵심 정보 우선
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    회사 소개, 제품/서비스, 가격 정책, 고객 사례, 회사 배경 정보
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 font-bold">
                  •
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    불필요한 페이지 자동 제외
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    로그인, 약관, 단순 이벤트, 채용 공고 등 자동 필터링
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-2 italic">
              ✨ 물론 AI 선택 후에도 수동으로 페이지를 추가/제거할 수 있습니다!
            </p>
          </div>

          {/* Step 3 */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              3️⃣ AI 비즈니스 분석 생성
            </h3>
            <p className="text-sm text-gray-700 dark:text-slate-300 mb-3 leading-relaxed">
              선택한 페이지들을 분석하여 종합 비즈니스 리포트를 자동으로
              생성합니다.
            </p>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2 text-xs text-gray-700 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <span className="font-bold text-green-600 dark:text-green-400">
                  ✓
                </span>
                <div>
                  <span className="font-semibold">회사 개요:</span> 비전, 미션,
                  핵심 가치 제안
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-green-600 dark:text-green-400">
                  ✓
                </span>
                <div>
                  <span className="font-semibold">주요 제품/서비스:</span> 핵심
                  기능, 차별화 요소
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-green-600 dark:text-green-400">
                  ✓
                </span>
                <div>
                  <span className="font-semibold">비즈니스 모델:</span> 수익
                  구조, 가격 정책, 타겟 고객
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-green-600 dark:text-green-400">
                  ✓
                </span>
                <div>
                  <span className="font-semibold">성장 가능성:</span> 투자
                  매력도, 시장 기회, 강점 분석
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="border-l-4 border-orange-500 pl-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              4️⃣ PDF 다운로드 (3가지 형식)
            </h3>
            <p className="text-sm text-gray-700 dark:text-slate-300 mb-3 leading-relaxed">
              필요에 맞는 형식으로 PDF를 다운로드하세요.
            </p>
            <div className="space-y-3">
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">📊</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    AI 분석 PDF
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 pl-6">
                  비즈니스 인사이트 + 각 페이지 요약 + 스크린샷이 포함된 종합
                  리포트
                </p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">📸</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    원본 스크린샷 PDF
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 pl-6">
                  법적 증거용. 타임스탬프가 포함된 순수 스크린샷만 (AI 분석
                  제외)
                </p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">📦</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    개별 PDF ZIP
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 pl-6">
                  각 페이지를 개별 PDF 파일로 분리하여 ZIP으로 압축
                </p>
              </div>
            </div>
          </div>

          {/* Premium Features */}
          <div className="border-l-4 border-yellow-500 pl-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-r-lg pr-4 py-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span>✨</span>
              <span>프리미엄 기능 (Coming Soon)</span>
            </h3>
            <div className="space-y-2 text-sm text-gray-700 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 font-bold">
                  •
                </span>
                <div>
                  <span className="font-semibold">무제한 페이지 크롤링:</span>{" "}
                  50페이지 제한 해제
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 font-bold">
                  •
                </span>
                <div>
                  <span className="font-semibold">SWOT 분석:</span>{" "}
                  취업/이직자를 위한 회사 분석 모드
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 font-bold">
                  •
                </span>
                <div>
                  <span className="font-semibold">스케줄 크롤링:</span> 정기적인
                  자동 업데이트
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 font-bold">
                  •
                </span>
                <div>
                  <span className="font-semibold">팀 협업:</span> 워크스페이스
                  및 공유 기능
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-600 dark:text-slate-400 text-center">
            💡 문의사항이나 기능 제안은{" "}
            <a
              href="mailto:support@sitetopdf.com"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              support@sitetopdf.com
            </a>
            으로 연락주세요
          </p>
        </div>
      </div>
    </Modal>
  );
}
