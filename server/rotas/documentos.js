import crypto from 'node:crypto';
import { Router } from 'express';
import { exigirUm, pode, veOperacao } from '../acesso.js';
import { agora, emTransacao, executar, registrarHistorico, todos, um } from '../banco.js';
import { existeArquivo, guardarArquivo, linkArquivo, moverParaExcluidos } from '../arquivos.js';
import { conferirConteudo, dataOpcional, falha, inteiro, limparTemporarios, receberArquivos, texto } from '../http.js';
import { recalcularPedidosDaOperacao } from '../regras.js';
import { carregarOperacao } from './clientes.js';

const rotas = Router();

const CAMPOS_ARQUIVO = [
  { name: 'arquivos', maxCount: 10 },
  { name: 'frente', maxCount: 1 },
  { name: 'verso', maxCount: 1 },
];

// Lê os arquivos do pedido: frente/verso (2 lados) ou uma lista simples.
export function arquivosDoEnvio(req, frenteVerso) {
  const f = req.files ?? {};
  if (frenteVerso) {
    if (!f.frente?.[0] || !f.verso?.[0]) falha(400, 'Este documento pede frente e verso: envie os dois lados.');
    return [
      { arquivo: f.frente[0], lado: 'Frente' },
      { arquivo: f.verso[0], lado: 'Verso' },
    ];
  }
  const lista = [...(f.arquivos ?? []), ...(f.frente ?? []), ...(f.verso ?? [])];
  if (lista.length === 0) falha(400, 'Escolha o arquivo.');
  return lista.map((arquivo, i) => ({ arquivo, lado: lista.length > 1 ? `Parte ${i + 1}` : '' }));
}

// Grava uma versão (um envio) de um documento: os arquivos vão para a pasta da operação.
export async function gravarEnvio({ operacao, pasta, item, arquivos, situacao, origem, solicitacaoId = null, validade = null, observacao = '', enviadoPor }) {
  const envioId = crypto.randomUUID();
  const conferidos = arquivos.map((a) => ({ ...a, ...conferirConteudo(a.arquivo) }));
  const nomeDocumento = item?.nome ?? 'Outros arquivos';
  return emTransacao(async () => {
    const t = agora();
    for (const { arquivo, lado, tipo } of conferidos) {
      const caminho = await guardarArquivo({ conteudo: arquivo.buffer, tipo, nomeOriginal: arquivo.originalname, pastaRelativa: pasta, nomeDocumento, lado });
      await executar(
        `insert into documentos (operacao_id, item_id, item_nome, envio_id, caminho, arquivo_nome, arquivo_tipo, arquivo_tamanho, situacao, origem,
           solicitacao_id, validade, observacao, lado, enviado_por, analisado_por, analisado_em, criado_em)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        operacao.id, item?.id ?? null, nomeDocumento, envioId, caminho, arquivo.originalname.slice(0, 160), tipo, arquivo.size, situacao, origem,
        solicitacaoId, validade, observacao, lado, enviadoPor,
        situacao === 'aprovado' ? enviadoPor : null, situacao === 'aprovado' ? t : null, t,
      );
    }
    return envioId;
  });
}

// Envio por dentro do sistema: entra aprovado.
rotas.post('/operacoes/:id/documentos', exigirUm(['operacoes', 'clientes', 'documentos'], 'editar'), receberArquivos(CAMPOS_ARQUIVO), async (req, res) => {
  try {
    const { o, c, pasta } = await carregarOperacao(req.params.id, req.usuario);
    const itemId = inteiro(req.body.item_id);
    const item = itemId ? await um('select * from operacao_itens where id = ? and operacao_id = ? and removido_em is null', itemId, o.id) : null;
    if (itemId && !item) falha(404, 'Documento não encontrado nesta operação.');
    const validade = dataOpcional(req.body.validade, 'Vence em');
    if (item?.exige_validade && !validade) falha(400, 'Este documento tem validade: informe a data em "Vence em".');
    const arquivos = arquivosDoEnvio(req, !!item?.frente_verso && !req.files?.arquivos?.length);
    const envioId = await gravarEnvio({
      operacao: o, pasta, item, arquivos, situacao: 'aprovado', origem: 'interno', validade,
      observacao: texto(req.body.observacao, { max: 500, nome: 'Observação' }), enviadoPor: req.usuario.nome,
    });
    await recalcularPedidosDaOperacao(o.id);
    await registrarHistorico({
      usuario: req.usuario.nome, acao: 'Documento enviado', cliente_id: c.id, operacao_id: o.id,
      detalhe: `${item?.nome ?? 'Outros arquivos'} (${arquivos.length} arquivo${arquivos.length > 1 ? 's' : ''})`,
    });
    res.json({ envio_id: envioId });
  } finally {
    limparTemporarios(req);
  }
});

// Abre ou baixa o arquivo.
rotas.get('/documentos/:id/arquivo', exigirUm(['operacoes', 'clientes', 'documentos', 'aprovacao']), async (req, res) => {
  const d = await um('select * from documentos where id = ?', Number(req.params.id));
  if (!d) falha(404, 'Arquivo não encontrado.');
  // Quem não é administrador só abre arquivo das próprias operações.
  if (!veOperacao(req.usuario, await um('select consultor_id from operacoes where id = ?', d.operacao_id))) falha(404, 'Arquivo não encontrado.');
  if (d.excluido_em && !pode(req.usuario, 'documentos', 'excluir')) falha(404, 'Arquivo não encontrado.');
  if (!(await existeArquivo(d.caminho))) falha(404, 'O arquivo não está mais guardado.');
  const nome = d.caminho.split('/').pop();
  // Link temporário do armazenamento; com baixar=1 o arquivo baixa com o nome certo.
  res.json({ url: await linkArquivo(d.caminho, { baixar: !!req.query.baixar, nome }) });
});

// Corrige a validade ou a observação de uma versão.
rotas.put('/documentos/envio/:envio', exigirUm(['operacoes', 'clientes', 'documentos'], 'editar'), async (req, res) => {
  const docs = await todos('select * from documentos where envio_id = ? and excluido_em is null', String(req.params.envio));
  if (docs.length === 0) falha(404, 'Versão não encontrada.');
  const validade = dataOpcional(req.body.validade, 'Vence em');
  const observacao = texto(req.body.observacao ?? docs[0].observacao, { max: 500, nome: 'Observação' });
  await executar('update documentos set validade = ?, observacao = ? where envio_id = ?', validade, observacao, req.params.envio);
  const { c } = await carregarOperacao(docs[0].operacao_id, req.usuario);
  await registrarHistorico({
    usuario: req.usuario.nome, acao: 'Validade alterada', cliente_id: c.id, operacao_id: docs[0].operacao_id,
    detalhe: `${docs[0].item_nome}: ${validade ? validade.split('-').reverse().join('/') : 'sem validade'}`,
  });
  res.json({ ok: true });
});

// Exclui uma versão: some da pasta do sistema e o arquivo vai para "_Excluídos".
rotas.delete('/documentos/envio/:envio', exigirUm(['operacoes', 'clientes', 'documentos'], 'excluir'), async (req, res) => {
  const docs = await todos('select * from documentos where envio_id = ? and excluido_em is null', String(req.params.envio));
  if (docs.length === 0) falha(404, 'Versão não encontrada.');
  const { c, pasta } = await carregarOperacao(docs[0].operacao_id, req.usuario);
  await emTransacao(async () => {
    for (const d of docs) {
      const novo = await moverParaExcluidos(d.caminho, pasta);
      await executar('update documentos set excluido_em = ?, excluido_por = ?, caminho = ? where id = ?', agora(), req.usuario.nome, novo, d.id);
    }
  });
  await recalcularPedidosDaOperacao(docs[0].operacao_id);
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Documento excluído', cliente_id: c.id, operacao_id: docs[0].operacao_id, detalhe: docs[0].item_nome });
  res.json({ ok: true });
});

export default rotas;
