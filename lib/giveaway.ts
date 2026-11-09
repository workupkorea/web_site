// 인스타그램 댓글 추첨기 — 순수 계산 로직 (UI/네트워크와 분리)

export interface GwComment {
  user: string;
  text: string;
  /** ISO 문자열. 직접 붙여넣기 입력이면 없음 */
  ts?: string;
  likes?: number;
  isReply?: boolean;
}

export interface GwOptions {
  minMentions: number;
  keywords: string[]; // 소문자, 모두 포함해야 통과
  exclude: Set<string>; // 소문자 아이디
  /** true: 1인 1회 (중복 제거) / false: 유효 댓글 1개 = 1장의 응모권 */
  dedupe: boolean;
  from?: number; // epoch ms
  to?: number;
  minLength: number;
}

export interface GwAnalysis {
  total: number;
  valid: GwComment[];
  users: Set<string>;
  dropped: { excluded: number; filtered: number; dup: number; outOfRange: number; short: number };
}

export const rand = (n: number): number => {
  if (n <= 1) return 0;
  // 거절 샘플링으로 모듈로 편향 제거
  const lim = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= lim);
  return buf[0] % n;
};

const LINE_RE = /^@?([A-Za-z0-9._]{1,30})(?:\s*[:,\t]\s*|\s+|$)(.*)$/;

/** 줄 단위 "아이디 댓글" 텍스트를 파싱 */
export function parseComments(text: string): GwComment[] {
  const out: GwComment[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(LINE_RE);
    if (m) out.push({ user: m[1], text: (m[2] || "").trim() });
  }
  return out;
}

export const mentionsOf = (text: string, self: string): Set<string> =>
  new Set(
    (text.match(/@[A-Za-z0-9._]+/g) || [])
      .map((s) => s.toLowerCase())
      .filter((s) => s.slice(1) !== self.toLowerCase()),
  );

export const hashtagsOf = (text: string): string[] =>
  (text.match(/#[^\s#@.,!?]+/g) || []).map((s) => s.toLowerCase());

export function analyze(rows: GwComment[], o: GwOptions): GwAnalysis {
  const dropped = { excluded: 0, filtered: 0, dup: 0, outOfRange: 0, short: 0 };
  const valid: GwComment[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const u = r.user.toLowerCase();
    if (o.exclude.has(u)) {
      dropped.excluded++;
      continue;
    }
    if (r.ts && (o.from !== undefined || o.to !== undefined)) {
      const t = Date.parse(r.ts);
      if (!Number.isNaN(t) && ((o.from !== undefined && t < o.from) || (o.to !== undefined && t > o.to))) {
        dropped.outOfRange++;
        continue;
      }
    }
    if (o.minLength > 0 && r.text.replace(/\s/g, "").length < o.minLength) {
      dropped.short++;
      continue;
    }
    const low = r.text.toLowerCase();
    if (mentionsOf(r.text, u).size < o.minMentions || !o.keywords.every((k) => low.includes(k))) {
      dropped.filtered++;
      continue;
    }
    if (o.dedupe) {
      if (seen.has(u)) {
        dropped.dup++;
        continue;
      }
      seen.add(u);
    }
    valid.push(r);
  }
  return { total: rows.length, valid, users: new Set(valid.map((r) => r.user.toLowerCase())), dropped };
}

export interface GwPick {
  comment: GwComment;
  role: "winner" | "backup";
  /** 1부터 시작하는 당첨/예비 번호 */
  no: number;
}

/**
 * 추첨. 한 사람이 여러 번 뽑히지 않도록 뽑힌 사람의 응모권은 풀에서 모두 제거한다.
 * (응모권 방식이면 댓글이 많은 사람이 더 유리하다)
 */
export function drawPicks(valid: GwComment[], winners: number, backups: number): GwComment[] {
  let pool = valid.slice();
  const picked: GwComment[] = [];
  while (picked.length < winners + backups && pool.length) {
    const w = pool[rand(pool.length)];
    picked.push(w);
    const u = w.user.toLowerCase();
    pool = pool.filter((r) => r.user.toLowerCase() !== u);
  }
  return picked;
}

/** 당첨 취소 시 다음 후보를 풀에서 한 명 더 뽑는다 (이미 뽑힌 사람 제외) */
export function drawOne(valid: GwComment[], taken: Set<string>): GwComment | null {
  const pool = valid.filter((r) => !taken.has(r.user.toLowerCase()));
  return pool.length ? pool[rand(pool.length)] : null;
}

// ── 마케팅 분석 지표 ────────────────────────────────────────────────────────
export interface GwInsights {
  users: number;
  comments: number;
  avgMentions: number;
  /** 서로 다른 멘션 계정 수 = 도달(추정) */
  uniqueMentioned: number;
  totalLikes: number;
  hourly: number[]; // 0~23시 댓글 수
  daily: { date: string; count: number }[];
  topCommenters: { user: string; count: number }[];
  topTags: { tag: string; count: number }[];
  hasTime: boolean;
}

export function insights(rows: GwComment[]): GwInsights {
  const hourly = new Array(24).fill(0) as number[];
  const dayMap = new Map<string, number>();
  const userMap = new Map<string, number>();
  const tagMap = new Map<string, number>();
  const mentioned = new Set<string>();
  let mentionSum = 0;
  let likes = 0;
  let hasTime = false;
  for (const r of rows) {
    const u = r.user.toLowerCase();
    userMap.set(u, (userMap.get(u) || 0) + 1);
    const ms = mentionsOf(r.text, u);
    mentionSum += ms.size;
    ms.forEach((m) => mentioned.add(m));
    hashtagsOf(r.text).forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));
    likes += r.likes || 0;
    if (r.ts) {
      const d = new Date(r.ts);
      if (!Number.isNaN(d.getTime())) {
        hasTime = true;
        hourly[d.getHours()]++;
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        dayMap.set(k, (dayMap.get(k) || 0) + 1);
      }
    }
  }
  const top = <T extends string>(m: Map<T, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    users: userMap.size,
    comments: rows.length,
    avgMentions: rows.length ? mentionSum / rows.length : 0,
    uniqueMentioned: mentioned.size,
    totalLikes: likes,
    hourly,
    daily: [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count })),
    topCommenters: top(userMap, 5).map(([user, count]) => ({ user, count })),
    topTags: top(tagMap, 8).map(([tag, count]) => ({ tag, count })),
    hasTime,
  };
}

// ── 검증용 해시 / 내보내기 ──────────────────────────────────────────────────
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 응모자 명단(정렬된 아이디 목록)의 지문. 추첨 직후 기록해 두면 명단이 바뀌지 않았음을 증명할 수 있다. */
export const participantsFingerprint = (valid: GwComment[]): Promise<string> =>
  sha256Hex(
    valid
      .map((r) => r.user.toLowerCase())
      .sort()
      .join("\n"),
  );

const csvCell = (v: string | number | undefined) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (header: string[], rows: (string | number | undefined)[][]): string =>
  "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Instagram Graph API ────────────────────────────────────────────────────
export const shortcodeOf = (u: string): string | null => {
  const m = (u || "").match(/instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
};

interface ApiOpts {
  base: string;
  token: string;
}

const nextPathOf = (u: string): string => {
  const x = new URL(u);
  x.searchParams.delete("access_token");
  return x.pathname.replace(/^\/v[\d.]+/, "") + x.search;
};

async function api(o: ApiOpts, path: string) {
  const r = await fetch(`${o.base}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(o.token)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `요청 실패 (${r.status})`);
  return j as {
    data?: Record<string, unknown>[];
    paging?: { next?: string };
  };
}

/** Facebook 토큰에 연결된 인스타그램 비즈니스 계정 ID 찾기 (페이지 토큰 → 사용자 토큰 순) */
async function discoverIgId(o: ApiOpts): Promise<string> {
  const idOf = (x: unknown) => String((x as { instagram_business_account?: { id?: string } })?.instagram_business_account?.id || "");
  try {
    const me = (await api(o, "/me?fields=instagram_business_account")) as unknown;
    if (idOf(me)) return idOf(me);
  } catch {
    /* 사용자 토큰이면 아래 /me/accounts 로 */
  }
  const j = await api(o, "/me/accounts?fields=name,instagram_business_account&limit=50");
  const hit = (j.data || []).find((p) => idOf(p));
  if (hit) return idOf(hit);
  throw new Error("이 토큰에 연결된 인스타그램 비즈니스 계정을 찾지 못했습니다. IG_GIVEAWAY_ACCOUNT_ID에 계정 숫자 ID를 직접 넣어 주세요.");
}

export interface FetchArgs {
  url: string;
  token: string;
  igId?: string;
  includeReplies: boolean;
  onProgress: (msg: string) => void;
}

/** 토큰·계정 ID로 호출 설정(base, 계정 ID)을 정한다. EAA 토큰은 연결된 인스타 계정을 자동으로 찾는다. */
async function resolveAccount(tokenIn: string, igIdIn: string | undefined, onProgress: (m: string) => void) {
  let igId = (igIdIn || "").trim();
  const token = tokenIn.trim();
  if (!token) throw new Error("액세스 토큰을 입력해 주세요.");
  // Facebook 로그인 방식 토큰(EAA…)은 graph.instagram.com에서 거부되므로, 계정 ID가 없으면 연결된 인스타 계정을 찾아 쓴다.
  if (!igId && token.startsWith("EAA")) {
    onProgress("연결된 인스타그램 계정 찾는 중…");
    igId = await discoverIgId({ base: "https://graph.facebook.com/v21.0", token });
  }
  const o: ApiOpts = {
    base: igId ? "https://graph.facebook.com/v21.0" : "https://graph.instagram.com/v21.0",
    token,
  };
  return { o, igId };
}

export interface GwMedia {
  id: string;
  permalink: string;
  caption: string;
  timestamp?: string;
  thumb?: string;
  comments?: number;
  likes?: number;
}

/** 계정의 최근 게시물 목록 (추첨할 게시물을 고르기 위함). 기본 최근 30개. */
export async function listInstagramMedia(a: { token: string; igId?: string; limit?: number; onProgress?: (m: string) => void }): Promise<GwMedia[]> {
  const { o, igId } = await resolveAccount(a.token, a.igId, a.onProgress || (() => {}));
  const want = Math.min(Math.max(a.limit || 30, 1), 100);
  const base = igId ? `/${encodeURIComponent(igId)}` : "/me";
  const fieldSets = [
    "id,permalink,caption,timestamp,thumbnail_url,media_url,comments_count,like_count",
    "id,permalink,caption,timestamp",
  ];
  let lastErr: unknown = null;
  for (const fields of fieldSets) {
    try {
      const j = await api(o, `${base}/media?fields=${encodeURIComponent(fields)}&limit=${want}`);
      return (j.data || []).slice(0, want).map((m) => ({
        id: String(m.id),
        permalink: String(m.permalink || ""),
        caption: String(m.caption || ""),
        timestamp: m.timestamp ? String(m.timestamp) : undefined,
        thumb: String(m.thumbnail_url || m.media_url || "") || undefined,
        comments: typeof m.comments_count === "number" ? m.comments_count : undefined,
        likes: typeof m.like_count === "number" ? m.like_count : undefined,
      }));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("게시물 목록을 불러오지 못했습니다.");
}

export async function fetchInstagramComments(a: FetchArgs): Promise<GwComment[]> {
  const code = shortcodeOf(a.url.trim());
  if (!code) throw new Error("게시물 주소를 확인해 주세요. (instagram.com/p/…, /reel/… 형식)");
  const { o, igId } = await resolveAccount(a.token, a.igId, a.onProgress);

  // 1) 내 미디어 목록에서 shortcode가 일치하는 게시물 찾기
  let mediaId: string | null = null;
  let next: string | null = `${igId ? "/" + encodeURIComponent(igId) : "/me"}/media?fields=id,permalink&limit=100`;
  let pages = 0;
  while (next && !mediaId && pages < 50) {
    a.onProgress(`게시물 찾는 중… (${++pages})`);
    const j = await api(o, next);
    const hit = (j.data || []).find((m) => shortcodeOf(String(m.permalink || "")) === code);
    mediaId = hit ? String(hit.id) : null;
    next = j.paging?.next ? nextPathOf(j.paging.next) : null;
  }
  if (!mediaId) throw new Error("토큰 계정의 게시물 중에서 이 주소를 찾지 못했습니다. 본인 계정의 게시물인지 확인해 주세요.");

  // 2) 댓글(+대댓글, 시간, 좋아요) 읽기. 필드 오류 시 기본 필드로 한 번 재시도
  const fieldSets = [
    a.includeReplies
      ? "username,text,timestamp,like_count,replies{username,text,timestamp,like_count}"
      : "username,text,timestamp,like_count",
    "username,text,timestamp",
    "username,text",
  ];
  let lastErr: unknown = null;
  for (const fields of fieldSets) {
    try {
      const out: GwComment[] = [];
      let n: string | null = `/${mediaId}/comments?fields=${encodeURIComponent(fields)}&limit=100`;
      let cp = 0;
      while (n) {
        const j = await api(o, n);
        for (const c of j.data || []) {
          const push = (x: Record<string, unknown>, isReply: boolean) => {
            if (!x.username) return;
            out.push({
              user: String(x.username),
              text: String(x.text || "").replace(/\s+/g, " "),
              ts: x.timestamp ? String(x.timestamp) : undefined,
              likes: typeof x.like_count === "number" ? x.like_count : undefined,
              isReply,
            });
          };
          push(c, false);
          const rep = (c.replies as { data?: Record<string, unknown>[] } | undefined)?.data;
          if (a.includeReplies && rep) rep.forEach((r) => push(r, true));
        }
        a.onProgress(`댓글 읽는 중… ${out.length}개 (${++cp})`);
        n = j.paging?.next ? nextPathOf(j.paging.next) : null;
      }
      return out;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("댓글을 불러오지 못했습니다.");
}

// ── 브라우저 연출/시각 유틸 (컴포넌트 렌더 규칙 밖에 두기 위해 lib로 분리) ─────────
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 기록용 ID와 한국어 시각 문자열 */
export const stampNow = () => ({ id: String(Date.now()), at: new Date().toLocaleString("ko-KR") });

/** 이름이 빠르게 바뀌다가 점점 느려지는 룰렛 연출 (마지막 이름은 호출한 쪽에서 확정) */
export async function rollNames(names: string[], duration: number, onName: (name: string) => void) {
  const start = performance.now();
  let delay = 40;
  while (performance.now() - start < duration) {
    onName(names[rand(names.length)]);
    await sleep(delay);
    delay = Math.min(delay * 1.07, 230);
  }
}

/** 캔버스 꽃가루 효과 (약 2.2초). 모션 축소 설정이면 실행하지 않는다. */
export function runConfetti(cv: HTMLCanvasElement | null) {
  if (!cv || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const w = (cv.width = cv.offsetWidth);
  const h = (cv.height = cv.offsetHeight);
  const colors = ["#E5541B", "#303236", "#f59e0b", "#10b981", "#3b82f6", "#ec4899"];
  const ps = Array.from({ length: 90 }, () => ({
    x: w / 2 + (Math.random() - 0.5) * 120,
    y: h * 0.35,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 11 - 3,
    s: 4 + Math.random() * 5,
    c: colors[Math.floor(Math.random() * colors.length)],
    r: Math.random() * 6,
  }));
  const t0 = performance.now();
  const tick = (now: number) => {
    const t = now - t0;
    ctx.clearRect(0, 0, w, h);
    for (const p of ps) {
      p.vy += 0.32;
      p.x += p.vx;
      p.y += p.vy;
      p.r += 0.2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - t / 2200);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx.restore();
    }
    if (t < 2200) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, w, h);
  };
  requestAnimationFrame(tick);
}
