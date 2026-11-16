import { Buffer } from 'node:buffer';
import path from 'node:path';
import multer from 'multer';
import { lerConfiguracoes } from './banco.js';
import { FORMATOS, extensoesAceitas, nomesFormatos } from './arquivos.js';

export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export const falha = (status, mensagem) => {
  throw new ErroHttp(status, mensagem);
};

export function texto(valor, { max = 200, obrigatorio = false, nome = 'Campo' } = {}) {
  const t = String(valor ?? '').trim();
  if (obrigatorio && !t) falha(400, `${nome}: preencha este campo.`);
  if (t.length > max) falha(400, `${nome}: no máximo ${max} caracteres.`);
  return t;
}

export function inteiro(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function dataOpcional(valor, nome = 'Data') {
  const t = String(valor ?? '').trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(t))) falha(400, `${nome}: data inválida.`);
  return t;
}

export const bool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'sim';

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Recebe os arquivos na memória (a função online não tem disco); o tamanho máximo vem das Configurações.
export function receberArquivos(campos) {
  return (req, res, next) => {
    const maxMb = Math.min(Math.max(Number(lerConfiguracoes().tamanho_maximo_mb) || 20, 1), 200);
    const aceitas = extensoesAceitas();
    const upload = multer({
      storage: multer.memoryStorage(),
      defParamCharset: 'utf8',
      limits: { fileSize: maxMb * 1024 * 1024, files: 20, fields: 30 },
      fileFilter: (_req, arquivo, cb) => {
        const ext = path.extname(arquivo.originalname).toLowerCase();
        if (!FORMATOS[ext] || !aceitas.includes(ext)) {
          return cb(new ErroHttp(400, `Formato não aceito (${ext || 'sem extensão'}). Envie ${nomesFormatos().join(', ')}.`));
        }
        cb(null, true);
      },
    }).fields(campos);
    upload(req, res, (erro) => {
      if (erro?.code === 'LIMIT_FILE_SIZE') return next(new ErroHttp(413, `Arquivo maior que ${maxMb} MB.`));
      if (erro) return next(erro instanceof ErroHttp ? erro : new ErroHttp(400, 'Não foi possível receber o arquivo.'));
      next();
    });
  };
}

// Confere os primeiros bytes: o arquivo é mesmo do formato que diz ser.
export function conferirConteudo(arquivo) {
  const ext = path.extname(arquivo.originalname).toLowerCase();
  const cabeca = Buffer.from(arquivo.buffer.subarray(0, 12));
  const comeca = (...bytes) => bytes.every((b, i) => cabeca[i] === b);
  const ok = {
    '.pdf': () => cabeca.subarray(0, 4).toString('latin1') === '%PDF',
    '.png': () => comeca(0x89, 0x50, 0x4e, 0x47),
    '.jpg': () => comeca(0xff, 0xd8, 0xff),
    '.jpeg': () => comeca(0xff, 0xd8, 0xff),
    '.webp': () => cabeca.subarray(0, 4).toString('latin1') === 'RIFF' && cabeca.subarray(8, 12).toString('latin1') === 'WEBP',
    '.docx': () => comeca(0x50, 0x4b, 0x03, 0x04),
    '.xlsx': () => comeca(0x50, 0x4b, 0x03, 0x04),
    '.doc': () => comeca(0xd0, 0xcf, 0x11, 0xe0),
    '.xls': () => comeca(0xd0, 0xcf, 0x11, 0xe0),
  }[ext];
  if (!ok || !ok()) falha(400, `O arquivo "${arquivo.originalname}" não parece ser um ${ext.slice(1).toUpperCase()} válido.`);
  return { extensao: ext, tipo: FORMATOS[ext] };
}

// Os arquivos ficam só na memória do pedido: não há o que limpar.
export function limparTemporarios() {}
