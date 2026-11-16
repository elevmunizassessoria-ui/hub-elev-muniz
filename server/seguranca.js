import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

// Segredo que assina as sessões e os links temporários: variável HUB_SEGREDO (online, nas
// variáveis da função do Supabase). Sem ela, um segredo novo a cada início (só para teste).
let SEGREDO = process.env.HUB_SEGREDO || crypto.randomBytes(48).toString('hex');
export function definirSegredo(valor) {
  if (valor) SEGREDO = valor;
}
const DURACAO_SESSAO_MS = 1000 * 60 * 60 * 12;

export function gerarHashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, sal, 64).toString('hex');
  return `${sal}:${hash}`;
}

export function conferirSenha(senha, armazenado) {
  if (!armazenado || !armazenado.includes(':')) return false;
  const [sal, hash] = armazenado.split(':');
  const calculado = crypto.scryptSync(senha, sal, 64);
  const esperado = Buffer.from(hash, 'hex');
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}

function assinar(conteudo) {
  return crypto.createHmac('sha256', SEGREDO).update(conteudo).digest('base64url');
}

export function criarToken(dados, duracaoMs = DURACAO_SESSAO_MS) {
  const corpo = Buffer.from(JSON.stringify({ ...dados, exp: Date.now() + duracaoMs })).toString('base64url');
  return `${corpo}.${assinar(corpo)}`;
}

export function lerToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [corpo, assinatura] = token.split('.');
  const esperada = assinar(corpo);
  if (assinatura.length !== esperada.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    if (!dados.exp || dados.exp < Date.now()) return null;
    return dados;
  } catch {
    return null;
  }
}

export function gerarCodigoAleatorio(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}
