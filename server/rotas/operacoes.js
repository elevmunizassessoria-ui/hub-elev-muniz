import { Router } from 'express';
import { exigir, exigirAdmin, exigirUm, filtroOperacoes } from '../acesso.js';
import { agora, emTransacao, executar, registrarHistorico, todos, um } from '../banco.js';
import { codigoOperacao, medirSla, moverEtapa, operacaoLinha, trocarConsultor } from '../etapas.js';
import { falha, inteiro, texto } from '../http.js';
import { pastaDaOperacao, resumir } from '../regras.js';
import { carregarOperacao } from './clientes.js';

const rotas = Router();

// A lista de operações, separada dos clientes: com quem está, em que etapa e como está o prazo.
rotas.get('/operacoes', exigir('operacoes'), async (req, res) => {
  const f = filtroOperacoes(req.usuario);
  const base = await todos(
    `select o.*, c.nome as cliente_nome from operacoes o join clientes c on c.id = o.cliente_id where ${f.sql} order by o.situacao, o.id desc`,
    ...f.p,
  );
  const lista = await Promise.all(base.map(async (o) => ({ ...o, ...(await operacaoLinha(o)), resumo: (await pastaDaOperacao(o.id)).resumo })));
  res.json({ operacoes: lista });
});

// Quem pode receber operações (só o administrador escolhe).
rotas.get('/consultores', exigirAdmin, async (_req, res) => {
  const lista = (await todos(
    `select u.id, u.nome, u.admin,
            (select count(*) from operacoes o where o.consultor_id = u.id and o.situacao = 'ativa') as operacoes_ativas
       from usuarios u where u.ativo = 1 order by lower(u.nome)`,
  )).map((u) => ({ ...u, admin: !!u.admin }));
  res.json({ consultores: lista });
});

rotas.post('/operacoes/:id/etapa', exigirUm(['operacoes', 'clientes'], 'editar'), async (req, res) => {
  const { o, c } = await carregarOperacao(req.params.id, req.usuario);
  const etapa = await um('select * from operacao_etapas where id = ? and operacao_id = ?', inteiro(req.body.etapa_id) ?? 0, o.id);
  if (!etapa) falha(400, 'Etapa não encontrada nesta operação.');
  if (etapa.id === o.etapa_id) falha(400, 'A operação já está nesta etapa.');
  await emTransacao(async () => moverEtapa(o, etapa));
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Etapa alterada', cliente_id: c.id, operacao_id: o.id, detalhe: etapa.nome });
  res.json({ ok: true });
});

// Só o administrador transfere, sempre com motivo.
rotas.post('/operacoes/:id/transferir', exigirAdmin, async (req, res) => {
  const { o, c } = await carregarOperacao(req.params.id, req.usuario);
  const novo = await um('select id, nome from usuarios where id = ? and ativo = 1', inteiro(req.body.consultor_id) ?? 0);
  if (!novo) falha(400, 'Escolha o consultor que vai receber a operação.');
  if (novo.id === o.consultor_id) falha(400, 'A operação já está com esse consultor.');
  const motivo = texto(req.body.motivo, { obrigatorio: true, max: 500, nome: 'Motivo' });
  if (motivo.length < 5) falha(400, 'Motivo: explique em poucas palavras.');
  const antes = o.consultor_id ? await um('select id, nome from usuarios where id = ?', o.consultor_id) : null;
  const t = agora();
  await emTransacao(async () => {
    await trocarConsultor(o, novo, t);
    await executar(
      'insert into transferencias (operacao_id, de_id, de_nome, para_id, para_nome, motivo, por, quando) values (?, ?, ?, ?, ?, ?, ?, ?)',
      o.id, antes?.id ?? null, antes?.nome ?? '', novo.id, novo.nome, motivo, req.usuario.nome, t,
    );
    await registrarHistorico({
      usuario: req.usuario.nome, acao: 'Operação transferida', cliente_id: c.id, operacao_id: o.id,
      detalhe: `${antes?.nome ?? 'Sem consultor'} → ${novo.nome}: ${motivo}`,
    });
  });
  res.json({ ok: true });
});

// Quem não é administrador vê as transferências das próprias operações.
rotas.get('/transferencias', exigir('operacoes'), async (req, res) => {
  const f = filtroOperacoes(req.usuario);
  const lista = (await todos(
    `select t.*, o.nome as operacao_nome, o.cliente_id, c.nome as cliente_nome
       from transferencias t join operacoes o on o.id = t.operacao_id join clientes c on c.id = o.cliente_id
      where ${f.sql} order by t.id desc`,
    ...f.p,
  )).map((t) => ({ ...t, codigo: codigoOperacao(t.operacao_id) }));
  res.json({ transferencias: lista });
});

rotas.get('/sla', exigir('sla'), async (req, res) => {
  const dias = [30, 90, 365, 0].includes(Number(req.query.dias)) ? Number(req.query.dias) : 90;
  res.json(await medirSla(req.usuario, dias));
});

// A área de Documentos: cada documento exigido, de todas as operações que o usuário vê.
rotas.get('/documentos-geral', exigir('documentos'), async (req, res) => {
  const f = filtroOperacoes(req.usuario);
  const ops = await todos(
    `select o.*, c.nome as cliente_nome from operacoes o join clientes c on c.id = o.cliente_id where o.situacao = 'ativa' and ${f.sql}`,
    ...f.p,
  );
  const porOperacao = await Promise.all(ops.map(async (o) => ({ o, linha: await operacaoLinha(o), pasta: await pastaDaOperacao(o.id) })));
  const itens = [];
  for (const { o, linha, pasta } of porOperacao) {
    for (const i of pasta.itens) {
      itens.push({
        id: i.id,
        nome: i.nome,
        grupo: i.grupo,
        obrigatorio: i.obrigatorio,
        estado: i.estado,
        dias_para_vencer: i.dias_para_vencer,
        validade: i.atual?.validade ?? null,
        enviado_em: (i.pendente ?? i.atual ?? i.recusado)?.criado_em ?? null,
        motivo_recusa: i.recusado?.motivo_recusa ?? '',
        arquivo_id: (i.pendente ?? i.atual)?.arquivos[0]?.id ?? null,
        operacao_id: o.id,
        operacao_codigo: linha.codigo,
        operacao_nome: o.nome,
        cliente_id: o.cliente_id,
        cliente_nome: o.cliente_nome,
        consultor_nome: linha.consultor_nome,
      });
    }
  }
  res.json({ itens, resumo: resumir(itens.map((i) => ({ ...i }))) });
});

export default rotas;
