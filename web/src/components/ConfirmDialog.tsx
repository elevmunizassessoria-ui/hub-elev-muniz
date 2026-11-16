import { XIcon } from "lucide-react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isDesktop } from "@/lib/platform";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {/* The phone's X (the Conecta's dialog, 28 px at the top right): it cancels, as Cancelar does. Before
            the footer, so Cancelar keeps the first focus. The browser only: the desktop app never has it. */}
        {!isDesktop && (
          <AlertDialogPrimitive.Cancel
            aria-label="Fechar"
            className="absolute top-4 right-4 z-20 inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-primary/30 sm:hidden"
          >
            <XIcon className="size-4" strokeWidth={2.5} />
          </AlertDialogPrimitive.Cancel>
        )}
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {/* Paths and links are shown whole: a long one wraps instead of overflowing. The phone's
              message sits 4 px in (the Conecta's ModalConfirmacao). */}
          <AlertDialogDescription className="wrap-anywhere max-lg:px-1">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {/* The phone's buttons stacked at the Conecta's 36 px (the action on top: the soft red one when it deletes). */}
        <AlertDialogFooter className="max-sm:[&>*]:h-9 max-sm:[&>*]:text-sm">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
