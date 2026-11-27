"use client";

import { useState, useTransition } from "react";
import { clearPromotionTestData, setPromotionTestMode } from "./actions";

/** 직원 테스트 모드: 켜면 테스트 데이터를 넣고 화면이 테스트 영역으로 바뀐다. */
export default function TestControls({ id, link, className }: { id: string; link: string; className: string }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function run(task: () => Promise<string>, done: string) {
    start(async () => setMessage((await task()) || done));
  }
  async function copy() {
    const url = window.location.origin + link;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했어요.");
    } catch {
      window.prompt("아래 테스트 링크를 복사해 주세요.", url);
    }
  }

  return (
    <>
      <label className={className + " cursor-pointer gap-2"}>
        <input type="checkbox" checked={Boolean(link)} disabled={pending} className="size-4 accent-blue-700"
          onChange={(event) => {
            const on = event.target.checked;
            setMessage(on ? "테스트 데이터를 준비하는 중이에요." : "");
            run(() => setPromotionTestMode(id, on), on ? "테스트 모드를 켰어요." : "테스트 모드를 껐어요. 이전 링크는 만료됩니다.");
          }} />
        테스트 모드
      </label>
      {link && <button type="button" className={className} onClick={copy}>링크 복사</button>}
      {link && (
        <button type="button" disabled={pending} className={className}
          onClick={() => {
            if (!window.confirm("테스트 응모·영수증·당첨·제외번호를 모두 삭제할까요?\n되돌릴 수 없습니다. 실제 데이터는 그대로입니다.")) return;
            // 검수 화면은 스크립트가 직접 그리므로 삭제 뒤 새로 불러온다.
            start(async () => {
              const error = await clearPromotionTestData(id);
              if (error) setMessage(error);
              else window.location.reload();
            });
          }}>삭제</button>
      )}
      {message && <span role="status" className="self-center pl-2 text-sm text-slate-600">{message}</span>}
    </>
  );
}
