"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { loadDaumPostcodeScript } from "@/components/ih/influencers/IHAddressSearchField";

// 당첨자 배송 정보 입력 — 관리자가 보낸 고유 링크(/claim/<토큰>)로만 접근한다. 모바일 우선.
interface Info {
  eventName: string;
  user: string;
  prize: string;
  deadline: string;
  sizes: string[];
  submitted: boolean;
  closed: boolean;
}

const input =
  "w-full min-h-[48px] border border-gray-300 rounded-lg px-4 text-[16px] bg-white focus:outline-none focus:border-[#303236]";
const label = "block text-[14px] font-semibold text-gray-700 mb-1.5";

const fmtDeadline = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "invalid">("loading");
  const [form, setForm] = useState({ name: "", phone: "", addr1: "", addr2: "", size: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/giveaway-claim/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("invalid");
        setInfo((await r.json()) as Info);
        setState("ok");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  /** 주소 검색(Daum 우편번호 서비스) — 선택한 기본 주소를 채우고, 상세 주소는 직접 입력한다. 스크립트가 막히면 직접 입력해도 된다. */
  const searchAddress = async () => {
    try {
      await loadDaumPostcodeScript();
      if (!window.daum?.Postcode) throw new Error("load");
      new window.daum.Postcode({
        oncomplete: (data) => {
          set("addr1", data.address);
          document.getElementById("c-addr2")?.focus();
        },
      }).open();
    } catch {
      setErr("주소 검색을 불러오지 못했습니다. 주소를 직접 입력해 주세요.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`/api/giveaway-claim/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consent }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "제출하지 못했습니다.");
      setDone(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "제출하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-[#f7f7f5] px-4 py-8">
      <div className="mx-auto w-full max-w-md bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">{children}</div>
    </main>
  );

  if (state === "loading") return shell(<p className="text-gray-400 text-center py-10">불러오는 중…</p>);
  if (state === "invalid" || !info)
    return shell(
      <div className="text-center py-8">
        <p className="text-lg font-bold text-gray-900">유효하지 않거나 만료된 링크입니다</p>
        <p className="mt-2 text-[14px] text-gray-500">링크를 다시 확인하시거나, 안내를 보내드린 계정으로 문의해 주세요.</p>
      </div>,
    );

  if (done)
    return shell(
      <div className="text-center py-8">
        <p className="text-4xl">🎉</p>
        <p className="mt-3 text-lg font-bold text-gray-900">제출이 완료되었습니다</p>
        <p className="mt-2 text-[14px] text-gray-500">
          입력하신 정보로 경품을 보내드립니다. 제출 후에는 수정할 수 없으니, 수정이 필요하면 안내를 보내드린 계정으로 문의해 주세요.
        </p>
      </div>,
    );

  // 이미 제출한 링크는 폼을 다시 보여주지 않는다 (수정 불가)
  if (info.submitted)
    return shell(
      <div className="text-center py-8">
        <p className="text-4xl">✅</p>
        <p className="mt-3 text-lg font-bold text-gray-900">이미 제출하셨습니다</p>
        <p className="mt-2 text-[14px] text-gray-500">
          입력하신 정보로 경품을 보내드립니다. 제출 후에는 수정할 수 없으니, 수정이 필요하면 안내를 보내드린 계정으로 문의해 주세요.
        </p>
      </div>,
    );

  if (info.closed)
    return shell(
      <div className="text-center py-8">
        <p className="text-lg font-bold text-gray-900">신청 기간이 끝났습니다</p>
        <p className="mt-2 text-[14px] text-gray-500">마감 시각: {fmtDeadline(info.deadline)}</p>
      </div>,
    );

  return shell(
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="text-[13px] text-gray-400">{info.eventName}</p>
        <h1 className="text-xl font-black text-gray-900 mt-0.5">@{info.user}님, 당첨을 축하드립니다!</h1>
        {info.prize && <p className="mt-1 text-[15px] text-[#E5541B] font-bold">🎁 {info.prize}</p>}
        <p className="mt-2 text-[13px] text-gray-500">
          경품 배송을 위해 아래 정보를 입력해 주세요. 마감: <b>{fmtDeadline(info.deadline)}</b>
        </p>
      </div>

      <div>
        <label className={label} htmlFor="c-name">이름 (받는 분)</label>
        <input id="c-name" className={input} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required maxLength={40} />
      </div>
      <div>
        <label className={label} htmlFor="c-phone">연락처</label>
        <input id="c-phone" className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" required maxLength={20} />
      </div>
      <div>
        <label className={label} htmlFor="c-addr1">주소</label>
        <div className="flex gap-2">
          <input id="c-addr1" className={input} value={form.addr1} onChange={(e) => set("addr1", e.target.value)} autoComplete="street-address" placeholder="주소 검색을 눌러 선택하세요" required maxLength={200} />
          <button type="button" onClick={searchAddress} className="shrink-0 min-h-[48px] px-4 rounded-lg border border-gray-300 bg-white text-[15px] font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap">
            주소 검색
          </button>
        </div>
      </div>
      <div>
        <label className={label} htmlFor="c-addr2">상세 주소</label>
        <input id="c-addr2" className={input} value={form.addr2} onChange={(e) => set("addr2", e.target.value)} maxLength={100} />
      </div>
      {info.sizes.length > 0 && (
        <div>
          <span className={label}>사이즈</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="사이즈">
            {info.sizes.map((sz) => (
              <button
                key={sz}
                type="button"
                role="radio"
                aria-checked={form.size === sz}
                onClick={() => set("size", sz)}
                className={`min-h-[44px] min-w-[56px] px-4 rounded-lg border text-[15px] font-semibold ${form.size === sz ? "bg-[#303236] text-white border-[#303236]" : "bg-white text-gray-700 border-gray-300"}`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-start gap-2.5 text-[13px] text-gray-600 leading-relaxed cursor-pointer">
        <input type="checkbox" className="mt-1 w-5 h-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          <b>개인정보 수집·이용에 동의합니다.</b> 수집 항목: 이름, 연락처, 주소, 사이즈 / 이용 목적: 이벤트 경품 배송 / 보관 기간: 신청 마감 후 90일이 지나면 파기합니다.
        </span>
      </label>

      {err && <p className="text-[14px] text-red-600" role="alert">{err}</p>}
      <button type="submit" disabled={busy || !consent || (info.sizes.length > 0 && !form.size)} className="w-full min-h-[52px] rounded-xl bg-[#E5541B] text-white text-[16px] font-bold disabled:opacity-40">
        {busy ? "제출 중…" : "제출하기"}
      </button>
    </form>,
  );
}
