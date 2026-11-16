// Leva os dados da versão local (dados/banco.sqlite e a pasta dados/Clientes) para o Supabase.
// Roda uma vez, com o banco do Supabase vazio (só o esquema de supabase/migrations aplicado):
//
//   DATABASE_URL=... SUPABASE_URL=https://<projeto>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/migrar-para-supabase.mjs [pasta-dados]
//
// Os ids continuam os mesmos (os códigos OP00001 etc. não mudam). Os arquivos vão para o bucket
// "documentos" com o mesmo caminho relativo (sem acentos na chave, como o servidor espera).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { chave, configurarArmazenamento, gravarArquivo, FORMATOS } from '../server/arquivos.js';
import { conectarBanco, executar, fecharBanco, todos } from '../server/banco.js';

const faltando = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((v) => !process.env[v]);
if (faltando.length) {
  console.error(`Defina ${faltando.join(', ')} antes de rodar.`);
  process.exit(1);
}

const pastaDados = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..', 'dados'));
const origem = new DatabaseSync(path.join(pastaDados, 'banco.sqlite'), { readOnly: true });
conectarBanco(process.env.DATABASE_URL);
configurarArmazenamento({ tipo: 'supabase', url: process.env.SUPABASE_URL, chaveServico: process.env.SUPABASE_SERVICE_ROLE_KEY });

// Na ordem das chaves estrangeiras.
const TABELAS = [
  'perfis_acesso', 'usuarios', 'configuracoes', 'clientes', 'tipos_documento', 'perfis_documento', 'perfis_documento_itens',
  'modelo_etapas', 'operacoes', 'operacao_itens', 'operacao_etapas', 'solicitacoes', 'documentos', 'historico',
  'etapa_passagens', 'transferencias', 'lancamentos',
];

const jaTem = await todos('select count(*) as n from usuarios');
if (jaTem[0].n > 0) {
  console.error('O banco do Supabase já tem usuários. A migração só roda num banco vazio.');
  process.exit(1);
}

for (const tabela of TABELAS) {
  const colunasDestino = new Set((await todos('select column_name from information_schema.columns where table_schema = ? and table_name = ?', 'public', tabela)).map((c) => c.column_name));
  const linhas = origem.prepare(`select * from ${tabela}`).all();
  for (const l of linhas) {
    const cols = Object.keys(l).filter((c) => colunasDestino.has(c));
    // pasta_arquivos era a pasta do computador: online não existe.
    if (tabela === 'configuracoes' && l.chave === 'pasta_arquivos') continue;
    await executar(
      `insert into ${tabela} (${cols.join(', ')}) overriding system value values (${cols.map(() => '?').join(', ')})${tabela === 'configuracoes' ? ' on conflict (chave) do nothing' : ''}`,
      ...cols.map((c) => l[c]),
    );
  }
  if (colunasDestino.has('id')) {
    await executar(`select setval(pg_get_serial_sequence('${tabela}', 'id'), coalesce((select max(id) from ${tabela}), 0) + 1, false) as id`);
  }
  console.log(`${tabela}: ${linhas.length}`);
}

// Arquivos: a pasta configurada na versão local, ou a padrão.
const config = Object.fromEntries(origem.prepare('select chave, valor from configuracoes').all().map((c) => [c.chave, c.valor]));
const raizArquivos = config.pasta_arquivos?.trim() || path.join(pastaDados, 'Clientes');
let enviados = 0;
async function enviarPasta(abs, rel) {
  if (!fs.existsSync(abs)) return;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const filhoAbs = path.join(abs, e.name);
    const filhoRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) await enviarPasta(filhoAbs, filhoRel);
    else {
      await gravarArquivo(filhoRel, fs.readFileSync(filhoAbs), FORMATOS[path.extname(e.name).toLowerCase()] ?? 'application/octet-stream');
      enviados += 1;
      if (enviados % 25 === 0) console.log(`  arquivos enviados: ${enviados}`);
    }
  }
}
await enviarPasta(raizArquivos, '');
console.log(`arquivos: ${enviados} (ex.: ${chave('Operação São Paulo/Contrato.pdf')})`);

origem.close();
await fecharBanco();
console.log('\nPronto. Confira entrando no sistema online com o mesmo e-mail e senha.');
