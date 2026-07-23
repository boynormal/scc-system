import { redirect } from "next/navigation"

export default function NewDriverRedirect() {
  redirect("/transport/master-data?tab=drivers")
}
