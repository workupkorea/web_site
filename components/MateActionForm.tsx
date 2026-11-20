"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import type { MateActionState } from "@/lib/mate";

type Props = {
  action: (state: MateActionState, form: FormData) => Promise<MateActionState>;
  className?: string;
  children: ReactNode;
  buttonClassName: string;
  submitLabel: string;
  successContent?: ReactNode;
  submitLeading?: ReactNode;
  submitTitle?: ReactNode;
  preview?: boolean;
};

export default function MateActionForm({ action, children, className, buttonClassName, submitLabel, successContent, submitLeading, submitTitle, preview = false }: Props) {
  const [state, dispatch, pending] = useActionState(action, {});
  if (state.success && successContent) {
    return <div role="status" className={className}><strong>{state.success}</strong>{successContent}</div>;
  }

  const submit = <button type="submit" disabled={pending || preview} className={buttonClassName}>
    {pending ? "처리 중…" : submitLabel}
  </button>;

  const controls = submitLeading ? <div className="flex flex-wrap items-center justify-end gap-3">{submitLeading}{submit}</div> : submit;

  return (
    <form className={className} action={dispatch} onSubmit={(event) => {
      event.preventDefault();
      if (preview) return;
      const data = new FormData(event.currentTarget);
      startTransition(() => dispatch(data));
    }}>
      {submitTitle && <div className="flex flex-wrap items-center justify-between gap-2">{submitTitle}{controls}</div>}
      {preview ? <fieldset disabled className="contents">{children}</fieldset> : children}
      {!submitTitle && controls}
      {state.error && <p role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
      {state.success && <p role="status" className="text-sm font-medium text-green-800">{state.success}</p>}
    </form>
  );
}