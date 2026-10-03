# Tarefas da auditoria Opero

Relatório visual: canvas `security-audit` (27 set 2026).

Contagem: 0 críticos, 4 altos, 8 médios, 4 baixos.

Stack: Next.js 15, React 19, Supabase, Gmail OAuth, Vercel. Um administrador, uma empresa.

Este ficheiro é o plano de correção. O `IMPLEMENTATION_PLAN.md` de produto fica como está.

## Fase 1 — abuso público e duplicidade

- [ ] **ALTO-001** Substituir o limite em memória de `lib/ratelimit.ts`. Usar um store partilhado. Ler o IP que a plataforma acrescenta, não o primeiro `X-Forwarded-For`. Trocar `startedAt` do browser por um token assinado na abertura de `/r/[slug]`.
- [ ] **ALTO-004** Índice único em `jobs.quote_id` e `invoices.job_id` quando não forem nulos. Em `convertApprovedQuoteToJob` e `convertCompletedJobToInvoice`, tratar conflito como documento já existente.
- [ ] **MEDIO-004** No `submitRequest`, se o insert bater na unique de `idempotency_key`, devolver o pedido já gravado em vez de erro 500.
- [ ] **MEDIO-001** Uma só mensagem de falha no `signIn`. Limite de tentativas no login, no mesmo store da fase 1.
- [ ] **MEDIO-007** Mover `client_secret_*.json` para fora da pasta do repositório. Tirar o e-mail do administrador de `IMPLEMENTATION_PLAN.md`.

## Fase 2 — CRM, tokens e dinheiro

- [ ] **ALTO-002** O formulário público deixa de fundir cliente por telefone e deixa de fazer OR no consentimento de marketing. Associação por e-mail só com confirmação.
- [ ] **ALTO-003** Cifrar `access_token` e `refresh_token` antes de gravar. Revogar a ligação Gmail atual e ligar de novo depois da migração.
- [ ] **MEDIO-002** Transições explícitas de cotação, serviço e fatura. `paid` só com um lançamento de pagamento. Ao sair de `paid`, limpar `paid_at` e recalcular `balance`.
- [ ] **MEDIO-003** Marcar o envio como em curso antes de chamar o Gmail. Timeout nas chamadas em `lib/email/google.ts` e `lib/email/gmail.ts`. Retry não reenvia se o Gmail já aceitou.

## Fase 3 — endurecer o que já está fechado

- [ ] **MEDIO-005** Cabeçalhos: CSP, HSTS, frame, referrer, `X-Content-Type-Options`. Ficheiros servidos com `nosniff`. Callback do Google não devolve a mensagem crua do provedor na query.
- [ ] **MEDIO-006** Teste que falha se uma server action nova (exceto `submitRequest`, `signIn` e `signOut`) não chamar `requireAdmin()`.
- [ ] **MEDIO-008** Apagar os `money()` locais. Serviços, cotações e faturas usam `formatGBP` de `lib/format.ts` (en-GB).
- [ ] **BAIXO-001** `primary_color` só entra no style se for hex.
- [ ] **BAIXO-002** Remover CR/LF do nome da empresa antes do header `From`.
- [ ] **BAIXO-003** Deixar de ler `quantity::float` para montar linhas de e-mail e de conversão.
- [ ] **BAIXO-004** `changeQuoteStatus`, `changeJobStatus` e `changeInvoiceStatus` passam a correr dentro de `sql.begin`.

## Fora deste plano

Não há finding crítico. `.env` está no `.gitignore` e não está no histórico. Não copiar senhas, tokens ou chaves para commits, issues ou este ficheiro.
