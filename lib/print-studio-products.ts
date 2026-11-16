import { validPrintImageUrl } from "./print-studio";

export type PrintProduct = { id: string; name: string; barcode: string; code: string; brand: string; price: number; imageUrl: string };
export const PRINT_SEARCH_FIELDS = { name: "it_name", sku: "it_tag_code", barcode: "it_code" } as const;
export type PrintSearchField = keyof typeof PRINT_SEARCH_FIELDS;
function text(s: string) {
  return s.replace(/<[^>]*>/g, "").replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[\da-f]+);/gi, value => {
    const fixed: Record<string,string> = { "&amp;":"&", "&quot;":'"', "&apos;":"'", "&lt;":"<", "&gt;":">", "&nbsp;":" " };
    if (fixed[value]) return fixed[value];
    const point = value[2].toLowerCase() === "x" ? parseInt(value.slice(3,-1),16) : Number(value.slice(2,-1));
    return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
  }).trim();
}
function attributes(tag: string) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1].toLowerCase(), text(m[2] ?? m[3])]));
}
export function parsePrintProducts(html: string): PrintProduct[] {
  const products: PrintProduct[] = [];
  // 실제 페이지는 hidden it_id가 행 밖에 섞인 비정상 HTML을 반환한다.
  // 기존 연동과 같이 hidden id 사이를 한 상품으로 읽어 DOM 보정에 따른 누락을 막는다.
  const markers = [...html.matchAll(/<input\b[^>]*\bname=["']it_id\[\d+\]["'][^>]*>/gi)];
  const rows = markers.length
    ? markers.map((m,i) => html.slice(m.index, markers[i+1]?.index ?? html.length).split(/<\/tr>/i)[0])
    : [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
  for (const row of rows) {
    const fields: Record<string,string> = {};
    for (const input of row.matchAll(/<input\b[^>]*>/gi)) { const a = attributes(input[0]); if (a.name) fields[a.name.replace(/\[\d+\]$/, "")] = a.value ?? ""; }
    // W주문은 hidden it_id를 <tr> 바깥에 두기도 하므로 실제 수정 링크의 id도 읽는다.
    const id = fields.it_id || row.match(/(?:[?&]|&amp;)it_id=([a-z0-9_-]{1,80})(?=[&"'\s]|$)/i)?.[1], name = fields.it_name;
    if (!id || !/^[a-z0-9_-]{1,80}$/i.test(id) || !name) continue;
    const photos = [...row.matchAll(/<img\b[^>]*>/gi)].map(m => attributes(m[0]));
    const image = photos.find(a => a.class?.split(/\s+/).includes("shop_img"));
    const imagePath = image?.data_img || image?.src || "";
    let imageUrl = "";
    try { const candidate = new URL(imagePath, "https://wjumun.com").href; if (validPrintImageUrl(candidate)) imageUrl = candidate; } catch { /* Missing image stays empty. */ }
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    const photoCell = cells.findIndex(cell => /\bshop_img\b/.test(cell[1]));
    const priceText = fields.it_supply_pay?.replace(/[,\s]/g, "") ?? "";
    if (!/^\d+(?:\.\d+)?$/.test(priceText)) continue;
    products.push({ id, name: name.slice(0,200), barcode: fields.it_code ?? "", code: fields.it_maker ?? "", brand: text(cells[photoCell-1]?.[1] ?? "").slice(0,100), price: Number(priceText), imageUrl });
  }
  return products;
}
