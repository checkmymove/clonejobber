# Opero — identidade de repositório e serviços

Este workspace é **Opero** (clone interno do Jobber para Moving London Transport). Não é um projecto Koren.

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
