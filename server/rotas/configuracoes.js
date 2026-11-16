import { Router } from 'express';
import { exigir, exigirLogin, filtroOperacoes } from '../acesso.js';
import { CONFIG_PADRAO, gravarConfiguracao, lerConfiguracoes, todos } from '../banco.js';
import { GRUPOS_FORMATO, extensoesAceitas, formatosAceitos } from '../arquivos.js';
import { falha, texto } from '../http.js';
import { enderecoBase } from '../rede.js';
import { criarDadosExemplo, existemDadosExemplo, removerDadosExemplo, resumoExemplo } from '../exemplo.js';

const rotas = Router();

rotas.get('/configuracoes', exigirLogin, (_req, res) => {
  res.json({
    configuracoes: lerConfiguracoes(),
    endereco_efetivo: enderecoBase(),
    formatos: Object.entries(GRUPOS_FORMATO).map(([chave, f]) => ({ chave, nome: f.nome, extensoes: f.extensoes })),
    formatos_aceitos: formatosAceitos(),
    extensoes_aceitas: extensoesAceitas(),
  });
});

function lerFormatos(valor) {
  const lista = (Array.isArray(valor) ? valor : String(valor).split(',')).map((f) => String(f).trim()).filter((f) => GRUPOS_FORMATO[f]);
  if (lista.length === 0) falha(400, 'Escolha pelo menos um formato de arquivo aceito.');
  return [...new Set(lista)].join(',');
}

function numero(valor, min, max, nome) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) falha(400, `${nome}: use um número de ${min} a ${max}.`);
  return String(n);
}

rotas.put('/configuracoes', exigir('configuracoes', 'editar'), async (req, res) => {
  const atual = lerConfiguracoes();
  const novo = {
    empresa_nome: texto(req.body.empresa_nome ?? atual.empresa_nome, { obrigatorio: true, max: 80, nome: 'Nome da empresa' }),
    link_validade_dias: numero(req.body.link_validade_dias ?? atual.link_validade_dias, 1, 90, 'Validade do link'),
    aviso_vencimento_dias: numero(req.body.aviso_vencimento_dias ?? atual.aviso_vencimento_dias, 0, 365, 'Aviso de vencimento'),
    tamanho_maximo_mb: numero(req.body.tamanho_maximo_mb ?? atual.tamanho_maximo_mb, 1, 200, 'Tamanho máximo'),
    endereco_publico: texto(req.body.endereco_publico ?? atual.endereco_publico, { max: 200, nome: 'Endereço do link' }).replace(/\/+$/, ''),
    formatos_aceitos: lerFormatos(req.body.formatos_aceitos ?? atual.formatos_aceitos),
  };
  if (novo.endereco_publico && !/^https?:\/\/[^\s/]+/.test(novo.endereco_publico)) falha(400, 'Endereço do link: comece com http:// ou https://');

  for (const chave of Object.keys(CONFIG_PADRAO)) await gravarConfiguracao(chave, novo[chave]);
  res.json({ configuracoes: lerConfiguracoes() });
});

// Histórico geral (as últimas ações), para quem cuida das configurações.
rotas.get('/historico', exigir('configuracoes'), async (req, res) => {
  const f = filtroOperacoes(req.usuario);
  res.json({ historico: await todos(`select h.*, c.nome as cliente_nome, o.nome as operacao_nome from historico h left join clientes c on c.id = h.cliente_id left join operacoes o on o.id = h.operacao_id where ${f.sql} order by h.id desc limit 300`, ...f.p) });
});

// Dados de exemplo: só o administrador cria ou apaga.
rotas.get('/exemplo', exigirLogin, async (_req, res) => {
  res.json({ existe: await existemDadosExemplo(), resumo: await resumoExemplo() });
});

rotas.post('/exemplo', exigirLogin, async (req, res) => {
  if (!req.usuario.admin) falha(403, 'Só o administrador cria dados de exemplo.');
  if (await existemDadosExemplo()) falha(409, 'Os dados de exemplo já estão no sistema.');
  res.json({ resumo: await criarDadosExemplo() });
});

rotas.delete('/exemplo', exigirLogin, async (req, res) => {
  if (!req.usuario.admin) falha(403, 'Só o administrador apaga os dados de exemplo.');
  res.json(await removerDadosExemplo());
});

export default rotas;
