/**
 * 파일명 생성 유틸리티
 */

/**
 * 도메인에서 파일명 안전한 문자열 추출
 */
export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "website";
  }
}

/**
 * PDF/ZIP 파일명 생성
 */
export function generateFilename(
  extension: "pdf" | "zip",
  domain?: string,
  suffix?: string
): string {
  try {
    const safeDomain = (domain || "website").replace(/\./g, "_");
    const date = new Date().toISOString().split("T")[0];
    const suffixPart = suffix ? `_${suffix}` : "";
    
    if (extension === "zip") {
      return `${safeDomain}_business_intelligence${suffixPart}_${date}_pages.zip`;
    }
    return `${safeDomain}_business_intelligence${suffixPart}_${date}.pdf`;
  } catch {
    const date = new Date().toISOString().split("T")[0];
    return extension === "zip"
      ? `business_intelligence_${date}_pages.zip`
      : `business_intelligence_${date}.pdf`;
  }
}
