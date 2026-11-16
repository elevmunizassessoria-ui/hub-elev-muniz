import { Router } from 'express';
import { exigir, exigirUm, filtroOperacoes, pode, veOperacao } from '../acesso.js';
import { agora, emTransacao, executar, registrarHistorico, todos, um } from '../banco.js';
import { criarPasta, juntar, pastaDaOperacao as pastaRelativaDaOperacao, pastaLivre, removerPastaVazia, renomearPasta } from '../arquivos.js';
import { bool, emailValido, falha, inteiro, texto } from '../http.js';
import { documentoPorNome } from './cadastro.js';
import { abrirEtapas, moverEtapa, operacaoLinha } from '../etapas.js';
import { pastaDaOperacao, situacaoExibida, solicitacaoCompleta } from '../regras.js';

const rotas = Router();

// --- Clientes ---------------------------------------------------------------

function lerCliente(req) {
  const email = texto(req.body.email, { max: 160, nome: 'E-mail' }).toLowerCase();
  if (email && !emailValido(email)) falha(400, 'E-mail inválido.');
  return {
    nome: texto(req.body.nome, { obrigatorio: true, max: 120, nome: 'Nome do cliente' }),
    razao_social: texto(req.body.razao_social, { max: 160, nome: 'Razão social' }),
    documento: texto(req.body.documento, { max: 30, nome: 'CNPJ/CPF' }),
    contato: texto(req.body.contato, { max: 120, nome: 'Contato' }),
    email,
    telefone: texto(req.body.telefone, { max: 30, nome: 'Telefone' }),
    observacao: texto(req.body.observacao, { max: 1000, nome: 'Observação' }),
    ativo: req.body.ativo === undefined ? 1 : bool(req.body.ativo) ? 1 : 0,
  };
}

// Quem não é administrador vê os clientes das suas operações e os que ele mesmo cadastrou.
async function veCliente(usuario, c) {
  if (usuario.admin || c.criado_por_id === usuario.id) return true;
  return !!(await um('select id from operacoes where cliente_id = ? and consultor_id = ? limit 1', c.id, usuario.id));
}

async function carregarCliente(id, usuario) {
  const c = await um('select * from clientes where id = ?', Number(id));
  if (!c || !(await veCliente(usuario, c))) falha(404, 'Cliente não encontrado.');
  return c;
}

async function resumoDoCliente(clienteId, usuario) {
  const f = filtroOperacoes(usuario);
  const ops = await todos(`select o.id from operacoes o where o.cliente_id = ? and o.situacao = 'ativa' and ${f.sql}`, clienteId, ...f.p);
  const soma = { obrigatorios: 0, obrigatorios_ok: 0, aguardando: 0, vencidos: 0, vencendo: 0, recusados: 0 };
  for (const o of ops) {
    const { resumo } = await pastaDaOperacao(o.id);
    for (const k of Object.keys(soma)) soma[k] += resumo[k];
  }
  return soma;
}

rotas.get('/clientes', exigirUm(['clientes', 'operacoes']), async (req, res) => {
  const f = filtroOperacoes(req.usuario, 'x');
  const linhas = await todos(
    `select c.*,
            (select count(*) from operacoes x where x.cliente_id = c.id and ${f.sql}) as operacoes,
            (select count(*) from solicitacoes s join operacoes x on x.id = s.operacao_id
              where x.cliente_id = c.id and ${f.sql} and s.situacao in ('aguardando', 'em_analise')) as pedidos_abertos
       from clientes c order by lower(c.nome)`,
    ...f.p, ...f.p,
  );
  const clientes = [];
  for (const c of linhas) {
    if (!(await veCliente(req.usuario, c))) continue;
    clientes.push({ ...c, ativo: !!c.ativo, resumo: await resumoDoCliente(c.id, req.usuario) });
  }
  res.json({ clientes });
});

rotas.post('/clientes', exigir('clientes', 'editar'), async (req, res) => {
  const d = lerCliente(req);
  const ocupadas = (await todos('select pasta from clientes')).map((c) => c.pasta);
  const pasta = await pastaLivre('', d.nome, ocupadas);
  const t = agora();
  const { lastInsertRowid } = await executar(
    `insert into clientes (nome, pasta, razao_social, documento, contato, email, telefone, observacao, ativo, criado_por, criado_por_id, criado_em, atualizado_em)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    d.nome, pasta, d.razao_social, d.documento, d.contato, d.email, d.telefone, d.observacao, d.ativo, req.usuario.nome, req.usuario.id, t, t,
  );
  await criarPasta(pasta);
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Cliente cadastrado', cliente_id: lastInsertRowid, detalhe: d.nome });
  res.json({ cliente: await um('select * from clientes where id = ?', lastInsertRowid) });
});

async function operacaoComResumo(o) {
  const { resumo } = await pastaDaOperacao(o.id);
  const pedido = await um("select * from solicitacoes where operacao_id = ? and situacao in ('aguardando', 'em_analise')", o.id);
  return { ...o, ...(await operacaoLinha(o)), resumo, pedido_aberto: pedido ? { id: pedido.id, situacao: situacaoExibida(pedido), expira_em: pedido.expira_em } : null };
}

rotas.get('/clientes/:id', exigirUm(['clientes', 'operacoes']), async (req, res) => {
  const c = await carregarCliente(req.params.id, req.usuario);
  const f = filtroOperacoes(req.usuario);
  const linhasOps = await todos(`select o.* from operacoes o where o.cliente_id = ? and ${f.sql} order by o.situacao, lower(o.nome)`, c.id, ...f.p);
  const operacoes = [];
  for (const o of linhasOps) operacoes.push(await operacaoComResumo(o));
  const historico = req.usuario.admin
    ? await todos('select * from historico where cliente_id = ? order by id desc limit 50', c.id)
    : await todos(`select h.* from historico h join operacoes o on o.id = h.operacao_id where h.cliente_id = ? and ${f.sql} order by h.id desc limit 50`, c.id, ...f.p);
  res.json({ cliente: { ...c, ativo: !!c.ativo }, operacoes, historico, caminho: c.pasta });
});

rotas.put('/clientes/:id', exigir('clientes', 'editar'), async (req, res) => {
  const c = await carregarCliente(req.params.id, req.usuario);
  const d = lerCliente(req);
  let pasta = c.pasta;
  if (d.nome !== c.nome) {
    const ocupadas = (await todos('select pasta from clientes where id <> ?', c.id)).map((x) => x.pasta);
    pasta = await pastaLivre('', d.nome, ocupadas, c.pasta.toLowerCase() === d.nome.toLowerCase() ? c.pasta : null);
  }
  await emTransacao(async () => {
    await executar(
      `update clientes set nome = ?, pasta = ?, razao_social = ?, documento = ?, contato = ?, email = ?, telefone = ?, observacao = ?, ativo = ?, atualizado_em = ? where id = ?`,
      d.nome, pasta, d.razao_social, d.documento, d.contato, d.email, d.telefone, d.observacao, d.ativo, agora(), c.id,
    );
    if (pasta !== c.pasta) {
      // Os caminhos dos arquivos seguem a pasta nova.
      const docs = await todos('select d.id, d.caminho from documentos d join operacoes o on o.id = d.operacao_id where o.cliente_id = ?', c.id);
      for (const doc of docs) {
        if (doc.caminho.startsWith(`${c.pasta}/`)) await executar('update documentos set caminho = ? where id = ?', `${pasta}/${doc.caminho.slice(c.pasta.length + 1)}`, doc.id);
      }
      await renomearPasta(c.pasta, pasta);
    }
  });
  if (d.nome !== c.nome) await registrarHistorico({ usuario: req.usuario.nome, acao: 'Cliente renomeado', cliente_id: c.id, detalhe: `${c.nome} → ${d.nome}` });
  if (!!c.ativo !== !!d.ativo) await registrarHistorico({ usuario: req.usuario.nome, acao: d.ativo ? 'Cliente reativado' : 'Cliente inativado', cliente_id: c.id });
  res.json({ cliente: await um('select * from clientes where id = ?', c.id) });
});

rotas.delete('/clientes/:id', exigir('clientes', 'excluir'), async (req, res) => {
  const c = await carregarCliente(req.params.id, req.usuario);
  if (await um('select d.id from documentos d join operacoes o on o.id = d.operacao_id where o.cliente_id = ? limit 1', c.id)) {
    falha(409, 'Este cliente já tem documentos. Para tirá-lo da lista, inative o cliente.');
  }
  const ops = await todos('select pasta from operacoes where cliente_id = ?', c.id);
  await executar('delete from clientes where id = ?', c.id);
  for (const o of ops) await removerPastaVazia(juntar(c.pasta, o.pasta));
  await removerPastaVazia(c.pasta);
  res.json({ ok: true });
});

// --- Operações --------------------------------------------------------------

async function copiarItensDoPerfil(operacaoId, perfilId) {
  const existentes = new Set((await todos('select tipo_id from operacao_itens where operacao_id = ? and removido_em is null', operacaoId)).map((i) => i.tipo_id));
  const itens = await todos(
    `select i.tipo_id, i.obrigatorio, t.nome, t.grupo, t.descricao, t.frente_verso, t.exige_validade
       from perfis_documento_itens i join tipos_documento t on t.id = i.tipo_id
      where i.perfil_id = ? and t.removido_em is null order by i.ordem, i.id`,
    perfilId,
  );
  let ordem = ((await um('select max(ordem) as m from operacao_itens where operacao_id = ?', operacaoId))?.m ?? -1) + 1;
  let n = 0;
  for (const i of itens) {
    if (existentes.has(i.tipo_id)) continue;
    await executar(
      `insert into operacao_itens (operacao_id, tipo_id, nome, grupo, descricao, obrigatorio, frente_verso, exige_validade, ordem, criado_em)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      operacaoId, i.tipo_id, i.nome, i.grupo, i.descricao, i.obrigatorio, i.frente_verso, i.exige_validade, ordem++, agora(),
    );
    n += 1;
  }
  return n;
}

rotas.post('/clientes/:id/operacoes', exigirUm(['operacoes', 'clientes'], 'editar'), async (req, res) => {
  const c = await carregarCliente(req.params.id, req.usuario);
  const nome = texto(req.body.nome, { obrigatorio: true, max: 120, nome: 'Nome da operação' });
  const descricao = texto(req.body.descricao, { max: 500, nome: 'Descrição' });
  const perfilId = inteiro(req.body.perfil_documento_id);
  const perfil = perfilId ? await um('select * from perfis_documento where id = ?', perfilId) : null;
  if (perfilId && !perfil) falha(400, 'Predefinição não encontrada.');
  // O administrador escolhe o consultor; os demais criam operações para si.
  let consultor = { id: req.usuario.id, nome: req.usuario.nome };
  if (req.usuario.admin) {
    const id = inteiro(req.body.consultor_id);
    consultor = id ? await um('select id, nome from usuarios where id = ? and ativo = 1', id) : null;
    if (id && !consultor) falha(400, 'Consultor não encontrado.');
  }
  const ocupadas = (await todos('select pasta from operacoes where cliente_id = ?', c.id)).map((o) => o.pasta);
  const pasta = await pastaLivre(c.pasta, nome, ocupadas);
  const id = await emTransacao(async () => {
    const t = agora();
    const { lastInsertRowid } = await executar(
      `insert into operacoes (cliente_id, nome, pasta, descricao, perfil_documento_id, perfil_documento_nome, consultor_id, criado_por, criado_em, atualizado_em)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      c.id, nome, pasta, descricao, perfil?.id ?? null, perfil?.nome ?? '', consultor?.id ?? null, req.usuario.nome, t, t,
    );
    if (perfil) await copiarItensDoPerfil(lastInsertRowid, perfil.id);
    await abrirEtapas(lastInsertRowid, perfil?.id ?? null, consultor, t);
    return lastInsertRowid;
  });
  await criarPasta(juntar(c.pasta, pasta));
  await registrarHistorico({
    usuario: req.usuario.nome, acao: 'Operação criada', cliente_id: c.id, operacao_id: id,
    detalhe: [nome, perfil && `predefinição ${perfil.nome}`, consultor && `consultor ${consultor.nome}`].filter(Boolean).join(' · '),
  });
  res.json({ operacao: await um('select * from operacoes where id = ?', id) });
});

export async function carregarOperacao(id, usuario) {
  const o = await um('select * from operacoes where id = ?', Number(id));
  if (!o || !veOperacao(usuario, o)) falha(404, 'Operação não encontrada.');
  const c = await um('select * from clientes where id = ?', o.cliente_id);
  return { o, c, pasta: juntar(c.pasta, o.pasta) };
}

rotas.get('/operacoes/:id', exigirUm(['operacoes', 'clientes']), async (req, res) => {
  const { o, c } = await carregarOperacao(req.params.id, req.usuario);
  const conteudo = await pastaDaOperacao(o.id);
  const pedido = await um("select * from solicitacoes where operacao_id = ? and situacao in ('aguardando', 'em_analise')", o.id);
  const historico = await todos('select * from historico where operacao_id = ? order by id desc limit 100', o.id);
  res.json({
    operacao: { ...o, ...(await operacaoLinha(o)) },
    cliente: { id: c.id, nome: c.nome, email: c.email, telefone: c.telefone, contato: c.contato },
    caminho: pastaRelativaDaOperacao(c, o),
    ...conteudo,
    pedido_aberto: pedido ? await solicitacaoCompleta(pedido, pode(req.usuario, 'solicitacoes', 'editar')) : null,
    historico,
  });
});

rotas.put('/operacoes/:id', exigirUm(['operacoes', 'clientes'], 'editar'), async (req, res) => {
  const { o, c } = await carregarOperacao(req.params.id, req.usuario);
  const nome = texto(req.body.nome, { obrigatorio: true, max: 120, nome: 'Nome da operação' });
  const descricao = texto(req.body.descricao, { max: 500, nome: 'Descrição' });
  const situacao = req.body.situacao === 'encerrada' ? 'encerrada' : 'ativa';
  let pasta = o.pasta;
  if (nome !== o.nome) {
    const ocupadas = (await todos('select pasta from operacoes where cliente_id = ? and id <> ?', c.id, o.id)).map((x) => x.pasta);
    pasta = await pastaLivre(c.pasta, nome, ocupadas, o.pasta.toLowerCase() === nome.toLowerCase() ? o.pasta : null);
  }
  await emTransacao(async () => {
    await executar('update operacoes set nome = ?, pasta = ?, descricao = ?, situacao = ?, atualizado_em = ? where id = ?', nome, pasta, descricao, situacao, agora(), o.id);
    if (pasta !== o.pasta) {
      const antes = juntar(c.pasta, o.pasta);
      const depois = juntar(c.pasta, pasta);
      for (const doc of await todos('select id, caminho from documentos where operacao_id = ?', o.id)) {
        if (doc.caminho.startsWith(`${antes}/`)) await executar('update documentos set caminho = ? where id = ?', `${depois}/${doc.caminho.slice(antes.length + 1)}`, doc.id);
      }
      await renomearPasta(antes, depois);
    }
  });
  // Encerrar leva para a etapa final; reabrir volta para a primeira. Assim o SLA para e recomeça certo.
  if (situacao !== o.situacao) {
    const etapa = await um(`select * from operacao_etapas where operacao_id = ? and final = ? order by ordem limit 1`, o.id, situacao === 'encerrada' ? 1 : 0);
    if (etapa) await moverEtapa({ ...o, situacao }, etapa);
  }
  if (nome !== o.nome) await registrarHistorico({ usuario: req.usuario.nome, acao: 'Operação renomeada', cliente_id: c.id, operacao_id: o.id, detalhe: `${o.nome} → ${nome}` });
  if (situacao !== o.situacao) await registrarHistorico({ usuario: req.usuario.nome, acao: situacao === 'encerrada' ? 'Operação encerrada' : 'Operação reaberta', cliente_id: c.id, operacao_id: o.id });
  res.json({ operacao: await um('select * from operacoes where id = ?', o.id) });
});

rotas.delete('/operacoes/:id', exigirUm(['operacoes', 'clientes'], 'excluir'), async (req, res) => {
  const { o, c, pasta } = await carregarOperacao(req.params.id, req.usuario);
  if (await um('select id from documentos where operacao_id = ? limit 1', o.id)) falha(409, 'Esta operação já tem documentos. Encerre a operação em vez de excluir.');
  await executar('delete from operacoes where id = ?', o.id);
  await removerPastaVazia(pasta);
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Operação excluída', cliente_id: c.id, detalhe: o.nome });
  res.json({ ok: true });
});

// --- O perfil de documentos da operação (itens exigidos) -------------------

rotas.post('/operacoes/:id/aplicar-perfil', exigirUm(['operacoes', 'clientes'], 'editar'), async (req, res) => {
  const { o, c } = await carregarOperacao(req.params.id, req.usuario);
  const perfil = await um('select * from perfis_documento where id = ?', inteiro(req.body.perfil_documento_id) ?? 0);
  if (!perfil) falha(400, 'Perfil de documentos não encontrado.');
  const n = await emTransacao(async () => {
    const novos = await copiarItensDoPerfil(o.id, perfil.id);
    await executar('update operacoes set perfil_documento_id = ?, perfil_documento_nome = ?, atualizado_em = ? where id = ?', perfil.id, perfil.nome, agora(), o.id);
    return novos;
  });
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Perfil aplicado', cliente_id: c.id, operacao_id: o.id, detalhe: `${perfil.nome} (+${n} documentos)` });
  res.json({ adicionados: n });
});

rotas.post('/operacoes/:id/itens', exigirUm(['operacoes', 'clientes'], 'editar'), async (req, res) => {
  const { o, c } = await carregarOperacao(req.params.id, req.usuario);
  const obrigatorio = req.body.obrigatorio === undefined ? 1 : bool(req.body.obrigatorio) ? 1 : 0;
  let ordem = ((await um('select max(ordem) as m from operacao_itens where operacao_id = ?', o.id))?.m ?? -1) + 1;
  const nomes = [];
  await emTransacao(async () => {
    const tipos = Array.isArray(req.body.tipo_ids) ? req.body.tipo_ids.map(inteiro).filter(Boolean) : [];
    const ja = new Set((await todos('select tipo_id from operacao_itens where operacao_id = ? and removido_em is null', o.id)).map((i) => i.tipo_id));
    for (const id of tipos) {
      if (ja.has(id)) continue;
      const t = await um('select * from tipos_documento where id = ? and removido_em is null', id);
      if (!t) continue;
      await executar(
        `insert into operacao_itens (operacao_id, tipo_id, nome, grupo, descricao, obrigatorio, frente_verso, exige_validade, ordem, criado_em)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        o.id, t.id, t.nome, t.grupo, t.descricao, obrigatorio, t.frente_verso, t.exige_validade, ordem++, agora(),
      );
      nomes.push(t.nome);
    }
    // Documento digitado livre: entra na lista geral (se ainda não existe) e nesta operação.
    if (req.body.nome) {
      const t = await documentoPorNome({
        tipo: null,
        nome: texto(req.body.nome, { max: 120, nome: 'Nome do documento' }),
        grupo: texto(req.body.grupo, { max: 60 }),
        frente_verso: bool(req.body.frente_verso) ? 1 : 0,
        exige_validade: bool(req.body.exige_validade) ? 1 : 0,
      });
      if (!ja.has(t.id)) {
        await executar(
          `insert into operacao_itens (operacao_id, tipo_id, nome, grupo, descricao, obrigatorio, frente_verso, exige_validade, ordem, criado_em)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          o.id, t.id, t.nome, t.grupo, t.descricao, obrigatorio, bool(req.body.frente_verso) ? 1 : 0, bool(req.body.exige_validade) ? 1 : 0, ordem++, agora(),
        );
        nomes.push(t.nome);
      }
    }
  });
  if (nomes.length === 0) falha(400, 'Nenhum documento novo para acrescentar.');
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Documentos acrescentados ao perfil', cliente_id: c.id, operacao_id: o.id, detalhe: nomes.join(', ') });
  res.json({ adicionados: nomes.length });
});

rotas.put('/operacoes/:id/itens/:item', exigirUm(['operacoes', 'clientes'], 'editar'), async (req, res) => {
  const { o } = await carregarOperacao(req.params.id, req.usuario);
  const item = await um('select * from operacao_itens where id = ? and operacao_id = ? and removido_em is null', Number(req.params.item), o.id);
  if (!item) falha(404, 'Documento não encontrado nesta operação.');
  await executar(
    'update operacao_itens set nome = ?, descricao = ?, obrigatorio = ?, frente_verso = ?, exige_validade = ? where id = ?',
    texto(req.body.nome ?? item.nome, { obrigatorio: true, max: 120, nome: 'Nome' }),
    texto(req.body.descricao ?? item.descricao, { max: 300, nome: 'Descrição' }),
    bool(req.body.obrigatorio ?? item.obrigatorio) ? 1 : 0,
    bool(req.body.frente_verso ?? item.frente_verso) ? 1 : 0,
    bool(req.body.exige_validade ?? item.exige_validade) ? 1 : 0,
    item.id,
  );
  res.json({ ok: true });
});

// Tira da lista exigida; arquivos já enviados ficam em "Outros arquivos".
rotas.delete('/operacoes/:id/itens/:item', exigirUm(['operacoes', 'clientes'], 'editar'), async (req, res) => {
  const { o, c } = await carregarOperacao(req.params.id, req.usuario);
  const item = await um('select * from operacao_itens where id = ? and operacao_id = ? and removido_em is null', Number(req.params.item), o.id);
  if (!item) falha(404, 'Documento não encontrado nesta operação.');
  await executar('update operacao_itens set removido_em = ? where id = ?', agora(), item.id);
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Documento tirado do perfil', cliente_id: c.id, operacao_id: o.id, detalhe: item.nome });
  res.json({ ok: true });
});

export default rotas;
