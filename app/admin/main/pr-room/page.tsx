import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admin/main/contents?tab=pr-room");
}
