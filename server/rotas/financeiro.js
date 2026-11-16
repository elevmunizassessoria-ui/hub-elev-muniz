import { Router } from 'express';
import { exigir, veOperacao } from '../acesso.js';
import { agora, executar, registrarHistorico, todos, um } from '../banco.js';
import { codigoOperacao } from '../etapas.js';
import { dataOpcional, falha, inteiro, texto } from '../http.js';

const rotas = Router();

const hoje = () => new Date().toISOString().slice(0, 10);
const CODIGO = { receita: 'CR', despesa: 'CP' };

function publico(l) {
  return {
    ...l,
    codigo: `${CODIGO[l.tipo]}${String(l.numero).padStart(5, '0')}`,
    operacao_codigo: l.operacao_id ? codigoOperacao(l.operacao_id) : '',
    situacao: l.pago_em ? 'pago' : l.vencimento < hoje() ? 'atrasado' : 'aberto',
  };
}

// Só o administrador vê tudo. Os demais veem o que está ligado às operações deles.
export async function lancamentosVisiveis(usuario, onde = '1 = 1', ...p) {
  const escopo = usuario.admin ? '1 = 1' : 'o.consultor_id = ?';
  return (await todos(
    `select l.*, c.nome as cliente_nome, o.nome as operacao_nome, u.nome as consultor_nome
       from lancamentos l
       left join operacoes o on o.id = l.operacao_id
       left join clientes c on c.id = coalesce(l.cliente_id, o.cliente_id)
       left join usuarios u on u.id = o.consultor_id
      where l.excluido_em is null and ${escopo} and ${onde}
      order by l.vencimento desc, l.id desc`,
    ...(usuario.admin ? [] : [usuario.id]),
    ...p,
  )).map(publico);
}

async function carregar(id, usuario) {
  const l = (await lancamentosVisiveis(usuario, 'l.id = ?', Number(id)))[0];
  if (!l) falha(404, 'Lançamento não encontrado.');
  return l;
}

async function ler(req) {
  const valor = Math.round(Number(req.body.valor_centavos));
  if (!Number.isInteger(valor) || valor <= 0) falha(400, 'Valor: informe um valor maior que zero.');
  const vencimento = dataOpcional(req.body.vencimento, 'Vencimento');
  if (!vencimento) falha(400, 'Vencimento: informe a data.');
  const operacaoId = inteiro(req.body.operacao_id);
  const operacao = operacaoId ? await um('select * from operacoes where id = ?', operacaoId) : null;
  if (operacaoId && (!operacao || !veOperacao(req.usuario, operacao))) falha(400, 'Operação não encontrada.');
  if (!req.usuario.admin && !operacao) falha(400, 'Escolha uma das suas operações.');
  const clienteId = operacao?.cliente_id ?? inteiro(req.body.cliente_id);
  if (clienteId && !(await um('select id from clientes where id = ?', clienteId))) falha(400, 'Cliente não encontrado.');
  return {
    descricao: texto(req.body.descricao, { obrigatorio: true, max: 160, nome: 'Descrição' }),
    categoria: texto(req.body.categoria, { max: 60, nome: 'Categoria' }),
    observacao: texto(req.body.observacao, { max: 500, nome: 'Observação' }),
    valor,
    vencimento,
    pago_em: dataOpcional(req.body.pago_em, 'Pagamento'),
    operacaoId,
    clienteId: clienteId ?? null,
  };
}

rotas.get('/financeiro/lancamentos', exigir('financeiro'), async (req, res) => {
  const mes = /^\d{4}-\d{2}$/.test(String(req.query.mes)) ? String(req.query.mes) : null;
  const lista = mes ? await lancamentosVisiveis(req.usuario, "substr(l.vencimento, 1, 7) = ?", mes) : await lancamentosVisiveis(req.usuario);
  res.json({ lancamentos: lista, categorias: [...new Set((await lancamentosVisiveis(req.usuario)).map((l) => l.categoria).filter(Boolean))].sort() });
});

rotas.post('/financeiro/lancamentos', exigir('financeiro', 'editar'), async (req, res) => {
  const tipo = req.body.tipo === 'despesa' ? 'despesa' : 'receita';
  const d = await ler(req);
  const numero = ((await um('select max(numero) as m from lancamentos where tipo = ?', tipo))?.m ?? 0) + 1;
  const t = agora();
  const { lastInsertRowid } = await executar(
    `insert into lancamentos (tipo, numero, descricao, categoria, valor_centavos, vencimento, pago_em, cliente_id, operacao_id, observacao, criado_por, criado_por_id, criado_em, atualizado_em)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    tipo, numero, d.descricao, d.categoria, d.valor, d.vencimento, d.pago_em, d.clienteId, d.operacaoId, d.observacao, req.usuario.nome, req.usuario.id, t, t,
  );
  await registrarHistorico({ usuario: req.usuario.nome, acao: tipo === 'receita' ? 'Receita lançada' : 'Despesa lançada', cliente_id: d.clienteId, operacao_id: d.operacaoId, detalhe: d.descricao });
  res.json({ lancamento: await carregar(lastInsertRowid, req.usuario) });
});

rotas.put('/financeiro/lancamentos/:id', exigir('financeiro', 'editar'), async (req, res) => {
  const l = await carregar(req.params.id, req.usuario);
  const d = await ler(req);
  await executar(
    'update lancamentos set descricao = ?, categoria = ?, valor_centavos = ?, vencimento = ?, pago_em = ?, cliente_id = ?, operacao_id = ?, observacao = ?, atualizado_em = ? where id = ?',
    d.descricao, d.categoria, d.valor, d.vencimento, d.pago_em, d.clienteId, d.operacaoId, d.observacao, agora(), l.id,
  );
  res.json({ lancamento: await carregar(l.id, req.usuario) });
});

// Pagar/receber (ou retornar, com pago_em vazio).
rotas.post('/financeiro/lancamentos/:id/pagar', exigir('financeiro', 'editar'), async (req, res) => {
  const l = await carregar(req.params.id, req.usuario);
  await executar('update lancamentos set pago_em = ?, atualizado_em = ? where id = ?', dataOpcional(req.body.pago_em, 'Pagamento'), agora(), l.id);
  res.json({ lancamento: await carregar(l.id, req.usuario) });
});

rotas.delete('/financeiro/lancamentos/:id', exigir('financeiro', 'excluir'), async (req, res) => {
  const l = await carregar(req.params.id, req.usuario);
  await executar('update lancamentos set excluido_em = ? where id = ?', agora(), l.id);
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Lançamento excluído', cliente_id: l.cliente_id, operacao_id: l.operacao_id, detalhe: `${l.codigo} ${l.descricao}` });
  res.json({ ok: true });
});

export default rotas;
