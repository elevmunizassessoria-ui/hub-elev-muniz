// Copia o servidor (server/) para dentro da função do Supabase antes de publicar.
//   npm run funcao
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const funcao = path.join(raiz, 'supabase', 'functions', 'hub');
const destino = path.join(funcao, 'server');
fs.rmSync(destino, { recursive: true, force: true });
fs.cpSync(path.join(raiz, 'server'), destino, {
  recursive: true,
  // index.js é a versão que roda no computador (com Postgres local de teste).
  filter: (origem) => path.basename(origem) !== 'index.js' || path.dirname(origem) !== path.join(raiz, 'server'),
});

// O esquema do banco vai junto: a função cria as tabelas na primeira vez que roda.
const migracoes = path.join(raiz, 'supabase', 'migrations');
const esquema = fs
  .readdirSync(migracoes)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => fs.readFileSync(path.join(migracoes, f), 'utf8'))
  .join('\n');
fs.writeFileSync(
  path.join(funcao, 'esquema.js'),
  `// Gerado por scripts/funcao.mjs a partir de supabase/migrations. Não edite.\nexport const ESQUEMA = ${JSON.stringify(esquema)};\n`,
);
console.log(`Servidor copiado para ${path.relative(raiz, destino)}`);
