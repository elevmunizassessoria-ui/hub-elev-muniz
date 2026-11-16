import { agora, executar, um } from './banco.js';
import { lerToken } from './seguranca.js';

// O que cada perfil de acesso pode liberar. Níveis: ver < editar < excluir.
export const MODULOS = [
  { chave: 'dashboard', nome: 'Painel', descricao: 'Os números de decisão. Quem não é administrador vê só os dele.' },
  { chave: 'operacoes', nome: 'Operações', descricao: 'Criar e acompanhar operações e mudar de etapa.' },
  { chave: 'clientes', nome: 'Clientes', descricao: 'Cadastro de clientes e a pasta de documentos.' },
  { chave: 'documentos', nome: 'Documentos', descricao: 'A área de documentos: o que falta, vence ou venceu.' },
  { chave: 'solicitacoes', nome: 'Pedidos de documentos', descricao: 'Gerar links para o cliente enviar documentos e acompanhar.' },
  { chave: 'aprovacao', nome: 'Aprovação de documentos', descricao: 'Aprovar ou recusar o que o cliente enviou pelo link.' },
  { chave: 'sla', nome: 'SLA', descricao: 'Prazos por consultor, processo e etapa.' },
  { chave: 'financeiro', nome: 'Financeiro', descricao: 'Receitas e despesas. Quem não é administrador vê só as das operações dele.' },
  { chave: 'credito', nome: 'Crédito', descricao: 'Funil, propostas, simulador, análise, garantias e metas.' },
  { chave: 'instituicoes', nome: 'Parceiros', descricao: 'Bancos e financeiras parceiras, o contato de cada um e os indicadores.' },
    { chave: 'comissoes', nome: 'Comissões', descricao: 'Comissões a receber e repasses.' },
  { chave: 'compliance', nome: 'Compliance', descricao: 'Cadastro, listas restritivas, LGPD e autorização SCR.' },
  { chave: 'cadastro_documentos', nome: 'Predefinições de operação', descricao: 'Etapas, prazos e documentos de cada tipo de operação.' },
  { chave: 'acessos', nome: 'Controle de acessos', descricao: 'Usuários e perfis de acesso.' },
  { chave: 'configuracoes', nome: 'Configurações do sistema', descricao: 'Empresa, pasta dos arquivos, prazos e limites.' },
];

export const NIVEIS = ['ver', 'editar', 'excluir'];
const PESO = { ver: 1, editar: 2, excluir: 3 };


export function lerPermissoes(texto) {
  try {
    const bruto = JSON.parse(texto || '{}');
    const limpo = {};
    for (const { chave } of MODULOS) if (NIVEIS.includes(bruto[chave])) limpo[chave] = bruto[chave];
    return limpo;
  } catch {
    return {};
  }
}

export async function usuarioPublico(u) {
  if (!u) return null;
  const perfil = u.perfil_acesso_id ? await um('select id, nome, permissoes, ativo from perfis_acesso where id = ?', u.perfil_acesso_id) : null;
  const permissoes = u.admin
    ? Object.fromEntries(MODULOS.map((m) => [m.chave, 'excluir']))
    : perfil && perfil.ativo
      ? lerPermissoes(perfil.permissoes)
      : {};
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    admin: !!u.admin,
    ativo: !!u.ativo,
    trocar_senha: !!u.trocar_senha,
    perfil_acesso_id: u.perfil_acesso_id,
    perfil_acesso_nome: u.admin ? 'Administrador' : (perfil?.nome ?? 'Sem perfil'),
    ultimo_acesso_em: u.ultimo_acesso_em,
    criado_em: u.criado_em,
    permissoes,
  };
}

export function pode(usuario, modulo, nivel = 'ver') {
  if (!usuario) return false;
  if (usuario.admin) return true;
  const tem = usuario.permissoes?.[modulo];
  return !!tem && PESO[tem] >= PESO[nivel];
}

// O token da sessão vem no cabeçalho "Authorization: Bearer ..." (a tela e o servidor ficam em endereços diferentes).
function lerTokenDoPedido(req) {
  const cab = req.headers.authorization || '';
  return cab.startsWith('Bearer ') ? cab.slice(7).trim() : null;
}

// Anexa req.usuario quando a sessão é válida e o usuário segue ativo.
export async function carregarSessao(req, _res, next) {
  try {
    const dados = lerToken(lerTokenDoPedido(req));
    if (dados?.uid) {
      const u = await um('select * from usuarios where id = ?', dados.uid);
      // A sessão cai quando a senha muda (versão = fim do hash).
      if (u && u.ativo && u.senha_hash.slice(-12) === dados.v) req.usuario = await usuarioPublico(u);
    }
    next();
  } catch (erro) {
    next(erro);
  }
}

export function exigirLogin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ erro: 'Entre no sistema para continuar.' });
  next();
}

// Regra da casa: só o administrador vê tudo. Os demais veem só as operações em que são o consultor.
export function veOperacao(usuario, operacao) {
  return !!usuario && (usuario.admin || operacao.consultor_id === usuario.id);
}

// Pedaço de SQL para filtrar operações pelo que o usuário pode ver (o alias é da tabela operacoes).
export function filtroOperacoes(usuario, alias = 'o') {
  return usuario.admin ? { sql: '1 = 1', p: [] } : { sql: `${alias}.consultor_id = ?`, p: [usuario.id] };
}

// Basta um dos módulos liberar (a pasta da operação é vista por Operações e por Clientes).
export function exigirUm(modulos, nivel = 'ver') {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Entre no sistema para continuar.' });
    if (!modulos.some((m) => pode(req.usuario, m, nivel))) return res.status(403).json({ erro: 'Seu perfil de acesso não libera esta ação.' });
    next();
  };
}

export function exigirAdmin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ erro: 'Entre no sistema para continuar.' });
  if (!req.usuario.admin) return res.status(403).json({ erro: 'Só o administrador pode fazer isso.' });
  next();
}

export function exigir(modulo, nivel = 'ver') {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Entre no sistema para continuar.' });
    if (!pode(req.usuario, modulo, nivel)) return res.status(403).json({ erro: 'Seu perfil de acesso não libera esta ação.' });
    next();
  };
}

export async function marcarAcesso(id) {
  await executar('update usuarios set ultimo_acesso_em = ? where id = ?', agora(), id);
}
