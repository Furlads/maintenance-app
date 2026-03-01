import { redirect } from "next/navigation";

export default function AdminWorkerIndexRedirect() {
  redirect("/admin/workers");
}