import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { statTone } from "@/components/stat-tone";
import { cn } from "@/lib/utils";

export interface StatItem {
  id: string;
  /** The situation's name (grey): "A pagar", "Vencidas". */
  label: string;
  /** How many (bold): a count, never money; undefined while loading: "—". */
  value: number | undefined;
  /** A short grey line after the number, after " · ". */
  detail?: ReactNode;
  /** A click filters the list by it (with `pressed`), or opens what it counts (without). */
  onClick?: () => void;
  /** It is the list's filter now: its name underlined; a click on it again goes back to the defaults. */
  pressed?: boolean;
}

/** Where the PC's layouts put the status bar (`StatusBar`); a `StatsLine` on display draws itself there. */
const STATUS_BAR_ID = "status-bar";
/** The status bar's place for the rows selected in a report (how many, the sum of their money). */
export const STATUS_SELECTION_ID = "status-bar-selection";
/** The status bar's place at the right for a report's pager (one bar at the bottom, not two). */
export const STATUS_PAGER_ID = "status-bar-pager";

/**
 * The PC's status bar (the owner's of 2026-11-03: "no final da página, tipo
 * como é no Excel quando soma alguma coisa"): a thin bar at the window's
 * bottom, under the screen, empty (and so hidden) until a page draws in it:
 * its sums at the left, then its counts (`StatsLine`), the rows selected, and
 * the pager at the right. The month is a tool of the ribbon (`useRibbon`).
 */
export function StatusBar() {
  return (
    // Hidden while both of its places are empty.
    // With rows selected on a shorter bar (below 1536 px) their sum takes the counts' place: the page's sums always show.
    <footer className="hidden h-10 shrink-0 items-center gap-4 border-t bg-card px-5 text-[13px] has-[>div>*]:flex max-2xl:has-[#status-bar-selection>*]:[&_section>span]:hidden">
      <div id={STATUS_BAR_ID} className="flex min-w-0 items-center overflow-hidden empty:hidden" />
      <div id={STATUS_SELECTION_ID} className="flex shrink-0 items-center empty:hidden" />
      <div id={STATUS_PAGER_ID} className="ml-auto flex shrink-0 items-center empty:hidden" />
    </footer>
  );
}

/**
 * A list's numbers on the PC (the FBMaker's `.ax-stats`, in place of the row
 * of number cards), in the status bar at the window's bottom, Excel's: at the
 * left each situation's name in grey and its count in bold, a hairline
 * between them (each one a button that filters the list by it, the one on
 * underlined); at the right the page's sums. The numbers in the colour of what
 * they say (`statTone`). Never below 1024 px (the phone keeps its cards). Without a
 * status bar (a layout that has none) it stays where the page puts it.
 *
 *   <StatsLine label="Números das despesas" items={[
 *     { id: "apagar", label: "A pagar", value: 4, pressed: situation === "pendente", onClick: () => toggle("pendente") },
 *     { id: "pagas", label: "Pagas", value: 9, pressed: situation === "feita", onClick: () => toggle("feita") },
 *   ]} />
 */
export function StatsLine({
  items,
  label,
  className,
  summary,
}: {
  items: readonly StatItem[];
  label: string;
  className?: string;
  /**
   * The page's money (what the phone's cards say: "Entrou", "Já pago"…), at
   * the right of the bar, plain text: the counts filter, these only tell.
   */
  summary?: readonly StatSum[];
}) {
  const [bar, setBar] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setBar(document.getElementById(STATUS_BAR_ID)), []);

  const content = (
    <section aria-label={label} className={cn("flex min-w-0 flex-1 items-center gap-y-2", !bar && cn("flex-wrap py-0.5", className))}>
      {items.map((it) => (
        // The hairline between two numbers is on the item, the focus ring on its button. Below 1280 px the bar is
        // too short for all: the sums stay, and the filter's Situação does what the counts do.
        <span key={it.id} className={cn("inline-flex", bar && summary?.length ? "border-l px-4 max-xl:hidden" : bar ? "px-4 not-first:border-l first:pl-0 max-xl:hidden" : "px-[18px] not-first:border-l first:pl-0")}>
          <Stat item={it} small={!!bar} />
        </span>
      ))}
      {summary && summary.length > 0 && (
        // In the status bar first, at its left (the owner's of 2026-11-03: the sums where the month was).
        <dl className={cn("flex items-baseline text-[13px] text-muted-foreground", bar ? "order-first gap-x-6 pr-4" : "ml-auto flex-wrap gap-x-5 gap-y-1 pl-6")}>
          {summary.map((s) => (
            <div key={s.id} className="flex items-baseline gap-1.5 whitespace-nowrap">
              <dt>{s.label}</dt>
              <dd className={cn("font-semibold text-foreground tabular-nums", bar ? "text-[13px]" : "text-[15px]", s.valueClassName ?? statTone(s.label, s.value))}>{s.value}</dd>
              {s.detail && <dd>· {s.detail}</dd>}
            </div>
          ))}
        </dl>
      )}
    </section>
  );
  return bar ? createPortal(content, bar) : content;
}

/** A money number of the page, in the stats line's summary. */
export interface StatSum {
  id: string;
  label: string;
  /** Already formatted by the page. */
  value: string;
  detail?: ReactNode;
  valueClassName?: string;
}

/** One count: 15 px over the page, the status bar's 12 px down there. */
function Stat({ item: it, small }: { item: StatItem; small: boolean }) {
  const body = (
    <>
      <span className={cn(it.pressed && "underline decoration-foreground decoration-2", it.pressed && (small ? "underline-offset-4" : "underline-offset-[6px]"))}>{it.label}</span>
      <b className={cn("font-semibold text-foreground tabular-nums", small ? "text-[13px]" : "text-[17px]", statTone(it.label, it.value))}>{it.value === undefined ? "—" : it.value.toLocaleString("pt-BR")}</b>
      {it.detail && <small className={cn("text-muted-foreground", small ? "text-xs" : "text-[13px]")}>· {it.detail}</small>}
    </>
  );
  const look = cn("inline-flex items-baseline gap-1.5 whitespace-nowrap text-muted-foreground", small ? "text-[13px] leading-5" : "py-1 text-[15px] leading-[22px]");
  if (!it.onClick) return <span className={look}>{body}</span>;
  return (
    <button
      type="button"
      onClick={it.onClick}
      aria-pressed={it.pressed}
      className={cn(look, "rounded-[4px] outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", it.pressed && "text-foreground")}
    >
      {body}
    </button>
  );
}
