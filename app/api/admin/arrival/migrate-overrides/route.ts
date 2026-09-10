import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// 로컬 arrival-overrides.json → Supabase arrival_overrides 1회 마이그레이션
// localhost에서만 실행 (배포 후에는 이 파일 삭제 가능)
// GET: 현재 Supabase arrival_overrides 행 수 확인
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("arrival_overrides").select("override_key, image");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const withImage = (data ?? []).filter(r => r.image).length;
  return NextResponse.json({
    total: data?.length ?? 0,
    withImage,
    keys: (data ?? []).map(r => r.override_key),
  });
}

export async function POST() {
  try {
    const filePath = path.join(process.cwd(), "data/arrival-overrides.json");
    const raw = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "");
    const overrides = JSON.parse(raw) as Record<string, {
      arrivalDate?: string;
      status?: string;
      image?: string | null;
      detailUrl?: string | null;
      changeHistory?: object[];
    }>;

    const rows = Object.entries(overrides).map(([key, v]) => ({
      override_key:   key,
      arrival_date:   v.arrivalDate ?? null,
      status:         v.status ?? null,
      image:          v.image ?? null,
      detail_url:     v.detailUrl ?? null,
      change_history: v.changeHistory ?? [],
      updated_at:     new Date().toISOString(),
    }));

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, migrated: 0 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("arrival_overrides").upsert(rows);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, migrated: rows.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
