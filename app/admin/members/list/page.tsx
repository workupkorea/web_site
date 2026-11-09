import { redirect } from "next/navigation";

// 통합 페이지(/admin/members)로 이동
export default function Page() {
  redirect("/admin/members?tab=list");
}
