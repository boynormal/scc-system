import { getDefaultCompanyBrand } from "@/shared/branding/company-brand"
import { LoginForm } from "./login-form"

export default async function LoginPage() {
  const brand = await getDefaultCompanyBrand()

  return <LoginForm logoUrl={brand?.logoUrl} />
}
