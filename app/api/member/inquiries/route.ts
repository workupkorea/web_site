import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase-server";

const TYPE_LABEL: Record<string, string> = {
  franchise: "가맹·창업 문의",
  wholesale: "입점·제휴 문의",
  support:   "1:1 문의",
  product:   "상품 문의",
  group_order: "단체복·대량구매 문의",
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// 로그인한 회원이 남긴 문의 목록.
// payload 의 내부 키(_pwHash/_pwSalt 등)는 절대 노출하지 않고, 답변(_reply)만 안전하게 매핑한다.
export async function GET() {
  try {
    const store = await cookies();
    const memberId = store.get("wu-member")?.value;
    if (!memberId) return NextResponse.json([], { status: 401 });

    const sb = createAdminClient();

    // 회원이 실재하고 이용 가능한 상태인지 확인
    const { data: member } = await sb
      .from("members")
      .select("id, status")
      .eq("id", memberId)
      .maybeSingle();
    if (!member || member.status === "withdrawn") return NextResponse.json([], { status: 401 });

    const { data, error } = await sb
      .from("inquiries")
      .select("id, type, status, created_at, payload")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      // member_id 컬럼 미생성 시 안내
      if (error.message.includes("member_id")) {
        return NextResponse.json({ error: "문의 연동 준비 중입니다.", needsMigration: true }, { status: 503 });
      }
      throw error;
    }

    const list = (data ?? []).map((r) => {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        type: r.type,
        typeLabel: TYPE_LABEL[r.type] ?? "문의",
        status: r.status,
        createdAt: r.created_at,
        title: str(p.title) || str(p.subject),
        content: str(p.message) || str(p.content),
        reply: str(p._reply),
        repliedAt: str(p._repliedAt),
      };
    });

    return NextResponse.json(list);
  } catch {
    return NextResponse.json({ error: "문의를 불러오지 못했습니다." }, { status: 500 });
  }
}
