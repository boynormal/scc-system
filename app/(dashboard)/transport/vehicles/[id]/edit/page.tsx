import { redirect } from "next/navigation"

export default function EditVehicleRedirect() {
  redirect("/transport/master-data?tab=vehicles")
}
