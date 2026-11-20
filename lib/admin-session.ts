import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "wu-admin-session";
export const ADMIN_SESSION_AGE = 60 * 60 * 24 * 30;

function signature(id: string, expires: number, passwordHash: string) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Admin session secret is unavailable");
  return createHmac("sha256", secret)
    .update(JSON.stringify(["workup-admin-v1", id, expires, passwordHash]))
    .digest("hex");
}

export function createAdminSession(id: string, passwordHash: string) {
  const expires = Math.floor(Date.now() / 1000) + ADMIN_SESSION_AGE;
  return `${expires}.${signature(id, expires, passwordHash)}`;
}

export function verifyAdminSession(token: string, id: string, passwordHash: string) {
  if (!/^\d{1,12}\.[0-9a-f]{64}$/.test(token)) return false;
  const [timestamp, digest] = token.split(".");
  const expires = Number(timestamp);
  if (expires <= Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(signature(id, expires, passwordHash), "hex"));
}