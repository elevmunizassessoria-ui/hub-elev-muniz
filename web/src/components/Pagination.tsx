import { useEffect, useId, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

import { STATUS_PAGER_ID } from "@/components/StatsLine";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clampPage, PAGE_SIZE, PAGE_SIZES, pageAfterResize, pageCount, pageRange, pageWindow } from "@/lib/pagination";
import { useIsPhone } from "@/lib/use-phone";
import { cn } from "@/lib/utils";

export { PAGE_SIZE } from "@/lib/pagination";

/** The page size each list chose on the PC ("Por página"), by its name: kept while the app is open. */
const chosenSizes = new Map<string, number>();

export interface Pager<T> {
  /** 0-based. */
  page: number;
  setPage: (page: number) => void;
  /** The rows of the page shown. */
  rows: T[];
  /** Rows a page: the list's "Por página" on the PC, always `PAGE_SIZE` below 1024 px. */
  pageSize: number;
  setPageSize: (size: number) => void;
}

/**
 * The page of a report's table (0-based) and its rows: back to the first page
 * whenever `resetKey` changes (a filter, the month), and never past the last
 * page when rows leave (one deleted, one paid under "A pagar"). On the PC
 * the page size is the list's own (`list`: its "Por página", 25 to start,
 * kept while the app is open); below 1024 px always 25.
 *
 *   const pager = usePagination(filtered, `${month}|${account}|${search}`, "financas.receitas");
 *   <ReportTable rows={pager.rows} scrollKey={pager.page} … />
 *   <Pagination pager={pager} total={filtered.length} />
 */
export function usePagination<T>(items: readonly T[], resetKey: string, list?: string): Pager<T> {
  const phone = useIsPhone();
  const [chosen, setChosen] = useState(() => (list && chosenSizes.get(list)) || PAGE_SIZE);
  const pageSize = phone ? PAGE_SIZE : chosen;
  const [state, setState] = useState({ page: 0, key: resetKey });
  // A new key starts over at the first page (at once: no frame shows the old page).
  const page = state.key === resetKey ? clampPage(state.page, items.length, pageSize) : 0;
  useEffect(() => {
    if (state.key !== resetKey) setState({ page: 0, key: resetKey });
  }, [state.key, resetKey]);
  return {
    page,
    setPage: (p: number) => setState({ page: clampPage(p, items.length, pageSize), key: resetKey }),
    rows: items.slice(page * pageSize, page * pageSize + pageSize),
    pageSize,
    setPageSize: (size: number) => {
      if (list) chosenSizes.set(list, size);
      setChosen(size);
      // The first row shown stays in sight.
      setState({ page: clampPage(pageAfterResize(page, pageSize, size), items.length, size), key: resetKey });
    },
  };
}

const BUTTON =
  "h-8 rounded-md px-2.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:text-muted-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/30";

/**
 * A report's pagination, always under its table (also with one page: the
 * count never leaves). Pair it with `usePagination`. From 1024 px the
 * FBMaker's pager (`PcPagination`); below it the Conecta's
 * (`PaginacaoFixa colada sempre`): on the page's background (no card), grey
 * buttons, only the current page in blue, at the right "Itens 1 - 25 |
 * Total de 52".
 */
export function Pagination<T>({ pager, total, className }: { pager: Pager<T>; total: number; className?: string }) {
  const phone = useIsPhone();
  if (!phone) return <PcPagination pager={pager} total={total} className={className} />;
  const { page, pageSize } = pager;
  const pages = pageCount(total, pageSize);
  const { first, last } = pageRange(page, total, pageSize);
  const go = (p: number) => {
    if (p !== page) pager.setPage(p);
  };
  return (
    <nav aria-label="Paginação" className={cn("flex shrink-0 flex-wrap items-center justify-between gap-2 bg-background py-2.5", className)}>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" className={BUTTON} onClick={() => go(0)} disabled={page === 0}>
          Primeira
        </button>
        <button type="button" className={BUTTON} onClick={() => go(page - 1)} disabled={page === 0}>
          Anterior
        </button>
        {pageWindow(page, pages).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Página ${p + 1}`}
            className={cn(
              "h-8 min-w-8 rounded-md px-1.5 text-xs font-medium tabular-nums outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30",
              p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {p + 1}
          </button>
        ))}
        <button type="button" className={BUTTON} onClick={() => go(page + 1)} disabled={page >= pages - 1}>
          Próxima
        </button>
        <button type="button" className={BUTTON} onClick={() => go(pages - 1)} disabled={page >= pages - 1}>
          Última
        </button>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        Itens{" "}
        <span className="font-semibold text-foreground">
          {first} - {last}
        </span>
        <span className="mx-2 text-muted-foreground/40">|</span>
        Total de <span className="font-semibold text-foreground">{total.toLocaleString("pt-BR")}</span>
      </p>
    </nav>
  );
}

/** A button of the PC's pager: 32 px, 13 px, a capsule as the kit's buttons, transparent; a word one grey and a little wider. */
const PC_BUTTON =
  "h-8 min-w-8 rounded-full px-2 text-[13px] font-medium tabular-nums text-foreground outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-muted-foreground/55";
const PC_WORD = cn(PC_BUTTON, "px-2.5 text-muted-foreground hover:text-foreground");
/** A button of the pager in the status bar: 28 px, 13 px, round as the kit's buttons; an arrow grey. */
const BAR_BUTTON =
  "grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4";

/**
 * The PC's pager (the FBMaker's `pager()`): a strip on the card's white under
 * the table (the table's line is its top), at the left Primeira, Anterior,
 * up to 8 pages (3 ahead of the current one) and Próxima, Última; at the
 * right "Por página" (10, 25, 50) and "Itens 1 - 25 | Total de 194". The
 * current page is filled in the text's colour, never the blue: on the PC
 * the blue is only the screen's main action, the menu's place and the
 * focus (the owner's rule, 2026-11-01).
 */
function PcPagination<T>({ pager, total, className }: { pager: Pager<T>; total: number; className?: string }) {
  const perPage = useId();
  const { page, pageSize } = pager;
  const pages = pageCount(total, pageSize);
  const { first, last } = pageRange(page, total, pageSize);
  const go = (p: number) => {
    if (p !== page) pager.setPage(p);
  };
  // Where the PC's layouts have it, the pager is part of the status bar at the window's bottom (the
  // owner's of 2026-11-03: one bar, not two), small at its right.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setSlot(document.getElementById(STATUS_PAGER_ID)), []);
  if (slot)
    return createPortal(
      <nav aria-label="Paginação" className="flex items-center gap-5 pl-4 text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">
        {/* Where the bar is short (below 1280 px) only the arrows, the pages and the size: nothing runs over the sums. */}
        <span className="max-xl:hidden">
          <b className="font-semibold text-foreground">
            {first}–{last}
          </b>{" "}
          de {total.toLocaleString("pt-BR")}
        </span>
        <span className="flex items-center gap-1">
          <button type="button" className={BAR_BUTTON} aria-label="Primeira página" title="Primeira página" onClick={() => go(0)} disabled={page === 0}>
            <ChevronsLeftIcon />
          </button>
          <button type="button" className={BAR_BUTTON} aria-label="Página anterior" title="Página anterior" onClick={() => go(page - 1)} disabled={page === 0}>
            <ChevronLeftIcon />
          </button>
          {pageWindow(page, pages, 8, 3).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              aria-current={p === page ? "page" : undefined}
              aria-label={`Página ${p + 1}`}
              className={cn(BAR_BUTTON, "text-foreground", p === page && "bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
            >
              {p + 1}
            </button>
          ))}
          <button type="button" className={BAR_BUTTON} aria-label="Próxima página" title="Próxima página" onClick={() => go(page + 1)} disabled={page >= pages - 1}>
            <ChevronRightIcon />
          </button>
          <button type="button" className={BAR_BUTTON} aria-label="Última página" title="Última página" onClick={() => go(pages - 1)} disabled={page >= pages - 1}>
            <ChevronsRightIcon />
          </button>
        </span>
        <span className="flex items-center gap-2">
          <span id={perPage} className="max-xl:sr-only">
            Por página
          </span>
          <Select value={String(pageSize)} onValueChange={(v) => pager.setPageSize(Number(v))}>
            <SelectTrigger aria-labelledby={perPage} className="h-7! min-w-16 rounded-md bg-card px-2.5 text-[13px] text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end" side="top" className="min-w-14">
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      </nav>,
      slot,
    );
  return (
    <nav aria-label="Paginação" className={cn("flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-card px-3 py-2 text-[13px] text-muted-foreground", className)}>
      <div className="flex flex-wrap items-center gap-0.5">
        <button type="button" className={PC_WORD} onClick={() => go(0)} disabled={page === 0}>
          Primeira
        </button>
        <button type="button" className={PC_WORD} onClick={() => go(page - 1)} disabled={page === 0}>
          Anterior
        </button>
        {pageWindow(page, pages, 8, 3).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Página ${p + 1}`}
            className={cn(PC_BUTTON, p === page && "bg-foreground font-semibold text-background hover:bg-foreground")}
          >
            {p + 1}
          </button>
        ))}
        <button type="button" className={PC_WORD} onClick={() => go(page + 1)} disabled={page >= pages - 1}>
          Próxima
        </button>
        <button type="button" className={PC_WORD} onClick={() => go(pages - 1)} disabled={page >= pages - 1}>
          Última
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 tabular-nums">
        <span className="flex items-center gap-2">
          <span id={perPage}>Por página</span>
          <Select value={String(pageSize)} onValueChange={(v) => pager.setPageSize(Number(v))}>
            <SelectTrigger aria-labelledby={perPage} className="min-w-16 rounded-[4px] bg-card text-xs text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="min-w-16">
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
        <span>
          Itens{" "}
          <b className="font-semibold text-foreground">
            {first} - {last}
          </b>
        </span>
        <i className="h-3.5 w-px bg-input" aria-hidden />
        <span>
          Total de <b className="font-semibold text-foreground">{total.toLocaleString("pt-BR")}</b>
        </span>
      </div>
    </nav>
  );
}
