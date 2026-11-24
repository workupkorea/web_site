"use client";

import { useEffect, useRef, useState } from "react";
import { loadDaumPostcodeScript } from "@/components/ih/influencers/IHAddressSearchField";

const fieldClass = "min-h-11 min-w-0 w-full rounded-lg border border-[#bcc2b9] bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#384436]";
const buttonClass = "inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[#bcc2b9] px-3 py-2 text-sm font-bold hover:bg-[#eef2eb]";

export default function MateAddressField() {
  const [address, setAddress] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const searchButton = useRef<HTMLButtonElement>(null);
  const widget = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showSearch || !widget.current) return;
    const target = widget.current;
    let active = true;

    async function embedSearch() {
      try {
        await loadDaumPostcodeScript();
        if (!active) return;
        if (!window.daum?.Postcode) throw new Error("Address search is unavailable");
        new window.daum.Postcode({
          width: "100%",
          height: "100%",
          oncomplete: ({ address: selectedAddress }) => {
            if (!active) return;
            setAddress(selectedAddress);
            if (detail.current) detail.current.value = "";
            setSearchError(false);
            setShowSearch(false);
            detail.current?.focus();
          },
        }).embed(target);
      } catch {
        if (!active) return;
        setSearchError(true);
        setShowSearch(false);
      }
    }

    void embedSearch();
    return () => {
      active = false;
      target.replaceChildren();
    };
  }, [showSearch]);

  function closeSearch() {
    setShowSearch(false);
    searchButton.current?.focus();
  }

  return (
    <div className="space-y-2">
      <label htmlFor="mate-address" className="block font-bold">주소</label>
      <div className="flex gap-2">
        <input id="mate-address" name="address" value={address} onChange={(event) => setAddress(event.target.value)}
          className={fieldClass + " read-only:bg-[#f7f9f5]"} readOnly={!searchError}
          placeholder={searchError ? "도로명 주소를 입력해 주세요" : "주소 검색으로 선택해 주세요"}
          autoComplete="address-line1" maxLength={180} required />
        <button type="button" ref={searchButton} className={buttonClass} onClick={() => {
          if (showSearch) closeSearch();
          else setShowSearch(true);
        }} aria-expanded={showSearch} aria-controls="mate-address-search">주소 검색</button>
      </div>
      <div id="mate-address-search" hidden={!showSearch} className="rounded-lg border border-[#d6dbd3]">
        {showSearch && (
          <>
            <div className="flex justify-end px-2">
              <button type="button" className="min-h-11 px-2 text-sm font-semibold underline" onClick={closeSearch}>주소 검색 닫기</button>
            </div>
            <div ref={widget} className="h-[26rem] w-full" />
          </>
        )}
      </div>
      {searchError && <p role="status" className="text-sm text-stone-700">주소 검색을 열 수 없습니다. 주소를 직접 입력해 주세요.</p>}
      <label htmlFor="mate-address-detail" className="block text-sm font-medium">상세주소 <span className="font-normal text-stone-600">(선택)</span></label>
      <input id="mate-address-detail" name="address_detail" ref={detail} className={fieldClass}
        autoComplete="address-line2" placeholder="동·호수 등 (해당하는 경우)" maxLength={58} />
    </div>
  );
}
