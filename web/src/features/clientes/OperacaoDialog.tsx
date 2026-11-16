import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Escolha } from "@/components/Escolha";
import { FormField } from "@/components/FormPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useUsuario } from "@/app/sessao";
import { api } from "@/lib/api";
import { plural } from "@/lib/formato";
import type { Cliente, Consultor, Operacao, PerfilDocumento } from "@/lib/tipos";

/**
 * Nova operação (ou editar nome e descrição). A predefinição traz etapas, prazos e documentos;
 * o administrador escolhe o consultor, e os demais criam operações para si.
 */
export function OperacaoDialog({
  clienteId,
  operacao,
  onClose,
  onSaved,
}: {
  /** Sem cliente fixo, o formulário pede qual é. */
  clienteId: number | null;
  operacao: Operacao | null;
  onClose: () => void;
  onSaved: (o: Operacao, nova: boolean) => void;
}) {
  const qc = useQueryClient();
  const eu = useUsuario();
  const [cliente, setCliente] = useState(clienteId ? String(clienteId) : "");
  const [nome, setNome] = useState(operacao?.nome ?? "");
  const [descricao, setDescricao] = useState(operacao?.descricao ?? "");
  const [perfil, setPerfil] = useState("");
  const [consultor, setConsultor] = useState(String(eu.id));
  const [erro, setErro] = useState("");
  const perfis = useQuery({ queryKey: ["perfis-documento"], queryFn: () => api<{ perfis: PerfilDocumento[] }>("/perfis-documento"), enabled: !operacao });
  const clientes = useQuery({ queryKey: ["clientes"], queryFn: () => api<{ clientes: Cliente[] }>("/clientes"), enabled: !operacao && !clienteId });
  const consultores = useQuery({ queryKey: ["consultores"], queryFn: () => api<{ consultores: Consultor[] }>("/consultores"), enabled: !operacao && eu.admin });
  const ativos = (perfis.data?.perfis ?? []).filter((p) => p.ativo);
  const escolhido = ativos.find((p) => String(p.id) === perfil);

  const salvar = useMutation({
    mutationFn: () =>
      operacao
        ? api<{ operacao: Operacao }>(`/operacoes/${operacao.id}`, { metodo: "PUT", corpo: { nome, descricao, situacao: operacao.situacao } })
        : api<{ operacao: Operacao }>(`/clientes/${cliente}/operacoes`, {
            corpo: { nome, descricao, perfil_documento_id: perfil ? Number(perfil) : null, consultor_id: consultor ? Number(consultor) : null },
          }),
    onSuccess: async (r) => {
      for (const k of [["cliente", r.operacao.cliente_id], ["operacao", r.operacao.id], ["clientes"], ["operacoes"], ["painel"], ["documentos-geral"]]) await qc.invalidateQueries({ queryKey: k });
      toast.success(operacao ? "Operação salva." : "Operação criada com a pasta dela.");
      onSaved(r.operacao, !operacao);
    },
    onError: (e) => setErro((e as Error).message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && !salvar.isPending && onClose()}>
      <DialogContent>
        <form
          noValidate
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!operacao && !cliente) return setErro("Escolha o cliente.");
            if (!nome.trim()) return setErro("Escreva o nome da operação.");
            setErro("");
            salvar.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{operacao ? "Editar operação" : "Nova operação"}</DialogTitle>
            <DialogDescription>{operacao ? "Mudar o nome também renomeia a pasta." : "O nome vira uma pasta dentro da pasta do cliente."}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {!operacao && !clienteId && (
              <FormField label="Cliente" required>
                <Escolha value={cliente} onChange={setCliente} placeholder="Escolha o cliente" options={(clientes.data?.clientes ?? []).filter((c) => c.ativo).map((c) => ({ value: String(c.id), label: c.nome }))} />
              </FormField>
            )}
            <FormField label="Nome da operação" htmlFor="op-nome" required>
              <Input id="op-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} placeholder="Ex.: Terminal Santos" />
            </FormField>
            {!operacao && (
              <FormField
                label="Predefinição"
                help={
                  escolhido
                    ? `${plural(escolhido.etapas.length, "etapa", "etapas")}, ${plural(escolhido.itens.length, "documento", "documentos")}. Dá para ajustar depois nesta operação.`
                    : "Sem predefinição: etapas padrão e documentos escolhidos depois."
                }
              >
                <Escolha value={perfil} onChange={setPerfil} vazio="Sem predefinição" options={ativos.map((p) => ({ value: String(p.id), label: p.nome }))} />
              </FormField>
            )}
            {!operacao && eu.admin && (
              <FormField label="Consultor responsável">
                <Escolha value={consultor} onChange={setConsultor} vazio="Sem consultor (definir depois)" options={(consultores.data?.consultores ?? []).map((c) => ({ value: String(c.id), label: `${c.nome} (${c.operacoes_ativas} ativas)` }))} />
              </FormField>
            )}
            <FormField label="Descrição" htmlFor="op-desc">
              <Textarea id="op-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} placeholder="Opcional" />
            </FormField>
            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvar.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending && <Spinner data-icon="inline-start" />}
              {operacao ? "Salvar" : "Criar operação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
