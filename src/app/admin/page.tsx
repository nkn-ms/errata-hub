import { redirect } from "next/navigation";
import { routes } from "@/constants/routes";

export default function AdminPage() {
  redirect(routes.admin.feedbacks);
}
