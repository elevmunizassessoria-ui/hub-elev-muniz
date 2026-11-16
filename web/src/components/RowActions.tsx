import type { ReactNode } from "react";
import { EllipsisIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface RowAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** O "..." de uma linha: as ações dela num menu, as perigosas por último. */
export function RowActions({ label, items }: { label: string; items: (RowAction | null | false | undefined)[] }) {
  const lista = items.filter(Boolean) as RowAction[];
  if (lista.length === 0) return null;
  const comuns = lista.filter((i) => !i.destructive);
  const perigosas = lista.filter((i) => i.destructive);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground">
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {comuns.map((i) => (
          <DropdownMenuItem key={i.label} disabled={i.disabled} onSelect={i.onSelect}>
            {i.icon}
            {i.label}
          </DropdownMenuItem>
        ))}
        {comuns.length > 0 && perigosas.length > 0 && <DropdownMenuSeparator />}
        {perigosas.map((i) => (
          <DropdownMenuItem key={i.label} variant="destructive" disabled={i.disabled} onSelect={i.onSelect}>
            {i.icon}
            {i.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
