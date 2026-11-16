import { agora, executar, lerConfiguracoes, todos, um } from './banco.js';
import { enderecoBase } from './rede.js';

// Estado de um documento exigido na pasta da operação.
//   falta      : nada enviado
//   aguardando : o cliente enviou pelo link e falta aprovar
//   aprovado   : versão atual aprovada e dentro da validade
//   vencendo   : aprovado, mas vence dentro do prazo de aviso
//   vencido    : a versão atual passou da validade
//   recusado   : o último envio foi recusado e não há versão aprovada

const hojeISO = () => new Date().toISOString().slice(0, 10);

export function diasAte(dataISO) {
  if (!dataISO) return null;
  const alvo = new Date(`${dataISO}T00:00:00`);
  const hoje = new Date(`${hojeISO()}T00:00:00`);
  return Math.round((alvo - hoje) / 86_400_000);
}

function agruparEnvios(docs) {
  const envios = new Map();
  for (const d of docs) {
    if (!envios.has(d.envio_id)) envios.set(d.envio_id, { envio_id: d.envio_id, criado_em: d.criado_em, arquivos: [] });
    const e = envios.get(d.envio_id);
    e.arquivos.push(d);
    if (d.criado_em < e.criado_em) e.criado_em = d.criado_em;
  }
  return [...envios.values()]
    .map((e) => {
      const s = e.arquivos.map((a) => a.situacao);
      const situacao = s.includes('pendente') ? 'pendente' : s.includes('recusado') ? 'recusado' : 'aprovado';
      const validades = e.arquivos.map((a) => a.validade).filter(Boolean).sort();
      const primeiro = e.arquivos[0];
      return {
        ...e,
        situacao,
        validade: validades[0] ?? null,
        origem: primeiro.origem,
        enviado_por: primeiro.enviado_por,
        analisado_por: primeiro.analisado_por,
        analisado_em: primeiro.analisado_em,
        motivo_recusa: [...new Set(e.arquivos.map((a) => a.motivo_recusa).filter(Boolean))].join(' · '),
        observacao: primeiro.observacao,
        solicitacao_id: primeiro.solicitacao_id,
      };
    })
    .sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
}

export function estadoDoItem(envios, avisoDias) {
  const atual = envios.find((e) => e.situacao === 'aprovado') ?? null;
  const maisNovos = atual ? envios.filter((e) => e.criado_em > atual.criado_em) : envios;
  const pendente = maisNovos.find((e) => e.situacao === 'pendente') ?? null;
  const recusado = !pendente ? (maisNovos.find((e) => e.situacao === 'recusado') ?? null) : null;
  let estado = 'falta';
  let dias = null;
  if (pendente) estado = 'aguardando';
  else if (atual) {
    dias = diasAte(atual.validade);
    if (dias !== null && dias < 0) estado = 'vencido';
    else if (dias !== null && dias <= avisoDias) estado = 'vencendo';
    else estado = 'aprovado';
  } else if (recusado) estado = 'recusado';
  return { estado, dias_para_vencer: dias, atual, pendente, recusado };
}

// A pasta de uma operação: cada documento exigido com seu estado e versões, mais os avulsos.
export async function pastaDaOperacao(operacaoId) {
  const avisoDias = Number(lerConfiguracoes().aviso_vencimento_dias) || 30;
  const itens = await todos('select * from operacao_itens where operacao_id = ? and removido_em is null order by ordem, id', operacaoId);
  const docs = await todos('select * from documentos where operacao_id = ? and excluido_em is null order by criado_em desc, id desc', operacaoId);
  const porItem = new Map();
  for (const d of docs) {
    const chave = itens.some((i) => i.id === d.item_id) ? d.item_id : 'avulsos';
    if (!porItem.has(chave)) porItem.set(chave, []);
    porItem.get(chave).push(d);
  }
  const lista = itens.map((item) => {
    const envios = agruparEnvios(porItem.get(item.id) ?? []);
    const estado = estadoDoItem(envios, avisoDias);
    return {
      ...item,
      obrigatorio: !!item.obrigatorio,
      frente_verso: !!item.frente_verso,
      exige_validade: !!item.exige_validade,
      ...estado,
      versoes: envios,
    };
  });
  const avulsos = agruparEnvios(porItem.get('avulsos') ?? []);
  return { itens: lista, avulsos, resumo: resumir(lista) };
}

export function resumir(itens) {
  const obrigatorios = itens.filter((i) => i.obrigatorio);
  const ok = (i) => i.estado === 'aprovado' || i.estado === 'vencendo';
  return {
    total: itens.length,
    obrigatorios: obrigatorios.length,
    obrigatorios_ok: obrigatorios.filter(ok).length,
    aprovados: itens.filter(ok).length,
    aguardando: itens.filter((i) => i.estado === 'aguardando').length,
    vencidos: itens.filter((i) => i.estado === 'vencido').length,
    vencendo: itens.filter((i) => i.estado === 'vencendo').length,
    recusados: itens.filter((i) => i.estado === 'recusado').length,
    faltando: itens.filter((i) => i.estado === 'falta').length,
  };
}

// --- Solicitações -----------------------------------------------------------

export function lerItensSolicitacao(s) {
  try {
    const ids = JSON.parse(s.itens || '[]');
    return Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

// Cada item pedido: faltando, em_analise, aprovado ou recusado (com o motivo).
export async function itensDaSolicitacao(s) {
  const ids = lerItensSolicitacao(s);
  if (ids.length === 0) return [];
  const pasta = await pastaDaOperacao(s.operacao_id);
  return ids
    .map((id) => pasta.itens.find((i) => i.id === id))
    .filter(Boolean)
    .map((item) => {
      const doPedido = item.versoes.filter((v) => v.solicitacao_id === s.id);
      const ultimo = doPedido[0] ?? null;
      let estado = 'faltando';
      if (ultimo) estado = ultimo.situacao === 'pendente' ? 'em_analise' : ultimo.situacao === 'aprovado' ? 'aprovado' : 'recusado';
      // Enviado por dentro do sistema depois do pedido: conta como resolvido.
      if ((estado === 'faltando' || estado === 'recusado') && item.atual && item.atual.criado_em > s.criado_em) estado = 'aprovado';
      return {
        id: item.id,
        nome: item.nome,
        descricao: item.descricao,
        grupo: item.grupo,
        frente_verso: item.frente_verso,
        exige_validade: item.exige_validade,
        obrigatorio: item.obrigatorio,
        estado,
        motivo_recusa: estado === 'recusado' ? (ultimo?.motivo_recusa ?? '') : '',
      };
    });
}

export function situacaoExibida(s) {
  if (s.situacao === 'aguardando' && s.expira_em < agora()) return 'vencida';
  return s.situacao;
}

// Recalcula a situação do pedido pelo estado dos itens.
export async function recalcularSolicitacao(id) {
  const s = await um('select * from solicitacoes where id = ?', id);
  if (!s || s.situacao === 'cancelada' || s.situacao === 'concluida') return s;
  const itens = await itensDaSolicitacao(s);
  let situacao = 'aguardando';
  if (itens.length > 0 && itens.every((i) => i.estado === 'aprovado')) situacao = 'concluida';
  else if (itens.length > 0 && itens.every((i) => i.estado === 'aprovado' || i.estado === 'em_analise')) situacao = 'em_analise';
  if (situacao !== s.situacao) {
    await executar(
      'update solicitacoes set situacao = ?, concluida_em = ?, atualizado_em = ? where id = ?',
      situacao, situacao === 'concluida' ? agora() : null, agora(), id,
    );
  }
  return await um('select * from solicitacoes where id = ?', id);
}

// Ao aprovar/recusar ou enviar por dentro, o pedido aberto da operação se atualiza.
export async function recalcularPedidosDaOperacao(operacaoId) {
  for (const s of await todos("select id from solicitacoes where operacao_id = ? and situacao in ('aguardando', 'em_analise')", operacaoId)) {
    await recalcularSolicitacao(s.id);
  }
}

// O pedido como as telas mostram. O link só vai para quem pode pedir documentos.
export async function solicitacaoCompleta(s, comLink) {
  const o = await um('select o.id, o.nome, o.cliente_id, c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone, c.contato as cliente_contato from operacoes o join clientes c on c.id = o.cliente_id where o.id = ?', s.operacao_id);
  const itens = await itensDaSolicitacao(s);
  return {
    id: s.id,
    operacao_id: s.operacao_id,
    operacao_nome: o?.nome ?? '',
    cliente_id: o?.cliente_id ?? null,
    cliente_nome: o?.cliente_nome ?? '',
    cliente_email: o?.cliente_email ?? '',
    cliente_telefone: o?.cliente_telefone ?? '',
    cliente_contato: o?.cliente_contato ?? '',
    mensagem: s.mensagem,
    situacao: situacaoExibida(s),
    expira_em: s.expira_em,
    ultimo_envio_em: s.ultimo_envio_em,
    criado_por: s.criado_por,
    criado_em: s.criado_em,
    concluida_em: s.concluida_em,
    cancelado_em: s.cancelado_em,
    cancelado_por: s.cancelado_por,
    itens,
    enviados: itens.filter((i) => i.estado === 'em_analise' || i.estado === 'aprovado').length,
    aprovados: itens.filter((i) => i.estado === 'aprovado').length,
    link: comLink ? `${enderecoBase()}/#/enviar/${s.token}` : null,
  };
}
