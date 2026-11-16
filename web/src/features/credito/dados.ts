/**
 * Dados fictícios das telas em esqueleto (crédito, carteira, instituições, comissões).
 * Sem banco de dados ainda: tudo aqui some quando as telas forem ligadas. Datas relativas a hoje.
 */
const dia = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const mil = (n: number) => n * 100_000;

export const CLIENTES = ["Acme Logística", "Porto Sul Armazéns", "Transportes Rio Verde", "Cia. Atlântica de Granéis", "Norte Frio Alimentos", "Vale do Aço Mineração", "Grãos do Cerrado", "Maré Alta Navegação", "Express Cargo"];

export const INSTITUICOES = [
  { nome: "Banco Horizonte", tipo: "Banco", gerente: "Paula Viana · (11) 3100-2200", propostas: 38, aprovacao: 62, resposta: 6, comissao: 2.5, situacao: "Ativa" },
  { nome: "Banco Atlas", tipo: "Banco", gerente: "Rogério Melo · (11) 3200-4400", propostas: 27, aprovacao: 48, resposta: 9, comissao: 2, situacao: "Ativa" },
  { nome: "Sicoop Vale", tipo: "Cooperativa", gerente: "Marina Dias · (31) 3300-1100", propostas: 19, aprovacao: 71, resposta: 5, comissao: 3, situacao: "Ativa" },
  { nome: "CrediRápido", tipo: "Fintech", gerente: "Lucas Prado · (11) 94000-1234", propostas: 44, aprovacao: 55, resposta: 2, comissao: 3.5, situacao: "Ativa" },
  { nome: "Recebíveis FIDC", tipo: "FIDC", gerente: "Helena Couto · (21) 3400-9000", propostas: 12, aprovacao: 83, resposta: 3, comissao: 1.5, situacao: "Ativa" },
  { nome: "Banco Meridiano", tipo: "Banco", gerente: "Sem gerente definido", propostas: 3, aprovacao: 33, resposta: 14, comissao: 1.8, situacao: "Inativa" },
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

export const PROPOSTAS = [
  { codigo: "PR00041", cliente: "Acme Logística", produto: "Capital de giro", banco: "Banco Horizonte", valor: mil(850), taxa: 1.72, prazo: 24, enviada: dia(-2), consultor: "Ana Ribeiro", situacao: "Em análise" },
  { codigo: "PR00040", cliente: "Porto Sul Armazéns", produto: "Giro com garantia", banco: "Banco Atlas", valor: mil(1400), taxa: 1.35, prazo: 48, enviada: dia(-6), consultor: "Fernanda Lopes", situacao: "Aprovada" },
  { codigo: "PR00039", cliente: "Transportes Rio Verde", produto: "Financiamento de frota", banco: "Sicoop Vale", valor: mil(1200), taxa: 1.42, prazo: 48, enviada: dia(-3), consultor: "Bruno Castro", situacao: "Contraproposta" },
  { codigo: "PR00038", cliente: "Norte Frio Alimentos", produto: "Antecipação de recebíveis", banco: "Recebíveis FIDC", valor: mil(320), taxa: 2.05, prazo: 4, enviada: dia(-1), consultor: "Ana Ribeiro", situacao: "Em análise" },
  { codigo: "PR00037", cliente: "Vale do Aço Mineração", produto: "Home equity empresarial", banco: "Banco Horizonte", valor: mil(3500), taxa: 1.12, prazo: 96, enviada: dia(-11), consultor: "Bruno Castro", situacao: "Aprovada" },
  { codigo: "PR00036", cliente: "Maré Alta Navegação", produto: "Giro rápido", banco: "CrediRápido", valor: mil(180), taxa: 3.1, prazo: 12, enviada: dia(-8), consultor: "Fernanda Lopes", situacao: "Recusada" },
  { codigo: "PR00035", cliente: "Grãos do Cerrado", produto: "Crédito rural", banco: "Sicoop Vale", valor: mil(2200), taxa: 1.02, prazo: 72, enviada: dia(-4), consultor: "Bruno Castro", situacao: "Em análise" },
  { codigo: "PR00034", cliente: "Express Cargo", produto: "Capital de giro", banco: "Banco Atlas", valor: mil(260), taxa: 1.95, prazo: 18, enviada: dia(0), consultor: "Ana Ribeiro", situacao: "Rascunho" },
];

/** O funil: cada cartão é uma operação de crédito em andamento. */
export const FUNIL_ETAPAS = ["Prospecção", "Documentação", "Análise de crédito", "Enviada ao banco", "Aprovada", "Contrato", "Liberada"];
export const FUNIL = [
  { id: 1, etapa: 0, cliente: "Express Cargo", produto: "Capital de giro", valor: mil(260), banco: "A definir", consultor: "Ana Ribeiro", dias: 2 },
  { id: 2, etapa: 0, cliente: "Maré Alta Navegação", produto: "Financiamento", valor: mil(640), banco: "A definir", consultor: "Fernanda Lopes", dias: 5 },
  { id: 3, etapa: 1, cliente: "Acme Logística", produto: "Giro com garantia", valor: mil(1100), banco: "Banco Atlas", consultor: "Ana Ribeiro", dias: 4 },
  { id: 4, etapa: 1, cliente: "Transportes Rio Verde", produto: "Antecipação", valor: mil(280), banco: "Recebíveis FIDC", consultor: "Bruno Castro", dias: 7 },
  { id: 5, etapa: 2, cliente: "Grãos do Cerrado", produto: "Crédito rural", valor: mil(2200), banco: "Sicoop Vale", consultor: "Bruno Castro", dias: 3 },
  { id: 6, etapa: 3, cliente: "Acme Logística", produto: "Capital de giro", valor: mil(850), banco: "Banco Horizonte", consultor: "Ana Ribeiro", dias: 2 },
  { id: 7, etapa: 3, cliente: "Norte Frio Alimentos", produto: "Antecipação", valor: mil(320), banco: "Recebíveis FIDC", consultor: "Ana Ribeiro", dias: 1 },
  { id: 8, etapa: 3, cliente: "Transportes Rio Verde", produto: "Frota", valor: mil(1200), banco: "Sicoop Vale", consultor: "Bruno Castro", dias: 3 },
  { id: 9, etapa: 4, cliente: "Porto Sul Armazéns", produto: "Giro com garantia", valor: mil(1400), banco: "Banco Atlas", consultor: "Fernanda Lopes", dias: 6 },
  { id: 10, etapa: 5, cliente: "Vale do Aço Mineração", produto: "Home equity", valor: mil(3500), banco: "Banco Horizonte", consultor: "Bruno Castro", dias: 9 },
  { id: 11, etapa: 6, cliente: "Cia. Atlântica de Granéis", produto: "Capital de giro", valor: mil(900), banco: "Banco Horizonte", consultor: "Fernanda Lopes", dias: 1 },
];

export const ANALISES = [
  { cliente: "Acme Logística", faturamento: mil(18500), endividamento: 28, score: 742, restricoes: "Nenhuma", limite: mil(1800), validade: dia(62), risco: "Baixo" },
  { cliente: "Porto Sul Armazéns", faturamento: mil(9200), endividamento: 41, score: 681, restricoes: "Nenhuma", limite: mil(1500), validade: dia(35), risco: "Médio" },
  { cliente: "Transportes Rio Verde", faturamento: mil(12700), endividamento: 55, score: 603, restricoes: "1 protesto", limite: mil(900), validade: dia(12), risco: "Médio" },
  { cliente: "Cia. Atlântica de Granéis", faturamento: mil(54000), endividamento: 22, score: 811, restricoes: "Nenhuma", limite: mil(6000), validade: dia(88), risco: "Baixo" },
  { cliente: "Norte Frio Alimentos", faturamento: mil(7300), endividamento: 38, score: 655, restricoes: "Nenhuma", limite: mil(700), validade: dia(44), risco: "Médio" },
  { cliente: "Vale do Aço Mineração", faturamento: mil(83000), endividamento: 31, score: 790, restricoes: "Nenhuma", limite: mil(9000), validade: dia(20), risco: "Baixo" },
  { cliente: "Maré Alta Navegação", faturamento: mil(4100), endividamento: 72, score: 498, restricoes: "Pefin e ação judicial", limite: mil(150), validade: dia(7), risco: "Alto" },
  { cliente: "Grãos do Cerrado", faturamento: mil(21000), endividamento: 35, score: 720, restricoes: "Nenhuma", limite: mil(2500), validade: dia(58), risco: "Baixo" },
];

export const GARANTIAS = [
  { codigo: "GR00012", cliente: "Porto Sul Armazéns", tipo: "Imóvel", descricao: "Galpão em Itajaí, matrícula 44.120", valor: mil(4200), vence: dia(210), situacao: "Vigente" },
  { codigo: "GR00011", cliente: "Vale do Aço Mineração", tipo: "Imóvel", descricao: "Terreno industrial em Vitória", valor: mil(9800), vence: dia(24), situacao: "Vence em breve" },
  { codigo: "GR00010", cliente: "Transportes Rio Verde", tipo: "Veículo", descricao: "6 cavalos mecânicos, ano 2022", valor: mil(2400), vence: dia(150), situacao: "Vigente" },
  { codigo: "GR00009", cliente: "Norte Frio Alimentos", tipo: "Recebíveis", descricao: "Duplicatas de 4 redes de varejo", valor: mil(600), vence: dia(-6), situacao: "Vencida" },
  { codigo: "GR00008", cliente: "Grãos do Cerrado", tipo: "Equipamento", descricao: "Colheitadeiras e silos", valor: mil(3100), vence: dia(90), situacao: "Em avaliação" },
  { codigo: "GR00007", cliente: "Acme Logística", tipo: "Aval", descricao: "Aval dos sócios", valor: mil(1000), vence: dia(300), situacao: "Vigente" },
];

export const COMPLIANCE = [
  { cliente: "Acme Logística", kyc: "Ok", listas: "Ok", lgpd: "Ok", scr: "Ok", revisar: dia(180), situacao: "Regular" },
  { cliente: "Porto Sul Armazéns", kyc: "Ok", listas: "Ok", lgpd: "Ok", scr: "Atenção", revisar: dia(15), situacao: "Pendente" },
  { cliente: "Transportes Rio Verde", kyc: "Ok", listas: "Ok", lgpd: "Falta", scr: "Ok", revisar: dia(30), situacao: "Pendente" },
  { cliente: "Cia. Atlântica de Granéis", kyc: "Ok", listas: "Ok", lgpd: "Ok", scr: "Ok", revisar: dia(240), situacao: "Regular" },
  { cliente: "Norte Frio Alimentos", kyc: "Atenção", listas: "Ok", lgpd: "Ok", scr: "Ok", revisar: dia(8), situacao: "Pendente" },
  { cliente: "Maré Alta Navegação", kyc: "Falta", listas: "Atenção", lgpd: "Falta", scr: "Falta", revisar: dia(-3), situacao: "Irregular" },
  { cliente: "Vale do Aço Mineração", kyc: "Ok", listas: "Ok", lgpd: "Ok", scr: "Ok", revisar: dia(120), situacao: "Regular" },
];

export const CONTRATOS = [
  { codigo: "CT00021", cliente: "Cia. Atlântica de Granéis", banco: "Banco Horizonte", produto: "Capital de giro", liberado: mil(900), saldo: mil(860), pagas: 1, total: 24, proximo: dia(12), consultor: "Fernanda Lopes", situacao: "Em dia" },
  { codigo: "CT00020", cliente: "Acme Logística", banco: "Banco Atlas", produto: "Giro com garantia", liberado: mil(1500), saldo: mil(910), pagas: 18, total: 48, proximo: dia(6), consultor: "Ana Ribeiro", situacao: "Em dia" },
  { codigo: "CT00019", cliente: "Transportes Rio Verde", banco: "Sicoop Vale", produto: "Financiamento de frota", liberado: mil(2100), saldo: mil(1440), pagas: 16, total: 48, proximo: dia(-9), consultor: "Bruno Castro", situacao: "Em atraso" },
  { codigo: "CT00018", cliente: "Porto Sul Armazéns", banco: "Banco Horizonte", produto: "Capital de giro", liberado: mil(600), saldo: mil(95), pagas: 21, total: 24, proximo: dia(18), consultor: "Fernanda Lopes", situacao: "Em dia" },
  { codigo: "CT00017", cliente: "Norte Frio Alimentos", banco: "CrediRápido", produto: "Giro rápido", liberado: mil(220), saldo: mil(120), pagas: 6, total: 12, proximo: dia(3), consultor: "Ana Ribeiro", situacao: "Renegociado" },
  { codigo: "CT00016", cliente: "Vale do Aço Mineração", banco: "Banco Atlas", produto: "Giro com garantia", liberado: mil(4000), saldo: mil(0), pagas: 36, total: 36, proximo: dia(0), consultor: "Bruno Castro", situacao: "Quitado" },
];

export const PARCELAS = [
  ...[
    ["CT00019", "Transportes Rio Verde", 16, 48, -9, 6200000, "Atrasada"],
    ["CT00017", "Norte Frio Alimentos", 7, 12, 3, 2150000, "A vencer"],
    ["CT00020", "Acme Logística", 19, 48, 6, 4380000, "A vencer"],
    ["CT00021", "Cia. Atlântica de Granéis", 2, 24, 12, 4700000, "A vencer"],
    ["CT00018", "Porto Sul Armazéns", 22, 24, 18, 3150000, "A vencer"],
    ["CT00020", "Acme Logística", 18, 48, -24, 4380000, "Paga"],
    ["CT00021", "Cia. Atlântica de Granéis", 1, 24, -18, 4700000, "Paga"],
    ["CT00018", "Porto Sul Armazéns", 21, 24, -12, 3150000, "Paga"],
    ["CT00019", "Transportes Rio Verde", 15, 48, -39, 6200000, "Paga"],
  ].map(([contrato, cliente, numero, total, d, valor, situacao]) => ({ contrato: contrato as string, cliente: cliente as string, numero: numero as number, total: total as number, vencimento: dia(d as number), valor: valor as number, situacao: situacao as string })),
];

export const RENOVACOES = [
  { contrato: "CT00018", cliente: "Porto Sul Armazéns", termina: dia(78), saldo: mil(95), potencial: mil(900), consultor: "Fernanda Lopes", situacao: "A contatar" },
  { contrato: "CT00017", cliente: "Norte Frio Alimentos", termina: dia(170), saldo: mil(120), potencial: mil(350), consultor: "Ana Ribeiro", situacao: "Em conversa" },
  { contrato: "CT00016", cliente: "Vale do Aço Mineração", termina: dia(-4), saldo: mil(0), potencial: mil(5000), consultor: "Bruno Castro", situacao: "Renovado" },
  { contrato: "CT00014", cliente: "Grãos do Cerrado", termina: dia(44), saldo: mil(210), potencial: mil(2500), consultor: "Bruno Castro", situacao: "A contatar" },
  { contrato: "CT00012", cliente: "Maré Alta Navegação", termina: dia(-30), saldo: mil(0), potencial: mil(150), consultor: "Fernanda Lopes", situacao: "Perdido" },
];

export const COMISSOES = [
  { contrato: "CT00021", cliente: "Cia. Atlântica de Granéis", banco: "Banco Horizonte", consultor: "Fernanda Lopes", liberado: mil(900), percentual: 2.5, comissao: 2250000, repasse: 900000, previsao: dia(8), situacao: "A receber" },
  { contrato: "CT00020", cliente: "Acme Logística", banco: "Banco Atlas", consultor: "Ana Ribeiro", liberado: mil(1500), percentual: 2, comissao: 3000000, repasse: 1200000, previsao: dia(-40), situacao: "Repassada" },
  { contrato: "CT00019", cliente: "Transportes Rio Verde", banco: "Sicoop Vale", consultor: "Bruno Castro", liberado: mil(2100), percentual: 3, comissao: 6300000, repasse: 2520000, previsao: dia(-60), situacao: "Repassada" },
  { contrato: "CT00018", cliente: "Porto Sul Armazéns", banco: "Banco Horizonte", consultor: "Fernanda Lopes", liberado: mil(600), percentual: 2.5, comissao: 1500000, repasse: 600000, previsao: dia(-5), situacao: "Recebida" },
  { contrato: "CT00017", cliente: "Norte Frio Alimentos", banco: "CrediRápido", consultor: "Ana Ribeiro", liberado: mil(220), percentual: 3.5, comissao: 770000, repasse: 308000, previsao: dia(15), situacao: "A receber" },
];

export const METAS = [
  { consultor: "Ana Ribeiro", meta: mil(2000), realizado: mil(1500), propostas: 14, aprovadas: 8 },
  { consultor: "Bruno Castro", meta: mil(3000), realizado: mil(3500), propostas: 11, aprovadas: 7 },
  { consultor: "Fernanda Lopes", meta: mil(2000), realizado: mil(900), propostas: 12, aprovadas: 5 },
];

export const AGENDA = [
  { quando: dia(0), tipo: "Retorno do banco", assunto: "Cobrar resposta da PR00041", cliente: "Acme Logística", responsavel: "Ana Ribeiro", situacao: "Hoje" },
  { quando: dia(0), tipo: "Ligação", assunto: "Negociar parcela em atraso do CT00019", cliente: "Transportes Rio Verde", responsavel: "Bruno Castro", situacao: "Hoje" },
  { quando: dia(-2), tipo: "Cobrar documentos", assunto: "Certidões da análise", cliente: "Maré Alta Navegação", responsavel: "Fernanda Lopes", situacao: "Atrasado" },
  { quando: dia(1), tipo: "Reunião", assunto: "Apresentar contraproposta", cliente: "Transportes Rio Verde", responsavel: "Bruno Castro", situacao: "Próximos" },
  { quando: dia(3), tipo: "Renovação", assunto: "Oferecer renovação do CT00018", cliente: "Porto Sul Armazéns", responsavel: "Fernanda Lopes", situacao: "Próximos" },
  { quando: dia(5), tipo: "Reunião", assunto: "Visita ao armazém para o laudo", cliente: "Grãos do Cerrado", responsavel: "Bruno Castro", situacao: "Próximos" },
  { quando: dia(-1), tipo: "Ligação", assunto: "Confirmar liberação do contrato", cliente: "Cia. Atlântica de Granéis", responsavel: "Fernanda Lopes", situacao: "Feito" },
];
