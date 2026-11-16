// Teste de ponta a ponta do servidor: sobe o Hub com um Postgres de teste novo (PGlite) e uma pasta
// de arquivos temporária, e percorre o sistema pela API.
//   node scripts/teste-api.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-teste-'));
const PORTA = 3197;
const BASE = `http://127.0.0.1:${PORTA}/api`;

const servidor = spawn(process.execPath, ['server/index.js'], {
  cwd: raiz,
  env: { ...process.env, HUB_DADOS: dados, PORT: String(PORTA), HUB_PORTA_BANCO: '4197', DATABASE_URL: '', SUPABASE_URL: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
servidor.stdout.on('data', (d) => (logs += d));
servidor.stderr.on('data', (d) => (logs += d));

let falhas = 0;
let total = 0;
const ok = (cond, nome, extra = '') => {
  total += 1;
  if (!cond) falhas += 1;
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${nome}${extra ? ` — ${extra}` : ''}`);
};

const sessoes = {};
async function pedir(quem, metodo, caminho, corpo) {
  const cab = { 'x-hub': '1' };
  if (sessoes[quem]) cab.Authorization = `Bearer ${sessoes[quem]}`;
  let body;
  if (corpo instanceof FormData) body = corpo;
  else if (corpo !== undefined) {
    cab['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }
  const r = await fetch(`${BASE}${caminho}`, { method: metodo, headers: cab, body });
  const json = await r.json().catch(() => ({}));
  if (typeof json.token === 'string') sessoes[quem] = json.token;
  return { status: r.status, ...json };
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const arquivo = (conteudo, nome, tipo) => new File([conteudo], nome, { type: tipo });

try {
  for (let i = 0; i < 120; i += 1) {
    try {
      if ((await fetch(`${BASE}/sessao`)).ok) break;
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 500));
  }

  // --- Sessão ---
  let r = await pedir('admin', 'GET', '/sessao');
  ok(r.status === 200 && r.primeiro_acesso === true, 'primeiro acesso disponível', JSON.stringify(r).slice(0, 120));
  r = await pedir('admin', 'POST', '/sessao/primeiro-acesso', { nome: 'Admin Teste', email: 'admin@teste.local', senha: 'senha-forte-1' });
  ok(r.status === 200 && !!sessoes.admin, 'cria administrador e recebe token');
  r = await pedir('admin', 'GET', '/sessao');
  ok(r.usuario?.admin === true, 'sessão pelo token');
  r = await pedir('anon', 'GET', '/clientes');
  ok(r.status === 401, 'sem token não entra');
  r = await pedir('anon', 'POST', '/sessao/entrar', { email: 'admin@teste.local', senha: 'errada' });
  ok(r.status === 401, 'senha errada recusada');
  r = await fetch(`${BASE}/clientes`, { method: 'POST', headers: { Authorization: `Bearer ${sessoes.admin}`, 'Content-Type': 'application/json' }, body: '{}' });
  ok(r.status === 403, 'pedido sem x-hub recusado');

  // --- Cadastros ---
  r = await pedir('admin', 'POST', '/tipos-documento', { nome: 'Contrato social', grupo: 'Empresa' });
  ok(r.status === 200 && r.tipo?.id, 'cria tipo de documento');
  const tipoContrato = r.tipo?.id;
  r = await pedir('admin', 'POST', '/perfis-documento', {
    nome: 'Capital de giro',
    itens: [{ tipo_id: tipoContrato }, { nome: 'RG ou CNH do sócio', frente_verso: true }, { nome: 'Certidão negativa', exige_validade: true }],
    etapas: [{ nome: 'Documentação', prazo_dias: 5 }, { nome: 'Análise', prazo_dias: 3 }, { nome: 'Concluída', prazo_dias: 0 }],
  });
  ok(r.status === 200, 'cria predefinição com etapas', r.erro);
  r = await pedir('admin', 'GET', '/perfis-documento');
  const perfil = r.perfis?.find((p) => p.nome === 'Capital de giro');
  ok(perfil?.itens?.length === 3 && perfil?.etapas?.length === 3, 'predefinição com 3 documentos e 3 etapas');

  r = await pedir('admin', 'GET', '/perfis-acesso');
  const perfilConsultor = r.perfis?.find((p) => p.nome === 'Consultor');
  ok(!!perfilConsultor, 'perfis de acesso semeados');
  r = await pedir('admin', 'POST', '/usuarios', { nome: 'Consultora Ana', email: 'ana@teste.local', senha: 'senha-forte-2', perfil_acesso_id: perfilConsultor?.id });
  ok(r.status === 200 && r.usuario?.id, 'cria consultora', r.erro);
  const ana = r.usuario?.id;
  r = await pedir('admin', 'POST', '/usuarios', { nome: 'Consultor Bruno', email: 'bruno@teste.local', senha: 'senha-forte-3', perfil_acesso_id: perfilConsultor?.id });
  const bruno = r.usuario?.id;
  r = await pedir('ana', 'POST', '/sessao/entrar', { email: 'ANA@teste.local', senha: 'senha-forte-2' });
  ok(r.status === 200 && !!sessoes.ana, 'consultora entra (e-mail sem diferenciar maiúsculas)');
  await pedir('bruno', 'POST', '/sessao/entrar', { email: 'bruno@teste.local', senha: 'senha-forte-3' });

  r = await pedir('admin', 'POST', '/clientes', { nome: 'Acme Logística', documento: '12.345.678/0001-90', contato: 'Maria Souza', telefone: '(11) 99999-0000' });
  ok(r.status === 200 && r.cliente?.id, 'cria cliente', r.erro);
  const cliente = r.cliente?.id;
  r = await pedir('admin', 'POST', '/clientes', { nome: 'Acme Logística' });
  ok(r.status === 200 && r.cliente?.pasta === 'Acme Logística (2)', 'cliente com nome repetido ganha pasta (2)', r.cliente?.pasta);
  const cliente2 = r.cliente?.id;

  // --- Operação ---
  r = await pedir('admin', 'POST', `/clientes/${cliente}/operacoes`, { nome: 'Operação São Paulo', perfil_documento_id: perfil?.id, consultor_id: ana });
  ok(r.status === 200 && r.operacao?.id, 'cria operação com predefinição', r.erro);
  const op = r.operacao?.id;
  r = await pedir('admin', 'GET', `/operacoes/${op}`);
  ok(r.operacao?.etapa_nome === 'Documentação' && r.operacao?.consultor_nome === 'Consultora Ana', 'operação começa na 1ª etapa com a consultora');
  ok(r.itens?.length === 3, 'operação copia os 3 documentos', JSON.stringify(Object.keys(r)));
  const itens = r.itens ?? [];
  const itemContrato = itens.find((i) => i.nome === 'Contrato social');
  const itemRg = itens.find((i) => i.frente_verso);
  const itemCertidao = itens.find((i) => i.exige_validade);
  const etapas = r.operacao?.etapas ?? [];

  r = await pedir('bruno', 'GET', `/operacoes/${op}`);
  ok(r.status === 403 || r.status === 404, 'outro consultor não vê a operação', String(r.status));
  r = await pedir('ana', 'GET', '/operacoes');
  ok(r.operacoes?.length === 1, 'consultora vê só a dela');
  r = await pedir('bruno', 'GET', '/operacoes');
  ok(r.operacoes?.length === 0, 'outro consultor não vê nenhuma');

  // --- Arquivos ---
  let fd = new FormData();
  fd.append('item_id', String(itemContrato?.id));
  fd.append('arquivos', arquivo(PDF, 'contrato.pdf', 'application/pdf'));
  r = await pedir('ana', 'POST', `/operacoes/${op}/documentos`, fd);
  ok(r.status === 200 && r.envio_id, 'consultora envia PDF', r.erro);
  fd = new FormData();
  fd.append('item_id', String(itemContrato?.id));
  fd.append('arquivos', arquivo(Buffer.from('não sou pdf'), 'falso.pdf', 'application/pdf'));
  r = await pedir('ana', 'POST', `/operacoes/${op}/documentos`, fd);
  ok(r.status === 400, 'arquivo falso recusado');
  fd = new FormData();
  fd.append('item_id', String(itemContrato?.id));
  fd.append('arquivos', arquivo(Buffer.from('x'), 'planilha.xlsx', 'application/octet-stream'));
  r = await pedir('ana', 'POST', `/operacoes/${op}/documentos`, fd);
  ok(r.status === 400, 'formato fora do padrão recusado');
  fd = new FormData();
  fd.append('item_id', String(itemContrato?.id));
  fd.append('arquivos', arquivo(PDF, 'contrato-v2.pdf', 'application/pdf'));
  await pedir('admin', 'POST', `/operacoes/${op}/documentos`, fd);

  r = await pedir('ana', 'GET', `/operacoes/${op}`);
  const contrato = r.itens?.find((i) => i.id === itemContrato?.id);
  ok(contrato?.estado === 'aprovado' && contrato?.versoes?.length === 2, 'documento aprovado com 2 versões');
  const doc = contrato?.atual?.arquivos?.[0];
  ok(/Contrato social \(2\)\.pdf$/.test(doc?.caminho ?? ''), 'segunda versão vira "Contrato social (2).pdf"', doc?.caminho);
  const pastaOp = path.join(dados, 'Clientes', 'Acme Logistica', 'Operacao Sao Paulo');
  ok(fs.existsSync(path.join(pastaOp, 'Contrato social.pdf')), 'arquivo guardado na pasta sem acentos', pastaOp);

  r = await pedir('ana', 'GET', `/documentos/${doc?.id}/arquivo`);
  ok(r.status === 200 && r.url, 'link temporário do arquivo');
  let baixado = await fetch(new URL(r.url, BASE));
  const bytes = Buffer.from(await baixado.arrayBuffer());
  ok(baixado.ok && bytes.subarray(0, 4).toString() === '%PDF', 'link entrega o PDF');
  r = await pedir('bruno', 'GET', `/documentos/${doc?.id}/arquivo`);
  ok(r.status === 403 || r.status === 404, 'outro consultor não abre o arquivo', String(r.status));

  // Renomear a operação move os arquivos.
  r = await pedir('admin', 'PUT', `/operacoes/${op}`, { nome: 'Operação Santos', situacao: 'ativa' });
  ok(r.status === 200, 'renomeia a operação', r.erro);
  ok(fs.existsSync(path.join(dados, 'Clientes', 'Acme Logistica', 'Operacao Santos', 'Contrato social.pdf')), 'arquivos foram para a pasta nova');
  r = await pedir('ana', 'GET', `/documentos/${doc?.id}/arquivo`);
  baixado = await fetch(new URL(r.url, BASE));
  ok(baixado.ok, 'arquivo continua abrindo depois de renomear');

  // --- Pedido para o cliente (link) ---
  r = await pedir('ana', 'POST', `/operacoes/${op}/solicitacoes`, { item_ids: [itemRg?.id, itemCertidao?.id], mensagem: 'Obrigado!' });
  ok(r.status === 200 && r.solicitacao?.link?.includes('#/enviar/'), 'cria pedido com link', r.erro ?? r.solicitacao?.link);
  const token = r.solicitacao?.link?.split('/enviar/')[1];
  r = await pedir('anon', 'GET', `/publico/${token}`);
  ok(r.status === 200 && r.itens?.length === 2, 'cliente abre o link sem login', r.erro);
  fd = new FormData();
  fd.append('item_id', String(itemRg?.id));
  fd.append('frente', arquivo(PNG, 'frente.png', 'image/png'));
  r = await pedir('anon', 'POST', `/publico/${token}/enviar`, fd);
  ok(r.status === 400, 'frente e verso exige os dois lados');
  fd.append('verso', arquivo(PNG, 'verso.png', 'image/png'));
  r = await pedir('anon', 'POST', `/publico/${token}/enviar`, fd);
  ok(r.status === 200, 'cliente envia frente e verso', r.erro);
  fd = new FormData();
  fd.append('item_id', String(itemCertidao?.id));
  fd.append('validade', '2030-12-31');
  fd.append('arquivos', arquivo(PDF, 'certidao.pdf', 'application/pdf'));
  r = await pedir('anon', 'POST', `/publico/${token}/enviar`, fd);
  ok(r.status === 200, 'cliente envia certidão com validade', r.erro);

  r = await pedir('ana', 'GET', '/aprovacao');
  const fila = r.envios ?? r.itens ?? [];
  ok(fila.length === 2, 'fila de aprovação com 2 envios', JSON.stringify(Object.keys(r)));
  const envioRg = fila.find((e) => e.item_id === itemRg?.id || e.item_nome?.startsWith('RG'));
  const envioCert = fila.find((e) => e !== envioRg);
  r = await pedir('ana', 'POST', `/aprovacao/${envioRg?.envio_id}`, { acao: 'recusar', motivo: 'Foto ilegível' });
  ok(r.status === 200, 'recusa com motivo', r.erro);
  r = await pedir('ana', 'POST', `/aprovacao/${envioCert?.envio_id}`, { acao: 'aprovar' });
  ok(r.status === 200, 'aprova certidão', r.erro);
  r = await pedir('anon', 'GET', `/publico/${token}`);
  const rg = r.itens?.find((i) => i.id === itemRg?.id);
  ok(rg?.estado === 'recusado' && rg?.motivo_recusa === 'Foto ilegível', 'cliente vê o motivo da recusa');
  r = await pedir('ana', 'GET', '/solicitacoes');
  ok(r.solicitacoes?.length === 1 && r.solicitacoes[0].situacao === 'aguardando', 'pedido continua aguardando o RG');

  // --- Etapas, transferência e SLA ---
  r = await pedir('ana', 'POST', `/operacoes/${op}/etapa`, { etapa_id: etapas[1]?.id });
  ok(r.status === 200, 'muda para Análise', r.erro);
  r = await pedir('ana', 'POST', `/operacoes/${op}/transferir`, { consultor_id: bruno, motivo: 'Férias' });
  ok(r.status === 403, 'consultor não transfere');
  r = await pedir('admin', 'POST', `/operacoes/${op}/transferir`, { consultor_id: bruno, motivo: 'Férias da Ana' });
  ok(r.status === 200, 'admin transfere com motivo', r.erro);
  r = await pedir('ana', 'GET', `/operacoes/${op}`);
  ok(r.status === 403 || r.status === 404, 'depois de transferir, a anterior perde o acesso');
  r = await pedir('bruno', 'GET', '/operacoes');
  ok(r.operacoes?.length === 1 && r.operacoes[0].etapa_nome === 'Análise', 'novo consultor vê a operação na Análise');
  r = await pedir('admin', 'GET', '/transferencias');
  ok(r.transferencias?.length === 1 && r.transferencias[0].motivo === 'Férias da Ana', 'transferência registrada');
  r = await pedir('admin', 'GET', '/sla?dias=90');
  ok(r.status === 200 && Array.isArray(r.consultores), 'SLA calcula', r.erro);
  r = await pedir('admin', 'POST', `/operacoes/${op}/etapa`, { etapa_id: etapas[2]?.id });
  r = await pedir('admin', 'GET', `/operacoes/${op}`);
  ok(r.operacao?.situacao === 'encerrada', 'etapa final encerra a operação');

  // --- Financeiro e painel ---
  r = await pedir('admin', 'POST', '/financeiro/lancamentos', { tipo: 'receita', descricao: 'Honorários', valor_centavos: 150000, vencimento: '2026-11-20', operacao_id: op });
  ok(r.status === 200 && r.lancamento?.id, 'lança receita', r.erro);
  const lanc = r.lancamento?.id;
  await pedir('admin', 'POST', '/financeiro/lancamentos', { tipo: 'despesa', descricao: 'Cartório', valor_centavos: 25000, vencimento: '2026-11-10' });
  r = await pedir('admin', 'POST', `/financeiro/lancamentos/${lanc}/pagar`, { pago_em: '2026-11-16' });
  ok(r.status === 200, 'marca como pago', r.erro);
  r = await pedir('admin', 'GET', '/financeiro/lancamentos?mes=2026-11');
  ok(r.lancamentos?.length === 2 && typeof r.lancamentos[0].valor_centavos === 'number', 'lista do mês com valores numéricos');
  r = await pedir('bruno', 'GET', '/financeiro/lancamentos');
  ok(r.status === 403, 'consultor sem financeiro liberado');
  r = await pedir('admin', 'GET', '/painel');
  ok(r.status === 200 && r.sla, 'painel do admin', r.erro);
  r = await pedir('bruno', 'GET', '/painel');
  ok(r.status === 200, 'painel do consultor', r.erro);
  r = await pedir('admin', 'GET', '/documentos-geral');
  ok(r.status === 200, 'área de documentos', r.erro);
  r = await pedir('admin', 'GET', '/historico');
  ok(r.status === 200, 'histórico', r.erro);

  // --- Parceiros ---
  r = await pedir('admin', 'POST', '/parceiros', { nome: 'Banco Teste', tipo: 'Banco', contato_nome: 'Paula', telefone: '(11) 3100-2200', email: 'paula@banco.teste', comissao_padrao: '2,5', prazo_resposta_dias: 6 });
  ok(r.status === 200 && r.parceiro?.comissao_padrao === 2.5, 'cadastra parceiro com contato e comissão', r.erro);
  const parceiro = r.parceiro?.id;
  r = await pedir('admin', 'POST', '/parceiros', { nome: 'banco teste' });
  ok(r.status === 409, 'não aceita parceiro com o mesmo nome');
  r = await pedir('admin', 'PUT', `/parceiros/${parceiro}`, { nome: 'Banco Teste', tipo: 'Cooperativa', ativo: false });
  ok(r.status === 200 && r.parceiro?.tipo === 'Cooperativa' && r.parceiro?.ativo === false, 'edita e inativa parceiro', r.erro);
  r = await pedir('bruno', 'GET', '/parceiros');
  ok(r.status === 403, 'consultor sem Parceiros liberado não vê');
  r = await pedir('admin', 'DELETE', `/parceiros/${parceiro}`);
  ok(r.status === 200, 'exclui parceiro', r.erro);

  // --- Clientes, configurações, exclusões ---
  r = await pedir('admin', 'GET', '/clientes');
  ok(r.clientes?.length === 2, 'lista de clientes');
  r = await pedir('admin', 'GET', `/clientes/${cliente}`);
  ok(r.operacoes?.[0]?.sla && r.operacoes[0].codigo, 'resumo das operações no cliente traz prazo e código');
  r = await pedir('admin', 'PUT', '/configuracoes', { empresa_nome: 'Elev Muniz', endereco_publico: 'https://hub.exemplo.com.br', link_validade_dias: 7, tamanho_maximo_mb: 20, aviso_vencimento_dias: 30, formatos_aceitos: 'pdf,png,jpeg' });
  ok(r.status === 200, 'salva configurações', r.erro);
  r = await pedir('admin', 'GET', '/configuracoes');
  ok(r.valores?.endereco_publico === 'https://hub.exemplo.com.br' || r.configuracoes?.endereco_publico === 'https://hub.exemplo.com.br', 'configuração gravada', JSON.stringify(r).slice(0, 160));
  r = await pedir('admin', 'DELETE', `/clientes/${cliente2}`);
  ok(r.status === 200, 'exclui cliente sem operações', r.erro);
  r = await pedir('admin', 'DELETE', `/clientes/${cliente}`);
  ok(r.status !== 200, 'não exclui cliente com documentos');

  // --- Dados de exemplo ---
  r = await pedir('admin', 'POST', '/exemplo', {});
  ok(r.status === 200, 'cria dados de exemplo', r.erro);
  r = await pedir('admin', 'GET', '/operacoes');
  ok(r.operacoes?.length > 5, 'exemplos aparecem nas operações', String(r.operacoes?.length));
  r = await pedir('admin', 'GET', '/parceiros');
  ok(r.parceiros?.length === 5 && r.parceiros.every((p) => p.exemplo), 'exemplos trazem 5 parceiros', String(r.parceiros?.length));
  r = await pedir('admin', 'DELETE', '/exemplo');
  ok(r.status === 200, 'remove dados de exemplo', r.erro);
  r = await pedir('admin', 'GET', '/clientes');
  ok(r.clientes?.length === 1, 'cliente do usuário continua');
  r = await pedir('admin', 'GET', '/parceiros');
  ok(r.parceiros?.length === 0, 'parceiros de exemplo saem junto');

  // Troca de senha derruba a sessão antiga.
  const antigo = sessoes.bruno;
  r = await pedir('bruno', 'PUT', '/sessao/senha', { senha_atual: 'senha-forte-3', nova_senha: 'senha-nova-33' });
  ok(r.status === 200 && sessoes.bruno !== antigo, 'troca de senha devolve sessão nova', r.erro);
  sessoes.velha = antigo;
  r = await pedir('velha', 'GET', '/operacoes');
  ok(r.status === 401, 'sessão antiga cai após trocar a senha');
} catch (erro) {
  falhas += 1;
  console.error('ERRO NO TESTE:', erro);
} finally {
  servidor.kill();
  await new Promise((r) => setTimeout(r, 500));
  fs.rmSync(dados, { recursive: true, force: true });
}

if (falhas) {
  console.log(`\n${falhas} de ${total} falharam. Log do servidor:\n${logs.slice(-4000)}`);
  process.exit(1);
}
console.log(`\nTUDO CERTO (${total} verificações)`);
