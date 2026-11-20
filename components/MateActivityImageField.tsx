"use client";

import { useRef, useState, type ChangeEvent } from "react";

const maxBytes = 640 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

async function prepareImage(file: File) {
  if (!acceptedTypes.includes(file.type) || file.size > 12 * 1024 * 1024) {
    throw new Error("12MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 불러오지 못했습니다.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.72, 0.6, 0.45]) {
      const result = canvas.toDataURL("image/webp", quality);
      if (result.startsWith("data:image/webp;base64,") && result.length < Math.ceil(maxBytes * 4 / 3)) return result;
    }
    throw new Error("사진을 최적화하지 못했습니다. 더 작은 사진을 선택해 주세요.");
  } finally {
    bitmap.close();
  }
}

export default function MateActivityImageField({ current }: { current: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const [stagedImage, setStagedImage] = useState("");
  const [requestedImage, setRequestedImage] = useState("");
  const [remove, setRemove] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const preview = requestedImage || (remove ? "" : current);

  async function select(event: ChangeEvent<HTMLInputElement>) {
    const target = event.currentTarget;
    const file = target.files?.[0];
    if (!file) return;
    const currentSelection = ++selection.current;
    setError("");
    setStagedImage("");
    setLoading(true);
    target.setCustomValidity("이미지를 처리하고 있습니다.");
    try {
      const image = await prepareImage(file);
      if (selection.current !== currentSelection) return;
      setStagedImage(image);
      target.setCustomValidity("이미지 추가 버튼을 눌러 주세요.");
    } catch (cause) {
      if (selection.current !== currentSelection) return;
      setError(cause instanceof Error ? cause.message : "다른 이미지 파일을 선택해 주세요.");
      target.value = "";
      target.setCustomValidity("");
    } finally {
      if (selection.current === currentSelection) setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="mate-activity-image" className="shrink-0 text-sm font-bold">제품 이미지</label>
        <input ref={input} id="mate-activity-image" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={select} className="min-w-0 max-w-56 text-sm file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2" />
        <button type="button" disabled={loading || !stagedImage}
          className="inline-flex min-h-9 shrink-0 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-bold disabled:opacity-50"
          onClick={() => {
            setRequestedImage(stagedImage);
            setStagedImage("");
            setRemove(false);
            input.current?.setCustomValidity("");
          }}>이미지 추가</button>
      </div>
      <input type="hidden" name="product_image_webp" value={requestedImage.split(",")[1] ?? ""} />
      <input type="hidden" name="remove_product_image" value={remove ? "yes" : "no"} />
      {loading && <p role="status" className="text-sm">이미지를 준비하고 있습니다.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {stagedImage && !loading && <button type="button" className="min-h-9 text-sm text-slate-600 underline" onClick={() => {
        setStagedImage("");
        if (input.current) {
          input.current.value = "";
          input.current.setCustomValidity("");
        }
      }}>선택 취소</button>}
      {preview && <div className="flex flex-wrap items-end gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- Local or access-controlled preview. */}
        <img src={preview} alt="제품 이미지 미리보기" className="max-h-36 max-w-full rounded-md border border-slate-200 object-contain" />
        <button type="button" disabled={loading} className="min-h-9 px-2 text-sm font-semibold text-red-700 underline" onClick={() => {
          setRequestedImage("");
          setStagedImage("");
          setRemove(Boolean(current));
          if (input.current) {
            input.current.value = "";
            input.current.setCustomValidity("");
          }
        }}>이미지 삭제</button>
      </div>}
      {remove && !requestedImage && <p className="text-sm text-slate-600">저장하면 기존 이미지가 삭제됩니다.</p>}
    </div>
  );
}