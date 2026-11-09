import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admin/main/home?tab=new-arrivals");
}
