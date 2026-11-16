/** Chamadas ao servidor. Erros viram `Error` com a mensagem do servidor, pronta para a tela. */

/** Onde está o servidor: VITE_API no build online (função do Supabase); "/api" no computador. */
export const BASE_API = (import.meta.env.VITE_API as string | undefined)?.replace(/\/+$/, "") || "/api";

// A sessão: o servidor devolve um token ao entrar; ele vai em cada pedido.
const CHAVE_TOKEN = "hub_sessao";

function lerToken(): string | null {
  try {
    return localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token: string | null) {
  try {
    if (token) localStorage.setItem(CHAVE_TOKEN, token);
    else localStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* navegador sem armazenamento: a sessão dura só esta página */
  }
}

export class ErroApi extends Error {
  status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

async function tratar<T>(resposta: Response): Promise<T> {
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new ErroApi(resposta.status, (corpo as { erro?: string }).erro ?? "Não foi possível falar com o servidor.");
  // Entrar, primeiro acesso e troca de senha devolvem a sessão nova.
  const token = (corpo as { token?: unknown }).token;
  if (typeof token === "string") guardarToken(token);
  return corpo as T;
}

function cabecalhos(json: boolean): Record<string, string> {
  const token = lerToken();
  return { "x-hub": "1", ...(json ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const SEM_SERVIDOR = "Não foi possível falar com o servidor. Confira a internet e tente de novo.";

export async function api<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const metodo = opcoes.metodo ?? (opcoes.corpo === undefined ? "GET" : "POST");
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_API}${caminho}`, {
      method: metodo,
      headers: cabecalhos(opcoes.corpo !== undefined),
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    });
  } catch {
    throw new ErroApi(0, SEM_SERVIDOR);
  }
  return tratar<T>(resposta);
}

/** Envio de arquivos (multipart). */
export async function enviarArquivos<T>(caminho: string, dados: FormData): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_API}${caminho}`, { method: "POST", headers: cabecalhos(false), body: dados });
  } catch {
    throw new ErroApi(0, SEM_SERVIDOR);
  }
  return tratar<T>(resposta);
}

/**
 * Abre (ou baixa) um arquivo: o servidor devolve um link que vale 5 minutos.
 * A aba abre antes da resposta para o navegador não bloquear como pop-up.
 */
export async function abrirArquivo(id: number, baixar = false) {
  const aba = baixar ? null : window.open("about:blank", "_blank");
  try {
    const { url } = await api<{ url: string }>(`/documentos/${id}/arquivo${baixar ? "?baixar=1" : ""}`);
    if (aba) aba.location.href = url;
    else window.location.href = url;
  } catch (e) {
    aba?.close();
    throw e;
  }
}
