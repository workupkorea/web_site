"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import GiveawayClaimPanel from "./GiveawayClaimPanel";
import {
  analyze,
  downloadText,
  drawOne,
  drawPicks,
  fetchInstagramComments,
  insights,
  listInstagramMedia,
  parseComments,
  participantsFingerprint,
  rollNames,
  runConfetti,
  sleep,
  stampNow,
  toCsv,
  type GwComment,
  type GwMedia,
  type GwOptions,
} from "@/lib/giveaway";

const HISTORY_KEY = "workup_giveaway_history_v1";
const SAMPLE = [
  "minji_01 @friend1 @friend2 이벤트 참여해요! #이벤트",
  "jun.park: @sujin 같이 가고 싶어요 #이벤트",
  "@dahye99, 당첨되고 싶어요 #이벤트 @eunji",
  "haru_day @mina @yuri 너무 가고 싶어요 #이벤트",
  "sora.kim 참여합니다",
  "minji_01 @friend3 한 번 더 참여! #이벤트",
  "workup_official_kr 감사합니다 :)",
  "tae_yang @bomi @sena @ari #이벤트 응원해요",
  "nari_0412 @hyun 신청합니다 #이벤트",
  "gaon.lee @doyun #이벤트 꼭 되고 싶어요",
].join("\n");

/** 상품과 당첨 인원 (상품별로 몇 명을 뽑을지) */
interface Prize {
  id: string;
  name: string;
  count: number;
}

interface ResultItem {
  comment: GwComment;
  role: "winner" | "backup";
  label: string;
  /** 이 당첨자가 받는 상품 (예비는 승급될 때 배정) */
  prize: string;
  status: "ok" | "void";
  note?: string;
  /** 팔로우 확인 완료 여부 (인스타 API로는 확인 불가 → 수동 체크) */
  followOk: boolean;
  /** 취소·교체된 항목이 되돌릴 수 있도록, 누가 이 자리를 대신 맡았는지 기록 */
  link?: { kind: "promote" | "extra" | "replace" | "none"; user: string; flagged?: boolean };
  /** 승급·추가·교체로 이 사람이 차지한 원래 당첨 자리 이름(상품 순번). 확정할 때 라벨로 사용한다. */
  slot?: string;
}

interface DrawRecord {
  id: string;
  at: string;
  /** 이벤트 이름 (이력 관리용). 옛 기록에는 없음 */
  eventName?: string;
  postUrl: string;
  participants: number;
  validComments: number;
  fingerprint: string;
  conditions: string;
  prizes?: { name: string; count: number }[];
  winners: { label: string; prize?: string; user: string; status: string; followOk?: boolean; note?: string }[];
  /** 추첨 당시 참여자 명단이 서버에 저장돼 있는지 (옛 기록은 없음) */
  hasDetail?: boolean;
}

/** 이벤트 상세(추첨 당시 참여자·댓글) */
interface EventDetail {
  savedAt?: string;
  totalComments?: number;
  participants: { user: string; text: string; ts?: string; likes?: number; isReply?: boolean }[];
}

/** 참여자 표시: 팔로우 안 하고 참여한 사람 / 체리피커(경품만 노리는 사람) */
interface UserFlag {
  user: string;
  cherry: boolean;
  noFollow: boolean;
  /** 비팔로우로 표시된 이벤트 이름들 */
  events: string[];
  at: string;
}
type Flags = Record<string, UserFlag>;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const igUrl = (u: string) => `https://www.instagram.com/${encodeURIComponent(u)}/`;

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const fmt = (n: number) => n.toLocaleString("ko-KR");

export default function GiveawayTab() {
  // ── 입력 ────────────────────────────────────────────────────────────────
  const [url, setUrl] = useState("");
  const [igId, setIgId] = useState("");
  const [token, setToken] = useState("");
  const [includeReplies, setIncludeReplies] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");
  const [source, setSource] = useState<"api" | "paste">("paste");
  const [apiRows, setApiRows] = useState<GwComment[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  // 서버(Vercel 환경변수)에 토큰이 있으면 입력 없이 불러온다. null = 확인 중
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [manualToken, setManualToken] = useState(false);
  const useServer = serverReady === true && !manualToken;

  // 최근 게시물에서 선택
  const [mediaList, setMediaList] = useState<GwMedia[] | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaMsg, setMediaMsg] = useState("");

  // ── 이벤트 · 상품 ────────────────────────────────────────────────────────
  const [eventName, setEventName] = useState("");
  const [prizes, setPrizes] = useState<Prize[]>([{ id: "p1", name: "경품", count: 3 }]);
  const winnersN = prizes.reduce((a, p) => a + clamp(Number(p.count) || 0, 0, 100), 0);

  // ── 조건 ────────────────────────────────────────────────────────────────
  const [backupsN, setBackupsN] = useState(2);
  const [excludeCherry, setExcludeCherry] = useState(true);
  const [excludeNoFollow, setExcludeNoFollow] = useState(false);
  const [minMentions, setMinMentions] = useState(0);
  const [keywords, setKeywords] = useState("");
  const [exclude, setExclude] = useState("workup_official_kr");
  const [dedupe, setDedupe] = useState(true);
  const [minLength, setMinLength] = useState(0);
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");

  // ── 추첨 ────────────────────────────────────────────────────────────────
  const [drawing, setDrawing] = useState(false);
  const [stageLabel, setStageLabel] = useState("");
  const [stageName, setStageName] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [msg, setMsg] = useState("");
  const [record, setRecord] = useState<DrawRecord | null>(null);
  const [history, setHistory] = useState<DrawRecord[]>([]);
  const [flags, setFlags] = useState<Flags>({});
  const stateRef = useRef<{ history: DrawRecord[]; flags: Flags }>({ history: [], flags: {} });
  /** 추첨 시점의 명단·조건 스냅샷. 확정할 때 이 값으로 기록을 만든다(그 사이 조건을 바꿔도 추첨 당시 값 유지). */
  const drawSnap = useRef<{
    stamp: { id: string; at: string };
    postUrl: string;
    participants: number;
    validComments: number;
    fingerprint: string;
    conditions: string;
    prizes: { name: string; count: number }[];
    valid: GwComment[];
    total: number;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  // 당첨자 교체: 교체 입력을 열어 둔 행 번호와 입력값
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);
  const [replaceInput, setReplaceInput] = useState("");
  const [flagQuery, setFlagQuery] = useState("");
  const [flagAdd, setFlagAdd] = useState("");
  const [stateMsg, setStateMsg] = useState("");
  const [histQuery, setHistQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [expandId, setExpandId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailQuery, setDetailQuery] = useState("");
  const [copied, setCopied] = useState("");
  const confettiRef = useRef<HTMLCanvasElement>(null);

  // 아이디별 과거 당첨 횟수 — 이력(서버 저장)에서 집계. 지금 진행 중인 추첨 건은 제외해 "이전" 횟수만 센다.
  // 확정된 당첨자만 센다: 예비 번호는 승급된 경우만, 취소·미팔로우로 빠진 사람은 제외.
  const winCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of history) {
      if (h.id === record?.id) continue;
      for (const w of h.winners) {
        const won = w.status === "확정" && (!w.label.startsWith("예비") || (w.note || "").includes("승급"));
        if (won) m.set(w.user.toLowerCase(), (m.get(w.user.toLowerCase()) || 0) + 1);
      }
    }
    return m;
  }, [history, record]);
  const winBadge = (user: string) => {
    const n = winCounts.get(user.toLowerCase()) || 0;
    return n > 0 ? (
      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-bold shrink-0 whitespace-nowrap" title="이전 이벤트에서 당첨된 횟수">
        {n}회 당첨
      </span>
    ) : null;
  };

  const rows = useMemo<GwComment[]>(() => (source === "api" ? apiRows : parseComments(pasteText)), [source, apiRows, pasteText]);

  const opts = useMemo<GwOptions>(
    () => ({
      minMentions: clamp(minMentions || 0, 0, 20),
      keywords: keywords
        .split(/[,\n]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      exclude: new Set([
        ...exclude
          .split(/[\s,]+/)
          .map((s) => s.replace(/^@/, "").toLowerCase())
          .filter(Boolean),
        // 체리피커·비팔로우 이력자 자동 제외 (표시 목록 기준)
        ...Object.values(flags)
          .filter((f) => (excludeCherry && f.cherry) || (excludeNoFollow && f.noFollow))
          .map((f) => f.user.toLowerCase()),
      ]),
      dedupe,
      from: fromStr ? Date.parse(fromStr) : undefined,
      to: toStr ? Date.parse(toStr) : undefined,
      minLength: clamp(minLength || 0, 0, 500),
    }),
    [minMentions, keywords, exclude, dedupe, fromStr, toStr, minLength, flags, excludeCherry, excludeNoFollow],
  );

  const an = useMemo(() => analyze(rows, opts), [rows, opts]);
  const ins = useMemo(() => insights(rows), [rows]);
  const maxHour = Math.max(1, ...ins.hourly);
  const maxDay = Math.max(1, ...ins.daily.map((d) => d.count));

  useEffect(() => {
    fetch("/api/admin/giveaway/comments")
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((j) => setServerReady(!!j.configured))
      .catch(() => setServerReady(false));
  }, []);

  // 추첨 이력·표시 목록은 서버(site_settings.giveaway_state)에 저장 → PC가 달라도 같은 이력을 본다. 토큰은 저장하지 않는다.
  const persist = useCallback(async (h: DrawRecord[], f: Flags) => {
    try {
      const r = await fetch("/api/admin/giveaway/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: h, flags: f }),
      });
      setStateMsg(r.ok ? "" : "서버 저장 실패 — 새로고침하면 변경이 사라질 수 있습니다.");
    } catch {
      setStateMsg("서버 저장 실패 — 네트워크를 확인해 주세요.");
    }
  }, []);
  useEffect(() => {
    fetch("/api/admin/giveaway/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        let h: DrawRecord[] = Array.isArray(j?.history) ? j.history : [];
        const f: Flags = j?.flags && typeof j.flags === "object" ? j.flags : {};
        // 예전에 브라우저(localStorage)에만 있던 이력은 서버가 비어 있을 때 한 번 옮긴다.
        if (!h.length) {
          try {
            const raw = localStorage.getItem(HISTORY_KEY);
            if (raw) h = JSON.parse(raw);
            if (h.length) void persist(h, f);
          } catch {
            /* 무시 */
          }
        }
        stateRef.current = { history: h, flags: f };
        setHistory(h);
        setFlags(f);
      })
      .catch(() => setStateMsg("이력을 불러오지 못했습니다."));
  }, [persist]);
  const saveHistory = useCallback(
    (h: DrawRecord[]) => {
      stateRef.current.history = h;
      setHistory(h);
      void persist(h, stateRef.current.flags);
    },
    [persist],
  );
  const saveFlags = useCallback(
    (f: Flags) => {
      stateRef.current.flags = f;
      setFlags(f);
      void persist(stateRef.current.history, f);
    },
    [persist],
  );
  /** 표시 켜기/끄기. 둘 다 꺼지면 목록에서 제거 */
  const toggleFlag = (user: string, kind: "cherry" | "noFollow", event?: string) => {
    const key = user.toLowerCase();
    const cur: UserFlag = stateRef.current.flags[key] ?? { user, cherry: false, noFollow: false, events: [], at: new Date().toLocaleString("ko-KR") };
    const next: UserFlag = { ...cur, [kind]: !cur[kind] };
    if (kind === "noFollow") next.events = next.noFollow ? (event ? [...new Set([...cur.events, event])] : cur.events) : [];
    const all = { ...stateRef.current.flags };
    if (!next.cherry && !next.noFollow) delete all[key];
    else all[key] = next;
    saveFlags(all);
  };
  /** 이력에서 이벤트 상세(추첨 당시 참여자 명단) 열기 */
  const openDetail = async (h: DrawRecord) => {
    if (openId === h.id) {
      setOpenId(null);
      return;
    }
    setOpenId(h.id);
    setDetail(null);
    setDetailQuery("");
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/admin/giveaway/event/${h.id}`);
      setDetail(r.ok ? ((await r.json()) as EventDetail) : { participants: [] });
    } catch {
      setDetail({ participants: [] });
    } finally {
      setDetailLoading(false);
    }
  };
  const deleteEvent = async (h: DrawRecord) => {
    if (!confirm(`"${h.eventName || "이벤트"}" 기록을 삭제할까요? 참여자 명단도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    saveHistory(stateRef.current.history.filter((x) => x.id !== h.id));
    if (openId === h.id) setOpenId(null);
    if (expandId === h.id) setExpandId(null);
    try {
      await fetch(`/api/admin/giveaway/event/${h.id}`, { method: "DELETE" });
    } catch {
      /* 요약은 이미 삭제됨 — 상세만 남을 수 있음 */
    }
  };
  const flagCount = (k: "cherry" | "noFollow") => Object.values(flags).filter((f) => f[k]).length;

  // 최근 게시물 목록 (선택해서 불러오기)
  const loadMedia = async () => {
    setMediaLoading(true);
    setMediaMsg("");
    try {
      let list: GwMedia[];
      if (useServer) {
        const r = await fetch("/api/admin/giveaway/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "media" }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `요청 실패 (${r.status})`);
        list = j.media as GwMedia[];
      } else {
        list = await listInstagramMedia({ token, igId, limit: 30, onProgress: setMediaMsg });
      }
      setMediaList(list);
      setMediaMsg(list.length ? "" : "게시물이 없습니다.");
    } catch (e) {
      setMediaMsg("목록 불러오기 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setMediaLoading(false);
    }
  };
  const pickMedia = (m: GwMedia) => {
    setUrl(m.permalink);
    if (!eventName.trim()) setEventName(m.caption.split("\n")[0].trim().slice(0, 40));
    setMediaList(null);
  };

  // ── 댓글 불러오기 ────────────────────────────────────────────────────────
  const load = async () => {
    setFetching(true);
    setFetchMsg("");
    try {
      let list: GwComment[];
      if (useServer) {
        setFetchMsg("서버에서 댓글을 읽는 중… (댓글이 많으면 시간이 걸립니다)");
        const r = await fetch("/api/admin/giveaway/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, includeReplies }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `요청 실패 (${r.status})`);
        list = j.comments as GwComment[];
      } else {
        list = await fetchInstagramComments({ url, token, igId, includeReplies, onProgress: setFetchMsg });
      }
      setApiRows(list);
      setSource("api");
      setResults([]);
      setRecord(null);
      setFetchMsg(`댓글 ${fmt(list.length)}개를 불러왔습니다.`);
    } catch (e) {
      setFetchMsg("불러오기 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setFetching(false);
    }
  };

  const confetti = () => runConfetti(confettiRef.current);

  // ── 추첨 ────────────────────────────────────────────────────────────────
  const conditionText = () =>
    [
      `상품: ${prizes.map((p) => `${p.name.trim() || "상품"} ${clamp(Number(p.count) || 0, 0, 100)}명`).join(", ")} / 예비 ${backupsN}명`,
      dedupe ? "1인 1회" : "댓글당 응모권",
      opts.minMentions ? `멘션 ${opts.minMentions}명 이상` : "",
      opts.keywords.length ? `키워드: ${opts.keywords.join(", ")}` : "",
      opts.exclude.size ? `제외: ${[...opts.exclude].join(", ")}` : "",
      fromStr || toStr ? `기간: ${fromStr || "처음"} ~ ${toStr || "끝"}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

  const eventTitle = () => eventName.trim() || `이벤트 ${new Date().toLocaleDateString("ko-KR")}`;

  /**
   * 확정용 정리 — 취소·교체된 사람은 제거하고, 승급·추가로 들어온 사람은 원래 당첨 자리 이름을 이어받으며,
   * "대체·승급" 같은 변경 내역(비고·연결 정보)은 남기지 않는다.
   */
  const finalizeItems = (items: ResultItem[]): ResultItem[] =>
    items
      .filter((r) => r.status === "ok")
      .map((r) => {
        const promoted = r.role === "winner" && (r.label.startsWith("예비") || r.label.startsWith("추가"));
        return { ...r, label: promoted ? r.slot ?? r.label : r.label, note: undefined, link: undefined };
      });

  /** 추첨 기록 생성. 이미 있는 기록을 갱신할 때(팔로우 확인·대체)는 추첨 당시의 명단 지문·조건을 그대로 둔다. */
  const makeRecord = async (items: ResultItem[], prev?: DrawRecord | null): Promise<DrawRecord> => {
    const winners = items.map((i) => ({
      label: i.label,
      prize: i.prize,
      user: i.comment.user,
      status: i.status === "void" ? "취소" : "확정",
      followOk: i.followOk,
      note: i.note,
    }));
    if (prev) return { ...prev, winners };
    const snap = drawSnap.current;
    if (!snap) throw new Error("추첨 결과가 없습니다.");
    return {
      id: stampNow().id,
      at: snap.stamp.at,
      eventName: eventTitle(),
      postUrl: snap.postUrl,
      participants: snap.participants,
      validComments: snap.validComments,
      fingerprint: snap.fingerprint,
      conditions: snap.conditions,
      prizes: snap.prizes,
      winners,
    };
  };

  /**
   * 결과 반영. 확정 전(prev 없음)에는 화면에만 반영하고 저장하지 않는다.
   * 이미 확정된 기록이 있으면(prev) 변경 내용을 그 기록에 갱신해 서버에 저장한다.
   */
  const commit = async (items: ResultItem[], prev: DrawRecord | null) => {
    // 확정된 기록은 취소·교체·미팔로우로 빠진 내역을 남기지 않는다(현재 당첨자만 유지).
    const kept = prev ? finalizeItems(items) : items;
    setResults(kept);
    if (!prev) return;
    const rec = await makeRecord(kept, prev);
    setRecord(rec);
    saveHistory([rec, ...stateRef.current.history.filter((h) => h.id !== rec.id)].slice(0, 200));
  };

  /** 당첨 확정 — 이 시점에 이력(서버 DB)과 당첨 횟수에 반영된다. 추첨 당시 참여자 명단도 함께 저장한다. */
  const confirmDraw = async () => {
    const snap = drawSnap.current;
    if (!snap || record || confirming) return;
    setConfirming(true);
    try {
      // 확정하면 남은 당첨자는 모두 팔로우 확인 처리한다(미팔로우는 확정 전에 "미팔로우→예비"로 빼 둔 상태).
      // 취소·교체·미팔로우로 빠진 내역은 지우고 최종 당첨자만 남긴다.
      const finalItems = finalizeItems(results.map((r) => (r.status === "ok" && r.role === "winner" ? { ...r, followOk: true } : r)));
      const rec = await makeRecord(finalItems, null);
      setResults(finalItems);
      try {
        const r = await fetch(`/api/admin/giveaway/event/${rec.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalComments: snap.total,
            participants: snap.valid.map((c) => ({ user: c.user, text: c.text, ts: c.ts, likes: c.likes, isReply: c.isReply })),
          }),
        });
        rec.hasDetail = r.ok;
      } catch {
        rec.hasDetail = false;
      }
      setRecord(rec);
      saveHistory([rec, ...stateRef.current.history].slice(0, 200));
    } finally {
      setConfirming(false);
    }
  };

  const draw = async () => {
    if (drawing) return;
    if (results.length > 0 && !record && !confirm("확정하지 않은 추첨 결과가 사라집니다. 다시 추첨할까요?")) return;
    setMsg("");
    if (!an.users.size) {
      setMsg("조건을 만족하는 참여자가 없습니다. 댓글이나 조건을 확인해 주세요.");
      return;
    }
    // 상품별 당첨 자리 펼치기 (예: 에코백 2명 → "에코백 1", "에코백 2")
    const slots = prizes.flatMap((pz) => {
      const n = clamp(Number(pz.count) || 0, 0, 100);
      const nm = pz.name.trim() || "상품";
      return Array.from({ length: n }, (_, k) => ({ prize: nm, label: n > 1 ? `${nm} ${k + 1}` : nm }));
    });
    if (!slots.length) {
      setMsg("상품과 당첨 인원을 1명 이상 설정해 주세요.");
      return;
    }
    const nW = slots.length;
    const nB = clamp(backupsN || 0, 0, 100);
    const picked = drawPicks(an.valid, nW, nB);
    if (picked.length < nW + nB) setMsg(`참여자가 ${an.users.size}명뿐이라 ${picked.length}명만 추첨했습니다.`);

    setDrawing(true);
    setResults([]);
    setRecord(null);
    const names = [...new Set(an.valid.map((r) => r.user))];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = picked.length <= 5 ? 1800 : picked.length <= 20 ? 800 : 300;
    const items: ResultItem[] = [];

    for (let i = 0; i < picked.length; i++) {
      const isBackup = i >= nW;
      const label = isBackup ? `예비 ${i - nW + 1}` : slots[i].label;
      setStageLabel(`${label} 추첨 중…`);
      if (!reduced && names.length > 1) {
        await rollNames(names, dur, (n) => setStageName("@" + n));
      }
      setStageName("@" + picked[i].user);
      await sleep(reduced ? 0 : 320);
      items.push({ comment: picked[i], role: isBackup ? "backup" : "winner", label, prize: isBackup ? "" : slots[i].prize, status: "ok", followOk: false });
      setResults([...items]);
    }

    setStageLabel("추첨 완료");
    setStageName(`당첨 ${Math.min(nW, picked.length)}명 · 확정 전`);
    drawSnap.current = {
      stamp: stampNow(),
      postUrl: url.trim(),
      participants: an.users.size,
      validComments: an.valid.length,
      fingerprint: await participantsFingerprint(an.valid),
      conditions: conditionText(),
      prizes: prizes.map((pz) => ({ name: pz.name.trim() || "상품", count: clamp(Number(pz.count) || 0, 0, 100) })),
      valid: an.valid,
      total: an.total,
    };
    await commit(items, null);
    setDrawing(false);
    confetti();
  };

  /** 비팔로우 참여자로 표시 (이미 표시돼 있으면 그대로 둔다) */
  const markNoFollow = (user: string) => {
    if (!stateRef.current.flags[user.toLowerCase()]?.noFollow) toggleFlag(user, "noFollow", eventTitle());
  };

  /**
   * 당첨 취소 → 예비 승급(상품 승계), 예비가 없으면 한 명 더 추첨.
   * reason "nofollow": 팔로우하지 않고 참여한 경우 — 비팔로우 참여자 목록에도 자동 등록한다.
   */
  const voidWinner = async (idx: number, reason: "cancel" | "nofollow" = "cancel") => {
    const items = results.map((r) => ({ ...r }));
    const target = items[idx];
    if (!target || target.status === "void") return;
    const why = reason === "nofollow" ? "미팔로우" : "취소";
    target.status = "void";
    target.note = reason === "nofollow" ? "팔로우 미이행" : "당첨 취소";
    // 비팔로우 표시를 이번에 새로 켰는지 기억해 두었다가 되돌릴 때 같이 해제한다.
    const newlyFlagged = reason === "nofollow" && !stateRef.current.flags[target.comment.user.toLowerCase()]?.noFollow;
    if (reason === "nofollow") markNoFollow(target.comment.user);
    const promote = items.find((r) => r.role === "backup" && r.status === "ok");
    target.link = { kind: "none", user: "", flagged: newlyFlagged };
    if (promote) {
      promote.role = "winner";
      promote.prize = target.prize;
      promote.slot = target.slot ?? target.label;
      promote.note = `${target.label} ${why}로 승급`;
      target.link = { kind: "promote", user: promote.comment.user, flagged: newlyFlagged };
    } else {
      const taken = new Set(items.map((r) => r.comment.user.toLowerCase()));
      const extra = drawOne(an.valid, taken);
      if (extra) {
        items.push({ comment: extra, role: "winner", label: `추가 ${items.filter((r) => r.label.startsWith("추가")).length + 1}`, prize: target.prize, slot: target.slot ?? target.label, status: "ok", followOk: false, note: `${target.label} ${why}로 추가 추첨` });
        target.link = { kind: "extra", user: extra.user, flagged: newlyFlagged };
      } else setMsg("더 뽑을 참여자가 없습니다.");
    }
    await commit(items, record);
  };

  /**
   * 특정 당첨자를 다른 아이디로 교체. 같은 순번·상품 자리를 그대로 이어받고, 원래 사람은 "교체"로 취소 처리된다.
   * userIn 이 있으면 그 아이디로(참여자 명단에서 고르거나 직접 입력), 없으면 남은 참여자 중 무작위로 뽑는다.
   */
  const replaceWinner = async (idx: number, userIn: string | null) => {
    const items = results.map((r) => ({ ...r }));
    const target = items[idx];
    if (!target || target.status === "void") return;
    let comment: GwComment | null = null;
    let outside = false;
    if (userIn !== null) {
      const u = userIn.trim().replace(/^@/, "");
      if (!/^[A-Za-z0-9._]{1,30}$/.test(u)) {
        setMsg("교체할 아이디 형식을 확인해 주세요. (영문·숫자·._, @ 제외)");
        return;
      }
      const dupIdx = items.findIndex((r) => r.status === "ok" && r.comment.user.toLowerCase() === u.toLowerCase());
      if (dupIdx >= 0) {
        const dup = items[dupIdx];
        // 예비는 아직 당첨자가 아니므로, 예비 명단에 있는 아이디로 교체하면 그 예비를 이 자리로 승급시킨다.
        if (dup.role === "backup" && target.role === "winner") {
          target.status = "void";
          target.note = `@${dup.comment.user}로 교체`;
          target.link = { kind: "promote", user: dup.comment.user };
          dup.role = "winner";
          dup.prize = target.prize;
          dup.slot = target.slot ?? target.label;
          dup.note = `${target.label} 교체로 승급`;
          setMsg("");
          setReplaceIdx(null);
          setReplaceInput("");
          await commit(items, record);
          return;
        }
        setMsg("이미 결과에 있는 아이디입니다.");
        return;
      }
      const hit = an.valid.find((c) => c.user.toLowerCase() === u.toLowerCase());
      outside = !hit;
      comment = hit ?? { user: u, text: "" };
    } else {
      comment = drawOne(an.valid, new Set(items.map((r) => r.comment.user.toLowerCase())));
      if (!comment) {
        setMsg("더 뽑을 참여자가 없습니다.");
        return;
      }
    }
    target.status = "void";
    target.note = `@${comment.user}로 교체`;
    target.link = { kind: "replace", user: comment.user };
    items.splice(idx + 1, 0, {
      comment,
      role: target.role,
      label: target.label,
      prize: target.prize,
      slot: target.slot,
      status: "ok",
      followOk: false,
      note: `@${target.comment.user} 대체${outside ? " · 참여자 명단 외" : ""}`,
    });
    setMsg("");
    setReplaceIdx(null);
    setReplaceInput("");
    await commit(items, record);
  };

  /**
   * 취소·교체·미팔로우 되돌리기 — 원래 사람이 자리로 돌아오고, 대신 들어왔던 사람은 원래 자리로 돌려보낸다.
   * (예비에서 승급했던 사람 → 다시 예비 / 추가 추첨·교체로 들어온 사람 → 제거)
   * 대신 들어온 사람도 이미 취소돼 있으면, 그 연쇄를 먼저 되돌려 예비 인원들이 모두 원래대로 돌아가게 한다.
   */
  const undoItem = (items: ResultItem[], t: ResultItem, unflag: string[]): boolean => {
    const link = t.link;
    if (link && link.kind !== "none") {
      const find = () => items.findIndex((r) => r !== t && r.comment.user.toLowerCase() === link.user.toLowerCase());
      let j = find();
      if (j < 0) return false;
      if (items[j].status === "void") {
        if (!undoItem(items, items[j], unflag)) return false;
        j = find();
        if (j < 0) return false;
      }
      if (items[j].status !== "ok") return false;
      if (link.kind === "promote") {
        items[j].role = "backup";
        items[j].prize = "";
        items[j].slot = undefined;
        items[j].note = undefined;
      } else {
        items.splice(j, 1);
      }
    }
    if (link?.flagged) unflag.push(t.comment.user);
    t.status = "ok";
    t.note = undefined;
    t.link = undefined;
    return true;
  };

  const undoVoid = async (idx: number) => {
    const items = results.map((r) => ({ ...r }));
    const t = items[idx];
    if (!t || t.status !== "void") return;
    const unflag: string[] = [];
    if (!undoItem(items, t, unflag)) {
      setMsg("되돌릴 수 없는 상태입니다. 대신 들어온 사람의 기록이 바뀌었습니다.");
      return;
    }
    unflag.forEach((u) => {
      if (stateRef.current.flags[u.toLowerCase()]?.noFollow) toggleFlag(u, "noFollow");
    });
    setMsg("");
    await commit(items, record);
  };

  /** 팔로우 확인 완료 체크 */
  const toggleFollowOk = async (idx: number) => {
    const items = results.map((r, i) => (i === idx ? { ...r, followOk: !r.followOk } : r));
    await commit(items, record);
  };

  // ── 내보내기 ─────────────────────────────────────────────────────────────
  const flash = (k: string) => {
    setCopied(k);
    setTimeout(() => setCopied(""), 1500);
  };
  const resultText = () =>
    results
      .filter((r) => r.status === "ok")
      .map((r) => `${r.role === "winner" ? "당첨" : "예비"} @${r.comment.user}`)
      .join("\n");
  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(resultText());
      flash("copy");
    } catch {
      flash("fail");
    }
  };
  /** 인스타 공지(게시물·스토리)에 붙여 넣을 당첨자 안내문 — 상품별로 당첨 아이디를 묶어서 보여준다. 예비는 제외. */
  const announceText = () => {
    const live = results.filter((r) => r.status === "ok" && r.role === "winner");
    const order: string[] = [];
    const byPrize = new Map<string, string[]>();
    for (const r of live) {
      const name = r.prize || "상품";
      if (!byPrize.has(name)) {
        byPrize.set(name, []);
        order.push(name);
      }
      byPrize.get(name)!.push(`@${r.comment.user}`);
    }
    const title = (record?.eventName || eventName).trim();
    return [
      title ? `🎉 ${title}` : "🎉",
      "당첨자를 발표합니다!",
      "",
      ...order.map((n) => [`🎁 ${n}`, ...byPrize.get(n)!]).flatMap((b, i) => (i ? ["", ...b] : b)),
    ].join("\n");
  };
  const copyAnnounce = async () => {
    try {
      await navigator.clipboard.writeText(announceText());
      flash("ann");
    } catch {
      flash("fail");
    }
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const exportParticipants = () =>
    downloadText(
      `giveaway-participants-${stamp()}.csv`,
      toCsv(
        ["아이디", "댓글", "작성시각", "좋아요", "대댓글"],
        an.valid.map((r) => [r.user, r.text, r.ts || "", r.likes ?? "", r.isReply ? "Y" : ""]),
      ),
    );
  const exportWinners = () =>
    downloadText(
      `giveaway-winners-${stamp()}.csv`,
      toCsv(
        ["구분", "상품", "아이디", "상태", "팔로우확인", "댓글", "비고"],
        results.map((r) => [r.label, r.prize, r.comment.user, r.status === "void" ? "취소" : "확정", r.followOk ? "완료" : "", r.comment.text, r.note]),
      ),
    );
  /** 당첨자 인스타 프로필을 새 탭으로 연다 (브라우저가 팝업을 막으면 허용해 주세요) */
  const openProfiles = (list: ResultItem[]) => list.forEach((r) => window.open(igUrl(r.comment.user), "_blank", "noopener"));
  const dropParts = [
    an.dropped.excluded && `제외 아이디 ${an.dropped.excluded}`,
    an.dropped.filtered && `조건 미충족 ${an.dropped.filtered}`,
    an.dropped.outOfRange && `기간 밖 ${an.dropped.outOfRange}`,
    an.dropped.short && `너무 짧음 ${an.dropped.short}`,
    an.dropped.dup && `중복 ${an.dropped.dup}`,
  ].filter(Boolean);

  const card = "bg-white border border-gray-200 rounded-xl p-6";
  const input =
    "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[15px] focus:outline-none focus:border-[#303236]";
  const label = "block text-[13px] font-semibold text-gray-600 mb-1";
  const cInput =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:border-[#303236]";
  const btn = "px-5 py-2.5 rounded-lg text-[15px] font-bold transition-colors disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">인스타그램 댓글 추첨 · 분석</h1>
        <p className="text-base text-gray-400 mt-1">
          게시물 주소로 댓글을 불러와 참여 현황을 분석하고, 조건에 맞는 참여자를 공정하게 추첨합니다.
        </p>
      </div>

      {/* 1. 댓글 불러오기 */}
      <section className={card}>
        {/* 제목 | 게시물·릴스 주소 | 내 게시물에서 선택 — 한 줄 */}
        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap mb-4">
          <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">1. 댓글 불러오기</h2>
          <input className={`${input} flex-1 min-w-[200px]`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="게시물 · 릴스 주소  https://www.instagram.com/p/XXXXXXXX/" aria-label="게시물 · 릴스 주소" />
          <button className="shrink-0 px-4 py-2.5 rounded-lg border border-gray-300 text-[14px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap" onClick={loadMedia} disabled={mediaLoading}>
            {mediaLoading ? "불러오는 중…" : "내 게시물에서 선택"}
          </button>
          {mediaList && <button className="shrink-0 text-[13px] text-gray-400 underline whitespace-nowrap" onClick={() => setMediaList(null)}>닫기</button>}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2 empty:hidden">
            {mediaMsg && <p className="text-[13px] text-red-600">{mediaMsg}</p>}
            {mediaList && mediaList.length > 0 && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[440px] overflow-y-auto pr-1">
                {mediaList.map((m) => (
                  <button key={m.id} onClick={() => pickMedia(m)} className={`text-left border rounded-lg overflow-hidden hover:border-[#303236] ${url.trim() === m.permalink ? "border-[#E5541B] ring-1 ring-[#E5541B]" : "border-gray-200"}`}>
                    {m.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumb} alt="" loading="lazy" className="w-full aspect-square object-cover bg-gray-100" />
                    ) : (
                      <div className="w-full aspect-square bg-gray-100" />
                    )}
                    <div className="p-2">
                      <p className="text-[12px] text-gray-400">{m.timestamp ? m.timestamp.slice(0, 10) : ""} · 댓글 {m.comments ?? "-"}</p>
                      <p className="text-[13px] text-gray-700 line-clamp-2 break-words">{m.caption || "(캡션 없음)"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {serverReady === false && (
            <p className="md:col-span-2 text-[13px] text-gray-400">
              서버 토큰이 설정되지 않았습니다. Vercel 환경변수 IG_GIVEAWAY_TOKEN을 설정하면 입력 없이 쓸 수 있습니다.
            </p>
          )}
          {!useServer && (
          <>
          <div>
            <label className={label}>인스타그램 계정 ID (Facebook 로그인 방식 토큰이면 입력)</label>
            <input className={input} name="gw-ig-id" autoComplete="off" value={igId} onChange={(e) => setIgId(e.target.value.replace(/\D/g, ""))} placeholder="17841473476577810" inputMode="numeric" />
          </div>
          <div>
            <label className={label}>액세스 토큰 (이 페이지 메모리에만 있고 저장·전송되지 않습니다)</label>
            {/* type=password는 브라우저가 저장된 비밀번호를 자동 입력하므로, 텍스트 입력 + 마스킹으로 처리 */}
            <input
              className={input}
              type="text"
              name="gw-access-token"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="토큰을 붙여넣으세요"
            />
            {token && <p className="mt-1 text-[12px] text-gray-400">입력된 길이: {token.trim().length}자 (정상 토큰은 보통 100자 이상)</p>}
          </div>
          </>
          )}
        </div>
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <button className={`${btn} bg-[#E5541B] text-white hover:bg-[#cc4915]`} onClick={load} disabled={fetching}>
            {fetching ? "불러오는 중…" : "댓글 불러오기"}
          </button>
          <label className="flex items-center gap-2 text-[14px] text-gray-600">
            <input type="checkbox" checked={includeReplies} onChange={(e) => setIncludeReplies(e.target.checked)} />
            대댓글 포함
          </label>
          <button className="text-[14px] text-gray-500 underline" onClick={() => setShowPaste((v) => !v)}>
            {showPaste ? "직접 붙여넣기 닫기" : "직접 붙여넣기"}
          </button>
          {useServer && (
            <span className="text-[13px] text-emerald-700 whitespace-nowrap" title="서버에 저장된 토큰을 사용합니다. 토큰을 입력할 필요가 없습니다.">
              ✓ 서버 토큰 사용 ·{" "}
              <button className="underline" onClick={() => setManualToken(true)}>직접 입력</button>
            </span>
          )}
          {fetchMsg && <span className={`text-[14px] ${fetchMsg.startsWith("불러오기 실패") ? "text-red-600" : "text-gray-500"}`}>{fetchMsg}</span>}
        </div>
        {showPaste && (
          <div className="mt-4">
            <label className={label}>줄마다 “아이디 댓글내용” 형식 (인스타 웹에서 복사한 댓글도 가능)</label>
            <textarea
              className={`${input} h-40 font-mono text-[13px]`}
              value={source === "paste" ? pasteText : rows.map((r) => `${r.user} ${r.text}`).join("\n")}
              onChange={(e) => {
                setSource("paste");
                setPasteText(e.target.value);
              }}
            />
            <div className="flex gap-3 mt-2">
              <button className="text-[14px] text-gray-500 underline" onClick={() => { setSource("paste"); setPasteText(SAMPLE); }}>
                예시 넣기
              </button>
              <button className="text-[14px] text-gray-500 underline" onClick={() => { setSource("paste"); setPasteText(""); setApiRows([]); setResults([]); setRecord(null); }}>
                비우기
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. 참여 분석 */}
      <section className={card}>
        <h2 className="text-xl font-bold text-gray-800 mb-4">2. 참여 분석</h2>
        {rows.length === 0 ? (
          <p className="text-[15px] text-gray-400">아직 불러온 댓글이 없습니다.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { l: "전체 댓글", v: fmt(ins.comments) },
                { l: "참여자", v: fmt(ins.users) },
                { l: "평균 멘션/댓글", v: ins.avgMentions.toFixed(1) },
                { l: "멘션된 계정(도달 추정)", v: fmt(ins.uniqueMentioned) },
                { l: "댓글 좋아요 합", v: ins.totalLikes ? fmt(ins.totalLikes) : "-" },
              ].map((k) => (
                <div key={k.l} className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-[13px] text-gray-500 mb-1">{k.l}</p>
                  <p className="text-2xl font-black text-[#303236]">{k.v}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="text-[15px] font-bold text-gray-700 mb-3">시간대별 댓글 수</h3>
                {ins.hasTime ? (
                  <div className="flex items-end gap-[3px] h-32">
                    {ins.hourly.map((c, h) => (
                      <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}시 · ${c}개`}>
                        <div className="w-full bg-[#303236] rounded-t-sm" style={{ height: `${c ? Math.max(3, (c / maxHour) * 100) : 0}%` }} />
                        <span className="text-[10px] text-gray-400 mt-1">{h % 6 === 0 ? h : ""}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] text-gray-400">주소로 불러온 댓글에서만 시간 분석이 가능합니다.</p>
                )}
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-700 mb-3">일자별 댓글 수</h3>
                {ins.hasTime ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {ins.daily.map((d) => (
                      <div key={d.date} className="flex items-center gap-2 text-[13px]">
                        <span className="w-20 text-gray-500">{d.date.slice(5)}</span>
                        <div className="flex-1 bg-gray-100 rounded h-3">
                          <div className="bg-[#E5541B] h-3 rounded" style={{ width: `${(d.count / maxDay) * 100}%` }} />
                        </div>
                        <span className="w-10 text-right font-semibold">{d.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] text-gray-400">-</p>
                )}
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-700 mb-2">댓글 많은 계정 TOP 5</h3>
                <ol className="text-[14px] text-gray-600 space-y-1">
                  {ins.topCommenters.map((t, i) => (
                    <li key={t.user}>
                      {i + 1}. @{t.user} <span className="text-gray-400">· {t.count}개</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-700 mb-2">많이 쓰인 해시태그</h3>
                {ins.topTags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {ins.topTags.map((t) => (
                      <span key={t.tag} className="px-2.5 py-1 bg-gray-100 rounded-full text-[13px] text-gray-600">
                        {t.tag} <b>{t.count}</b>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] text-gray-400">해시태그가 없습니다.</p>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* 3. 추첨 조건 · 추첨 결과 (추첨 영역을 따로 두지 않고 조건 아래에 이어 붙인다) */}
      <section className={`${card} relative overflow-hidden`}>
        <canvas ref={confettiRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">3. 추첨 조건</h2>
          <input className={`${cInput} flex-1 min-w-[220px]`} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="이벤트 이름 (이력 관리용) 예: 11월 신상 오픈 기념 댓글 이벤트" aria-label="이벤트 이름 (이력 관리용)" />
          <button className={`${btn} bg-[#303236] text-white hover:bg-black text-[16px] px-6 py-2 whitespace-nowrap`} onClick={draw} disabled={drawing || !an.users.size}>
            {drawing ? "추첨 중…" : results.length ? "다시 추첨" : "추첨하기"}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-3">
          <div className="col-span-2 md:col-span-12">
            <label className={label}>상품 · 당첨 인원 <span className="font-normal text-gray-400">(총 {winnersN}명)</span></label>
            {/* 상품은 가로로 이어 붙이고, 공간이 모자라면 다음 줄로 넘어간다 */}
            <div className="flex flex-wrap items-center gap-2">
              {prizes.map((pz) => (
                <div key={pz.id} className="flex items-center gap-1.5 border border-gray-200 rounded-lg pl-1 pr-2 py-1 bg-gray-50">
                  <input className={`${cInput} !w-40 !py-1.5`} value={pz.name} onChange={(e) => setPrizes((l) => l.map((x) => (x.id === pz.id ? { ...x, name: e.target.value } : x)))} placeholder="상품명" />
                  <input className={`${cInput} !w-16 !py-1.5 shrink-0`} type="number" min={0} max={100} value={pz.count} onChange={(e) => setPrizes((l) => l.map((x) => (x.id === pz.id ? { ...x, count: Number(e.target.value) } : x)))} aria-label={`${pz.name || "상품"} 당첨 인원`} />
                  <span className="text-[13px] text-gray-500 shrink-0">명</span>
                  <button className="px-1 text-[16px] leading-none text-gray-400 hover:text-red-600 disabled:opacity-30 shrink-0" onClick={() => setPrizes((l) => l.filter((x) => x.id !== pz.id))} disabled={prizes.length <= 1} aria-label="상품 삭제" title="상품 삭제">
                    ×
                  </button>
                </div>
              ))}
              <button className="px-3 py-2 rounded-lg border border-dashed border-[#E5541B]/50 text-[14px] font-semibold text-[#E5541B] hover:bg-orange-50 whitespace-nowrap" onClick={() => setPrizes((l) => [...l, { id: newId(), name: "", count: 1 }])}>
                + 상품 추가
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className={label}>예비 인원</label>
            <input className={cInput} type="number" min={0} max={100} value={backupsN} onChange={(e) => setBackupsN(Number(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>최소 멘션</label>
            <input className={cInput} type="number" min={0} max={20} value={minMentions} onChange={(e) => setMinMentions(Number(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>최소 글자</label>
            <input className={cInput} type="number" min={0} max={500} value={minLength} onChange={(e) => setMinLength(Number(e.target.value))} />
          </div>
          <div className="col-span-2 md:col-span-6">
            <label className={label}>필수 키워드 · 해시태그</label>
            <input className={cInput} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="#워크업이벤트, 참여 (쉼표 구분, 모두 포함)" />
          </div>
          {/* 자주 바꾸지 않는 조건은 접어 둔다 */}
          <details className="col-span-2 md:col-span-6 group">
            <summary className="cursor-pointer text-[13px] font-semibold text-[#303236] hover:underline">
              제외 아이디 · 댓글 기간 설정 ▾
              <span className="ml-2 font-normal text-gray-400">
                제외 {exclude.split(/[\s,]+/).filter(Boolean).length}명{fromStr || toStr ? " · 기간 지정" : ""}
              </span>
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="md:col-span-2">
                <label className={label}>제외 아이디</label>
                <input className={cInput} value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="공백·쉼표로 구분" />
              </div>
              <div>
                <label className={label}>댓글 시작 시각</label>
                <input className={cInput} type="datetime-local" value={fromStr} onChange={(e) => setFromStr(e.target.value)} />
              </div>
              <div>
                <label className={label}>댓글 마감 시각</label>
                <input className={cInput} type="datetime-local" value={toStr} onChange={(e) => setToStr(e.target.value)} />
              </div>
            </div>
          </details>
        </div>

        {/* 조건 요약(왼쪽)과 추첨 박스(오른쪽)를 나란히 둔다. 좁은 화면에서는 위아래로 쌓인다. */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-3 md:items-stretch">
          <div className="md:col-span-6 min-w-0">
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-[14px] text-gray-700">
          <label className="flex items-center gap-1.5" title="끄면 유효 댓글 1개가 응모권 1장">
            <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
            1인 1회 응모
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={excludeCherry} onChange={(e) => setExcludeCherry(e.target.checked)} />
            체리피커 제외 ({flagCount("cherry")})
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={excludeNoFollow} onChange={(e) => setExcludeNoFollow(e.target.checked)} />
            비팔로우 이력자 제외 ({flagCount("noFollow")})
          </label>
        </div>
        <p className="mt-3 text-[14px] text-gray-600">
          {rows.length ? (
            <>
              댓글 <b>{fmt(an.total)}</b> → 유효 <b>{fmt(an.valid.length)}</b> · 참여자 <b>{fmt(an.users.size)}</b>명
              {dropParts.length > 0 && <span className="text-gray-400"> ({dropParts.join(" · ")})</span>}
            </>
          ) : (
            "불러온 댓글이 없습니다."
          )}
        </p>
        {msg && <p className="mt-3 text-[14px] text-amber-700">{msg}</p>}
          </div>
        {(drawing || results.length > 0) && (
          <div className="md:col-span-6 min-w-0 bg-[#0f172a] rounded-xl p-6 text-center flex flex-col justify-center">
            <p className="text-slate-400 text-[14px]">{stageLabel}</p>
            <p className="text-white text-3xl font-black mt-1 break-all">{stageName}</p>
          </div>
        )}
        </div>

        {results.length > 0 && (
          <>
            <p className="mt-5 text-[14px] text-gray-600">
              팔로우 확인 <b>{results.filter((r) => r.status === "ok" && r.role === "winner" && r.followOk).length}</b> /{" "}
              {results.filter((r) => r.status === "ok" && r.role === "winner").length}명 · 인스타 프로필에서 팔로우를 확인한 뒤 체크하세요.
            </p>
            <datalist id="gw-users">
              {[...new Set(an.valid.map((c) => c.user))].slice(0, 1000).map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <ol className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-1.5">
              {results.map((r, i) => {
                const f = flags[r.comment.user.toLowerCase()];
                const live = r.status === "ok";
                return (
                  <Fragment key={r.comment.user + i}>
                  <li className={`px-3 py-1.5 rounded-lg border flex items-center gap-x-3 gap-y-1 flex-wrap ${!live ? "bg-gray-50 border-gray-200 opacity-60" : r.role === "winner" ? "border-[#E5541B]/40 bg-orange-50" : "border-gray-200"}`}>
                    <span className={`px-2 py-0.5 rounded-full text-[12px] font-bold whitespace-nowrap shrink-0 ${r.role === "winner" && live ? "bg-[#E5541B] text-white" : "bg-gray-200 text-gray-600"}`}>
                      {r.role === "winner" && r.label.startsWith("예비") && r.prize ? `${r.prize} · ${r.label} 승급` : r.label}
                    </span>
                    <a className={`font-bold text-[15px] hover:underline shrink-0 ${!live ? "line-through" : ""}`} href={igUrl(r.comment.user)} target="_blank" rel="noopener noreferrer">
                      @{r.comment.user} ↗
                    </a>
                    {winBadge(r.comment.user)}
                    {f?.cherry && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[11px] font-bold shrink-0">체리피커</span>}
                    {f?.noFollow && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[11px] font-bold shrink-0">비팔로우 이력</span>}
                    {r.note && <span className="text-[12px] text-emerald-700 shrink-0">{r.note}</span>}
                    {!live && !drawing && !record && (
                      <button className="min-h-[32px] text-[13px] font-semibold text-[#303236] hover:underline whitespace-nowrap shrink-0 ml-auto" onClick={() => undoVoid(i)}>
                        되돌리기
                      </button>
                    )}
                    {live && !drawing && (
                      <span className="flex items-center gap-x-3 shrink-0 ml-auto">
                        {r.role === "winner" && (
                          <label className="flex items-center gap-1.5 text-[13px] text-gray-700 min-h-[32px] cursor-pointer whitespace-nowrap">
                            <input type="checkbox" className="w-4 h-4" checked={r.followOk} onChange={() => toggleFollowOk(i)} />
                            팔로우 확인
                          </label>
                        )}
                        {r.role === "winner" && (
                          <button className="min-h-[32px] text-[13px] font-semibold text-red-600 hover:underline whitespace-nowrap" onClick={() => voidWinner(i, "nofollow")} title="팔로우하지 않았다면 예비 당첨자로 대체하고 비팔로우 목록에 등록합니다">
                            미팔로우→예비
                          </button>
                        )}
                        <button className="min-h-[32px] text-[13px] text-purple-700 hover:underline whitespace-nowrap" onClick={() => toggleFlag(r.comment.user, "cherry")}>
                          {f?.cherry ? "체리 해제" : "체리피커"}
                        </button>
                        <button className="min-h-[32px] text-[13px] text-gray-600 hover:underline whitespace-nowrap" onClick={() => { setReplaceIdx(replaceIdx === i ? null : i); setReplaceInput(""); }}>
                          교체
                        </button>
                        <button className="min-h-[32px] text-[13px] text-gray-400 hover:text-red-600 whitespace-nowrap" onClick={() => voidWinner(i, "cancel")}>
                          취소
                        </button>
                      </span>
                    )}
                  </li>
                  {replaceIdx === i && live && (
                    <li className="lg:col-span-2 ml-6 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] text-gray-600 whitespace-nowrap">@{r.comment.user} →</span>
                      <input
                        className={`${cInput} !w-56 !py-1.5`}
                        list="gw-users"
                        value={replaceInput}
                        onChange={(e) => setReplaceInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && replaceInput.trim()) void replaceWinner(i, replaceInput); }}
                        placeholder="교체할 아이디 (명단에서 선택·직접 입력)"
                        autoFocus
                      />
                      <button className="px-3 py-1.5 rounded-lg bg-[#303236] text-white text-[13px] font-semibold disabled:opacity-40 whitespace-nowrap" disabled={!replaceInput.trim()} onClick={() => replaceWinner(i, replaceInput)}>
                        교체
                      </button>
                      <button className="px-3 py-1.5 rounded-lg border border-gray-300 text-[13px] font-semibold text-gray-700 whitespace-nowrap" onClick={() => replaceWinner(i, null)}>
                        랜덤으로
                      </button>
                      <button className="text-[13px] text-gray-400 hover:underline whitespace-nowrap" onClick={() => { setReplaceIdx(null); setReplaceInput(""); }}>
                        닫기
                      </button>
                    </li>
                  )}
                  </Fragment>
                );
              })}
            </ol>
          </>
        )}

        {results.length > 0 && !drawing && (
          <div className="mt-4">
            {record ? (
              <p className="text-[13px] text-emerald-700 break-all">
                ✓ 확정됨 · 이력에 저장됨 · {record.at} · 참여자 {fmt(record.participants)}명 · 명단 지문 {record.fingerprint.slice(0, 12)}…
              </p>
            ) : (
              <div className="flex items-center gap-3 flex-wrap bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-[14px] text-amber-800 flex-1 min-w-[220px]">
                  아직 확정 전입니다. 확정하면 남은 당첨자는 모두 팔로우 확인 처리되어 이력과 당첨 횟수에 반영되고, 취소·교체된 내역은 삭제됩니다.
                </p>
                <button className={`${btn} bg-[#E5541B] text-white hover:bg-[#cc4915] px-6 py-2`} onClick={confirmDraw} disabled={confirming}>
                  {confirming ? "저장 중…" : "당첨 확정"}
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <button className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={copyResult}>
                {copied === "copy" ? "복사됨" : copied === "fail" ? "복사 실패" : "결과 복사"}
              </button>
              <button className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={copyAnnounce} title="상품별로 당첨 아이디를 묶은 인스타 공지용 문구를 복사합니다">
                {copied === "ann" ? "복사됨" : "공지용 복사"}
              </button>
              <button className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={() => openProfiles(results.filter((r) => r.status === "ok" && r.role === "winner"))}>당첨자 프로필 모두 열기 ↗</button>
              <button className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={exportWinners}>당첨자 CSV</button>
              <button className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={exportParticipants}>응모자 CSV</button>
            </div>
            {record && <GiveawayClaimPanel key={record.id} record={record} />}
          </div>
        )}
      </section>

      {/* 4. 참여자 표시 관리 (비팔로우 · 체리피커) */}
      <section className={card}>
        <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap mb-3">
          <h2 className="text-xl font-bold text-gray-800">4. 참여자 표시 관리</h2>
          <span className="text-[13px] text-gray-400">표시한 사람은 다음 추첨에서 자동 제외할 수 있습니다 · 서버 저장(PC 공통)</span>
        </div>
        {stateMsg && <p className="mb-2 text-[14px] text-red-600">{stateMsg}</p>}

        {/* 직접 추가 + 이번 게시물 검색 (한 줄) */}
        <div className="flex flex-wrap gap-2 items-center">
          <input className={`${cInput} !w-52`} value={flagAdd} onChange={(e) => setFlagAdd(e.target.value.replace(/[^A-Za-z0-9._@]/g, "").replace(/^@/, ""))} placeholder="아이디 직접 추가" />
          <button className="px-3 py-2 rounded-lg border border-red-200 text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 whitespace-nowrap" disabled={!flagAdd} onClick={() => { if (!flags[flagAdd.toLowerCase()]?.noFollow) toggleFlag(flagAdd, "noFollow", eventTitle()); setFlagAdd(""); }}>
            비팔로우 추가
          </button>
          <button className="px-3 py-2 rounded-lg border border-purple-200 text-[13px] font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-40 whitespace-nowrap" disabled={!flagAdd} onClick={() => { if (!flags[flagAdd.toLowerCase()]?.cherry) toggleFlag(flagAdd, "cherry"); setFlagAdd(""); }}>
            체리피커 추가
          </button>
          {rows.length > 0 && <input className={`${cInput} !w-52 md:ml-auto`} value={flagQuery} onChange={(e) => setFlagQuery(e.target.value)} placeholder="이번 게시물 참여자 검색" />}
        </div>

        {/* 표시된 참여자 — 있을 때만, 칩 형태로 */}
        {Object.keys(flags).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            <span className="text-[13px] font-semibold text-gray-600 mr-1">표시됨 {flagCount("noFollow")}·{flagCount("cherry")}</span>
            {Object.values(flags)
              .sort((x, y) => x.user.localeCompare(y.user))
              .map((f) => (
                <span key={f.user} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-gray-100 text-[12px]" title={f.events.length ? `비팔로우: ${f.events.join(", ")}` : undefined}>
                  <a className="hover:underline" href={igUrl(f.user)} target="_blank" rel="noopener noreferrer">@{f.user}</a>
                  {f.noFollow && <button className="px-1 rounded bg-red-100 text-red-700 font-bold" onClick={() => toggleFlag(f.user, "noFollow", eventTitle())} title="비팔로우 해제">비</button>}
                  {f.cherry && <button className="px-1 rounded bg-purple-100 text-purple-700 font-bold" onClick={() => toggleFlag(f.user, "cherry")} title="체리피커 해제">체</button>}
                  {winBadge(f.user)}
                </span>
              ))}
          </div>
        )}

        {/* 이번 게시물 참여자 — 여러 열로 촘촘하게 */}
        {rows.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 max-h-56 overflow-y-auto pr-1">
            {[...new Set(rows.map((r) => r.user))]
              .filter((u) => !flagQuery.trim() || u.toLowerCase().includes(flagQuery.trim().toLowerCase().replace(/^@/, "")))
              .slice(0, 60)
              .map((u) => {
                const f = flags[u.toLowerCase()];
                return (
                  <li key={u} className="py-1 flex items-center gap-2 text-[13px] border-b border-gray-100">
                    <a className="truncate hover:underline min-w-0" href={igUrl(u)} target="_blank" rel="noopener noreferrer">@{u}</a>
                    {winBadge(u)}
                    <span className="ml-auto flex gap-2 shrink-0">
                      <button className={`hover:underline ${f?.noFollow ? "text-red-600 font-bold" : "text-gray-400"}`} onClick={() => toggleFlag(u, "noFollow", eventTitle())}>{f?.noFollow ? "비팔로우✓" : "비팔로우"}</button>
                      <button className={`hover:underline ${f?.cherry ? "text-purple-700 font-bold" : "text-gray-400"}`} onClick={() => toggleFlag(u, "cherry")}>{f?.cherry ? "체리✓" : "체리"}</button>
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      {/* 5. 이벤트 기록 (서버 DB 저장) — 기본은 한 줄 요약, 눌러서 펼치면 상세 */}
      {history.length > 0 && (
        <section className={card}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <h2 className="text-xl font-bold text-gray-800">5. 이벤트 기록 <span className="text-[14px] font-normal text-gray-400">({history.length}건 · 서버 DB 저장)</span></h2>
            <div className="flex items-center gap-3">
              <input className={`${cInput} !w-48`} value={histQuery} onChange={(e) => setHistQuery(e.target.value)} placeholder="이벤트 이름 검색" />
              <button className="text-[13px] text-gray-400 hover:text-red-600 whitespace-nowrap" onClick={async () => { if (confirm("이벤트 기록을 모두 삭제할까요? 참여자 명단도 함께 삭제되며 되돌릴 수 없습니다.")) { const all = history; saveHistory([]); await Promise.all(all.map((x) => fetch(`/api/admin/giveaway/event/${x.id}`, { method: "DELETE" }).catch(() => null))); setOpenId(null); setExpandId(null); } }}>
                전체 삭제
              </button>
            </div>
          </div>
          <ul className="divide-y divide-gray-100">
            {history
              .filter((h) => !histQuery.trim() || (h.eventName || "").toLowerCase().includes(histQuery.trim().toLowerCase()))
              .map((h) => {
                const confirmed = h.winners.filter((w) => w.status === "확정" && (!w.label.startsWith("예비") || (w.note || "").includes("승급")));
                const checked = confirmed.filter((w) => w.followOk).length;
                const open = expandId === h.id;
                return (
                  <li key={h.id} className="text-[14px]">
                    {/* 요약 한 줄 */}
                    <button className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50" onClick={() => setExpandId(open ? null : h.id)} aria-expanded={open}>
                      <span className="text-gray-400 text-[12px] w-3 shrink-0">{open ? "▼" : "▶"}</span>
                      <span className="font-bold text-gray-900 truncate min-w-0 flex-1">{h.eventName || "(이름 없는 이벤트)"}</span>
                      <span className="text-gray-400 text-[13px] whitespace-nowrap hidden sm:inline">{h.at.split(" 오")[0]}</span>
                      <span className="text-gray-500 text-[13px] whitespace-nowrap">참여 {fmt(h.participants)}</span>
                      <span className="text-gray-700 text-[13px] whitespace-nowrap">당첨 {confirmed.length}</span>
                      <span className={`text-[12px] whitespace-nowrap ${confirmed.length && checked === confirmed.length ? "text-emerald-600" : "text-amber-600"}`}>팔로우 {checked}/{confirmed.length}</span>
                    </button>

                    {open && (
                      <div className="pb-3 pl-6 space-y-2">
                        <p className="text-gray-400 text-[12px] break-all">
                          {h.at} · <a className="hover:underline" href={h.postUrl} target="_blank" rel="noopener noreferrer">{h.postUrl || "(직접 입력)"}</a>
                        </p>
                        <p className="text-gray-500 text-[12px]">{h.conditions}</p>
                        {/* 당첨자 목록은 배송 정보 리스트가 대신한다(링크 생성 전에는 패널이 당첨자만 미리 보여 줌) */}
                        <GiveawayClaimPanel record={h} />
                        <div className="flex items-center gap-4">
                          {h.hasDetail && (
                            <button className="text-[13px] font-semibold text-[#303236] hover:underline" onClick={() => openDetail(h)}>
                              {openId === h.id ? "참여자 닫기" : "참여자 보기"}
                            </button>
                          )}
                          <button className="text-[13px] text-gray-400 hover:text-red-600" onClick={() => deleteEvent(h)}>
                            이 기록 삭제
                          </button>
                        </div>
                        {openId === h.id && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            {detailLoading ? (
                              <p className="text-gray-400">불러오는 중…</p>
                            ) : !detail || detail.participants.length === 0 ? (
                              <p className="text-gray-400">저장된 참여자 명단이 없습니다.</p>
                            ) : (
                              <>
                                <div className="flex items-center gap-3 flex-wrap mb-2">
                                  <span className="text-[13px] text-gray-500">
                                    유효 댓글 {fmt(detail.participants.length)}개 (전체 {fmt(detail.totalComments ?? detail.participants.length)}개)
                                  </span>
                                  <input className={`${cInput} !w-44 !py-1`} value={detailQuery} onChange={(e) => setDetailQuery(e.target.value)} placeholder="아이디·댓글 검색" />
                                  <button
                                    className="text-[13px] text-gray-600 underline"
                                    onClick={() =>
                                      downloadText(
                                        `giveaway-${h.id}-participants.csv`,
                                        toCsv(["아이디", "댓글", "작성시각", "좋아요", "대댓글"], detail.participants.map((c) => [c.user, c.text, c.ts || "", c.likes ?? "", c.isReply ? "Y" : ""])),
                                      )
                                    }
                                  >
                                    CSV
                                  </button>
                                </div>
                                <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                                  {detail.participants
                                    .filter((c) => !detailQuery.trim() || (c.user + " " + c.text).toLowerCase().includes(detailQuery.trim().toLowerCase()))
                                    .slice(0, 200)
                                    .map((c, i) => (
                                      <li key={c.user + i} className="py-1 flex gap-3 text-[13px]">
                                        <a className="font-semibold shrink-0 hover:underline" href={igUrl(c.user)} target="_blank" rel="noopener noreferrer">@{c.user}</a>
                                        {winBadge(c.user)}
                                        <span className="truncate text-gray-500" title={c.text}>{c.text}</span>
                                      </li>
                                    ))}
                                </ul>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
}
