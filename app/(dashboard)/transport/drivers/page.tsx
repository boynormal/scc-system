import { redirect } from "next/navigation"

export default function TransportDriversRedirect() {
  redirect("/transport/master-data?tab=drivers")
}
