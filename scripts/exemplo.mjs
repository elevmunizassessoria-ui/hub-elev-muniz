// Cria ou apaga os dados de exemplo direto no banco e no armazenamento online (o servidor pode estar ligado).
// Precisa destas variáveis de ambiente: DATABASE_URL, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
//   node scripts/exemplo.mjs criar
//   node scripts/exemplo.mjs remover
import { configurarArmazenamento } from '../server/arquivos.js';
import { carregarConfiguracoes, conectarBanco, fecharBanco } from '../server/banco.js';
import { criarDadosExemplo, removerDadosExemplo } from '../server/exemplo.js';

const acao = process.argv[2];
if (acao !== 'criar' && acao !== 'remover') {
  console.log('Use: node scripts/exemplo.mjs criar | remover');
  process.exit(0);
}

const { DATABASE_URL: url, SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: chaveServico } = process.env;
if (!url || !supabaseUrl || !chaveServico) {
  console.log('Defina DATABASE_URL, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar este script.');
  process.exit(1);
}

conectarBanco(url);
configurarArmazenamento({ tipo: 'supabase', url: supabaseUrl, chaveServico });
try {
  await carregarConfiguracoes();
  if (acao === 'criar') console.log('Dados de exemplo criados:', await criarDadosExemplo());
  else console.log('Dados de exemplo apagados:', await removerDadosExemplo());
} finally {
  await fecharBanco();
}
