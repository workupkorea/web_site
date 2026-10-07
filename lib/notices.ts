// 지점 출고 패스 공지 — 마감 자동화(크론)와 관리자 수동 버튼이 공유하는 헬퍼.
// 모든 DB 접근은 이 저장소 관례대로 서비스 롤 클라이언트(createAdminClient)를 사용한다.
// 마감 관리는 개별 공지가 아니라 "오늘 등록된 모든 공지"를 한 번에 여닫는 전사 단위 동작이다.
import { createAdminClient } from "./supabase-server";
import { logAudit } from "./audit-server";
import { sendPushToAllStores } from "./push";

export type NoticeStatus = "대기" | "진행중" | "마감";
export type PassStatus = "출고" | "패스";

export type NoticeSchedule = { openTime: string; closeTime: string };
const DEFAULT_SCHEDULE: NoticeSchedule = { openTime: "11:00", closeTime: "14:00" };

// 마감 관리 화면에서 설정하는 오픈/마감 시각 — site_settings(section+config) 재사용, 새 테이블 없음.
export async function getNoticeSchedule(): Promise<NoticeSchedule> {
  const sb = createAdminClient();
  const { data } = await sb.from("site_settings").select("config").eq("section", "notice_schedule").maybeSingle();
  const cfg = data?.config as Partial<NoticeSchedule> | null;
  return { openTime: cfg?.openTime || DEFAULT_SCHEDULE.openTime, closeTime: cfg?.closeTime || DEFAULT_SCHEDULE.closeTime };
}

// 오늘 날짜의 "대기" 공지를 전부 "진행중"으로 전환 — 11:00 크론 또는 관리자의 "지금 전체 오픈하기"에서 호출
export async function openTodaysNotices(opts?: { manual?: boolean }) {
  const sb = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("notices")
    .update({ status: "진행중", opened_at: new Date().toISOString() })
    .eq("notice_date", today)
    .eq("status", "대기")
    .select("id");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length > 0) {
    await logAudit({
      action: "update",
      resource: "notices",
      resourceLabel: "공지",
      summary: `${opts?.manual ? "수동 전체" : "자동"} 오픈 (${rows.length}건)`,
      actorName: opts?.manual ? undefined : "시스템",
    });
    await sendPushToAllStores({
      title: "지점 출고 패스",
      body: `오늘의 공지 ${rows.length}건이 열렸습니다. 출고·패스 여부를 확인해 주세요.`,
    }).catch(() => {});
  }
  return rows;
}

// "진행중"인 공지를 전부 "마감"으로 전환 — 14:00 크론 또는 관리자의 "지금 전체 마감하기"에서 호출
export async function closeOpenNotices(opts?: { manual?: boolean }) {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("notices")
    .update({ status: "마감", closed_at: new Date().toISOString() })
    .eq("status", "진행중")
    .select("id");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length > 0) {
    await logAudit({
      action: "update",
      resource: "notices",
      resourceLabel: "공지",
      summary: `${opts?.manual ? "수동 전체" : "자동"} 마감 (${rows.length}건)`,
      actorName: opts?.manual ? undefined : "시스템",
    });
  }
  return rows;
}

export type NoticeCard = {
  notice: {
    id: string;
    status: NoticeStatus;
    notice_date: string;
    badge: string | null;
    description: string | null;
    extraImages: string[];
    // 대표 썸네일이 세로형이면 잘라내지 않고 전체를 보여준다(컬럼 미적용 시 항상 false).
    imagePortrait: boolean;
  };
  product: {
    // 실제 상품(products 테이블) 연결이 있으면 그 id, 마감패스 전용(공지에만 존재)이면 null.
    id: string | null;
    name: string;
    tagline: string | null;
    image_url: string | null;
    // 임시등록의 "나머지 사진"은 상세페이지(detail_blocks)에 등록되는 형태로 저장된다. 마감패스 전용은 항상 빈 배열.
    detail_image_urls: string[];
    isTempOnly: boolean;
  } | null;
  passStatus: PassStatus;
  updatedAt: string | null;
};

export type PassContext = {
  store: { id: number; name: string; manager_name: string | null };
  notices: NoticeCard[];
};

// 토큰 → 지점 → 공지 조회. date를 주면 그 날짜에 등록된 공지(과거 이력 포함)를 그대로 보여주고,
// 주지 않으면 기본("오늘" 실시간) 동작이다. 지점 인증은 토큰 매칭이 전부다(별도 로그인 없음).
export async function getPassContextByToken(token: string, date?: string): Promise<PassContext | null> {
  const sb = createAdminClient();

  const { data: store, error: storeErr } = await sb
    .from("stores")
    .select("id, name, manager_name")
    .eq("pass_link_token", token)
    .eq("is_active", true)
    .maybeSingle();
  if (storeErr || !store) return null;

  // KST 벽시계 기준 "오늘" — 서버가 UTC로 돌아도 자정 근처에서 어긋나지 않도록.
  const todayKst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  let query = sb
    .from("notices")
    .select("id, status, notice_date, badge, product_id, description, extra_images, temp_name, temp_image_url, temp_tagline")
    .order("created_at", { ascending: true });

  if (date) {
    // 캘린더로 특정 날짜를 선택한 경우 — 그날 등록된 공지를 상태와 무관하게 그대로 보여준다(이력 조회).
    query = query.eq("notice_date", date);
  } else {
    // 기본(실시간) 화면 — "진행중"인 공지는 날짜와 무관하게 보여준다(마감 처리가 하루를 넘겨 늦어지는
    // 경우 누락 방지). "마감"된 공지는 오늘 것만 보여준다. "대기" 상태는 아직 오픈 전이므로 노출하지 않는다.
    query = query.or(`status.eq.진행중,and(status.eq.마감,notice_date.eq.${todayKst})`);
  }

  const { data: noticeRows } = await query;

  const noticeList = noticeRows ?? [];
  if (!noticeList.length) return { store, notices: [] };

  const productIds = [...new Set(noticeList.map((n) => n.product_id).filter((id): id is string => Boolean(id)))];
  const { data: products } = productIds.length
    ? await sb.from("products").select("id, name, tagline, image_url, detail_blocks").in("id", productIds)
    : { data: [] as { id: string; name: string; tagline: string | null; image_url: string | null; detail_blocks: unknown }[] };
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  const noticeIds = noticeList.map((n) => n.id);
  // 세로 플래그는 별도 조회 — 마이그레이션 전이라 컬럼이 없어도 본 화면이 깨지지 않게 오류는 무시한다.
  const { data: portraitRows } = await sb.from("notices").select("id, temp_image_portrait").in("id", noticeIds);
  const portraitById = new Map((portraitRows ?? []).map((r) => [r.id as string, Boolean(r.temp_image_portrait)]));
  const { data: entries } = await sb
    .from("pass_entries")
    .select("notice_id, status, updated_at")
    .in("notice_id", noticeIds)
    .eq("store_id", store.id);
  const entryByNotice = new Map((entries ?? []).map((e) => [e.notice_id, e]));

  const notices: NoticeCard[] = noticeList.map((n) => {
    const entry = entryByNotice.get(n.id);
    const p = n.product_id ? productById.get(n.product_id) : undefined;
    const product: NoticeCard["product"] = p
      ? {
          id: p.id,
          name: p.name,
          tagline: p.tagline,
          image_url: p.image_url,
          detail_image_urls: ((p.detail_blocks ?? []) as { imageUrl?: string }[])
            .map((b) => b.imageUrl)
            .filter((u): u is string => Boolean(u)),
          isTempOnly: false,
        }
      : {
          id: null,
          name: n.temp_name ?? "상품 정보 없음",
          tagline: n.temp_tagline,
          image_url: n.temp_image_url,
          detail_image_urls: [],
          isTempOnly: true,
        };
    return {
      notice: {
        id: n.id,
        status: n.status as NoticeStatus,
        notice_date: n.notice_date,
        badge: (n.badge ?? null) as string | null,
        description: n.description ?? null,
        extraImages: (n.extra_images ?? []) as string[],
        imagePortrait: portraitById.get(n.id) ?? false,
      },
      product,
      passStatus: (entry?.status as PassStatus) ?? "출고",
      updatedAt: entry?.updated_at ?? null,
    };
  });

  return { store, notices };
}

// "HH:MM"(KST 벽시계 기준)이 이미 지났는지 — 서버가 UTC로 돌아도 정확히 비교되도록 +09:00을 명시한다.
function isPastKstTime(hhmm: string): boolean {
  const todayKst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const closeInstant = new Date(`${todayKst}T${hhmm}:00+09:00`);
  return Date.now() > closeInstant.getTime();
}

// 지점의 패스 상태 변경 — 마감 후에는 절대 허용하지 않는다(서버측 강제).
// notice.status만 믿으면 안 된다: 14:00 마감 크론이 아직 안 돌았을 때도(지연·실패 등)
// 실제 시계가 마감 시각을 지났으면 거부해야 한다.
export async function setPassStatus(noticeId: string, storeId: number, status: PassStatus) {
  const sb = createAdminClient();
  const { data: notice, error: noticeErr } = await sb
    .from("notices")
    .select("id, status")
    .eq("id", noticeId)
    .maybeSingle();
  if (noticeErr || !notice) throw new Error("공지를 찾을 수 없습니다.");
  if (notice.status !== "진행중") throw new Error("마감된 공지는 수정할 수 없습니다.");

  const schedule = await getNoticeSchedule();
  if (isPastKstTime(schedule.closeTime)) throw new Error("마감된 공지는 수정할 수 없습니다.");

  const { data, error } = await sb
    .from("pass_entries")
    .upsert(
      { notice_id: noticeId, store_id: storeId, status, updated_at: new Date().toISOString() },
      { onConflict: "notice_id,store_id" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export type PassHistoryItem = {
  noticeId: string;
  noticeDate: string;
  productName: string;
  productImage: string | null;
  passStatus: PassStatus | null;
};

export async function getStorePassHistoryByToken(
  token: string,
  year: number,
  month: number
): Promise<{ storeName: string; items: PassHistoryItem[] } | null> {
  const sb = createAdminClient();

  const { data: store } = await sb
    .from("stores")
    .select("id, name")
    .eq("pass_link_token", token)
    .eq("is_active", true)
    .maybeSingle();
  if (!store) return null;

  const mm = String(month).padStart(2, "0");
  const startDate = `${year}-${mm}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

  const { data: noticeRows } = await sb
    .from("notices")
    .select("id, notice_date, product_id, temp_name, temp_image_url")
    .gte("notice_date", startDate)
    .lte("notice_date", endDate)
    .neq("status", "대기")
    .order("notice_date", { ascending: false });

  const noticeList = noticeRows ?? [];
  if (!noticeList.length) return { storeName: store.name, items: [] };

  const productIds = [...new Set(noticeList.map((n) => n.product_id).filter((id): id is string => Boolean(id)))];
  const { data: products } = productIds.length
    ? await sb.from("products").select("id, name, image_url").in("id", productIds)
    : { data: [] as { id: string; name: string; image_url: string | null }[] };
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  const noticeIds = noticeList.map((n) => n.id);
  const { data: entries } = await sb
    .from("pass_entries")
    .select("notice_id, status")
    .in("notice_id", noticeIds)
    .eq("store_id", store.id);
  const entryByNotice = new Map((entries ?? []).map((e) => [e.notice_id, e.status as PassStatus]));

  const items: PassHistoryItem[] = noticeList.map((n) => {
    const p = n.product_id ? productById.get(n.product_id) : undefined;
    return {
      noticeId: n.id,
      noticeDate: n.notice_date,
      productName: p?.name ?? n.temp_name ?? "상품 정보 없음",
      productImage: p?.image_url ?? n.temp_image_url ?? null,
      passStatus: entryByNotice.get(n.id) ?? null,
    };
  });

  return { storeName: store.name, items };
}

export type DatePassCounts = Record<string, { outbound: number; pass: number }>;

export async function getNoticeDateCounts(storeId: number): Promise<DatePassCounts> {
  const sb = createAdminClient();

  // 전체 공지 날짜 목록
  const { data: notices } = await sb.from("notices").select("id, notice_date");
  // 이 지점의 pass_entries (패스한 것만)
  const { data: entries } = await sb
    .from("pass_entries")
    .select("notice_id, status")
    .eq("store_id", storeId)
    .eq("status", "패스");

  const passSet = new Set((entries ?? []).map((e) => e.notice_id));

  const counts: DatePassCounts = {};
  for (const n of notices ?? []) {
    if (!n.notice_date) continue;
    const cur = counts[n.notice_date] ?? { outbound: 0, pass: 0 };
    if (passSet.has(n.id)) cur.pass += 1;
    else cur.outbound += 1;
    counts[n.notice_date] = cur;
  }
  return counts;
}
