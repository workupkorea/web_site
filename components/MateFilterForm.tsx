"use client";

import Form from "next/form";
import type { ReactNode } from "react";

/** 선택값이 바뀌면 버튼 없이 바로 조회한다. */
export default function MateFilterForm({ children }: { children: ReactNode }) {
  return <Form action="/admin/mate" scroll={false} className="flex flex-wrap items-center gap-1.5"
    onChange={(event) => event.currentTarget.requestSubmit()}>{children}</Form>;
}
