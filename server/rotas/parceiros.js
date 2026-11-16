import { Router } from 'express';
import { exigir } from '../acesso.js';
import { agora, executar, registrarHistorico, todos, um } from '../banco.js';
import { bool, emailValido, falha, texto } from '../http.js';

// Parceiros: bancos, cooperativas, fintechs e fundos com quem a Elev Muniz trabalha, e o contato de cada um.
// O módulo de acesso continua com a chave "instituicoes" (o nome mudou para Parceiros em 16/11/2026).
const rotas = Router();

export const TIPOS_PARCEIRO = ['Banco', 'Cooperativa', 'Fintech', 'FIDC', 'Securitizadora', 'Correspondente', 'Outro'];

const publico = (p) => ({ ...p, ativo: !!p.ativo, exemplo: !!p.exemplo, comissao_padrao: Number(p.comissao_padrao) });

rotas.get('/parceiros', exigir('instituicoes'), async (_req, res) => {
  const parceiros = (await todos('select * from parceiros order by ativo desc, lower(nome)')).map(publico);
  res.json({ parceiros, tipos: TIPOS_PARCEIRO });
});

async function ler(req, id = 0) {
  const nome = texto(req.body.nome, { obrigatorio: true, max: 120, nome: 'Nome do parceiro' });
  if (await um('select id from parceiros where lower(nome) = lower(?) and id <> ?', nome, id)) falha(409, 'Já existe um parceiro com esse nome.');
  const email = texto(req.body.email, { max: 160, nome: 'E-mail' }).toLowerCase();
  if (email && !emailValido(email)) falha(400, 'E-mail inválido.');
  const tipo = TIPOS_PARCEIRO.includes(req.body.tipo) ? req.body.tipo : 'Banco';
  const comissao = Number(String(req.body.comissao_padrao ?? 0).replace(',', '.'));
  if (!Number.isFinite(comissao) || comissao < 0 || comissao > 100) falha(400, 'Comissão padrão: de 0 a 100%.');
  const prazo = Math.trunc(Number(req.body.prazo_resposta_dias ?? 0));
  return {
    nome,
    tipo,
    documento: texto(req.body.documento, { max: 30, nome: 'CNPJ' }),
    contato_nome: texto(req.body.contato_nome, { max: 120, nome: 'Contato' }),
    contato_cargo: texto(req.body.contato_cargo, { max: 80, nome: 'Cargo' }),
    telefone: texto(req.body.telefone, { max: 30, nome: 'Telefone' }),
    email,
    comissao_padrao: Math.round(comissao * 100) / 100,
    prazo_resposta_dias: Number.isFinite(prazo) && prazo > 0 ? Math.min(prazo, 365) : 0,
    observacao: texto(req.body.observacao, { max: 1000, nome: 'Observação' }),
    ativo: req.body.ativo === undefined ? 1 : bool(req.body.ativo) ? 1 : 0,
  };
}

rotas.post('/parceiros', exigir('instituicoes', 'editar'), async (req, res) => {
  const d = await ler(req);
  const t = agora();
  const { lastInsertRowid } = await executar(
    `insert into parceiros (nome, tipo, documento, contato_nome, contato_cargo, telefone, email, comissao_padrao, prazo_resposta_dias, observacao, ativo, criado_por, criado_em, atualizado_em)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    d.nome, d.tipo, d.documento, d.contato_nome, d.contato_cargo, d.telefone, d.email, d.comissao_padrao, d.prazo_resposta_dias, d.observacao, d.ativo, req.usuario.nome, t, t,
  );
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Parceiro cadastrado', detalhe: d.nome });
  res.json({ parceiro: publico(await um('select * from parceiros where id = ?', lastInsertRowid)) });
});

rotas.put('/parceiros/:id', exigir('instituicoes', 'editar'), async (req, res) => {
  const p = await um('select * from parceiros where id = ?', Number(req.params.id));
  if (!p) falha(404, 'Parceiro não encontrado.');
  const d = await ler(req, p.id);
  await executar(
    `update parceiros set nome = ?, tipo = ?, documento = ?, contato_nome = ?, contato_cargo = ?, telefone = ?, email = ?, comissao_padrao = ?,
       prazo_resposta_dias = ?, observacao = ?, ativo = ?, atualizado_em = ? where id = ?`,
    d.nome, d.tipo, d.documento, d.contato_nome, d.contato_cargo, d.telefone, d.email, d.comissao_padrao, d.prazo_resposta_dias, d.observacao, d.ativo, agora(), p.id,
  );
  res.json({ parceiro: publico(await um('select * from parceiros where id = ?', p.id)) });
});

rotas.delete('/parceiros/:id', exigir('instituicoes', 'excluir'), async (req, res) => {
  const p = await um('select * from parceiros where id = ?', Number(req.params.id));
  if (!p) falha(404, 'Parceiro não encontrado.');
  await executar('delete from parceiros where id = ?', p.id);
  await registrarHistorico({ usuario: req.usuario.nome, acao: 'Parceiro excluído', detalhe: p.nome });
  res.json({ ok: true });
});

export default rotas;
