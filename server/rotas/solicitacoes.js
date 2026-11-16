import { Router } from 'express';
import { exigir, filtroOperacoes, pode, veOperacao } from '../acesso.js';
import { agora, emTransacao, executar, lerConfiguracoes, registrarHistorico, todos, um } from '../banco.js';
import { falha, inteiro, texto } from '../http.js';
import { gerarCodigoAleatorio } from '../seguranca.js';
import { lerItensSolicitacao, pastaDaOperacao, recalcularSolicitacao, solicitacaoCompleta } from '../regras.js';
import { carregarOperacao } from './clientes.js';

const rotas = Router();

async function carregarPedido(id, usuario) {
  const s = await um('select * from solicitacoes where id = ?', Number(id));
  if (!s || !veOperacao(usuario, await um('select consultor_id from operacoes where id = ?', s.operacao_id))) falha(404, 'Pedido não encontrado.');
  return s;
}

const prazoDias = () => Math.min(Math.max(Number(lerConfiguracoes().link_validade_dias) || 7, 1), 90);
const somarDias = (dias) => new Date(Date.now() + dias * 86_400_000).toISOString();

rotas.get('/solicitacoes', exigir('solicitacoes'), async (req, res) => {
  const abertas = req.query.abertas !== '0';
  const desde = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const f = filtroOperacoes(req.usuario);
  const lista = abertas
    ? await todos(`select s.* from solicitacoes s join operacoes o on o.id = s.operacao_id where s.situacao in ('aguardando', 'em_analise') and ${f.sql} order by s.criado_em desc`, ...f.p)
    : await todos(`select s.* from solicitacoes s join operacoes o on o.id = s.operacao_id where s.criado_em >= ? and ${f.sql} order by s.criado_em desc`, desde, ...f.p);
  const comLink = pode(req.usuario, 'solicitacoes', 'editar');
  res.json({ solicitacoes: await Promise.all(lista.map(async (s) => solicitacaoCompleta(await recalcularSolicitacao(s.id), comLink))) });
});

rotas.get('/solicitacoes/:id', exigir('solicitacoes'), async (req, res) => {
  const s = await carregarPedido(req.params.id, req.usuario);
  res.json({ solicitacao: await solicitacaoCompleta(await recalcularSolicitacao(s.id), pode(req.usuario, 'solicitacoes', 'editar')) });
});

// Pede documentos ao cliente. Se a operação já tem pedido aberto, os itens se somam a ele.
rotas.post('/operacoes/:id/solicitacoes', exigir('solicitacoes', 'editar'), async (req, res) => {
  const { o, c } = await carregarOperacao(req.params.id, req.usuario);
  if (o.situacao !== 'ativa') falha(400, 'A operação está encerrada. Reabra para pedir documentos.');
  const pedidos = Array.isArray(req.body.item_ids) ? [...new Set(req.body.item_ids.map(inteiro).filter(Boolean))] : [];
  if (pedidos.length === 0) falha(400, 'Escolha pelo menos um documento.');
  if (pedidos.length > 80) falha(400, 'No máximo 80 documentos por pedido.');
  const validos = new Set((await pastaDaOperacao(o.id)).itens.map((i) => i.id));
  if (pedidos.some((id) => !validos.has(id))) falha(400, 'Um dos documentos não faz parte desta operação.');
  const mensagem = texto(req.body.mensagem, { max: 500, nome: 'Recado' });
  const aberta = await um("select * from solicitacoes where operacao_id = ? and situacao in ('aguardando', 'em_analise')", o.id);
  const expira = somarDias(prazoDias());
  const id = await emTransacao(async () => {
    if (aberta) {
      const itens = [...new Set([...lerItensSolicitacao(aberta), ...pedidos])];
      await executar(
        "update solicitacoes set itens = ?, mensagem = ?, expira_em = ?, situacao = 'aguardando', atualizado_em = ? where id = ?",
        JSON.stringify(itens), mensagem || aberta.mensagem, expira, agora(), aberta.id,
      );
      return aberta.id;
    }
    const t = agora();
    const { lastInsertRowid } = await executar(
      'insert into solicitacoes (operacao_id, token, itens, mensagem, expira_em, criado_por, criado_em, atualizado_em) values (?, ?, ?, ?, ?, ?, ?, ?)',
      o.id, gerarCodigoAleatorio(24), JSON.stringify(pedidos), mensagem, expira, req.usuario.nome, t, t,
    );
    return lastInsertRowid;
  });
  const s = await recalcularSolicitacao(id);
  await registrarHistorico({
    usuario: req.usuario.nome, acao: aberta ? 'Pedido de documentos ampliado' : 'Documentos pedidos ao cliente',
    cliente_id: c.id, operacao_id: o.id, detalhe: `${pedidos.length} documento${pedidos.length > 1 ? 's' : ''}`,
  });
  res.json({ solicitacao: await solicitacaoCompleta(s, true), acrescentado: !!aberta });
});

// Reenvia: renova o prazo do link.
rotas.post('/solicitacoes/:id/reenviar', exigir('solicitacoes', 'editar'), async (req, res) => {
  const s = await carregarPedido(req.params.id, req.usuario);
  if (s.situacao === 'cancelada' || s.situacao === 'concluida') falha(400, 'Este pedido já foi encerrado.');
  await executar('update solicitacoes set expira_em = ?, atualizado_em = ? where id = ?', somarDias(prazoDias()), agora(), s.id);
  const { c } = await carregarOperacao(s.operacao_id, req.usuario);
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Prazo do link renovado', cliente_id: c.id, operacao_id: s.operacao_id });
  res.json({ solicitacao: await solicitacaoCompleta(await recalcularSolicitacao(s.id), true) });
});

rotas.post('/solicitacoes/:id/cancelar', exigir('solicitacoes', 'editar'), async (req, res) => {
  const s = await carregarPedido(req.params.id, req.usuario);
  if (s.situacao === 'cancelada' || s.situacao === 'concluida') falha(400, 'Este pedido já foi encerrado.');
  await executar("update solicitacoes set situacao = 'cancelada', cancelado_em = ?, cancelado_por = ?, atualizado_em = ? where id = ?", agora(), req.usuario.nome, agora(), s.id);
  const { c } = await carregarOperacao(s.operacao_id, req.usuario);
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Pedido cancelado', cliente_id: c.id, operacao_id: s.operacao_id });
  res.json({ ok: true });
});

export default rotas;
