import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * No Padrão visual app todo formulário é um painel que entra pela direita, abaixo da
 * barra do título; só a tela atrás escurece de leve, sem embaçar. A largura vem de `largura`.
 */
function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-x-0 top-14 bottom-0 isolate z-50 bg-black/10", className)}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  largura = 576,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { largura?: 576 | 800 | 1152 }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        style={{ width: largura }}
        className={cn(
          "painel-lateral fixed top-14 right-0 bottom-0 z-50 flex max-w-full flex-col overflow-y-auto bg-background text-sm text-popover-foreground shadow-[-8px_0_32px_-12px_rgb(0_0_0/0.25)] outline-none",
          "duration-200 data-open:animate-in data-open:slide-in-from-right-8 motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          data-slot="dialog-close"
          aria-label="Fechar"
          className="absolute top-[9px] right-3 z-10 grid size-[34px] place-items-center rounded-full text-foreground outline-none hover:bg-foreground/[0.07] focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("sticky top-0 z-[5] flex min-h-[52px] shrink-0 flex-col justify-center gap-0.5 border-b bg-card py-2 pr-14 pl-5", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("sticky bottom-0 z-[5] mt-auto flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-card px-5 py-3", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-[15px] leading-5 font-semibold", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-xs text-muted-foreground", className)} {...props} />
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
