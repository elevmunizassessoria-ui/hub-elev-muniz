import { agora, executar, todos, um } from './banco.js';

const DIA = 86_400_000;

// Etapas de quem cria uma operação sem predefinição.
const ETAPAS_PADRAO = [
  { nome: 'Documentação', prazo_dias: 5, final: 0 },
  { nome: 'Análise', prazo_dias: 3, final: 0 },
  { nome: 'Em andamento', prazo_dias: 15, final: 0 },
  { nome: 'Concluída', prazo_dias: 0, final: 1 },
];

export const codigoOperacao = (id) => `OP${String(id).padStart(5, '0')}`;
export const diasEntre = (de, ate = agora()) => (new Date(ate) - new Date(de)) / DIA;

async function abrirPassagem(operacaoId, etapa, consultor, quando) {
  await executar(
    `insert into etapa_passagens (operacao_id, etapa_id, etapa_nome, prazo_dias, final, consultor_id, consultor_nome, entrou_em)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    operacaoId, etapa.id, etapa.nome, etapa.prazo_dias, etapa.final, consultor?.id ?? null, consultor?.nome ?? '', quando,
  );
}

const fecharPassagem = async (operacaoId, quando) => executar('update etapa_passagens set saiu_em = ? where operacao_id = ? and saiu_em is null', quando, operacaoId);

// Copia as etapas da predefinição para a operação e abre a primeira.
export async function abrirEtapas(operacaoId, perfilId, consultor, quando) {
  const modelo = perfilId ? await todos('select nome, prazo_dias, final from modelo_etapas where perfil_id = ? order by ordem, id', perfilId) : [];
  for (const [ordem, e] of (modelo.length ? modelo : ETAPAS_PADRAO).entries()) {
    await executar('insert into operacao_etapas (operacao_id, nome, prazo_dias, ordem, final) values (?, ?, ?, ?, ?)', operacaoId, e.nome, e.prazo_dias, ordem, e.final);
  }
  const primeira = await um('select * from operacao_etapas where operacao_id = ? order by ordem limit 1', operacaoId);
  await executar('update operacoes set etapa_id = ? where id = ?', primeira.id, operacaoId);
  await abrirPassagem(operacaoId, primeira, consultor, quando);
}

async function consultorDe(o) {
  return o.consultor_id ? await um('select id, nome from usuarios where id = ?', o.consultor_id) : null;
}

// Muda de etapa. A etapa final encerra a operação; sair dela reabre.
export async function moverEtapa(o, etapa, quando = agora()) {
  await fecharPassagem(o.id, quando);
  await abrirPassagem(o.id, etapa, await consultorDe(o), quando);
  await executar(
    'update operacoes set etapa_id = ?, situacao = ?, concluida_em = ?, atualizado_em = ? where id = ?',
    etapa.id, etapa.final ? 'encerrada' : 'ativa', etapa.final ? quando : null, quando, o.id,
  );
}

// Na transferência, o tempo até aqui fica com quem estava; o novo consultor começa um período novo.
export async function trocarConsultor(o, novo, quando = agora()) {
  const etapa = await um('select * from operacao_etapas where id = ?', o.etapa_id);
  await fecharPassagem(o.id, quando);
  if (etapa) await abrirPassagem(o.id, etapa, novo, quando);
  await executar('update operacoes set consultor_id = ?, atualizado_em = ? where id = ?', novo.id, quando, o.id);
}

// Como a operação está agora: etapa, dias na etapa, prazo e situação do prazo.
export async function operacaoLinha(o) {
  const etapas = (await todos('select id, nome, prazo_dias, ordem, final from operacao_etapas where operacao_id = ? order by ordem', o.id)).map((e) => ({ ...e, final: !!e.final }));
  const etapa = etapas.find((e) => e.id === o.etapa_id) ?? null;
  const consultor = await consultorDe(o);
  const periodos = etapa ? await todos('select entrou_em, saiu_em from etapa_passagens where operacao_id = ? and etapa_id = ?', o.id, etapa.id) : [];
  const dias = periodos.reduce((t, p) => t + diasEntre(p.entrou_em, p.saiu_em ?? undefined), 0);
  const prazo = etapa?.prazo_dias ?? 0;
  let sla = 'sem_prazo';
  if (o.situacao !== 'ativa' || etapa?.final) sla = 'encerrada';
  else if (prazo > 0) sla = dias > prazo ? 'atrasada' : dias >= prazo * 0.8 ? 'perto' : 'no_prazo';
  return {
    codigo: codigoOperacao(o.id),
    consultor_nome: consultor?.nome ?? '',
    etapas,
    etapa_nome: etapa?.nome ?? '',
    etapa_ordem: etapa?.ordem ?? 0,
    prazo_dias: prazo,
    dias_na_etapa: Math.round(dias * 10) / 10,
    sla,
  };
}

// --- Medição ------------------------------------------------------------------

const pct = (dentro, total) => (total ? Math.round((dentro / total) * 100) : null);
const media = (lista) => (lista.length ? Math.round((lista.reduce((a, b) => a + b, 0) / lista.length) * 10) / 10 : null);

// SLA: por consultor (cada período dele), por processo e por etapa (a soma dos períodos da operação na etapa).
export async function medirSla(usuario, dias = 90) {
  const desde = dias > 0 ? new Date(Date.now() - dias * DIA).toISOString() : '0000';
  const linhas = await todos(
    `select p.*, o.situacao, o.perfil_documento_nome as processo, o.consultor_id as dono
       from etapa_passagens p join operacoes o on o.id = p.operacao_id
      where p.final = 0 and p.prazo_dias > 0 and (p.saiu_em is null or p.saiu_em >= ?)
        and not (p.saiu_em is null and o.situacao <> 'ativa')`,
    desde,
  );
  const dele = usuario.admin ? linhas : linhas.filter((l) => l.consultor_id === usuario.id);

  const porConsultor = new Map();
  for (const l of dele) {
    if (!l.consultor_id) continue;
    const chave = l.consultor_id;
    if (!porConsultor.has(chave)) porConsultor.set(chave, { consultor_id: l.consultor_id, nome: l.consultor_nome || 'Sem consultor', periodos: 0, dentro: 0, atrasadas_agora: 0, tempos: [] });
    const c = porConsultor.get(chave);
    const d = diasEntre(l.entrou_em, l.saiu_em ?? undefined);
    c.periodos += 1;
    if (d <= l.prazo_dias) c.dentro += 1;
    if (!l.saiu_em && d > l.prazo_dias) c.atrasadas_agora += 1;
    c.tempos.push(d);
  }
  const consultores = [...porConsultor.values()]
    .map(({ tempos, ...c }) => ({ ...c, fora: c.periodos - c.dentro, sla: pct(c.dentro, c.periodos), tempo_medio: media(tempos) }))
    .sort((a, b) => (b.sla ?? -1) - (a.sla ?? -1));

  // Operação + etapa: soma dos períodos, mesmo com transferência no meio.
  const visiveis = usuario.admin ? linhas : linhas.filter((l) => l.dono === usuario.id);
  const somas = new Map();
  for (const l of visiveis) {
    const chave = `${l.operacao_id}|${l.etapa_id}`;
    if (!somas.has(chave)) somas.set(chave, { processo: l.processo || 'Sem predefinição', etapa: l.etapa_nome, ordem: l.etapa_id, prazo: l.prazo_dias, dias: 0, aberta: false });
    const s = somas.get(chave);
    s.dias += diasEntre(l.entrou_em, l.saiu_em ?? undefined);
    if (!l.saiu_em) s.aberta = true;
  }
  const agrupar = (campo) => {
    const m = new Map();
    for (const s of somas.values()) {
      if (!m.has(s[campo])) m.set(s[campo], { nome: s[campo], total: 0, dentro: 0, tempos: [], prazos: [], abertas: 0, ordem: s.ordem });
      const g = m.get(s[campo]);
      g.total += 1;
      if (s.dias <= s.prazo) g.dentro += 1;
      if (s.aberta) g.abertas += 1;
      g.tempos.push(s.dias);
      g.prazos.push(s.prazo);
    }
    return [...m.values()].map(({ tempos, prazos, ...g }) => ({ ...g, fora: g.total - g.dentro, sla: pct(g.dentro, g.total), tempo_medio: media(tempos), prazo_medio: media(prazos) }));
  };
  const geralTotal = dele.length;
  const geralDentro = dele.filter((l) => diasEntre(l.entrou_em, l.saiu_em ?? undefined) <= l.prazo_dias).length;
  return {
    dias,
    geral: { sla: pct(geralDentro, geralTotal), total: geralTotal, dentro: geralDentro, fora: geralTotal - geralDentro },
    consultores,
    processos: agrupar('processo').sort((a, b) => (a.sla ?? 101) - (b.sla ?? 101)),
    etapas: agrupar('etapa').sort((a, b) => a.ordem - b.ordem),
  };
}
