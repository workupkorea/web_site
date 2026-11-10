"use client";
import { useCallback, useEffect, useState } from "react";
import { downloadText, toCsv } from "@/lib/giveaway";
import type { ClaimDoc } from "@/lib/giveaway-claims";

// 당첨자 배송 정보 수집 패널 — 확정된 이벤트 기록의 당첨자에게 고유 링크를 만들어 주고 제출 현황을 보여준다.
interface RecordLike {
  id: string;
  eventName?: string;
  winners: { label: string; prize?: string; user: string; status: string; note?: string }[];
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
const fmtDt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** DM 문구를 마지막으로 복사한 시각 (토큰별, 이 브라우저에 저장) */
const DM_KEY = "workup_dm_copied_v1";
const readDmCopied = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(DM_KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

export default function GiveawayClaimPanel({ record }: { record: RecordLike }) {
  const [doc, setDoc] = useState<ClaimDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [sizesText, setSizesText] = useState("");
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [dmCopied, setDmCopied] = useState<Record<string, string>>(() => (typeof window === "undefined" ? {} : readDmCopied()));

  const winners = winnersOf(record);
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

  const save = async () => {
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
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "저장하지 못했습니다.");
      setDoc(j.doc as ClaimDoc);
      setMsg("링크를 저장했습니다.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

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
      const next = { ...readDmCopied(), [e.token]: new Date().toISOString() };
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
    `@${user}님, ${record.eventName || "이벤트"}에 당첨되셨습니다! 🎉${prize ? `\n🎁 ${prize}` : ""}\n경품 배송을 위해 아래 링크에서 ${doc ? fmtDt(doc.deadline) : "기한"}까지 배송 정보를 입력해 주세요.\n${linkOf(token)}\n\n※ 링크에서 입력만 해 주시면 되고, 이 DM에는 따로 답장하지 않으셔도 됩니다.`;

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
    <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-[15px] font-bold text-gray-800">배송 정보 수집</h3>
        {doc && (
          <span className={`text-[13px] font-semibold ${submittedN === doc.entries.length ? "text-emerald-600" : "text-amber-600"}`}>
            제출 {submittedN}/{doc.entries.length}명 · 마감 {fmtDt(doc.deadline)}
          </span>
        )}
        {stale && <span className="text-[12px] text-red-600">당첨자가 바뀌었습니다 — "마감·사이즈 저장"을 눌러 반영하세요</span>}
        {msg && <span className="text-[13px] text-gray-500">{msg}</span>}
        {doc && (
          <div className="ml-auto flex flex-wrap gap-2">
                <button className={smallBtn} onClick={() => copy("all", doc.entries.map((e) => `@${e.user}${e.prize ? ` (${e.prize})` : ""} ${linkOf(e.token)}`).join("\n"))}>
                  {copied === "all" ? "복사됨" : "전체 링크 복사"}
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
            <button className={`${smallBtn} !bg-[#303236] !text-white !border-[#303236]`} onClick={save} disabled={busy || !winners.length} title={doc ? "바뀐 마감·사이즈·당첨자를 기존 신청 링크에 반영합니다. 링크 주소는 그대로입니다." : "당첨자별 신청 링크를 만듭니다."}>
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
              <ul className="mt-3 divide-y divide-gray-100">
                {doc.entries.map((e) => (
                  <li key={e.token} className="py-2 text-[13px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-gray-800">@{e.user}</span>
                      {e.prize && <span className="text-gray-500">{e.prize}</span>}
                      <span className={e.submitted ? "text-emerald-600 font-semibold" : "text-amber-600"}>{e.submitted ? `✓ 제출 ${fmtDt(e.submitted.at)}` : "미제출"}</span>
                      <span className="ml-auto flex gap-2">
                        {dmCopied[e.token] && <span className="text-[12px] text-gray-400">DM 복사 {fmtDt(dmCopied[e.token])}</span>}
                        <button className="text-gray-600 hover:underline" onClick={() => copyDm(e)} title="DM으로 보낼 안내문과 링크를 복사합니다. 복사할 때마다 복사 시각이 갱신됩니다.">
                          {copied === e.token ? "복사됨" : dmCopied[e.token] ? "다시 복사" : "DM 문구 복사"}
                        </button>
                        {e.submitted && (
                          <button className="text-red-600 hover:underline disabled:opacity-50" disabled={busy} onClick={() => resetEntry(e)} title="제출 내용을 지우고 같은 링크로 다시 입력받습니다.">
                            초기화
                          </button>
                        )}
                        {e.submitted && (
                          <button className="text-[#303236] font-semibold hover:underline" onClick={() => setOpenUser(openUser === e.user ? null : e.user)}>
                            {openUser === e.user ? "닫기" : "내용 보기"}
                          </button>
                        )}
                      </span>
                    </div>
                    {openUser === e.user && e.submitted && (
                      <dl className="mt-2 ml-1 grid grid-cols-[72px_1fr] gap-x-3 gap-y-0.5 text-gray-700 bg-gray-50 rounded-lg p-3">
                        <dt className="text-gray-400">이름</dt><dd>{e.submitted.name}</dd>
                        <dt className="text-gray-400">연락처</dt><dd>{e.submitted.phone}</dd>
                        <dt className="text-gray-400">주소</dt><dd>{[e.submitted.addr1, e.submitted.addr2].filter(Boolean).join(" ")}</dd>
                        {e.submitted.size && (<><dt className="text-gray-400">사이즈</dt><dd>{e.submitted.size}</dd></>)}
                      </dl>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-gray-400">마감 후 90일이 지나면 제출된 개인정보는 자동으로 파기됩니다.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
