"use client"

import { useMemo, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { z } from "zod"
import { Loader2, Lock, User } from "lucide-react"
import { CompanyBrandMark } from "@/components/brand/company-brand-mark"
import { APP_BRAND } from "@/shared/branding"

type LoginFormValues = {
  identifier: string
  password: string
}

type Props = {
  logoUrl?: string | null
}

export function LoginForm({ logoUrl }: Props) {
  const t = useTranslations("auth")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const loginSchema = useMemo(
    () =>
      z.object({
        identifier: z.string().trim().min(1, t("identifierRequired")),
        password: z.string().min(6, t("passwordMin")),
      }),
    [t]
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormValues) => {
    setError(null)
    const result = await signIn("credentials", {
      identifier: data.identifier.trim(),
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setError(t("invalidCredentials"))
    } else {
      router.push("/")
      router.refresh()
    }
  }

  return (
    <div className="w-full max-w-md px-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-lg">
        <div className="mb-8 flex flex-col items-center">
          <CompanyBrandMark logoUrl={logoUrl} size="lg" alt={APP_BRAND.name} className="mb-4 shadow-lg" />
          <h1 className="text-2xl font-bold text-white">{APP_BRAND.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{APP_BRAND.tagline}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              {t("identifierLabel")}
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                {...register("identifier")}
                type="text"
                autoComplete="username"
                placeholder={t("identifierPlaceholder")}
                className="w-full rounded-lg border border-white/20 bg-white/10 py-2.5 pl-10 pr-4 text-white placeholder-slate-500 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {errors.identifier && (
              <p className="mt-1 text-xs text-red-400">{errors.identifier.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              {t("passwordLabel")}
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                {...register("password")}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/20 bg-white/10 py-2.5 pl-10 pr-4 text-white placeholder-slate-500 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? t("signingIn") : t("signIn")}
          </button>
        </form>
      </div>
    </div>
  )
}
