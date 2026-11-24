"use client";

export default function MateHeightInput({ className }: { className: string }) {
  return <input type="text" name="height_cm" className={className} inputMode="numeric" placeholder="예: 175"
    maxLength={3} pattern="[5-9][0-9]|1[0-9]{2}|2[0-5][0-9]|260" title="50~260 사이의 숫자를 입력해 주세요."
    onInput={({ currentTarget }) => { currentTarget.value = currentTarget.value.replace(/[^0-9]/g, ""); }} required />;
}
