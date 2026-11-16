import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Um cartão branco da página (14 px), com o título em cima. Nas telas; os painéis usam `FormSection`. */
export function Bloco({ title, className, children }: { title: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[14px] bg-card">
      <h2 className="border-b px-4 py-2.5 text-[11px] leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">{title}</h2>
      <div className={cn(className)}>{children}</div>
    </section>
  );
}
