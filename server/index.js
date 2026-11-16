// O Hub rodando no computador (teste e desenvolvimento). Online ele roda como função do Supabase
// (supabase/functions/hub), com o mesmo app.js.
//
// Banco: DATABASE_URL (ex.: o Postgres do Supabase); sem ela, um Postgres local de teste (PGlite)
// gravado em dados/pg. Arquivos: pasta dados/Clientes, ou o Storage do Supabase se SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY estiverem definidas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { criarApp } from './app.js';
import { configurarArmazenamento } from './arquivos.js';
import { conectarBanco } from './banco.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pastaDados = process.env.HUB_DADOS || path.join(raiz, 'dados');
const pastaWeb = path.join(raiz, 'web', 'dist');
const porta = Number(process.env.PORT) || 3180;
fs.mkdirSync(pastaDados, { recursive: true });

async function bancoLocal() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const pasta = path.join(pastaDados, 'pg');
  const novo = !fs.existsSync(pasta);
  const db = await PGlite.create(pasta);
  // O que o Supabase já tem: o esquema "storage" com a tabela de buckets. As tabelas o app cria (garantirEsquema).
  if (novo) await db.exec('create schema if not exists storage; create table if not exists storage.buckets (id text primary key, name text, public boolean);');
  const portaBanco = Number(process.env.HUB_PORTA_BANCO) || porta + 1000;
  const servidor = new PGLiteSocketServer({ db, port: portaBanco, host: '127.0.0.1' });
  await servidor.start();
  return `postgres://postgres:postgres@127.0.0.1:${portaBanco}/postgres`;
}

const url = process.env.DATABASE_URL || (await bancoLocal());
// O PGlite atende uma conexão por vez.
conectarBanco(url, process.env.DATABASE_URL ? {} : { max: 1, ssl: false });

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  configurarArmazenamento({ tipo: 'supabase', url: process.env.SUPABASE_URL, chaveServico: process.env.SUPABASE_SERVICE_ROLE_KEY });
} else {
  configurarArmazenamento({ tipo: 'local', pasta: path.join(pastaDados, 'Clientes') });
}

const app = express();
const pastaMigracoes = path.join(raiz, 'supabase', 'migrations');
const migracoes = fs.readdirSync(pastaMigracoes).filter((f) => f.endsWith('.sql')).sort().map((f) => ({ nome: f.replace(/\.sql$/, ''), sql: fs.readFileSync(path.join(pastaMigracoes, f), 'utf8') }));
app.use(criarApp({ origens: [`http://localhost:${porta}`, 'http://localhost:5180'], esquema: migracoes }));

// A tela (depois do "npm run build").
if (fs.existsSync(pastaWeb)) {
  app.use(express.static(pastaWeb, { index: false, maxAge: '1h' }));
  app.get('/{*resto}', (_req, res) => res.sendFile(path.join(pastaWeb, 'index.html')));
}

const host = process.env.HUB_HOST || '127.0.0.1';
app.listen(porta, host, () => {
  console.log(`\nHub Elev Muniz rodando em http://localhost:${porta}`);
  console.log(`  Banco:    ${process.env.DATABASE_URL ? 'Postgres (DATABASE_URL)' : `Postgres local de teste em ${path.join(pastaDados, 'pg')}`}`);
  console.log(`  Arquivos: ${process.env.SUPABASE_URL ? 'Supabase Storage' : path.join(pastaDados, 'Clientes')}\n`);
});
