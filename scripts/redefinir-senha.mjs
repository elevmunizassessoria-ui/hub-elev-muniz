// Esqueceu a senha: cria uma senha provisória. No próximo acesso o sistema pede uma senha nova.
// Precisa da variável de ambiente DATABASE_URL (a conexão com o banco online).
//   node scripts/redefinir-senha.mjs                 (lista os logins)
//   node scripts/redefinir-senha.mjs email@empresa   (gera a provisória e mostra na tela)
import crypto from 'node:crypto';
import { agora, conectarBanco, executar, fecharBanco, todos, um } from '../server/banco.js';
import { gerarHashSenha } from '../server/seguranca.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('\nDefina DATABASE_URL no ambiente antes de rodar este script.\n');
  process.exit(1);
}

const email = String(process.argv[2] ?? '').trim().toLowerCase();
conectarBanco(url);
let codigo = 0;

try {
  if (!email) {
    console.log('\nLogins cadastrados:');
    for (const u of await todos('select nome, email, admin from usuarios where exemplo = 0 order by admin desc, nome')) {
      console.log(`  ${u.email}  (${u.nome}${u.admin ? ', administrador' : ''})`);
    }
    console.log('\nPara criar uma senha provisória: node scripts/redefinir-senha.mjs SEU-EMAIL\n');
  } else {
    const u = await um('select * from usuarios where lower(email) = ?', email);
    if (!u) {
      console.log(`\nNenhum usuário com o e-mail ${email}.\n`);
      codigo = 1;
    } else {
      const letras = 'abcdefghjkmnpqrstuvwxyz';
      const provisoria = `Elev-${crypto.randomInt(1000, 10000)}-${letras[crypto.randomInt(letras.length)]}${letras[crypto.randomInt(letras.length)]}`;
      await executar('update usuarios set senha_hash = ?, trocar_senha = 1, ativo = 1, atualizado_em = ? where id = ?', gerarHashSenha(provisoria), agora(), u.id);

      console.log(`\nLogin:              ${u.email}`);
      console.log(`Senha provisória:   ${provisoria}`);
      console.log('Ao entrar, o sistema pede para você criar uma senha nova.\n');
    }
  }
} finally {
  await fecharBanco();
}
process.exit(codigo);
