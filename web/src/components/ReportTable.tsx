import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XIcon, type LucideIcon } from "lucide-react";

import { useReportSelection, type SelectionTool } from "@/components/report-selection";
import { accountingParts } from "@/lib/money";
import { paperText, type ReportColumnType, type ReportValue } from "@/lib/report";
import { cn } from "@/lib/utils";
import { STATUS_SELECTION_ID } from "./StatsLine";

/*
 * The Conecta's report table (TabelaRolavel colada, padrão visual grupo 2),
 * and from 1024 px the FBMaker's `.ax-table` (the owner's standard for the
 * PC, 2026-11-01): the header in a grey band (`bg-muted`) that stays while
 * the body scrolls, 12 px grey, not in capitals; rows of 40 px and 14 px,
 * striped, no line between them, `bg-muted` under the mouse; the frame has
 * only its top and bottom lines (no sides, no corners). On the PC the
 * stripe is #F7F7F7 on the white rows (`muted` at half over the card: the
 * PC's page is white too), the short columns are centred (money, numbers,
 * days, a status: `center`) and money is written in the accounting format
 * (`MoneyCell`). For a small table inside a card, the same classes:
 *
 *   <table className={REPORT_TABLE}><thead><tr><th className={REPORT_HEAD}>…</th></tr></thead>
 *     <tbody><tr className={REPORT_ROW}><td className={REPORT_CELL}>…</td></tr></tbody></table>
 *   (in a `border-y` box)
 */

export const REPORT_TABLE = "w-full border-separate border-spacing-0 text-sm";
/** The header's cell: the grey band, 12 px grey, a line under it (kept while it sticks). */
export const REPORT_HEAD = "bg-muted px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]";
/**
 * A row: striped, no line between rows, grey under the mouse. Below 1024 px
 * one `bg-card`, one `bg-background`; from 1024 px the even one is #F7F7F7
 * (`muted` at half over white) in light and still `bg-background` in dark
 * (`dark:` beats `lg:`, so each of the PC's has its `lg:dark:` and its hover
 * after it). A row in a state beats the stripe with `!bg-…` (`ROW_OVERDUE`).
 */
export const REPORT_ROW =
  "odd:bg-card even:bg-background hover:bg-muted lg:even:bg-muted/50 lg:hover:bg-muted lg:dark:even:bg-background lg:dark:hover:bg-muted";
/** A cell: 14 px, one line (what does not fit is cut, never spilt into the next column). */
export const REPORT_CELL = "h-10 overflow-hidden px-3 py-1.5 text-ellipsis whitespace-nowrap text-foreground";
/** The row of something overdue (its own colour over the stripe). */
export const ROW_OVERDUE = "!bg-red-50/70 hover:!bg-red-100/60 dark:!bg-destructive/[0.07] dark:hover:!bg-destructive/[0.12]";
/** The row chosen (open beside, picked). */
export const ROW_SELECTED = "!bg-primary/[0.08] hover:!bg-primary/[0.12]";

/**
 * A row's action (Editar, Marcar como pago…), our standard's (the owner's of 2026-11-03): a 28 px round
 * button on a soft grey, the icon 14 px, in its colour (`ROW_ACTION_TONE`).
 */
export const ROW_ACTION =
  "inline-grid size-7 shrink-0 place-items-center rounded-full bg-ios-fill-4 text-foreground/70 outline-none transition-colors hover:bg-ios-fill-3 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5 [&_svg]:stroke-2";
/** A row ticked in the select column: a plain grey over the stripes, as iOS's lists (no colour on the row). */
const ROW_PICKED = "!bg-ios-gray-5 hover:!bg-ios-gray-4";
/** The select column's box: 16 px, in the accent when on. */
const CHECK = "size-4 cursor-pointer rounded accent-primary align-middle";
/** The colour of each action: on the symbol only, the same in every row; the button keeps its soft grey. */
export const ROW_ACTION_TONE = {
  editar: "text-primary hover:text-primary",
  pagar: "text-[color-mix(in_srgb,var(--ios-green)_70%,var(--foreground))] hover:text-[color-mix(in_srgb,var(--ios-green)_70%,var(--foreground))]",
  retornar: "text-[color-mix(in_srgb,var(--ios-orange)_75%,var(--foreground))] hover:text-[color-mix(in_srgb,var(--ios-orange)_75%,var(--foreground))]",
  duplicar: "text-ios-indigo hover:text-ios-indigo",
  excluir: "text-ios-red hover:text-ios-red",
} as const;

/**
 * `hideBelow` by the table's own width (a container query), never the
 * window's: with the side filters open the table has 356 px less. Each is
 * about the screen width it is named after less the sidebar, the filters'
 * tab and the page's sides (1024 px: 55rem, 1280: 71rem, 1536: 87rem; 768
 * on the tablet, no sidebar: 45rem). "3xl": a table of 1536 px itself.
 */
const HIDE: Record<NonNullable<ReportColumn<unknown>["hideBelow"]>, { col: string; cell: string }> = {
  md: { col: "hidden @min-[45rem]:table-column", cell: "hidden @min-[45rem]:table-cell" },
  lg: { col: "hidden @min-[55rem]:table-column", cell: "hidden @min-[55rem]:table-cell" },
  xl: { col: "hidden @min-[71rem]:table-column", cell: "hidden @min-[71rem]:table-cell" },
  "1360": { col: "hidden @min-[85rem]:table-column", cell: "hidden @min-[85rem]:table-cell" },
  "2xl": { col: "hidden @min-[87rem]:table-column", cell: "hidden @min-[87rem]:table-cell" },
  "3xl": { col: "hidden @min-[96rem]:table-column", cell: "hidden @min-[96rem]:table-cell" },
};

export interface ReportColumn<T> {
  id: string;
  /** The header (12 px grey, not in capitals): "Data", "Valor". Also the export's. */
  header: string;
  /** The cell on screen. A control inside it (a status that toggles) is its own click: it never opens the row. */
  cell: (row: T) => ReactNode;
  /** What Exportar writes for it: money in signed cents, a day "AAAA-MM-DD", a number or text. Left out: not exported. */
  value?: (row: T) => ReportValue;
  /** The value's kind: money and numbers sit at the right (centred from 1024 px), in tabular digits; the export types its cells. */
  type?: ReportColumnType;
  /** Centred from 1024 px (the FBMaker's `.c`): a status, a short label, the actions. Money, numbers and days are centred there anyway. */
  center?: boolean;
  /** The column's CSS width ("7rem"); none: it shares what is left (the description). */
  width?: string;
  /** Its width on a wide table (about a 1536 px screen's: 87rem) ("12%"), so the description is not all the room. */
  wideWidth?: string;
  /** Hidden on screen while the table is narrower than this screen width's (`HIDE`; the export keeps it). */
  hideBelow?: "md" | "lg" | "xl" | "1360" | "2xl" | "3xl";
  /** The column that names the row: the keyboard's way to open it (Enter), cut with "…". One per table. */
  primary?: boolean;
  /** The cell's classes. */
  className?: string;
  /** The paper's share of the width (default by type) and the Excel's width in characters (default fitted). */
  weight?: number;
  xlsxWidth?: number;
}

/**
 * What can be done to the rows selected at once (Pagar, Retornar, Excluir…): tiles of the ribbon, beside
 * "Adicionar", while rows are selected (`useReportSelection`). Only the rows it applies to are passed to `run`.
 */
export interface ReportBulkAction<T> {
  id: string;
  label: string;
  icon: LucideIcon;
  /** It applies to this row (default: to all); with none selected it does not show. */
  applies?: (row: T) => boolean;
  run: (rows: T[]) => void;
  destructive?: boolean;
  /** The tile in green: what the page mostly does with them (Pagar, Quitar). */
  main?: boolean;
  /** The selection stays after the click (the action asks first, and its answer may be no). */
  keepSelection?: boolean;
  /** Só aparece com uma linha marcada (Editar, Abrir). */
  unico?: boolean;
}

export interface ReportTableProps<T> {
  columns: readonly ReportColumn<T>[];
  /** The rows of the page shown (`usePagination(...).rows`). */
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** A click on the row opens the record (its FormPage). */
  onOpen?: (row: T) => void;
  /** The open action's name for screen readers ("Abrir Conta de luz"). */
  openLabel?: (row: T) => string;
  /** A row in a state (`ROW_OVERDUE`, `ROW_SELECTED`). */
  rowClassName?: (row: T) => string | undefined;
  /** The bold line at the foot, kept in view (the sums of every page): the label in the first column. */
  total?: { label?: string; cells: Partial<Record<string, ReactNode>> };
  /** Shown across the body when there are no rows (an `EstadoVazio compact`). */
  empty?: ReactNode;
  /** The actions on the rows selected (`ReportBulkAction`). */
  bulk?: readonly (ReportBulkAction<T> | false | null | undefined)[];
  /** Back to the top of the body when it changes (the page number). */
  scrollKey?: unknown;
  /** The table's name for screen readers ("Receitas de outubro de 2026"). */
  label: string;
  className?: string;
}

const isNumeric = (type: ReportColumnType | undefined) => type === "money" || type === "number";

/** A column's alignment: numbers at the right below 1024 px; from 1024 px the short columns centred, the texts at the left. */
function alignOf(c: Pick<ReportColumn<unknown>, "type" | "center">): string | undefined {
  const numeric = isNumeric(c.type);
  const day = c.type === "date";
  return cn(numeric && "text-right tabular-nums", day && "lg:tabular-nums", (numeric || day || c.center) && "lg:text-center") || undefined;
}

/**
 * A money value of a table: from 1024 px the accounting format, the whole
 * width of its cell ("R$" in a line at the column's left, the numbers at its
 * right with their cents in a line; a sign stays by the "R$"); below 1024 px
 * as it is written ("R$ 1.234,56"). The colour (green in, red out) is the
 * caller's `className`. Anything that is not an amount stays as it is.
 */
export function MoneyCell({ text, className }: { text: string; className?: string }) {
  const parts = accountingParts(text);
  if (!parts) return <span className={cn("whitespace-nowrap tabular-nums", className)}>{text}</span>;
  return (
    // The space between the two is the phone's; the PC's flex box drops it for its gap.
    <span className={cn("whitespace-nowrap tabular-nums lg:flex lg:w-full lg:justify-between lg:gap-2", className)}>
      <span>{parts.currency}</span> <span>{parts.amount}</span>
    </span>
  );
}

/** Whether a click landed on a control of a cell (it acts on its own, never opens the row). */
function onControl(event: MouseEvent): boolean {
  const hit = (event.target as Element).closest("button, a, input, select, textarea, [role=checkbox], [role=switch], [role=combobox]");
  return !!hit && !hit.hasAttribute("data-row-open");
}

/**
 * A full-page list as a report (`ReportColumn`s, the rows of one page): it
 * fills the rest of the page's height and scrolls inside from 1024 px, the
 * header band staying on top and the total at the foot; below 1024 px the
 * screen scrolls and the header sticks to its top. A click on a row opens it
 * (`onOpen`). From 1024 px every report has a column to select rows (the
 * owner's of 2026-11-03), and the status bar says how many and, Excel's, the
 * sum of their money. Below 768 px the pages keep their phone cards.
 * Pair it with `Pagination` (always under it) and `reportDocument` (Exportar).
 */
export function ReportTable<T>({ columns, rows, rowKey, onOpen, openLabel, rowClassName, total, empty, bulk, scrollKey, label, className }: ReportTableProps<T>) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = 0;
  }, [scrollKey]);
  const hide = (c: ReportColumn<T>) => (c.hideBelow ? HIDE[c.hideBelow] : null);

  // The rows selected (of the page on display), and the status bar's place for them.
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setSlot(document.getElementById(STATUS_SELECTION_ID)), []);
  const keys = rows.map(rowKey);
  const chosen = rows.filter((r) => selected.has(rowKey(r)));
  const all = keys.length > 0 && chosen.length === keys.length;
  const some = chosen.length > 0 && !all;
  const flip = (key: string) =>
    setSelected((now) => {
      const next = new Set(now);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  // The ribbon's tiles for them, always with what is selected now; gone when the table leaves.
  const publish = useReportSelection((s) => s.publish);
  const acoes = (bulk ?? []).filter(Boolean) as ReportBulkAction<T>[];
  useEffect(() => {
    if (!acoes.length || chosen.length === 0) return publish(0, []);
    const tools: SelectionTool[] = acoes.flatMap((action) => {
      if (action.unico && chosen.length !== 1) return [];
      const targets = action.applies ? chosen.filter(action.applies) : chosen;
      if (targets.length === 0) return [];
      return [
        {
          id: action.id,
          label: targets.length === chosen.length ? action.label : `${action.label} (${targets.length})`,
          icon: action.icon,
          tone: action.destructive ? ("red" as const) : action.main ? ("green" as const) : ("gray" as const),
          run: () => {
            action.run(targets);
            if (!action.keepSelection) setSelected(new Set());
          },
        },
      ];
    });
    tools.push({ id: "limpar", label: "Limpar", icon: XIcon, tone: "gray", run: () => setSelected(new Set()) });
    publish(chosen.length, tools);
  });
  useEffect(() => () => publish(0, []), [publish]);
  const money = columns.find((c) => c.type === "money" && c.value);
  const sum = money ? chosen.reduce((total, r) => total + (Number(money.value?.(r)) || 0), 0) : null;

  return (
    // The container its columns measure themselves by (`HIDE`, the wide widths).
    <div ref={box} className={cn("@container min-h-0 border-y bg-background lg:flex-1 lg:overflow-auto lg:[scrollbar-width:none]", className)}>
      <table aria-label={label} className={cn(REPORT_TABLE, "table-fixed")}>
        <colgroup>
          <col className={cn("w-10", HIDE.lg.col)} />
          {columns.map((c) => (
            // Plain lengths only: a table column takes no calc()/max() (Chromium reads it as auto).
            <col
              key={c.id}
              className={cn(c.width && "w-(--col-w) @min-[87rem]:w-(--col-w-wide)", hide(c)?.col)}
              style={c.width ? ({ "--col-w": c.width, "--col-w-wide": c.wideWidth ?? c.width } as CSSProperties) : undefined}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={cn(REPORT_HEAD, "sticky top-0 z-10 w-10 px-0 text-center", HIDE.lg.cell)}>
              <input
                ref={(el) => {
                  if (el) el.indeterminate = some;
                }}
                type="checkbox"
                checked={all}
                aria-label={all ? "Desmarcar todos" : "Selecionar todos"}
                onChange={() => setSelected(all ? new Set() : new Set(keys))}
                className={CHECK}
              />
            </th>
            {columns.map((c) => (
              <th key={c.id} scope="col" className={cn(REPORT_HEAD, "sticky top-0 z-10", alignOf(c), hide(c)?.cell)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="bg-card">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onOpen ? (e) => !onControl(e) && onOpen(row) : undefined}
                className={cn(REPORT_ROW, onOpen && "cursor-pointer", rowClassName?.(row), selected.has(rowKey(row)) && ROW_PICKED)}
              >
                <td className={cn(REPORT_CELL, "w-10 px-0 text-center", HIDE.lg.cell)}>
                  <input type="checkbox" checked={selected.has(rowKey(row))} aria-label="Selecionar" onChange={() => flip(rowKey(row))} className={CHECK} />
                </td>
                {columns.map((c) => (
                  <td key={c.id} className={cn(REPORT_CELL, alignOf(c), c.primary && "truncate", hide(c)?.cell, c.className)}>
                    {c.primary && onOpen ? (
                      // The row's keyboard target: Enter clicks it, the click reaches the row.
                      <button
                        type="button"
                        data-row-open
                        aria-label={openLabel?.(row)}
                        className="block max-w-full truncate text-left outline-none focus-visible:underline focus-visible:decoration-primary focus-visible:underline-offset-4"
                      >
                        {c.cell(row)}
                      </button>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {/* Below 1024 px only: on the PC the sums are in the status bar at the window's bottom (the owner's of 2026-11-03). */}
        {total && rows.length > 0 && (
          <tfoot className="lg:hidden">
            <tr>
              {columns.map((c, i) => (
                <td
                  key={c.id}
                  className={cn(
                    // Kept in view only where the body scrolls by itself (below 1024 px it is the last line).
                    "z-10 h-10 bg-muted px-3 py-1.5 font-semibold whitespace-nowrap shadow-[inset_0_1px_0_var(--border)] lg:sticky lg:bottom-0",
                    alignOf(c),
                    hide(c)?.cell,
                  )}
                >
                  {total.cells[c.id] ?? (i === 0 ? (total.label ?? "Total") : null)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {slot &&
        chosen.length > 0 &&
        createPortal(
          <span className="flex items-center gap-3 border-l pl-4 whitespace-nowrap">
            {/* With the ribbon's tiles (`bulk`) the count and "Limpar" are there. */}
            {!acoes.length && (
              <span className="text-muted-foreground">
                <b className="text-[13px] font-semibold text-foreground tabular-nums">{chosen.length}</b> {chosen.length === 1 ? "selecionado" : "selecionados"}
              </span>
            )}
            {sum !== null && (
              <span className="text-muted-foreground">
                Soma <b className="text-[13px] font-semibold text-foreground tabular-nums">{paperText(sum, "money")}</b>
              </span>
            )}
            {!acoes.length && (
              <button type="button" className="rounded-md px-1.5 py-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelected(new Set())}>
                Limpar
              </button>
            )}
          </span>,
          slot,
        )}
    </div>
  );
}

