import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  HistoryIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SunIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { AcessoRestrito } from "@/components/AcessoRestrito";
import { Carregando } from "@/components/Carregando";
import { FormField, FormSection, Marcar } from "@/components/FormPage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListaHistorico } from "@/components/Historico";
import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useMigalhas } from "@/app/migalhas";
import { usePreferencias, type Tema } from "@/app/preferencias";
import { navegar, useRota } from "@/app/rotas";
import { pode, useSessao } from "@/app/sessao";
import { api } from "@/lib/api";
import type { Configuracoes, Historico, Modulo } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { PerfisAcessoView } from "@/features/acessos/PerfisAcessoView";
import { UsuariosView } from "@/features/acessos/UsuariosView";

interface Secao {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Sem módulo: todo usuário vê. */
  modulo?: Modulo;
}

/** O menu de Configurações. "Perfis" primeiro: todos os usuários num grupo só, e os perfis de acesso. */
const GRUPOS: { id: string; titulo: string; secoes: Secao[] }[] = [
  {
    id: "perfis",
    titulo: "Perfis",
    secoes: [
      { id: "usuarios", label: "Usuários", icon: UsersIcon },
      { id: "perfis", label: "Perfis de acesso", icon: ShieldCheckIcon, modulo: "acessos" },
    ],
  },
  {
    id: "sistema",
    titulo: "Sistema",
    secoes: [
      { id: "geral", label: "Geral", icon: SlidersHorizontalIcon, modulo: "configuracoes" },
      { id: "aparencia", label: "Aparência", icon: PaletteIcon },
      { id: "historico", label: "Histórico", icon: HistoryIcon, modulo: "configuracoes" },
    ],
  },
];

/** Configurações: um menu na esquerda e a seção escolhida na direita. */
export function ConfiguracoesView() {
  const { partes } = useRota();
  const { data } = useSessao();
  const usuario = data?.usuario;
  const visiveis = GRUPOS.map((g) => ({ ...g, secoes: g.secoes.filter((s) => !s.modulo || pode(usuario, s.modulo)) })).filter((g) => g.secoes.length > 0);
  const pedida = partes[1];
  const grupo = visiveis.find((g) => g.secoes.some((s) => s.id === pedida));
  const secao = grupo?.secoes.find((s) => s.id === pedida);

  useMigalhas([{ label: "Configurações", caminho: "/configuracoes/usuarios" }, ...(grupo && secao ? [{ label: grupo.titulo }, { label: secao.label }] : [])]);

  // Sem seção (ou uma que não existe mais): vai para Usuários. "usuario" era a tela antiga dos meus dados.
  useEffect(() => {
    if (pedida === "usuario") navegar("/configuracoes/usuarios/eu");
    else if (!secao && !(pedida && GRUPOS.some((g) => g.secoes.some((s) => s.id === pedida)))) navegar("/configuracoes/usuarios");
  }, [secao, pedida]);

  return (
    <div className="flex h-full min-h-0">
      <aside aria-label="Seções de configurações" className="flex w-56 shrink-0 flex-col gap-5 overflow-y-auto border-r bg-card px-3 pt-4 pb-3">
        <button type="button" onClick={() => navegar("/")} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px] text-muted-foreground outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeftIcon className="size-4" />
          Sair das configurações
        </button>
        {visiveis.map((g) => (
          <div key={g.id}>
            <p className="px-3 pb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{g.titulo}</p>
            <div className="flex flex-col gap-0.5">
              {g.secoes.map((s) => {
                const aqui = s.id === secao?.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={aqui ? "page" : undefined}
                    onClick={() => navegar(`/configuracoes/${s.id}`)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap outline-none transition-colors",
                      "[&_svg]:size-4 [&_svg]:shrink-0 focus-visible:ring-2 focus-visible:ring-ring",
                      aqui ? "bg-primary/[0.12] font-medium text-foreground [&_svg]:text-primary-text" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <s.icon strokeWidth={1.7} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </aside>
      <section className="relative min-w-0 flex-1">
        {!secao ? (
          pedida && GRUPOS.some((g) => g.secoes.some((s) => s.id === pedida)) ? <AcessoRestrito /> : null
        ) : secao.id === "usuarios" ? (
          <UsuariosView abrirProprio={partes[2] === "eu"} />
        ) : secao.id === "perfis" ? (
          <PerfisAcessoView />
        ) : secao.id === "geral" ? (
          <Geral />
        ) : secao.id === "aparencia" ? (
          <Aparencia />
        ) : (
          <HistoricoSistema />
        )}
      </section>
    </div>
  );
}

/** Título e linha de apoio no alto de cada seção. */
export function TopoSecao({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-3 border-b px-5 py-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold tracking-[-0.011em]">{titulo}</h1>
        {texto && <p className="text-sm text-muted-foreground">{texto}</p>}
      </div>
      {acao}
    </header>
  );
}

function SeletorTema() {
  const tema = usePreferencias((s) => s.tema);
  const setTema = usePreferencias((s) => s.setTema);
  return (
    <Segmented<Tema>
      label="Tema"
      value={tema}
      onChange={setTema}
      className="w-full max-w-md [&>button]:h-9 [&>button]:flex-1 [&>button]:text-sm"
      options={[
        { value: "light", label: "Claro", icon: <SunIcon /> },
        { value: "dark", label: "Escuro", icon: <MoonIcon /> },
        { value: "system", label: "Sistema", icon: <MonitorIcon /> },
      ]}
    />
  );
}

function Aparencia() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex w-full flex-col">
        <TopoSecao titulo="Aparência" texto="Vale só neste navegador." />
        <FormSection title="Tema" columns={1}>
          <FormField label="Cores da tela">
            <SeletorTema />
          </FormField>
        </FormSection>
      </div>
    </div>
  );
}

function HistoricoSistema() {
  const historico = useQuery({ queryKey: ["historico-geral"], queryFn: () => api<{ historico: Historico[] }>("/historico") });
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex w-full max-w-5xl flex-col">
        <TopoSecao titulo="Histórico" texto="As últimas 300 ações no sistema: quem fez, quando e onde." />
        <FormSection title="Últimas ações" bodyClassName="">
          {historico.isPending ? <Carregando compact /> : <ListaHistorico itens={historico.data?.historico ?? []} mostrarOnde />}
        </FormSection>
      </div>
    </div>
  );
}

interface DadosConfig {
  configuracoes: Configuracoes;
  endereco_efetivo: string;
  formatos: { chave: string; nome: string; extensoes: string[] }[];
}

/** Regras do sistema: empresa, link do cliente, arquivos aceitos e vencimento. */
function Geral() {
  const qc = useQueryClient();
  const { data: sessao } = useSessao();
  const podeEditar = pode(sessao?.usuario, "configuracoes", "editar");
  const consulta = useQuery({ queryKey: ["configuracoes"], queryFn: () => api<DadosConfig>("/configuracoes") });
  const [form, setForm] = useState<Configuracoes | null>(null);
  useEffect(() => {
    if (consulta.data && !form) setForm(consulta.data.configuracoes);
  }, [consulta.data, form]);

  const salvar = useMutation({
    mutationFn: () => api("/configuracoes", { metodo: "PUT", corpo: form }),
    onSuccess: async () => {
      toast.success("Configuração salva.");
      setForm(null);
      await qc.invalidateQueries({ queryKey: ["configuracoes"] });
      await qc.invalidateQueries({ queryKey: ["sessao"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (consulta.isPending || !form) return <Carregando />;
  const d = consulta.data!;
  const campo = (k: keyof Configuracoes) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));
  const mudou = JSON.stringify(form) !== JSON.stringify(d.configuracoes);

  return (
    <div className="h-full overflow-y-auto">
      <form
        className="flex w-full max-w-5xl flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        <TopoSecao
          titulo="Geral"
          texto="Empresa, link do cliente, arquivos aceitos e vencimento dos documentos."
          acao={
            podeEditar && (
              <div className="flex gap-2">
                <Button type="button" variant="secondary" disabled={!mudou || salvar.isPending} onClick={() => setForm(d.configuracoes)}>
                  Desfazer
                </Button>
                <Button type="submit" disabled={!mudou || salvar.isPending}>
                  {salvar.isPending && <Spinner data-icon="inline-start" />}
                  Salvar
                </Button>
              </div>
            )
          }
        />

        <FormSection title="Empresa" columns={2}>
          <FormField label="Nome da empresa" htmlFor="cf-empresa" required help="Aparece para o cliente no link e nas mensagens.">
            <Input id="cf-empresa" value={form.empresa_nome} onChange={campo("empresa_nome")} disabled={!podeEditar} maxLength={80} />
          </FormField>
        </FormSection>


        <FormSection title="Link para o cliente" columns={2}>
          <FormField label="O link vale por (dias)" htmlFor="cf-validade">
            <Input id="cf-validade" type="number" min={1} max={90} value={form.link_validade_dias} onChange={campo("link_validade_dias")} disabled={!podeEditar} />
          </FormField>
          <FormField label="Tamanho máximo por arquivo (MB)" htmlFor="cf-tamanho">
            <Input id="cf-tamanho" type="number" min={1} max={200} value={form.tamanho_maximo_mb} onChange={campo("tamanho_maximo_mb")} disabled={!podeEditar} />
          </FormField>
          <FormField
            label="Endereço do sistema no link"
            htmlFor="cf-endereco"
            span="full"
            help={`Em branco usa ${d.endereco_efetivo}, o endereço do sistema.`}
          >
            <Input id="cf-endereco" value={form.endereco_publico} onChange={campo("endereco_publico")} disabled={!podeEditar} placeholder={d.endereco_efetivo} />
          </FormField>
        </FormSection>

        <FormSection title="Arquivos aceitos no envio" columns={1}>
          <FormField label="Formatos" help="Vale para o envio por dentro do sistema e para o link do cliente. Padrão: PDF, PNG e JPEG.">
            <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
              {d.formatos.map((f) => {
                const lista = form.formatos_aceitos.split(",").filter(Boolean);
                const marcado = lista.includes(f.chave);
                return (
                  <Marcar
                    key={f.chave}
                    checked={marcado}
                    disabled={!podeEditar}
                    onChange={(v) =>
                      setForm((atual) => (atual ? { ...atual, formatos_aceitos: (v ? [...lista, f.chave] : lista.filter((x) => x !== f.chave)).join(",") } : atual))
                    }
                  >
                    <span>
                      {f.nome} <span className="text-xs text-muted-foreground">({f.extensoes.join(", ")})</span>
                    </span>
                  </Marcar>
                );
              })}
            </div>
          </FormField>
        </FormSection>

        <FormSection title="Vencimento dos documentos" columns={2}>
          <FormField label="Avisar quantos dias antes de vencer" htmlFor="cf-aviso" help='O documento aparece como "Vence em breve" nesse prazo.'>
            <Input id="cf-aviso" type="number" min={0} max={365} value={form.aviso_vencimento_dias} onChange={campo("aviso_vencimento_dias")} disabled={!podeEditar} />
          </FormField>
        </FormSection>

        {sessao?.usuario?.admin && <DadosExemplo />}
      </form>
    </div>
  );
}

/** Clientes, documentos e usuários fictícios para ver o sistema cheio. Saem com um clique. */
function DadosExemplo() {
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState(false);
  const estado = useQuery({
    queryKey: ["exemplo"],
    queryFn: () => api<{ existe: boolean; resumo: { clientes: number; operacoes: number; arquivos: number; usuarios: number } }>("/exemplo"),
  });
  const atualizarTudo = async () => {
    await qc.invalidateQueries();
  };
  const criar = useMutation({
    mutationFn: () => api("/exemplo", { corpo: {} }),
    onSuccess: async () => {
      toast.success("Dados de exemplo criados.");
      await atualizarTudo();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remover = useMutation({
    mutationFn: () => api("/exemplo", { metodo: "DELETE" }),
    onSuccess: async () => {
      toast.success("Dados de exemplo apagados, com os arquivos deles.");
      await atualizarTudo();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const r = estado.data?.resumo;
  return (
    <FormSection title="Dados de exemplo" columns={1}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {estado.data?.existe && r
            ? `No sistema agora: ${r.clientes} clientes, ${r.operacoes} operações, ${r.arquivos} arquivos e ${r.usuarios} usuários fictícios. Apagar tira tudo isso, inclusive os arquivos dos clientes de exemplo.`
            : "Cria clientes, operações, documentos, pedidos e usuários fictícios para ver o sistema cheio. Depois dá para apagar tudo com um clique."}
        </p>
        {estado.data?.existe ? (
          <Button type="button" variant="destructive" className="h-9" disabled={remover.isPending} onClick={() => setConfirmar(true)}>
            {remover.isPending && <Spinner data-icon="inline-start" />}
            Apagar dados de exemplo
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-9" disabled={criar.isPending || estado.isPending} onClick={() => criar.mutate()}>
            {criar.isPending && <Spinner data-icon="inline-start" />}
            Criar dados de exemplo
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title="Apagar os dados de exemplo?"
        description="Saem os clientes, operações, documentos, perfis e usuários fictícios, e os arquivos desses clientes. O que você cadastrou continua."
        confirmLabel="Apagar"
        destructive
        onConfirm={() => remover.mutate()}
      />
    </FormSection>
  );
}
