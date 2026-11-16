import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, SearchXIcon, Trash2Icon, UsersIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField, FormPage, FormSection, YesNo } from "@/components/FormPage";
import { ReportTable, type ReportColumn } from "@/components/ReportTable";
import { SearchField } from "@/components/SearchField";
import { Segmented } from "@/components/Segmented";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { navegar } from "@/app/rotas";
import { CHAVE_SESSAO, usePode, useUsuario } from "@/app/sessao";
import { api } from "@/lib/api";
import { dataHoraBR, iniciais, normalizar } from "@/lib/formato";
import type { PerfilAcesso, Usuario } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Filtro = "todos" | "ativos" | "bloqueados";

export function Avatar({ nome, className, admin }: { nome: string; className?: string; admin?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
        admin ? "bg-primary text-primary-foreground" : "bg-primary/[0.14] text-primary-text",
        className,
      )}
      aria-hidden
    >
      {iniciais(nome)}
    </span>
  );
}

/**
 * Usuários: todo mundo num grupo só, administradores e equipe, inclusive você.
 * Abrir a sua linha edita os seus dados e a sua senha.
 */
export function UsuariosView({ abrirProprio }: { abrirProprio?: boolean }) {
  const qc = useQueryClient();
  const eu = useUsuario();
  const podeEditar = usePode("acessos", "editar");
  const podeExcluir = usePode("acessos", "excluir");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [form, setForm] = useState<{ usuario: Usuario | null } | null>(null);
  const [excluir, setExcluir] = useState<Usuario | null>(null);
  const consulta = useQuery({ queryKey: ["usuarios"], queryFn: () => api<{ usuarios: Usuario[] }>("/usuarios") });
  const lista = consulta.data?.usuarios ?? [];

  // "Meu usuário" no menu do avatar abre direto o formulário de quem está usando.
  useEffect(() => {
    if (abrirProprio && consulta.data) {
      setForm({ usuario: consulta.data.usuarios.find((u) => u.id === eu.id) ?? null });
      navegar("/configuracoes/usuarios");
    }
  }, [abrirProprio, consulta.data, eu.id]);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return lista.filter((u) => {
      if (filtro === "ativos" && !u.ativo) return false;
      if (filtro === "bloqueados" && u.ativo) return false;
      return !termo || normalizar(`${u.nome} ${u.email} ${u.perfil_acesso_nome}`).includes(termo);
    });
  }, [lista, busca, filtro]);

  const apagar = useMutation({
    mutationFn: (u: Usuario) => api(`/usuarios/${u.id}`, { metodo: "DELETE" }),
    onSuccess: async () => {
      toast.success("Usuário excluído.");
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const podeAbrir = (u: Usuario) => podeEditar || u.id === eu.id;
  const colunas: ReportColumn<Usuario>[] = [
    {
      id: "nome",
      header: "Usuário",
      primary: true,
      cell: (u) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar nome={u.nome} admin={u.admin} />
          <span className={cn("truncate font-medium", !u.ativo && "text-muted-foreground")}>{u.nome}</span>
          {u.id === eu.id && <span className="shrink-0 text-xs text-muted-foreground">você</span>}
        </span>
      ),
    },
    { id: "email", header: "E-mail", width: "17rem", wideWidth: "24%", hideBelow: "lg", cell: (u) => <span className="text-muted-foreground">{u.email}</span> },
    { id: "perfil", header: "Perfil de acesso", width: "13rem", cell: (u) => (u.admin ? <StatusPill tone="marca">Administrador</StatusPill> : u.perfil_acesso_nome) },
    { id: "situacao", header: "Situação", width: "8rem", cell: (u) => (u.ativo ? <StatusPill tone="concluido">Ativo</StatusPill> : <StatusPill tone="negativo">Bloqueado</StatusPill>) },
    {
      id: "acesso",
      header: "Último acesso",
      width: "11rem",
      hideBelow: "xl",
      cell: (u) => (u.ultimo_acesso_em ? dataHoraBR(u.ultimo_acesso_em) : <span className="text-muted-foreground">Nunca entrou</span>),
    },
  ];


  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-5 pt-5 pb-3">
        <header className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-[-0.011em]">Usuários</h1>
            <p className="text-sm text-muted-foreground">Todos que entram no sistema, administradores e equipe. Abra a sua linha para mudar seus dados e sua senha.</p>
          </div>
          {podeEditar && (
            <Button onClick={() => setForm({ usuario: null })}>
              <PlusIcon data-icon="inline-start" />
              Novo usuário
            </Button>
          )}
        </header>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <SearchField value={busca} onChange={setBusca} placeholder="Buscar nome, e-mail ou perfil" className="w-full max-w-sm" />
          <Segmented
            label="Situação"
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: "todos", label: "Todos" },
              { value: "ativos", label: "Ativos" },
              { value: "bloqueados", label: "Bloqueados" },
            ]}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {consulta.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ReportTable
            label="Usuários"
            columns={colunas}
            bulk={[
              { id: "editar", label: "Editar", icon: PencilIcon, unico: true, applies: podeAbrir, run: ([u]) => setForm({ usuario: u }) },
              podeExcluir && { id: "excluir", label: "Excluir", icon: Trash2Icon, destructive: true, unico: true, applies: (u) => u.id !== eu.id, run: ([u]) => setExcluir(u) },
            ]}
            rows={filtrados}
            rowKey={(u) => String(u.id)}
            onOpen={(u) => podeAbrir(u) && setForm({ usuario: u })}
            openLabel={(u) => `Abrir ${u.nome}`}
            rowClassName={(u) => (u.id === eu.id ? "!bg-primary/[0.05] hover:!bg-primary/[0.09]" : undefined)}
            empty={busca || filtro !== "todos" ? <EstadoVazio compact icon={<SearchXIcon />} title="Nenhum usuário com esses filtros" /> : <EstadoVazio compact icon={<UsersIcon />} title="Nenhum usuário" />}
          />
        )}
      </div>
      {form && <UsuarioForm usuario={form.usuario} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!excluir}
        onOpenChange={(o) => !o && setExcluir(null)}
        title="Excluir usuário?"
        description={`${excluir?.nome} perde o acesso ao sistema. O histórico do que fez continua registrado. Para só bloquear, abra o usuário e marque Acesso liberado: Não.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => excluir && apagar.mutate(excluir)}
      />
    </div>
  );
}

function UsuarioForm({ usuario, onClose }: { usuario: Usuario | null; onClose: () => void }) {
  const qc = useQueryClient();
  const eu = useUsuario();
  const podeEditar = usePode("acessos", "editar");
  const proprio = usuario?.id === eu.id;
  const perfis = useQuery({ queryKey: ["perfis-acesso"], queryFn: () => api<{ perfis: PerfilAcesso[] }>("/perfis-acesso"), enabled: podeEditar });
  const [dados, setDados] = useState({
    nome: usuario?.nome ?? "",
    email: usuario?.email ?? "",
    admin: usuario?.admin ?? false,
    perfil_acesso_id: usuario?.perfil_acesso_id ? String(usuario.perfil_acesso_id) : "",
    ativo: usuario?.ativo ?? true,
    trocar_senha: true,
  });
  const [senha, setSenha] = useState({ atual: "", nova: "", repetir: "" });
  const [erro, setErro] = useState("");

  const salvar = useMutation({
    mutationFn: async () => {
      if (proprio) {
        await api("/sessao/perfil", { metodo: "PUT", corpo: { nome: dados.nome, email: dados.email } });
        if (senha.nova) await api("/sessao/senha", { metodo: "PUT", corpo: { senha_atual: senha.atual, nova_senha: senha.nova } });
        return;
      }
      const corpo = { ...dados, perfil_acesso_id: dados.perfil_acesso_id ? Number(dados.perfil_acesso_id) : null };
      if (!usuario) {
        await api("/usuarios", { corpo: { ...corpo, senha: senha.nova } });
        return;
      }
      await api(`/usuarios/${usuario.id}`, { metodo: "PUT", corpo });
      if (senha.nova) await api(`/usuarios/${usuario.id}/senha`, { metodo: "PUT", corpo: { senha: senha.nova } });
    },
    onSuccess: async () => {
      toast.success(!usuario ? "Usuário criado. Passe o e-mail e a senha para a pessoa." : proprio ? "Seus dados foram salvos." : "Usuário salvo.");
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
      await qc.invalidateQueries({ queryKey: ["perfis-acesso"] });
      await qc.invalidateQueries({ queryKey: CHAVE_SESSAO });
      onClose();
    },
    onError: (e) => setErro((e as Error).message),
  });

  const validar = () => {
    if (!dados.nome.trim() || !dados.email.trim()) return "Preencha nome e e-mail.";
    if (!usuario && senha.nova.length < 8) return "A senha inicial precisa ter pelo menos 8 caracteres.";
    if (senha.nova && senha.nova.length < 8) return "A senha nova precisa ter pelo menos 8 caracteres.";
    if (proprio && senha.nova && !senha.atual) return "Para trocar a sua senha, digite a senha atual.";
    if (proprio && senha.nova !== senha.repetir) return "As senhas novas não são iguais.";
    if (!proprio && !dados.admin && !dados.perfil_acesso_id) return "Escolha o perfil de acesso.";
    return "";
  };

  const titulo = !usuario ? "Novo usuário" : proprio ? "Meus dados" : usuario.nome;

  return (
    <FormPage
      title={titulo}
      status={
        usuario && (
          <span className="flex items-center gap-2">
            {usuario.admin ? <StatusPill tone="marca">Administrador</StatusPill> : <StatusPill tone="neutro">{usuario.perfil_acesso_nome}</StatusPill>}
            <span className="max-lg:hidden">{usuario.ultimo_acesso_em ? `Último acesso em ${dataHoraBR(usuario.ultimo_acesso_em)}` : "Nunca entrou"}</span>
          </span>
        )
      }
      onBack={onClose}
      onSubmit={() => {
        const problema = validar();
        if (problema) return setErro(problema);
        setErro("");
        salvar.mutate();
      }}
      busy={salvar.isPending}
      footerNote={erro && <span className="text-destructive">{erro}</span>}
    >
      <div>
        <FormSection title="Dados" columns={1}>
          <FormField label="Nome" htmlFor="us-nome" required>
            <Input id="us-nome" autoFocus value={dados.nome} onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))} maxLength={120} />
          </FormField>
          <FormField label="E-mail (é o login)" htmlFor="us-email" required>
            <Input id="us-email" type="email" autoComplete="off" value={dados.email} onChange={(e) => setDados((d) => ({ ...d, email: e.target.value }))} maxLength={160} />
          </FormField>
        </FormSection>

        <FormSection title="Acesso" columns={1}>
          {proprio ? (
            <p className="text-sm text-muted-foreground">
              {eu.admin ? "Você é administrador e pode tudo no sistema." : `Seu perfil de acesso é ${eu.perfil_acesso_nome}. Só um administrador muda isso.`}
            </p>
          ) : (
            <>
              {eu.admin && (
                <FormField label="Administrador" help="Pode tudo, inclusive configurações e usuários.">
                  <YesNo label="Administrador" value={dados.admin} onChange={(v) => setDados((d) => ({ ...d, admin: v }))} />
                </FormField>
              )}
              {!dados.admin && (
                <FormField label="Perfil de acesso" required help="O perfil diz o que a pessoa vê e pode mudar.">
                  <Select value={dados.perfil_acesso_id} onValueChange={(v) => setDados((d) => ({ ...d, perfil_acesso_id: v }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Escolha o perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {(perfis.data?.perfis ?? []).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)} disabled={!p.ativo}>
                          {p.nome}
                          {!p.ativo && " (inativo)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
              {usuario && (
                <FormField label="Acesso liberado" help={dados.ativo ? undefined : "Bloqueado: a pessoa não consegue entrar."}>
                  <YesNo label="Acesso liberado" value={dados.ativo} onChange={(v) => setDados((d) => ({ ...d, ativo: v }))} />
                </FormField>
              )}
            </>
          )}
        </FormSection>
      </div>

      <FormSection title={!usuario ? "Senha inicial" : proprio ? "Trocar minha senha" : "Senha"} columns={proprio ? 3 : 2}>
        {proprio && (
          <FormField label="Senha atual" htmlFor="us-atual">
            <Input id="us-atual" type="password" autoComplete="current-password" value={senha.atual} onChange={(e) => setSenha((s) => ({ ...s, atual: e.target.value }))} />
          </FormField>
        )}
        <FormField
          label={!usuario ? "Senha" : "Senha nova"}
          htmlFor="us-nova"
          required={!usuario}
          help={!usuario || proprio ? "Pelo menos 8 caracteres." : "Deixe em branco para manter. A pessoa troca no próximo acesso."}
        >
          <Input id="us-nova" type="password" autoComplete="new-password" value={senha.nova} onChange={(e) => setSenha((s) => ({ ...s, nova: e.target.value }))} />
        </FormField>
        {proprio && (
          <FormField label="Repita a senha nova" htmlFor="us-repetir">
            <Input id="us-repetir" type="password" autoComplete="new-password" value={senha.repetir} onChange={(e) => setSenha((s) => ({ ...s, repetir: e.target.value }))} />
          </FormField>
        )}
        {!usuario && (
          <FormField label="Trocar a senha no primeiro acesso">
            <YesNo label="Trocar a senha no primeiro acesso" value={dados.trocar_senha} onChange={(v) => setDados((d) => ({ ...d, trocar_senha: v }))} />
          </FormField>
        )}
      </FormSection>
    </FormPage>
  );
}
