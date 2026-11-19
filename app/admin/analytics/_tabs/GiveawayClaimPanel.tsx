"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { downloadText, toCsv } from "@/lib/giveaway";
import type { ClaimDoc } from "@/lib/giveaway-claims";

// 당첨자 배송 정보 수집 패널 — 확정된 이벤트 기록의 당첨자에게 고유 링크를 만들어 주고 제출 현황을 보여준다.
interface RecordLike {
  id: string;
  eventName?: string;
  postUrl?: string;
  /** 이벤트 완료 처리 시각 (ISO) — 모든 당첨자 발송 후에만 설정 가능 */
  completedAt?: string;
  winners: { label: string; prize?: string; user: string; status: string; note?: string; commentId?: string }[];
}

const cInput =
  "border border-gray-300 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:border-[#303236]";
/** 택배 송장 업로드용 고정값 (송장양식.xlsx 의 "엑셀파일 첫행-제목없음" 시트 F·G·H 열). 계약이 바뀌면 여기만 고치면 된다. */
const INVOICE_DEFAULTS = { qty: 1, fee: 2600, code: "010" };

/** 연락처를 010-0000-0000 형태로 (11자리·10자리 숫자일 때만, 아니면 입력값 그대로) */
const fmtPhone = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return d.startsWith("02") ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return v;
};

const smallBtn =
  "min-h-[36px] px-3 rounded-lg border border-gray-300 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap disabled:opacity-40";

/** 확정된 당첨자만 (예비 중 승급하지 않은 사람·취소된 사람 제외) */
const winnersOf = (r: RecordLike) =>
  r.winners.filter((w) => w.status === "확정" && (!w.label.startsWith("예비") || (w.note || "").includes("승급")));

/** datetime-local 기본값: 7일 뒤 23:59 (로컬 시각) */
function defaultDeadline() {
  const d = new Date(Date.now() + 7 * 86400000);
  d.setHours(23, 59, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** 화면용 간결한 일시: "11/18 15:55" (24시간제) */
const fmtDt = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
/** 당첨자에게 보내는 안내문용 일시: "11월 20일(목) 오후 11:59" */
const fmtDtLong = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${["일", "월", "화", "수", "목", "금", "토"][d.getDay()]}) ${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** DM 문구를 마지막으로 복사한 시각 (토큰별, 이 브라우저에 저장) */
const DM_KEY = "workup_dm_copied_v1";
const readDmCopied = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(DM_KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

/** DM 자동 발송 시각 (토큰별, 이 브라우저에 저장) */
const DM_SENT_KEY = "workup_dm_sent_v1";
const readDmSent = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(DM_SENT_KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

export default function GiveawayClaimPanel({ record, commentIdByUser = {}, onLoadCommentIds, onComplete, bare = false }: { record: RecordLike; commentIdByUser?: Record<string, string>; onLoadCommentIds?: (postUrl: string) => Promise<number>; onComplete?: (id: string, done: boolean) => void; bare?: boolean }) {
  const [doc, setDoc] = useState<ClaimDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [sizesText, setSizesText] = useState("");
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [dmCopied, setDmCopied] = useState<Record<string, string>>(() => (typeof window === "undefined" ? {} : readDmCopied()));
  // DM 자동 발송 결과 — 발송 시각(이 브라우저에 저장, 중복 발송 방지)과 이번 실패 사유
  const [dmSent, setDmSent] = useState<Record<string, string>>(() => (typeof window === "undefined" ? {} : readDmSent()));
  const [dmErr, setDmErr] = useState<Record<string, string>>({});
  const [dmSending, setDmSending] = useState(false);

  const winners = winnersOf(record);
  /** DM 발송·복사 기록 키 — 토큰이 아니라 "이벤트:아이디"로 저장해, 링크를 짧게 재발급해도 기록이 사라지지 않는다 */
  const dk = (e: { user: string }) => `${record.id}:${e.user.toLowerCase()}`;
  const sentOf = (e: { user: string; token: string }) => dmSent[dk(e)] ?? dmSent[e.token];
  const copiedOf = (e: { user: string; token: string }) => dmCopied[dk(e)] ?? dmCopied[e.token];
  const base = () => (typeof window === "undefined" ? "" : window.location.origin);
  const linkOf = (token: string) => `${base()}/claim/${token}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/giveaway/claims/${record.id}`);
      const j = r.ok ? ((await r.json()) as { doc: ClaimDoc | null }) : { doc: null };
      setDoc(j.doc);
      if (j.doc) {
        setDeadline(toLocalInput(j.doc.deadline));
        setSizesText(j.doc.sizes.join(", "));
      }
    } catch {
      setMsg("불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [record.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (reissueShort = false) => {
    if (!winners.length) return setMsg("당첨자가 없습니다.");
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/admin/giveaway/claims/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: record.eventName || "",
          deadline: new Date(deadline).toISOString(),
          sizes: sizesText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
          winners: winners.map((w) => ({ user: w.user, prize: w.prize || "", label: w.label })),
          reissueShort,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "저장하지 못했습니다.");
      setDoc(j.doc as ClaimDoc);
      setMsg(reissueShort ? "짧은 링크로 다시 만들었습니다. DM 문구를 새로 복사·발송해 주세요." : "링크를 저장했습니다.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // 추가 당첨자가 생기면 배송 리스트에 자동 반영 (기존 링크·제출 내용은 유지, 새 당첨자만 추가). 빠진 당첨자는 자동 삭제하지 않는다.
  const autoSynced = useRef("");
  useEffect(() => {
    if (!doc || busy || !winners.length) return;
    const missing = winners.filter((w) => !doc.entries.some((e) => e.user.toLowerCase() === w.user.toLowerCase()));
    if (!missing.length) return;
    const sig = missing.map((w) => w.user.toLowerCase()).sort().join(",");
    if (autoSynced.current === sig) return;
    autoSynced.current = sig;
    void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, winners.length, busy]);

  const remove = async () => {
    if (!confirm("제출된 배송 정보(이름·연락처·주소)와 링크를 모두 삭제할까요? 되돌릴 수 없습니다.")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/giveaway/claims/${record.id}`, { method: "DELETE" });
      setDoc(null);
      setMsg("삭제했습니다.");
    } finally {
      setBusy(false);
    }
  };

  /** 잘못 입력한 당첨자의 제출 내용만 초기화 (같은 링크로 재입력 가능) */
  const resetEntry = async (e: { token: string; user: string }) => {
    if (!confirm(`@${e.user}님이 제출한 배송 정보를 초기화할까요?\n입력 내용이 삭제되고, 기존 링크로 다시 입력할 수 있게 됩니다.`)) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/admin/giveaway/claims/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: e.token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "초기화하지 못했습니다.");
      setDoc(j.doc as ClaimDoc);
      setOpenUser(null);
      setMsg(`@${e.user} 제출 내용을 초기화했습니다. DM으로 링크를 다시 안내해 주세요.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "초기화하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(""), 1500);
  };
  /** DM 문구 복사 + 복사 시각 기록 (다시 복사하면 최신 시각으로 갱신) */
  const copyDm = async (e: { token: string; user: string; prize: string }) => {
    try {
      await navigator.clipboard.writeText(dmText(e.user, e.prize, e.token));
      const next = { ...readDmCopied(), [dk(e)]: new Date().toISOString() };
      try {
        localStorage.setItem(DM_KEY, JSON.stringify(next));
      } catch {}
      setDmCopied(next);
      setCopied(e.token);
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(""), 1500);
  };
  const dmText = (user: string, prize: string, token: string) =>
    `@${user}님, ${record.eventName || "이벤트"}에 당첨되셨습니다! 🎉${prize ? `\n🎁 ${prize}` : ""}\n경품 배송을 위해 아래 링크에서 ${doc ? fmtDtLong(doc.deadline) : "기한"}까지 배송 정보를 입력해 주세요.\n${linkOf(token)}\n\n※ 링크에서 입력만 해 주시면 되고, 이 DM에는 따로 답장하지 않으셔도 됩니다.\n※ 제출 후에도 ${doc ? fmtDtLong(doc.deadline) : "마감"}까지는 같은 링크에서 수정할 수 있어요. 단, 배송 준비(송장 처리)가 시작되면 수정이 어려우니 미리 꼭 확인해 주세요.`;

  /** 댓글 ID: 기록(당첨 당시)에 저장된 값 → 없으면 지금 불러온 댓글에서 찾는다 */
  const commentIdOf = (user: string) =>
    record.winners.find((w) => w.user.toLowerCase() === user.toLowerCase() && w.commentId)?.commentId || commentIdByUser[user.toLowerCase()] || "";

  /** DM 자동 발송(댓글 비공개 답장) — targets 각각에 안내문+신청 링크를 보낸다. 성공한 사람은 발송 시각을 기록해 중복 발송을 막는다. */
  const sendDms = async (targets: { token: string; user: string; prize: string }[]) => {
    if (!targets.length) return;
    setDmSending(true);
    setDmErr({});
    try {
      const r = await fetch("/api/admin/giveaway/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: targets.map((t) => ({ user: t.user, commentId: commentIdOf(t.user), text: dmText(t.user, t.prize, t.token) })) }),
      });
      const j = (await r.json().catch(() => ({}))) as { results?: { user: string; ok: boolean; error?: string }[]; error?: string };
      if (!r.ok) throw new Error(j.error || "발송 요청에 실패했습니다.");
      const nextSent = { ...readDmSent() };
      const errs: Record<string, string> = {};
      let ok = 0;
      for (const res of j.results ?? []) {
        const t = targets.find((x) => x.user === res.user);
        if (!t) continue;
        if (res.ok) {
          nextSent[dk(t)] = new Date().toISOString();
          ok++;
        } else errs[t.token] = res.error || "발송 실패";
      }
      try {
        localStorage.setItem(DM_SENT_KEY, JSON.stringify(nextSent));
      } catch {}
      setDmSent(nextSent);
      setDmErr(errs);
      setMsg(`DM 발송 완료 ${ok}명${Object.keys(errs).length ? ` · 실패 ${Object.keys(errs).length}명 (아래 사유 확인)` : ""}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "DM 발송에 실패했습니다.");
    } finally {
      setDmSending(false);
    }
  };
  const sendAllDms = () => {
    if (!doc) return;
    const targets = doc.entries.filter((e) => !sentOf(e)).map((e) => ({ token: e.token, user: e.user, prize: e.prize }));
    if (!targets.length) return setMsg("모두 이미 발송했습니다.");
    if (!confirm(`${targets.length}명에게 DM을 자동 발송할까요? (이미 발송한 ${doc.entries.length - targets.length}명은 제외 · 댓글 작성 후 7일 이내만 가능)`)) return;
    void sendDms(targets);
  };

  /** 송장 처리(잠금)·해제 */
  const lockEntries = async (tokens: string[], unlock = false) => {
    try {
      const r = await fetch(`/api/admin/giveaway/claims/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens, action: unlock ? "unlock" : "lock" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "처리하지 못했습니다.");
      setDoc(j.doc as ClaimDoc);
      setMsg(unlock ? "잠금을 풀었습니다 — 당첨자가 마감 전까지 다시 수정할 수 있습니다." : `송장 처리: ${tokens.length}명의 제출 내용을 잠갔습니다 (당첨자 수정 불가).`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "처리하지 못했습니다.");
    }
  };

  /** 발송 완료 처리·취소 (한 명 또는 여러 명) */
  const shipEntries = async (tokens: string[], unship = false) => {
    try {
      const r = await fetch(`/api/admin/giveaway/claims/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens, action: unship ? "unship" : "ship" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "처리하지 못했습니다.");
      setDoc(j.doc as ClaimDoc);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "처리하지 못했습니다.");
    }
  };
  const shippedN = doc?.entries.filter((e) => e.shippedAt).length ?? 0;
  const allShipped = !!doc && doc.entries.length > 0 && shippedN === doc.entries.length;
  const shipAll = () => {
    if (!doc) return;
    const rest = doc.entries.filter((e) => !e.shippedAt).map((e) => e.token);
    if (!rest.length) return;
    if (!confirm(`발송하지 않은 ${rest.length}명을 모두 "발송 완료"로 처리할까요?`)) return;
    void shipEntries(rest);
  };
  const missingIds = !!doc && doc.entries.some((e) => !commentIdOf(e.user));
  const [idLoading, setIdLoading] = useState(false);
  /** DM 발송에 필요한 댓글 ID를 게시물에서 다시 받아온다 (추첨·확정 기록은 건드리지 않음) */
  const loadIds = async () => {
    if (!onLoadCommentIds) return;
    setIdLoading(true);
    setMsg("댓글 ID를 불러오는 중…");
    try {
      const n = await onLoadCommentIds(record.postUrl || "");
      setMsg(`댓글 ID ${n}명분을 불러왔습니다. 이제 DM 발송을 눌러 주세요.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "댓글 ID를 불러오지 못했습니다.");
    } finally {
      setIdLoading(false);
    }
  };

  const submittedN = doc?.entries.filter((e) => e.submitted).length ?? 0;
  // 확정 이후 당첨자가 바뀌었는지 (링크 갱신 필요)
  const stale =
    !!doc &&
    (doc.entries.length !== winners.length ||
      winners.some((w) => !doc.entries.some((e) => e.user.toLowerCase() === w.user.toLowerCase())));

  /**
   * 송장양식 내보내기 — 사용자가 올린 송장양식.xlsx(개인정보를 지운 템플릿: public/templates/giveaway-invoice-template.xlsx)를
   * 그대로 불러와 서식(글꼴·색·테두리·열 너비·행 높이·제목 줄)을 유지한 채 제출된 당첨자 정보만 채운다.
   *  · "1차선정" 시트: 2행 제목, 3행부터 닉네임(@아이디) / 이름 / 연락처 / 주소 / 아이템(상품) / 색상 / 사이즈 / 개수
   *  · "엑셀파일 첫행-제목없음" 시트: 1행은 가이드(최종 저장 시 삭제), 1행부터 이름 | (공백) | 주소 | 전화번호 | 전화번호 | 1 | 2600 | 010 | 제품명_사이즈(1)
   *  수집 항목에 색상이 없어 색상 칸은 비워 두고, 제품명에서도 색상 부분을 생략한다.
   */
  const exportInvoice = async () => {
    if (!doc) return;
    const rows = doc.entries.filter((e) => e.submitted);
    if (!rows.length) return setMsg("제출된 정보가 없습니다.");
    setMsg("송장양식을 만드는 중…");
    try {
      const res = await fetch("/templates/giveaway-invoice-template.xlsx");
      if (!res.ok) throw new Error("송장양식 템플릿을 불러오지 못했습니다.");
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await res.arrayBuffer());
      const addr = (e: (typeof rows)[number]) => [e.submitted!.addr1, e.submitted!.addr2].filter(Boolean).join(" ");

      /** 견본 행의 서식을 복제해 data 를 채우고, 남는 행은 값·서식을 비운다. */
      const fill = (ws: import("exceljs").Worksheet, sampleRow: number, cols: number, data: (string | number | null)[][]) => {
        const sample = ws.getRow(sampleRow);
        const styles = Array.from({ length: cols }, (_, i) => ({ ...sample.getCell(i + 1).style }));
        const height = sample.height;
        const last = ws.rowCount;
        data.forEach((vals, i) => {
          const row = ws.getRow(sampleRow + i);
          // 견본 행에 높이가 없으면 템플릿 뒷줄에 남아 있는 높이(예: 3행 63.95)도 지운다.
          row.height = (height ?? undefined) as unknown as number;
          vals.forEach((v, c) => {
            const cell = row.getCell(c + 1);
            cell.style = { ...styles[c] };
            cell.value = v === "" || v === null ? null : v;
          });
          row.commit();
        });
        for (let r = sampleRow + data.length; r <= last; r++) {
          const row = ws.getRow(r);
          row.height = undefined as unknown as number;
          for (let c = 1; c <= cols; c++) {
            const cell = row.getCell(c);
            cell.value = null;
            cell.style = {};
          }
        }
      };

      const s1 = wb.getWorksheet("1차선정");
      const s2 = wb.getWorksheet("엑셀파일 첫행-제목없음");
      if (!s1 || !s2) throw new Error("템플릿 시트를 찾지 못했습니다.");
      // 시트1: A열은 비어 있고 B열(No)부터 사용. No 칸은 양식대로 비워 둔다.
      fill(s1, 3, 10, rows.map((e) => [null, null, e.user, e.submitted!.name, fmtPhone(e.submitted!.phone), addr(e), e.prize, "", e.submitted!.size, 1]));
      // 시트2: 1행은 양식의 가이드 행이므로 2행(견본 서식)부터 채운 뒤, 최종 저장 전에 1행을 삭제해 첫 줄부터 데이터가 오게 한다.
      fill(
        s2,
        2,
        9,
        rows.map((e) => [e.submitted!.name, "", addr(e), fmtPhone(e.submitted!.phone), fmtPhone(e.submitted!.phone), INVOICE_DEFAULTS.qty, INVOICE_DEFAULTS.fee, INVOICE_DEFAULTS.code, `${[e.prize, e.submitted!.size].filter(Boolean).join("_")}(1)`]),
      );
      s2.spliceRows(1, 1);

      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `송장양식_${(record.eventName || "이벤트").replace(/[\\/:*?"<>|]/g, "").slice(0, 30)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg("");
      // 송장에 담은 당첨자는 잠근다 — 이후 당첨자가 링크에서 수정할 수 없다(필요하면 목록에서 잠금 해제)
      await lockEntries(rows.map((e) => e.token));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "송장양식을 만들지 못했습니다.");
    }
  };

  const exportCsv = () =>
    doc &&
    downloadText(
      `giveaway-${record.id}-shipping.csv`,
      toCsv(
        ["아이디", "상품", "이름", "연락처", "주소", "상세주소", "사이즈", "제출시각"],
        doc.entries.map((e) => [e.user, e.prize, e.submitted?.name, e.submitted?.phone, e.submitted?.addr1, e.submitted?.addr2, e.submitted?.size, e.submitted?.at ? fmtDt(e.submitted.at) : ""]),
      ),
    );

  return (
    <div className={bare ? "mt-3" : "mt-4 border border-gray-200 rounded-xl p-4 bg-white"}>
      <div className="flex items-center gap-3 flex-wrap">
        {!bare && <h3 className="text-[15px] font-bold text-gray-800">배송 정보 수집</h3>}
        {doc && (
          <span className={`text-[13px] font-semibold ${submittedN === doc.entries.length ? "text-emerald-600" : "text-amber-600"}`}>
            제출 {submittedN}/{doc.entries.length}명 · 마감 {fmtDt(doc.deadline)}
          </span>
        )}
        {doc && (
          <span className={`text-[13px] font-semibold ${allShipped ? "text-emerald-600" : "text-gray-500"}`}>
            📦 발송 {shippedN}/{doc.entries.length}명
          </span>
        )}
        {stale && <span className="text-[12px] text-red-600">당첨자가 바뀌었습니다 — "마감·사이즈 저장"을 눌러 반영하세요</span>}
        {msg && <span className="text-[13px] text-gray-500">{msg}</span>}
        {doc && (
          <div className="ml-auto flex flex-wrap gap-2">
                {doc.entries.some((e) => !e.token.startsWith("k") && !e.submitted) && (
                  <button
                    className={`${smallBtn} !border-amber-300 !text-amber-800`}
                    disabled={busy}
                    onClick={() => confirm("아직 제출하지 않은 당첨자의 링크를 짧은 형식으로 다시 만들까요?\n기존(긴) 링크는 더 이상 쓸 수 없게 됩니다. 이미 DM으로 보낸 링크는 새 링크로 다시 안내해야 해요. (이미 제출한 사람의 링크는 그대로 유지됩니다)") && save(true)}
                    title="링크 길이를 약 90자에서 50자 안팎으로 줄입니다."
                  >
                    짧은 링크로 재발급
                  </button>
                )}
                {onComplete && (
                  record.completedAt ? (
                    <button className={`${smallBtn} !bg-emerald-50 !border-emerald-300 !text-emerald-800`} onClick={() => confirm("이벤트 완료 처리를 취소할까요?") && onComplete(record.id, false)} title={`완료 ${fmtDt(record.completedAt)}`}>
                      ✅ 완료됨 · 취소
                    </button>
                  ) : (
                    <>
                      {!allShipped && shippedN < (doc?.entries.length ?? 0) && (
                        <button className={smallBtn} onClick={shipAll} title="아직 발송 처리하지 않은 당첨자를 한 번에 발송 완료로 처리합니다.">전체 발송 완료 처리</button>
                      )}
                      <button
                        className={`${smallBtn} !bg-[#303236] !text-white !border-[#303236]`}
                        disabled={!allShipped || stale}
                        onClick={() => confirm("이 이벤트를 완료 처리할까요? 모든 당첨자 발송이 끝난 것으로 기록됩니다.") && onComplete(record.id, true)}
                        title={allShipped ? "모든 당첨자에게 발송했으므로 이벤트를 완료 처리합니다." : `아직 발송하지 않은 당첨자가 ${(doc?.entries.length ?? 0) - shippedN}명 있어 완료 처리할 수 없습니다.`}
                      >
                        {allShipped ? "이벤트 완료 처리" : `이벤트 완료 처리 (미발송 ${(doc?.entries.length ?? 0) - shippedN}명)`}
                      </button>
                    </>
                  )
                )}
                {missingIds && onLoadCommentIds && (
                  <button className={`${smallBtn} !border-sky-300 !text-sky-800`} onClick={loadIds} disabled={idLoading} title="DM 자동 발송에는 당첨자 댓글의 ID가 필요합니다. 게시물에서 댓글 ID만 다시 받아옵니다(추첨 결과는 그대로).">
                    {idLoading ? "불러오는 중…" : "댓글 ID 불러오기"}
                  </button>
                )}
                <button className={`${smallBtn} !bg-sky-50 !border-sky-300 !text-sky-800`} onClick={sendAllDms} disabled={dmSending} title="당첨자의 댓글에 비공개 답장(DM)으로 안내문과 신청 링크를 자동 발송합니다. 이미 발송한 사람은 제외됩니다.">
                  {dmSending ? "DM 발송 중…" : `DM 자동 발송 (${doc.entries.filter((e) => !sentOf(e)).length}명)`}
                </button>
                <button className={`${smallBtn} !bg-emerald-50 !border-emerald-300 !text-emerald-800`} onClick={exportInvoice} disabled={submittedN === 0} title="택배 송장 업로드용 엑셀(송장양식)로 내려받습니다. 제출된 당첨자만 포함됩니다.">송장양식 엑셀</button>
                <button className={smallBtn} onClick={exportCsv}>제출 정보 CSV</button>
                <button className={smallBtn} onClick={load}>새로고침</button>
                <button className={`${smallBtn} !text-red-600 !border-red-200`} onClick={remove} disabled={busy}>배송 정보 삭제</button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="mt-2 text-[13px] text-gray-400">불러오는 중…</p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-x-4 gap-y-2 flex-wrap">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-gray-600">
              <span className="whitespace-nowrap">신청 마감</span>
              <input type="datetime-local" className={cInput} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-gray-600 flex-1 min-w-[260px]">
              <span className="whitespace-nowrap">사이즈 선택지</span>
              <input className={`${cInput} flex-1 min-w-0`} value={sizesText} onChange={(e) => setSizesText(e.target.value)} placeholder="S, M, L, XL (쉼표 구분, 비우면 사이즈 입력 없음)" />
            </label>
            <button className={`${smallBtn} !bg-[#303236] !text-white !border-[#303236]`} onClick={() => save()} disabled={busy || !winners.length} title={doc ? "바뀐 마감·사이즈·당첨자를 기존 신청 링크에 반영합니다. 링크 주소는 그대로입니다." : "당첨자별 신청 링크를 만듭니다."}>
              {doc ? "마감·사이즈 저장" : "신청 링크 만들기"}
            </button>
          </div>

          {!doc && winners.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-[13px] text-gray-700">
              {winners.map((w, i) => (
                <li key={w.user + i}>
                  {w.label}{w.prize && !w.label.includes(w.prize) ? ` (${w.prize})` : ""} <span className="font-semibold">@{w.user}</span>
                </li>
              ))}
            </ul>
          )}

          {doc && (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-[13px] border-collapse">
                  <thead>
                    <tr className="text-left text-[12px] text-gray-500 border-y border-gray-300 bg-gray-50">
                      <th className="py-2 pl-2 pr-1 w-8 font-semibold">#</th>
                      <th className="py-2 px-2 font-semibold">아이디</th>
                      <th className="py-2 px-2 font-semibold">상품</th>
                      <th className="py-2 px-2 font-semibold">제출</th>
                      <th className="py-2 px-2 font-semibold">DM</th>
                      <th className="py-2 px-2 font-semibold">제품 발송</th>
                      <th className="py-2 px-2 pr-3 font-semibold text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.entries.map((e, i) => (
                      <Fragment key={e.token}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50/60 align-middle">
                          <td className="py-2 pl-2 pr-1 text-gray-400">{i + 1}</td>
                          <td className="py-2 px-2 font-semibold text-gray-800 whitespace-nowrap">@{e.user}</td>
                          <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{e.prize}</td>
                          {/* 제출 */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            {e.submitted ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-emerald-600 font-semibold">✓ {e.submitted.editCount ? "수정" : "제출"} {fmtDt(e.submitted.at)}</span>
                                {!!e.submitted.editCount && <span className="text-[12px] text-violet-600 font-semibold" title="당첨자가 링크에서 직접 수정했습니다. 내용 보기에서 이전 내용을 확인할 수 있습니다.">수정 {e.submitted.editCount}회</span>}
                                {e.submitted.lockedAt && <span className="text-[12px] text-gray-500 font-semibold" title={`송장 처리 ${fmtDt(e.submitted.lockedAt)} — 당첨자는 수정할 수 없습니다`}>🔒</span>}
                              </span>
                            ) : (
                              <span className="text-amber-600">미제출</span>
                            )}
                          </td>
                          {/* DM */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              {sentOf(e) || copiedOf(e) ? (
                                <span className="inline-flex flex-col leading-tight">
                                  {sentOf(e) && (
                                    <span className="inline-flex items-center gap-1 text-sky-700 font-semibold" title="DM 자동 발송">
                                      <span className="px-1 rounded bg-sky-100 text-sky-800 text-[11px] font-bold">자</span>
                                      {fmtDt(sentOf(e)!)}
                                    </span>
                                  )}
                                  {copiedOf(e) && (
                                    <span className="inline-flex items-center gap-1 text-gray-500" title="문구 복사(수동 발송용)">
                                      <span className="px-1 rounded bg-gray-100 text-gray-600 text-[11px] font-bold">수</span>
                                      {fmtDt(copiedOf(e)!)}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                              <button className="text-sky-700 hover:underline disabled:opacity-50" disabled={dmSending} onClick={() => sendDms([{ token: e.token, user: e.user, prize: e.prize }])} title="이 당첨자에게만 DM을 자동 발송합니다.">
                                {sentOf(e) ? "다시 발송" : "발송"}
                              </button>
                              <button className="text-gray-600 hover:underline" onClick={() => copyDm(e)} title="DM으로 보낼 안내문과 링크를 복사합니다. 복사할 때마다 복사 시각이 갱신됩니다.">
                                {copied === e.token ? "복사됨" : "문구 복사"}
                              </button>
                              {dmErr[e.token] && <span className="text-[12px] text-red-600 max-w-[16rem] truncate" title={dmErr[e.token]}>✗ {dmErr[e.token]}</span>}
                            </span>
                          </td>
                          {/* 제품 발송 */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <label className={`inline-flex items-center gap-1.5 cursor-pointer select-none ${e.shippedAt ? "text-emerald-700 font-semibold" : "text-gray-500"}`} title={e.shippedAt ? `발송 완료 ${fmtDt(e.shippedAt)} — 눌러서 취소` : "제품을 발송했으면 체크하세요"}>
                              <input type="checkbox" className="w-4 h-4 accent-emerald-600" checked={!!e.shippedAt} onChange={() => shipEntries([e.token], !!e.shippedAt)} />
                              {e.shippedAt ? fmtDt(e.shippedAt) : "미발송"}
                            </label>
                          </td>
                          {/* 관리 */}
                          <td className="py-2 px-2 pr-3 text-right whitespace-nowrap">
                            <span className="inline-flex items-center justify-end gap-2.5">
                              {e.submitted ? (
                                <button className="text-[#303236] font-semibold hover:underline" onClick={() => setOpenUser(openUser === e.user ? null : e.user)}>
                                  {openUser === e.user ? "닫기" : "내용 보기"}
                                </button>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </span>
                          </td>
                        </tr>
                        {openUser === e.user && e.submitted && (
                          <tr className="border-b border-gray-100">
                            <td />
                            <td colSpan={6} className="pb-2 pr-3">
                              <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-0.5 text-gray-700 bg-gray-50 rounded-lg p-3">
                                <dt className="text-gray-400">이름</dt><dd>{e.submitted.name}</dd>
                                <dt className="text-gray-400">연락처</dt><dd>{e.submitted.phone}</dd>
                                <dt className="text-gray-400">주소</dt><dd>{[e.submitted.addr1, e.submitted.addr2].filter(Boolean).join(" ")}</dd>
                                {e.submitted.size && (<><dt className="text-gray-400">사이즈</dt><dd>{e.submitted.size}</dd></>)}
                                {!!e.submitted.history?.length && (
                                  <>
                                    <dt className="text-violet-500">수정 이력</dt>
                                    <dd className="space-y-1">
                                      {e.submitted.history.map((h, k) => (
                                        <p key={k} className="text-[12px] text-gray-500">
                                          {fmtDt(h.at)} 이전 · {h.name} / {h.phone} / {[h.addr1, h.addr2].filter(Boolean).join(" ")}{h.size ? ` / ${h.size}` : ""}
                                        </p>
                                      ))}
                                    </dd>
                                  </>
                                )}
                              </dl>
                              {/* 위험한 작업은 내용을 열었을 때만 작게 보여준다 */}
                              <div className="mt-2 flex items-center gap-4 text-[12px] text-gray-400">
                                {e.submitted.lockedAt && (
                                  <button className="hover:text-gray-700 hover:underline" onClick={() => lockEntries([e.token], true)} title="잠금을 풀어 당첨자가 마감 전까지 다시 수정할 수 있게 합니다.">송장 잠금 해제</button>
                                )}
                                <button className="hover:text-red-600 hover:underline disabled:opacity-50" disabled={busy} onClick={() => resetEntry(e)} title="제출한 배송 정보를 지우고 같은 링크로 다시 입력받습니다. 삭제된 내용은 되돌릴 수 없습니다.">
                                  제출 내용 삭제(초기화)…
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-gray-400">마감 후 90일이 지나면 제출된 개인정보는 자동으로 파기됩니다.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
