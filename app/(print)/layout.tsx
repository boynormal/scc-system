import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return <div className="min-h-screen bg-slate-100 print:bg-white">{children}</div>
}
