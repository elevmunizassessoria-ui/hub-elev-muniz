import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileStackIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormField, FormPage, FormSection, Marcar } from "@/components/FormPage";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { plural } from "@/lib/formato";
import type { ItemOperacao, PerfilDocumento, TipoDocumento } from "@/lib/tipos";
import { CampoNovoDocumento } from "@/features/documentos/PerfisDocumentoView";
import type { DadosOperacao } from "./tipos";

/**
 * O perfil de documentos desta operação: o que ela exige. Começa como cópia do perfil escolhido
 * e pode ser ajustado só aqui (marcar obrigatório, tirar, acrescentar da lista ou um avulso).
 */
export function PerfilOperacaoForm({ dados, onClose }: { dados: DadosOperacao; onClose: () => void }) {
  const qc = useQueryClient();
  const opId = dados.operacao.id;
  const [tirar, setTirar] = useState<ItemOperacao | null>(null);
  const [perfil, setPerfil] = useState("");

  const tipos = useQuery({ queryKey: ["tipos-documento"], queryFn: () => api<{ tipos: TipoDocumento[] }>("/tipos-documento") });
  const perfis = useQuery({ queryKey: ["perfis-documento"], queryFn: () => api<{ perfis: PerfilDocumento[] }>("/perfis-documento") });
  const usados = new Set(dados.itens.map((i) => i.nome.toLowerCase()));
  const sugestoes = (tipos.data?.tipos ?? []).map((t) => t.nome).filter((n) => !usados.has(n.toLowerCase()));

  const atualizar = async () => {
    await qc.invalidateQueries({ queryKey: ["operacao", opId] });
    await qc.invalidateQueries({ queryKey: ["cliente", dados.cliente.id] });
    await qc.invalidateQueries({ queryKey: ["clientes"] });
  };
  const erro = (e: unknown) => toast.error((e as Error).message);

  const mudarItem = useMutation({
    mutationFn: ({ item, campos }: { item: ItemOperacao; campos: Partial<ItemOperacao> }) => api(`/operacoes/${opId}/itens/${item.id}`, { metodo: "PUT", corpo: campos }),
    onSuccess: atualizar,
    onError: erro,
  });
  const tirarItem = useMutation({
    mutationFn: (item: ItemOperacao) => api(`/operacoes/${opId}/itens/${item.id}`, { metodo: "DELETE" }),
    onSuccess: async () => {
      toast.success("Documento tirado do perfil desta operação.");
      await atualizar();
    },
    onError: erro,
  });
  const acrescentar = useMutation({
    mutationFn: (corpo: object) => api<{ adicionados: number }>(`/operacoes/${opId}/itens`, { corpo }),
    onSuccess: async (r) => {
      toast.success(`${plural(r.adicionados, "documento acrescentado", "documentos acrescentados")}.`);
      await atualizar();
    },
    onError: erro,
  });
  const aplicar = useMutation({
    mutationFn: () => api<{ adicionados: number }>(`/operacoes/${opId}/aplicar-perfil`, { corpo: { perfil_documento_id: Number(perfil) } }),
    onSuccess: async (r) => {
      toast.success(r.adicionados ? `${plural(r.adicionados, "documento acrescentado", "documentos acrescentados")} do perfil.` : "A operação já tinha todos os documentos desse perfil.");
      setPerfil("");
      await atualizar();
    },
    onError: erro,
  });

  const grupos = useMemo(() => {
    const m = new Map<string, ItemOperacao[]>();
    for (const i of dados.itens) m.set(i.grupo, [...(m.get(i.grupo) ?? []), i]);
    return [...m.entries()];
  }, [dados.itens]);

  return (
    <FormPage
      title={`Documentos · ${dados.operacao.nome}`}
      status={`${plural(dados.itens.length, "documento", "documentos")} · ${plural(dados.itens.filter((i) => i.obrigatorio).length, "obrigatório", "obrigatórios")}`}
      onBack={onClose}
    >
      <FormSection title="Exige" bodyClassName="">
        <div className="pb-3">
          <CampoNovoDocumento
            id="op-novo-doc"
            sugestoes={sugestoes}
            onAcrescentar={(nome) => {
              if (usados.has(nome.toLowerCase())) return void toast.info(`"${nome}" já está nesta operação.`);
              const existente = (tipos.data?.tipos ?? []).find((t) => t.nome.toLowerCase() === nome.toLowerCase());
              acrescentar.mutate({ nome, obrigatorio: true, frente_verso: existente?.frente_verso ?? false, exige_validade: existente?.exige_validade ?? false });
            }}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Escreva o nome que quiser e aperte Enter. Depois marque se é obrigatório, frente e verso ou tem validade.</p>
        </div>
        {dados.itens.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nenhum documento ainda. Digite o primeiro acima ou aplique um perfil pronto.</p>}
        {grupos.map(([grupo, itens]) => (
          <div key={grupo} className="border-t">
            <p className="pt-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{grupo}</p>
            {itens.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 text-sm">
                <span className="min-w-0 flex-1 font-medium">{i.nome}</span>
                {i.versoes.length > 0 && <StatusPill tone="neutro">{plural(i.versoes.length, "versão", "versões")}</StatusPill>}
                <Marcar checked={i.obrigatorio} onChange={(v) => mudarItem.mutate({ item: i, campos: { obrigatorio: v } })}>
                  Obrigatório
                </Marcar>
                <Marcar checked={i.frente_verso} onChange={(v) => mudarItem.mutate({ item: i, campos: { frente_verso: v } })}>
                  Frente e verso
                </Marcar>
                <Marcar checked={i.exige_validade} onChange={(v) => mudarItem.mutate({ item: i, campos: { exige_validade: v } })}>
                  Tem validade
                </Marcar>
                <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={`Tirar ${i.nome}`} title="Tirar do perfil" onClick={() => setTirar(i)}>
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </div>
        ))}
      </FormSection>

      <FormSection title="Predefinição" columns={2}>
        <FormField label="Aplicar predefinição" help="Acrescenta os documentos que esta operação ainda não tem.">
          <Select value={perfil} onValueChange={setPerfil}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha" />
            </SelectTrigger>
            <SelectContent>
              {(perfis.data?.perfis ?? []).filter((p) => p.ativo).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nome} ({p.itens.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="flex items-start pt-6">
          <Button type="button" variant="outline" className="h-9" disabled={!perfil || aplicar.isPending} onClick={() => aplicar.mutate()}>
            <FileStackIcon data-icon="inline-start" />
            Aplicar
          </Button>
        </div>
      </FormSection>

      <ConfirmDialog
        open={!!tirar}
        onOpenChange={(o) => !o && setTirar(null)}
        title="Tirar do perfil desta operação?"
        description={`"${tirar?.nome}" deixa de ser exigido. Arquivos já enviados continuam na pasta, em "Outros arquivos".`}
        confirmLabel="Tirar"
        destructive
        onConfirm={() => tirar && tirarItem.mutate(tirar)}
      />
    </FormPage>
  );
}
