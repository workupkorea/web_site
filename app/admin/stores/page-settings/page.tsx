import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admin/stores?tab=page-settings");
}
