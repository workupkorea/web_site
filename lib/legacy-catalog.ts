// 저장된 메뉴 설정에 남아 있는 기존 통합 카탈로그 주소만 식별한다.
export function isLegacyCatalogHref(href: string): boolean {
  return /^(?:(?:https?:)?\/\/(?:www\.)?workupkorea\.com)?\/catalog\/?(?:[?#].*)?$/i.test(href.trim());
}
