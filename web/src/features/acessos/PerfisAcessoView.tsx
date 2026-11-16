import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField, FormPage, FormSection, YesNo } from "@/components/FormPage";
import { ReportTable, type ReportColumn } from "@/components/ReportTable";
import { Segmented } from "@/components/Segmented";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePode } from "@/app/sessao";
import { api } from "@/lib/api";
import { plural } from "@/lib/formato";
import type { Modulo, ModuloInfo, Nivel, PerfilAcesso } from "@/lib/tipos";

const NOME_NIVEL: Record<Nivel, string> = { ver: "Ver", editar: "Editar", excluir: "Excluir" };

/** Perfis de acesso: o que cada grupo de pessoas pode ver e mudar no sistema. */
export function PerfisAcessoView() {
  const qc = useQueryClient();
  const podeEditar = usePode("acessos", "editar");
  const podeExcluir = usePode("acessos", "excluir");
  const [form, setForm] = useState<{ perfil: PerfilAcesso | null } | null>(null);
  const [excluir, setExcluir] = useState<PerfilAcesso | null>(null);
  const consulta = useQuery({ queryKey: ["perfis-acesso"], queryFn: () => api<{ perfis: PerfilAcesso[] }>("/perfis-acesso") });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => api<{ modulos: ModuloInfo[] }>("/modulos") });

  const apagar = useMutation({
    mutationFn: (p: PerfilAcesso) => api(`/perfis-acesso/${p.id}`, { metodo: "DELETE" }),
    onSuccess: async () => {
      toast.success("Perfil excluído.");
      await qc.invalidateQueries({ queryKey: ["perfis-acesso"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const colunas: ReportColumn<PerfilAcesso>[] = [
    {
      id: "nome",
      header: "Perfil",
      primary: true,
      cell: (p) => (
        <span className="truncate">
          <span className="font-medium">{p.nome}</span>
          {p.descricao && <span className="text-muted-foreground"> · {p.descricao}</span>}
        </span>
      ),
    },
    {
      id: "permissoes",
      header: "Libera",
      width: "20rem",
      wideWidth: "30%",
      cell: (p) => {
        const n = Object.keys(p.permissoes).length;
        return n === 0 ? <span className="text-muted-foreground">Nada</span> : plural(n, "área", "áreas");
      },
    },
    { id: "usuarios", header: "Usuários", width: "7rem", type: "number", cell: (p) => p.usuarios },
    { id: "situacao", header: "Situação", width: "8rem", cell: (p) => (p.ativo ? <StatusPill tone="concluido">Ativo</StatusPill> : <StatusPill tone="neutro">Inativo</StatusPill>) },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex w-full shrink-0 flex-wrap items-end gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-[-0.011em]">Perfis de acesso</h1>
          <p className="text-sm text-muted-foreground">O que cada grupo de pessoas pode ver e mudar. Administradores podem tudo.</p>
        </div>
        {podeEditar && (
          <Button className="ml-auto shrink-0" onClick={() => setForm({ perfil: null })}>
            <PlusIcon data-icon="inline-start" />
            Novo perfil
          </Button>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {consulta.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ReportTable
            label="Perfis de acesso"
            columns={colunas}
            bulk={[
              podeEditar && { id: "editar", label: "Editar", icon: PencilIcon, unico: true, run: ([p]) => setForm({ perfil: p }) },
              podeExcluir && { id: "excluir", label: "Excluir", icon: Trash2Icon, destructive: true, unico: true, run: ([p]) => setExcluir(p) },
            ]}
            rows={consulta.data?.perfis ?? []}
            rowKey={(p) => String(p.id)}
            onOpen={podeEditar ? (p) => setForm({ perfil: p }) : undefined}
            openLabel={(p) => `Editar ${p.nome}`}
            empty={<EstadoVazio compact icon={<ShieldCheckIcon />} title="Nenhum perfil de acesso" />}
          />
        )}
      </div>
      {form && modulos.data && <PerfilAcessoForm perfil={form.perfil} modulos={modulos.data.modulos} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!excluir}
        onOpenChange={(o) => !o && setExcluir(null)}
        title="Excluir perfil de acesso?"
        description={`"${excluir?.nome}" sai da lista. Só dá para excluir um perfil sem usuários.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => excluir && apagar.mutate(excluir)}
      />
    </div>
  );
}

type Escolha = Nivel | "nenhum";

function PerfilAcessoForm({ perfil, modulos, onClose }: { perfil: PerfilAcesso | null; modulos: ModuloInfo[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(perfil?.nome ?? "");
  const [descricao, setDescricao] = useState(perfil?.descricao ?? "");
  const [ativo, setAtivo] = useState(perfil?.ativo ?? true);
  const [permissoes, setPermissoes] = useState<Partial<Record<Modulo, Nivel>>>(perfil?.permissoes ?? {});
  const [erro, setErro] = useState("");
  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { nome, descricao, ativo, permissoes };
      return perfil ? api(`/perfis-acesso/${perfil.id}`, { metodo: "PUT", corpo }) : api("/perfis-acesso", { corpo });
    },
    onSuccess: async () => {
      toast.success(perfil ? "Perfil salvo. Vale no próximo clique de quem usa este perfil." : "Perfil criado.");
      await qc.invalidateQueries({ queryKey: ["perfis-acesso"] });
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
      onClose();
    },
    onError: (e) => setErro((e as Error).message),
  });

  return (
    <FormPage
      title={perfil ? `Editar ${perfil.nome}` : "Novo perfil de acesso"}
      status={perfil ? plural(perfil.usuarios, "usuário usa este perfil", "usuários usam este perfil") : undefined}
      onBack={onClose}
      onSubmit={() => {
        if (!nome.trim()) return setErro("Escreva o nome do perfil.");
        setErro("");
        salvar.mutate();
      }}
      busy={salvar.isPending}
      footerNote={erro && <span className="text-destructive">{erro}</span>}
    >
      <FormSection title="Perfil">
        <FormField label="Nome" htmlFor="pa-nome" required span={2}>
          <Input id="pa-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
        </FormField>
        <FormField label="Perfil ativo">
          <YesNo label="Perfil ativo" value={ativo} onChange={setAtivo} />
        </FormField>
        <FormField label="Descrição" htmlFor="pa-desc" span="full">
          <Input id="pa-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} placeholder="Opcional" />
        </FormField>
      </FormSection>
      <FormSection title="Libera" bodyClassName="">
        {modulos.map((m) => {
          const valor: Escolha = permissoes[m.chave] ?? "nenhum";
          return (
            <div key={m.chave} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b py-2.5 first:pt-0">
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm font-medium">{m.nome}</p>
                <p className="text-xs text-muted-foreground">{m.descricao}</p>
              </div>
              <Segmented<Escolha>
                label={m.nome}
                size="sm"
                value={valor}
                onChange={(v) =>
                  setPermissoes((p) => {
                    const n = { ...p };
                    if (v === "nenhum") delete n[m.chave];
                    else n[m.chave] = v;
                    return n;
                  })
                }
                options={[
                  { value: "nenhum", label: "Sem acesso" },
                  { value: "ver", label: NOME_NIVEL.ver },
                  { value: "editar", label: NOME_NIVEL.editar },
                  { value: "excluir", label: NOME_NIVEL.excluir },
                ]}
              />
            </div>
          );
        })}
        <p className="pt-3 text-xs text-muted-foreground">Ver: só olha. Editar: cadastra e muda. Excluir: também apaga. Cada nível inclui o anterior. Quem não é administrador só enxerga os dados das próprias operações.</p>
      </FormSection>
    </FormPage>
  );
}
