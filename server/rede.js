import { lerConfiguracoes } from './banco.js';

// O endereço do site (para montar o link que vai para o cliente): o de Configurações › Geral,
// senão o da variável HUB_SITE (ex.: https://elevmunizassessoria-ui.github.io/hub-elev-muniz).
export function enderecoBase() {
  const configurado = lerConfiguracoes().endereco_publico?.trim();
  return (configurado || process.env.HUB_SITE || 'http://localhost:3180').replace(/\/+$/, '');
}
