import { createHash } from "node:crypto";

export const PRINT_BUCKET = "print-studio-private";
export const PRINT_MAX_BYTES = 80 * 1024 * 1024;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function printOwnerKey(id: string | number) {
  return createHash("sha256").update(`workup-print:${id}`).digest("hex").slice(0, 32);
}
export function samePrintOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !!origin && origin === new URL(req.url).origin;
}
export function validPrintObjectPath(path: unknown, owner: string, id: string) {
  if (typeof path !== "string") return false;
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === owner && parts[1] === id && UUID_RE.test(parts[2].replace(/\.json$/, "")) && parts[2].endsWith(".json");
}
export function validPrintImageUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "wjumun.com" && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/shop\/data\/item\/[a-z0-9_-]{1,80}\/[a-z0-9_-]{1,100}_[ls]\d+\.(?:jpe?g|png|webp)$/i.test(url.pathname);
  } catch { return false; }
}
