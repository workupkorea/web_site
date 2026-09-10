"use client";
import { usePathname } from "next/navigation";
import AdminShell from "./AdminShell";

export default function AdminShellGate({ children, superAdmin }: { children: React.ReactNode; superAdmin?: boolean }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/influencer-hub")) {
    return <>{children}</>;
  }
  return <AdminShell superAdmin={superAdmin}>{children}</AdminShell>;
}
