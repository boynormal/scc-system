import { redirect } from "next/navigation"

export default function NewVehicleRedirect() {
  redirect("/transport/master-data?tab=vehicles")
}
