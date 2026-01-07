/**
 * 페이지 필터링 유틸리티
 * 크롤링된 페이지의 중요도를 판단하고 기본 체크 상태를 결정합니다.
 */

import type { CrawledPage } from "@/types";

// 제외 패턴 정의
const EXCLUDED_PATTERNS = [
  // 1. 인증 관련 페이지
  /\/(login|signin|sign-in|register|signup|sign-up|logout|signout|forgot-password|reset-password|verify|confirm|auth)/i,

  // 2. 법적 문서 페이지
  /\/(terms|privacy|cookie|disclaimer|legal|gdpr|ccpa|cppa)/i,

  // 3. 에러/시스템 페이지
  /\/(404|error|not-found|500|503|maintenance|offline)/i,

  // 4. 검색 및 필터링 결과
  /\/(search|results)|\?.*page=|\?.*filter=|\?.*sort=/i,

  // 5. 태그/카테고리 아카이브
  /\/(tag|category|archive|tags|categories)\//i,

  // 6. 관리자/대시보드 페이지
  /\/(admin|dashboard|wp-admin|manage|settings|console)/i,

  // 7. 전자상거래 기능 페이지
  /\/(cart|basket|checkout|payment|order|wishlist|favorites)/i,

  // 8. RSS/API 엔드포인트
  /\/(feed|rss|atom|api|sitemap|robots)/i,

  // 9. 파일 다운로드 링크
  /\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|svg|mp4|mp3|avi|mov)$/i,
];

// 제외 이유 매핑
const EXCLUSION_REASONS: Record<string, RegExp> = {
  "로그인/회원 페이지": /\/(login|signin|register|signup|logout|auth)\b/i,
  "약관/정책 페이지": /\/(terms|privacy|cookie|disclaimer|legal)\b/i,
  "에러 페이지": /\/(404|error|not-found|500|503)\b/i,
  "검색/필터 결과": /\/(search|results)\b|\?.*page=/i,
  "태그/아카이브": /\/(tag|category|archive)\//i,
  "관리자 페이지": /\/(admin|dashboard|wp-admin)\b/i,
  "장바구니/결제": /\/(cart|checkout|payment)\b/i,
  "피드/API": /\/(feed|rss|api|sitemap)\b/i,
  "파일 다운로드": /\.(pdf|zip|doc|jpg|png|mp4)$/i,
};

// 핵심 키워드 (점수 가산)
const CORE_KEYWORDS = [
  "about",
  "product",
  "service",
  "solution",
  "pricing",
  "contact",
  "case",
];

// 소프트 제외 키워드 (점수 감산)
const SOFT_EXCLUDE_KEYWORDS = [
  "privacy",
  "terms",
  "blog",
  "news",
  "careers",
  "press",
];

// 제목 제외 키워드
const EXCLUDED_TITLE_KEYWORDS = [
  "login",
  "sign in",
  "로그인",
  "privacy policy",
  "개인정보처리방침",
  "terms of service",
  "이용약관",
  "404",
  "not found",
  "페이지를 찾을 수 없습니다",
  "error",
  "에러",
];

/**
 * URL이 기본적으로 제외되어야 하는지 확인
 */
export function shouldExcludeByDefault(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const fullPath = urlObj.pathname.toLowerCase() + urlObj.search.toLowerCase();
    return EXCLUDED_PATTERNS.some((pattern) => pattern.test(fullPath));
  } catch {
    return false;
  }
}

/**
 * 제외 이유 반환
 */
export function getExclusionReason(url: string): string | undefined {
  for (const [reason, pattern] of Object.entries(EXCLUSION_REASONS)) {
    if (pattern.test(url)) {
      return reason;
    }
  }
  return undefined;
}

/**
 * 제목으로 제외 여부 판단
 */
export function shouldExcludeByTitle(title: string): boolean {
  return EXCLUDED_TITLE_KEYWORDS.some((keyword) =>
    title.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * 하드 제외 여부 확인 (isHardExcluded)
 */
function isHardExcluded(url: string): boolean {
  return shouldExcludeByDefault(url);
}

/**
 * URL 기반 중요도 계산 (크롤링 전 사전 필터링용)
 * 콘텐츠 길이를 제외하고 URL만으로 판단
 */
export function calculateUrlBasedImportance(url: string): number {
  let score = 50; // 기본 점수

  // 페이지 타입별 가점
  const pageType = detectPageType(url);
  switch (pageType) {
    case 'Homepage':
      score += 30; // 80점
      break;
    case 'About':
    case 'Contact':
    case 'Product':
    case 'Pricing':
      score += 20; // 70점
      break;
    case 'Features':
    case 'Documentation':
      score += 10; // 60점
      break;
    case 'Blog/News':
      score -= 10; // 40점
      break;
  }

  // URL 깊이 계산
  const depth = url.split("/").length - 3;
  score -= depth * 3;

  // 핵심 키워드 포함 시 가점
  const urlLower = url.toLowerCase();
  if (CORE_KEYWORDS.some((kw) => urlLower.includes(kw))) {
    score += 15;
  }

  // 소프트 제외 키워드 포함 시 감점
  if (SOFT_EXCLUDE_KEYWORDS.some((kw) => urlLower.includes(kw))) {
    score -= 15;
  }

  // 하드 제외 패턴 매칭 시 크게 감점
  if (isHardExcluded(url)) {
    score -= 50;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 스마트 모드: URL 기반으로 크롤링 여부 판단
 * 55점 이하면 크롤링하지 않음
 */
export function shouldCrawlInSmartMode(url: string): boolean {
  const importance = calculateUrlBasedImportance(url);
  return importance > 55;
}

/**
 * 페이지 중요도 점수 계산 (0-100)
 * 문서 기준: docs/crawling-filters.md
 */
export function calculateImportance(page: CrawledPage): number {
  let score = 50; // 기본 점수 (70 → 50으로 낮춤)

  // 페이지 타입별 가점 (차등 적용)
  const pageType = detectPageType(page.url);
  switch (pageType) {
    case 'Homepage':
      score += 30; // 홈페이지는 항상 중요 (80점)
      break;
    case 'About':
    case 'Contact':
    case 'Product':
    case 'Pricing':
      score += 20; // 핵심 비즈니스 페이지 (70점)
      break;
    case 'Features':
    case 'Documentation':
      score += 10; // 중요도 중간 (60점)
      break;
    case 'Blog/News':
      score -= 10; // 블로그는 일반적으로 덜 중요 (40점)
      break;
    // General: 0 (기본 50점 유지)
  }

  // URL 깊이 계산: page.url.split("/").length - 3
  const depth = page.url.split("/").length - 3;
  score -= depth * 3; // 깊이당 -3점 (2 → 3으로 증가)

  // 핵심 키워드 포함 시 가점
  const urlLower = page.url.toLowerCase();
  if (CORE_KEYWORDS.some((kw) => urlLower.includes(kw))) {
    score += 15;
  }

  // 소프트 제외 키워드 포함 시 감점
  if (SOFT_EXCLUDE_KEYWORDS.some((kw) => urlLower.includes(kw))) {
    score -= 15; // 10 → 15로 증가
  }

  // 콘텐츠 길이가 짧으면 감점
  const contentLength = page.content?.length || 0;
  if (contentLength < 300) {
    score -= 10; // 5 → 10으로 증가
  }

  // 하드 제외 패턴 매칭 시 크게 감점
  if (isHardExcluded(page.url)) {
    score -= 50;
  }

  // 0-100 범위로 제한
  return Math.max(0, Math.min(100, score));
}

/**
 * 페이지 타입 감지 (URL 패턴 기반)
 */
export function detectPageType(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    // Homepage
    if (
      pathname === "/" ||
      pathname === "/index" ||
      pathname === "/home" ||
      pathname === "/index.html"
    ) {
      return "Homepage";
    }

    // Product pages
    if (
      pathname.includes("/product") ||
      pathname.includes("/shop") ||
      pathname.includes("/buy") ||
      pathname.includes("/store")
    ) {
      return "Product";
    }

    // Contact pages
    if (
      pathname.includes("/contact") ||
      pathname.includes("/support") ||
      pathname.includes("/help")
    ) {
      return "Contact";
    }

    // About pages
    if (
      pathname.includes("/about") ||
      pathname.includes("/team") ||
      pathname.includes("/company")
    ) {
      return "About";
    }

    // Blog/News pages
    if (
      pathname.includes("/blog") ||
      pathname.includes("/news") ||
      pathname.includes("/article") ||
      pathname.includes("/post")
    ) {
      return "Blog/News";
    }

    // Pricing pages
    if (
      pathname.includes("/pricing") ||
      pathname.includes("/plans") ||
      pathname.includes("/price")
    ) {
      return "Pricing";
    }

    // Documentation pages
    if (
      pathname.includes("/docs") ||
      pathname.includes("/documentation") ||
      pathname.includes("/guide")
    ) {
      return "Documentation";
    }

    // Feature pages
    if (pathname.includes("/feature") || pathname.includes("/solution")) {
      return "Features";
    }

    return "General";
  } catch {
    return "General";
  }
}

/**
 * 페이지에 필터링 메타데이터 추가
 */
export function enrichPageWithFilterMetadata(page: CrawledPage): CrawledPage {
  const importance = calculateImportance(page);
  const exclusionReason = getExclusionReason(page.url);
  const pageType = detectPageType(page.url);

  return {
    ...page,
    importance,
    defaultChecked: !exclusionReason, // exclusionReason 없으면 체크
    exclusionReason,
    pageType,
  };
}

/**
 * 여러 페이지에 필터링 메타데이터 일괄 추가
 */
export function enrichPagesWithFilterMetadata(
  pages: CrawledPage[]
): CrawledPage[] {
  return pages.map(enrichPageWithFilterMetadata);
}

/**
 * 필터 프리셋 적용
 */
export type FilterPreset = "all" | "recommended" | "core";

export function applyFilterPreset(
  pages: CrawledPage[],
  preset: FilterPreset
): CrawledPage[] {
  return pages.map((page) => {
    let checked = false;

    switch (preset) {
      case "all":
        checked = true; // 모든 페이지 선택
        break;
      case "recommended":
        checked = (page.importance || 0) > 60; // 중요도 60 초과만 (55 → 60으로 상향)
        break;
      case "core":
        checked = (page.importance || 0) > 70; // 중요도 70 초과만 (핵심 페이지)
        break;
    }

    return {
      ...page,
      defaultChecked: checked,
    };
  });
}
