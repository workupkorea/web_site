import type { ReactNode } from "react";
import Link from "next/link";

type SectionLink = { label: string; href: string; active: boolean };

export const ADMIN_SECTION_NAV_IN_CONTENT = "-mx-3 -mt-3 mb-3 sm:-mx-5 lg:-mx-6";

export default function AdminSectionNav({
  label = "페이지 메뉴", links, actions, className = "", replace = false,
}: {
  label?: string;
  links: readonly SectionLink[];
  actions?: ReactNode;
  className?: string;
  replace?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 border-b border-[var(--admin-line)] bg-white px-3 sm:px-5 lg:px-6 ${className}`}>
      <nav aria-label={label} className="flex min-w-0 flex-wrap">
        {links.map(({ label, href, active }) => (
          <Link
            key={href}
            href={href}
            replace={replace}
            scroll={replace ? false : undefined}
            aria-current={active ? "page" : undefined}
            className="inline-flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-semibold text-slate-600 hover:text-[var(--admin-accent)] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--admin-accent)] aria-[current=page]:border-[var(--admin-accent)] aria-[current=page]:text-[var(--admin-accent)] sm:min-h-9"
          >
            {label}
          </Link>
        ))}
      </nav>
      {actions && <div className="py-1">{actions}</div>}
    </div>
  );
}
