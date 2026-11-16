// Copia o servidor (server/) para dentro da função do Supabase antes de publicar.
//   npm run funcao
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const destino = path.join(raiz, 'supabase', 'functions', 'hub', 'server');
fs.rmSync(destino, { recursive: true, force: true });
fs.cpSync(path.join(raiz, 'server'), destino, {
  recursive: true,
  // index.js é a versão que roda no computador (com Postgres local de teste).
  filter: (origem) => path.basename(origem) !== 'index.js' || path.dirname(origem) !== path.join(raiz, 'server'),
});
console.log(`Servidor copiado para ${path.relative(raiz, destino)}`);
