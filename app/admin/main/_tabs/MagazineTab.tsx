"use client";
import { Fragment, createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_HOME_MAGAZINE,
  HOME_MAGAZINE_SECTION,
  MAGAZINE_CHAPTER_LAYOUTS,
  MAGAZINE_SECTIONS,
  MAGAZINE_SLOT_SPECS as SPEC,
  MAGAZINE_SUB_SLOTS,
  type MagazineSectionKey,
  type MagazineSlotSpec,
  type MagazineVideoBlock,
  type MagazineVideoItem,
  isSectionEnabled,
  isDividerKey,
  isBgCompatible,
  normalizeHex,
  MAGAZINE_BG_PRESETS,
  MAGAZINE_BG_TONE,
  MAGAZINE_DIVIDER_SPACES,
  MAGAZINE_DIVIDER_STYLES,
  type MagazineBgKey,
  type MagazineDivider,
  buildAutoContentsItems,
  type MagazineContentsItem,
  withSectionEnabled,
  parseYouTubeUrl,
  isMagazinePublishable,
  normalizeHomeMagazine,
  type HomeMagazineConfig,
  type MagazineChapter,
  type MagazineImage,
  type MagazineWearingItem,
} from "@/lib/home-magazine";

// 사이트 관리 › 메인 관리 › 캠페인 매거진 — 배우 캠페인 매거진 편집기.
// 저장: site_settings(section="home_magazine") — 저장 즉시 메인 캐시 갱신(revalidateTag).
// 계약 종료 시 원복: 상단 "공개" 끄기 + 메인 배치에서 숨겼던 기존 섹션 다시 켜기.

const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400";
const POS_SELECT = "border border-gray-200 rounded-md px-1.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400";
const LABEL = "block text-xs font-semibold text-gray-600 mb-1";
const SMALL_BTN = "text-xs px-2.5 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40";
const API = `/api/admin/site-settings/${HOME_MAGAZINE_SECTION}`;

// 업로드 기준 폭 — 이미지 서버 변환이 없으므로(원본 URL 그대로 서빙) 업로드 시점에 줄인다.
const SIZE = { large: 2400, medium: 1600, small: 1000 } as const;
type SizeKind = keyof typeof SIZE;

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// 최장변 maxPx 이하로 축소(JPEG 0.86). 업로드 API 한도 4MB 안쪽으로 맞춘다.
async function resizeImage(file: File, maxPx: number): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const max = Math.max(img.width, img.height);
      if (max <= maxPx && file.size < 3.5 * 1024 * 1024) return resolve(file);
      const ratio = Math.min(1, maxPx / max);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file),
        "image/jpeg",
        0.86
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve(file);
    };
    img.src = objUrl;
  });
}

async function uploadImage(file: File, kind: SizeKind): Promise<string> {
  const fd = new FormData();
  fd.append("file", await resizeImage(file, SIZE[kind]));
  const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error ?? "업로드 실패");
  return json.url as string;
}

// ── 공용 UI ─────────────────────────────────────────────

// 카드 접기/펼치기 — 접힌 카드 id 목록은 편집기 본체가 들고 있고, 모두 접기/펼치기 버튼도 거기서 처리한다.
const CollapseCtx = createContext<{ closed: Set<string>; toggle: (id: string) => void } | null>(null);

function Card({ id, title, desc, right, children }: { id?: string; title: string; desc?: string; right?: ReactNode; children: ReactNode }) {
  const ctx = useContext(CollapseCtx);
  const key = id ?? title;
  const closed = ctx?.closed.has(key) ?? false;
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`flex items-start justify-between gap-4 ${closed ? "" : "mb-4"}`}>
        <button
          type="button"
          onClick={() => ctx?.toggle(key)}
          aria-expanded={!closed}
          className="flex items-start gap-2 text-left min-w-0 flex-1"
        >
          <span aria-hidden className="text-gray-400 text-sm mt-0.5 w-3">{closed ? "▸" : "▾"}</span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-gray-900">{title}</span>
            {desc && !closed && <span className="block text-xs font-normal text-gray-500 mt-0.5">{desc}</span>}
          </span>
        </button>
        {right}
      </div>
      {!closed && <div className="space-y-4">{children}</div>}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-blue-600" />
      {label}
    </label>
  );
}

function Text({ label, value, onChange, placeholder, multiline, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; rows?: number }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {multiline ? (
        <textarea className={INPUT} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={INPUT} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

const POSITIONS = [
  { value: "", label: "중앙" },
  { value: "50% 15%", label: "위쪽(얼굴 중심)" },
  { value: "50% 30%", label: "약간 위" },
  { value: "50% 80%", label: "아래쪽" },
  { value: "30% 50%", label: "왼쪽" },
  { value: "70% 50%", label: "오른쪽" },
];

function UploadButton({ kind, onUploaded, label, multiple }: { kind: SizeKind; onUploaded: (urls: string[]) => void; label: string; multiple?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    setErr("");
    const urls: string[] = [];
    try {
      // 순차 업로드 — 동시 다발 요청으로 서버에 부담 주지 않도록
      for (let i = 0; i < list.length; i++) {
        setBusy(list.length > 1 ? `업로드 중 ${i + 1}/${list.length}` : "업로드 중…");
        urls.push(await uploadImage(list[i], kind));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setBusy("");
      if (urls.length) onUploaded(urls);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" className={SMALL_BTN} disabled={!!busy} onClick={() => ref.current?.click()}>
        {busy || label}
      </button>
      <input ref={ref} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={(e) => handle(e.target.files)} />
      {err && <span className="text-[11px] text-red-500 mt-1">{err}</span>}
    </span>
  );
}

// 단일 이미지 필드 — PC 이미지(필수) + 모바일 이미지(선택) + 크롭 위치
// side: 안내·버튼을 미리보기 옆(오른쪽)에 배치 / hidePosition: 크롭 위치 선택 숨김(제품 등록 등)
function ImageField({ label, image, onChange, kind = "medium", mobile = false, hint, spec, mobileSpec, multi = false, side = false, hidePosition = false }: { label: string; image: MagazineImage; onChange: (v: MagazineImage) => void; kind?: SizeKind; mobile?: boolean; hint?: string; spec?: MagazineSlotSpec; mobileSpec?: MagazineSlotSpec; multi?: boolean; side?: boolean; hidePosition?: boolean }) {
  const set = (patch: Partial<MagazineImage>) => onChange({ ...image, ...patch });
  const [pcDim, setPcDim] = useState<{ w: number; h: number } | null>(null);
  const pcLow = !!(pcDim && spec && pcDim.w < spec.minW);
  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
      <p className={LABEL + " !mb-1.5"}>
        {label} {hint && <span className="font-normal text-gray-400">· {hint}</span>}
      </p>
      <div className={side ? "flex gap-4 items-start" : ""}>
      <div className="flex flex-wrap items-end gap-3 shrink-0">
        <Thumb url={image.url} caption="PC" minW={spec?.minW} hideCaption={side} onDim={setPcDim} small={side} />
        {mobile && <Thumb url={image.mobileUrl} caption="모바일" minW={mobileSpec?.minW} />}
      </div>
      <div className={side ? "flex-1 min-w-0 pt-1" : ""}>
      {side && pcDim && (
        <p className={`mb-1 text-[11px] ${pcLow ? "text-amber-600 font-semibold" : "text-gray-500"}`}>
          <span className="text-gray-400">PC</span> {pcDim.w}×{pcDim.h} ({ratioLabel(pcDim.w, pcDim.h)}){pcLow ? " · 작음" : ""}
        </p>
      )}
      {spec && (
        <div className={side ? "" : "mt-2"}>
          <SpecLine spec={spec} mobileSpec={mobile ? mobileSpec : undefined} />
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <UploadButton kind={kind} label={image.url ? "PC 교체" : "PC 업로드"} onUploaded={([u]) => set({ url: u })} />
        {mobile && <UploadButton kind="medium" label={image.mobileUrl ? "모바일 교체" : "모바일 업로드(선택)"} onUploaded={([u]) => set({ mobileUrl: u })} />}
        {mobile && image.mobileUrl && (
          <button type="button" className={SMALL_BTN} onClick={() => set({ mobileUrl: undefined })}>모바일 삭제</button>
        )}
        {image.url && (
          <button type="button" className={`${SMALL_BTN} text-red-500`} title={multi ? "추가 사진도 함께 삭제됩니다" : undefined} onClick={() => onChange({ url: "", alt: image.alt })}>삭제</button>
        )}
        {!hidePosition && (
        <span className="ml-auto flex items-center gap-1.5">
          <select className={POS_SELECT} value={image.position ?? ""} onChange={(e) => set({ position: e.target.value || undefined })} aria-label="PC 크롭 위치">
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>PC {p.label}</option>
            ))}
          </select>
          {mobile && (
            <select className={POS_SELECT} value={image.mobilePosition ?? ""} onChange={(e) => set({ mobilePosition: e.target.value || undefined })} aria-label="모바일 크롭 위치">
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>모바일 {p.label}</option>
              ))}
            </select>
          )}
        </span>
        )}
      </div>
      </div>
      </div>
      {multi && image.url && (
        <div className="mt-3 border-t border-gray-200 pt-3 space-y-3">
          <Toggle
            checked={!!image.random}
            onChange={(v) => set({ random: v || undefined })}
            label="방문할 때마다 사진을 무작위로 노출 (위 사진 + 아래 추가 사진 중 1장)"
          />
          <div className={mobile ? "grid lg:grid-cols-2 gap-4 items-start" : ""}>
            <ImageListField
              label={mobile ? "추가 사진 · PC" : "추가 사진 (랜덤 후보)"}
              kind={kind}
              spec={spec}
              compact={mobile}
              images={image.more ?? []}
              onChange={(more) => set({ more: more.length ? more : undefined })}
            />
            {mobile && (
              <ImageListField
                label="추가 사진 · 모바일"
                hint="모바일 화면에서 따로 뽑음 (없으면 PC 사진을 잘라서 사용)"
                kind="medium"
                spec={mobileSpec}
                compact
                images={image.mobileMore ?? []}
                onChange={(mobileMore) => set({ mobileMore: mobileMore.length ? mobileMore : undefined })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 실제 저장된 이미지의 가로×세로(px)와 비율을 보여준다 — 권장 폭(minW)보다 작으면 경고.
function useNaturalSize(url?: string) {
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => setDim(null), [url]);
  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) =>
    setDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
  return { dim, onLoad };
}
function ratioLabel(w: number, h: number) {
  const r = w / h;
  const known: [number, string][] = [[1, "1:1"], [4 / 5, "4:5"], [3 / 4, "3:4"], [9 / 16, "9:16"], [7 / 10, "7:10"], [16 / 9, "16:9"], [2, "2:1"], [3 / 2, "3:2"], [2 / 3, "2:3"]];
  const hit = known.find(([k]) => Math.abs(k - r) / k < 0.03);
  return hit ? hit[1] : r.toFixed(2);
}
function SizeNote({ dim, minW }: { dim: { w: number; h: number } | null; minW?: number }) {
  if (!dim) return null;
  const low = minW !== undefined && dim.w < minW;
  return (
    <p className={`text-[10px] mt-0.5 ${low ? "text-amber-600 font-semibold" : "text-gray-500"}`}>
      {dim.w}×{dim.h} ({ratioLabel(dim.w, dim.h)}){low ? " · 작음" : ""}
    </p>
  );
}

function Thumb({ url, caption, minW, hideCaption = false, onDim, small = false }: { url?: string; caption: string; minW?: number; hideCaption?: boolean; onDim?: (d: { w: number; h: number } | null) => void; small?: boolean }) {
  const { dim, onLoad } = useNaturalSize(url);
  useEffect(() => onDim?.(dim), [dim]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="text-center">
      {/* 잘리지 않은 원본 비율 그대로 — 보조 컷 미리보기만큼 크게(최대 높이 18rem) */}
      <div className="rounded-md bg-gray-200 overflow-hidden inline-block align-top">
        {url ? (
          <img src={url} alt="" onLoad={onLoad} className={`block w-auto h-auto ${small ? "max-h-52 max-w-40" : "max-h-72 max-w-[22rem]"}`} />
        ) : (
          <div className="w-40 h-52 flex items-center justify-center text-[11px] text-gray-400">없음</div>
        )}
      </div>
      {!hideCaption && (
        <>
          <p className="text-[10px] text-gray-400 mt-0.5">{caption}</p>
          <SizeNote dim={dim} minW={minW} />
        </>
      )}
    </div>
  );
}

// 자리별 권장 비율·크기 안내
function SpecLine({ spec, mobileSpec, label }: { spec: MagazineSlotSpec; mobileSpec?: MagazineSlotSpec; label?: string }) {
  const tip = [spec.note, mobileSpec?.note, "4MB 이하(올리면 자동 축소)"].filter(Boolean).join(" / ");
  return (
    <p className="text-[11px] leading-snug text-gray-500" title={tip}>
      {label && <b className="text-gray-700">{label} </b>}
      <span className="text-gray-400">{mobileSpec ? "PC" : "권장"}</span> <b className="text-blue-700">{spec.ratio}</b> {spec.px}px
      {mobileSpec && (
        <>
          <span className="mx-1.5 text-gray-300">|</span>
          <span className="text-gray-400">모바일</span> <b className="text-blue-700">{mobileSpec.ratio}</b> {mobileSpec.px}px
        </>
      )}
      <span className="ml-1.5 cursor-help text-gray-400" aria-label={tip}>ⓘ</span>
    </p>
  );
}

// 목록 한 칸 — 실제 크기 표시 포함
function ListThumb({ url, minW }: { url: string; minW?: number }) {
  const { dim, onLoad } = useNaturalSize(url);
  return (
    <>
      <div className="aspect-[4/5] rounded bg-gray-200 overflow-hidden">
        {url && <img src={url} alt="" onLoad={onLoad} className="w-full h-full object-cover" />}
      </div>
      <SizeNote dim={dim} minW={minW} />
    </>
  );
}

// 여러 장 이미지 — 일괄 업로드, 순서 이동, 삭제
function ImageListField({ label, images, onChange, kind = "small", max, hint, spec, compact = false, slotLabels }: { slotLabels?: string[]; label: string; images: MagazineImage[]; onChange: (v: MagazineImage[]) => void; kind?: SizeKind; max?: number; hint?: string; spec?: MagazineSlotSpec; compact?: boolean }) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const full = max !== undefined && images.length >= max;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className={LABEL + " mb-0"}>
          {label} <span className="font-normal text-gray-400">({images.length}{max ? `/${max}` : ""}장{hint ? ` · ${hint}` : ""})</span>
        </p>
        {!full && (
          <UploadButton
            kind={kind}
            multiple
            label="+ 사진 추가 (여러 장)"
            onUploaded={(urls) => onChange([...images, ...urls.map((url) => ({ url, alt: "" }))].slice(0, max ?? Infinity))}
          />
        )}
      </div>
      {spec && <div className="mb-2"><SpecLine spec={spec} /></div>}
      {slotLabels && <p className="mb-2 text-[11px] text-gray-500">칸마다 모양이 달라요 — 번호별 권장을 따라 올려 주세요.</p>}
      {images.length === 0 ? (
        <p className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg py-6 text-center">아직 사진이 없습니다.</p>
      ) : (
        <ul className={`grid gap-3 ${compact ? "grid-cols-2 xl:grid-cols-3" : "grid-cols-2 md:grid-cols-4 lg:grid-cols-6"}`}>
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`} className="border border-gray-100 rounded-lg p-2 bg-gray-50/50">
              {slotLabels?.[i] && <p className="mb-1 text-[10px] leading-snug text-gray-500">{slotLabels[i]}</p>}
              <ListThumb url={img.url} minW={spec?.minW} />
              <div className="flex justify-between mt-1.5">
                <span className="flex gap-1">
                  <button type="button" className={SMALL_BTN + " !px-2"} disabled={i === 0} onClick={() => move(i, -1)} aria-label="앞으로">←</button>
                  <button type="button" className={SMALL_BTN + " !px-2"} disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label="뒤로">→</button>
                </span>
                <button type="button" className={SMALL_BTN + " !px-2 text-red-500"} onClick={() => onChange(images.filter((_, k) => k !== i))}>
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 블록 순서 이동/삭제 버튼 묶음
function RowActions({ index, total, onMove, onRemove }: { index: number; total: number; onMove: (d: number) => void; onRemove: () => void }) {
  return (
    <span className="flex gap-1.5">
      <button type="button" className={SMALL_BTN} disabled={index === 0} onClick={() => onMove(-1)}>↑ 위로</button>
      <button type="button" className={SMALL_BTN} disabled={index === total - 1} onClick={() => onMove(1)}>↓ 아래로</button>
      <button type="button" className={`${SMALL_BTN} text-red-500`} onClick={onRemove}>삭제</button>
    </span>
  );
}

function moveItem<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// ── 편집기 본체 ─────────────────────────────────────────

function emptyChapter(): MagazineChapter {
  return { id: uid("ch"), kicker: "", title: "", layout: "split", main: { url: "", alt: "" }, subs: [], credits: [] };
}
// ── 구간 배경색 선택 ──
// 밝은 구간은 밝은 색, 어두운 구간은 어두운 색만 화면에 적용된다(글자색이 고정이라). 맞지 않는 색을 넣으면 안내만 보여주고 기본 배경으로 나온다.
function BgPicker({ bgKey, value, onChange }: { bgKey: MagazineBgKey; value?: string; onChange: (hex: string | undefined) => void }) {
  const tone = MAGAZINE_BG_TONE[bgKey];
  const hex = normalizeHex(value);
  const bad = !!hex && !isBgCompatible(bgKey, hex);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-gray-500 mr-0.5">배경색</span>
      {MAGAZINE_BG_PRESETS[tone].map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          aria-label={`배경색 ${c.label}`}
          onClick={() => onChange(c.value)}
          className={`w-5 h-5 rounded-full border ${hex === c.value ? "ring-2 ring-blue-500 ring-offset-1" : "border-gray-300"}`}
          style={{ backgroundColor: c.value }}
        />
      ))}
      <input type="color" aria-label="배경색 직접 선택" value={hex ?? MAGAZINE_BG_PRESETS[tone][0].value} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent" />
      <input
        className="w-[5.5rem] border border-gray-200 rounded-md px-2 py-1 text-xs font-mono"
        value={value ?? ""}
        placeholder="#rrggbb"
        aria-label="배경색 코드"
        onChange={(e) => onChange(e.target.value.trim() || undefined)}
      />
      {value && (
        <button type="button" className="text-[11px] text-gray-500 underline" onClick={() => onChange(undefined)}>기본으로</button>
      )}
      {bad && <span className="text-[11px] text-amber-600">이 구간은 {tone === "light" ? "밝은" : "어두운"} 색만 적용돼요(지금은 기본 배경)</span>}
    </div>
  );
}

// ── 제품 검색·선택 (제품 태그 자동 연결) ──
// 공개 제품 목록(/api/products)을 처음 열 때 한 번만 받아 메모리에 두고 검색한다.
type PickerProduct = { id: string; name: string; brand?: string; hideBrandPrefix?: boolean; productCode?: string | null };
let productCache: PickerProduct[] | null = null;

function ProductPicker({ onPick, popover = false }: { onPick: (p: { name: string; href: string }) => void; popover?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [list, setList] = useState<PickerProduct[] | null>(productCache);
  const [err, setErr] = useState("");

  async function openPicker() {
    setOpen(true);
    if (productCache) return;
    try {
      const r = await fetch("/api/products");
      if (!r.ok) throw new Error();
      const data = (await r.json()) as PickerProduct[];
      productCache = data;
      setList(data);
    } catch {
      setErr("제품 목록을 불러오지 못했습니다.");
    }
  }

  const term = q.trim().toLowerCase();
  const results = (list ?? [])
    .filter((p) => !term || `${p.brand ?? ""} ${p.name} ${p.productCode ?? ""} ${p.id}`.toLowerCase().includes(term))
    .slice(0, 12);

  if (!open) {
    return (
      <button type="button" className={SMALL_BTN + (popover ? " whitespace-nowrap shrink-0" : "")} onClick={openPicker}>
        제품 검색해서 연결
      </button>
    );
  }
  const panel = (
    <div className={`border border-blue-200 rounded-lg p-2 space-y-2 ${popover ? "absolute right-0 top-full mt-1 z-30 w-[26rem] max-w-[85vw] bg-white shadow-lg" : "bg-blue-50/40 w-full"}`}>
      <div className="flex gap-2">
        <input autoFocus className={INPUT} value={q} placeholder="제품명·브랜드·상품코드로 검색" onChange={(e) => setQ(e.target.value)} />
        <button type="button" className={SMALL_BTN} onClick={() => setOpen(false)}>닫기</button>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      {!list && !err && <p className="text-xs text-gray-500">불러오는 중…</p>}
      {list && results.length === 0 && <p className="text-xs text-gray-500">검색 결과가 없습니다.</p>}
      <ul className="max-h-56 overflow-auto divide-y divide-gray-100 bg-white rounded border border-gray-100">
        {results.map((p) => {
          const label = p.brand && !p.hideBrandPrefix ? `[${p.brand}] ${p.name}` : p.name;
          return (
            <li key={p.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                onClick={() => {
                  onPick({ name: p.name, href: `/products/${p.id}` });
                  setOpen(false);
                  setQ("");
                }}
              >
                {label} <span className="text-[11px] text-gray-400">{p.productCode ? `· ${p.productCode}` : ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
  if (!popover) return panel;
  return (
    <div className="relative shrink-0">
      <button type="button" className={SMALL_BTN + " whitespace-nowrap"} onClick={() => setOpen(false)}>
        제품 검색 닫기
      </button>
      {panel}
    </div>
  );
}

function emptyVideoBlock(): MagazineVideoBlock {
  return { id: uid("vb"), kicker: "Film", title: "", layout: "single", items: [{ id: uid("v"), url: "" }] };
}

// 유튜브 주소 한 줄 — 붙여넣으면 바로 인식 결과(썸네일/오류)를 보여준다
function VideoItemRow({ item, onChange, onRemove }: { item: MagazineVideoItem; onChange: (p: Partial<MagazineVideoItem>) => void; onRemove: () => void }) {
  const parsed = parseYouTubeUrl(item.url);
  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50 grid md:grid-cols-[140px_1fr_auto] gap-3 items-start">
      <div className="w-[140px] aspect-video bg-gray-200 rounded overflow-hidden flex items-center justify-center text-[11px] text-gray-400">
        {parsed ? <img src={`https://i.ytimg.com/vi/${parsed.id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" /> : "썸네일"}
      </div>
      <div className="space-y-2 min-w-0">
        <input className={INPUT} value={item.url} placeholder="유튜브 주소 붙여넣기 (영상·쇼츠 모두 가능)" onChange={(e) => onChange({ url: e.target.value })} />
        {item.url.trim() && (
          <p className={`text-[11px] ${parsed ? "text-green-600" : "text-red-500"}`}>
            {parsed ? `인식됨 · ${parsed.vertical ? "쇼츠(세로)" : "일반 영상(가로)"}` : "유튜브 주소를 인식하지 못했습니다. youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/… 형식이어야 합니다."}
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-2">
          <input className={INPUT} value={item.title ?? ""} placeholder="영상 제목 (선택)" onChange={(e) => onChange({ title: e.target.value || undefined })} />
          <input className={INPUT} value={item.caption ?? ""} placeholder="설명 (선택)" onChange={(e) => onChange({ caption: e.target.value || undefined })} />
        </div>
      </div>
      <button type="button" className={`${SMALL_BTN} text-red-500`} onClick={onRemove}>삭제</button>
    </div>
  );
}

function emptyWearing(): MagazineWearingItem {
  return { id: uid("wr"), image: { url: "", alt: "" }, name: "" };
}

export default function MagazineTab() {
  const [cfg, setCfg] = useState<HomeMagazineConfig>(DEFAULT_HOME_MAGAZINE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  // 챕터 · 제품 그룹별 접기 (카드 접기와 별개)
  const [closedCh, setClosedCh] = useState<Set<string>>(new Set());
  const toggleIn = (setter: typeof setClosedCh, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleCard = (id: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    fetch(API)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCfg(normalizeHomeMagazine(data, { forEditor: true })))
      .catch(() => setMsg({ type: "err", text: "불러오기에 실패했습니다. 새로고침해 주세요." }))
      .finally(() => setLoading(false));
  }, []);

  // 저장하지 않고 떠나려 할 때 경고
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const update = (patch: Partial<HomeMagazineConfig>) => {
    setCfg((c) => ({ ...c, ...patch }));
    setDirty(true);
    setMsg(null);
  };
  const patchChapter = (i: number, p: Partial<MagazineChapter>) => update({ chapters: cfg.chapters.map((c, k) => (k === i ? { ...c, ...p } : c)) });
  const patchWearing = (i: number, p: Partial<MagazineWearingItem>) =>
    update({ wearing: { ...cfg.wearing, items: cfg.wearing.items.map((x, k) => (k === i ? { ...x, ...p } : x)) } });

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "저장 실패");
      setDirty(false);
      setMsg({ type: "ok", text: "저장했습니다. 메인에 바로 반영됩니다." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "저장 실패" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500 py-10 text-center">불러오는 중…</p>;

  // 렌더 기준(normalize)으로 실제 노출 가능 여부를 판단
  const publishable = isMagazinePublishable(normalizeHomeMagazine(cfg));
  const missing = cfg.topBanner === "existing" ? [] : [!cfg.cover.image.url && "커버 이미지", !cfg.cover.actorName.trim() && "배우 이름"].filter(Boolean);

  // 커버 다음 구간들 — 아래 '섹션 순서'에서 정한 순서대로 화면에도 같은 순서로 나온다.
  const sectionBlocks: Record<Exclude<MagazineSectionKey, "videos">, ReactNode> = {
    interview: (
      <>
      {/* 인터뷰 */}
      <Card title="인터뷰">
        <ImageField label="인터뷰 사진" kind="medium" mobile multi spec={SPEC.interview} mobileSpec={SPEC.interviewMobile} image={cfg.interview.image} onChange={(image) => update({ interview: { ...cfg.interview, image } })} />
        <Text label="큰 인용구" multiline value={cfg.interview.quote} onChange={(v) => update({ interview: { ...cfg.interview, quote: v } })} />
        <div className="space-y-2">
          <p className={LABEL}>문답 (2개 권장)</p>
          {cfg.interview.qa.map((x, i) => (
            <div key={i} className="grid md:grid-cols-[1fr_2fr_auto] gap-2 items-start">
              <input className={INPUT} value={x.q} placeholder="질문" onChange={(e) => update({ interview: { ...cfg.interview, qa: cfg.interview.qa.map((y, k) => (k === i ? { ...y, q: e.target.value } : y)) } })} />
              <input className={INPUT} value={x.a} placeholder="답변" onChange={(e) => update({ interview: { ...cfg.interview, qa: cfg.interview.qa.map((y, k) => (k === i ? { ...y, a: e.target.value } : y)) } })} />
              <button type="button" className={`${SMALL_BTN} text-red-500 py-2`} onClick={() => update({ interview: { ...cfg.interview, qa: cfg.interview.qa.filter((_, k) => k !== i) } })}>삭제</button>
            </div>
          ))}
          <button type="button" className={SMALL_BTN} onClick={() => update({ interview: { ...cfg.interview, qa: [...cfg.interview.qa, { q: "", a: "" }] } })}>+ 문답 추가</button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Text label="전문 보기 링크 문구" value={cfg.interview.linkLabel ?? ""} placeholder="인터뷰 전문 보기" onChange={(v) => update({ interview: { ...cfg.interview, linkLabel: v || undefined } })} />
          <Text label="전문 보기 링크 주소 (비우면 숨김)" value={cfg.interview.linkHref ?? ""} placeholder="/story" onChange={(v) => update({ interview: { ...cfg.interview, linkHref: v || undefined } })} />
        </div>
      </Card>

      </>
    ),
    chapters: (
      <>
      {/* 챕터 */}
      <Card
        id="chapters"
        title={`챕터 (${cfg.chapters.length})`}
        desc="챕터를 추가하면 번호(01, 02…)가 순서대로 붙습니다. 예) 01 현장의 하루를 입다 / 02 캐주얼한 하루. 탭 방식이면 상단 탭으로 전환되고, 배우가 입은 제품도 챕터에 맞춰 바뀝니다. 메인 컷이 없는 챕터는 메인에 나오지 않습니다."
        right={
          <span className="flex items-center gap-2">
            <select className="border border-gray-200 rounded-md px-2 py-1.5 text-xs" value={cfg.chapterView} onChange={(e) => update({ chapterView: e.target.value as "tabs" | "stack" })} aria-label="챕터 보기 방식">
              <option value="tabs">보기: 탭으로 한 챕터씩 전환</option>
              <option value="stack">보기: 모든 챕터 펼치기</option>
            </select>
            <button type="button" className={SMALL_BTN} onClick={() => update({ chapters: [...cfg.chapters, emptyChapter()] })}>+ 챕터 추가</button>
          </span>
        }
      >
        {cfg.chapters.length === 0 && <p className="text-xs text-gray-400">챕터를 추가해 주세요. (현장 / 출근 / 주말 3개 권장)</p>}
        {cfg.chapters.map((ch, i) => (
          <div key={ch.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => toggleIn(setClosedCh, ch.id)} aria-expanded={!closedCh.has(ch.id)} className="flex items-center gap-2 min-w-0 text-left">
                <span aria-hidden className="text-gray-400 text-sm w-3">{closedCh.has(ch.id) ? "▸" : "▾"}</span>
                {closedCh.has(ch.id) && ch.main.url && <img src={ch.main.url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />}
                <span className="text-sm font-bold truncate">CHAPTER {String(i + 1).padStart(2, "0")} {ch.title && <span className="font-normal text-gray-500">· {ch.title}</span>}</span>
              </button>
              <RowActions index={i} total={cfg.chapters.length} onMove={(d) => update({ chapters: moveItem(cfg.chapters, i, d) })} onRemove={() => confirm("이 챕터를 삭제할까요?") && update({ chapters: cfg.chapters.filter((_, k) => k !== i) })} />
            </div>
            {!closedCh.has(ch.id) && (
            <div className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <Text label="작은 제목 (키커)" value={ch.kicker} placeholder="Chapter · On Site" onChange={(v) => patchChapter(i, { kicker: v })} />
              <Text label="제목" value={ch.title} placeholder="현장의 하루를 입다" onChange={(v) => patchChapter(i, { title: v })} />
              <div>
                <label className={LABEL}>레이아웃</label>
                <select className={INPUT} value={ch.layout} onChange={(e) => patchChapter(i, { layout: e.target.value as MagazineChapter["layout"] })}>
                  {MAGAZINE_CHAPTER_LAYOUTS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Text label="본문 (선택) — 엔터로 문단 구분, 첫 문단은 리드(큰 글씨)로 나옵니다" multiline rows={4} value={ch.body ?? ""} onChange={(v) => patchChapter(i, { body: v || undefined })} />
              <Text label="풀 쿼트 (선택) — 사진 사이에 크게 들어가는 인용문" multiline rows={4} value={ch.quote ?? ""} onChange={(v) => patchChapter(i, { quote: v || undefined })} />
            </div>
            {/* 메인 컷(왼쪽) · 보조 컷(오른쪽) 좌우 배치 — 풀블리드는 보조 컷이 없어 메인 컷만 */}
            <div className={ch.layout !== "fullbleed" ? "grid xl:grid-cols-2 gap-4 items-start" : ""}>
              <ImageField
                label="메인 컷 (A컷)"
                kind={ch.layout === "fullbleed" ? "large" : "medium"}
                mobile
                spec={ch.layout === "fullbleed" ? SPEC.chapterFullPc : ch.layout === "mosaic" ? SPEC.chapterMosaic : SPEC.chapterSplit}
                mobileSpec={ch.layout === "fullbleed" ? SPEC.chapterFullMobile : ch.layout === "mosaic" ? SPEC.chapterMosaicMobile : SPEC.chapterSplitMobile}
                image={ch.main} onChange={(main) => patchChapter(i, { main })} />
              {ch.layout !== "fullbleed" && (
                <ImageListField
                  label="보조 컷 (B컷)"
                  kind="small"
                  max={ch.layout === "split" ? 2 : 3}
                  hint={ch.layout === "split" ? "디테일 2장" : "모자이크 3장"}
                  spec={ch.layout === "split" ? SPEC.chapterSubSplit : undefined}
                slotLabels={MAGAZINE_SUB_SLOTS[ch.layout === "mosaic" ? "mosaic" : "split"]}
                  compact
                  images={ch.subs}
                  onChange={(subs) => patchChapter(i, { subs })}
                />
              )}
            </div>
            <div className="space-y-2">
              <p className={LABEL}>제품 태그 <span className="font-normal text-gray-400">· 사진 아래 #태그로 나오고, 누르면 연결한 페이지로 이동합니다</span></p>
              {ch.credits.map((c, k) => (
                <div key={k} className="grid md:grid-cols-[1fr_1.3fr_auto] gap-2">
                  <input className={INPUT} value={c.name} placeholder="태그 이름 (예: 스트레치 카고 팬츠)" onChange={(e) => patchChapter(i, { credits: ch.credits.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)) })} />
                  <input className={INPUT} value={c.href ?? ""} placeholder="이동 주소 (/products/코드, 매장 /store, 외부 https://…)" onChange={(e) => patchChapter(i, { credits: ch.credits.map((x, j) => (j === k ? { ...x, href: e.target.value || undefined } : x)) })} />
                  <button type="button" className={`${SMALL_BTN} text-red-500`} onClick={() => patchChapter(i, { credits: ch.credits.filter((_, j) => j !== k) })}>삭제</button>
                </div>
              ))}
              <div className="flex flex-wrap items-start gap-2">
                <button type="button" className={SMALL_BTN} onClick={() => patchChapter(i, { credits: [...ch.credits, { name: "" }] })}>+ 태그 직접 추가</button>
                <ProductPicker onPick={(p) => patchChapter(i, { credits: [...ch.credits, { name: p.name, href: p.href }] })} />
              </div>
            </div>
            </div>
            )}
          </div>
        ))}
      </Card>

      </>
    ),
    behind: (
      <>
      {/* 비하인드 */}
      <Card title="비하인드 (촬영 현장)" desc="B컷을 모아 보여주는 구간. 처음엔 모바일 6장 / PC 12장만 보이고 '더 보기'로 펼쳐집니다.">
        <Text label="제목" value={cfg.behind.title} onChange={(v) => update({ behind: { ...cfg.behind, title: v } })} />
        <ImageListField label="사진" kind="medium" spec={SPEC.behind} images={cfg.behind.images} onChange={(images) => update({ behind: { ...cfg.behind, images } })} />
      </Card>

      </>
    ),
    wearing: (
      <>
      {/* 착용 제품 */}
      <Card
        title="배우가 입은 제품"
        desc="챕터별로 제품을 추가하세요. 상단 챕터를 전환하면 그 챕터의 제품이 나오고, '공통' 제품은 모든 챕터에 함께 나옵니다. 가격·구매 버튼 없이 제품명과 상세 링크만 노출되며, PC에서 4개를 넘으면 가로로 스크롤됩니다."
      >
        <Text label="제목" value={cfg.wearing.title} onChange={(v) => update({ wearing: { ...cfg.wearing, title: v } })} />
        {(() => {
          // 챕터별 그룹 — 각 챕터마다 제품을 따로 추가하고, 마지막 '공통' 그룹은 모든 챕터에 함께 나온다.
          const chapterIds = new Set(cfg.chapters.map((c) => c.id));
          const groups = [
            ...cfg.chapters.map((c, k) => ({ key: c.id, chapterId: c.id as string | undefined, title: `챕터 ${String(k + 1).padStart(2, "0")}${c.title ? ` · ${c.title}` : ""}` })),
            { key: "common", chapterId: undefined as string | undefined, title: "공통 (모든 챕터에 노출)" },
          ];
          const belongs = (it: MagazineWearingItem, chapterId?: string) => (chapterId ? it.chapterId === chapterId : !it.chapterId || !chapterIds.has(it.chapterId));
          const swap = (a: number, b: number) => {
            const items = [...cfg.wearing.items];
            [items[a], items[b]] = [items[b], items[a]];
            update({ wearing: { ...cfg.wearing, items } });
          };
          return groups.map((g) => {
            const idxs = cfg.wearing.items.map((it, i) => (belongs(it, g.chapterId) ? i : -1)).filter((i) => i >= 0);
            return (
              <div key={g.key} className="rounded-lg border border-gray-200 bg-gray-50/40 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => toggleIn(setClosedCh, `wear-${g.key}`)} aria-expanded={!closedCh.has(`wear-${g.key}`)} className="flex items-center gap-2 min-w-0 text-left">
                    <span aria-hidden className="text-gray-400 text-sm w-3">{closedCh.has(`wear-${g.key}`) ? "▸" : "▾"}</span>
                    <span className="text-sm font-bold truncate">
                      {g.title} <span className="font-normal text-gray-400">· 제품 {idxs.length}개</span>
                    </span>
                  </button>
                  <span className="flex items-center gap-2">
                    {/* 다른 챕터(또는 공통)에 있는 제품을 골라 이 챕터로 이동 */}
                    {(() => {
                      const others = cfg.wearing.items.map((it, i) => ({ it, i })).filter(({ it }) => !belongs(it, g.chapterId));
                      if (others.length === 0) return null;
                      const groupLabel = (it: MagazineWearingItem) => {
                        const k = cfg.chapters.findIndex((c) => c.id === it.chapterId);
                        return k >= 0 ? `챕터 ${String(k + 1).padStart(2, "0")}` : "공통";
                      };
                      return (
                        <select
                          className={POS_SELECT}
                          value=""
                          aria-label="다른 챕터의 제품을 이 챕터로 이동"
                          onChange={(e) => e.target.value !== "" && patchWearing(Number(e.target.value), { chapterId: g.chapterId })}
                        >
                          <option value="">다른 챕터 제품 이동해 오기</option>
                          {others.map(({ it, i }) => (
                            <option key={it.id} value={i}>{`${groupLabel(it)} · ${it.name || "(이름 없음)"}`}</option>
                          ))}
                        </select>
                      );
                    })()}
                    <button type="button" className={SMALL_BTN} onClick={() => update({ wearing: { ...cfg.wearing, items: [...cfg.wearing.items, { ...emptyWearing(), chapterId: g.chapterId }] } })}>
                      + 제품 추가
                    </button>
                  </span>
                </div>
                {!closedCh.has(`wear-${g.key}`) && (
                <>
                {idxs.length === 0 && <p className="text-xs text-gray-400">아직 제품이 없습니다.</p>}
                {/* 제품 카드를 가로로 나란히(넓은 화면 3열 · 보통 2열) */}
                <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3 items-start">
                {idxs.map((i, pos) => {
                  const item = cfg.wearing.items[i];
                  return (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold whitespace-nowrap">제품 {pos + 1}</p>
                        <RowActions
                          index={pos}
                          total={idxs.length}
                          onMove={(d) => swap(i, idxs[pos + d])}
                          onRemove={() => update({ wearing: { ...cfg.wearing, items: cfg.wearing.items.filter((_, k) => k !== i) } })}
                        />
                      </div>
                      <ImageField label="착용컷" kind="small" side hidePosition spec={SPEC.wearing} image={item.image} onChange={(image) => patchWearing(i, { image })} />
                      <div className="grid grid-cols-2 gap-3">
                        <Text label="제품명" value={item.name} onChange={(v) => patchWearing(i, { name: v })} />
                        <Text label="보조 문구" value={item.caption ?? ""} placeholder="CH.01 착용" onChange={(v) => patchWearing(i, { caption: v || undefined })} />
                        <div className="col-span-2">
                          <label className={LABEL}>이동 주소</label>
                          <div className="flex items-start gap-2">
                            <input className={INPUT} value={item.href ?? ""} placeholder="/products/상품코드" onChange={(e) => patchWearing(i, { href: e.target.value || undefined })} />
                            <ProductPicker popover onPick={(p) => patchWearing(i, { name: p.name, href: p.href })} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
                </>
                )}
              </div>
            );
          });
        })()}
      </Card>

      </>
    ),
    closing: (
      <>
      {/* 클로징 */}
      <Card title="클로징 (매장 방문 유도)" desc="'가까운 매장 찾기' 버튼은 항상 나오고, 전화·카카오톡은 입력했을 때만 나옵니다.">
        <ImageField label="배경 사진" kind="large" mobile spec={SPEC.closing} mobileSpec={SPEC.closingMobile} image={cfg.closing.image} onChange={(image) => update({ closing: { ...cfg.closing, image } })} />
        <div className="flex items-center gap-3">
          <label className={LABEL + " !mb-0 whitespace-nowrap"} htmlFor="closing-blur">배경 흐림</label>
          <input id="closing-blur" type="range" min={0} max={20} step={1} value={cfg.closing.blur ?? 0} onChange={(e) => update({ closing: { ...cfg.closing, blur: Number(e.target.value) || undefined } })} className="w-56 accent-blue-600" />
          <span className="text-xs text-gray-500 w-10">{cfg.closing.blur ?? 0}px</span>
          <span className="text-[11px] text-gray-400">산업 현장 같은 배경 사진을 흐릿하게 깔 때 올려 주세요(0이면 선명)</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Text label="작은 문구" value={cfg.closing.eyebrow} onChange={(v) => update({ closing: { ...cfg.closing, eyebrow: v } })} />
          <Text label="제목" value={cfg.closing.title} onChange={(v) => update({ closing: { ...cfg.closing, title: v } })} />
          <Text label="설명" value={cfg.closing.sub} onChange={(v) => update({ closing: { ...cfg.closing, sub: v } })} />
          <Text label="전화번호 (선택)" value={cfg.closing.phone ?? ""} placeholder="070-0000-0000" onChange={(v) => update({ closing: { ...cfg.closing, phone: v || undefined } })} />
          <Text label="카카오톡 채널 주소 (선택)" value={cfg.closing.kakaoUrl ?? ""} placeholder="https://pf.kakao.com/..." onChange={(v) => update({ closing: { ...cfg.closing, kakaoUrl: v || undefined } })} />
        </div>
      </Card>

      </>
    ),
  };
  const videosBlockNode = (
    <>
      {/* 유튜브 영상 */}
      <Card
        id="videos"
        title={`유튜브 영상 (${cfg.videos.length})`}
        desc="유튜브 주소를 붙여넣어 영상 구간을 만듭니다. 위치는 '섹션 순서'에서 정합니다. 처음엔 썸네일만 보이고, 누르면 재생됩니다(페이지 속도에 영향 없음)."
        right={<button type="button" className={SMALL_BTN} onClick={() => update({ videos: [...cfg.videos, emptyVideoBlock()] })}>+ 영상 구간 추가</button>}
      >
        {cfg.videos.length === 0 && <p className="text-xs text-gray-400">영상 구간이 없습니다. 위 버튼으로 추가해 주세요.</p>}
        {cfg.videos.map((vb, i) => {
          const patchBlock = (p: Partial<MagazineVideoBlock>) => update({ videos: cfg.videos.map((x, k) => (k === i ? { ...x, ...p } : x)) });
          const patchItem = (k: number, p: Partial<MagazineVideoItem>) => patchBlock({ items: vb.items.map((x, j) => (j === k ? { ...x, ...p } : x)) });
          return (
            <div key={vb.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">영상 구간 {i + 1}{vb.title && <span className="font-normal text-gray-500"> · {vb.title}</span>}</p>
                <RowActions index={i} total={cfg.videos.length} onMove={(d) => update({ videos: moveItem(cfg.videos, i, d) })} onRemove={() => confirm("이 영상 구간을 삭제할까요?") && update({ videos: cfg.videos.filter((_, k) => k !== i) })} />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>배치</label>
                  <select className={INPUT} value={vb.layout} onChange={(e) => patchBlock({ layout: e.target.value as MagazineVideoBlock["layout"] })}>
                    <option value="single">크게 1개씩 (세로로 나열)</option>
                    <option value="grid">여러 개 나란히 (2~3열)</option>
                  </select>
                </div>
                <Text label="작은 제목 (키커)" value={vb.kicker ?? ""} placeholder="Film" onChange={(v) => patchBlock({ kicker: v || undefined })} />
              </div>
              <Text label="구간 제목" value={vb.title} placeholder="촬영 현장 영상" onChange={(v) => patchBlock({ title: v })} />
              <div className="space-y-2">
                {vb.items.map((it, k) => (
                  <VideoItemRow key={it.id} item={it} onChange={(p) => patchItem(k, p)} onRemove={() => patchBlock({ items: vb.items.filter((_, j) => j !== k) })} />
                ))}
                <button type="button" className={SMALL_BTN} onClick={() => patchBlock({ items: [...vb.items, { id: uid("v"), url: "" }] })}>+ 영상 추가</button>
              </div>
            </div>
          );
        })}
      </Card>

    </>
  );
  const allCardIds = ["공개 설정", "섹션 순서", "toc", "커버", "인터뷰", "chapters", "videos", "비하인드 (촬영 현장)", "배우가 입은 제품", "클로징 (매장 방문 유도)"];

  return (
    <CollapseCtx.Provider value={{ closed, toggle: toggleCard }}>
    <div className="space-y-5 pb-24">
      <div className="flex justify-end gap-2">
        <button type="button" className={SMALL_BTN} onClick={() => setClosed(new Set(allCardIds))}>모두 접기</button>
        <button type="button" className={SMALL_BTN} onClick={() => setClosed(new Set())}>모두 펼치기</button>
      </div>
      {/* 공개 상태 */}
      <Card
        title="공개 설정"
        desc="배우 계약 기간에만 공개하세요. 계약이 끝나면 공개를 끄고, 메인 배치에서 숨겼던 기존 섹션을 다시 켜면 원래 메인으로 돌아갑니다."
        right={
          <span className="flex flex-col items-end gap-1.5">
            <a href="/magazine-preview" target="_blank" rel="noopener noreferrer" className={SMALL_BTN + " whitespace-nowrap"}>
              실제 사이트 미리보기 ↗
            </a>
            <a href="/magazine-preview?view=home" target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-500 underline">
              메인 전체 배치로 보기 ↗
            </a>
          </span>
        }
      >
        <Toggle checked={cfg.enabled} onChange={(v) => update({ enabled: v })} label="메인에 공개" />
        <div>
          <p className={LABEL}>상단 배너 (메인 맨 위) — 언제든 전환할 수 있어요</p>
          <div className="grid md:grid-cols-2 gap-2">
            {([
              { v: "magazine", t: "매거진 커버", d: "배우 커버가 맨 위에 나옵니다. 기존 메인 비주얼은 자동으로 숨겨집니다." },
              { v: "existing", t: "기존 배너", d: "기존 메인 비주얼(슬라이딩 배너)이 맨 위에 나옵니다. 매거진 커버는 숨겨지고 아래 구간부터 이어집니다." },
            ] as const).map((o) => (
              <label key={o.v} className={`flex gap-2.5 items-start rounded-lg border p-3 cursor-pointer ${cfg.topBanner === o.v ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" name="mag-top-banner" className="mt-1 accent-blue-600" checked={cfg.topBanner === o.v} onChange={() => update({ topBanner: o.v })} />
                <span>
                  <span className="block text-sm font-semibold">{o.t}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{o.d}</span>
                </span>
              </label>
            ))}
          </div>
          {cfg.topBanner === "existing" && (
            <p className="text-[11px] text-gray-500 mt-1.5">
              기존 배너 내용은 <a href="/admin/main/home?tab=visual" className="underline text-blue-600">메인 관리 › 슬라이딩</a>에서 편집합니다. 메인 배치에서 메인 비주얼이 보이기 상태여야 합니다.
            </p>
          )}
        </div>
        <p className={`text-xs rounded-lg px-3 py-2 ${publishable ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          {publishable
            ? "저장하면 메인에 노출됩니다. (메인 배치에서 '캠페인 매거진'이 보이기 상태여야 합니다)"
            : cfg.enabled
              ? `아직 노출되지 않습니다 — ${missing.join(", ")}을(를) 입력해 주세요.`
              : "비공개 상태입니다. 메인에는 기존 화면이 그대로 나옵니다."}
        </p>
      </Card>

      {/* 커버 */}
      <Card title="커버" desc={cfg.topBanner === "existing" ? "지금은 '기존 배너'가 상단이라 커버는 사용되지 않습니다. (공개 설정에서 전환)" : "첫 화면. 배우 정면 포트레이트 1장(A컷)을 쓰세요. 이미지에는 글자를 넣지 말고 아래 칸에 입력합니다."}>
        <ImageField label="커버 이미지" kind="large" mobile multi spec={SPEC.coverPc} mobileSpec={SPEC.coverMobile} image={cfg.cover.image} onChange={(image) => update({ cover: { ...cfg.cover, image } })} />
        <div className="grid md:grid-cols-4 gap-3">
          <Text label="배우 이름 (필수)" value={cfg.cover.actorName} onChange={(v) => update({ cover: { ...cfg.cover, actorName: v } })} />
          <Text label="이름 위 문구" value={cfg.cover.eyebrow} placeholder="WORKUP with" onChange={(v) => update({ cover: { ...cfg.cover, eyebrow: v } })} />
          <Text label="이슈 표기" value={cfg.issue.label} placeholder="ISSUE 01" onChange={(v) => update({ issue: { ...cfg.issue, label: v } })} />
          <Text label="시즌 표기 (PC만)" value={cfg.issue.season} placeholder="2026 SUMMER CAMPAIGN" onChange={(v) => update({ issue: { ...cfg.issue, season: v } })} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Text label="배우 한마디 (인용구)" multiline rows={2} value={cfg.cover.quote} onChange={(v) => update({ cover: { ...cfg.cover, quote: v } })} />
          <Text
            label="우측 상단 목차 (PC만, 한 줄에 하나)"
            multiline
            rows={2}
            value={cfg.cover.coverLines.join("\n")}
            onChange={(v) => update({ cover: { ...cfg.cover, coverLines: v.split("\n") } })}
          />
        </div>
      </Card>

      {/* 섹션 순서 · 접기 */}
      <Card id="섹션 순서" title="섹션 순서" desc="커버 다음 구간의 순서와 노출 여부를 정합니다. 아래 편집 카드와 실제 화면이 같은 순서로 바뀌고, 노출을 끈 구간은 화면과 목차에서 빠집니다.">
        <button
          type="button"
          className={SMALL_BTN}
          onClick={() => {
            const id = uid("d");
            update({ dividers: [...cfg.dividers, { id, enabled: true, style: "line", space: "md" }], sectionOrder: [...cfg.sectionOrder, `divider:${id}`] });
          }}
        >
          + 구분선 추가
        </button>
        <ol className="space-y-1.5">
          <li className="flex items-center gap-3 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg px-3 py-2">
            <span className="w-5 text-center">·</span>커버 <span className="text-[11px]">(항상 맨 위)</span>
          </li>
          {cfg.sectionOrder.map((key, i) => {
            const on = isSectionEnabled(cfg, key);
            const divider = isDividerKey(key) ? cfg.dividers.find((d) => d.id === key.slice(8)) : undefined;
            const patchDivider = (p: Partial<MagazineDivider>) => update({ dividers: cfg.dividers.map((d) => (d.id === divider!.id ? { ...d, ...p } : d)) });
            return (
              <li key={key} className={`border rounded-lg px-3 py-2 space-y-2 ${on ? "border-gray-200" : "border-gray-200 bg-gray-50"}`}>
                <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm ${on ? "" : "text-gray-400"}`}>
                  <span className="w-5 text-center text-gray-400">{i + 1}</span>
                  <span className={divider ? "flex-1" : "w-36 shrink-0"}>{divider ? `구분선 · ${MAGAZINE_DIVIDER_STYLES.find((x) => x.value === divider.style)?.label}` : MAGAZINE_SECTIONS.find((x) => x.key === key)?.label}</span>
                  {!divider && (
                    <div className="flex-1 min-w-0">
                      <BgPicker bgKey={key as MagazineBgKey} value={cfg.sectionBg[key as MagazineBgKey]} onChange={(hex) => update({ sectionBg: { ...cfg.sectionBg, [key]: hex } })} />
                    </div>
                  )}
                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none mr-1">
                    <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={on} onChange={(e) => { setCfg((c) => withSectionEnabled(c, key, e.target.checked)); setDirty(true); setMsg(null); }} />
                    노출
                  </label>
                  <button type="button" className={SMALL_BTN} disabled={i === 0} onClick={() => update({ sectionOrder: moveItem(cfg.sectionOrder, i, -1) })}>↑ 위로</button>
                  <button type="button" className={SMALL_BTN} disabled={i === cfg.sectionOrder.length - 1} onClick={() => update({ sectionOrder: moveItem(cfg.sectionOrder, i, 1) })}>↓ 아래로</button>
                  {divider && (
                    <button type="button" className={`${SMALL_BTN} text-red-500`} onClick={() => update({ sectionOrder: cfg.sectionOrder.filter((k) => k !== key), dividers: cfg.dividers.filter((d) => d.id !== divider.id) })}>삭제</button>
                  )}
                </div>
                {divider ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <select className={POS_SELECT} value={divider.style} onChange={(e) => patchDivider({ style: e.target.value as MagazineDivider["style"] })} aria-label="구분선 모양">
                      {MAGAZINE_DIVIDER_STYLES.map((x) => (
                        <option key={x.value} value={x.value}>{x.label}</option>
                      ))}
                    </select>
                    <select className={POS_SELECT} value={divider.space} onChange={(e) => patchDivider({ space: e.target.value as MagazineDivider["space"] })} aria-label="위아래 여백">
                      {MAGAZINE_DIVIDER_SPACES.map((x) => (
                        <option key={x.value} value={x.value}>{x.label}</option>
                      ))}
                    </select>
                    {divider.style === "label" && (
                      <input className="border border-gray-200 rounded-md px-2 py-1 text-xs w-40" value={divider.label ?? ""} placeholder="선 가운데 글자" onChange={(e) => patchDivider({ label: e.target.value || undefined })} />
                    )}
                    <label className="inline-flex items-center gap-1 text-gray-500">
                      선 색
                      <input type="color" className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent" value={divider.color ?? "#1d1e20"} onChange={(e) => patchDivider({ color: e.target.value })} />
                    </label>
                    <label className="inline-flex items-center gap-1 text-gray-500">
                      배경색
                      <input type="color" className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent" value={divider.bg ?? "#f6f4ef"} onChange={(e) => patchDivider({ bg: e.target.value })} />
                      {divider.bg && <button type="button" className="text-[11px] underline" onClick={() => patchDivider({ bg: undefined })}>기본으로</button>}
                    </label>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Card>

      {/* 목차 편집 */}
      <Card id="toc" title="목차 (In this issue)" desc="커버 아래 목차입니다. 기본은 노출되는 구간이 자동으로 나열되고, '직접 편집'으로 항목을 수정·추가·삭제할 수 있습니다.">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Toggle checked={cfg.contents.enabled} onChange={(v) => update({ contents: { ...cfg.contents, enabled: v } })} label="커버 아래에 목차 보여주기" />
          <BgPicker bgKey="contents" value={cfg.sectionBg.contents} onChange={(hex) => update({ sectionBg: { ...cfg.sectionBg, contents: hex } })} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Text label="목차 제목 (줄바꿈 가능)" multiline rows={2} value={cfg.contents.heading ?? ""} placeholder={"In this\nissue"} onChange={(v) => update({ contents: { ...cfg.contents, heading: v || undefined } })} />
          <Text label="목차 소제목" value={cfg.contents.subtitle ?? ""} placeholder={cfg.issue.season || "2026 F/W CAMPAIGN"} onChange={(v) => update({ contents: { ...cfg.contents, subtitle: v || undefined } })} />
        </div>
        {cfg.contents.items === undefined ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-4 space-y-2">
            <p className="text-xs text-gray-500">지금은 <b>자동</b>입니다 — 노출되는 구간이 섹션 순서대로 나열되고, 챕터는 한 줄에서 제목이 롤링됩니다.</p>
            <button type="button" className={SMALL_BTN} onClick={() => update({ contents: { ...cfg.contents, items: buildAutoContentsItems(cfg).map((it) => ({ ...it })) } })}>
              직접 편집하기 (현재 목차를 복사해서 시작)
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const items = cfg.contents.items!;
              const setItems = (next: MagazineContentsItem[]) => update({ contents: { ...cfg.contents, items: next } });
              const patchToc = (i: number, p: Partial<MagazineContentsItem>) => setItems(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
              return (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={SMALL_BTN} onClick={() => setItems([...items, { id: uid("toc"), title: "", note: "", target: "behind" }])}>+ 항목 추가</button>
                    <button type="button" className={SMALL_BTN} onClick={() => confirm("직접 편집한 목차를 지우고 자동 목차로 되돌릴까요?") && update({ contents: { ...cfg.contents, items: undefined } })}>자동 목차로 되돌리기</button>
                  </div>
                  {items.length === 0 && <p className="text-xs text-gray-400">항목이 없습니다. 위 버튼으로 추가해 주세요.</p>}
                  {items.map((it, i) => (
                    <div key={it.id} className="border border-gray-200 rounded-lg px-3 py-2 bg-white space-y-2">
                      {/* 한 줄 배치: 번호 · 이동 대상 · 제목 · 보조 문구 · 순서/삭제 */}
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold w-10 shrink-0">{String(i + 1).padStart(2, "0")}</p>
                        <select className={INPUT + " !w-auto min-w-[11rem] flex-1"} aria-label="이동 대상" value={it.target} onChange={(e) => patchToc(i, { target: e.target.value })}>
                          <option value="chapters">챕터 전체 (제목 자동 롤링)</option>
                          {cfg.chapters.map((c, k) => (
                            <option key={c.id} value={`ch:${c.id}`}>{`챕터 ${String(k + 1).padStart(2, "0")}${c.title ? ` · ${c.title}` : ""}`}</option>
                          ))}
                          <option value="interview">인터뷰</option>
                          <option value="videos">유튜브 영상</option>
                          <option value="behind">비하인드 (촬영 현장)</option>
                          <option value="wearing">배우가 입은 제품</option>
                          <option value="closing">클로징</option>
                          <option value="custom">직접 입력한 주소</option>
                        </select>
                        {it.target === "chapters" ? (
                          <p className="flex-[2] min-w-[14rem] text-xs text-gray-400">챕터 제목·키커가 자동으로 롤링됩니다(입력 불필요).</p>
                        ) : (
                          <>
                            <input className={INPUT + " !w-auto flex-1 min-w-[9rem]"} aria-label="제목" placeholder="제목" value={it.title} onChange={(e) => patchToc(i, { title: e.target.value })} />
                            <input className={INPUT + " !w-auto flex-1 min-w-[9rem]"} aria-label="보조 문구" placeholder="보조 문구 (예: Behind the scenes)" value={it.note} onChange={(e) => patchToc(i, { note: e.target.value })} />
                          </>
                        )}
                        <RowActions index={i} total={items.length} onMove={(d) => setItems(moveItem(items, i, d))} onRemove={() => setItems(items.filter((_, k) => k !== i))} />
                      </div>
                      {it.target === "custom" && (
                        <input className={INPUT} aria-label="이동 주소" placeholder="이동 주소: /store, #mag-wearing, https://…" value={it.href ?? ""} onChange={(e) => patchToc(i, { href: e.target.value || undefined })} />
                      )}
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        )}
      </Card>

      {cfg.sectionOrder.map((k) => (
        <Fragment key={k}>{isDividerKey(k) ? null : k === "videos" ? videosBlockNode : sectionBlocks[k]}</Fragment>
      ))}

      {/* 하단 고정 저장 바 */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3">
        {msg && <span className={`text-sm ${msg.type === "ok" ? "text-green-600" : "text-red-500"}`}>{msg.text}</span>}
        {dirty && !msg && <span className="text-sm text-amber-600">저장하지 않은 변경사항이 있습니다.</span>}
        <button type="button" onClick={save} disabled={saving || !dirty} className="bg-blue-600 text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40">
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
    </CollapseCtx.Provider>
  );
}
