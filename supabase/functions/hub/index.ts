// O Hub Elev Muniz online: o mesmo servidor de server/ (copiado para ./server por
// "npm run funcao") rodando como função do Supabase. Endereço: <projeto>.supabase.co/functions/v1/hub/api/...
import { criarApp } from './server/app.js';
import { configurarArmazenamento } from './server/arquivos.js';
import { conectarBanco } from './server/banco.js';
import { ESQUEMA } from './esquema.js';

const env = (nome: string) => {
  const v = Deno.env.get(nome);
  if (!v) throw new Error(`Variável ${nome} não definida na função.`);
  return v;
};

conectarBanco(env('SUPABASE_DB_URL'), { max: 3 });
configurarArmazenamento({ tipo: 'supabase', url: env('SUPABASE_URL'), chaveServico: env('SUPABASE_SERVICE_ROLE_KEY') });

// HUB_ORIGENS: o endereço do site (GitHub Pages, depois o subdomínio), separados por vírgula.
const origens = (Deno.env.get('HUB_ORIGENS') ?? '').split(',').map((o) => o.trim()).filter(Boolean);
const app = criarApp({ origens, prefixos: ['/hub/api', '/api'], esquema: ESQUEMA });

app.listen(Number(Deno.env.get('PORT') ?? 8000));
