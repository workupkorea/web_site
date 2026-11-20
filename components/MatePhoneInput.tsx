"use client";
import { useState } from "react";
import { formatMatePhone } from "@/lib/mate";

export default function MatePhoneInput({ className, initial = "" }: { className: string; initial?: string }) {
  const [value, setValue] = useState(formatMatePhone(initial));
  return <input type="tel" name="phone" value={value} onChange={(event) => setValue(formatMatePhone(event.target.value))}
    className={className} autoComplete="tel" inputMode="tel" maxLength={24} required />;
}