import { StatusPill } from "@/components/StatusPill";
import { plural } from "@/lib/formato";
import type { Resumo } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** "3 de 5 obrigatórios" com uma barrinha: verde quando completo, âmbar quando falta. */
export function BarraObrigatorios({ resumo, className, compacta }: { resumo?: Resumo; className?: string; compacta?: boolean }) {
  if (!resumo || resumo.obrigatorios === 0) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const { obrigatorios_ok: ok, obrigatorios: total } = resumo;
  const completo = ok >= total;
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className={cn("h-1.5 shrink-0 overflow-hidden rounded-full bg-muted", compacta ? "w-14" : "w-20")} aria-hidden>
        <span className={cn("block h-full rounded-full", completo ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${Math.round((ok / total) * 100)}%` }} />
      </span>
      <span className="truncate text-sm tabular-nums">
        {ok} de {total}
        {!compacta && <span className="text-muted-foreground"> obrigatórios</span>}
      </span>
    </span>
  );
}

/** As pendências em pílulas: para aprovar, vencidos, vencendo, recusados. */
export function Pendencias({ resumo, vazio = "—", umaLinha }: { resumo?: Resumo; vazio?: string; umaLinha?: boolean }) {
  if (!resumo) return null;
  const pilulas = [
    resumo.aguardando > 0 && <StatusPill key="ag" tone="aguardando">{plural(resumo.aguardando, "para aprovar", "para aprovar")}</StatusPill>,
    resumo.vencidos > 0 && <StatusPill key="ve" tone="negativo">{plural(resumo.vencidos, "vencido", "vencidos")}</StatusPill>,
    resumo.recusados > 0 && <StatusPill key="re" tone="negativo">{plural(resumo.recusados, "recusado", "recusados")}</StatusPill>,
    resumo.vencendo > 0 && <StatusPill key="vb" tone="aguardando">{plural(resumo.vencendo, "vence em breve", "vencem em breve")}</StatusPill>,
  ].filter(Boolean);
  if (pilulas.length === 0) return <span className="text-sm text-muted-foreground">{vazio}</span>;
  return <span className={cn("flex min-w-0 items-center gap-1.5", umaLinha ? "overflow-hidden" : "flex-wrap")}>{pilulas}</span>;
}
