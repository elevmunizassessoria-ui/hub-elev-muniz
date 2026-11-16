import { Buffer } from 'node:buffer';
import express from 'express';
import { carregarSessao } from './acesso.js';
import { lerArquivoLocal } from './arquivos.js';
import { carregarConfiguracoes, garantirEsquema, semear } from './banco.js';
import { ErroHttp } from './http.js';
import { lerToken } from './seguranca.js';
import rotasAcessos from './rotas/acessos.js';
import rotasAprovacao from './rotas/aprovacao.js';
import rotasCadastro from './rotas/cadastro.js';
import rotasClientes from './rotas/clientes.js';
import rotasConfiguracoes from './rotas/configuracoes.js';
import rotasDocumentos from './rotas/documentos.js';
import rotasFinanceiro from './rotas/financeiro.js';
import rotasOperacoes from './rotas/operacoes.js';
import rotasPainel from './rotas/painel.js';
import rotasPublico from './rotas/publico.js';
import rotasSessao from './rotas/sessao.js';
import rotasSolicitacoes from './rotas/solicitacoes.js';

/**
 * O servidor do Hub, igual online (função do Supabase) e no teste local.
 * origens: endereços do site que podem chamar a API (ex.: https://elevmunizassessoria-ui.github.io).
 */
export function criarApp({ origens = [], prefixos = ['/api'], esquema = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  let pronto = null;
  const preparar = () => (pronto ??= (async () => {
    if (esquema) await garantirEsquema(esquema);
    await semear();
  })().catch((e) => {
    pronto = null;
    throw e;
  }));

  const api = express.Router();

  api.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const origem = req.headers.origin;
    if (origem && (origens.includes(origem) || origens.includes('*'))) {
      res.setHeader('Access-Control-Allow-Origin', origem);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-hub');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  // Pedidos que mudam dados precisam vir do próprio sistema (proteção contra sites de fora).
  api.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.headers['x-hub'] !== '1') return res.status(403).json({ erro: 'Pedido recusado.' });
    next();
  });

  api.use(async (_req, _res, next) => {
    try {
      await preparar();
      await carregarConfiguracoes();
      next();
    } catch (erro) {
      next(erro);
    }
  });
  api.use(express.json({ limit: '1mb' }));
  api.use(carregarSessao);

  // Só no teste local: entrega o arquivo de um link temporário (online o link é do Supabase Storage).
  api.get('/arquivo-local', async (req, res) => {
    const d = lerToken(String(req.query.t ?? ''));
    if (!d?.k) return res.status(404).json({ erro: 'Link vencido. Abra o arquivo de novo.' });
    const conteudo = await lerArquivoLocal(d.k);
    if (d.b) res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(d.n)}`);
    res.type(d.k.split('.').pop()).send(Buffer.from(conteudo));
  });

  api.use('/sessao', rotasSessao);
  api.use('/publico', rotasPublico);
  for (const r of [rotasAcessos, rotasCadastro, rotasOperacoes, rotasFinanceiro, rotasPainel, rotasClientes, rotasDocumentos, rotasSolicitacoes, rotasAprovacao, rotasConfiguracoes]) api.use(r);

  api.use((_req, res) => res.status(404).json({ erro: 'Endereço não encontrado.' }));

  // eslint-disable-next-line no-unused-vars
  api.use((erro, _req, res, _next) => {
    if (erro instanceof ErroHttp) return res.status(erro.status).json({ erro: erro.message });
    if (erro?.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Dados inválidos.' });
    console.error(erro);
    res.status(500).json({ erro: 'Algo deu errado no servidor. Tente de novo.' });
  });

  for (const p of prefixos) app.use(p, api);
  return app;
}
