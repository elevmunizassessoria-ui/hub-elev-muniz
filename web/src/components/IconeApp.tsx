import {
  BanknoteArrowDownIcon,
  BanknoteArrowUpIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  FolderOpenIcon,
  ListChecksIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { ARTE, COR_DA_TELA, GLIFOS, temArte, temGlifo } from "@/lib/icones-app";
import { cn } from "@/lib/utils";

/** As cores das ações (as do Prezyn): verde concluir, vermelho excluir, azul enviar; o resto grafite. */
export const COR_TOM = {
  marca: "#0A84FF",
  azul: "#0A84FF",
  verde: "#30D158",
  vermelho: "#FF453A",
  laranja: "#FF9F0A",
  cinza: "var(--ic-cinza)",
} as const;

/** O desenho cheio de cada ícone de linha que as telas usam (sem par, fica o de linha no quadradinho). */
const GLIFO_DO_ICONE = new Map<LucideIcon, string>([
  [PlusIcon, "plus"],
  [SlidersHorizontalIcon, "sliders"],
  [PencilIcon, "edit"],
  [Trash2Icon, "trash"],
  [CheckIcon, "check"],
  [XIcon, "close"],
  [SendIcon, "send"],
  [RefreshCwIcon, "refresh"],
  [DownloadIcon, "download"],
  [UploadIcon, "upload"],
  [EyeIcon, "eye"],
  [CopyIcon, "copy"],
  [CalendarIcon, "calendar"],
  [BanknoteArrowUpIcon, "receber"],
  [BanknoteArrowDownIcon, "pagar"],
  [FolderOpenIcon, "contas"],
  [ListChecksIcon, "check"],
]);

/**
 * O quadradinho da faixa, como no Prezyn: o fundo branco (cinza escuro no tema escuro) com o brilho do vidro e
 * o desenho colorido por cima. `arte` = o desenho de app de uma tela (ARTE) ou um desenho cheio (GLIFOS).
 */
export function IconeApp({ arte, cor, icone: Icone, className }: { arte?: string; cor?: string; icone?: LucideIcon; className?: string }) {
  const glifo = arte ?? (Icone ? GLIFO_DO_ICONE.get(Icone) : undefined);
  const corFinal = cor ?? (glifo && COR_DA_TELA[glifo as keyof typeof COR_DA_TELA]) ?? COR_TOM.cinza;
  let desenho: React.ReactNode;
  if (glifo && temArte(glifo)) {
    desenho = <svg className="ic-arte relative z-[1] size-8" viewBox="-2.5 -2.5 29 29" aria-hidden dangerouslySetInnerHTML={{ __html: ARTE[glifo as keyof typeof ARTE].svg }} />;
  } else if (glifo && temGlifo(glifo)) {
    desenho = <svg className="ic-cheio relative z-[1] size-[22px]" viewBox="0 0 24 24" aria-hidden dangerouslySetInnerHTML={{ __html: GLIFOS[glifo as keyof typeof GLIFOS] }} />;
  } else if (Icone) {
    desenho = <Icone className="relative z-[1] size-[18px]" strokeWidth={2.2} aria-hidden />;
  }
  return (
    <span aria-hidden className={cn("icone-app relative grid size-8 shrink-0 place-items-center", className)} style={{ "--app": corFinal } as React.CSSProperties}>
      {desenho}
    </span>
  );
}
