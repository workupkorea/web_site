"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";

function LoginContent() {
  const [form, setForm]     = useState({ email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password) {
      setError("이메일과 비밀번호를 입력해주세요."); return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/member/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const isAdmin = ["관리자", "S관리자"].includes(data?.member?.grade);
        // 관리자는 대시보드로, 그 외에는 원래 흐름(찜/마이페이지)으로.
        const dest = isAdmin ? "/admin" : from === "cart" ? "/cart" : "/mypage";
        router.push(dest);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "로그인에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">

        {/* 로고 */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image
              src="/images/logo_black.png"
              alt="WORKUP"
              width={140}
              height={20}
              className="h-5 w-auto mx-auto"
              priority
            />
          </Link>
        </div>

        {/* 찜 목록 접근 시 안내 */}
        {from === "cart" && (
          <div className="mb-5 px-4 py-3 bg-[#303236]/5 border border-[#303236]/20 text-[#303236] text-sm rounded-lg flex items-start gap-2.5">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>찜 목록은 로그인 후 이용 가능</span>
          </div>
        )}

        {error && (
          <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-gray-600 mb-1.5">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              id="login-email"
              type="email" value={form.email} onChange={e => set("email", e.target.value)}
              placeholder="example@email.com"
              inputMode="email" autoComplete="email" autoCapitalize="none"
              className="w-full border border-gray-200 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-[#303236] focus:ring-2 focus:ring-[#303236]/10 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-gray-600 mb-1.5">
              비밀번호 <span className="text-red-500">*</span>
            </label>
            <PasswordInput
              id="login-password"
              value={form.password} onChange={e => set("password", e.target.value)}
              placeholder="비밀번호 입력"
              autoComplete="current-password"
              className="w-full border border-gray-200 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-[#303236] focus:ring-2 focus:ring-[#303236]/10 transition-colors"
            />
          </div>

          <button
            type="submit" disabled={saving}
            className="w-full py-3.5 bg-[#303236] text-white text-sm font-semibold rounded-lg hover:bg-[#243d5e] disabled:opacity-50 transition-colors mt-2"
          >
            {saving ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-400 flex items-center justify-center gap-3">
            <Link href="/member/find-id" className="text-[#303236] font-semibold hover:underline">
              아이디 찾기
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/member/find-password" className="text-[#303236] font-semibold hover:underline">
              비밀번호 찾기
            </Link>
          </p>
          <p className="text-sm text-gray-400">
            아직 회원이 아니신가요?{" "}
            <Link href="/register" className="text-[#303236] font-semibold hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MemberLoginPage() {
  return <LoginContent />;
}
