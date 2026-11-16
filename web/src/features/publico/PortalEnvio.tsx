import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, Clock3Icon, LinkIcon } from "lucide-react";

import { AppLogo } from "@/components/AppMark";
import { Carregando } from "@/components/Carregando";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { BASE_API, ErroApi } from "@/lib/api";
import { ESTADO_NO_PEDIDO } from "@/lib/estados";
import { dataBR, plural } from "@/lib/formato";
import type { ItemPedido } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { EscolherArquivo } from "@/features/operacao/EnviarArquivoDialog";

interface DadosPortal {
  empresa_nome: string;
  cliente_nome: string;
  contato: string;
  operacao_nome: string;
  mensagem: string;
  situacao: string;
  criado_em: string;
  expira_em: string;
  tamanho_maximo_mb: number;
  extensoes: string[];
  formatos: string[];
  itens: ItemPedido[];
}

async function lerPortal(token: string): Promise<DadosPortal> {
  const r = await fetch(`${BASE_API}/publico/${encodeURIComponent(token)}`);
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroApi(r.status, corpo.erro ?? "Não foi possível abrir o link.");
  return corpo as DadosPortal;
}

interface Escolha {
  arquivos: File[];
  frente: File[];
  verso: File[];
  validade: string;
}
const VAZIA: Escolha = { arquivos: [], frente: [], verso: [], validade: "" };

/** O portal do cliente: abre pelo link, sem login, e recebe os documentos pedidos. */
export function PortalEnvio({ token }: { token: string }) {
  const consulta = useQuery({ queryKey: ["portal", token], queryFn: () => lerPortal(token), retry: false });
  const [escolhas, setEscolhas] = useState<Record<number, Escolha>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [site, setSite] = useState("");
  useEffect(() => {
    document.title = "Envio de documentos";
  }, []);

  if (consulta.isPending) {
    return (
      <div className="grid h-full place-items-center bg-background">
        <Carregando compact />
      </div>
    );
  }
  if (consulta.isError) {
    const e = consulta.error as ErroApi;
    return <Aviso titulo={e.status === 410 ? "Este link não vale mais" : "Link inválido"} texto={e.message} />;
  }
  const d = consulta.data;
  const pendentes = d.itens.filter((i) => i.estado === "faltando" || i.estado === "recusado");
  if (pendentes.length === 0) {
    return <Aviso ok titulo="Tudo certo!" texto={`Recebemos todos os documentos pedidos para "${d.operacao_nome}". ${d.empresa_nome} vai conferir e, se precisar de algo, avisa você.`} />;
  }

  const pronto = (i: ItemPedido) => {
    const e = escolhas[i.id];
    if (!e) return false;
    return i.frente_verso ? e.frente.length === 1 && e.verso.length === 1 : e.arquivos.length > 0;
  };
  const prontos = pendentes.filter(pronto);
  const mudar = (id: number, parte: Partial<Escolha>) => setEscolhas((s) => ({ ...s, [id]: { ...(s[id] ?? VAZIA), ...parte } }));

  const enviar = async () => {
    setErro("");
    setEnviando(true);
    try {
      for (const i of prontos) {
        const e = escolhas[i.id];
        const dados = new FormData();
        dados.append("item_id", String(i.id));
        dados.append("site", site);
        if (e.validade) dados.append("validade", e.validade);
        if (i.frente_verso) {
          dados.append("frente", e.frente[0]);
          dados.append("verso", e.verso[0]);
        } else {
          for (const f of e.arquivos) dados.append("arquivos", f);
        }
        const r = await fetch(`${BASE_API}/publico/${encodeURIComponent(token)}/enviar`, { method: "POST", headers: { "x-hub": "1" }, body: dados });
        if (!r.ok) {
          const corpo = await r.json().catch(() => ({}));
          throw new Error(`${i.nome}: ${corpo.erro ?? "não foi possível enviar."}`);
        }
        setEscolhas((s) => {
          const n = { ...s };
          delete n[i.id];
          return n;
        });
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
      await consulta.refetch();
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
        <AppLogo label={d.empresa_nome} className="h-8" />
        <span className="ml-auto text-xs font-semibold tracking-wider text-muted-foreground uppercase">Documentos</span>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-5 pb-32">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.011em]">Olá{d.contato ? `, ${d.contato.split(" ")[0]}` : ""}!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.empresa_nome} pediu documentos de <span className="font-medium text-foreground">{d.cliente_nome}</span> para a operação{" "}
            <span className="font-medium text-foreground">{d.operacao_nome}</span>. Envie cada um abaixo.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Pedido em</p>
            <p className="font-medium">{dataBR(d.criado_em)}</p>
          </div>
          <div className="rounded-xl border bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Envie até</p>
            <p className="font-medium">{dataBR(d.expira_em)}</p>
          </div>
        </div>
        {d.mensagem && (
          <div className="rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-sm">
            <p className="text-xs font-semibold tracking-wide text-primary-text uppercase">Recado</p>
            <p className="mt-1 whitespace-pre-wrap">{d.mensagem}</p>
          </div>
        )}

        {/* Campo escondido contra robôs */}
        <input type="text" name="site" value={site} onChange={(e) => setSite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

        {d.itens.map((i) => {
          const precisa = i.estado === "faltando" || i.estado === "recusado";
          const e = escolhas[i.id] ?? VAZIA;
          const ok = pronto(i);
          return (
            <section key={i.id} className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", ok && "border-emerald-500/40")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {i.nome}
                    {i.frente_verso && <span className="text-sm font-normal text-muted-foreground"> · frente e verso</span>}
                  </p>
                  {i.descricao && <p className="text-xs text-muted-foreground">{i.descricao}</p>}
                </div>
                {ok ? (
                  <StatusPill tone="concluido">Pronto para enviar</StatusPill>
                ) : (
                  <StatusPill tone={i.estado === "em_analise" ? "andamento" : ESTADO_NO_PEDIDO[i.estado].tone}>
                    {i.estado === "em_analise" ? "Enviado, em análise" : i.estado === "faltando" ? "Falta enviar" : ESTADO_NO_PEDIDO[i.estado].label}
                  </StatusPill>
                )}
              </div>
              {i.estado === "recusado" && i.motivo_recusa && (
                <p className="rounded-lg bg-destructive/[0.08] px-3 py-2 text-sm text-destructive">Precisamos de outro arquivo: {i.motivo_recusa}</p>
              )}
              {precisa && (
                <>
                  {i.frente_verso ? (
                    <div className="grid grid-cols-2 gap-3">
                      <EscolherArquivo label="Frente" arquivos={e.frente} onChange={(f) => mudar(i.id, { frente: f })} extensoes={d.extensoes} formatos={d.formatos} />
                      <EscolherArquivo label="Verso" arquivos={e.verso} onChange={(f) => mudar(i.id, { verso: f })} extensoes={d.extensoes} formatos={d.formatos} />
                    </div>
                  ) : (
                    <EscolherArquivo label="Tirar foto ou escolher arquivo" arquivos={e.arquivos} onChange={(f) => mudar(i.id, { arquivos: f })} multiplo extensoes={d.extensoes} formatos={d.formatos} />
                  )}
                  {i.exige_validade && (
                    <label className="flex items-center gap-3 text-sm">
                      <span className="shrink-0 text-muted-foreground">Validade do documento</span>
                      <Input type="date" value={e.validade} onChange={(ev) => mudar(i.id, { validade: ev.target.value })} className="max-w-44" />
                    </label>
                  )}
                </>
              )}
            </section>
          );
        })}
        <p className="text-center text-xs text-muted-foreground">{d.formatos.join(", ")} · até {d.tamanho_maximo_mb} MB por arquivo</p>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2 px-4 py-3">
          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock3Icon className="size-4" />
              {prontos.length} de {plural(pendentes.length, "pronto", "prontos")}
            </span>
            <Button className="ml-auto h-11 px-5 text-base" disabled={prontos.length === 0 || enviando} onClick={() => void enviar()}>
              {enviando && <Spinner data-icon="inline-start" />}
              Enviar documentos
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Aviso({ titulo, texto, ok }: { titulo: string; texto: string; ok?: boolean }) {
  return (
    <div className="grid h-full place-items-center overflow-auto bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center shadow-sm">
        <span className={cn("grid size-12 place-items-center rounded-full [&>svg]:size-6", ok ? "bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
          {ok ? <CheckCircle2Icon /> : <LinkIcon />}
        </span>
        <h1 className="text-lg font-semibold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}
