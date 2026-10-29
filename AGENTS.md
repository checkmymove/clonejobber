# Job To Go — identidade de repositório e serviços

Este workspace é **Job To Go** (antes Opero; clone interno do Jobber para Moving London Transport). Não é um projecto Koren.

## GitHub

- Remoto único: `https://checkmymove@github.com/checkmymove/clonejobber.git`
- Owner: `checkmymove`
- Branch de produção: `main`
- **Proibido** usar `korenonline7`, `koren7`, KOREN, ou qualquer outro owner/repo para push, PR, issues ou deploy deste código.

Git e GitHub deste workspace: **só** `checkmymove/clonejobber`. Commit e push vão para esse remoto. Não criar outro remote, fork, ou repo.

## Vercel

- Equipa: **check-my-move** (não a equipa KOREN / `koren3`)
- Projecto: **clonejobber**
- Produção: https://clonejobber.vercel.app
- Dashboard: https://vercel.com/check-my-move/clonejobber
- `vercel.json` marca o framework Next.js. Push em `main` dispara o deploy.

Se o MCP da Vercel listar só a equipa KOREN, está autenticado na conta errada. Não criar projecto novo. Pedir login na equipa **check-my-move**.

## Supabase

- Projecto: `jstvjtbenlsasqjytxmx`
- Host directo: `db.jstvjtbenlsasqjytxmx.supabase.co`
- Pooler: `aws-0-sa-east-1.pooler.supabase.com`
- Migrações: `npm run migrate` (`scripts/migrate.mjs` + `supabase/migrations/`). A Vercel **não** corre migrações.
- Ligação da app: `DATABASE_URL` no `.env` local e nas env vars da Vercel.

## O que este projecto não usa

- **Render** — não há serviço Render. Não criar um.
- **Origin (cursor.com)** — o git host é GitHub, não Origin.

## Outros serviços

- Google OAuth / Gmail: cliente Internal do Workspace; callback de teste em `clonejobber.vercel.app`.
- Segredos: só `.env` e o dashboard da Vercel. Nunca commitar `.env`, tokens ou `client_secret_*.json`.

## Depois de alterar UI em produção

Push para `checkmymove/clonejobber` `main` e esperar o status Vercel do commit ficar `success`.

## Padrões de UI (aplicar sempre que fizer sentido)

- **Layout de detalhe = o do Request.** Páginas de detalhe do funil (request, quote, job, invoice, client) seguem a mesma disposição: duas caixas lado a lado no topo, depois Collection e Delivery lado a lado, depois Inventory list em largura total e só então as informações específicas da página (timeline, sent, etc.). Quando a página tem a coluna lateral "Request" (quote), ela se mantém à direita. Usar bom senso: não forçar o padrão em páginas onde ele não faz sentido (listas, formulários, configurações, schedule).
- **Listas em tabela:** a linha inteira é clicável e muda de cor no hover, como em Products & services. Usar `components/clickable-row.tsx`.
- **Caixas com texto longo** ficam na altura da caixa vizinha, com seta para expandir/recolher (clique em qualquer ponto da caixa).
- **Hora e minuto:** usar `components/time-field.tsx`, nunca `<input type="time">` nativo.
- **Menu lateral:** sempre à esquerda, igual em todas as páginas. Products & services, Team e Emails & Texts ficam abaixo do separador (configuração, fora do funil).
