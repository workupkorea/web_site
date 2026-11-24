"use client";
import { useState } from "react";
import { formatMatePhone, normalizeMatePhone } from "@/lib/mate";

export default function MatePhoneInput({ className, initial = "", placeholder }: { className: string; initial?: string; placeholder?: string }) {
  const [value, setValue] = useState(formatMatePhone(initial));
  return <input type="tel" name="phone" value={value}
    onChange={(event) => setValue(formatMatePhone(normalizeMatePhone(event.target.value).replace(/[^0-9]/g, "").slice(0, 15)))}
    className={className} autoComplete="tel" inputMode="numeric" placeholder={placeholder} maxLength={24} required />;
}
