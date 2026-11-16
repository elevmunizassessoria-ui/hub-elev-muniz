import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListChecksIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField, YesNo } from "@/components/FormPage";
import { PainelFiltro, ferramentaFiltro } from "@/components/PainelFiltro";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFerramentas } from "@/app/faixa";
import { useMigalhas } from "@/app/migalhas";
import { usePode } from "@/app/sessao";
import { api } from "@/lib/api";
import { normalizar } from "@/lib/formato";
import type { TipoDocumento } from "@/lib/tipos";


/** A lista geral de documentos que podem ser pedidos aos clientes. */
export function TiposDocumentoView() {
  useMigalhas([{ label: "Documentos", caminho: "/documentos" }, { label: "Cadastrados" }]);
  const qc = useQueryClient();
  const podeEditar = usePode("cadastro_documentos", "editar");
  const podeExcluir = usePode("cadastro_documentos", "excluir");
  const [busca, setBusca] = useState("");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [form, setForm] = useState<{ tipo: TipoDocumento | null } | null>(null);
  const [remover, setRemover] = useState<TipoDocumento | null>(null);
  const consulta = useQuery({ queryKey: ["tipos-documento"], queryFn: () => api<{ tipos: TipoDocumento[] }>("/tipos-documento") });
  const tipos = consulta.data?.tipos ?? [];
  const nomesGrupos = [...new Set(tipos.map((t) => t.grupo))];

  const grupos = useMemo(() => {
    const termo = normalizar(busca.trim());
    const m = new Map<string, TipoDocumento[]>();
    for (const t of tipos) {
      if (termo && !normalizar(`${t.nome} ${t.grupo} ${t.descricao}`).includes(termo)) continue;
      m.set(t.grupo, [...(m.get(t.grupo) ?? []), t]);
    }
    return [...m.entries()];
  }, [tipos, busca]);

  useFerramentas([
    { titulo: "Filtrar", ferramentas: [ferramentaFiltro(() => setFiltroAberto(true), busca.trim() ? 1 : 0)] },
    ...(podeEditar ? [{ titulo: "Adicionar", ferramentas: [{ id: "novo", label: "Adicionar documento", icon: PlusIcon, tom: "cinza" as const, run: () => setForm({ tipo: null }) }] }] : []),
  ]);

  const apagar = useMutation({
    mutationFn: (t: TipoDocumento) => api(`/tipos-documento/${t.id}`, { metodo: "DELETE" }),
    onSuccess: async () => {
      toast.success("Documento tirado da lista.");
      await qc.invalidateQueries({ queryKey: ["tipos-documento"] });
      await qc.invalidateQueries({ queryKey: ["perfis-documento"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
        <div className="flex flex-col gap-4">
          {consulta.isPending ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : grupos.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EstadoVazio icon={<ListChecksIcon />} title={busca ? "Nenhum documento com essa busca" : "Nenhum documento ainda"} description={busca ? undefined : "Crie o primeiro em Novo documento. O nome é livre."} />
            </div>
          ) : (
            grupos.map(([grupo, lista]) => (
              <section key={grupo} className="overflow-hidden rounded-[14px] bg-card"><h2 className="border-b px-4 py-2.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{grupo} ({lista.length})</h2>
                {lista.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.nome}</p>
                      {t.descricao && <p className="truncate text-xs text-muted-foreground">{t.descricao}</p>}
                    </div>
                    {t.frente_verso && <StatusPill tone="neutro">Frente e verso</StatusPill>}
                    {t.exige_validade && <StatusPill tone="andamento">Tem validade</StatusPill>}
                    {podeEditar && (
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${t.nome}`} onClick={() => setForm({ tipo: t })}>
                        <PencilIcon />
                      </Button>
                    )}
                    {podeExcluir && (
                      <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={`Remover ${t.nome}`} onClick={() => setRemover(t)}>
                        <Trash2Icon />
                      </Button>
                    )}
                  </div>
                ))}
              </section>
            ))
          )}
        </div>
      </div>
      <PainelFiltro aberto={filtroAberto} onClose={() => setFiltroAberto(false)} mostrando={grupos.reduce((t, g) => t + g[1].length, 0)} total={tipos.length} onLimpar={() => setBusca("")}>
        <FormField label="Busca" htmlFor="td-busca">
          <Input id="td-busca" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou grupo" />
        </FormField>
      </PainelFiltro>
      {form && <TipoDialog tipo={form.tipo} grupos={nomesGrupos} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!remover}
        onOpenChange={(o) => !o && setRemover(null)}
        title="Remover documento da lista?"
        description={`"${remover?.nome}" sai da lista e dos perfis. As operações que já pedem este documento continuam com ele.`}
        confirmLabel="Remover"
        destructive
        onConfirm={() => remover && apagar.mutate(remover)}
      />
    </div>
  );
}

function TipoDialog({ tipo, grupos, onClose }: { tipo: TipoDocumento | null; grupos: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [dados, setDados] = useState({
    nome: tipo?.nome ?? "",
    grupo: tipo?.grupo ?? "Geral",
    descricao: tipo?.descricao ?? "",
    frente_verso: tipo?.frente_verso ?? false,
    exige_validade: tipo?.exige_validade ?? false,
  });
  const [erro, setErro] = useState("");
  const salvar = useMutation({
    mutationFn: () => (tipo ? api(`/tipos-documento/${tipo.id}`, { metodo: "PUT", corpo: dados }) : api("/tipos-documento", { corpo: dados })),
    onSuccess: async () => {
      toast.success(tipo ? "Documento salvo." : "Documento cadastrado.");
      await qc.invalidateQueries({ queryKey: ["tipos-documento"] });
      await qc.invalidateQueries({ queryKey: ["perfis-documento"] });
      onClose();
    },
    onError: (e) => setErro((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          noValidate
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!dados.nome.trim()) return setErro("Escreva o nome do documento.");
            setErro("");
            salvar.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{tipo ? "Editar documento" : "Novo documento"}</DialogTitle>
            <DialogDescription>O nome também é o nome do arquivo guardado na pasta do cliente.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor="tp-nome" required>
              <Input id="tp-nome" autoFocus value={dados.nome} onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))} maxLength={120} />
            </FormField>
            <FormField label="Grupo" htmlFor="tp-grupo" help="Escolha um da lista ou escreva um novo.">
              <Input id="tp-grupo" list="tp-grupos" value={dados.grupo} onChange={(e) => setDados((d) => ({ ...d, grupo: e.target.value }))} maxLength={60} />
              <datalist id="tp-grupos">
                {grupos.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Descrição" htmlFor="tp-desc">
              <Textarea id="tp-desc" value={dados.descricao} onChange={(e) => setDados((d) => ({ ...d, descricao: e.target.value }))} maxLength={300} placeholder="Opcional. Aparece para o cliente no link." />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Frente e verso">
                <YesNo label="Frente e verso" value={dados.frente_verso} onChange={(v) => setDados((d) => ({ ...d, frente_verso: v }))} />
              </FormField>
              <FormField label="Tem validade">
                <YesNo label="Tem validade" value={dados.exige_validade} onChange={(v) => setDados((d) => ({ ...d, exige_validade: v }))} />
              </FormField>
            </div>
            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending && <Spinner data-icon="inline-start" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
