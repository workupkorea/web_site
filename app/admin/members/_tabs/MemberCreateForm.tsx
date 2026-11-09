"use client";
import { useState } from "react";
import PasswordInput from "@/components/PasswordInput";

const GRADES = ["일반회원", "VIP", "VVIP", "도매회원", "거래처", "관리자"] as const;

export default function MemberCreateForm({ onCreated, onCancel }: { onCreated?: () => void; onCancel?: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "",
    grade: "일반회원", memo: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const flash = (text: string, type = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      flash("이름, 이메일, 비밀번호는 필수입니다.", "err"); return;
    }
    if (form.password.length < 8) {
      flash("비밀번호는 8자 이상이어야 합니다.", "err"); return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setForm({ name: "", email: "", password: "", phone: "", grade: "일반회원", memo: "" });
      flash("회원이 등록됐습니다.");
      onCreated?.();
    } else {
      const err = await res.json().catch(() => ({}));
      flash(err.error ?? "등록 실패", "err");
    }
  };

  return (
    <div>
      {msg.text && (
        <div className={`mb-5 px-4 py-3 text-sm rounded-lg font-medium ${
          msg.type === "err"
            ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-green-50 border border-green-200 text-green-700"
        }`}>{msg.text}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">이름 <span className="text-red-500">*</span></label>
            <input
              type="text" value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="홍길동"
              className="w-full border border-gray-200 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">전화번호</label>
            <input
              type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
              placeholder="010-0000-0000"
              className="w-full border border-gray-200 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일 <span className="text-red-500">*</span></label>
          <input
            type="email" value={form.email} onChange={e => set("email", e.target.value)}
            placeholder="example@email.com"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 <span className="text-red-500">*</span></label>
          <PasswordInput
            value={form.password} onChange={e => set("password", e.target.value)}
            placeholder="8자 이상"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">회원 등급</label>
          <select
            value={form.grade} onChange={e => set("grade", e.target.value)}
            className="w-full border border-gray-200 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-blue-400 bg-white"
          >
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">메모 <span className="text-gray-400 font-normal">(관리자용)</span></label>
          <textarea
            value={form.memo} onChange={e => set("memo", e.target.value)}
            rows={3} placeholder="내부 메모 (선택)"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>

        <div className="pt-2 flex gap-3">
          <button
            type="submit" disabled={saving}
            className="flex-1 py-3 bg-[#303236] text-white text-sm font-semibold rounded-lg hover:bg-[#243d5e] disabled:opacity-50 transition-colors"
          >
            {saving ? "등록 중..." : "회원 등록"}
          </button>
          <button
            type="button"
            onClick={() => setForm({ name: "", email: "", password: "", phone: "", grade: "일반회원", memo: "" })}
            className="px-6 py-3 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            초기화
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="px-6 py-3 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              닫기
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
