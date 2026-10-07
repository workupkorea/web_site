"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import DOMPurify from "isomorphic-dompurify";
import DescriptionField from "./DescriptionField";
import CoverAndDetailImagesField from "./CoverAndDetailImagesField";
import { noticeCoverAspect } from "@/lib/noticeImage";

// 지점 출고 패스에서 빠르게 등록한 "마감패스 전용" 상품 — products 테이블(사이트 카탈로그)과 무관하게
// 공지(notices)에 이름/썸네일/설명을 직접 저장한다. 나중에 진짜 상품으로 옮기는 기능은 별도 작업.
type TempProductEntry = {
  temp_name: string;
  temp_image_url: string | null;
  temp_tagline: string | null;
  temp_image_portrait?: boolean;
};

export default function NoticeProductPicker({ onCreated }: { onCreated?: (id: string) => void } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed") === "1";
  const goToNotice = (id: string) => {
    if (onCreated) { onCreated(id); return; }
    router.push(`/notices/${id}${embed ? "?embed=1" : ""}`);
  };

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const showInfo = (text: string) => {
    setInfo(text);
    setTimeout(() => setInfo(""), 4000);
  };

  // ── 기존 상품에서 선택 (지점 출고 패스로 이전에 등록했던 마감패스 전용 상품만) ──
  const [existing, setExisting] = useState<TempProductEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [extraDesc, setExtraDesc] = useState("");
  const [extraImages, setExtraImages] = useState<string[]>([]);
  // 목록엔 이름만 보이고, 눌러보면(미리보기) 사진·설명까지 확인할 수 있다.
  const [previewEntry, setPreviewEntry] = useState<TempProductEntry | null>(null);

  useEffect(() => {
    fetch("/api/admin/notices/existing-temp-products")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setExisting(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return existing.slice(0, 30);
    return existing.filter((p) => p.temp_name.toLowerCase().includes(q)).slice(0, 30);
  }, [existing, query]);

  const openNoticeForm = (name: string) => {
    setExpandedName((prev) => (prev === name ? null : name));
    setExtraDesc("");
    setExtraImages([]);
    setError("");
  };

  const createNoticeFromExisting = async (entry: TempProductEntry) => {
    setError("");
    setCreatingName(entry.temp_name);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temp_name: entry.temp_name,
          temp_image_url: entry.temp_image_url,
          temp_tagline: entry.temp_tagline,
          temp_image_portrait: entry.temp_image_portrait ?? false,
          description: extraDesc.trim() || undefined,
          extra_images: extraImages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "공지 생성에 실패했습니다.");
        return;
      }
      goToNotice(data.id);
    } catch {
      setError("네트워크 오류로 공지 생성에 실패했습니다.");
    } finally {
      setCreatingName(null);
    }
  };

  // ── 새 상품 임시등록 (대표 썸네일 + 상품명 + 상품설명만 — products 테이블에는 만들지 않는다) ──
  const [qName, setQName] = useState("");
  const [qTagline, setQTagline] = useState("");
  const [qCover, setQCover] = useState("");
  const [qPortrait, setQPortrait] = useState(false);
  const [qSaving, setQSaving] = useState(false);

  const quickRegisterAndNotice = async () => {
    if (!qName.trim()) {
      setError("상품명을 입력해 주세요.");
      return;
    }
    setError("");
    setQSaving(true);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temp_name: qName.trim(),
          temp_image_url: qCover || null,
          temp_image_portrait: qPortrait,
          temp_tagline: qTagline.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "공지 생성에 실패했습니다.");
        return;
      }
      goToNotice(data.id);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setQSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {info && (
        <div className="px-4 py-3 bg-blue-50 border border-blue-200 text-blue-600 text-sm rounded-lg">{info}</div>
      )}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <div className="flex gap-5 items-stretch">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">공지 상품 등록</h2>
            <button
              onClick={quickRegisterAndNotice}
              disabled={qSaving}
              className="px-6 py-2.5 text-sm font-bold bg-[#E5541B] text-white rounded-lg hover:bg-[#e04500] disabled:opacity-50"
            >
              {qSaving ? "등록 중..." : "공지용으로 등록"}
            </button>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col">
            <div className="flex gap-5 items-stretch flex-1 min-h-0">
              <div className="flex-shrink-0">
                <CoverAndDetailImagesField
                  cover={qCover}
                  onCoverChange={setQCover}
                  detailImages={[]}
                  onDetailImagesChange={() => {}}
                  showDetail={false}
                  onError={setError}
                  onInfo={showInfo}
                  coverSize={260}
                  portrait={qPortrait}
                  onPortraitChange={setQPortrait}
                  coverHint=""
                  coverButtonPosition="below"
                />
              </div>
              <div className="flex-1 min-w-[200px] flex flex-col gap-4 min-h-0">
                <div className="flex-shrink-0">
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">상품명</label>
                  <input
                    value={qName}
                    onChange={(e) => setQName(e.target.value)}
                    placeholder="예: 린넨 셔츠 자켓"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#303236]"
                  />
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5 flex-shrink-0">상품설명</label>
                  <DescriptionField value={qTagline} onChange={setQTagline} grow />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex-shrink-0">공지 상품에서 선택</h2>
          <div className="flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex-shrink-0 p-4 border-b border-gray-100">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="상품명 검색"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#303236]"
              />
              <p className="text-[12px] text-gray-400 mt-1.5">지점 출고 패스로 등록했던 상품만 표시됩니다.</p>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "288px" }}>
              {loading ? (
                <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">
                  등록된 상품이 없습니다. &quot;공지 상품 등록&quot;으로 추가해 주세요.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map((p) => (
                    <div key={p.temp_name}>
                      <div className="flex items-center gap-4 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setPreviewEntry(p)}
                          className="flex items-center gap-4 flex-1 min-w-0 text-left"
                        >
                          <div
                            className={`relative flex-shrink-0 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 ${p.temp_image_portrait ? "h-14" : "w-20"}`}
                            style={{ aspectRatio: noticeCoverAspect(p.temp_image_portrait) }}
                          >
                            {p.temp_image_url ? (
                              <Image src={p.temp_image_url} alt={p.temp_name} fill className={p.temp_image_portrait ? "object-contain" : "object-cover"} sizes="80px" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">없음</div>
                            )}
                          </div>
                          <p className="font-semibold text-[14px] text-gray-900 truncate min-w-0">{p.temp_name}</p>
                        </button>
                        <button
                          onClick={() => openNoticeForm(p.temp_name)}
                          className={`flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            expandedName === p.temp_name
                              ? "bg-gray-100 text-gray-600"
                              : "bg-[#303236] text-white hover:bg-[#1f2124]"
                          }`}
                        >
                          {expandedName === p.temp_name ? "접기" : "이 상품으로 공지"}
                        </button>
                      </div>

                      {expandedName === p.temp_name && (
                        <div className="px-4 pb-4 pt-1 bg-gray-50/70 space-y-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                              공지 추가 설명 <span className="font-normal text-gray-400">(선택)</span>
                            </label>
                            <DescriptionField value={extraDesc} onChange={setExtraDesc} />
                          </div>
                          <CoverAndDetailImagesField
                            showCover={false}
                            cover=""
                            onCoverChange={() => {}}
                            detailImages={extraImages}
                            onDetailImagesChange={setExtraImages}
                            detailLabel="추가 사진 (선택)"
                            detailHint="여기 추가한 사진은 이 공지에서 대표 사진 아래에 함께 노출됩니다."
                            onError={setError}
                            onInfo={showInfo}
                          />
                          <button
                            onClick={() => createNoticeFromExisting(p)}
                            disabled={creatingName === p.temp_name}
                            className="px-6 py-2.5 text-sm font-bold bg-[#E5541B] text-white rounded-lg hover:bg-[#e04500] disabled:opacity-50"
                          >
                            {creatingName === p.temp_name ? "등록 중..." : "공지 등록"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {previewEntry && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreviewEntry(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`relative bg-gray-50 ${previewEntry.temp_image_portrait ? "w-3/5 mx-auto" : "w-full"}`}
              style={{ aspectRatio: noticeCoverAspect(previewEntry.temp_image_portrait) }}
            >
              {previewEntry.temp_image_url ? (
                <Image
                  src={previewEntry.temp_image_url}
                  alt={previewEntry.temp_name}
                  fill
                  className={previewEntry.temp_image_portrait ? "object-contain" : "object-cover"}
                  sizes="400px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">이미지 없음</div>
              )}
              <button
                type="button"
                onClick={() => setPreviewEntry(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white text-xl leading-none flex items-center justify-center hover:bg-black/70"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-[16px] text-gray-900 mb-2">{previewEntry.temp_name}</h3>
              {previewEntry.temp_tagline ? (
                <div
                  className="text-[13px] text-gray-600 [&_p]:m-0"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewEntry.temp_tagline) }}
                />
              ) : (
                <p className="text-[13px] text-gray-400">등록된 설명이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
