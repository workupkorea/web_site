"use client";
import { useState } from "react";
import DescriptionField from "./DescriptionField";
import CoverAndDetailImagesField from "./CoverAndDetailImagesField";

// 마감패스 전용(product_id 없음) 공지 수정 — products 테이블과 무관하게 공지(notices)에
// 직접 저장된 이름·썸네일·설명 + 추가 사진을 한 화면에서 고친다.
const PRESET_BADGES = ["재공지", "정보변경", "가격변동"];

export default function TempNoticeEditModal({
  noticeId,
  initialName,
  initialImageUrl,
  initialTagline,
  initialExtraImages,
  initialBadge,
  initialPortrait = false,
  onClose,
  onSaved,
}: {
  noticeId: string;
  initialName: string;
  initialImageUrl: string | null;
  initialTagline: string | null;
  initialExtraImages: string[];
  initialBadge?: string | null;
  initialPortrait?: boolean;
  onClose: () => void;
  onSaved: (data: {
    temp_name: string;
    temp_image_url: string | null;
    temp_tagline: string | null;
    extra_images: string[];
    badge: string | null;
    temp_image_portrait: boolean;
  }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [cover, setCover] = useState(initialImageUrl ?? "");
  const [portrait, setPortrait] = useState(initialPortrait);
  const [tagline, setTagline] = useState(initialTagline ?? "");
  const [extraImages, setExtraImages] = useState<string[]>(initialExtraImages);
  const [badgeValue, setBadgeValue] = useState(initialBadge ?? "");
  const [showCustomBadge, setShowCustomBadge] = useState(
    !!initialBadge && !PRESET_BADGES.includes(initialBadge)
  );
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);

  const showInfo = (text: string) => {
    setInfo(text);
    setTimeout(() => setInfo(""), 4000);
  };

  const save = async () => {
    if (!name.trim()) {
      setError("상품명을 입력해 주세요.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/notices/${noticeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temp_name: name.trim(),
          temp_image_url: cover || null,
          temp_tagline: tagline.trim() || null,
          extra_images: extraImages,
          badge: badgeValue.trim() || null,
          // 컬럼 미적용 DB에서 저장이 깨지지 않도록 값이 바뀌었을 때만 보낸다.
          ...(portrait !== initialPortrait ? { temp_image_portrait: portrait } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      onSaved({
        temp_name: data.temp_name,
        temp_image_url: data.temp_image_url ?? null,
        temp_tagline: data.temp_tagline ?? null,
        extra_images: data.extra_images ?? [],
        badge: data.badge ?? null,
        temp_image_portrait: data.temp_image_portrait ?? portrait,
      });
    } catch {
      setError("네트워크 오류로 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white z-10 rounded-t-2xl">
          <span className="font-bold text-[16px] text-gray-900">공지 수정</span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {info && (
            <div className="px-4 py-3 bg-blue-50 border border-blue-200 text-blue-600 text-sm rounded-lg">{info}</div>
          )}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
          )}

          <CoverAndDetailImagesField
            cover={cover}
            onCoverChange={setCover}
            detailImages={[]}
            onDetailImagesChange={() => {}}
            showDetail={false}
            onError={setError}
            onInfo={showInfo}
            coverSize={220}
            portrait={portrait}
            onPortraitChange={setPortrait}
          />

          {/* 뱃지 */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">뱃지 <span className="font-normal text-gray-400">(선택)</span></label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => { setBadgeValue(""); setShowCustomBadge(false); }}
                className={`px-2.5 py-1 text-[12px] font-semibold rounded-full border transition-colors ${badgeValue === "" && !showCustomBadge ? "bg-gray-200 border-gray-400 text-gray-800" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}
              >없음</button>
              {PRESET_BADGES.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => { setBadgeValue(b); setShowCustomBadge(false); }}
                  className={`px-2.5 py-1 text-[12px] font-semibold rounded-full border transition-colors ${badgeValue === b && !showCustomBadge ? "bg-orange-100 border-orange-400 text-orange-800" : "border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-700"}`}
                >{b}</button>
              ))}
              <button
                type="button"
                onClick={() => { setShowCustomBadge(true); if (PRESET_BADGES.includes(badgeValue)) setBadgeValue(""); }}
                className={`px-2.5 py-1 text-[12px] font-semibold rounded-full border transition-colors ${showCustomBadge ? "bg-orange-100 border-orange-400 text-orange-800" : "border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-700"}`}
              >직접 입력</button>
            </div>
            {showCustomBadge && (
              <input
                value={badgeValue}
                onChange={(e) => setBadgeValue(e.target.value)}
                placeholder="뱃지 내용 입력 (예: 한정수량)"
                maxLength={10}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#303236]"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">상품명</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#303236]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">상품설명</label>
            <DescriptionField value={tagline} onChange={setTagline} />
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

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-bold bg-[#E5541B] text-white rounded-lg hover:bg-[#e04500] disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 rounded-lg hover:border-gray-300"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
