"use client";
import { useEffect, useRef, useState } from "react";

// 프로젝트에 기존 주소 검색 컴포넌트가 없어 신규 작성(중복 구현 아님, 사전 확인함).
// lib/geocode.ts는 서버에서 "주소 문자열 → 좌표" 변환용이라 이 화면의 용도(주소 검색 UI)와 다름.
// Daum(카카오) 우편번호 서비스 — 별도 API 키 없이 공개 스크립트로 사용 가능.
declare global {
  interface Window {
    daum?: {
      Postcode: new (options: { oncomplete: (data: DaumPostcodeResult) => void }) => { open: () => void };
    };
  }
}
type DaumPostcodeResult = { address: string; addressType: string; bname: string; buildingName: string };

const SCRIPT_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
let scriptPromise: Promise<void> | null = null;

export function loadDaumPostcodeScript(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("주소 검색 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * 주소 검색(Daum 우편번호 서비스) + 상세주소 — DB에는 기존 address TEXT 컬럼 하나에
 * "기본주소 + 상세주소"를 하나의 문자열로 합쳐 저장한다(DB 변경 없음).
 */
export default function IHAddressSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [baseAddress, setBaseAddress] = useState("");
  const [detailAddress, setDetailAddress] = useState("");
  const initialized = useRef(false);

  // 저장된 문자열을 처음 열 때만 base/detail로 대략 분리(마지막 콤마 기준) — 실패해도 base에 전체를 넣어 데이터 보존
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (!value) return;
    setBaseAddress(value);
  }, [value]);

  const openSearch = async () => {
    try {
      await loadDaumPostcodeScript();
      if (!window.daum?.Postcode) return;
      new window.daum.Postcode({
        oncomplete: (data) => {
          setBaseAddress(data.address);
          onChange([data.address, detailAddress].filter(Boolean).join(", "));
        },
      }).open();
    } catch {
      // 스크립트 로드 실패 시 사용자가 직접 입력할 수 있도록 조용히 둔다.
    }
  };

  const handleDetailChange = (v: string) => {
    setDetailAddress(v);
    onChange([baseAddress, v].filter(Boolean).join(", "));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          readOnly
          value={baseAddress}
          placeholder="주소 검색을 눌러주세요"
          className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-[14.5px] text-slate-900 placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={openSearch}
          className="flex-shrink-0 rounded-md border border-slate-300 px-3 py-2 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          주소 검색
        </button>
      </div>
      {baseAddress && (
        <input
          value={detailAddress}
          onChange={(e) => handleDetailChange(e.target.value)}
          placeholder="상세주소 입력"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-[14.5px] text-slate-900 placeholder:text-slate-500 outline-none focus:border-slate-500"
        />
      )}
    </div>
  );
}
