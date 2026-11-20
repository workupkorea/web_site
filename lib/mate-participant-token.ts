import { createHmac, timingSafeEqual } from "node:crypto";

function sign(id: string, version: number) {
  const secret = process.env.MATE_LINK_SECRET || (process.env.NODE_ENV === "development"
    ? process.env.SUPABASE_SERVICE_ROLE_KEY || "mate-preview-local-only"
    : process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!secret) throw new Error("MATE_LINK_SECRET is unavailable");
  const payload = "workup-mate-participant-v1:" + id + (version ? "." + version : "");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function mateParticipantPath(id: string, version: number) {
  // Version zero preserves links shared before issuance tracking was introduced.
  const prefix = version ? id + "." + version : id;
  return "/mate/participate#" + prefix + "." + sign(id, version);
}

export function verifyMateParticipant(token: string) {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.([1-9][0-9]{0,8}))?\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return null;
  const [, id, encodedVersion, signature] = match;
  const version = Number(encodedVersion ?? 0);
  return timingSafeEqual(Buffer.from(signature), Buffer.from(sign(id, version))) ? { id, version } : null;
}