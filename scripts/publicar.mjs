// Publica o servidor do Hub no Supabase (função "hub"). Precisa do login: npx supabase login.
//   node scripts/publicar.mjs
// Na primeira vez também cria as variáveis da função (o segredo das sessões é gerado aqui e
// nunca aparece na tela). As tabelas o próprio servidor cria na primeira vez que roda.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJETO = 'puziargokgigjfphxgrl';
const SITE = 'https://elevmunizassessoria-ui.github.io/hub-elev-muniz';
const ORIGENS = 'https://elevmunizassessoria-ui.github.io';
const raiz = path.resolve(import.meta.dirname, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const supabase = (...args) => execFileSync(npx, ['--yes', 'supabase@2.122.0', ...args], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' }); // só argumentos fixos deste script

console.log('1/3 Preparando a função...');
execFileSync(process.execPath, [path.join(raiz, 'scripts', 'funcao.mjs')], { cwd: raiz, stdio: 'inherit' });

console.log('2/3 Conferindo as variáveis da função...');
const existentes = supabase('secrets', 'list', '--project-ref', PROJETO);
const novas = [];
// O segredo só é criado uma vez: trocar derruba todas as sessões abertas.
if (!/\bHUB_SEGREDO\b/.test(existentes)) novas.push(`HUB_SEGREDO=${crypto.randomBytes(48).toString('hex')}`);
if (!/\bHUB_ORIGENS\b/.test(existentes)) novas.push(`HUB_ORIGENS=${ORIGENS}`);
if (!/\bHUB_SITE\b/.test(existentes)) novas.push(`HUB_SITE=${SITE}`);
if (novas.length) {
  const arquivo = path.join(os.tmpdir(), `hub-vars-${process.pid}.env`);
  fs.writeFileSync(arquivo, `${novas.join('\n')}\n`, { mode: 0o600 });
  try {
    supabase('secrets', 'set', '--env-file', arquivo, '--project-ref', PROJETO);
  } finally {
    fs.rmSync(arquivo, { force: true });
  }
  console.log(`   criadas: ${novas.map((v) => v.split('=')[0]).join(', ')}`);
} else {
  console.log('   já existiam.');
}

console.log('3/3 Publicando a função hub...');
console.log(supabase('functions', 'deploy', 'hub', '--project-ref', PROJETO, '--no-verify-jwt', '--use-api'));
console.log(`Pronto. Servidor: https://${PROJETO}.supabase.co/functions/v1/hub/api/sessao`);
console.log(`Site: ${SITE}/`);
