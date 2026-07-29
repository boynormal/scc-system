import { cn } from "@/lib/utils"

export type GlassIntensity = "soft" | "default" | "strong"

const intensityStyles: Record<GlassIntensity, string> = {
  soft: "bg-glass-soft",
  default: "bg-glass",
  strong: "bg-glass-strong",
}

type GlassSurfaceOwnProps = {
  intensity?: GlassIntensity
  className?: string
  children?: React.ReactNode
}

export type GlassSurfaceProps<T extends React.ElementType = "div"> = GlassSurfaceOwnProps &
  Omit<React.ComponentPropsWithoutRef<T>, keyof GlassSurfaceOwnProps> & {
    as?: T
  }

export function GlassSurface<T extends React.ElementType = "div">({
  as,
  intensity = "default",
  className,
  children,
  ...props
}: GlassSurfaceProps<T>) {
  const Comp = as ?? "div"
  return (
    <Comp
      className={cn(
        "border border-glass shadow-glass backdrop-blur-glass",
        intensityStyles[intensity],
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  )
}
