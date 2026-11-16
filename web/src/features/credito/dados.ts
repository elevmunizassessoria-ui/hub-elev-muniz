/**
 * Dados das telas de crédito (Funil, Propostas, Análise, Garantias, Compliance, Carteira, Comissões,
 * Metas e Agenda). Ainda não têm tabela no banco: são montados a partir dos clientes, operações e
 * consultores de verdade do sistema, sempre iguais para os mesmos registros. Assim tudo se liga entre
 * as abas (a proposta é da operação X, do cliente Y, com o consultor Z). Quando essas telas forem
 * ligadas ao banco, este arquivo sai.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Cliente, Operacao } from "@/lib/tipos";

const dia = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const mil = (n: number) => Math.round(n) * 100_000;

/** Número "aleatório" fixo para cada registro (o mesmo id dá sempre o mesmo valor). */
function sorteio(semente: number) {
  let s = (semente * 2654435761) >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const escolher = <T,>(r: () => number, lista: readonly T[]) => lista[Math.floor(r() * lista.length)];
const entre = (r: () => number, min: number, max: number) => min + r() * (max - min);

// --- Cadastros de referência (instituições e produtos) ---------------------------------

const INSTITUICOES_BASE = [
  { nome: "Banco Horizonte", tipo: "Banco", gerente: "Paula Viana · (11) 3100-2200", resposta: 6, comissao: 2.5, situacao: "Ativa" },
  { nome: "Banco Atlas", tipo: "Banco", gerente: "Rogério Melo · (11) 3200-4400", resposta: 9, comissao: 2, situacao: "Ativa" },
  { nome: "Sicoop Vale", tipo: "Cooperativa", gerente: "Marina Dias · (31) 3300-1100", resposta: 5, comissao: 3, situacao: "Ativa" },
  { nome: "CrediRápido", tipo: "Fintech", gerente: "Lucas Prado · (11) 94000-1234", resposta: 2, comissao: 3.5, situacao: "Ativa" },
  { nome: "Recebíveis FIDC", tipo: "FIDC", gerente: "Helena Couto · (21) 3400-9000", resposta: 3, comissao: 1.5, situacao: "Ativa" },
  { nome: "Banco Meridiano", tipo: "Banco", gerente: "Sem gerente definido", resposta: 14, comissao: 1.8, situacao: "Inativa" },
];

export const PRODUTOS = [
  { nome: "Capital de giro", banco: "Banco Horizonte", modalidade: "Capital de giro", taxaMin: 1.45, taxaMax: 2.3, prazo: 36, teto: mil(2000), garantia: "Aval", comissao: 2.5 },
  { nome: "Giro com garantia", banco: "Banco Atlas", modalidade: "Capital de giro", taxaMin: 1.15, taxaMax: 1.75, prazo: 60, teto: mil(5000), garantia: "Imóvel", comissao: 2 },
  { nome: "Antecipação de recebíveis", banco: "Recebíveis FIDC", modalidade: "Antecipação", taxaMin: 1.6, taxaMax: 2.9, prazo: 6, teto: mil(1500), garantia: "Recebíveis", comissao: 1.5 },
  { nome: "Financiamento de frota", banco: "Sicoop Vale", modalidade: "Financiamento", taxaMin: 1.2, taxaMax: 1.65, prazo: 60, teto: mil(3000), garantia: "Veículo", comissao: 3 },
  { nome: "Home equity empresarial", banco: "Banco Horizonte", modalidade: "Home equity", taxaMin: 0.99, taxaMax: 1.4, prazo: 120, teto: mil(8000), garantia: "Imóvel", comissao: 2.5 },
  { nome: "Crédito rural", banco: "Sicoop Vale", modalidade: "Crédito rural", taxaMin: 0.85, taxaMax: 1.25, prazo: 84, teto: mil(4000), garantia: "Equipamento", comissao: 2.8 },
  { nome: "Giro rápido", banco: "CrediRápido", modalidade: "Capital de giro", taxaMin: 2.2, taxaMax: 3.9, prazo: 18, teto: mil(500), garantia: "Sem garantia", comissao: 3.5 },
];

export const BANCOS = INSTITUICOES_BASE.filter((i) => i.situacao === "Ativa").map((i) => i.nome);
export const FUNIL_ETAPAS = ["Prospecção", "Documentação", "Análise de crédito", "Enviada ao banco", "Aprovada", "Contrato", "Liberada"];

// --- Montagem a partir do que existe no sistema ---------------------------------------------

const cod = (prefixo: string, id: number) => `${prefixo}${String(id).padStart(5, "0")}`;

function montar(clientes: Pick<Cliente, "id" | "nome">[], operacoes: Operacao[]) {
  const propostas = operacoes.map((o) => {
    const r = sorteio(o.id);
    const p = escolher(r, PRODUTOS);
    const valor = mil(Math.min(entre(r, 120, 4200), p.teto / 100_000));
    let situacao: string;
    if (o.situacao !== "ativa") situacao = "Aprovada";
    else if (o.etapa_ordem === 0) situacao = r() < 0.6 ? "Rascunho" : "Em análise";
    else situacao = escolher(r, ["Em análise", "Em análise", "Contraproposta", "Aprovada", "Aprovada", "Recusada"]);
    return {
      codigo: cod("PR", o.id),
      operacao_id: o.id,
      operacao: o.nome,
      cliente_id: o.cliente_id,
      cliente: o.cliente_nome ?? "",
      produto: p.nome,
      banco: p.banco,
      comissaoPct: p.comissao,
      valor,
      taxa: Math.round(entre(r, p.taxaMin, p.taxaMax) * 100) / 100,
      prazo: Math.min(p.prazo, escolher(r, [12, 18, 24, 36, 48, 60])),
      enviada: dia(-Math.round(entre(r, 1, 25))),
      consultor: o.consultor_nome || "Sem consultor",
      situacao,
      encerrada: o.situacao !== "ativa",
      dias: Math.max(1, Math.round(o.dias_na_etapa ?? 1)),
      // Aprovada: parte já virou contrato.
      contrato: o.situacao !== "ativa" || (situacao === "Aprovada" && r() < 0.5),
    };
  });

  const comOperacao = new Set(operacoes.map((o) => o.cliente_id));
  const funil = [
    ...clientes
      .filter((c) => !comOperacao.has(c.id))
      .map((c) => {
        const r = sorteio(c.id * 7);
        const p = escolher(r, PRODUTOS);
        return { id: `c${c.id}`, etapa: 0, cliente_id: c.id, operacao_id: null as number | null, cliente: c.nome, produto: p.nome, valor: mil(entre(r, 100, 900)), banco: "A definir", consultor: "Sem consultor", dias: Math.round(entre(r, 1, 9)) };
      }),
    ...propostas
      .filter((p) => p.situacao !== "Recusada")
      .map((p) => {
        let etapa = 3;
        if (p.encerrada) etapa = 6;
        else if (p.contrato) etapa = 5;
        else if (p.situacao === "Aprovada") etapa = 4;
        else if (p.situacao === "Rascunho") etapa = 1;
        else if (p.situacao === "Em análise" && p.dias < 3) etapa = 2;
        return { id: p.codigo, etapa, cliente_id: p.cliente_id, operacao_id: p.operacao_id as number | null, cliente: p.cliente, produto: p.produto, valor: p.valor, banco: p.banco, consultor: p.consultor, dias: p.dias };
      }),
  ];

  const analises = clientes.map((c) => {
    const r = sorteio(c.id * 13);
    const score = Math.round(entre(r, 480, 860));
    const faturamento = mil(entre(r, 3000, 90000));
    const restricoes = score < 560 ? escolher(r, ["Pefin e ação judicial", "2 protestos"]) : score < 640 ? escolher(r, ["1 protesto", "Nenhuma"]) : "Nenhuma";
    return {
      cliente_id: c.id,
      cliente: c.nome,
      faturamento,
      endividamento: Math.round(entre(r, 15, score < 560 ? 80 : 55)),
      score,
      restricoes,
      limite: mil((faturamento / 100_000) * (score / 9000)),
      validade: dia(Math.round(entre(r, -5, 90))),
      risco: score >= 700 ? "Baixo" : score >= 580 ? "Médio" : "Alto",
    };
  });

  const garantias = propostas
    .filter((p) => (p.situacao === "Aprovada" || p.encerrada) && !/Sem garantia|Aval/.test(PRODUTOS.find((x) => x.nome === p.produto)?.garantia ?? ""))
    .map((p, i) => {
      const r = sorteio(p.operacao_id * 17);
      const tipo = PRODUTOS.find((x) => x.nome === p.produto)?.garantia ?? "Imóvel";
      const descricao = { Imóvel: "Galpão industrial, matrícula registrada", Veículo: "Frota de caminhões, ano 2022", Recebíveis: "Duplicatas de clientes de varejo", Equipamento: "Máquinas e silos" }[tipo] ?? tipo;
      const vence = Math.round(entre(r, -10, 300));
      return {
        codigo: cod("GR", i + 1),
        cliente_id: p.cliente_id,
        operacao_id: p.operacao_id,
        cliente: p.cliente,
        tipo,
        descricao,
        valor: Math.round(p.valor * entre(r, 1.2, 2.5)),
        vence: dia(vence),
        situacao: vence < 0 ? "Vencida" : vence < 30 ? "Vence em breve" : p.encerrada ? "Vigente" : escolher(r, ["Vigente", "Em avaliação"]),
      };
    });

  const compliance = clientes.map((c) => {
    const r = sorteio(c.id * 19);
    const item = () => (r() < 0.8 ? "Ok" : r() < 0.6 ? "Atenção" : "Falta");
    const linha = { cliente_id: c.id, cliente: c.nome, kyc: item(), listas: r() < 0.92 ? "Ok" : "Atenção", lgpd: item(), scr: item(), revisar: dia(Math.round(entre(r, -5, 240))) };
    const v = [linha.kyc, linha.listas, linha.lgpd, linha.scr];
    return { ...linha, situacao: v.includes("Falta") ? "Irregular" : v.includes("Atenção") ? "Pendente" : "Regular" };
  });

  const contratos = propostas
    .filter((p) => p.contrato)
    .map((p) => {
      const r = sorteio(p.operacao_id * 23);
      const pagas = p.encerrada ? Math.round(entre(r, 2, p.prazo)) : Math.round(entre(r, 0, 3));
      const saldo = Math.round((p.valor * (p.prazo - pagas)) / p.prazo);
      const atraso = r() < 0.15 && pagas < p.prazo;
      const situacao = pagas >= p.prazo ? "Quitado" : atraso ? "Em atraso" : r() < 0.1 ? "Renegociado" : "Em dia";
      return {
        codigo: cod("CT", p.operacao_id),
        operacao_id: p.operacao_id,
        cliente_id: p.cliente_id,
        cliente: p.cliente,
        banco: p.banco,
        produto: p.produto,
        consultor: p.consultor,
        comissaoPct: p.comissaoPct,
        liberado: p.valor,
        saldo,
        pagas,
        total: p.prazo,
        parcela: Math.round(p.valor / p.prazo),
        proximo: dia(situacao === "Em atraso" ? -Math.round(entre(r, 3, 25)) : Math.round(entre(r, 2, 28))),
        liberado_em: dia(-Math.round(pagas * 30 + entre(r, 5, 25))),
        situacao,
      };
    });

  const parcelas = contratos.flatMap((c) => {
    const lista = [];
    if (c.pagas > 0) lista.push({ contrato: c.codigo, operacao_id: c.operacao_id, cliente: c.cliente, numero: c.pagas, total: c.total, vencimento: dia(-Math.round(entre(sorteio(c.operacao_id), 20, 35))), valor: c.parcela, situacao: "Paga" });
    if (c.situacao !== "Quitado") lista.push({ contrato: c.codigo, operacao_id: c.operacao_id, cliente: c.cliente, numero: c.pagas + 1, total: c.total, vencimento: c.proximo, valor: c.parcela, situacao: c.situacao === "Em atraso" ? "Atrasada" : "A vencer" });
    return lista;
  });

  const renovacoes = contratos
    .filter((c) => c.situacao === "Quitado" || c.pagas / c.total >= 0.5)
    .map((c) => {
      const r = sorteio(c.operacao_id * 29);
      return { contrato: c.codigo, operacao_id: c.operacao_id, cliente: c.cliente, termina: dia(c.situacao === "Quitado" ? -Math.round(entre(r, 1, 40)) : Math.round((c.total - c.pagas) * 30)), saldo: c.saldo, potencial: Math.round(c.liberado * entre(r, 0.8, 1.6)), consultor: c.consultor, situacao: c.situacao === "Quitado" ? escolher(r, ["Renovado", "A contatar", "Perdido"]) : escolher(r, ["A contatar", "Em conversa"]) };
    });

  const comissoes = contratos.map((c) => {
    const r = sorteio(c.operacao_id * 31);
    const comissao = Math.round((c.liberado * c.comissaoPct) / 100);
    const previsao = Math.round(entre(r, -60, 30));
    return { contrato: c.codigo, operacao_id: c.operacao_id, cliente: c.cliente, banco: c.banco, consultor: c.consultor, liberado: c.liberado, percentual: c.comissaoPct, comissao, repasse: Math.round(comissao * 0.4), previsao: dia(previsao), situacao: previsao > 0 ? "A receber" : previsao > -20 ? "Recebida" : "Repassada" };
  });

  const nomes = [...new Set(propostas.map((p) => p.consultor))].filter((n) => n !== "Sem consultor").sort();
  const metas = nomes.map((nome) => {
    const dele = propostas.filter((p) => p.consultor === nome);
    const realizado = contratos.filter((c) => c.consultor === nome).reduce((t, c) => t + c.liberado, 0);
    const meta = mil(Math.max(1000, Math.round((realizado / 100_000) * entre(sorteio(nome.length * 37 + dele.length), 0.7, 1.4) / 500) * 500));
    return { consultor: nome, meta, realizado, propostas: dele.length, aprovadas: dele.filter((p) => p.situacao === "Aprovada" || p.encerrada).length };
  });

  const agenda = [
    ...propostas.filter((p) => p.situacao === "Em análise").slice(0, 6).map((p) => ({ quando: dia(Math.round(entre(sorteio(p.operacao_id * 41), -2, 4))), tipo: "Retorno do banco", assunto: `Cobrar resposta da ${p.codigo} (${p.banco})`, operacao_id: p.operacao_id, cliente: p.cliente, responsavel: p.consultor })),
    ...operacoes.filter((o) => o.sla === "atrasada").slice(0, 6).map((o) => ({ quando: dia(0), tipo: "Cobrar documentos", assunto: `${o.nome}: etapa ${o.etapa_nome} atrasada`, operacao_id: o.id, cliente: o.cliente_nome ?? "", responsavel: o.consultor_nome || "Sem consultor" })),
    ...parcelas.filter((p) => p.situacao === "Atrasada").map((p) => ({ quando: dia(0), tipo: "Ligação", assunto: `Parcela ${p.numero}/${p.total} do ${p.contrato} em atraso`, operacao_id: p.operacao_id, cliente: p.cliente, responsavel: contratos.find((c) => c.codigo === p.contrato)?.consultor ?? "" })),
    ...renovacoes.filter((r) => r.situacao === "A contatar").slice(0, 5).map((r) => ({ quando: dia(Math.round(entre(sorteio(r.operacao_id * 43), 1, 10))), tipo: "Renovação", assunto: `Oferecer renovação do ${r.contrato}`, operacao_id: r.operacao_id, cliente: r.cliente, responsavel: r.consultor })),
  ].map((a) => {
    const hoje = dia(0);
    return { ...a, situacao: a.quando < hoje ? "Atrasado" : a.quando === hoje ? "Hoje" : "Próximos" };
  });

  const instituicoes = INSTITUICOES_BASE.map((i) => {
    const doBanco = propostas.filter((p) => p.banco === i.nome);
    const decididas = doBanco.filter((p) => p.situacao === "Aprovada" || p.situacao === "Recusada" || p.encerrada);
    const aprovadas = decididas.filter((p) => p.situacao !== "Recusada");
    return { ...i, propostas: doBanco.length, aprovacao: decididas.length ? Math.round((aprovadas.length / decididas.length) * 100) : 0 };
  });

  return {
    CLIENTES: clientes.map((c) => c.nome),
    OPERACOES: operacoes.map((o) => `${o.cliente_nome} · ${o.nome}`),
    CONSULTORES: nomes,
    INSTITUICOES: instituicoes,
    PRODUTOS,
    PROPOSTAS: propostas,
    FUNIL: funil,
    ANALISES: analises,
    GARANTIAS: garantias,
    COMPLIANCE: compliance,
    CONTRATOS: contratos,
    PARCELAS: parcelas,
    RENOVACOES: renovacoes,
    COMISSOES: comissoes,
    METAS: metas,
    AGENDA: agenda,
  };
}

export type DadosCredito = ReturnType<typeof montar>;

/** Os dados de crédito de quem está logado: o consultor vê só os das operações dele. */
export function useCredito(): DadosCredito & { carregando: boolean } {
  const clientes = useQuery({ queryKey: ["clientes"], queryFn: () => api<{ clientes: Cliente[] }>("/clientes"), retry: false });
  const operacoes = useQuery({ queryKey: ["operacoes"], queryFn: () => api<{ operacoes: Operacao[] }>("/operacoes"), retry: false });
  const dados = useMemo(() => montar(clientes.data?.clientes ?? [], operacoes.data?.operacoes ?? []), [clientes.data, operacoes.data]);
  return { ...dados, carregando: clientes.isPending || operacoes.isPending };
}
