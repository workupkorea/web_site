import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAdminMember } from "@/lib/admin-auth";
import { printOwnerKey } from "@/lib/print-studio";

export const dynamic = "force-dynamic";
export async function GET() {
  const member = await getAdminMember();
  if (!member) return new Response("로그인 후 전단 스튜디오를 다시 열어 주세요.", { status: 401 });
  const source = await readFile(path.join(process.cwd(),"data/print-studio/editor.html"), "utf8");
  return new Response(source.replace('data-owner="__PRINT_OWNER__"', `data-owner="${printOwnerKey(member.id)}"`), { headers: { "Content-Type":"text/html; charset=utf-8", "Cache-Control":"private, no-store", "Content-Security-Policy":"frame-ancestors 'self'; object-src 'none'; base-uri 'self'", "X-Robots-Tag":"noindex, nofollow" } });
}
