import { Router } from 'express';
import { exigir, filtroOperacoes, pode } from '../acesso.js';
import { todos, um } from '../banco.js';
import { medirSla, operacaoLinha } from '../etapas.js';
import { pastaDaOperacao } from '../regras.js';
import { lancamentosVisiveis } from './financeiro.js';

const rotas = Router();

// Os números de decisão. Cada um vem com a lista que o explica; o escopo é o do usuário.
rotas.get('/painel', exigir('dashboard'), async (req, res) => {
  const u = req.usuario;
  const f = filtroOperacoes(u);
  const base = await todos(`select o.*, c.nome as cliente_nome from operacoes o join clientes c on c.id = o.cliente_id where ${f.sql}`, ...f.p);
  const ops = await Promise.all(base.map(async (o) => ({ ...o, ...(await operacaoLinha(o)) })));
  const ativas = ops.filter((o) => o.situacao === 'ativa');
  const mesAtual = new Date().toISOString().slice(0, 7);
  const atrasadas = ativas.filter((o) => o.sla === 'atrasada').sort((a, b) => b.dias_na_etapa - b.prazo_dias - (a.dias_na_etapa - a.prazo_dias));

  const docs = { para_aprovar: 0, vencidos: 0, vencendo: 0, faltando: 0, recusados: 0 };
  const pastas = await Promise.all(ativas.map((o) => pastaDaOperacao(o.id)));
  for (const { resumo, itens } of pastas) {
    docs.para_aprovar += resumo.aguardando;
    docs.vencidos += resumo.vencidos;
    docs.vencendo += resumo.vencendo;
    docs.recusados += resumo.recusados;
    docs.faltando += itens.filter((i) => i.obrigatorio && i.estado === 'falta').length;
  }

  const sla = await medirSla(u, 90);
  const carga = new Map();
  for (const o of ativas) {
    const nome = o.consultor_nome || 'Sem consultor';
    if (!carga.has(nome)) carga.set(nome, { nome, ativas: 0, atrasadas: 0 });
    const c = carga.get(nome);
    c.ativas += 1;
    if (o.sla === 'atrasada') c.atrasadas += 1;
  }
  const gargalo = [...sla.etapas].sort((a, b) => (a.sla ?? 101) - (b.sla ?? 101))[0] ?? null;

  const resposta = {
    ve_tudo: u.admin,
    operacoes: {
      ativas: ativas.length,
      atrasadas: atrasadas.length,
      perto: ativas.filter((o) => o.sla === 'perto').length,
      sem_consultor: u.admin ? ativas.filter((o) => !o.consultor_id).length : 0,
      concluidas_mes: ops.filter((o) => (o.concluida_em ?? '').startsWith(mesAtual)).length,
    },
    documentos: docs,
    sla: { geral: sla.geral, consultores: sla.consultores, gargalo },
    carga: [...carga.values()].sort((a, b) => b.ativas - a.ativas),
    atrasadas: atrasadas.slice(0, 8).map((o) => ({
      id: o.id, cliente_id: o.cliente_id, codigo: o.codigo, nome: o.nome, cliente_nome: o.cliente_nome,
      consultor_nome: o.consultor_nome, etapa_nome: o.etapa_nome, dias_atraso: Math.round((o.dias_na_etapa - o.prazo_dias) * 10) / 10,
    })),
    transferencias_mes: (await um(
      `select count(*) as n from transferencias t join operacoes o on o.id = t.operacao_id where substr(t.quando, 1, 7) = ? and ${f.sql}`,
      mesAtual, ...f.p,
    )).n,
    financeiro: null,
  };

  if (pode(u, 'financeiro')) {
    const lanc = await lancamentosVisiveis(u);
    const noMes = lanc.filter((l) => l.vencimento.startsWith(mesAtual));
    const soma = (lista) => lista.reduce((t, l) => t + l.valor_centavos, 0);
    const meses = [];
    const hoje = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
      const doMes = lanc.filter((l) => l.vencimento.startsWith(m));
      meses.push({ mes: m, receita: soma(doMes.filter((l) => l.tipo === 'receita')), despesa: soma(doMes.filter((l) => l.tipo === 'despesa')) });
    }
    resposta.financeiro = {
      receita_mes: soma(noMes.filter((l) => l.tipo === 'receita')),
      despesa_mes: soma(noMes.filter((l) => l.tipo === 'despesa')),
      receber_atrasado: soma(lanc.filter((l) => l.tipo === 'receita' && l.situacao === 'atrasado')),
      pagar_atrasado: soma(lanc.filter((l) => l.tipo === 'despesa' && l.situacao === 'atrasado')),
      meses,
    };
  }
  res.json(resposta);
});

export default rotas;
