import { redirect } from "next/navigation";

// 통합 페이지(/admin/system)로 이동
export default function Page() {
  redirect("/admin/system?tab=db-status");
}
