import { Router } from 'express';
import { exigir, exigirLogin } from '../acesso.js';
import { agora, emTransacao, executar, todos, um } from '../banco.js';
import { bool, falha, inteiro, texto } from '../http.js';

const rotas = Router();

// --- Tipos de documento (a lista geral do que pode ser pedido) -------------

const tipoPublico = (t) => ({ ...t, frente_verso: !!t.frente_verso, exige_validade: !!t.exige_validade });

rotas.get('/tipos-documento', exigirLogin, async (_req, res) => {
  const tipos = (await todos('select * from tipos_documento where removido_em is null order by grupo, ordem, lower(nome)')).map(tipoPublico);
  res.json({ tipos });
});

async function lerTipo(req, id = 0) {
  const nome = texto(req.body.nome, { obrigatorio: true, max: 120, nome: 'Nome' });
  if (await um('select id from tipos_documento where lower(nome) = lower(?) and removido_em is null and id <> ?', nome, id)) falha(409, 'Já existe um documento com esse nome.');
  return {
    nome,
    grupo: texto(req.body.grupo, { max: 60, nome: 'Grupo' }) || 'Outros',
    descricao: texto(req.body.descricao, { max: 300, nome: 'Descrição' }),
    frente_verso: bool(req.body.frente_verso) ? 1 : 0,
    exige_validade: bool(req.body.exige_validade) ? 1 : 0,
  };
}

rotas.post('/tipos-documento', exigir('cadastro_documentos', 'editar'), async (req, res) => {
  const d = await lerTipo(req);
  const ordem = ((await um('select max(ordem) as m from tipos_documento where grupo = ?', d.grupo))?.m ?? -1) + 1;
  const t = agora();
  const { lastInsertRowid } = await executar(
    'insert into tipos_documento (nome, grupo, descricao, frente_verso, exige_validade, ordem, criado_em, atualizado_em) values (?, ?, ?, ?, ?, ?, ?, ?)',
    d.nome, d.grupo, d.descricao, d.frente_verso, d.exige_validade, ordem, t, t,
  );
  res.json({ tipo: tipoPublico(await um('select * from tipos_documento where id = ?', lastInsertRowid)) });
});

rotas.put('/tipos-documento/:id', exigir('cadastro_documentos', 'editar'), async (req, res) => {
  const id = Number(req.params.id);
  if (!(await um('select id from tipos_documento where id = ? and removido_em is null', id))) falha(404, 'Documento não encontrado.');
  const d = await lerTipo(req, id);
  await executar(
    'update tipos_documento set nome = ?, grupo = ?, descricao = ?, frente_verso = ?, exige_validade = ?, atualizado_em = ? where id = ?',
    d.nome, d.grupo, d.descricao, d.frente_verso, d.exige_validade, agora(), id,
  );
  res.json({ tipo: tipoPublico(await um('select * from tipos_documento where id = ?', id)) });
});

// Sai da lista; operações que já usam continuam com o item (ele é uma cópia).
rotas.delete('/tipos-documento/:id', exigir('cadastro_documentos', 'excluir'), async (req, res) => {
  const id = Number(req.params.id);
  await emTransacao(async () => {
    await executar('update tipos_documento set removido_em = ? where id = ?', agora(), id);
    await executar('delete from perfis_documento_itens where tipo_id = ?', id);
  });
  res.json({ ok: true });
});

// --- Perfis de documentos (modelos de lista para cada tipo de operação) ----

async function perfilCompleto(p) {
  const itens = (await todos(
    `select i.tipo_id, i.obrigatorio, i.ordem, t.nome, t.grupo, t.frente_verso, t.exige_validade
       from perfis_documento_itens i join tipos_documento t on t.id = i.tipo_id
      where i.perfil_id = ? and t.removido_em is null
      order by i.ordem, i.id`,
    p.id,
  )).map((i) => ({ ...i, obrigatorio: !!i.obrigatorio, frente_verso: !!i.frente_verso, exige_validade: !!i.exige_validade }));
  const operacoes = (await um('select count(*) as n from operacoes where perfil_documento_id = ?', p.id)).n;
  const etapas = (await todos('select id, nome, prazo_dias, ordem, final from modelo_etapas where perfil_id = ? order by ordem, id', p.id)).map((e) => ({ ...e, final: !!e.final }));
  return { ...p, ativo: !!p.ativo, itens, etapas, operacoes };
}

rotas.get('/perfis-documento', exigirLogin, async (_req, res) => {
  const perfis = await todos('select * from perfis_documento order by lower(nome)');
  res.json({ perfis: await Promise.all(perfis.map(perfilCompleto)) });
});

async function lerPerfil(req, id = 0) {
  const nome = texto(req.body.nome, { obrigatorio: true, max: 120, nome: 'Nome do perfil' });
  if (await um('select id from perfis_documento where lower(nome) = lower(?) and id <> ?', nome, id)) falha(409, 'Já existe um perfil com esse nome.');
  const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
  if (itens.length === 0) falha(400, 'Acrescente pelo menos um documento ao perfil.');
  if (itens.length > 150) falha(400, 'No máximo 150 documentos por perfil.');
  // Cada item: um documento já cadastrado (tipo_id) ou um nome novo, digitado livre.
  const limpos = itens.map((i) => ({
    tipo: inteiro(i.tipo_id),
    nome: texto(i.nome, { max: 120, nome: 'Nome do documento' }),
    grupo: texto(i.grupo, { max: 60, nome: 'Grupo' }),
    frente_verso: i.frente_verso === undefined ? null : bool(i.frente_verso) ? 1 : 0,
    exige_validade: i.exige_validade === undefined ? null : bool(i.exige_validade) ? 1 : 0,
    obrigatorio: i.obrigatorio === undefined ? 1 : bool(i.obrigatorio) ? 1 : 0,
  }));
  if (limpos.some((i) => !i.tipo && !i.nome)) falha(400, 'Um dos documentos está sem nome.');
  const etapas = (Array.isArray(req.body.etapas) ? req.body.etapas : []).map((e) => ({
    nome: texto(e.nome, { obrigatorio: true, max: 80, nome: 'Nome da etapa' }),
    prazo_dias: Math.max(0, Math.min(3650, Math.trunc(Number(e.prazo_dias) || 0))),
  }));
  if (etapas.length < 2) falha(400, 'A predefinição precisa de pelo menos duas etapas: a última encerra a operação.');
  return {
    etapas,
    nome,
    descricao: texto(req.body.descricao, { max: 300, nome: 'Descrição' }),
    ativo: req.body.ativo === undefined ? 1 : bool(req.body.ativo) ? 1 : 0,
    itens: limpos,
  };
}

// Acha o documento pelo id ou pelo nome (sem diferenciar maiúsculas); se não existe, cria.
export async function documentoPorNome(item) {
  let tipo = item.tipo ? await um('select * from tipos_documento where id = ? and removido_em is null', item.tipo) : null;
  if (item.tipo && !tipo) falha(400, 'Um dos documentos escolhidos não existe mais.');
  if (!tipo) tipo = await um('select * from tipos_documento where lower(nome) = lower(?) and removido_em is null', item.nome);
  const t = agora();
  if (!tipo) {
    const grupo = item.grupo || 'Geral';
    const ordem = ((await um('select max(ordem) as m from tipos_documento where grupo = ?', grupo))?.m ?? -1) + 1;
    const { lastInsertRowid } = await executar(
      'insert into tipos_documento (nome, grupo, frente_verso, exige_validade, ordem, criado_em, atualizado_em) values (?, ?, ?, ?, ?, ?, ?)',
      item.nome, grupo, item.frente_verso ?? 0, item.exige_validade ?? 0, ordem, t, t,
    );
    return await um('select * from tipos_documento where id = ?', lastInsertRowid);
  }
  // Frente e verso / validade valem para o documento em todo lugar.
  if (item.frente_verso !== null || item.exige_validade !== null || item.grupo) {
    await executar(
      'update tipos_documento set frente_verso = ?, exige_validade = ?, grupo = ?, atualizado_em = ? where id = ?',
      item.frente_verso ?? tipo.frente_verso, item.exige_validade ?? tipo.exige_validade, item.grupo || tipo.grupo, t, tipo.id,
    );
  }
  return tipo;
}

// A última etapa encerra a operação e não tem prazo.
async function gravarEtapas(perfilId, etapas) {
  await executar('delete from modelo_etapas where perfil_id = ?', perfilId);
  for (const [ordem, e] of etapas.entries()) {
    const final = ordem === etapas.length - 1;
    await executar('insert into modelo_etapas (perfil_id, nome, prazo_dias, ordem, final) values (?, ?, ?, ?, ?)', perfilId, e.nome, final ? 0 : e.prazo_dias, ordem, final ? 1 : 0);
  }
}

async function gravarItens(perfilId, itens) {
  await executar('delete from perfis_documento_itens where perfil_id = ?', perfilId);
  const vistos = new Set();
  for (const [ordem, i] of itens.entries()) {
    const tipo = await documentoPorNome(i);
    if (vistos.has(tipo.id)) continue;
    vistos.add(tipo.id);
    await executar('insert into perfis_documento_itens (perfil_id, tipo_id, obrigatorio, ordem) values (?, ?, ?, ?)', perfilId, tipo.id, i.obrigatorio, ordem);
  }
}

rotas.post('/perfis-documento', exigir('cadastro_documentos', 'editar'), async (req, res) => {
  const d = await lerPerfil(req);
  const id = await emTransacao(async () => {
    const t = agora();
    const { lastInsertRowid } = await executar(
      'insert into perfis_documento (nome, descricao, ativo, criado_em, atualizado_em) values (?, ?, ?, ?, ?)',
      d.nome, d.descricao, d.ativo, t, t,
    );
    await gravarItens(lastInsertRowid, d.itens);
    await gravarEtapas(lastInsertRowid, d.etapas);
    return lastInsertRowid;
  });
  res.json({ perfil: await perfilCompleto(await um('select * from perfis_documento where id = ?', id)) });
});

rotas.put('/perfis-documento/:id', exigir('cadastro_documentos', 'editar'), async (req, res) => {
  const id = Number(req.params.id);
  if (!(await um('select id from perfis_documento where id = ?', id))) falha(404, 'Perfil não encontrado.');
  const d = await lerPerfil(req, id);
  await emTransacao(async () => {
    await executar('update perfis_documento set nome = ?, descricao = ?, ativo = ?, atualizado_em = ? where id = ?', d.nome, d.descricao, d.ativo, agora(), id);
    await gravarItens(id, d.itens);
    await gravarEtapas(id, d.etapas);
  });
  res.json({ perfil: await perfilCompleto(await um('select * from perfis_documento where id = ?', id)) });
});

rotas.delete('/perfis-documento/:id', exigir('cadastro_documentos', 'excluir'), async (req, res) => {
  await executar('delete from perfis_documento where id = ?', Number(req.params.id));
  res.json({ ok: true });
});

export default rotas;
