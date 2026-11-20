"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MATE_APPLICATION_GENDERS, MATE_GENDERS, MATE_STYLES, normalizeMatePhone } from "@/lib/mate";
import { formatMateSize, mateActivityImageHref, type MatePortal, type MateProfile } from "@/lib/mate-activities";
import MateActivityImage from "./MateActivityImage";
import MatePhoneInput from "./MatePhoneInput";
import { MateActivityResult, MateParticipationHistory } from "./MateParticipationHistory";

const panel = "rounded-lg border border-[#d8dfd7] bg-white p-4 sm:p-6";
const field = "min-h-11 w-full min-w-0 rounded-md border border-[#a7b8ac] px-3 py-2 font-normal focus:outline-2 focus:outline-[#356454]";
const button = "min-h-11 rounded-md bg-[#285746] px-4 py-2 font-bold text-white hover:bg-[#203f35] disabled:opacity-60";
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

  return (
    <section className={panel}>
      <h3 className="text-lg font-black">{activity.activity_no}회차 · {activity.product_name}</h3>
      {activity.product_image_version && <MateActivityImage
        url={mateActivityImageHref(round, activity.activity_no, activity.product_image_version)} alt={activity.product_name} />}
      {activity.product_info && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{activity.product_info}</p>}
      {activity.product_url && <a href={activity.product_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold underline">제품 정보 열기</a>}
      {products.length > 0 && <ul aria-label="추가 제공 제품" className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {products.map((product) => <li key={product.id}>{product.product_url
          ? <a href={product.product_url} target="_blank" rel="noreferrer" className="font-bold underline">{product.name}</a>
          : product.name}</li>)}
      </ul>}
      <form onSubmit={submit} className="mt-4 space-y-3">
        <fieldset>
          <legend className="font-bold">이 제품으로 활동에 참여하시겠습니까?</legend>
          <div className="mt-1 flex gap-5">
            <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="choice" checked={choice === "yes"} onChange={() => setChoice("yes")} required /> 참여 (Yes)</label>
            <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="choice" checked={choice === "no"} onChange={() => setChoice("no")} required /> 불참 (No)</label>
          </div>
        </fieldset>
        {choice === "yes" && <div className="grid gap-3 sm:grid-cols-2">
          {products.length > 0 && <p className="font-bold sm:col-span-2">{activity.product_name}</p>}
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
            <fieldset key={product.id} className="grid gap-3 rounded-md border border-[#d8dfd7] p-3 sm:grid-cols-2">
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
        <button className={button} disabled={pending}>응답 저장</button>
        {message && <p role="status" className="text-sm">{message}</p>}
      </form>
      {activity.response?.choice === "yes" && <MateActivityResult activity={activity} save={save} />}
    </section>
  );
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
    <details className={panel}>
      <summary className="cursor-pointer text-lg font-black">내 기본 정보 확인·수정</summary>
      <p className="mt-2 text-sm text-stone-700">지원서에 입력한 정보입니다. 바뀐 항목만 수정해 주세요.</p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold">이름<input className={field} name="name" defaultValue={profile.name} maxLength={60} required /></label>
        <label className="grid gap-1 text-sm font-bold">인스타그램 아이디<input className={field} name="sns_id" defaultValue={profile.sns_id} maxLength={31} required /></label>
        <label className="grid gap-1 text-sm font-bold">연락처<MatePhoneInput className={field} initial={profile.phone} /></label>
        <label className="grid gap-1 text-sm font-bold">키 (cm)<input className={field} name="height_cm" type="number" min={50} max={260} step="0.1" defaultValue={profile.height_cm} required /></label>
        <label className="grid gap-1 text-sm font-bold sm:col-span-2">주소<input className={field} name="address" defaultValue={profile.address} maxLength={240} required /></label>
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
        <div className="space-y-2 sm:col-span-2">
          <button className={button} disabled={pending}>수정한 정보 저장</button>
          {message && <p role="status" className="text-sm">{message}</p>}
        </div>
      </form>
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

  return (
    <main className="min-h-screen bg-[#eef1ec] text-[#1f3028]">
      {portal && <header className="border-b-[5px] border-[#c5a46a] bg-[#1b2b26] text-[#fcfaf4]">
        <div className="mx-auto grid max-w-5xl items-end gap-6 px-5 py-8 sm:grid-cols-[1fr_auto] sm:px-8 sm:py-11">
          <div>
            <h1 className="text-[clamp(2rem,6vw,4rem)] font-black leading-none tracking-[-0.045em]">WORKUP MATE <span className="whitespace-nowrap">{portal.round}기</span></h1>
            <p className="mt-4 text-base text-[#dce6dc]">{portal.profile.name}님, 워크업 메이트로 함께해 주셔서 감사합니다.</p>
          </div>
          <div className="w-fit min-w-48 border border-[#bd9d64] bg-[#23372e] px-4 py-3 text-[#ecd5a9]">
            <p className="text-xs font-bold tracking-[0.16em]">MATE NO.</p>
            <p aria-label={`메이트 번호 ${portal.mate_no}`} className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-[0.08em]">{portal.mate_no}</p>
          </div>
        </div>
      </header>}
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-8 sm:py-8">
        {!portal && <h1 className="text-3xl font-black">WORKUP MATE</h1>}
        {error && <p role="alert" className={panel}>{error}</p>}
        {!portal && !error && <p role="status">활동 정보를 불러오는 중입니다.</p>}
        {portal && <>
          <MateParticipationHistory history={portal.history} />
          <ProfileForm profile={portal.profile} save={save} />
          <h2 className="pt-3 text-xl font-black">활동 회차</h2>
          {!portal.activities.length && <p className={panel}>공개된 활동이 없습니다.</p>}
          {portal.activities.map((activity) => <ActivityCard round={portal.round} activity={activity} save={save} key={activity.activity_no} />)}
        </>}
      </div>
    </main>
  );
}