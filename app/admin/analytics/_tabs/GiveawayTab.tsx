"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import GiveawayClaimPanel from "./GiveawayClaimPanel";
import { useStageRecorder } from "./useStageRecorder";
import {
  analyze,
  analyzeChoices,
  downloadText,
  drawOne,
  drawPicks,
  fetchInstagramComments,
  insights,
  listInstagramMedia,
  parseChoices,
  parseComments,
  participantsFingerprint,
  rollNames,
  runConfetti,
  sleep,
  stampNow,
  toCsv,
  type GwChoiceAnalysis,
  type GwComment,
  type GwInsights,
  type GwMedia,
  type GwOptions,
} from "@/lib/giveaway";

/** 신청 마감 시각(ISO) → "11월 20일(목) 오후 11:59" */
function fmtDeadlineKo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const h = d.getHours();
  const ap = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${wd}) ${ap} ${h12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 인스타 공지(게시물·스토리)에 붙여 넣을 당첨자 발표 문구 — 상단 문구 · 당첨자 목록 · 하단 문구(신청 마감일 포함). 예비는 제외. */
function buildAnnounce(title: string, winners: { prize: string; user: string }[], deadline: string): string {
  const order: string[] = [];
  const by = new Map<string, string[]>();
  for (const w of winners) {
    const name = w.prize || "상품";
    if (!by.has(name)) {
      by.set(name, []);
      order.push(name);
    }
    by.get(name)!.push(`@${w.user}`);
  }
  const list =
    order.length > 1 ? order.map((n) => [`🎁 ${n}`, ...by.get(n)!].join("\n")).join("\n\n") : order.length ? by.get(order[0])!.join("\n") : "";
  return [
    "🎉",
    title || "이벤트",
    "당첨자를 발표합니다!",
    "",
    "이벤트에 참여해주신 모든 분께 감사드립니다.",
    "행운의 당첨자를 발표합니다.",
    "당첨되신 분들 모두 축하드려요!",
    "",
    "당첨자",
    "",
    list,
    "",
    "당첨자분들께는 DM으로 수령 정보 입력 링크를 안내드릴 예정입니다.",
    `${deadline ? `${deadline}까지` : "신청 마감일까지"} 링크를 통해 정보를 보내주세요.`,
    "",
    "⦁ 이벤트 참여 조건을 충족하지 않았거나 비공개 계정·스크랩 계정 등은 당첨 대상에서 제외 되었습니다.",
  ].join("\n");
}
/** 배송 정보 수집(신청 링크)의 마감 시각을 읽어 문구용으로 돌려준다 — 아직 링크를 만들지 않았으면 빈 문자열 */
async function fetchClaimDeadline(eventId: string): Promise<string> {
  try {
    const r = await fetch(`/api/admin/giveaway/claims/${eventId}`);
    if (!r.ok) return "";
    const j = (await r.json()) as { deadline?: string; doc?: { deadline?: string } };
    return fmtDeadlineKo(j.deadline || j.doc?.deadline || "");
  } catch {
    return "";
  }
}

/** 기록 시각("2026. 11. 18. 오전 10:49:58") → 간결하게 "11/18 10:49" */
const shortAt = (at: string) => {
  const m = at.match(/(\d{4})\.\s*(\d+)\.\s*(\d+)\.\s*(오전|오후)\s*(\d+):(\d+)/);
  if (!m) return at;
  let h = Number(m[5]) % 12;
  if (m[4] === "오후") h += 12;
  return `${Number(m[2])}/${Number(m[3])} ${String(h).padStart(2, "0")}:${m[6]}`;
};
const DAY_MS = 86400000;
/** 11/18(수) */
const fmtMD = (ms: number) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}(${["일", "월", "화", "수", "목", "금", "토"][d.getDay()]})`;
};
/** datetime-local 입력용 "YYYY-MM-DDTHH:mm" (로컬 시각) */
const toLocalInputMs = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const HISTORY_KEY = "workup_giveaway_history_v1";
const DRAFT_KEY = "workup_giveaway_draft_v1";
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
  winners: { label: string; prize?: string; user: string; status: string; followOk?: boolean; note?: string; commentId?: string }[];
  /** 추첨 당시 참여자 명단이 서버에 저장돼 있는지 (옛 기록은 없음) */
  hasDetail?: boolean;
  /** 참여 분석 결과(지표·차트·제품 선택). 확정 시 자동 저장되고, 기록에서 갱신할 수 있다 */
  analysis?: { ins: GwInsights; choices?: GwChoiceAnalysis };
  /** 이벤트 완료 처리 시각 (모든 당첨자 발송 후) */
  completedAt?: string;
  /** 같은 이벤트를 상품별로 나눠 만든 기록을 하나로 묶는 그룹 (기록은 각각 유지되고 목록에서만 한 줄로 보인다) */
  groupId?: string;
  groupName?: string;
}

/** 제품 선택 분석 결과 표시 (참여 분석·이벤트 기록에서 함께 사용) */
function ChoiceSummary({ res, name }: { res: GwChoiceAnalysis; name: string }) {
  const n = (v: number) => v.toLocaleString("ko-KR");
  const sorted = [...res.options].sort((a, b) => b.users.length - a.users.length);
  const max = Math.max(1, sorted[0]?.users.length || 1);
  const pctOf = (c: number) => (res.matchedUsers ? Math.round((c / res.matchedUsers) * 1000) / 10 : 0);
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-gray-600 mb-2">
        <span>참여자 <b>{n(res.totalUsers)}</b>명</span>
        <span>선택 확인 <b>{n(res.matchedUsers)}</b>명</span>
        <span>해당 없음 <b>{n(res.unmatchedUsers)}</b>명</span>
        {res.multiUsers > 0 && <span>2개 이상 선택 <b>{n(res.multiUsers)}</b>명</span>}
        <button
          className="text-gray-500 hover:text-[#303236] hover:underline"
          onClick={() =>
            downloadText(
              `giveaway-choices-${name.replace(/[\\/:*?"<>|]/g, "").slice(0, 30) || "event"}.csv`,
              toCsv(["제품", "선택 인원", "비율(%)", "선택한 아이디"], sorted.map((o) => [o.label, o.users.length, pctOf(o.users.length), o.users.join(" ")])),
            )
          }
        >
          CSV 저장
        </button>
      </div>
      <ol className="space-y-2">
        {sorted.map((o, i) => (
          <li key={o.label + i} className="text-[14px]">
            <div className="flex items-center gap-2">
              <span className="w-6 text-gray-400 text-right">{i + 1}</span>
              <span className="w-40 truncate font-semibold text-gray-800" title={o.label}>{o.label}</span>
              <div className="flex-1 bg-gray-100 rounded h-4">
                <div className={`h-4 rounded ${i === 0 && o.users.length > 0 ? "bg-[#E5541B]" : "bg-[#303236]"}`} style={{ width: `${(o.users.length / max) * 100}%` }} />
              </div>
              <span className="w-24 text-right font-bold text-[#303236]">{n(o.users.length)}명 <span className="font-normal text-gray-400">{pctOf(o.users.length)}%</span></span>
            </div>
            {o.users.length > 0 && (
              <details className="ml-8">
                <summary className="cursor-pointer text-[12px] text-gray-400 hover:underline">선택한 아이디 보기</summary>
                <p className="mt-1 text-[12px] text-gray-500 break-all">{o.users.map((u) => "@" + u).join(" ")}</p>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 참여 분석 차트·지표 (추첨 화면의 2번과 이벤트 기록에서 함께 사용) */
function AnalysisCharts({ ins }: { ins: GwInsights }) {
  const maxHour = Math.max(1, ...ins.hourly);
  const maxDay = Math.max(1, ...ins.daily.map((d) => d.count));
  return (
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
  );
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
  /** 악플·비정상 행동 계정 (옛 데이터에는 없음 → false 취급) */
  bad?: boolean;
  /** 악성 등록 사유 메모 */
  reason?: string;
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
  const [flagReason, setFlagReason] = useState("");
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
  // 불러온 댓글에서 아이디별 가장 최근 댓글 ID — 기록에 댓글 ID가 없을 때(예전 기록·복원) DM 발송 대상 찾기용
  // DM 자동 발송(댓글 비공개 답장)은 "댓글을 단 지 7일 이내"만 가능 → 이벤트 기간을 정할 때 참고하는 추천 일정
  //  · 가장 이른 댓글(아직 댓글이 없으면 오늘)을 시작으로 보고, 그날 + 7일이 자동 DM 가능 기한
  //  · 추천 마감 = 기한 − 2일 (마감 후 2일 안에 추첨·확정·DM 발송을 끝낼 여유)
  const dmPlan = useMemo(() => {
    const times = rows.map((r) => (r.ts ? Date.parse(r.ts) : NaN)).filter((n) => !Number.isNaN(n));
    const first = times.length ? Math.min(...times) : null;
    const now = Date.now();
    const base = first ?? now;
    const limit = base + 7 * DAY_MS;
    const end = new Date(base + 5 * DAY_MS);
    end.setHours(23, 59, 0, 0);
    return {
      hasComments: first !== null,
      base,
      limit,
      recommendedEnd: end.getTime(),
      expired: times.filter((t) => now - t > 7 * DAY_MS).length,
      total: times.length,
      daysLeft: Math.floor((limit - now) / DAY_MS),
    };
  }, [rows]);
  const [fetchedIds, setFetchedIds] = useState<Record<string, string>>({});
  const commentIdByUser = useMemo(() => {
    const m: Record<string, string> = { ...fetchedIds };
    const ts: Record<string, number> = {};
    for (const c of rows) {
      if (!c.id) continue;
      const k = c.user.toLowerCase();
      const t = c.ts ? Date.parse(c.ts) : 0;
      if (!(k in m) || t >= ts[k]) {
        m[k] = c.id;
        ts[k] = t;
      }
    }
    return m;
  }, [rows, fetchedIds]);

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
          .filter((f) => f.cherry || f.bad)
          .map((f) => f.user.toLowerCase()),
      ]),
      dedupe,
      from: fromStr ? Date.parse(fromStr) : undefined,
      to: toStr ? Date.parse(toStr) : undefined,
      minLength: clamp(minLength || 0, 0, 500),
    }),
    [minMentions, keywords, exclude, dedupe, fromStr, toStr, minLength, flags],
  );

  const an = useMemo(() => analyze(rows, opts), [rows, opts]);
  const ins = useMemo(() => insights(rows), [rows]);

  // 선택형 이벤트 분석: 제품(선택지)을 하나씩 추가한다. 제품명 + 댓글에서 찾을 키워드(쉼표 구분, 비우면 제품명).
  // 입력값은 이 브라우저에 기억해 둔다.
  const CHOICE_KEY = "workup_gw_choice_items_v1";
  const [choiceItems, setChoiceItems] = useState<{ id: string; name: string; keys: string }[]>(() => {
    const blank = [{ id: newId(), name: "", keys: "" }];
    try {
      if (typeof window === "undefined") return blank;
      const raw = localStorage.getItem(CHOICE_KEY);
      if (raw) {
        const list = JSON.parse(raw) as { id: string; name: string; keys: string }[];
        if (Array.isArray(list) && list.length) return list;
      }
      // 예전 한 칸 입력 방식("제품명 = 키워드")으로 저장된 값을 옮긴다.
      const old = parseChoices(localStorage.getItem("workup_gw_choices_v1") || "");
      if (old.length) return old.map((c) => ({ id: newId(), name: c.label, keys: c.keys.join(", ") }));
    } catch {}
    return blank;
  });
  const choiceRes = useMemo(() => {
    const choices = choiceItems
      .filter((i) => i.name.trim())
      .map((i) => ({
        label: i.name.trim(),
        keys: (i.keys.trim() || i.name).split(",").map((k) => k.trim().toLowerCase()).filter(Boolean),
      }));
    if (!choices.length) return null;
    const ex = new Set(exclude.split(/[\s,]+/).map((x) => x.replace(/^@/, "").toLowerCase()).filter(Boolean));
    return analyzeChoices(rows, choices, ex);
  }, [choiceItems, rows, exclude]);
  const updateChoiceItems = (next: { id: string; name: string; keys: string }[]) => {
    setChoiceItems(next);
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(next));
    } catch {}
  };

  // 불러온 댓글(참여 분석의 원본)을 이 브라우저에 임시 저장 → 새로고침·탭 이동 후에도 추첨 확정 전까지 그대로 쓴다.
  // 확정하면 지우고(분석 결과는 이벤트 기록에 저장됨), 다시 불러오면 덮어쓴다.
  const [draftAt, setDraftAt] = useState("");
  const stage = useStageRecorder();
  const [supersedeId, setSupersedeId] = useState<string | null>(null); // 재추첨 진행 중 — 대체될 이전 확정 기록
  // 이벤트 기록 목록 — 지금 다시 추첨 중인 이벤트의 이전 기록은 숨긴다(진행 중인 건 기록에 섞이지 않게)
  // 방금 확정한 현재 이벤트(record)도 숨긴다 — 다음 이벤트를 시작(댓글 새로 불러오기·비우기)하면 그때 리포트 목록에 들어간다.
  const pastHistory = useMemo(
    () =>
      history.filter((h) => {
        if (h.id === supersedeId || h.id === record?.id) return false;
        // 확정 전 재추첨이 진행 중이면, 같은 게시물·같은 이름의 이전 확정 기록(= 같은 이벤트)도 진행 중 항목이므로 숨긴다.
        if (results.length > 0 && !record && h.postUrl === url.trim() && (h.eventName || "") === eventName.trim()) return false;
        return true;
      }),
    [history, supersedeId, record, results.length, url, eventName],
  );

  // ── 이벤트 기록 병합(묶기): 같은 이벤트를 상품별로 나눠 추첨한 기록을 한 줄로 묶어 본다 ──
  const [mergeSel, setMergeSel] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const historyView = useMemo(() => {
    const shown = pastHistory.filter((h) => !histQuery.trim() || ((h.eventName || "") + (h.groupName || "")).toLowerCase().includes(histQuery.trim().toLowerCase()));
    const groups: Record<string, DrawRecord[]> = {};
    for (const h of shown) if (h.groupId) (groups[h.groupId] ||= []).push(h);
    const seen = new Set<string>();
    const ordered: DrawRecord[] = [];
    for (const h of shown) {
      if (!h.groupId) ordered.push(h);
      else if (!seen.has(h.groupId)) {
        seen.add(h.groupId);
        ordered.push(...groups[h.groupId]);
      }
    }
    return { ordered, groups };
  }, [pastHistory, histQuery]);
  /** 이름들의 공통 앞부분 ("…(패딩)" / "…(스웻셔츠)" → "…") — 병합 이름 기본값 */
  const commonName = (names: string[]) => {
    if (!names.length) return "";
    let p = names[0];
    for (const n of names.slice(1)) {
      let i = 0;
      while (i < p.length && i < n.length && p[i] === n[i]) i++;
      p = p.slice(0, i);
    }
    return p.replace(/[\s(（\[\-–·,]+$/, "").trim();
  };
  const mergeSelected = () => {
    const recs = stateRef.current.history.filter((h) => mergeSel.includes(h.id));
    if (recs.length < 2) return;
    const name = prompt("병합한 이벤트 이름을 입력해 주세요. 기록은 각각 그대로 유지되고, 목록에서 한 줄로 묶여 보입니다.", commonName(recs.map((r) => r.eventName || "")));
    if (name === null) return;
    const gid = `g${Date.now().toString(36)}`;
    const nm = name.trim() || recs[0].eventName || "병합된 이벤트";
    saveHistory(stateRef.current.history.map((h) => (mergeSel.includes(h.id) ? { ...h, groupId: gid, groupName: nm } : h)));
    setMergeSel([]);
    setOpenGroups((g) => [...g, gid]);
  };
  const ungroup = (gid: string) => {
    if (!confirm("병합을 해제할까요? 기록은 그대로 남고 각각 따로 보입니다.")) return;
    saveHistory(stateRef.current.history.map((h) => (h.groupId === gid ? { ...h, groupId: undefined, groupName: undefined } : h)));
  };
  /** 확정된 당첨자로 발표 영상 제작 (예비·취소·교체로 빠진 사람 제외, 승급자는 포함) */
  const makeVideo = (h: DrawRecord) => {
    const winners = h.winners
      .filter((w) => w.status === "확정" && (!w.label.startsWith("예비") || (w.note || "").includes("승급")))
      .map((w) => ({ label: w.label, user: w.user, prize: w.prize || w.label.replace(/\s*\d+$/, "") }));
    // 취소·교체로 빠진 번호 때문에 "8, 9, 11, 12 …"처럼 건너뛰지 않도록, 영상에서는 상품별로 1번부터 차례로 다시 매긴다
    const order: string[] = [];
    for (const w of winners) if (!order.includes(w.prize)) order.push(w.prize);
    const numOf = (l: string) => Number(l.match(/(\d+)\s*$/)?.[1] ?? 0);
    winners.sort((a, b) => order.indexOf(a.prize) - order.indexOf(b.prize) || numOf(a.label) - numOf(b.label));
    const count: Record<string, number> = {};
    for (const w of winners) count[w.prize] = (count[w.prize] || 0) + 1;
    const seen: Record<string, number> = {};
    for (const w of winners) {
      seen[w.prize] = (seen[w.prize] || 0) + 1;
      w.label = count[w.prize] > 1 ? `${w.prize} ${seen[w.prize]}` : w.prize;
    }
    if (!winners.length) {
      alert("확정된 당첨자가 없습니다.");
      return;
    }
    // 이름이 굴러갈 때 보여줄 참여자: 같은 게시물 댓글을 불러온 상태일 때만 (아니면 당첨자끼리)
    const pool = rows.length && h.postUrl && h.postUrl === url.trim() ? [...new Set(rows.map((r) => r.user))] : [];
    void stage.make({ title: h.eventName || "당첨자 발표", winners, pool });
  };
  const [showAnalysis, setShowAnalysis] = useState(true); // 2. 참여 분석 펼침
  const [showCond, setShowCond] = useState(false); // 추첨 조건 상세 팝업
  useEffect(() => {
    if (!showCond) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowCond(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCond]);
  const [showHistory, setShowHistory] = useState(false); // 이벤트 기록 팝업
  useEffect(() => {
    if (!showHistory) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowHistory(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHistory]);
  // ── 진행 중 작업 저장: 불러온 댓글 + 추첨 조건. 이 브라우저(즉시) + 서버(다른 PC·재접속) 양쪽에 둔다. ──
  // 추첨을 확정하면 지운다(분석 결과는 이벤트 기록에 저장됨). 확정 전 추첨 결과는 저장하지 않는다.
  const draftReady = useRef(false);
  type Draft = {
    savedMs?: number;
    savedAt?: string;
    url?: string;
    source?: "api" | "paste";
    apiRows?: GwComment[];
    pasteText?: string;
    eventName?: string;
    includeReplies?: boolean;
    prizes?: Prize[];
    backupsN?: number;
    minMentions?: number;
    keywords?: string;
    exclude?: string;
    dedupe?: boolean;
    minLength?: number;
    fromStr?: string;
    toStr?: string;
    /** 추첨 결과(예비 당첨자 포함)·추첨 시점 정보·확정 기록 — 확정·DM·배송 완료까지 페이지를 벗어났다 와도 이어서 쓴다 */
    record?: DrawRecord | null;
    /** 재추첨 중이면 대체될 이전 확정 기록 id — 새로고침해도 이벤트 기록 목록에서 계속 숨긴다 */
    supersedeId?: string | null;
    results?: ResultItem[];
    snap?: { stamp: ReturnType<typeof stampNow>; postUrl: string; participants: number; validComments: number; fingerprint: string; conditions: string; prizes: { name: string; count: number }[] };
  };
  const applyDraft = (d: Draft) => {
    setUrl(d.url || "");
    setEventName(d.eventName || "");
    setApiRows(Array.isArray(d.apiRows) ? d.apiRows : []);
    setPasteText(d.pasteText || "");
    setSource(d.source === "api" ? "api" : "paste");
    if (typeof d.includeReplies === "boolean") setIncludeReplies(d.includeReplies);
    if (Array.isArray(d.prizes) && d.prizes.length) setPrizes(d.prizes);
    if (typeof d.backupsN === "number") setBackupsN(d.backupsN);
    if (typeof d.minMentions === "number") setMinMentions(d.minMentions);
    if (typeof d.keywords === "string") setKeywords(d.keywords);
    if (typeof d.exclude === "string") setExclude(d.exclude);
    if (typeof d.dedupe === "boolean") setDedupe(d.dedupe);
    if (typeof d.minLength === "number") setMinLength(d.minLength);
    if (typeof d.fromStr === "string") setFromStr(d.fromStr);
    if (typeof d.toStr === "string") setToStr(d.toStr);
    if (d.supersedeId) setSupersedeId(d.supersedeId);
    if (Array.isArray(d.results) && d.results.length && d.snap) {
      setResults(d.results);
      // 참여자 명단(valid·total)은 복원된 댓글·조건으로 다시 계산해 확정 때 채운다(빈 배열 표시)
      drawSnap.current = { ...d.snap, valid: [], total: 0 };
      setStageLabel("추첨 완료");
      setStageName("복원된 추첨 결과 · 확정 전");
      if (d.record) setRecord(d.record); // 확정된 상태면 확정 화면(배송 정보 수집 등)까지 그대로 복원
    }
    setDraftAt(d.savedAt || "");
  };
  const hasContent = (d: Draft | null | undefined) => !!d && ((d.apiRows?.length ?? 0) > 0 || !!d.pasteText);
  useEffect(() => {
    let local: Draft | null = null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) local = JSON.parse(raw) as Draft;
    } catch {
      /* 무시 */
    }
    if (hasContent(local)) applyDraft(local as Draft);
    draftReady.current = true;
    // 서버에 더 최근 저장본이 있으면(다른 PC·브라우저 데이터 삭제 후) 그걸 쓴다.
    fetch("/api/admin/giveaway/draft")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const sv = j?.draft as Draft | null | undefined;
        if (hasContent(sv) && (sv!.savedMs || 0) > (local?.savedMs || 0)) applyDraft(sv!);
      })
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!draftReady.current) return;
    if (rows.length === 0) return;
    const savedMs = Date.now();
    const savedAt = new Date(savedMs).toLocaleString("ko-KR");
    const sn = drawSnap.current;
    const d: Draft = {
      savedMs, savedAt, url, source, apiRows, pasteText, eventName, includeReplies, prizes, backupsN, minMentions, keywords, exclude, dedupe, minLength, fromStr, toStr,
      ...(results.length && sn && !drawing
        ? { record, supersedeId, results, snap: { stamp: sn.stamp, postUrl: sn.postUrl, participants: sn.participants, validComments: sn.validComments, fingerprint: sn.fingerprint, conditions: sn.conditions, prizes: sn.prizes } }
        : {}),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* 용량 초과 등 — 브라우저 저장만 건너뜀(서버 저장은 계속) */
    }
    setDraftAt(savedAt);
    const t = setTimeout(() => {
      fetch("/api/admin/giveaway/draft", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: d }) }).catch(() => null);
    }, 1500);
    return () => clearTimeout(t);
  }, [url, source, apiRows, pasteText, eventName, includeReplies, prizes, backupsN, minMentions, keywords, exclude, dedupe, minLength, fromStr, toStr, rows.length, record, results, drawing, supersedeId]);
  /** 확정 전 추첨(당첨자·예비 명단)만 삭제 — 불러온 댓글·조건은 그대로 두어 바로 다시 추첨할 수 있다 */
  const discardDraw = () => {
    if (drawing || record) return;
    if (!confirm("확정하지 않은 이번 추첨 결과(당첨자·예비 명단)를 삭제할까요? 불러온 댓글과 추첨 조건은 그대로 남습니다.")) return;
    setResults([]);
    drawSnap.current = null;
    setStageLabel("");
    setStageName("");
    setReplaceIdx(null);
    setMsg("");
    setSupersedeId(null); // 재추첨을 취소하면 이전 확정 기록은 다시 기록 목록에 보인다
  };
  /** 배송까지 끝난 이벤트 정리: 임시 저장·화면을 비운다(이 이벤트는 이벤트 기록 목록에 들어간다) */
  const finishSession = () => {
    clearDraft();
    setApiRows([]);
    setPasteText("");
    setSource("paste");
    setResults([]);
    setRecord(null);
    setSupersedeId(null);
    drawSnap.current = null;
    setStageLabel("");
    setStageName("");
  };
  /**
   * 이벤트 완료 처리/취소 — 배송 정보 수집 패널의 "이벤트 완료 처리"에서 호출(모든 당첨자 발송 후에만 활성화).
   * 현재 진행 중인 이벤트를 완료하면 불러온 댓글·임시 저장을 정리하고 이벤트는 이벤트 기록(완료)으로 들어간다.
   */
  const completeEvent = (id: string, done: boolean) => {
    const at = done ? new Date().toISOString() : undefined;
    const next = stateRef.current.history.map((h) => (h.id === id ? { ...h, completedAt: at } : h));
    saveHistory(next);
    if (record?.id === id) {
      if (done) finishSession();
      else setRecord({ ...record, completedAt: undefined });
    }
  };
  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    fetch("/api/admin/giveaway/draft", { method: "DELETE" }).catch(() => null);
    setDraftAt("");
  };

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
  const toggleFlag = (user: string, kind: "cherry" | "noFollow" | "bad", event?: string, reason?: string) => {
    const key = user.toLowerCase();
    const cur: UserFlag = stateRef.current.flags[key] ?? { user, cherry: false, noFollow: false, bad: false, events: [], at: new Date().toLocaleString("ko-KR") };
    const next: UserFlag = { ...cur, [kind]: !cur[kind] };
    if (kind === "noFollow") next.events = next.noFollow ? (event ? [...new Set([...cur.events, event])] : cur.events) : [];
    if (kind === "bad") next.reason = next.bad ? reason?.trim() || cur.reason : undefined;
    const all = { ...stateRef.current.flags };
    if (!next.cherry && !next.noFollow && !next.bad) delete all[key];
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
  const flagCount = (k: "cherry" | "noFollow" | "bad") => Object.values(flags).filter((f) => f[k]).length;

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

  /**
   * 댓글 ID만 다시 불러오기 — 추첨 결과·확정 기록·불러온 댓글은 그대로 두고, 아이디별 최신 댓글 ID만 받아 DM 자동 발송에 쓴다.
   * (댓글 ID 저장 기능이 생기기 전에 만든 기록이나, 복원된 화면에서 필요) 돌려주는 값: 받은 아이디 수
   */
  const loadCommentIds = async (postUrl: string): Promise<number> => {
    const u = (postUrl || url).trim();
    if (!u) throw new Error("게시물 주소가 없습니다. 1. 댓글 불러오기에 게시물 주소를 입력해 주세요.");
    let list: GwComment[];
    if (useServer) {
      const r = await fetch("/api/admin/giveaway/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u, includeReplies: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `요청 실패 (${r.status})`);
      list = j.comments as GwComment[];
    } else {
      list = await fetchInstagramComments({ url: u, token, igId, includeReplies: true, onProgress: () => {} });
    }
    const m: Record<string, string> = {};
    const ts: Record<string, number> = {};
    for (const c of list) {
      if (!c.id) continue;
      const k = c.user.toLowerCase();
      const t = c.ts ? Date.parse(c.ts) : 0;
      if (!(k in m) || t >= ts[k]) {
        m[k] = c.id;
        ts[k] = t;
      }
    }
    setFetchedIds(m);
    return Object.keys(m).length;
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
      commentId: i.comment.id, // DM 자동 발송(댓글 비공개 답장)용
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
      analysis: { ins, choices: choiceRes ?? undefined },
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

  /** 지금 화면의 참여 분석 결과를 이벤트 기록에 저장한다 (확정 후에도 추가·갱신 가능) */
  const saveAnalysisTo = (h: DrawRecord) => {
    const rec = { ...h, analysis: { ins, choices: choiceRes ?? undefined } };
    if (record?.id === h.id) setRecord(rec);
    saveHistory(stateRef.current.history.map((x) => (x.id === h.id ? rec : x)));
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
            totalComments: snap.valid.length ? snap.total : an.total,
            participants: (snap.valid.length ? snap.valid : an.valid).map((c) => ({ user: c.user, text: c.text, ts: c.ts, likes: c.likes, isReply: c.isReply })),
          }),
        });
        rec.hasDetail = r.ok;
      } catch {
        rec.hasDetail = false;
      }
      setRecord(rec);
      // 같은 이벤트를 다시 추첨해 확정한 경우 이전 확정 기록은 새 결과로 대체한다(기록이 중복되지 않게)
      const old = supersedeId;
      saveHistory([rec, ...stateRef.current.history.filter((h) => h.id !== old)].slice(0, 200));
      if (old) {
        void fetch(`/api/admin/giveaway/event/${old}`, { method: "DELETE" }).catch(() => null);
        setSupersedeId(null);
      }
      // 임시 저장은 지우지 않는다 — DM·배송 완료까지 같은 화면을 이어 쓰고, "작업 완료"를 누를 때 정리한다.
    } finally {
      setConfirming(false);
    }
  };

  const draw = async () => {
    if (drawing) return;
    if (results.length > 0 && !record && !confirm("확정하지 않은 추첨 결과가 사라집니다. 다시 추첨할까요?")) return;
    if (record && !confirm("이미 확정된 기록이 있습니다. 다시 추첨해 확정하면 기존 기록은 새 결과로 대체됩니다. 계속할까요?")) return;
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
    if (record) setSupersedeId(record.id); // 진행 중인 재추첨이 끝나 확정되기 전까지 기록 목록에서 숨기고, 확정 시 대체
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
      if (stateRef.current.flags[u.toLowerCase()]?.bad && !confirm(`@${u}는 악성 계정으로 등록돼 있습니다. 그래도 교체 당첨자로 지정할까요?`)) return;
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
  const announceText = (deadline: string) => {
    const live = results.filter((r) => r.status === "ok" && r.role === "winner");
    return buildAnnounce((record?.eventName || eventName).trim(), live.map((r) => ({ prize: r.prize || "상품", user: r.comment.user })), deadline);
  };
  const copyAnnounce = async () => {
    try {
      const dl = record ? await fetchClaimDeadline(record.id) : "";
      await navigator.clipboard.writeText(announceText(dl));
      flash("ann");
    } catch {
      flash("fail");
    }
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  /** 응모자 CSV — 불러온 댓글 전체(필터 적용 전). "추첨 대상" 열로 조건을 통과한 댓글과 제외된 댓글을 구분한다. */
  const exportParticipants = () => {
    const validSet = new Set(an.valid);
    downloadText(
      `giveaway-participants-${stamp()}.csv`,
      toCsv(
        ["아이디", "댓글", "작성시각", "좋아요", "대댓글", "추첨 대상"],
        rows.map((r) => [r.user, r.text, r.ts || "", r.likes ?? "", r.isReply ? "Y" : "", validSet.has(r) ? "대상" : "제외(조건 미충족)"]),
      ),
    );
  };
  const exportWinners = () =>
    downloadText(
      `giveaway-winners-${stamp()}.csv`,
      toCsv(
        ["구분", "상품", "아이디", "상태", "팔로우확인", "댓글", "비고"],
        results.map((r) => [r.label, r.prize, r.comment.user, r.status === "void" ? "취소" : "확정", r.followOk ? "완료" : "", r.comment.text, r.note]),
      ),
    );
  // ── 저장된 이벤트 기록용 내보내기 (추첨 직후 화면이 아니어도 기록에서 바로 쓴다) ──
  const recWinners = (h: DrawRecord) => h.winners.filter((w) => w.status === "확정" && (!w.label.startsWith("예비") || (w.note || "").includes("승급")));
  const recCopy = async (h: DrawRecord, kind: "copy" | "ann") => {
    const live = h.winners.filter((w) => w.status === "확정");
    let text: string;
    if (kind === "copy") {
      text = live.map((w) => `${recWinners(h).includes(w) ? "당첨" : "예비"} @${w.user}`).join("\n");
    } else {
      const dl = await fetchClaimDeadline(h.id);
      text = buildAnnounce((h.eventName || "").trim(), recWinners(h).map((w) => ({ prize: w.prize || "상품", user: w.user })), dl);
    }
    try {
      await navigator.clipboard.writeText(text);
      flash(`${kind}-${h.id}`);
    } catch {
      flash("fail");
    }
  };
  const recCsv = (h: DrawRecord) =>
    downloadText(
      `giveaway-winners-${h.id}.csv`,
      toCsv(["구분", "상품", "아이디", "팔로우확인", "비고"], recWinners(h).map((w) => [w.label, w.prize, w.user, w.followOk ? "완료" : "", w.note])),
    );
  /**
   * 당첨자 프로필 열기 — 브라우저는 버튼 한 번에 새 탭을 여러 개 여는 것을 팝업으로 막는다(첫 탭만 열리거나 전부 막힘).
   * 그래서 목록 창을 띄우고, "다음 프로필 열기"를 누를 때마다 한 탭씩 연다(클릭 한 번에 한 탭은 항상 허용).
   */
  const [profileUsers, setProfileUsers] = useState<string[] | null>(null);
  const [profileOpened, setProfileOpened] = useState<string[]>([]);
  const openProfiles = (list: { user: string }[]) => {
    const users = [...new Set(list.map((x) => x.user))];
    setProfileOpened([]);
    setProfileUsers(users);
  };
  const openProfileNext = () => {
    const next = (profileUsers ?? []).find((u) => !profileOpened.includes(u));
    if (!next) return;
    window.open(igUrl(next), "_blank", "noopener");
    setProfileOpened((o) => [...o, next]);
  };
  const dropParts = [
    an.dropped.excluded && `제외 ${an.dropped.excluded}`,
    an.dropped.filtered && `미충족 ${an.dropped.filtered}`,
    an.dropped.outOfRange && `기간밖 ${an.dropped.outOfRange}`,
    an.dropped.short && `짧음 ${an.dropped.short}`,
    an.dropped.dup && `중복 ${an.dropped.dup}`,
  ].filter(Boolean);

  // 영역별 접기 — 제목을 누르면 아래 내용이 접히고 펼쳐진다
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const foldTitle = (key: string, text: ReactNode) => (
    <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">
      <button type="button" className="inline-flex items-center gap-2 text-left" onClick={() => setFolded((f) => ({ ...f, [key]: !f[key] }))} aria-expanded={!folded[key]} title={folded[key] ? "펼치기" : "접기"}>
        <span className="text-gray-400 text-[13px] w-3">{folded[key] ? "▶" : "▼"}</span>
        {text}
      </button>
    </h2>
  );

  const card = "bg-white border border-gray-200 rounded-xl p-6";
  const input =
    "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[15px] focus:outline-none focus:border-[#303236]";
  const label = "block text-[13px] font-semibold text-gray-600 mb-1";
  const cInput =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:border-[#303236]";
  const btn = "px-5 py-2.5 rounded-lg text-[15px] font-bold transition-colors disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-xl font-bold text-gray-900">인스타그램 댓글 추첨 · 분석</h1>
        <p className="text-sm text-gray-400">
          게시물 주소로 댓글을 불러와 참여 현황을 분석하고, 조건에 맞는 참여자를 공정하게 추첨합니다.
        </p>
      </div>

      {/* 1. 댓글 불러오기 */}
      <section className={`${card} !p-4`}>
        {/* 제목 | 게시물·릴스 주소 | 내 게시물에서 선택 — 한 줄 */}
        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap mb-2">
          {foldTitle("load", "1. 댓글 불러오기")}
          <input className={`${input} !py-2 flex-1 min-w-[200px]`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="게시물 · 릴스 주소  https://www.instagram.com/p/XXXXXXXX/" aria-label="게시물 · 릴스 주소" />
          <button className="shrink-0 px-4 py-2 rounded-lg border border-gray-300 text-[14px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap" onClick={loadMedia} disabled={mediaLoading}>
            {mediaLoading ? "불러오는 중…" : "내 게시물에서 선택"}
          </button>
          {mediaList && <button className="shrink-0 text-[13px] text-gray-400 underline whitespace-nowrap" onClick={() => setMediaList(null)}>닫기</button>}
        </div>
        {!folded.load && (
        <>
        <div className="grid md:grid-cols-2 gap-x-4 gap-y-2">
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
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <button className={`${btn} !py-1.5 bg-[#E5541B] text-white hover:bg-[#cc4915]`} onClick={load} disabled={fetching}>
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
        {/* DM 자동 발송 가능 기간 추천 — 이벤트 시작 때 게시물을 불러오면 며칠까지 진행해야 하는지 알려준다 */}
        <div className={`mt-2 flex items-center gap-x-3 gap-y-1 flex-wrap rounded-lg border px-3 py-2 text-[13px] ${dmPlan.hasComments && dmPlan.expired > 0 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>
          <span className="font-bold">📅 DM 자동 발송 가능 기간</span>
          {dmPlan.hasComments ? (
            <span>
              가장 이른 댓글 {fmtMD(dmPlan.base)} → 자동 DM 가능 기한 <b>{fmtMD(dmPlan.limit)}</b>
              {dmPlan.daysLeft >= 0 ? ` (D-${dmPlan.daysLeft})` : " (지남)"}
              {dmPlan.expired > 0 ? ` · 7일이 지난 댓글 ${fmt(dmPlan.expired)}개는 자동 DM 불가(문구 복사로 직접 발송)` : " · 전부 자동 발송 가능"}
            </span>
          ) : (
            <span>
              {fmtMD(dmPlan.base)} 시작이면 이벤트는 <b>{fmtMD(dmPlan.recommendedEnd)}까지</b>(5일) 진행하고, 추첨·확정·DM 발송은 <b>{fmtMD(dmPlan.limit)} 안에</b> 끝내세요.
            </span>
          )}
          <button
            type="button"
            className="ml-auto px-2.5 py-1 rounded-md border border-current/30 bg-white/70 font-semibold whitespace-nowrap hover:bg-white"
            onClick={() => {
              setFromStr(toLocalInputMs(dmPlan.base));
              setToStr(toLocalInputMs(dmPlan.recommendedEnd));
            }}
            title="추첨 조건의 댓글 시작·마감 시각에 추천 기간(시작 ~ 시작+5일 23:59)을 넣습니다."
          >
            추천 기간을 댓글 기간에 적용
          </button>
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
              <button className="text-[14px] text-gray-500 underline" onClick={() => { setSource("paste"); setPasteText(""); setApiRows([]); setResults([]); setRecord(null); clearDraft(); }}>
                비우기
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </section>

      {/* 2. 참여 분석 */}
      <section className={card}>
        <div className={`flex items-baseline gap-x-3 gap-y-1 flex-wrap ${showAnalysis ? "mb-4" : ""}`}>
          <button className="text-left" onClick={() => setShowAnalysis((v) => !v)} aria-expanded={showAnalysis}>
            <h2 className="text-xl font-bold text-gray-800">
              <span className="text-gray-400 text-[14px] mr-2">{showAnalysis ? "▼" : "▶"}</span>2. 참여 분석
              <span className="ml-2 text-[13px] font-normal text-gray-400">{showAnalysis ? "접기" : "펼치기"}</span>
            </h2>
          </button>
          {rows.length > 0 && !record && draftAt && (
            <span className="text-[13px] text-gray-400">
              불러온 댓글·분석을 저장해 둠 ({draftAt}) · 추첨을 확정하면 정리됩니다{" "}
              <button className="underline hover:text-red-600" onClick={() => { if (confirm("저장된 댓글·분석을 지울까요?")) { setApiRows([]); setPasteText(""); setSource("paste"); setResults([]); clearDraft(); } }}>
                지우기
              </button>
            </span>
          )}
        </div>
        {!showAnalysis ? null : rows.length === 0 ? (
          <p className="text-[15px] text-gray-400">아직 불러온 댓글이 없습니다.</p>
        ) : (
          <>
            <AnalysisCharts ins={ins} />

            {/* 선택형 이벤트: 댓글로 고른 제품별 선택 수 */}
            <div className="mt-6 border-t border-gray-100 pt-5">
              <h3 className="text-[15px] font-bold text-gray-700">제품 선택 분석 <span className="font-normal text-[13px] text-gray-400">(댓글로 제품을 고르는 이벤트용)</span></h3>
              <div className="mt-2 grid md:grid-cols-12 gap-x-6 gap-y-3 items-start">
                <div className="md:col-span-5">
                  <div className="space-y-2">
                    {choiceItems.map((it) => (
                      <div key={it.id} className="flex items-center gap-1.5">
                        <input
                          className={`${cInput} !w-32 !py-1.5 shrink-0`}
                          value={it.name}
                          onChange={(e) => updateChoiceItems(choiceItems.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))}
                          placeholder="제품명"
                          aria-label="제품명"
                        />
                        <input
                          className={`${cInput} !py-1.5 min-w-0`}
                          value={it.keys}
                          onChange={(e) => updateChoiceItems(choiceItems.map((x) => (x.id === it.id ? { ...x, keys: e.target.value } : x)))}
                          placeholder="찾을 키워드 (쉼표 구분, 비우면 제품명)"
                          aria-label="찾을 키워드"
                        />
                        <button
                          className="px-1 text-[16px] leading-none text-gray-400 hover:text-red-600 disabled:opacity-30 shrink-0"
                          onClick={() => updateChoiceItems(choiceItems.filter((x) => x.id !== it.id))}
                          disabled={choiceItems.length <= 1}
                          aria-label="제품 삭제"
                          title="제품 삭제"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      className="px-3 py-1.5 rounded-lg border border-dashed border-[#E5541B]/50 text-[14px] font-semibold text-[#E5541B] hover:bg-orange-50 whitespace-nowrap"
                      onClick={() => updateChoiceItems([...choiceItems, { id: newId(), name: "", keys: "" }])}
                    >
                      + 제품 추가
                    </button>
                  </div>
                  <p className="mt-1 text-[12px] text-gray-400">같은 사람이 같은 제품을 여러 번 써도 1명으로 셉니다. 숫자 키워드(1)는 독립된 숫자로만 찾아서 01·1번은 포함하고 10·12는 제외합니다. 제외 아이디는 자동 제외됩니다.</p>
                </div>
                <div className="md:col-span-7 min-w-0">
                  {choiceRes ? <ChoiceSummary res={choiceRes} name={eventName || "event"} /> : <p className="text-[13px] text-gray-400 pt-2">제품과 키워드를 입력하면 결과가 여기에 표시됩니다.</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* 3. 추첨 조건 · 추첨 결과 (추첨 영역을 따로 두지 않고 조건 아래에 이어 붙인다) */}
      <section id="gw-draw-section" className={`${card} relative overflow-hidden`}>
        <canvas ref={confettiRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {foldTitle("cond", "3. 추첨 조건")}
          <input className={`${cInput} flex-1 min-w-[220px]`} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="이벤트 이름 (이력 관리용) 예: 11월 신상 오픈 기념 댓글 이벤트" aria-label="이벤트 이름 (이력 관리용)" />
          <button className={`${btn} bg-[#303236] text-white hover:bg-black text-[16px] px-6 py-2 whitespace-nowrap`} onClick={draw} disabled={drawing || !an.users.size}>
            {drawing ? "추첨 중…" : results.length ? "다시 추첨" : "추첨하기"}
          </button>
        </div>
        {!folded.cond && (
        <>
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
          {/* 조건 요약 바: 왼쪽 = 댓글 집계·응모 방식, 오른쪽 = 제외 요약 + 상세 설정 버튼 */}
          <div className="col-span-2 md:col-span-12 flex items-center justify-between gap-x-4 gap-y-2 flex-wrap min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[14px] text-gray-600">
              <p className="text-gray-800">
                {rows.length ? (
                  <>
                    댓글 <b>{fmt(an.total)}</b> → 유효 <b>{fmt(an.valid.length)}</b>
                    {an.users.size !== an.valid.length && <> · 참여자 <b>{fmt(an.users.size)}</b></>}
                    {dropParts.length > 0 && <span className="text-gray-400" title="유효하지 않은 댓글 내역 (제외 아이디 · 조건 미충족 · 기간 밖 · 너무 짧음 · 중복)"> ({dropParts.join(" · ")})</span>}
                  </>
                ) : (
                  "불러온 댓글이 없습니다."
                )}
              </p>
              <label className="flex items-center gap-1.5 text-gray-700" title="끄면 유효 댓글 1개가 응모권 1장">
                <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
                1인 1회
              </label>
              <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-[12px]" title="표시 관리에 등록된 체리피커는 항상 추첨에서 제외됩니다">체리 {flagCount("cherry")}</span>
              <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-[12px]" title="비팔로우 이력자는 제외하지 않고 '비팔로우 이력' 표기만 합니다">비팔로우 {flagCount("noFollow")}</span>
              <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-[12px]" title="악플·비정상 행동으로 등록한 계정은 항상 추첨에서 제외됩니다">악성 {flagCount("bad")}</span>
            </div>
            <div className="flex items-center gap-3 ml-auto min-w-0">
              <span className="text-[13px] text-gray-400 truncate">
                제외 {exclude.split(/[\s,]+/).filter(Boolean).length}{fromStr || toStr ? " · 기간" : ""} · 표시 {Object.keys(flags).length}
              </span>
              <button className="shrink-0 whitespace-nowrap min-h-[32px] px-3 rounded-lg border border-gray-300 text-[13px] font-semibold text-[#303236] hover:bg-gray-50" onClick={() => setShowCond(true)} title="제외 아이디 · 댓글 기간 · 표시된 참여자 설정">
                조건 설정
              </button>
            </div>
          </div>
        </div>

        {/* 조건 상세 설정 팝업 */}
        {showCond && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setShowCond(false)} role="dialog" aria-modal="true" aria-label="추첨 조건 상세 설정">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-10 p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">제외 아이디 · 댓글 기간 설정</h3>
                <button className="px-3 py-1.5 rounded-lg border border-gray-300 text-[14px] font-semibold text-gray-700 hover:bg-gray-50" onClick={() => setShowCond(false)}>
                  닫기 ✕
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              {/* 표시된 참여자 (비팔로우·체리·악성) — 칩의 글자를 눌러 해제 */}
              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-bold text-gray-800 mb-2">
                  표시된 참여자 <span className="font-normal text-[13px] text-gray-500">비팔로우 {flagCount("noFollow")} · 체리 {flagCount("cherry")} · 악성 {flagCount("bad")}</span>
                </p>
                {Object.keys(flags).length === 0 ? (
                  <p className="text-[13px] text-gray-400">표시된 참여자가 없습니다. 4번 &quot;참여자 표시 관리&quot;에서 추가할 수 있습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {Object.values(flags)
                      .sort((x, y) => x.user.localeCompare(y.user))
                      .map((f) => (
                        <span key={f.user} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-gray-100 text-[12px]" title={[f.events.length ? `비팔로우: ${f.events.join(", ")}` : "", f.bad && f.reason ? `악성 사유: ${f.reason}` : ""].filter(Boolean).join(" / ") || undefined}>
                          <a className="hover:underline" href={igUrl(f.user)} target="_blank" rel="noopener noreferrer">@{f.user}</a>
                          {f.noFollow && <button className="px-1 rounded bg-red-100 text-red-700 font-bold" onClick={() => toggleFlag(f.user, "noFollow", eventTitle())} title="비팔로우 해제">비</button>}
                          {f.cherry && <button className="px-1 rounded bg-purple-100 text-purple-700 font-bold" onClick={() => toggleFlag(f.user, "cherry")} title="체리피커 해제">체</button>}
                          {f.bad && <button className="px-1 rounded bg-gray-800 text-white font-bold" onClick={() => toggleFlag(f.user, "bad")} title={`악성 해제${f.reason ? ` (사유: ${f.reason})` : ""}`}>악</button>}
                          {f.bad && f.reason && <span className="text-gray-500 max-w-[10rem] truncate">{f.reason}</span>}
                          {winBadge(f.user)}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div className="mt-5 text-right">
                <button className="min-h-[40px] px-5 rounded-lg bg-[#303236] text-white text-[14px] font-semibold hover:bg-black" onClick={() => setShowCond(false)}>
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {msg && <p className="mt-3 text-[14px] text-amber-700">{msg}</p>}
        {/* 추첨 진행·결과 한 줄 배너 */}
        {(drawing || results.length > 0) && (
          <div className="mt-3 bg-[#0f172a] rounded-xl px-6 py-4 flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-center">
            <span className="text-slate-400 text-[14px]">{stageLabel}</span>
            <span className="text-white text-2xl font-black break-all">
              {!drawing && record ? `당첨 ${results.filter((r) => r.status === "ok" && r.role === "winner").length}명 · 확정됨` : stageName}
            </span>
          </div>
        )}

        </>
        )}
      </section>

      {/* 3-2. 추첨 결과 (당첨자·예비 리스트) — 조건과 분리 */}
      {results.length > 0 && (
        <section className={card}>
          <div className="flex items-center gap-3 flex-wrap">
            {foldTitle("res", <>추첨 결과 <span className="text-[14px] font-normal text-gray-400">당첨 {results.filter((r) => r.status === "ok" && r.role === "winner").length}명 · 예비 {results.filter((r) => r.status === "ok" && r.role === "backup").length}명{record ? " · 확정됨" : " · 확정 전"}</span></>)}
          </div>
          {!folded.res && (
          <>
        {results.length > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[14px] text-gray-600">
                팔로우 확인 <b>{results.filter((r) => r.status === "ok" && r.role === "winner" && r.followOk).length}</b> /{" "}
                {results.filter((r) => r.status === "ok" && r.role === "winner").length}명 · 인스타 프로필에서 팔로우를 확인한 뒤 체크하세요.
              </p>
              {!record && !drawing && (
                <button className="px-3 py-1.5 rounded-lg border border-red-200 text-[13px] font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap" onClick={discardDraw} title="당첨자·예비 명단을 한 번에 모두 비웁니다. 불러온 댓글과 조건은 그대로 남습니다.">
                  🗑 추첨 리스트 전체 비우기
                </button>
              )}
            </div>
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
                    {f?.bad && <span className="px-1.5 py-0.5 rounded bg-gray-800 text-white text-[11px] font-bold shrink-0" title={f.reason || "악성 계정으로 등록됨"}>악성 계정</span>}
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
                        <button className="min-h-[32px] text-[13px] text-gray-800 hover:underline whitespace-nowrap" onClick={() => toggleFlag(r.comment.user, "bad")} title="악플·비정상 행동 계정으로 등록 (다음 추첨부터 자동 제외)">
                          {f?.bad ? "악성 해제" : "악성 등록"}
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[13px] text-emerald-700 break-all">
                  ✓ 확정됨 · 이력에 저장됨 · {shortAt(record.at)} · 참여자 {fmt(record.participants)}명 · 명단 지문 {record.fingerprint.slice(0, 12)}…
                  <span className="text-gray-400"> · 이 화면은 이벤트 완료 처리 전까지 임시 저장됩니다</span>
                </p>
                <span className="text-[12px] text-gray-500">📦 모든 당첨자에게 발송한 뒤 아래 배송 정보 수집의 <b>“이벤트 완료 처리”</b>를 누르세요.</span>
              </div>
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
            <div className="flex flex-wrap items-center gap-2 mt-3 [&>button]:!px-4 [&>button]:!py-2 [&>button]:!text-[14px]">
              <button className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={copyAnnounce} title="상품별로 당첨 아이디를 묶은 인스타 공지용 문구를 복사합니다">
                {copied === "ann" ? "복사됨" : "공지용 복사"}
              </button>
              <button className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={() => openProfiles(results.filter((r) => r.status === "ok" && r.role === "winner").map((r) => ({ user: r.comment.user })))}>당첨자 프로필 모두 열기 ↗</button>
              <button className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={exportWinners}>당첨자 CSV</button>
              <button className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={exportParticipants} title="불러온 댓글 전체를 담습니다. '추첨 대상' 열에 조건을 통과한 댓글(대상)과 제외된 댓글을 구분해 표시합니다.">응모자 CSV ({fmt(rows.length)})</button>
              <span className="hidden md:block flex-1" />
              <button className={`${btn} bg-[#303236] text-white hover:bg-black disabled:opacity-40`} onClick={() => record && makeVideo(record)} disabled={!record} title={record ? "확정된 당첨자로 인스타용 세로 영상(9:16)을 만듭니다" : "당첨을 확정하면 만들 수 있습니다"}>
                🎬 당첨 발표 영상 만들기
              </button>
            </div>
          </div>
        )}
          </>
          )}
        </section>
      )}

      {/* 3-3. 배송 정보 수집 — 추첨 결과와 분리 */}
      {record && !drawing && (
        <section className={card}>
          <div className="flex items-center gap-3 flex-wrap">
            {foldTitle("ship", "📦 배송 정보 수집")}
          </div>
          {!folded.ship && (
            <GiveawayClaimPanel key={record.id} record={record} bare commentIdByUser={commentIdByUser} onLoadCommentIds={loadCommentIds} onComplete={completeEvent} />
          )}
        </section>
      )}

      {/* 4. 참여자 표시 관리 (비팔로우 · 체리피커) */}
      <section className={card}>
        <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap mb-3">
          {foldTitle("flags", "4. 참여자 표시 관리")}
          <span className="text-[13px] text-gray-400">비팔로우·체리피커·악성(악플·비정상 행동) 계정을 표시해 두면 다음 추첨에서 자동 제외할 수 있습니다 · 서버 저장(PC 공통)</span>
        </div>
        {!folded.flags && (
        <>
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
          <input className={`${cInput} !w-44`} value={flagReason} onChange={(e) => setFlagReason(e.target.value.slice(0, 60))} placeholder="악성 사유 메모(선택)" />
          <button className="px-3 py-2 rounded-lg border border-gray-800 text-[13px] font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-40 whitespace-nowrap" disabled={!flagAdd} onClick={() => { if (!flags[flagAdd.toLowerCase()]?.bad) toggleFlag(flagAdd, "bad", undefined, flagReason); setFlagAdd(""); setFlagReason(""); }}>
            악성 계정 추가
          </button>
          {rows.length > 0 && <input className={`${cInput} !w-52 md:ml-auto`} value={flagQuery} onChange={(e) => setFlagQuery(e.target.value)} placeholder="이번 게시물 참여자 검색" />}
        </div>

        {/* 표시된 참여자 — 있을 때만, 칩 형태로 */}

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
                      <button className={`hover:underline ${f?.bad ? "text-gray-900 font-bold" : "text-gray-400"}`} onClick={() => toggleFlag(u, "bad")}>{f?.bad ? "악성✓" : "악성"}</button>
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
        </>
        )}
      </section>

      {/* 5. 이벤트 기록 (서버 DB 저장) — 기본은 한 줄 요약, 눌러서 펼치면 상세 */}
      {(history.length > 0 || results.length > 0) && (
        <section className={card}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {foldTitle("hist", <>5. 이벤트 기록 <span className="text-[14px] font-normal text-gray-400">({pastHistory.length}건 · 서버 DB 저장)</span></>)}
            <button className="min-h-[40px] px-4 rounded-lg bg-[#303236] text-white text-[14px] font-semibold hover:bg-black disabled:opacity-40" onClick={() => setShowHistory(true)} disabled={history.length === 0}>
              이벤트 기록 리포트 보기
            </button>
          </div>
          {/* 지금 진행 중인 이벤트 — 기록(리포트) 팝업에는 들어가지 않고 여기 따로 보인다. 작업 완료 후 기록으로 이동 */}
          {!folded.hist && results.length > 0 && (() => {
            const winnersLive = results.filter((r) => r.status === "ok" && r.role === "winner");
            const checkedN = winnersLive.filter((r) => r.followOk).length;
            return (
              <div className="mt-3">
                <p className="text-[13px] font-semibold text-gray-500 mb-1">진행 중</p>
                <div className="flex items-center gap-2 rounded-lg border border-[#E5541B]/40 bg-orange-50 pr-3">
                <button
                  className="flex-1 min-w-0 flex items-center gap-3 py-2.5 px-3 text-left rounded-lg hover:bg-orange-100/60"
                  onClick={() => document.getElementById("gw-draw-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  title="추첨 화면으로 이동"
                >
                  <span className="px-2 py-0.5 rounded-full text-[12px] font-bold bg-[#E5541B] text-white whitespace-nowrap">{record ? "확정됨 · 진행 중" : "확정 전"}</span>
                  <span className="font-bold text-gray-900 truncate min-w-0 flex-1">{eventName.trim() || record?.eventName || "(이름 없는 이벤트)"}</span>
                  <span className="text-gray-500 text-[13px] whitespace-nowrap">참여 {fmt(an.users.size)}</span>
                  <span className="text-gray-700 text-[13px] whitespace-nowrap">당첨 {winnersLive.length}</span>
                  <span className={`text-[12px] whitespace-nowrap ${winnersLive.length && checkedN === winnersLive.length ? "text-emerald-600" : "text-amber-600"}`}>팔로우 {checkedN}/{winnersLive.length}</span>
                  <span className="text-gray-400 text-[12px] whitespace-nowrap hidden sm:inline">↑ 추첨 화면</span>
                </button>
                {!record && (
                  <button className="shrink-0 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-[13px] font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap" onClick={discardDraw} disabled={drawing} title="확정하지 않은 이번 추첨 결과(당첨자·예비 명단)를 삭제합니다. 불러온 댓글과 조건은 그대로 남습니다.">
                    추첨 삭제
                  </button>
                )}
                </div>
                <p className="mt-1 text-[12px] text-gray-400">모든 당첨자 발송 후 &quot;이벤트 완료 처리&quot;를 하거나 다음 이벤트를 시작하면 위 &quot;이벤트 기록 리포트&quot; 목록에 들어갑니다.</p>
              </div>
            );
          })()}
        </section>
      )}

      {/* 당첨자 프로필 열기 창 */}
      {profileUsers && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4" onClick={() => setProfileUsers(null)} role="dialog" aria-modal="true" aria-label="당첨자 프로필 열기">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-800">당첨자 프로필 열기</h3>
                <p className="text-[12px] text-gray-500">{profileOpened.length} / {profileUsers.length}명 열었습니다</p>
              </div>
              <button className="px-3 py-1.5 rounded-lg border border-gray-300 text-[14px] font-semibold text-gray-700 hover:bg-gray-50" onClick={() => setProfileUsers(null)}>닫기 ✕</button>
            </div>
            <div className="px-5 py-3 space-y-2 border-b border-gray-100">
              <button
                className="w-full min-h-[44px] rounded-lg bg-[#303236] text-white text-[15px] font-bold hover:bg-black disabled:opacity-40"
                onClick={openProfileNext}
                disabled={profileOpened.length >= profileUsers.length}
              >
                {profileOpened.length >= profileUsers.length ? "모두 열었습니다" : `▶ 다음 프로필 열기 (@${profileUsers.find((u) => !profileOpened.includes(u))})`}
              </button>
              <p className="text-[12px] text-gray-400">브라우저는 버튼 한 번에 새 탭 여러 개를 막아서, 한 번 누를 때마다 한 명씩 열립니다. 아래 아이디를 눌러 직접 열어도 됩니다.</p>
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-gray-100 px-5">
              {profileUsers.map((u) => (
                <li key={u} className="py-2 flex items-center gap-2 text-[14px]">
                  <span className={profileOpened.includes(u) ? "text-emerald-600" : "text-gray-300"}>{profileOpened.includes(u) ? "✓" : "○"}</span>
                  <a className="font-semibold text-gray-800 hover:underline" href={igUrl(u)} target="_blank" rel="noopener noreferrer" onClick={() => setProfileOpened((o) => (o.includes(u) ? o : [...o, u]))}>
                    @{u} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 추첨 녹화 무대 (9:16 영상) */}
      {stage.modal}

      {/* 이벤트 기록 팝업 — 저장된 이벤트 리포트 목록 */}
      {history.length > 0 && showHistory && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setShowHistory(false)} role="dialog" aria-modal="true" aria-label="이벤트 기록">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-6 p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <h2 className="text-xl font-bold text-gray-800">이벤트 기록 <span className="text-[14px] font-normal text-gray-400">({pastHistory.length}건)</span></h2>
            <div className="flex items-center gap-3">
              <input className={`${cInput} !w-48`} value={histQuery} onChange={(e) => setHistQuery(e.target.value)} placeholder="이벤트 이름 검색" />
              <button className="text-[13px] text-gray-400 hover:text-red-600 whitespace-nowrap" onClick={async () => { if (confirm("이벤트 기록을 모두 삭제할까요? 참여자 명단도 함께 삭제되며 되돌릴 수 없습니다.")) { const all = history; saveHistory([]); await Promise.all(all.map((x) => fetch(`/api/admin/giveaway/event/${x.id}`, { method: "DELETE" }).catch(() => null))); setOpenId(null); setExpandId(null); setShowHistory(false); } }}>
                전체 삭제
              </button>
              <button className="px-3 py-1.5 rounded-lg border border-gray-300 text-[14px] font-semibold text-gray-700 hover:bg-gray-50" onClick={() => setShowHistory(false)}>
                닫기 ✕
              </button>
            </div>
          </div>
          {mergeSel.length >= 2 && (
            <div className="mb-2 flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[13px] text-sky-900">
              <span>{mergeSel.length}건 선택됨</span>
              <button className="px-3 py-1 rounded-md bg-sky-600 text-white font-semibold hover:bg-sky-700" onClick={mergeSelected}>선택한 기록 병합</button>
              <button className="ml-auto text-gray-500 hover:underline" onClick={() => setMergeSel([])}>선택 해제</button>
            </div>
          )}
          {mergeSel.length < 2 && pastHistory.filter((h) => !h.groupId).length >= 2 && (
            <p className="mb-1 text-[12px] text-gray-400">☑ 같은 이벤트를 상품별로 나눠 만든 기록은 앞의 체크박스를 2개 이상 선택해 병합할 수 있어요.</p>
          )}
          {pastHistory.length === 0 && <p className="py-6 text-center text-[14px] text-gray-400">아직 지난 이벤트 기록이 없습니다. 현재 이벤트는 다음 이벤트를 시작하면 여기에 들어갑니다.</p>}
          <ul className="divide-y divide-gray-100">
            {historyView.ordered
              .map((h) => {
                const gid = h.groupId;
                const members = gid ? historyView.groups[gid] : null;
                const firstOfGroup = !!gid && members![0].id === h.id;
                const groupOpen = !gid || openGroups.includes(gid);
                const confirmed = h.winners.filter((w) => w.status === "확정" && (!w.label.startsWith("예비") || (w.note || "").includes("승급")));
                const checked = confirmed.filter((w) => w.followOk).length;
                const open = expandId === h.id;
                const groupHeader =
                  firstOfGroup && members ? (
                    <li key={`g-${gid}`} className="text-[14px]">
                      <div className="flex items-center gap-3 py-2.5 bg-sky-50/60 px-1 rounded">
                        <button className="flex-1 min-w-0 flex items-center gap-3 text-left" onClick={() => setOpenGroups((g) => (g.includes(gid!) ? g.filter((x) => x !== gid) : [...g, gid!]))} aria-expanded={groupOpen}>
                          <span className="text-gray-400 text-[12px] w-3 shrink-0">{groupOpen ? "▼" : "▶"}</span>
                          <span className="font-bold text-gray-900 truncate min-w-0 flex-1">{h.groupName || "병합된 이벤트"}</span>
                          <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold whitespace-nowrap">병합 {members.length}건</span>
                          <span className="text-gray-500 text-[13px] whitespace-nowrap">참여 {fmt(Math.max(...members.map((m) => m.participants)))}</span>
                          <span className="text-gray-700 text-[13px] whitespace-nowrap">
                            당첨 {members.reduce((n, m) => n + m.winners.filter((w) => w.status === "확정" && (!w.label.startsWith("예비") || (w.note || "").includes("승급"))).length, 0)}
                          </span>
                          {members.every((m) => m.completedAt) ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold whitespace-nowrap">✅ 완료</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold whitespace-nowrap">진행 중 {members.filter((m) => m.completedAt).length}/{members.length}</span>
                          )}
                        </button>
                        <button className="text-[12px] text-gray-400 hover:text-red-600 whitespace-nowrap" onClick={() => ungroup(gid!)}>병합 해제</button>
                      </div>
                    </li>
                  ) : null;
                return (
                  <Fragment key={h.id}>
                  {groupHeader}
                  {groupOpen && (
                  <li className={`text-[14px] ${gid ? "pl-5 border-l-2 border-sky-200 ml-2" : ""}`}>
                    {/* 요약 한 줄 */}
                    <div className="flex items-center gap-2">
                      {!gid && (
                        <input type="checkbox" className="w-4 h-4 shrink-0 accent-sky-600" checked={mergeSel.includes(h.id)} onChange={() => setMergeSel((m) => (m.includes(h.id) ? m.filter((x) => x !== h.id) : [...m, h.id]))} aria-label="병합할 기록 선택" title="같은 이벤트를 나눠 만든 기록을 2개 이상 체크하면 위에서 병합할 수 있어요" />
                      )}
                    <button className="flex-1 min-w-0 flex items-center gap-3 py-2.5 text-left hover:bg-gray-50" onClick={() => setExpandId(open ? null : h.id)} aria-expanded={open}>
                      <span className="text-gray-400 text-[12px] w-3 shrink-0">{open ? "▼" : "▶"}</span>
                      <span className="font-bold text-gray-900 truncate min-w-0 flex-1">{h.eventName || "(이름 없는 이벤트)"}</span>
                      <span className="text-gray-400 text-[13px] whitespace-nowrap hidden sm:inline">{shortAt(h.at).split(" ")[0]}</span>
                      <span className="text-gray-500 text-[13px] whitespace-nowrap">참여 {fmt(h.participants)}</span>
                      <span className="text-gray-700 text-[13px] whitespace-nowrap">당첨 {confirmed.length}</span>
                      <span className={`text-[12px] whitespace-nowrap ${confirmed.length && checked === confirmed.length ? "text-emerald-600" : "text-amber-600"}`}>팔로우 {checked}/{confirmed.length}</span>
                      {h.completedAt ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold whitespace-nowrap">✅ 완료</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold whitespace-nowrap">진행 중</span>
                      )}
                    </button>
                    </div>

                    {open && (
                      <div className="pb-3 pl-6 space-y-2">
                        <p className="text-gray-400 text-[12px] break-all">
                          {shortAt(h.at)} · <a className="hover:underline" href={h.postUrl} target="_blank" rel="noopener noreferrer">{h.postUrl || "(직접 입력)"}</a>
                        </p>
                        <p className="text-gray-500 text-[12px]">{h.conditions}</p>
                        <div className="flex flex-wrap gap-2">
                          <button className="min-h-[36px] px-3 rounded-lg bg-gray-100 text-[13px] font-semibold text-gray-700 hover:bg-gray-200" onClick={() => recCopy(h, "ann")} title="상품별로 당첨 아이디를 묶은 인스타 공지용 문구를 복사합니다">
                            {copied === `ann-${h.id}` ? "복사됨" : "공지용 복사"}
                          </button>
                          <button className="min-h-[36px] px-3 rounded-lg bg-gray-100 text-[13px] font-semibold text-gray-700 hover:bg-gray-200" onClick={() => openProfiles(recWinners(h).map((w) => ({ user: w.user })))}>
                            당첨자 프로필 모두 열기 ↗
                          </button>
                          <button className="min-h-[36px] px-3 rounded-lg bg-gray-100 text-[13px] font-semibold text-gray-700 hover:bg-gray-200" onClick={() => recCsv(h)}>
                            당첨자 CSV
                          </button>
                          <button className="min-h-[36px] px-3 rounded-lg bg-[#303236] text-[13px] font-semibold text-white hover:bg-black" onClick={() => makeVideo(h)} title="확정된 당첨자로 인스타용 세로 영상(9:16)을 만듭니다">
                            🎬 당첨 발표 영상
                          </button>
                        </div>
                        {/* 당첨자 목록은 배송 정보 리스트가 대신한다(링크 생성 전에는 패널이 당첨자만 미리 보여 줌) */}
                        <details className="border border-gray-200 rounded-xl px-4 py-3">
                          <summary className="cursor-pointer text-[14px] font-bold text-gray-800">
                            참여 분석 보기 {h.analysis ? <span className="font-normal text-[12px] text-gray-400">· 저장된 결과</span> : <span className="font-normal text-[12px] text-gray-400">· 저장된 분석 없음</span>}
                          </summary>
                          <div className="mt-3">
                            {rows.length > 0 && h.postUrl && h.postUrl === url.trim() && (
                              <button className="mb-3 min-h-[32px] px-3 rounded-lg border border-gray-300 text-[13px] font-semibold text-gray-700 hover:bg-gray-50" onClick={() => saveAnalysisTo(h)} title="지금 불러온 댓글로 계산한 참여 분석(제품 선택 포함)을 이 기록에 저장합니다.">
                                {h.analysis ? "현재 분석으로 갱신" : "현재 분석 결과 저장"}
                              </button>
                            )}
                            {h.analysis ? (
                              <>
                                <AnalysisCharts ins={h.analysis.ins} />
                                {h.analysis.choices && (
                                  <div className="mt-6 border-t border-gray-100 pt-5">
                                    <h3 className="text-[15px] font-bold text-gray-700">제품 선택 분석</h3>
                                    <ChoiceSummary res={h.analysis.choices} name={h.eventName || "event"} />
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-[12px] text-gray-400">당첨을 확정하면 참여 분석이 자동으로 저장됩니다. 이미 확정한 이벤트는 같은 게시물 주소로 댓글을 불러온 상태에서 &quot;현재 분석 결과 저장&quot;을 누르세요.</p>
                            )}
                          </div>
                        </details>
                        <GiveawayClaimPanel record={h} commentIdByUser={commentIdByUser} onLoadCommentIds={loadCommentIds} onComplete={completeEvent} />
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
                  )}
                  </Fragment>
                );
              })}
          </ul>
          </div>
        </div>
      )}
    </div>
  );
}
