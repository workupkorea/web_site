import { NextResponse } from "next/server";
import { getAdminMember, SUPER_ADMIN_GRADE } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const m = await getAdminMember();
  return NextResponse.json({ superAdmin: m?.grade === SUPER_ADMIN_GRADE });
}
