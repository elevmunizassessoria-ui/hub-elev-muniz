import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleAlertIcon, CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

import { useIsDark } from "@/app/theme"
import { FileTile } from "@/components/FileTile"
import { ToastStatus } from "@/components/file-toast"

const Toaster = ({ ...props }: ToasterProps) => {
  const isDark = useIsDark()

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

/**
 * The notices of the PC and the wide browser (the owner's model of 2026-11-04): always at the top right, under the
 * title bar and its window buttons. A white card: a sheet of paper at the left, the sentence, what happened at
 * the right ("✓ Concluído") and a bar under them in that colour. The look in index.css (`.pc-toaster`).
 */
const PcToaster = () => {
  const isDark = useIsDark()
  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      className="pc-toaster"
      position="top-right"
      offset={{ top: 64, right: 16 }}
      style={{ "--width": "400px" } as React.CSSProperties}
      closeButton
      icons={{
        success: (
          <>
            <FileTile band="bg-[var(--toast-tone)]" />
            <ToastStatus icon={<CircleCheckIcon />}>Concluído</ToastStatus>
          </>
        ),
        error: (
          <>
            <FileTile band="bg-[var(--toast-tone)]" />
            <ToastStatus icon={<CircleXIcon />}>Erro</ToastStatus>
          </>
        ),
        warning: (
          <>
            <FileTile band="bg-[var(--toast-tone)]" />
            <ToastStatus icon={<TriangleAlertIcon />}>Atenção</ToastStatus>
          </>
        ),
        info: (
          <>
            <FileTile band="bg-[var(--toast-tone)]" />
            <ToastStatus icon={<CircleAlertIcon />}>Aviso</ToastStatus>
          </>
        ),
      }}
    />
  )
}

export { PcToaster, Toaster }
