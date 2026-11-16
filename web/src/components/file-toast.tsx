import type { ReactNode } from "react";
import { CircleCheckIcon, CircleXIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { FileTile } from "@/components/FileTile";
import { tamanho as fileSize } from "@/lib/formato";

/** The word at a notice's right: its symbol and what happened ("Concluído · 8 KB"). */
export function ToastStatus({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="toast-status">
      {icon}
      {children}
    </span>
  );
}

const statusOf = {
  doing: (word: string) => <ToastStatus icon={<Loader2Icon className="animate-spin" />}>{word}</ToastStatus>,
  done: (size?: number) => <ToastStatus icon={<CircleCheckIcon />}>{size === undefined ? "Concluído" : `Concluído · ${fileSize(size)}`}</ToastStatus>,
  failed: <ToastStatus icon={<CircleXIcon />}>Erro</ToastStatus>,
};

const face = (name: string, status: ReactNode) => (
  <>
    <FileTile name={name} />
    {status}
  </>
);

const failureText = (error: unknown) => (typeof error === "string" ? error : error instanceof Error ? error.message : "Tente de novo.");

/** A file that already went through ("Baixou"): the owner's model, its kind, its name, "Concluído · 8 KB". */
export function fileDone(name: string, options: { size?: number; description?: string } = {}) {
  toast.success(name, { icon: face(name, statusOf.done(options.size)), description: options.description });
}

/**
 * A file on its way: "Enviando…" with the bar running, then "Concluído · 8 KB" or the error, on the same notice.
 * Returns what `work` returned; throws what it threw (the notice has already told).
 */
export async function trackFile<T>(name: string, work: Promise<T>, options: { doing: string; size?: number; failure: string }): Promise<T> {
  // A plain notice marked as running: sonner's "loading" kind draws no icon of ours.
  const id = toast(name, { icon: face(name, statusOf.doing(options.doing)), className: "toast-running", duration: Infinity, dismissible: false });
  try {
    const result = await work;
    toast.success(name, { id, icon: face(name, statusOf.done(options.size)), className: "", duration: 5000, dismissible: true });
    return result;
  } catch (error) {
    toast.error(name, { id, icon: face(name, statusOf.failed), className: "", description: `${options.failure}: ${failureText(error)}`, duration: 8000, dismissible: true });
    throw error;
  }
}
