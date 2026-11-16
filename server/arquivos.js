import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { lerConfiguracoes } from './banco.js';
import { nomeSeguro } from './caminhos.js';
import { criarToken } from './seguranca.js';

// Formatos aceitos. A extensão manda no nome final; o tipo vem daqui (não do navegador).
export const FORMATOS = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Os formatos como aparecem em Configurações: cada um com suas extensões.
export const GRUPOS_FORMATO = {
  pdf: { nome: 'PDF', extensoes: ['.pdf'] },
  png: { nome: 'PNG', extensoes: ['.png'] },
  jpeg: { nome: 'JPEG', extensoes: ['.jpg', '.jpeg'] },
  webp: { nome: 'WEBP', extensoes: ['.webp'] },
  word: { nome: 'Word', extensoes: ['.doc', '.docx'] },
  excel: { nome: 'Excel', extensoes: ['.xls', '.xlsx'] },
};

export function formatosAceitos() {
  const lista = String(lerConfiguracoes().formatos_aceitos || 'pdf,png,jpeg')
    .split(',')
    .map((f) => f.trim())
    .filter((f) => GRUPOS_FORMATO[f]);
  return lista.length ? lista : ['pdf', 'png', 'jpeg'];
}

export function extensoesAceitas() {
  return formatosAceitos().flatMap((f) => GRUPOS_FORMATO[f].extensoes);
}

export const nomesFormatos = () => formatosAceitos().map((f) => GRUPOS_FORMATO[f].nome);

// --- Onde os arquivos ficam ---------------------------------------------------------
// Online: bucket privado do Supabase Storage. No teste local: uma pasta do computador.
// O banco guarda o caminho com acentos ("Acme/Operação Santos/Contrato.pdf"); no storage
// ele vira a chave sem acentos ("Acme/Operacao Santos/Contrato.pdf"), que é o que o Supabase aceita.

let guarda = null;

export function configurarArmazenamento(opcoes) {
  guarda = opcoes.tipo === 'supabase' ? guardaSupabase(opcoes) : guardaLocal(opcoes);
}

const g = () => {
  if (!guarda) throw new Error('Armazenamento de arquivos não configurado.');
  return guarda;
};

// Caminhos guardados no banco usam "/".
export const juntar = (...partes) => partes.join('/').split(/[\\/]+/).filter(Boolean).join('/');

// Os caminhos são relativos à raiz dos arquivos: "Cliente/Operação/Documento.pdf".
export function pastaDaOperacao(cliente, operacao) {
  return juntar(cliente.pasta, operacao.pasta);
}

/** "Operação São Paulo/Contrato (2).pdf" -> "Operacao Sao Paulo/Contrato (2).pdf" */
export function chave(relativo) {
  const k = juntar(relativo)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w/!\-.*'() &$@=;:+,]/g, '_');
  if (k.split('/').some((p) => p === '..')) throw new Error('Caminho inválido.');
  return k;
}

// "Contrato social.pdf", e se já existir: "Contrato social (2).pdf".
export async function nomeLivre(pastaRelativa, base, extensao) {
  const usados = new Set((await g().listar(chave(pastaRelativa))).map((n) => n.toLowerCase()));
  let n = 1;
  let nome = `${base}${extensao}`;
  while (usados.has(chave(nome).toLowerCase())) {
    n += 1;
    nome = `${base} (${n})${extensao}`;
  }
  return juntar(pastaRelativa, nome);
}

// Grava o arquivo recebido na pasta da operação, com o nome do documento.
export async function guardarArquivo({ conteudo, tipo, nomeOriginal, pastaRelativa, nomeDocumento, lado }) {
  const extensao = path.extname(nomeOriginal).toLowerCase();
  const base = nomeSeguro([nomeDocumento, lado].filter(Boolean).join(' - '), 'Documento');
  const relativo = await nomeLivre(pastaRelativa, base, extensao);
  await g().salvar(chave(relativo), conteudo, tipo);
  return relativo;
}

// Nome de pasta livre para um cliente/operação: "Cliente", ou "Cliente (2)" se já houver
// outro cadastro com esse nome ou arquivos guardados nessa pasta.
export async function pastaLivre(paiRelativo, nome, ocupadas, atual = null) {
  const base = nomeSeguro(nome);
  const usadas = new Set(ocupadas.map((p) => chave(p).toLowerCase()));
  const livre = async (c) =>
    (atual && chave(c).toLowerCase() === chave(atual).toLowerCase()) ||
    (!usadas.has(chave(c).toLowerCase()) && !(await g().temConteudo(chave(juntar(paiRelativo, c)))));
  let n = 1;
  let candidato = base;
  while (!(await livre(candidato))) {
    n += 1;
    candidato = `${base} (${n})`;
  }
  return candidato;
}

// No storage não existe pasta vazia: criar e apagar pasta não fazem nada.
export async function criarPasta() {}
export async function removerPastaVazia() {}

// Renomear a pasta = mover cada arquivo dela. Devolve o par [antigo, novo] para corrigir o banco.
export async function renomearPasta(antigaRelativa, novaRelativa) {
  const de = chave(antigaRelativa);
  const para = chave(novaRelativa);
  if (de === para) return;
  if (de.toLowerCase() !== para.toLowerCase() && (await g().temConteudo(para))) throw new Error('Já existe uma pasta com esse nome.');
  for (const arquivo of await g().listarTudo(de)) await g().mover(arquivo, para + arquivo.slice(de.length));
}

// Arquivos removidos vão para "_Excluídos" dentro da operação: nada some de verdade.
export async function moverParaExcluidos(relativo, pastaOperacaoRelativa) {
  if (!(await g().existe(chave(relativo)))) return relativo;
  const extensao = path.extname(relativo);
  const base = path.basename(relativo, extensao);
  const destinoRel = await nomeLivre(juntar(pastaOperacaoRelativa, '_Excluídos'), base, extensao);
  await g().mover(chave(relativo), chave(destinoRel));
  return destinoRel;
}

/** Apaga de vez uma pasta inteira (usado só para tirar os dados de exemplo). */
export async function apagarPasta(relativa) {
  const lista = await g().listarTudo(chave(relativa));
  if (lista.length) await g().apagar(lista);
}

/** Grava um arquivo pronto (dados de exemplo). Não sobrescreve. */
export async function gravarArquivo(relativo, conteudo, tipo) {
  await g().salvar(chave(relativo), conteudo, tipo);
}

export async function existeArquivo(relativo) {
  return g().existe(chave(relativo));
}

/** Endereço temporário (5 minutos) para abrir ou baixar o arquivo. */
export async function linkArquivo(relativo, { baixar = false, nome = '' } = {}) {
  return g().link(chave(relativo), { baixar, nome: nome || path.basename(relativo) });
}

// --- Supabase Storage ---------------------------------------------------------------
function guardaSupabase({ url, chaveServico, bucket = 'documentos' }) {
  const base = `${url.replace(/\/+$/, '')}/storage/v1`;
  const cab = { Authorization: `Bearer ${chaveServico}`, apikey: chaveServico };
  const urlObjeto = (k) => k.split('/').map(encodeURIComponent).join('/');
  const pedir = async (caminho, init = {}) => {
    const r = await fetch(`${base}${caminho}`, { ...init, headers: { ...cab, ...(init.headers ?? {}) } });
    if (!r.ok) {
      const corpo = await r.text().catch(() => '');
      const erro = new Error(`Storage ${r.status}: ${corpo.slice(0, 200)}`);
      erro.status = r.status;
      throw erro;
    }
    return r;
  };
  // Itens diretos de uma pasta: arquivos têm id; subpastas vêm com id null.
  const itens = async (prefixo) => {
    const lista = [];
    for (let offset = 0; ; offset += 1000) {
      const r = await pedir(`/object/list/${bucket}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: prefixo ? `${prefixo}/` : '', limit: 1000, offset }),
      });
      const parte = await r.json();
      lista.push(...parte);
      if (parte.length < 1000) return lista;
    }
  };
  const self = {
    async salvar(k, conteudo, tipo) {
      await pedir(`/object/${bucket}/${urlObjeto(k)}`, { method: 'POST', headers: { 'Content-Type': tipo || 'application/octet-stream', 'x-upsert': 'false' }, body: conteudo });
    },
    async listar(prefixo) {
      return (await itens(prefixo)).filter((i) => i.id).map((i) => i.name);
    },
    async listarTudo(prefixo) {
      const saida = [];
      for (const i of await itens(prefixo)) {
        const k = `${prefixo}/${i.name}`;
        if (i.id) saida.push(k);
        else saida.push(...(await self.listarTudo(k)));
      }
      return saida;
    },
    async temConteudo(prefixo) {
      return (await itens(prefixo)).length > 0;
    },
    async existe(k) {
      const pasta = k.includes('/') ? k.slice(0, k.lastIndexOf('/')) : '';
      const nome = k.slice(k.lastIndexOf('/') + 1);
      return (await self.listar(pasta)).includes(nome);
    },
    async mover(de, para) {
      await pedir('/object/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: bucket, sourceKey: de, destinationKey: para }),
      });
    },
    async apagar(chaves) {
      for (let i = 0; i < chaves.length; i += 1000) {
        await pedir(`/object/${bucket}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: chaves.slice(i, i + 1000) }) });
      }
    },
    async ler(k) {
      const r = await pedir(`/object/${bucket}/${urlObjeto(k)}`);
      return new Uint8Array(await r.arrayBuffer());
    },
    async link(k, { baixar, nome }) {
      const r = await pedir(`/object/sign/${bucket}/${urlObjeto(k)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 300 }),
      });
      const { signedURL } = await r.json();
      const sep = signedURL.includes('?') ? '&' : '?';
      return `${base}${signedURL}${baixar ? `${sep}download=${encodeURIComponent(nome)}` : ''}`;
    },
  };
  return self;
}

// --- Pasta local (teste no computador) ------------------------------------------------
function guardaLocal({ pasta, enderecoApi = '/api' }) {
  const abs = (k) => {
    const raiz = path.resolve(pasta);
    const final = path.resolve(raiz, k);
    if (final !== raiz && !final.startsWith(raiz + path.sep)) throw new Error('Caminho fora da pasta de arquivos.');
    return final;
  };
  const existe = (p) => fs.access(p).then(() => true, () => false);
  const self = {
    raiz: pasta,
    async salvar(k, conteudo) {
      await fs.mkdir(path.dirname(abs(k)), { recursive: true });
      await fs.writeFile(abs(k), conteudo, { flag: 'wx' });
    },
    async listar(prefixo) {
      const p = abs(prefixo || '.');
      if (!(await existe(p))) return [];
      return (await fs.readdir(p, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name);
    },
    async listarTudo(prefixo) {
      const p = abs(prefixo);
      if (!(await existe(p))) return [];
      const saida = [];
      for (const e of await fs.readdir(p, { withFileTypes: true })) {
        const k = `${prefixo}/${e.name}`;
        if (e.isFile()) saida.push(k);
        else saida.push(...(await self.listarTudo(k)));
      }
      return saida;
    },
    async temConteudo(prefixo) {
      return (await self.listarTudo(prefixo)).length > 0;
    },
    existe: (k) => existe(abs(k)),
    async mover(de, para) {
      await fs.mkdir(path.dirname(abs(para)), { recursive: true });
      await fs.rename(abs(de), abs(para));
    },
    async apagar(chaves) {
      for (const k of chaves) await fs.rm(abs(k), { force: true });
    },
    ler: (k) => fs.readFile(abs(k)),
    async link(k, { baixar, nome }) {
      const token = criarToken({ k, b: baixar ? 1 : 0, n: nome }, 5 * 60 * 1000);
      return `${enderecoApi}/arquivo-local?t=${encodeURIComponent(token)}`;
    },
  };
  return self;
}

/** Só no teste local: entrega o arquivo de um link gerado por linkArquivo. */
export async function lerArquivoLocal(k) {
  return g().ler(k);
}
