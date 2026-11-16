import { Router } from 'express';
import { agora, executar, lerConfiguracoes, registrarHistorico, um } from '../banco.js';
import { extensoesAceitas, juntar, nomesFormatos } from '../arquivos.js';
import { dataOpcional, falha, inteiro, limparTemporarios, receberArquivos } from '../http.js';
import { itensDaSolicitacao, recalcularSolicitacao } from '../regras.js';
import { arquivosDoEnvio, gravarEnvio } from './documentos.js';

// Portal do cliente: sem login, só com o código do link.
const rotas = Router();

// Limite por link: 40 arquivos por hora.
const porLink = new Map();
function conferirLimite(token, n) {
  const agoraMs = Date.now();
  const lista = (porLink.get(token) ?? []).filter((t) => t > agoraMs - 3_600_000);
  if (lista.length + n > 40) falha(429, 'Muitos envios em pouco tempo. Tente de novo daqui a pouco.');
  porLink.set(token, [...lista, ...Array(n).fill(agoraMs)]);
}

async function pedidoDoLink(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) falha(404, 'Link inválido.');
  const s = await um('select * from solicitacoes where token = ?', token);
  if (!s) falha(404, 'Link inválido.');
  if (s.situacao === 'cancelada') falha(410, 'Este pedido foi cancelado.');
  if (s.situacao === 'aguardando' && s.expira_em < agora()) falha(410, 'Este link venceu. Peça um novo para quem enviou.');
  return s;
}

rotas.get('/:token', async (req, res) => {
  const s = await pedidoDoLink(req.params.token);
  const o = await um('select o.nome, c.nome as cliente_nome, c.contato from operacoes o join clientes c on c.id = o.cliente_id where o.id = ?', s.operacao_id);
  const config = lerConfiguracoes();
  res.json({
    empresa_nome: config.empresa_nome,
    cliente_nome: o.cliente_nome,
    contato: o.contato,
    operacao_nome: o.nome,
    mensagem: s.mensagem,
    situacao: s.situacao,
    criado_em: s.criado_em,
    expira_em: s.expira_em,
    tamanho_maximo_mb: Number(config.tamanho_maximo_mb) || 20,
    extensoes: extensoesAceitas(),
    formatos: nomesFormatos(),
    itens: await itensDaSolicitacao(s),
  });
});

rotas.post(
  '/:token/enviar',
  receberArquivos([{ name: 'arquivos', maxCount: 10 }, { name: 'frente', maxCount: 1 }, { name: 'verso', maxCount: 1 }]),
  async (req, res) => {
    try {
      // Campo escondido: só robôs preenchem.
      if (req.body.site) falha(400, 'Envio recusado.');
      const s = await pedidoDoLink(req.params.token);
      if (s.situacao === 'concluida') falha(409, 'Todos os documentos deste pedido já foram aprovados.');
      const itemId = inteiro(req.body.item_id);
      const doPedido = (await itensDaSolicitacao(s)).find((i) => i.id === itemId);
      if (!doPedido) falha(400, 'Documento não faz parte deste pedido.');
      if (doPedido.estado === 'aprovado' || doPedido.estado === 'em_analise') falha(409, `"${doPedido.nome}" já foi enviado.`);
      const item = await um('select * from operacao_itens where id = ?', itemId);
      const validade = dataOpcional(req.body.validade, 'Validade');
      const arquivos = arquivosDoEnvio(req, !!item.frente_verso);
      conferirLimite(s.token, arquivos.length);
      const o = await um('select * from operacoes where id = ?', s.operacao_id);
      const c = await um('select * from clientes where id = ?', o.cliente_id);
      await gravarEnvio({
        operacao: o, pasta: juntar(c.pasta, o.pasta), item, arquivos, situacao: 'pendente', origem: 'link',
        solicitacaoId: s.id, validade, enviadoPor: `${c.nome} (link)`,
      });
      await executar('update solicitacoes set ultimo_envio_em = ?, atualizado_em = ? where id = ?', agora(), agora(), s.id);
      await recalcularSolicitacao(s.id);
      await registrarHistorico({ usuario: `${c.nome} (link)`, acao: 'Cliente enviou documento', cliente_id: c.id, operacao_id: o.id, detalhe: item.nome });
      res.json({ ok: true });
    } finally {
      limparTemporarios(req);
    }
  },
);

export default rotas;
