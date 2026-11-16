// Copia os usuários e os perfis de acesso do Hub online (Supabase) para a cópia do computador (dados/local),
// para entrar aqui com o mesmo e-mail e a mesma senha. Só lê o online; não muda nada lá.
// Precisa: o servidor local DESLIGADO (o banco local abre um de cada vez) e o login da CLI (npx supabase login).
//   node scripts/copiar-usuarios.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const PROJETO = 'puziargokgigjfphxgrl';
const raiz = path.resolve(import.meta.dirname, '..');
const pastaDados = path.resolve(raiz, process.env.HUB_DADOS || 'dados/local');
const pastaBanco = path.join(pastaDados, 'pg');
if (!fs.existsSync(pastaBanco)) {
  console.error(`Não achei o banco local em ${pastaBanco}. Abra o Hub no computador uma vez antes.`);
  process.exit(1);
}

// A chave de serviço vem da CLI (já logada) e fica só na memória deste script.
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const saida = execFileSync(npx, ['--yes', 'supabase@2.122.0', 'projects', 'api-keys', '--project-ref', PROJETO, '-o', 'json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
  shell: process.platform === 'win32',
});
const chaves = JSON.parse(saida.slice(saida.indexOf('[')));
const servico = chaves.find((k) => k.name === 'service_role' || k.id === 'service_role')?.api_key;
if (!servico) {
  console.error('Não consegui a chave do Supabase. Rode "npx supabase login" e tente de novo.');
  process.exit(1);
}

async function ler(tabela) {
  const r = await fetch(`https://${PROJETO}.supabase.co/rest/v1/${tabela}?select=*&order=id`, { headers: { apikey: servico, Authorization: `Bearer ${servico}` } });
  if (!r.ok) throw new Error(`${tabela}: ${r.status} ${await r.text()}`);
  return r.json();
}

const perfis = await ler('perfis_acesso');
// Só os usuários de verdade: os fictícios (exemplo) nascem junto com os dados de exemplo daqui.
const usuarios = (await ler('usuarios')).filter((u) => !u.exemplo);

const db = await PGlite.create(pastaBanco);
await db.transaction(async (tx) => {
  // Fictícios que vieram numa cópia antiga, sem os dados de exemplo daqui: saem.
  if (!(await tx.query('select 1 from clientes where exemplo = 1 limit 1')).rows.length) await tx.query('delete from usuarios where exemplo = 1');
  const colunas = async (tabela) =>
    new Set((await tx.query('select column_name from information_schema.columns where table_schema = $1 and table_name = $2', ['public', tabela])).rows.map((c) => c.column_name));
  for (const [tabela, linhas] of [['perfis_acesso', perfis], ['usuarios', usuarios]]) {
    const existem = await colunas(tabela);
    for (const l of linhas) {
      const cols = Object.keys(l).filter((c) => existem.has(c));
      // O mesmo e-mail já cadastrado aqui (outra conta criada no computador) sai, para a do online entrar.
      if (tabela === 'usuarios') await tx.query('delete from usuarios where lower(email) = lower($1) and id <> $2', [l.email, l.id]);
      await tx.query(
        `insert into ${tabela} (${cols.join(', ')}) overriding system value values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
         on conflict (id) do update set ${cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`,
        cols.map((c) => l[c]),
      );
    }
    await tx.query(`select setval(pg_get_serial_sequence('${tabela}', 'id'), coalesce((select max(id) from ${tabela}), 0) + 1, false)`);
  }
});
await db.close();
console.log(`Copiados ${usuarios.length} usuários e ${perfis.length} perfis de acesso. Religue o Hub e entre com o mesmo e-mail e senha do online.`);
