import { redirect } from "next/navigation";

export default function WorkersRedirectPage() {
  redirect("/admin/workers");
}