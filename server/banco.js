import { AsyncLocalStorage } from 'node:async_hooks';
import postgres from 'postgres';

// O banco é Postgres (Supabase online; PGlite no teste local). O esquema está em supabase/migrations.
// A API é a mesma da versão SQLite, só que assíncrona: sempre use await.

let sql = null;
const transacao = new AsyncLocalStorage();

export function conectarBanco(url, opcoes = {}) {
  sql = postgres(url, {
    max: 5,
    idle_timeout: 20,
    prepare: false, // o pooler do Supabase (modo transação) não aceita comandos preparados
    onnotice: () => {},
    // id, count(*) e somas vêm como bigint: no sistema são números comuns.
    // Somas e médias vêm como numeric (texto): também viram número.
    types: {
      bigint: { to: 20, from: [20], parse: (v) => Number(v), serialize: (v) => String(v) },
      numeric: { to: 1700, from: [1700], parse: (v) => Number(v), serialize: (v) => String(v) },
    },
    ...opcoes,
  });
  return sql;
}

export async function fecharBanco() {
  await sql?.end({ timeout: 5 });
  sql = null;
}

export const agora = () => new Date().toISOString();

// "where id = ? and x = ?" vira "where id = $1 and x = $2" (sem mexer no que está entre aspas).
function numerar(texto) {
  let n = 0;
  let saida = '';
  let aspas = null;
  for (const c of texto) {
    if (aspas) {
      if (c === aspas) aspas = null;
    } else if (c === "'" || c === '"') aspas = c;
    else if (c === '?') {
      saida += `$${++n}`;
      continue;
    }
    saida += c;
  }
  return saida;
}

const conexao = () => {
  const atual = transacao.getStore() ?? sql;
  if (!atual) throw new Error('Banco não conectado.');
  return atual;
};

async function consultar(texto, params) {
  const valores = params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  return conexao().unsafe(numerar(texto), valores);
}

export async function um(texto, ...params) {
  const linhas = await consultar(texto, params);
  return linhas[0] ? { ...linhas[0] } : undefined;
}

export async function todos(texto, ...params) {
  const linhas = await consultar(texto, params);
  return linhas.map((l) => ({ ...l }));
}

// Como no SQLite: devolve { lastInsertRowid, changes }. Insert sem "returning" ganha "returning id".
export async function executar(texto, ...params) {
  let final = texto.trim().replace(/;$/, '');
  const insere = /^insert\s+into\s+(\w+)/i.exec(final);
  if (insere && insere[1].toLowerCase() !== 'configuracoes' && !/\breturning\b/i.test(final)) final += ' returning id';
  const linhas = await consultar(final, params);
  return { lastInsertRowid: linhas[0]?.id ?? null, changes: linhas.count ?? linhas.length };
}

// Tudo dentro de fn usa a mesma transação; se der erro, nada fica gravado.
export async function emTransacao(fn) {
  if (transacao.getStore()) return fn();
  return sql.begin((tx) => transacao.run(tx, fn));
}

export async function registrarHistorico({ usuario = '', acao, cliente_id = null, operacao_id = null, detalhe = '' }) {
  await executar(
    'insert into historico (quando, usuario, acao, cliente_id, operacao_id, detalhe) values (?, ?, ?, ?, ?, ?)',
    agora(), usuario, acao, cliente_id, operacao_id, detalhe,
  );
}

export const CONFIG_PADRAO = {
  empresa_nome: 'Elev Muniz',
  link_validade_dias: '7',
  aviso_vencimento_dias: '30',
  tamanho_maximo_mb: '20',
  endereco_publico: '',
  // Formatos que o envio aceita (Configurações › Geral). Padrão: PDF, PNG e JPEG.
  formatos_aceitos: 'pdf,png,jpeg',
};

// As configurações são lidas no começo de cada pedido (carregarConfiguracoes) e ficam à mão sem await.
let configuracoes = { ...CONFIG_PADRAO };

export async function carregarConfiguracoes() {
  const valores = { ...CONFIG_PADRAO };
  for (const { chave, valor } of await todos('select chave, valor from configuracoes')) valores[chave] = valor;
  configuracoes = valores;
  return valores;
}

export const lerConfiguracoes = () => configuracoes;

export async function gravarConfiguracao(chave, valor) {
  await executar(
    'insert into configuracoes (chave, valor) values (?, ?) on conflict (chave) do update set valor = excluded.valor',
    chave, String(valor),
  );
  configuracoes = { ...configuracoes, [chave]: String(valor) };
}

// As migrações (supabase/migrations, em ordem): cada uma roda uma única vez, anotada em _migracoes.
// Online é a própria função que aplica; no computador, o servidor local. A trava evita duas ao mesmo tempo.
// migracoes: [{ nome, sql }]
export async function garantirEsquema(migracoes) {
  const lista = Array.isArray(migracoes) ? migracoes : [{ nome: '20261116000001_esquema_inicial', sql: migracoes }];
  const feitas = async (q) => {
    if (!(await q("select to_regclass('public._migracoes') as t"))[0]?.t) return null;
    return new Set((await q('select nome from _migracoes')).map((l) => l.nome));
  };
  const ja = await feitas((t) => sql.unsafe(t));
  if (ja && lista.every((m) => ja.has(m.nome))) return false;
  await sql.begin(async (tx) => {
    await tx.unsafe('select pg_advisory_xact_lock(481516)');
    await tx.unsafe('create table if not exists _migracoes (nome text primary key, aplicada_em text not null)');
    await tx.unsafe('alter table _migracoes enable row level security');
    const aplicadas = await feitas((t) => tx.unsafe(t));
    // Banco criado antes desta anotação (só o esquema inicial, sem _migracoes): a primeira já está feita.
    if (aplicadas.size === 0 && (await tx.unsafe("select to_regclass('public.usuarios') as t"))[0]?.t) {
      await tx.unsafe('insert into _migracoes (nome, aplicada_em) values ($1, $2)', [lista[0].nome, agora()]);
      aplicadas.add(lista[0].nome);
    }
    for (const m of lista) {
      if (aplicadas.has(m.nome)) continue;
      await tx.unsafe(m.sql);
      await tx.unsafe('insert into _migracoes (nome, aplicada_em) values ($1, $2)', [m.nome, agora()]);
    }
  });
  return true;
}

// Primeiro uso: configurações padrão e os perfis de acesso de partida.
export async function semear() {
  const t = agora();
  for (const [chave, valor] of Object.entries(CONFIG_PADRAO)) {
    await executar('insert into configuracoes (chave, valor) values (?, ?) on conflict (chave) do nothing', chave, valor);
  }
  if (!(await um('select id from perfis_acesso limit 1'))) {
    const perfis = [
      ['Consultor', 'Cuida das próprias operações. O financeiro fica desligado até o administrador liberar.', { dashboard: 'ver', operacoes: 'editar', clientes: 'editar', documentos: 'editar', solicitacoes: 'editar', aprovacao: 'editar', sla: 'ver' }],
      ['Gestor de documentos', 'Cuida de clientes, pedidos e aprovação.', { dashboard: 'ver', operacoes: 'excluir', clientes: 'excluir', documentos: 'excluir', solicitacoes: 'editar', aprovacao: 'editar', sla: 'ver', cadastro_documentos: 'editar' }],
      ['Consulta', 'Só vê clientes e documentos.', { dashboard: 'ver', operacoes: 'ver', clientes: 'ver', documentos: 'ver', solicitacoes: 'ver', aprovacao: 'ver', sla: 'ver', cadastro_documentos: 'ver' }],
    ];
    for (const [nome, descricao, permissoes] of perfis) {
      await executar(
        'insert into perfis_acesso (nome, descricao, permissoes, criado_em, atualizado_em) values (?, ?, ?, ?, ?)',
        nome, descricao, JSON.stringify(permissoes), t, t,
      );
    }
  }
}
