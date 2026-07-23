import { redirect } from "next/navigation"

export default function EditDriverRedirect() {
  redirect("/transport/master-data?tab=drivers")
}
