import { Router } from 'express';
import { MODULOS, NIVEIS, exigir, exigirLogin, lerPermissoes, pode, usuarioPublico } from '../acesso.js';
import { agora, executar, todos, um } from '../banco.js';
import { bool, emailValido, falha, inteiro, texto } from '../http.js';
import { gerarHashSenha } from '../seguranca.js';
import { validarSenha } from './sessao.js';

const rotas = Router();

rotas.get('/modulos', exigir('acessos'), (_req, res) => res.json({ modulos: MODULOS, niveis: NIVEIS }));

// --- Usuários ---------------------------------------------------------------

// Todos veem a lista de usuários; sem o acesso "Controle de acessos", só a própria linha.
rotas.get('/usuarios', exigirLogin, async (req, res) => {
  const lista = pode(req.usuario, 'acessos')
    ? await todos('select * from usuarios order by admin desc, lower(nome)')
    : await todos('select * from usuarios where id = ?', req.usuario.id);
  const usuarios = [];
  for (const u of lista) usuarios.push(await usuarioPublico(u));
  res.json({ usuarios });
});

async function lerDadosUsuario(req, atual) {
  const nome = texto(req.body.nome, { obrigatorio: true, max: 120, nome: 'Nome' });
  const email = texto(req.body.email, { obrigatorio: true, max: 160, nome: 'E-mail' }).toLowerCase();
  if (!emailValido(email)) falha(400, 'E-mail inválido.');
  if (await um('select id from usuarios where lower(email) = ? and id <> ?', email, atual?.id ?? 0)) falha(409, 'Já existe um usuário com esse e-mail.');
  const admin = bool(req.body.admin);
  const perfil = inteiro(req.body.perfil_acesso_id);
  if (!admin && !perfil) falha(400, 'Escolha o perfil de acesso.');
  if (perfil && !(await um('select id from perfis_acesso where id = ?', perfil))) falha(400, 'Perfil de acesso não encontrado.');
  // Só um administrador cria ou mexe em administradores.
  if ((admin || atual?.admin) && !req.usuario.admin) falha(403, 'Só um administrador pode dar ou tirar acesso de administrador.');
  const ativo = req.body.ativo === undefined ? true : bool(req.body.ativo);
  return { nome, email, admin, perfil: admin ? null : perfil, ativo };
}

async function restaAdminAtivo(semId) {
  return !!(await um('select id from usuarios where admin = 1 and ativo = 1 and id <> ?', semId));
}

rotas.post('/usuarios', exigir('acessos', 'editar'), async (req, res) => {
  const d = await lerDadosUsuario(req, null);
  validarSenha(req.body.senha);
  const t = agora();
  const { lastInsertRowid } = await executar(
    'insert into usuarios (nome, email, senha_hash, admin, perfil_acesso_id, ativo, trocar_senha, criado_em, atualizado_em) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    d.nome, d.email, gerarHashSenha(req.body.senha), d.admin ? 1 : 0, d.perfil, d.ativo ? 1 : 0, bool(req.body.trocar_senha) ? 1 : 0, t, t,
  );
  res.json({ usuario: await usuarioPublico(await um('select * from usuarios where id = ?', lastInsertRowid)) });
});

rotas.put('/usuarios/:id', exigir('acessos', 'editar'), async (req, res) => {
  const atual = await um('select * from usuarios where id = ?', Number(req.params.id));
  if (!atual) falha(404, 'Usuário não encontrado.');
  const d = await lerDadosUsuario(req, atual);
  const proprio = atual.id === req.usuario.id;
  if (proprio && !d.ativo) falha(400, 'Você não pode bloquear o seu próprio acesso.');
  if (proprio && !req.usuario.admin && d.perfil !== atual.perfil_acesso_id) falha(400, 'Você não pode trocar o seu próprio perfil de acesso.');
  if (atual.admin && (!d.admin || !d.ativo) && !(await restaAdminAtivo(atual.id))) falha(400, 'O sistema precisa de pelo menos um administrador ativo.');
  await executar(
    'update usuarios set nome = ?, email = ?, admin = ?, perfil_acesso_id = ?, ativo = ?, atualizado_em = ? where id = ?',
    d.nome, d.email, d.admin ? 1 : 0, d.perfil, d.ativo ? 1 : 0, agora(), atual.id,
  );
  res.json({ usuario: await usuarioPublico(await um('select * from usuarios where id = ?', atual.id)) });
});

// Define uma senha nova; a pessoa troca no próximo acesso.
rotas.put('/usuarios/:id/senha', exigir('acessos', 'editar'), async (req, res) => {
  const atual = await um('select * from usuarios where id = ?', Number(req.params.id));
  if (!atual) falha(404, 'Usuário não encontrado.');
  if (atual.admin && !req.usuario.admin) falha(403, 'Só um administrador pode trocar a senha de outro administrador.');
  validarSenha(req.body.senha);
  await executar('update usuarios set senha_hash = ?, trocar_senha = 1, atualizado_em = ? where id = ?', gerarHashSenha(req.body.senha), agora(), atual.id);
  res.json({ ok: true });
});

rotas.delete('/usuarios/:id', exigir('acessos', 'excluir'), async (req, res) => {
  const atual = await um('select * from usuarios where id = ?', Number(req.params.id));
  if (!atual) falha(404, 'Usuário não encontrado.');
  if (atual.id === req.usuario.id) falha(400, 'Você não pode excluir o seu próprio usuário.');
  if (atual.admin && !req.usuario.admin) falha(403, 'Só um administrador pode excluir outro administrador.');
  if (atual.admin && !(await restaAdminAtivo(atual.id))) falha(400, 'O sistema precisa de pelo menos um administrador ativo.');
  await executar('delete from usuarios where id = ?', atual.id);
  res.json({ ok: true });
});

// --- Perfis de acesso ------------------------------------------------------

async function perfilComUso(p) {
  return {
    ...p,
    ativo: !!p.ativo,
    permissoes: lerPermissoes(p.permissoes),
    usuarios: (await um('select count(*) as n from usuarios where perfil_acesso_id = ?', p.id)).n,
  };
}

rotas.get('/perfis-acesso', exigir('acessos'), async (_req, res) => {
  const perfis = [];
  for (const p of await todos('select * from perfis_acesso order by lower(nome)')) perfis.push(await perfilComUso(p));
  res.json({ perfis });
});

async function lerDadosPerfil(req, id = 0) {
  const nome = texto(req.body.nome, { obrigatorio: true, max: 80, nome: 'Nome' });
  if (await um('select id from perfis_acesso where lower(nome) = lower(?) and id <> ?', nome, id)) falha(409, 'Já existe um perfil com esse nome.');
  const descricao = texto(req.body.descricao, { max: 200, nome: 'Descrição' });
  const permissoes = lerPermissoes(JSON.stringify(req.body.permissoes ?? {}));
  const ativo = req.body.ativo === undefined ? true : bool(req.body.ativo);
  return { nome, descricao, permissoes: JSON.stringify(permissoes), ativo };
}

rotas.post('/perfis-acesso', exigir('acessos', 'editar'), async (req, res) => {
  const d = await lerDadosPerfil(req);
  const t = agora();
  const { lastInsertRowid } = await executar(
    'insert into perfis_acesso (nome, descricao, permissoes, ativo, criado_em, atualizado_em) values (?, ?, ?, ?, ?, ?)',
    d.nome, d.descricao, d.permissoes, d.ativo ? 1 : 0, t, t,
  );
  res.json({ perfil: await perfilComUso(await um('select * from perfis_acesso where id = ?', lastInsertRowid)) });
});

rotas.put('/perfis-acesso/:id', exigir('acessos', 'editar'), async (req, res) => {
  const id = Number(req.params.id);
  if (!(await um('select id from perfis_acesso where id = ?', id))) falha(404, 'Perfil não encontrado.');
  if (!req.usuario.admin && req.usuario.perfil_acesso_id === id) falha(400, 'Você não pode mudar o seu próprio perfil de acesso.');
  const d = await lerDadosPerfil(req, id);
  await executar(
    'update perfis_acesso set nome = ?, descricao = ?, permissoes = ?, ativo = ?, atualizado_em = ? where id = ?',
    d.nome, d.descricao, d.permissoes, d.ativo ? 1 : 0, agora(), id,
  );
  res.json({ perfil: await perfilComUso(await um('select * from perfis_acesso where id = ?', id)) });
});

rotas.delete('/perfis-acesso/:id', exigir('acessos', 'excluir'), async (req, res) => {
  const id = Number(req.params.id);
  const p = await um('select * from perfis_acesso where id = ?', id);
  if (!p) falha(404, 'Perfil não encontrado.');
  if (await um('select id from usuarios where perfil_acesso_id = ? limit 1', id)) falha(409, 'Há usuários com este perfil. Troque o perfil deles antes de excluir.');
  await executar('delete from perfis_acesso where id = ?', id);
  res.json({ ok: true });
});

export default rotas;
