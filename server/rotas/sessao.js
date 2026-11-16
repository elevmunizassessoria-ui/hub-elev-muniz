import { Router } from 'express';
import { exigirLogin, marcarAcesso, usuarioPublico } from '../acesso.js';
import { agora, executar, lerConfiguracoes, um } from '../banco.js';
import { emailValido, falha, texto } from '../http.js';
import { conferirSenha, criarToken, gerarHashSenha } from '../seguranca.js';

const rotas = Router();

// Tentativas erradas por IP: 8 por 10 minutos.
const tentativas = new Map();
function conferirTentativas(ip) {
  const t = tentativas.get(ip);
  if (t && t.ate > Date.now() && t.n >= 8) falha(429, 'Muitas tentativas. Espere alguns minutos e tente de novo.');
}
function errou(ip) {
  const t = tentativas.get(ip);
  if (!t || t.ate < Date.now()) tentativas.set(ip, { n: 1, ate: Date.now() + 10 * 60 * 1000 });
  else t.n += 1;
}

export function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8) falha(400, 'A senha precisa ter pelo menos 8 caracteres.');
  if (senha.length > 128) falha(400, 'A senha pode ter no máximo 128 caracteres.');
}

// A sessão não usa cookie: a tela guarda o token e o manda em cada pedido.
async function abrirSessao(usuario) {
  const token = criarToken({ uid: usuario.id, v: usuario.senha_hash.slice(-12) });
  await marcarAcesso(usuario.id);
  return token;
}

rotas.get('/', async (req, res) => {
  const primeiro = !(await um('select id from usuarios limit 1'));
  res.json({ usuario: req.usuario ?? null, primeiro_acesso: primeiro, empresa_nome: lerConfiguracoes().empresa_nome });
});

// Primeiro uso: quem abre o sistema cria o administrador. Só funciona enquanto não há usuários.
rotas.post('/primeiro-acesso', async (req, res) => {
  if (await um('select id from usuarios limit 1')) falha(409, 'O sistema já tem administrador. Entre com seu e-mail.');
  const nome = texto(req.body.nome, { obrigatorio: true, max: 120, nome: 'Nome' });
  const email = texto(req.body.email, { obrigatorio: true, max: 160, nome: 'E-mail' }).toLowerCase();
  if (!emailValido(email)) falha(400, 'E-mail inválido.');
  validarSenha(req.body.senha);
  const t = agora();
  const { lastInsertRowid } = await executar(
    'insert into usuarios (nome, email, senha_hash, admin, criado_em, atualizado_em) values (?, ?, ?, 1, ?, ?)',
    nome, email, gerarHashSenha(req.body.senha), t, t,
  );
  const u = await um('select * from usuarios where id = ?', lastInsertRowid);
  const token = await abrirSessao(u);
  res.json({ usuario: await usuarioPublico(u), token });
});

rotas.post('/entrar', async (req, res) => {
  const ip = req.ip || '';
  conferirTentativas(ip);
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const senha = String(req.body.senha ?? '');
  const u = await um('select * from usuarios where lower(email) = ?', email);
  if (!u || !conferirSenha(senha, u.senha_hash)) {
    errou(ip);
    falha(401, 'E-mail ou senha incorretos.');
  }
  if (!u.ativo) falha(403, 'Seu acesso está bloqueado. Fale com o administrador.');
  tentativas.delete(ip);
  const token = await abrirSessao(u);
  res.json({ usuario: await usuarioPublico(u), token });
});

rotas.post('/sair', (_req, res) => {
  res.json({ ok: true });
});

// Meu perfil: nome e e-mail.
rotas.put('/perfil', exigirLogin, async (req, res) => {
  const nome = texto(req.body.nome, { obrigatorio: true, max: 120, nome: 'Nome' });
  const email = texto(req.body.email, { obrigatorio: true, max: 160, nome: 'E-mail' }).toLowerCase();
  if (!emailValido(email)) falha(400, 'E-mail inválido.');
  if (await um('select id from usuarios where lower(email) = ? and id <> ?', email, req.usuario.id)) falha(409, 'Esse e-mail já é de outro usuário.');
  await executar('update usuarios set nome = ?, email = ?, atualizado_em = ? where id = ?', nome, email, agora(), req.usuario.id);
  res.json({ usuario: await usuarioPublico(await um('select * from usuarios where id = ?', req.usuario.id)) });
});

rotas.put('/senha', exigirLogin, async (req, res) => {
  const u = await um('select * from usuarios where id = ?', req.usuario.id);
  if (!conferirSenha(String(req.body.senha_atual ?? ''), u.senha_hash)) falha(400, 'A senha atual não confere.');
  validarSenha(req.body.nova_senha);
  await executar('update usuarios set senha_hash = ?, trocar_senha = 0, atualizado_em = ? where id = ?', gerarHashSenha(req.body.nova_senha), agora(), u.id);
  // A sessão antiga cai (a versão mudou): devolve um token novo para quem trocou.
  const token = await abrirSessao(await um('select * from usuarios where id = ?', u.id));
  res.json({ ok: true, token });
});

export default rotas;
