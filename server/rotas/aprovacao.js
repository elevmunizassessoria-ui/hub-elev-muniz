import { Router } from 'express';
import { exigir, filtroOperacoes, veOperacao } from '../acesso.js';
import { agora, emTransacao, executar, lerConfiguracoes, registrarHistorico, todos, um } from '../banco.js';
import { dataOpcional, falha, texto } from '../http.js';
import { recalcularSolicitacao } from '../regras.js';

const rotas = Router();

// Fila do que chegou pelo link, agrupada por envio (frente e verso juntos).
rotas.get('/aprovacao', exigir('aprovacao'), async (req, res) => {
  const situacao = ['pendente', 'aprovado', 'recusado'].includes(req.query.situacao) ? req.query.situacao : 'pendente';
  const desde = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const f = filtroOperacoes(req.usuario);
  const docs = await todos(
    `select d.*, o.nome as operacao_nome, o.cliente_id, c.nome as cliente_nome, i.exige_validade
       from documentos d
       join operacoes o on o.id = d.operacao_id
       join clientes c on c.id = o.cliente_id
       left join operacao_itens i on i.id = d.item_id
      where d.origem = 'link' and d.excluido_em is null and d.situacao = ? and ${f.sql}
        ${situacao === 'pendente' ? '' : 'and coalesce(d.analisado_em, d.criado_em) >= ?'}
      order by d.criado_em ${situacao === 'pendente' ? 'asc' : 'desc'}, d.id`,
    ...(situacao === 'pendente' ? [situacao, ...f.p] : [situacao, ...f.p, desde]),
  );
  const envios = new Map();
  for (const d of docs) {
    if (!envios.has(d.envio_id)) {
      envios.set(d.envio_id, {
        envio_id: d.envio_id,
        operacao_id: d.operacao_id,
        operacao_nome: d.operacao_nome,
        cliente_id: d.cliente_id,
        cliente_nome: d.cliente_nome,
        item_id: d.item_id,
        item_nome: d.item_nome,
        exige_validade: !!d.exige_validade,
        situacao: d.situacao,
        validade: d.validade,
        criado_em: d.criado_em,
        analisado_por: d.analisado_por,
        analisado_em: d.analisado_em,
        motivo_recusa: d.motivo_recusa,
        arquivos: [],
      });
    }
    envios.get(d.envio_id).arquivos.push({ id: d.id, arquivo_nome: d.arquivo_nome, arquivo_tipo: d.arquivo_tipo, arquivo_tamanho: d.arquivo_tamanho, lado: d.lado });
  }
  res.json({ envios: [...envios.values()] });
});

rotas.get('/aprovacao/contagem', exigir('aprovacao'), async (req, res) => {
  const f = filtroOperacoes(req.usuario);
  const n = (await um(`select count(distinct d.envio_id) as n from documentos d join operacoes o on o.id = d.operacao_id where d.origem = 'link' and d.situacao = 'pendente' and d.excluido_em is null and ${f.sql}`, ...f.p)).n;
  res.json({ pendentes: n });
});

rotas.post('/aprovacao/:envio', exigir('aprovacao', 'editar'), async (req, res) => {
  const docs = await todos("select * from documentos where envio_id = ? and excluido_em is null and origem = 'link'", String(req.params.envio));
  if (docs.length === 0) falha(404, 'Envio não encontrado.');
  if (docs.every((d) => d.situacao !== 'pendente')) falha(409, 'Este envio já foi analisado.');
  const acao = req.body.acao === 'recusar' ? 'recusar' : 'aprovar';
  const operacao = await um('select * from operacoes where id = ?', docs[0].operacao_id);
  if (!veOperacao(req.usuario, operacao)) falha(404, 'Envio não encontrado.');
  const item = docs[0].item_id ? await um('select * from operacao_itens where id = ?', docs[0].item_id) : null;
  const t = agora();
  if (acao === 'aprovar') {
    const validade = req.body.validade === undefined ? docs[0].validade : dataOpcional(req.body.validade, 'Vence em');
    if (item?.exige_validade && !validade) falha(400, 'Este documento tem validade: informe "Vence em" antes de aprovar.');
    await executar(
      "update documentos set situacao = 'aprovado', validade = ?, motivo_recusa = '', analisado_por = ?, analisado_em = ? where envio_id = ?",
      validade, req.usuario.nome, t, req.params.envio,
    );
  } else {
    const motivo = texto(req.body.motivo, { obrigatorio: true, max: 300, nome: 'Motivo' });
    if (motivo.length < 3) falha(400, 'Explique o motivo em poucas palavras (o cliente vê este texto).');
    await emTransacao(async () => {
      await executar(
        "update documentos set situacao = 'recusado', motivo_recusa = ?, analisado_por = ?, analisado_em = ? where envio_id = ?",
        motivo, req.usuario.nome, t, req.params.envio,
      );
      // O link volta a aceitar esse documento, com prazo novo.
      if (docs[0].solicitacao_id) {
        const dias = Math.min(Math.max(Number(lerConfiguracoes().link_validade_dias) || 7, 1), 90);
        await executar(
          "update solicitacoes set situacao = 'aguardando', expira_em = greatest(expira_em, ?::text), atualizado_em = ? where id = ? and situacao in ('aguardando', 'em_analise')",
          new Date(Date.now() + dias * 86_400_000).toISOString(), t, docs[0].solicitacao_id,
        );
      }
    });
  }
  if (docs[0].solicitacao_id) await recalcularSolicitacao(docs[0].solicitacao_id);
  await registrarHistorico({
    usuario: req.usuario.nome,
    acao: acao === 'aprovar' ? 'Documento aprovado' : 'Documento recusado',
    cliente_id: operacao.cliente_id,
    operacao_id: operacao.id,
    detalhe: acao === 'aprovar' ? docs[0].item_nome : `${docs[0].item_nome}: ${req.body.motivo}`,
  });
  res.json({ ok: true });
});

export default rotas;
