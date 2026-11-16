# Hub Elev Muniz

Gestão de documentos e operações de crédito de clientes, com o desenho do Axyn One e as cores da Elev Muniz (dourado `#F0B411`).

Roda **online**:

| Parte | Onde | Endereço |
|---|---|---|
| Telas | GitHub Pages (publica sozinho a cada push na `main`) | `https://hub.elevmuniz.com.br` (DNS na Vercel: CNAME `hub` → `elevmunizassessoria-ui.github.io`) |
| Servidor | Função `hub` do Supabase | `https://puziargokgigjfphxgrl.supabase.co/functions/v1/hub/api` |
| Banco | Postgres do Supabase | esquema em `supabase/migrations` |
| Arquivos | Supabase Storage, bucket privado `documentos` | `Cliente/Operação/Documento.pdf` |

No primeiro acesso ao site, crie o administrador (nome, e-mail e senha).

## Como funciona

- **Painel:** os números de decisão. Cada um abre a lista que o explica. **SLA** (por consultor, processo e etapa, em dias corridos) e **Metas** ficam aqui.
- **Operações:** criar operações e ver cliente, consultor, etapa e prazo. Em **Predefinições** ficam, para cada tipo de operação, as etapas, os prazos e os documentos (digitados livres). Em **Transferências**, o histórico.
- **Transferir:** só o administrador, de um consultor para outro, com motivo obrigatório. O tempo até ali fica com quem estava.
- **Clientes:** só cadastro, com um resumo das operações para consulta. As ações ficam em Operações e em Documentos.
- **Documentos:** tudo o que as operações exigem, os pedidos ao cliente por link e a aprovação. Por padrão aceita só PDF, PNG e JPEG (Configurações › Geral).
- **Financeiro:** receitas, despesas e extrato. Lançamento sem operação é da empresa e só o administrador vê.

**Crédito, ainda sem tabela no banco:** Funil, Propostas e Simulador (em Operações), Análise de crédito e Garantias (em Clientes), Compliance (em Documentos), Instituições, Carteira, Comissões (em Financeiro), Metas (no Painel) e Agenda. Os números são montados a partir dos clientes, operações e consultores de verdade (`web/src/features/credito/dados.ts`), então tudo se liga entre as abas; as ações dessas telas ainda não gravam. O Simulador já faz a conta.

**Regra de acesso:** só o administrador vê tudo. Os demais veem só as operações em que são o consultor e o que está ligado a elas. Quais áreas cada um usa, o administrador libera em Configurações › Perfis de acesso (o perfil Consultor vem com o Financeiro desligado).

## Arquivos

Ficam no bucket privado `documentos` do Supabase, organizados por cliente e operação. Ninguém de fora acessa: para abrir ou baixar, o servidor gera um link que vale 5 minutos.

- Os nomes no storage não têm acento (exigência do Supabase): "Operação São Paulo" vira a pasta `Operacao Sao Paulo`. No sistema o nome continua com acento.
- Renomear cliente ou operação move os arquivos para a pasta nova.
- Versões excluídas vão para `_Excluídos` dentro da operação: nada é apagado de verdade.

**Backup:** o Supabase faz backup diário do banco (plano pago). Os arquivos ficam no Storage.

## Dados de exemplo

Clientes, operações, documentos, pedidos e usuários fictícios (marcados como exemplo).
Para tirar tudo: **Configurações › Sistema › Geral › Dados de exemplo › Apagar dados de exemplo**. Saem também os arquivos desses clientes. O que você cadastrou continua.

## Acessos

Tudo fica em **Configurações** (no menu **Perfil**, no alto à direita):

- **Usuários**: todo mundo num grupo só, administradores e equipe. Abra a sua linha para mudar seus dados e sua senha.
- **Perfis de acesso**: para cada área, Sem acesso / Ver / Editar / Excluir.
- Esqueceu a senha: o administrador define uma nova em Usuários; a pessoa troca no próximo acesso.
- Esqueceu a senha do administrador: `DATABASE_URL=... node scripts/redefinir-senha.mjs SEU-EMAIL` mostra uma senha provisória.

## Para quem mexe no código

- `server/`: a API (Express 5 + Postgres). `server/app.js` é o mesmo online e no computador.
- `supabase/functions/hub/index.ts`: a função online. `npm run funcao` copia `server/` para dentro dela antes de publicar.
- `supabase/migrations/`: o esquema do banco (RLS ligado, sem políticas: só a função acessa).
- `web/`: as telas em React + Tailwind 4. `VITE_API` define o endereço do servidor no build.
- `.github/workflows/site.yml`: publica as telas no GitHub Pages.

No computador (teste):

- `npm run build` e `npm start`: abre em `http://localhost:3180` com um Postgres de teste (PGlite) em `dados/pg` e os arquivos em `dados/Clientes`. Com `DATABASE_URL`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env`, usa o Supabase de verdade.
- `npm run dev`: servidor (3180) e tela com recarga automática (5180).
- `node scripts/teste-api.mjs`: teste de ponta a ponta da API com um banco novo.
- `node scripts/migrar-para-supabase.mjs`: leva os dados da versão antiga (SQLite em `dados/`) para o Supabase.

### Variáveis da função no Supabase

| Variável | Para quê |
|---|---|
| `HUB_SEGREDO` | Assina as sessões e os links. Um texto longo e aleatório; trocar derruba todas as sessões. |
| `HUB_ORIGENS` | Endereços do site que podem chamar a API, separados por vírgula (GitHub Pages e o subdomínio). |
| `HUB_SITE` | Endereço do site, para o link que vai ao cliente (pode ser trocado em Configurações › Geral). |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DB_URL` o Supabase já fornece.
