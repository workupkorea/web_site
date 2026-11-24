"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MATE_APPLICATION_GENDERS, MATE_GENDERS, MATE_STYLES, normalizeMatePhone } from "@/lib/mate";
import { formatMateSize, mateActivityImageHref, type MatePortal, type MateProfile } from "@/lib/mate-activities";
import MateActivityImage from "./MateActivityImage";
import MatePhoneInput from "./MatePhoneInput";
import { MateActivityResult, MateParticipationHistory, type MateHistoryEntry } from "./MateParticipationHistory";

const panel = "rounded-sm border border-[#d9d7d0] bg-white";
const field = "min-h-11 w-full min-w-0 rounded-sm border border-[#bfbcb3] bg-white px-3 py-2 text-base font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#95501f]";
const button = "min-h-11 rounded-sm bg-[#221f1b] px-5 py-2 text-sm font-bold text-white hover:bg-[#484037] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#95501f] disabled:opacity-60";
const disclosure = "flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-bold hover:bg-[#f3f1ed] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#95501f] [&::-webkit-details-marker]:hidden";
type Activity = MatePortal["activities"][number];
type Save = (payload: object) => Promise<string | null>;

function ActivityCard({ round, activity, save }: { round: number; activity: Activity; save: Save }) {
  const [choice, setChoice] = useState(activity.response?.choice ?? "");
  const [size, setSize] = useState(activity.response?.size ?? "");
  const [color, setColor] = useState(activity.response?.color ?? "");
  const sizes = activity.size_options ?? [];
  const colors = activity.color_options ?? [];
  const products = activity.additional_products ?? [];
  const [extra, setExtra] = useState<Record<string, { size: string; color: string }>>(() => Object.fromEntries(
    (activity.response?.additional_selections ?? []).map((entry) => [entry.product_id, { size: entry.size, color: entry.color ?? "" }]),
  ));
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const error = await save({ type: "response", activity_no: activity.activity_no, choice, size, color: colors.length ? color : null,
      additional_selections: choice === "yes" ? products.map((product) => ({
        product_id: product.id, size: extra[product.id]?.size, color: product.color_options.length ? extra[product.id]?.color : null,
      })) : [],
    });
    setMessage(error ?? "응답을 저장했습니다.");
    setPending(false);
  }

  const status = activity.response?.result_instagram_url ? "결과물 제출 완료"
    : activity.response?.choice === "yes" ? "참여 응답 완료" : activity.response?.choice === "no" ? "불참 응답 완료" : "응답 필요";
  const heading = <>
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <span className="shrink-0 bg-[#26221d] px-2 py-1 text-xs leading-none font-bold text-white tabular-nums">{activity.activity_no}회차</span>
      <span className="min-w-0 break-words text-xl leading-snug font-extrabold tracking-tight sm:text-2xl">{activity.product_name}</span>
    </span>
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold before:size-1.5 before:rounded-full before:bg-current ${status === "응답 필요"
      ? "text-[#883a12]" : "text-[#645b51]"}`}>{status}</span>
  </>;
  const content = (
    <div className="border-t border-[#e5e1d9] px-4 py-4 sm:px-6">
      {activity.product_image_version && <MateActivityImage
        url={mateActivityImageHref(round, activity.activity_no, activity.product_image_version)} alt={activity.product_name} />}
      {activity.product_info && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#5e554a]">{activity.product_info}</p>}
      {activity.product_url && <a href={activity.product_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4">제품 정보 열기</a>}
      {products.length > 0 && <ul aria-label="추가 제공 제품" className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {products.map((product) => <li key={product.id}>{product.product_url
          ? <a href={product.product_url} target="_blank" rel="noreferrer" className="font-bold underline">{product.name}</a>
          : product.name}</li>)}
      </ul>}
      <form onSubmit={submit} className="space-y-3 [&:not(:first-child)]:mt-4">
        <fieldset>
          <legend className="text-sm font-bold">참여 여부</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-xs">
            {([["yes", "참여"], ["no", "불참"]] as const).map(([value, label]) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-[#d8d4cb] px-3 text-sm font-semibold has-[:checked]:border-[#9b5020] has-[:checked]:bg-[#f9eee1]">
                <input type="radio" name="choice" className="accent-[#221f1b]" checked={choice === value} onChange={() => setChoice(value)} required />{label}
              </label>
            ))}
          </div>
        </fieldset>
        {choice === "yes" && <div className={`grid gap-3 ${colors.length ? "grid-cols-2" : ""}`}>
          {products.length > 0 && <p className="col-span-full font-bold">{activity.product_name}</p>}
          <label className="grid gap-1 text-sm font-bold">사이즈
            {sizes.length ? <select className={field} value={sizes.includes(size) ? size : ""} onChange={(event) => setSize(event.target.value)} required>
              <option value="">사이즈 선택</option>
              {sizes.map((option) => <option key={option} value={option}>{formatMateSize(option)}</option>)}
            </select> : <input className={field} value={size} onChange={(event) => setSize(event.target.value)}
              maxLength={60} placeholder="예: L, 260" required />}
          </label>
          {colors.length > 0 && <label className="grid gap-1 text-sm font-bold">컬러
            <select className={field} value={colors.includes(color) ? color : ""} onChange={(event) => setColor(event.target.value)} required>
              <option value="">컬러 선택</option>
              {colors.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>}
        </div>}
        {choice === "yes" && products.map((product) => {
          const current = extra[product.id] ?? { size: "", color: "" };
          function select(patch: Partial<typeof current>) {
            setExtra((previous) => ({ ...previous, [product.id]: { ...(previous[product.id] ?? current), ...patch } }));
          }
          return (
            <fieldset key={product.id} className={`grid min-w-0 gap-3 rounded-md border border-[#ddd8cf] p-3 ${product.color_options.length ? "grid-cols-2" : ""}`}>
              <legend className="px-1 font-bold">{product.name}</legend>
              <label className="grid gap-1 text-sm font-bold">사이즈
                {product.size_options.length ? <select aria-label={product.name + " 사이즈"} className={field}
                  value={product.size_options.includes(current.size) ? current.size : ""} onChange={(event) => select({ size: event.target.value })} required>
                  <option value="">사이즈 선택</option>
                  {product.size_options.map((option) => <option key={option} value={option}>{formatMateSize(option)}</option>)}
                </select> : <input aria-label={product.name + " 사이즈"} className={field} value={current.size}
                  onChange={(event) => select({ size: event.target.value })} maxLength={60} required />}
              </label>
              {product.color_options.length > 0 && <label className="grid gap-1 text-sm font-bold">컬러
                <select aria-label={product.name + " 컬러"} className={field} value={product.color_options.includes(current.color) ? current.color : ""}
                  onChange={(event) => select({ color: event.target.value })} required>
                  <option value="">컬러 선택</option>
                  {product.color_options.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>}
            </fieldset>
          );
        })}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {message && <p role="status" className="mr-auto text-sm">{message}</p>}
          <button className={button} disabled={pending}>응답 저장</button>
        </div>
      </form>
      {activity.response?.choice === "yes" && <MateActivityResult activity={activity} save={save} />}
    </div>
  );
  return <section className={`${panel} shadow-[0_10px_25px_-23px_#403b32]`}>
    <h3 className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t-2 border-[#ed6d0f] bg-[#f7f5ef] px-4 py-4 sm:px-6 sm:py-5">{heading}</h3>
    {content}
  </section>;
}

function ProfileForm({ profile, save }: { profile: MateProfile; save: Save }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const previous = { ...profile, feed_styles: profile.feed_styles.length === 1 ? profile.feed_styles[0] : "", height_cm: String(profile.height_cm) };
    const patch = Object.fromEntries(Object.entries(values).filter(([name, value]) => {
      if (name === "phone") return normalizeMatePhone(String(value)) !== profile.phone;
      if ((name === "gender" || name === "feed_styles") && !value) return false;
      return String(value).trim() !== previous[name as keyof typeof previous];
    }));
    if (!Object.keys(patch).length) {
      setMessage("수정한 항목이 없습니다.");
      return;
    }
    setPending(true);
    const error = await save({ type: "profile", profile: patch });
    setMessage(error ?? "수정한 정보를 저장했습니다.");
    setPending(false);
  }

  return (
    <details className="group bg-white">
      <summary className={`rounded-sm ${disclosure}`}>
        내 기본 정보 확인·수정
        <span aria-hidden="true" className="size-2 shrink-0 rotate-45 border-r border-b border-[#63574b] group-open:rotate-[225deg]" />
      </summary>
      <div className="border-t border-[#e5e1d9] p-4">
      <p className="text-sm text-[#5e554a]">바뀐 항목만 수정해 주세요.</p>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <label className="grid gap-1 text-sm font-bold">이름<input className={field} name="name" defaultValue={profile.name} maxLength={60} required /></label>
        <label className="grid gap-1 text-sm font-bold">인스타그램 아이디<input className={field} name="sns_id" defaultValue={profile.sns_id} maxLength={31} required /></label>
        <label className="grid gap-1 text-sm font-bold">연락처<MatePhoneInput className={field} initial={profile.phone} /></label>
        <label className="grid gap-1 text-sm font-bold">키 (cm)<input className={field} name="height_cm" type="number" min={50} max={260} step="0.1" defaultValue={profile.height_cm} required /></label>
        <label className="grid gap-1 text-sm font-bold sm:col-span-2 lg:col-span-1">주소<input className={field} name="address" defaultValue={profile.address} maxLength={240} required /></label>
        <label className="grid gap-1 text-sm font-bold">성별
          <select name="gender" className={field} defaultValue={Object.hasOwn(MATE_APPLICATION_GENDERS, profile.gender) ? profile.gender : ""}>
            {!Object.hasOwn(MATE_APPLICATION_GENDERS, profile.gender) && <option value="">{MATE_GENDERS[profile.gender]} (현재)</option>}
            {Object.entries(MATE_APPLICATION_GENDERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold">피드 스타일
          <select name="feed_styles" className={field} defaultValue={profile.feed_styles.length === 1 ? profile.feed_styles[0] : ""}>
            {profile.feed_styles.length !== 1 && <option value="">{profile.feed_styles.map((style) => MATE_STYLES[style]).join(", ")} (현재)</option>}
            {Object.entries(MATE_STYLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <button className={button} disabled={pending}>수정한 정보 저장</button>
          {message && <p role="status" className="text-sm">{message}</p>}
        </div>
      </form>
      </div>
    </details>
  );
}

function readToken() {
  return window.location.hash.slice(1);
}

export default function MateParticipantPortal() {
  const [portal, setPortal] = useState<MatePortal | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function refresh() {
      const token = readToken();
      if (!token) {
        setPortal(null);
        setError("담당자에게 받은 개인 링크로 접속해 주세요.");
        return;
      }
      try {
        const response = await fetch("/api/mate/participation", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const data = await response.json();
        if (!active || readToken() !== token) return;
        if (!response.ok) {
          if (response.status === 403) setPortal(null);
          setError(data.error);
          return;
        }
        setError("");
        setPortal(data);
      } catch {
        if (active && readToken() === token) setError("개인 활동 페이지를 불러오지 못했습니다.");
      }
    }
    void refresh();
    function refreshVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    function switchLink() {
      setPortal(null);
      setError("");
      void refresh();
    }
    const timer = window.setInterval(refreshVisible, 30000);
    window.addEventListener("focus", refreshVisible);
    window.addEventListener("hashchange", switchLink);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      window.removeEventListener("hashchange", switchLink);
    };
  }, []);

  async function save(payload: object) {
    const token = readToken();
    try {
      const response = await fetch("/api/mate/participation", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) return result.error || "저장하지 못했습니다.";
      if (readToken() === token) {
        setPortal((current) => {
          if (!current) return current;
          if (result.profile) return { ...current, profile: { ...current.profile, ...result.profile } };
          const active = current.activities.find((activity) => activity.activity_no === result.activity_no);
          if (!active) return current;
          const response = { ...active.response, ...result.response };
          const history = [...current.history.filter((entry) => entry.activity_no !== active.activity_no),
            { activity_no: active.activity_no, product_name: active.product_name, response }]
            .sort((a, b) => b.activity_no - a.activity_no);
          return {
            ...current, history,
            activities: current.activities.map((activity) => activity.activity_no === active.activity_no ? { ...activity, response } : activity),
          };
        });
      }
      return null;
    } catch {
      return "저장 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
  }

  const latest = portal?.activities[0];
  const historyByRound = new Map<number, MateHistoryEntry>(portal?.history.map((entry) => [entry.activity_no, entry]));
  for (const activity of portal?.activities ?? []) {
    if (activity === latest && !activity.closed_at) continue;
    const saved = historyByRound.get(activity.activity_no);
    historyByRound.set(activity.activity_no, {
      activity_no: activity.activity_no,
      product_name: activity.product_name,
      product_info: activity.product_info,
      product_url: activity.product_url,
      response: saved?.response ?? activity.response,
    });
  }
  const history = [...historyByRound.values()].sort((a, b) => b.activity_no - a.activity_no);
  return (
    <main className="min-h-screen bg-[#f4f2ed] text-[#221f1b]">
      {portal && <header className="border-b border-[#40372e] bg-[#221f1b] text-[#fbf8f1]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-5 sm:px-8 sm:py-7">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.8rem,5vw,3.25rem)] leading-[1.05] font-black tracking-[-0.055em]">
              WORKUP MATE <span className="whitespace-nowrap text-[#ff9c55]">{portal.round}기</span>
            </h1>
            <p className="mt-2 break-words text-sm text-[#d8d1c5]"><strong className="font-semibold text-[#fbf8f1]">@{portal.profile.sns_id}</strong>님, 함께해 주셔서 감사합니다.</p>
          </div>
          <div className="flex items-center gap-3 border border-[#6b5f50] bg-[#2d2821] px-3 py-2 sm:grid sm:gap-1 sm:px-4 sm:py-2.5">
            <p className="text-[11px] font-bold tracking-[0.13em] text-[#e6b58d]">MATE NO.</p>
            <p aria-label={`메이트 번호 ${portal.mate_no}`} className="font-mono text-sm font-semibold tabular-nums tracking-[0.06em] sm:text-lg">{portal.mate_no}</p>
          </div>
        </div>
      </header>}
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-8 sm:py-6">
        {!portal && <h1 className="text-3xl font-black">WORKUP MATE</h1>}
        {error && <p role="alert" className={`p-4 ${panel}`}>{error}</p>}
        {!portal && !error && <p role="status">활동 정보를 불러오는 중입니다.</p>}
        {portal && <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className={`grid min-w-0 divide-y divide-[#e5e1d9] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:col-start-2 lg:row-start-1 lg:mt-[2.65rem] lg:grid-cols-1 lg:divide-x-0 lg:divide-y ${panel}`}>
            <MateParticipationHistory history={history} />
            <ProfileForm profile={portal.profile} save={save} />
          </div>
          <section aria-labelledby="mate-portal-activities" className="min-w-0 space-y-2.5 lg:col-start-1 lg:row-start-1">
            <h2 id="mate-portal-activities" className="mb-3 text-[1.4rem] font-extrabold tracking-[-0.035em]">활동 회차</h2>
            {latest && !latest.closed_at
              ? <ActivityCard round={portal.round} activity={latest} save={save} key={latest.activity_no} />
              : <p className={`p-4 ${panel}`}>현재 응답할 수 있는 활동 회차가 없습니다.</p>}
          </section>
        </div>}
      </div>
    </main>
  );
}
