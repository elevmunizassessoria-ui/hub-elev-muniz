import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { agora, emTransacao, executar, todos, um } from './banco.js';
import { apagarPasta, criarPasta, gravarArquivo, juntar, nomeLivre, pastaLivre } from './arquivos.js';
import { nomeSeguro } from './caminhos.js';
import { recalcularSolicitacao } from './regras.js';
import { gerarCodigoAleatorio, gerarHashSenha } from './seguranca.js';

/*
 * Dados de exemplo para ver o sistema cheio: clientes, operações, documentos (arquivos de
 * verdade nas pastas), pedidos, aprovações e usuários. Tudo fica marcado (coluna `exemplo`)
 * e sai com removerDadosExemplo(), inclusive as pastas.
 */

const DIA = 86_400_000;

// Sorteio com semente: os mesmos dados toda vez.
function sorteio(semente) {
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Arquivos de exemplo ----------------------------------------------------

function pdf(titulo, linhas) {
  const esc = (t) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let corpo = '0.94 0.71 0.07 rg 56 780 483 6 re f\n0.1 0.1 0.1 rg\n';
  corpo += `BT /F1 20 Tf 56 748 Td (${esc(titulo)}) Tj ET\n`;
  let y = 716;
  for (const l of linhas) {
    corpo += `BT /F1 11 Tf 56 ${y} Td (${esc(l)}) Tj ET\n`;
    y -= 18;
  }
  corpo += '0.6 0.6 0.6 rg\nBT /F1 9 Tf 56 60 Td (Documento ficticio gerado pelo Hub Elev Muniz para demonstracao.) Tj ET\n';
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(corpo, 'latin1')} >>\nstream\n${corpo}endstream`,
  ];
  let saida = '%PDF-1.4\n';
  const posicoes = [];
  objetos.forEach((o, i) => {
    posicoes.push(Buffer.byteLength(saida, 'latin1'));
    saida += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(saida, 'latin1');
  saida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posicoes) saida += `${String(p).padStart(10, '0')} 00000 n \n`;
  saida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(saida, 'latin1');
}

// Uma "foto" de documento: papel claro, faixa dourada, foto 3x4 e linhas de texto.
function png(lado, semente) {
  const w = 640;
  const h = 400;
  const px = Buffer.alloc(w * h * 3);
  const pintar = (x0, y0, x1, y1, [r, g, b]) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
        const i = (y * w + x) * 3;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
      }
    }
  };
  const r = sorteio(semente);
  pintar(0, 0, w, h, [228, 224, 214]);
  pintar(20, 20, w - 20, h - 20, [250, 247, 240]);
  pintar(20, 20, w - 20, 64, [240, 180, 17]);
  if (lado !== 'Verso') {
    pintar(44, 96, 184, 280, [205, 200, 190]);
    pintar(84, 130, 144, 190, [160, 152, 140]);
    pintar(64, 196, 164, 280, [160, 152, 140]);
  }
  const x0 = lado === 'Verso' ? 44 : 214;
  for (let i = 0; i < 7; i++) {
    const largura = 160 + Math.floor(r() * (w - x0 - 220));
    pintar(x0, 100 + i * 32, x0 + largura, 112 + i * 32, [120, 116, 108]);
  }
  pintar(44, 340, 300, 346, [60, 60, 60]);
  const linhas = [];
  for (let y = 0; y < h; y++) linhas.push(Buffer.from([0]), px.subarray(y * w * 3, (y + 1) * w * 3));
  const dados = zlib.deflateSync(Buffer.concat(linhas));
  const pedaco = (tipo, conteudo) => {
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(conteudo.length);
    const tc = Buffer.concat([Buffer.from(tipo, 'latin1'), conteudo]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(tc) >>> 0);
    return Buffer.concat([tam, tc, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pedaco('IHDR', ihdr), pedaco('IDAT', dados), pedaco('IEND', Buffer.alloc(0))]);
}

// --- O que é criado -----------------------------------------------------------

const USUARIOS = [
  { nome: 'Eduardo Muniz', email: 'eduardo.muniz@exemplo.local', admin: 1, ultimo: 0.05 },
  { nome: 'Ana Ribeiro', email: 'ana.ribeiro@exemplo.local', perfil: 'Consultor', ultimo: 0.2 },
  { nome: 'Bruno Castro', email: 'bruno.castro@exemplo.local', perfil: 'Consultor', ultimo: 1.4 },
  { nome: 'Fernanda Lopes', email: 'fernanda.lopes@exemplo.local', perfil: 'Consultor', ultimo: 2.1 },
  { nome: 'Carla Mendes', email: 'carla.mendes@exemplo.local', perfil: 'Consulta', ultimo: 3.6 },
  { nome: 'Diego Alves', email: 'diego.alves@exemplo.local', perfil: 'Consulta', ativo: 0, ultimo: 41 },
];
const EQUIPE = ['Ana Ribeiro', 'Bruno Castro', 'Eduardo Muniz', 'Fernanda Lopes'];
const CONSULTORES = ['Ana Ribeiro', 'Bruno Castro', 'Fernanda Lopes'];

// As etapas de cada predefinição: [nome, prazo em dias]. A última encerra.
const ETAPAS = {
  'Operação portuária': [['Documentação', 5], ['Análise', 3], ['Licenças e vistoria', 10], ['Em andamento', 20], ['Concluída', 0]],
  'Transporte rodoviário': [['Documentação', 4], ['Análise', 2], ['Em andamento', 15], ['Concluída', 0]],
  Armazenagem: [['Documentação', 5], ['Vistoria', 7], ['Em andamento', 15], ['Concluída', 0]],
};

// Em que etapa cada cenário está e há quantos dias entrou nela.
const LINHA_DO_TEMPO = {
  novo: { etapa: 0, dias: 1 },
  parcial: { etapa: 0, dias: 3 },
  pendente: { etapa: 0, dias: 4.4 },
  recusado: { etapa: 0, dias: 7 },
  pedido_vencido: { etapa: 0, dias: 16 },
  vencendo: { etapa: 1, dias: 1.5 },
  vencido: { etapa: 1, dias: 9 },
  completo: { etapa: 2, dias: 4 },
  encerrada: { etapa: -1, dias: 12 },
};

// Quem perdeu a operação, e por quê (o nome é o da operação).
const TRANSFERENCIAS = {
  'Rota Sul': 'Consultora de férias até o fim do mês.',
  'Armazém Navegantes': 'Cliente pediu outro atendimento.',
  'Transporte interno': 'Redistribuição de carteira.',
};

const CATEGORIAS_DESPESA = [['Aluguel do escritório', 'Estrutura', 420000], ['Sistemas e licenças', 'Tecnologia', 89000], ['Contabilidade', 'Serviços', 150000], ['Impostos', 'Impostos', 310000]];

// [nome, grupo, frente e verso, tem validade]
const DOCUMENTOS = [
  ['Cartão CNPJ', 'Empresa', 0, 0],
  ['Contrato social', 'Empresa', 0, 0],
  ['Inscrição estadual', 'Empresa', 0, 0],
  ['Alvará de funcionamento', 'Licenças', 0, 1],
  ['AVCB (Corpo de Bombeiros)', 'Licenças', 0, 1],
  ['Licença ambiental', 'Licenças', 0, 1],
  ['Registro ANTT (RNTRC)', 'Licenças', 0, 1],
  ['Certidão negativa federal', 'Certidões', 0, 1],
  ['Certidão negativa trabalhista', 'Certidões', 0, 1],
  ['Certificado de regularidade do FGTS', 'Certidões', 0, 1],
  ['RG ou CNH do responsável', 'Responsável', 1, 0],
  ['Comprovante de endereço', 'Responsável', 0, 0],
  ['Procuração', 'Responsável', 0, 1],
  ['Contrato de prestação de serviço', 'Contratos', 0, 1],
  ['Apólice de seguro RC', 'Contratos', 0, 1],
  ['Certificado de vistoria do veículo', 'Operacional', 0, 1],
];

// [nome, descrição, [documento, obrigatório]]
const PERFIS = [
  ['Operação portuária', 'Clientes que operam em terminal ou berço.', [
    ['Cartão CNPJ', 1], ['Contrato social', 1], ['Alvará de funcionamento', 1], ['AVCB (Corpo de Bombeiros)', 1],
    ['Licença ambiental', 1], ['Certidão negativa federal', 1], ['RG ou CNH do responsável', 1], ['Apólice de seguro RC', 0],
  ]],
  ['Transporte rodoviário', 'Transportadoras e frota própria.', [
    ['Cartão CNPJ', 1], ['Contrato social', 1], ['Registro ANTT (RNTRC)', 1], ['Certidão negativa federal', 1],
    ['Certidão negativa trabalhista', 1], ['Certificado de regularidade do FGTS', 1], ['Certificado de vistoria do veículo', 1], ['Apólice de seguro RC', 0],
  ]],
  ['Armazenagem', 'Armazéns, CDs e câmaras frias.', [
    ['Cartão CNPJ', 1], ['Alvará de funcionamento', 1], ['AVCB (Corpo de Bombeiros)', 1], ['Licença ambiental', 1],
    ['Contrato de prestação de serviço', 1], ['Comprovante de endereço', 0], ['Inscrição estadual', 0],
  ]],
];

// Cenários de cada operação: como a pasta dela está hoje.
const CLIENTES = [
  { nome: 'Acme Logística', razao: 'Acme Logística e Transportes Ltda', doc: '12.345.678/0001-90', contato: 'Maria Souza', tel: '(11) 99812-4410', email: 'maria.souza@acme.exemplo', dias: 58,
    ops: [['Terminal Santos', 'Operação portuária', 'pendente', 'Armazenagem e embarque no terminal 3'], ['Operação Paranaguá', 'Operação portuária', 'vencendo', '']] },
  { nome: 'Porto Sul Armazéns', razao: 'Porto Sul Armazéns Gerais S.A.', doc: '23.456.789/0001-01', contato: 'João Lima', tel: '(47) 98877-1020', email: 'joao.lima@portosul.exemplo', dias: 52,
    ops: [['Armazém Itajaí', 'Armazenagem', 'completo', ''], ['Armazém Navegantes', 'Armazenagem', 'vencido', 'Galpão 2, câmara seca']] },
  { nome: 'Transportes Rio Verde', razao: 'Transportes Rio Verde Ltda', doc: '34.567.890/0001-12', contato: 'Ana Prado', tel: '(62) 99654-3321', email: 'ana.prado@rioverde.exemplo', dias: 47,
    ops: [['Rota Sul', 'Transporte rodoviário', 'recusado', ''], ['Rota Nordeste', 'Transporte rodoviário', 'parcial', ''], ['Frota Refrigerada', 'Transporte rodoviário', 'novo', 'Carga refrigerada para o CD de Manaus']] },
  { nome: 'Cia. Atlântica de Granéis', razao: 'Companhia Atlântica de Granéis S.A.', doc: '45.678.901/0001-23', contato: 'Ricardo Nunes', tel: '(53) 99120-7788', email: 'ricardo@atlantica.exemplo', dias: 44,
    ops: [['Terminal de Grãos Rio Grande', 'Operação portuária', 'completo', ''], ['Berço 4', 'Operação portuária', 'pedido_vencido', '']] },
  { nome: 'Norte Frio Alimentos', razao: 'Norte Frio Indústria de Alimentos Ltda', doc: '56.789.012/0001-34', contato: 'Patrícia Gomes', tel: '(92) 98411-5566', email: 'patricia@nortefrio.exemplo', dias: 33,
    ops: [['CD Manaus', 'Armazenagem', 'pendente', 'Centro de distribuição refrigerado']] },
  { nome: 'Vale do Aço Mineração', razao: 'Vale do Aço Mineração e Logística S.A.', doc: '67.890.123/0001-45', contato: 'Sérgio Andrade', tel: '(27) 99733-2210', email: 'sergio@valedoaco.exemplo', dias: 61,
    ops: [['Escoamento Vitória', 'Operação portuária', 'parcial', ''], ['Transporte interno', 'Transporte rodoviário', 'completo', ''], ['Operação 2025', 'Transporte rodoviário', 'encerrada', 'Contrato encerrado em dezembro']] },
  { nome: 'Grãos do Cerrado', razao: 'Grãos do Cerrado Comércio Ltda', doc: '78.901.234/0001-56', contato: 'Luciana Freitas', tel: '(64) 99288-0145', email: 'luciana@graoscerrado.exemplo', dias: 25,
    ops: [['Safra 2026', 'Transporte rodoviário', 'vencendo', '']] },
  { nome: 'Maré Alta Navegação', razao: 'Maré Alta Navegação Costeira Ltda', doc: '89.012.345/0001-67', contato: 'Fábio Rezende', tel: '(81) 99541-6630', email: 'fabio@marealta.exemplo', dias: 19,
    ops: [['Cabotagem Suape', 'Operação portuária', 'recusado', '']] },
  { nome: 'Express Cargo', razao: 'Express Cargo Entregas Rápidas Ltda', doc: '90.123.456/0001-78', contato: 'Tatiane Rocha', tel: '(11) 97733-9014', email: 'tatiane@expresscargo.exemplo', dias: 6,
    ops: [['Última milha SP', 'Transporte rodoviário', 'novo', '']] },
  { nome: 'Construtora Horizonte', razao: 'Construtora Horizonte Ltda', doc: '01.234.567/0001-89', contato: 'Marcos Teixeira', tel: '(21) 99002-3344', email: 'marcos@horizonte.exemplo', dias: 70, inativo: true,
    ops: [['Obra Porto Novo', 'Armazenagem', 'encerrada', '']] },
];

const MOTIVOS = ['Foto cortada, falta a parte de baixo do documento.', 'Certidão vencida. Envie a emitida neste mês.', 'Arquivo ilegível, envie em PDF.'];

// Os parceiros de exemplo: nome, tipo, contato, cargo, telefone, e-mail, comissão padrão (%) e prazo de resposta (dias).
const PARCEIROS = [
  ['Banco Horizonte', 'Banco', 'Paula Viana', 'Gerente de empresas', '(11) 3100-2200', 'paula.viana@horizonte.exemplo', 2.5, 6],
  ['Banco Atlas', 'Banco', 'Rogério Melo', 'Gerente PJ', '(11) 3200-4400', 'rogerio.melo@atlas.exemplo', 2, 9],
  ['Sicoop Vale', 'Cooperativa', 'Marina Dias', 'Gerente de negócios', '(31) 3300-1100', 'marina.dias@sicoopvale.exemplo', 3, 5],
  ['CrediRápido', 'Fintech', 'Lucas Prado', 'Parcerias', '(11) 94000-1234', 'lucas@credirapido.exemplo', 3.5, 2],
  ['Recebíveis FIDC', 'FIDC', 'Helena Couto', 'Originação', '(21) 3400-9000', 'helena.couto@recebiveis.exemplo', 1.5, 3],
];

export async function existemDadosExemplo() {
  return !!(await um('select id from clientes where exemplo = 1 limit 1')) || !!(await um('select id from usuarios where exemplo = 1 limit 1'));
}

export async function criarDadosExemplo() {
  if (await existemDadosExemplo()) throw new Error('Os dados de exemplo já estão no sistema.');
  const r = sorteio(2026);
  const escolher = (lista) => lista[Math.floor(r() * lista.length)];
  const agoraMs = Date.now();
  const quando = (diasAtras) => new Date(agoraMs - diasAtras * DIA).toISOString();
  const dia = (deslocamento) => new Date(agoraMs + deslocamento * DIA).toISOString().slice(0, 10);
  const historico = async (q, usuario, acao, cliente, operacao, detalhe = '') =>
    executar('insert into historico (quando, usuario, acao, cliente_id, operacao_id, detalhe) values (?, ?, ?, ?, ?, ?)', q, usuario, acao, cliente, operacao, detalhe);
  const pastasCriadas = [];

  try {
    await emTransacao(async () => {
      // Parceiros: os bancos e financeiras com quem a empresa trabalha, com o contato de cada um
      for (const [nome, tipo, contato, cargo, telefone, email, comissao, prazo] of PARCEIROS) {
        if (await um('select id from parceiros where lower(nome) = lower(?)', nome)) continue;
        await executar(
          `insert into parceiros (nome, tipo, contato_nome, contato_cargo, telefone, email, comissao_padrao, prazo_resposta_dias, exemplo, criado_por, criado_em, atualizado_em)
           values (?, ?, ?, ?, ?, ?, ?, ?, 1, 'Exemplo', ?, ?)`,
          nome, tipo, contato, cargo, telefone, email, comissao, prazo, quando(120), quando(120),
        );
      }
      // Usuários
      const senhaInutil = gerarHashSenha(crypto.randomBytes(24).toString('hex'));
      for (const u of USUARIOS) {
        if (await um('select id from usuarios where lower(email) = ?', u.email)) continue;
        const perfil = u.perfil ? (await um('select id from perfis_acesso where nome = ?', u.perfil)) ?? (await um('select id from perfis_acesso order by id limit 1')) : null;
        await executar(
          `insert into usuarios (nome, email, senha_hash, admin, perfil_acesso_id, ativo, ultimo_acesso_em, criado_em, atualizado_em, exemplo)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          u.nome, u.email, senhaInutil, u.admin ?? 0, u.admin ? null : (perfil?.id ?? null), u.ativo ?? 1,
          u.ultimo === null ? null : quando(u.ultimo), quando(75), quando(75),
        );
      }

      // Documentos (os que já existirem com o mesmo nome são reaproveitados e não são marcados)
      const tipos = new Map();
      for (const [i, [nome, grupo, fv, val]] of DOCUMENTOS.entries()) {
        let t = await um('select * from tipos_documento where lower(nome) = lower(?) and removido_em is null', nome);
        if (!t) {
          const { lastInsertRowid } = await executar(
            'insert into tipos_documento (nome, grupo, frente_verso, exige_validade, ordem, criado_em, atualizado_em, exemplo) values (?, ?, ?, ?, ?, ?, ?, 1)',
            nome, grupo, fv, val, i, quando(80), quando(80),
          );
          t = await um('select * from tipos_documento where id = ?', lastInsertRowid);
        }
        tipos.set(nome, t);
      }

      // Perfis de documentos
      const perfis = new Map();
      for (const [nome, descricao, itens] of PERFIS) {
        const livre = (await um('select id from perfis_documento where lower(nome) = lower(?)', nome)) ? `${nome} (exemplo)` : nome;
        const { lastInsertRowid } = await executar(
          'insert into perfis_documento (nome, descricao, ativo, criado_em, atualizado_em, exemplo) values (?, ?, 1, ?, ?, 1)',
          livre, descricao, quando(78), quando(78),
        );
        for (const [ordem, [doc, obrigatorio]] of itens.entries()) {
          await executar('insert into perfis_documento_itens (perfil_id, tipo_id, obrigatorio, ordem) values (?, ?, ?, ?)', lastInsertRowid, tipos.get(doc).id, obrigatorio, ordem);
        }
        for (const [ordem, [etapa, prazo]] of ETAPAS[nome].entries()) {
          await executar('insert into modelo_etapas (perfil_id, nome, prazo_dias, ordem, final) values (?, ?, ?, ?, ?)', lastInsertRowid, etapa, prazo, ordem, ordem === ETAPAS[nome].length - 1 ? 1 : 0);
        }
        perfis.set(nome, { id: lastInsertRowid, nome: livre, itens, etapas: ETAPAS[nome] });
      }

      const gravarArquivos = async (pastaOp, item, lados, meta) => {
        const gravados = [];
        for (const [k, lado] of lados.entries()) {
          const ehFoto = lado || r() < 0.2;
          const ext = ehFoto ? '.png' : '.pdf';
          const conteudo = ehFoto
            ? png(lado, meta.semente + k)
            : pdf(item.nome, [`Cliente: ${meta.cliente}`, `Operação: ${meta.operacao}`, `Emitido em: ${meta.emitido}`, meta.validade ? `Válido até: ${meta.validade}` : 'Sem validade']);
          const rel = await nomeLivre(pastaOp, nomeSeguro([item.nome, lado].filter(Boolean).join(' - '), 'Documento'), ext);
          await gravarArquivo(rel, conteudo, ehFoto ? 'image/png' : 'application/pdf');
          gravados.push({ rel, ext, tamanho: conteudo.length, lado, nomeOriginal: `${nomeSeguro(item.nome).toLowerCase().replace(/\s+/g, '-')}${lado ? `-${lado.toLowerCase()}` : ''}${ext}` });
        }
        return gravados;
      };

      const envio = async ({ op, cliente, pastaOp, item, situacao, origem, diasAtras, validade = null, por, solicitacaoId = null, motivo = '', analisado = null }) => {
        const envioId = crypto.randomUUID();
        const q = quando(diasAtras);
        const lados = item.frente_verso ? ['Frente', 'Verso'] : [''];
        const meta = {
          semente: Math.floor(r() * 1e6),
          cliente: cliente.nome,
          operacao: op.nome,
          emitido: new Date(agoraMs - diasAtras * DIA).toLocaleDateString('pt-BR'),
          validade: validade ? validade.split('-').reverse().join('/') : null,
        };
        for (const a of await gravarArquivos(pastaOp, item, lados, meta)) {
          await executar(
            `insert into documentos (operacao_id, item_id, item_nome, envio_id, caminho, arquivo_nome, arquivo_tipo, arquivo_tamanho, situacao, origem,
               solicitacao_id, validade, observacao, lado, motivo_recusa, enviado_por, analisado_por, analisado_em, criado_em)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)`,
            op.id, item.id, item.nome, envioId, a.rel, a.nomeOriginal, a.ext === '.pdf' ? 'application/pdf' : 'image/png', a.tamanho, situacao, origem,
            solicitacaoId, validade, a.lado, motivo, por,
            situacao === 'pendente' ? null : (analisado?.por ?? por), situacao === 'pendente' ? null : (analisado ? quando(analisado.diasAtras) : q), q,
          );
        }
      };

      const validadeFutura = () => dia(60 + Math.floor(r() * 300));

      const idDoUsuario = async (nome) => (await um('select id from usuarios where nome = ? and exemplo = 1', nome))?.id ?? null;
      let vez = 0;
      const lancar = async (tipo, descricao, categoria, valor, vencDias, pagoDias, clienteId = null, operacaoId = null) => {
        const numero = ((await um('select max(numero) as m from lancamentos where tipo = ?', tipo))?.m ?? 0) + 1;
        const q = quando(Math.max(0, -vencDias + 10));
        await executar(
          `insert into lancamentos (tipo, numero, descricao, categoria, valor_centavos, vencimento, pago_em, cliente_id, operacao_id, criado_por, criado_em, atualizado_em, exemplo)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          tipo, numero, descricao, categoria, valor, dia(vencDias), pagoDias === null ? null : dia(pagoDias), clienteId, operacaoId, escolher(EQUIPE), q, q,
        );
      };

      for (const [ci, c] of CLIENTES.entries()) {
        const ocupadas = (await todos('select pasta from clientes')).map((x) => x.pasta);
        const pasta = await pastaLivre('', c.nome, ocupadas);
        const criadoPor = escolher(EQUIPE);
        const { lastInsertRowid: clienteId } = await executar(
          `insert into clientes (nome, pasta, razao_social, documento, contato, email, telefone, observacao, ativo, criado_por, criado_em, atualizado_em, exemplo)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          c.nome, pasta, c.razao, c.doc, c.contato, c.email, c.tel, ci === 0 ? 'Cliente desde 2019. Prefere receber os pedidos pelo WhatsApp.' : '',
          c.inativo ? 0 : 1, criadoPor, quando(c.dias), quando(c.dias),
        );
        await criarPasta(pasta);
        pastasCriadas.push(pasta);
        await historico(quando(c.dias), criadoPor, 'Cliente cadastrado', clienteId, null, c.nome);
        const cliente = { id: clienteId, nome: c.nome };

        for (const [nomeOp, nomePerfil, cenario, descricao] of c.ops) {
          const perfil = perfis.get(nomePerfil);
          // A linha do tempo: das etapas já passadas até a atual, com alguns prazos estourados.
          const tempo = LINHA_DO_TEMPO[cenario];
          const indiceAtual = tempo.etapa < 0 ? perfil.etapas.length - 1 : tempo.etapa;
          const duracoes = perfil.etapas.slice(0, indiceAtual).map(([, prazo]) => Math.max(0.5, prazo * (0.5 + r() * 0.8)));
          const diasOp = Math.ceil(duracoes.reduce((a, b) => a + b, 0) + tempo.dias);
          // A cada 7 operações, uma fica sem consultor para o administrador decidir.
          const nomeConsultor = cenario === 'novo' && ci === 8 ? null : CONSULTORES[vez++ % CONSULTORES.length];
          const consultorId = nomeConsultor ? await idDoUsuario(nomeConsultor) : null;
          const pastaOpNome = await pastaLivre(pasta, nomeOp, (await todos('select pasta from operacoes where cliente_id = ?', clienteId)).map((x) => x.pasta));
          const pastaOp = juntar(pasta, pastaOpNome);
          const { lastInsertRowid: opId } = await executar(
            `insert into operacoes (cliente_id, nome, pasta, descricao, perfil_documento_id, perfil_documento_nome, consultor_id, situacao, concluida_em, criado_por, criado_em, atualizado_em)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            clienteId, nomeOp, pastaOpNome, descricao, perfil.id, perfil.nome, consultorId, cenario === 'encerrada' ? 'encerrada' : 'ativa',
            cenario === 'encerrada' ? quando(tempo.dias) : null, criadoPor, quando(diasOp), quando(diasOp),
          );
          // Etapas e os períodos em cada uma (de onde sai o SLA).
          let inicio = diasOp;
          for (const [ordem, [etapaNome, prazo]] of perfil.etapas.entries()) {
            const final = ordem === perfil.etapas.length - 1 ? 1 : 0;
            const { lastInsertRowid: etapaId } = await executar('insert into operacao_etapas (operacao_id, nome, prazo_dias, ordem, final) values (?, ?, ?, ?, ?)', opId, etapaNome, prazo, ordem, final);
            if (ordem > indiceAtual) continue;
            const atual = ordem === indiceAtual;
            const fim = atual ? null : inicio - duracoes[ordem];
            const motivo = atual ? TRANSFERENCIAS[nomeOp] : null;
            const passagem = async (de, ate, cid, cnome) =>
              executar(
                'insert into etapa_passagens (operacao_id, etapa_id, etapa_nome, prazo_dias, final, consultor_id, consultor_nome, entrou_em, saiu_em) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                opId, etapaId, etapaNome, prazo, final, cid, cnome, quando(de), ate === null ? null : quando(ate),
              );
            if (motivo) {
              // Transferida no meio da etapa: o tempo até ali fica com o consultor anterior.
              const anterior = CONSULTORES[(CONSULTORES.indexOf(nomeConsultor) + 1) % CONSULTORES.length];
              const meio = inicio / 2;
              const anteriorId = await idDoUsuario(anterior);
              await passagem(inicio, meio, anteriorId, anterior);
              await passagem(meio, null, consultorId, nomeConsultor);
              await executar(
                'insert into transferencias (operacao_id, de_id, de_nome, para_id, para_nome, motivo, por, quando) values (?, ?, ?, ?, ?, ?, ?, ?)',
                opId, anteriorId, anterior, consultorId, nomeConsultor, motivo, 'Eduardo Muniz', quando(meio),
              );
              await historico(quando(meio), 'Eduardo Muniz', 'Operação transferida', clienteId, opId, `${anterior} → ${nomeConsultor}: ${motivo}`);
            } else {
              await passagem(inicio, fim, consultorId, nomeConsultor ?? '');
            }
            if (atual) await executar('update operacoes set etapa_id = ? where id = ?', etapaId, opId);
            else inicio = fim;
          }

          // Financeiro da operação: a mensalidade dos últimos meses e despesas ligadas a ela.
          const mensal = (30 + Math.floor(r() * 90)) * 10000;
          for (let m = 4; m >= -1; m--) {
            if (cenario === 'novo' && m > 0) continue;
            const venc = -m * 30 + 5;
            const atrasada = m === 1 && (cenario === 'vencido' || cenario === 'pedido_vencido');
            await lancar('receita', `Mensalidade ${nomeOp}`, 'Mensalidade', mensal, venc, venc < 0 && !atrasada ? venc + 2 : null, clienteId, opId);
          }
          if (cenario !== 'novo') await lancar('despesa', `Taxas e emolumentos ${nomeOp}`, 'Taxas', (8 + Math.floor(r() * 30)) * 10000, -20 + Math.floor(r() * 30), r() < 0.6 ? -10 : null, clienteId, opId);
          await criarPasta(pastaOp);
          await historico(quando(diasOp), criadoPor, 'Operação criada', clienteId, opId, `${nomeOp} (perfil ${perfil.nome})`);
          const op = { id: opId, nome: nomeOp };

          const itens = [];
          for (const [ordem, [doc, obrigatorio]] of perfil.itens.entries()) {
            const t = tipos.get(doc);
            const { lastInsertRowid } = await executar(
              `insert into operacao_itens (operacao_id, tipo_id, nome, grupo, descricao, obrigatorio, frente_verso, exige_validade, ordem, criado_em)
               values (?, ?, ?, ?, '', ?, ?, ?, ?, ?)`,
              opId, t.id, t.nome, t.grupo, obrigatorio, t.frente_verso, t.exige_validade, ordem, quando(diasOp),
            );
            itens.push({ id: lastInsertRowid, nome: t.nome, obrigatorio, frente_verso: !!t.frente_verso, exige_validade: !!t.exige_validade });
          }
          if (cenario === 'novo') continue;

          const obrig = itens.filter((i) => i.obrigatorio);
          const opcionais = itens.filter((i) => !i.obrigatorio);
          const corte = { completo: obrig.length, encerrada: obrig.length, vencendo: obrig.length, vencido: obrig.length, parcial: Math.ceil(obrig.length * 0.55), pendente: Math.ceil(obrig.length * 0.6), recusado: Math.ceil(obrig.length * 0.6), pedido_vencido: Math.ceil(obrig.length * 0.4) }[cenario];
          const aprovados = [...obrig.slice(0, corte), ...(['completo', 'encerrada'].includes(cenario) ? opcionais : [])];
          const faltam = obrig.slice(corte);

          // O que já está aprovado (enviado pela equipe)
          let vencendoFeitos = 0;
          let vencidosFeitos = 0;
          for (const [k, item] of aprovados.entries()) {
            const diasAtras = Math.max(1, diasOp - 1 - k);
            let validade = item.exige_validade ? validadeFutura() : null;
            if (item.exige_validade && cenario === 'vencendo' && vencendoFeitos < 2) {
              validade = dia(6 + vencendoFeitos * 13);
              vencendoFeitos += 1;
            } else if (item.exige_validade && cenario === 'vencido' && vencidosFeitos < 2) {
              validade = dia(-(4 + vencidosFeitos * 19));
              vencidosFeitos += 1;
            }
            const por = escolher(EQUIPE);
            // Uma versão antiga, substituída, para o histórico de versões.
            if (k === 2 && item.exige_validade && ['completo', 'vencendo'].includes(cenario)) {
              await envio({ op, cliente, pastaOp, item, situacao: 'aprovado', origem: 'interno', diasAtras: diasAtras + 20, validade: dia(-30), por });
            }
            await envio({ op, cliente, pastaOp, item, situacao: 'aprovado', origem: 'interno', diasAtras, validade, por });
            await historico(quando(diasAtras), por, 'Documento enviado', clienteId, opId, `${item.nome} (${item.frente_verso ? 2 : 1} arquivo${item.frente_verso ? 's' : ''})`);
          }

          // Pedidos ao cliente
          if (['pendente', 'recusado', 'pedido_vencido'].includes(cenario) && faltam.length) {
            const diasPedido = { pendente: 3, recusado: 6, pedido_vencido: 15 }[cenario];
            const expira = cenario === 'pedido_vencido' ? quando(8) : new Date(agoraMs + (7 - diasPedido) * DIA + DIA).toISOString();
            const pedidoPor = escolher(EQUIPE);
            const { lastInsertRowid: sid } = await executar(
              `insert into solicitacoes (operacao_id, token, itens, mensagem, situacao, expira_em, criado_por, criado_em, atualizado_em)
               values (?, ?, ?, ?, 'aguardando', ?, ?, ?, ?)`,
              opId, gerarCodigoAleatorio(24), JSON.stringify(faltam.map((i) => i.id)),
              cenario === 'recusado' ? 'Faltam poucos documentos para liberar a operação.' : 'Olá! Precisamos destes documentos para seguir com a operação.',
              expira, pedidoPor, quando(diasPedido), quando(diasPedido),
            );
            await historico(quando(diasPedido), pedidoPor, 'Documentos pedidos ao cliente', clienteId, opId, `${faltam.length} documento${faltam.length > 1 ? 's' : ''}`);
            const peloLink = `${c.nome} (link)`;
            if (cenario === 'pendente') {
              for (const [k, item] of faltam.slice(0, Math.max(1, Math.ceil(faltam.length / 2))).entries()) {
                const d = Math.max(0.2, diasPedido - 1 - k * 0.5);
                await envio({ op, cliente, pastaOp, item, situacao: 'pendente', origem: 'link', diasAtras: d, validade: item.exige_validade ? validadeFutura() : null, por: peloLink, solicitacaoId: sid });
                await historico(quando(d), peloLink, 'Cliente enviou documento', clienteId, opId, item.nome);
              }
              await executar('update solicitacoes set ultimo_envio_em = ? where id = ?', quando(diasPedido - 1), sid);
            }
            if (cenario === 'recusado') {
              const [primeiro, segundo] = faltam;
              const analista = escolher(EQUIPE);
              const motivo = escolher(MOTIVOS);
              await envio({ op, cliente, pastaOp, item: primeiro, situacao: 'recusado', origem: 'link', diasAtras: 5, por: peloLink, solicitacaoId: sid, motivo, analisado: { por: analista, diasAtras: 4 } });
              await historico(quando(5), peloLink, 'Cliente enviou documento', clienteId, opId, primeiro.nome);
              await historico(quando(4), analista, 'Documento recusado', clienteId, opId, `${primeiro.nome}: ${motivo}`);
              if (segundo) {
                await envio({ op, cliente, pastaOp, item: segundo, situacao: 'pendente', origem: 'link', diasAtras: 1, validade: segundo.exige_validade ? validadeFutura() : null, por: peloLink, solicitacaoId: sid });
                await historico(quando(1), peloLink, 'Cliente enviou documento', clienteId, opId, segundo.nome);
              }
              await executar('update solicitacoes set ultimo_envio_em = ? where id = ?', quando(1), sid);
            }
            await recalcularSolicitacao(sid);
          }

          // Um pedido antigo, já concluído, nas operações completas.
          if (cenario === 'completo') {
            const { lastInsertRowid: sid } = await executar(
              `insert into solicitacoes (operacao_id, token, itens, mensagem, situacao, expira_em, criado_por, criado_em, atualizado_em, concluida_em)
               values (?, ?, ?, '', 'concluida', ?, ?, ?, ?, ?)`,
              opId, gerarCodigoAleatorio(24), JSON.stringify(obrig.slice(-2).map((i) => i.id)), quando(diasOp - 9), criadoPor, quando(diasOp - 2), quando(diasOp - 6), quando(diasOp - 6),
            );
            await historico(quando(diasOp - 2), criadoPor, 'Documentos pedidos ao cliente', clienteId, opId, `2 documentos (pedido ${sid}, concluído)`);
          }
          if (cenario === 'encerrada') await historico(quando(5), escolher(EQUIPE), 'Operação encerrada', clienteId, opId);
        }
      }

      // Despesas gerais da empresa: sem operação, só o administrador vê.
      for (let m = 4; m >= -1; m--) {
        for (const [descricao, categoria, valor] of CATEGORIAS_DESPESA) {
          const venc = -m * 30 + 10;
          await lancar('despesa', descricao, categoria, valor, venc, venc < 0 ? venc : null);
        }
      }
    });
  } catch (erro) {
    // O banco voltou atrás: os arquivos gravados também saem.
    for (const p of pastasCriadas) await apagarPasta(p).catch(() => {});
    throw erro;
  }
  return resumoExemplo();
}

export async function resumoExemplo() {
  return {
    clientes: (await um('select count(*) as n from clientes where exemplo = 1')).n,
    operacoes: (await um('select count(*) as n from operacoes o join clientes c on c.id = o.cliente_id where c.exemplo = 1')).n,
    arquivos: (await um('select count(*) as n from documentos d join operacoes o on o.id = d.operacao_id join clientes c on c.id = o.cliente_id where c.exemplo = 1')).n,
    usuarios: (await um('select count(*) as n from usuarios where exemplo = 1')).n,
  };
}

/** Apaga tudo o que foi criado como exemplo, inclusive as pastas dos clientes de exemplo. */
export async function removerDadosExemplo() {
  const clientes = await todos('select id, pasta from clientes where exemplo = 1');
  await emTransacao(async () => {
    for (const c of clientes) {
      await executar('delete from historico where cliente_id = ?', c.id);
      await executar('delete from clientes where id = ?', c.id);
    }
    await executar('delete from lancamentos where exemplo = 1');
    await executar('delete from parceiros where exemplo = 1');
    await executar('delete from usuarios where exemplo = 1');
    await executar('delete from perfis_documento where exemplo = 1');
    await executar('delete from tipos_documento where exemplo = 1');
  });
  for (const c of clientes) await apagarPasta(c.pasta);
  return { clientes: clientes.length, quando: agora() };
}
