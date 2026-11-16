import type { ReactNode } from "react";
import { InboxIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Nothing to show (the Conecta's `EstadoVazio`): the icon grey in a rounded
 * square, a short fact (14 px) and, when it helps, a line (12 px) and the
 * action that fills it (an outline `h-9` button). On a list page put it in a
 * card: `<div className="rounded-xl border bg-card"><EstadoVazio … /></div>`.
 *
 *   <EstadoVazio icon={<ListTodoIcon />} title="Nenhuma tarefa ainda"
 *     action={<Button variant="outline" className="h-9">Nova tarefa</Button>} />
 *
 * The copy is a fact plus an action, never a tutorial ("Faça o primeiro…").
 */
export function EstadoVazio({
  icon = <InboxIcon />,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  /** A lucide icon element (24 px). */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Inside a card, a table or a dialog: less height. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 text-center", compact ? "py-8" : "py-16", className)}>
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground [&>svg]:size-6" aria-hidden>
        {icon}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
