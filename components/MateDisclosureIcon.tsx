export default function MateDisclosureIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor"
      className={open ? "size-4 shrink-0 rotate-90" : "size-4 shrink-0"}>
      <path d="M4 2.25a.5.5 0 0 1 .76-.43l9 5.75a.5.5 0 0 1 0 .86l-9 5.75a.5.5 0 0 1-.76-.43z" />
    </svg>
  );
}