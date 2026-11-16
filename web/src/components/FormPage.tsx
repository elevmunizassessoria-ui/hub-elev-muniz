import { useEffect, useId, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Um cadastro no padrão do Prezyn: janela no meio da tela, na altura do que tem dentro, com a tela atrás
 * um pouco mais escura. Cabeçalho branco de 52 px, as seções em cartões brancos sobre o cinza, Cancelar e o
 * botão principal no rodapé branco. Esc fecha.
 */
export function FormPage({
  title,
  status,
  onBack,
  onSubmit,
  busy,
  submitLabel = "Salvar",
  submitDisabled,
  footerNote,
  secondary,
  largura = 800,
  children,
}: {
  title: ReactNode;
  status?: ReactNode;
  onBack: () => void;
  onSubmit?: () => void;
  busy?: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
  footerNote?: ReactNode;
  secondary?: ReactNode;
  largura?: 576 | 800 | 1152;
  children: ReactNode;
}) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || busy) return;
      if (document.querySelector("[role=alertdialog],[role=menu],[role=listbox]")) return;
      onBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack, busy]);
  return createPortal(
    <>
      <div aria-hidden onClick={() => !busy && onBack()} className="fixed inset-0 z-40 bg-black/30 duration-200 animate-in fade-in motion-reduce:animate-none" />
      <form
        aria-labelledby={`${id}-titulo`}
        noValidate
        style={{ width: `min(${largura}px, calc(100vw - 32px))` }}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!busy) onSubmit?.();
        }}
        className="fixed top-1/2 left-1/2 z-40 flex max-h-[calc(100dvh-48px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[12px] bg-background shadow-[0_24px_48px_-12px_rgb(0_0_0/0.32)] duration-200 animate-in fade-in zoom-in-[0.97] motion-reduce:animate-none"
      >
        <header className="flex h-[52px] shrink-0 items-center gap-3 border-b bg-card pr-3 pl-5">
          <h2 id={`${id}-titulo`} className="min-w-0 flex-1 truncate text-[15px] font-semibold">
            {title}
          </h2>
          {status && <div className="flex min-w-0 items-center text-[13px] text-muted-foreground">{status}</div>}
          <button
            type="button"
            aria-label="Fechar"
            title="Fechar (Esc)"
            disabled={busy}
            onClick={onBack}
            className="grid size-[34px] shrink-0 place-items-center rounded-full outline-none hover:bg-foreground/[0.07] focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">{children}</div>
        {onSubmit && (
          <div className="flex shrink-0 items-center gap-2 border-t bg-card px-5 py-3">
            {secondary && <div className="flex items-center gap-1">{secondary}</div>}
            {footerNote && <span className="min-w-0 text-[13px] text-muted-foreground">{footerNote}</span>}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={onBack}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || submitDisabled}>
                {busy && <Spinner data-icon="inline-start" />}
                {submitLabel}
              </Button>
            </div>
          </div>
        )}
      </form>
    </>,
    document.body,
  );
}

const COLUMNS = {
  1: "",
  2: "@min-[28rem]:grid-cols-2",
  3: "@min-[28rem]:grid-cols-2 @min-[40rem]:grid-cols-3",
  4: "@min-[28rem]:grid-cols-2 @min-[40rem]:grid-cols-4",
} as const;
const SPAN = {
  1: "",
  2: "@min-[28rem]:col-span-2",
  3: "@min-[28rem]:col-span-2 @min-[40rem]:col-span-3",
  4: "@min-[28rem]:col-span-2 @min-[40rem]:col-span-4",
  full: "col-span-full",
} as const;

/** Uma seção, como no Prezyn: um cartão branco sobre o cinza, com o nome em cima e os campos embaixo. */
export function FormSection({
  title,
  action,
  columns = 2,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  action?: ReactNode;
  columns?: keyof typeof COLUMNS;
  children?: ReactNode;
  className?: string;
  /** Corpo livre (sem a grade), para listas dentro da seção. */
  bodyClassName?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("mx-4 mt-4 min-w-0 overflow-hidden rounded-[10px] bg-card", className)}>
      <div className="flex min-h-10 min-w-0 items-center gap-2 border-b px-4 py-1.5">
        <h3 id={id} className="min-w-0 flex-1 text-[13px] leading-5 font-semibold">
          {title}
        </h3>
        {action}
      </div>
      {bodyClassName !== undefined ? (
        <div className={cn("min-w-0 p-4", bodyClassName)}>{children}</div>
      ) : (
        <div className="@container min-w-0 p-4">
          <div className={cn("grid grid-cols-1 gap-x-3 gap-y-3", COLUMNS[columns])}>{children}</div>
        </div>
      )}
    </section>
  );
}

export const FORM_LABEL = "text-xs leading-4 font-medium text-foreground/70";

export function FormField({
  label,
  htmlFor,
  required,
  error,
  help,
  span = 1,
  className,
  children,
}: {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: ReactNode;
  help?: ReactNode;
  span?: keyof typeof SPAN;
  className?: string;
  children: ReactNode;
}) {
  const name = label != null && (
    <>
      {label}
      {required && (
        <span className="ml-0.5 text-destructive" aria-hidden>
          *
        </span>
      )}
    </>
  );
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", SPAN[span], className)}>
      {name &&
        (htmlFor ? (
          <label htmlFor={htmlFor} className={FORM_LABEL}>
            {name}
          </label>
        ) : (
          <span className={FORM_LABEL}>{name}</span>
        ))}
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}

/** Sim/Não no seletor do padrão: trilho cinza, o escolhido branco e levantado, texto na cor de destaque. */
export function YesNo({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid h-[34px] w-full max-w-48 grid-cols-2 gap-0.5 rounded-[4px] bg-foreground/[0.06] p-0.5">
      {[true, false].map((option) => {
        const on = value === option;
        return (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-[3px] text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
              on ? "bg-card font-medium text-primary-ink shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.1)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option ? "Sim" : "Não"}
          </button>
        );
      })}
    </div>
  );
}

/** Caixinha de marcar. */
export function Marcar({
  checked,
  onChange,
  disabled,
  children,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex min-w-0 items-center gap-2 rounded-sm text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
          checked ? "border-primary bg-primary" : "border-muted-foreground/50 bg-card group-hover:border-primary",
        )}
      >
        {checked && <CheckIcon className="size-3 text-primary-foreground" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}
