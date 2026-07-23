import { redirect } from "next/navigation"

export default function TransportVehiclesRedirect() {
  redirect("/transport/master-data?tab=vehicles")
}
