# Jobber: Jobs, Invoices e Payments (engenharia reversa)

Fonte: conta Jobber da Moving London observada em 14 out 2026 (páginas, DOM e respostas da API GraphQL interna, só leitura) e a ajuda pública do Jobber. Este ficheiro descreve o que o Jobber faz e como o Job To Go o reproduz.

## Jobs

**Lista** (`/jobs`): cartões Overview (Ending within 30 days, Late, Requires Invoicing, Action Required, Unscheduled), Recent visits (30 dias até hoje: nº de visitas e £) e Visits scheduled (próximos 30 dias). Tabela Client · Job number + título · Property · Schedule · Status · Total, ordenável, filtro Status e Job Type, pesquisa.

**Estados** (API `jobStatus`, contagens em `jobsMetadata.statusCounts`): `late`, `today`, `upcoming`, `unscheduled`, `action_required` (= `onHold`), `requires_invoicing`, `expiringWithin30Days`, `active`, `archived`. São derivados das visitas e das invoices, não guardados.

**Detalhe**: caixa do cliente (Property address, telefone, e-mail) e tabela de detalhes (Job #, Job type, Started on, Ends on, Billing frequency "Upon job completion", Automatic payments, Salesperson, From Quote, From Request, Booking confirmation). Depois Product / Service com Subtotal, Total, Required deposit, Deposit collected e Outstanding deposit. Seguem Labor (timesheets), Expenses, Scheduled visits (data/hora, título + instruções, estado Completed/Overdue, atribuído, checkbox de concluir), Billing (invoices do job; linha "Create · Upcoming" enquanto não há invoice) e Notes.

**More**: Close Job, Create Similar Job, Send Job Follow-up Email, Resend Booking Confirmation (texto ou e-mail), Create Invoice, Collect Signature, Print or Save PDF, Delete.

**Campos da API (`JobDetails`)**: jobNumber, title, jobType (ONE_OFF/RECURRING), jobStatus, lineItems {name, description, quantity, unitPrice, unitCost, totalPrice, taxable}, subtotal, discount {rate, type}, total, startAt, endAt, completedAt, instructions, billingType, invoiceSchedule {billingFrequency}, visitsInfo {first/last date, counts}, quote {requiredDeposit, depositRecords, amounts.outstandingDepositAmount}, request, arrivalWindow.

## Invoices

**Lista**: Overview (Past due, Sent but not due, Draft, com saldo), Issued (30 dias sem hoje), Average invoice, Invoice payment time (dias de emitida a paga, pagas nos últimos 7 dias). Tabela Client · Invoice number · Due date · Subject · Status · Total · Balance. Filtros Status e Due date.

**Estados**: `draft`, `awaiting_payment`, `past_due`, `paid`, `bad_debt`, `voided`.

**Detalhe**: cliente (Billing address, Property address), Invoice #, Invoice for (Job), Issued, Viewed in Client Hub, Payment terms, Due date, Paid, Salesperson. Product / Service com Subtotal, Discount, Total; depois uma linha por pagamento ("Deposit collected · data", "Payment · data", em negativo), Invoice balance e Account balance. Seguem Contract / Disclaimer e Notes. Na lateral ficam Client hub payments e Client view (mostrar quantidades, preços, saldo da conta, carimbo de atraso).

**More** (aberta): Send as Text/Email, Create Similar Invoice, Preview as Client, Collect Signature, Print or Save PDF, Close Invoice, Delete, Void Invoice. Paga: botão Re-open Invoice.

**Close Invoice**: sem pagamento (fica Paid mesmo com saldo), com pagamento, ou Bad Debt (o saldo é abatido).

**Prazos**: Due upon receipt, Net 15, Net 30, Net 45, Custom.

## Payments

**Registo de pagamento** (`PaymentRecord`): amount, entryDate, paymentType (BANK_TRANSFER, CASH, CHECK, CREDIT_CARD, PAYPAL, OTHER), adjustmentType (PAYMENT, DEPOSIT, …), details ("Payment applied to Invoice #595"), confirmationNumber, paymentOrigin, refunds, disputes. Tem também `allocations[] {amount, invoice}`: um pagamento pode cobrir várias invoices.

**Depósito**: registado na quote (adjustmentType DEPOSIT, `quote` preenchido). Quando a invoice do job dessa quote é criada, entra como "Deposit collected" na invoice. Na lista aparece como "Quote #1936 / Invoice #591".

**Novo pagamento** (`/payments/new?clientId=&invoiceId=`): Payment method (Jobber Payments: cartão; payment record: Other, Bank transfer, Cash, Check, Credit/debit card, PayPal), Transaction Date, Reference #, Details. Depois "Outstanding invoices" com checkbox e Enter Payment por invoice, e o Account balance. Botões Cancel, Save and Email Receipt e Save.

**Lista** (`/payments`): Upcoming payouts, Invoice payment time, Invoices paid on time (60 dias). Tabela Client + documento · Payment date · Payment status · Method · Payout date · Amount. Filtros Status, Method e Date. Separador Payouts e página de disputas (só para Jobber Payments).

**Detalhe**: estado, valor, cliente, Transaction date, Method, Reference number, Details, Applied to. More: Download PDF, Delete. Botão Send Receipt.

## Como o Job To Go modela

- `jobs.status` mantém `scheduled`/`in_progress`/`done`/`cancelled`, que o Schedule e Clients já leem. `done` significa fechado e preenche `closed_at`. O estado da lista é calculado em `lib/jobs/status.ts`.
- `invoices.status`: `draft`, `sent`, `overdue`, `paid`, `bad_debt`, `cancelled` (Voided). Awaiting payment e Past due são calculados pelo `due_on` em `lib/invoices/status.ts`.
- `payments` (kind `payment`/`deposit`, method, amount em pence, `paid_on`, reference, details, `quote_id`) e `payment_allocations` (payment → invoice, amount).
- `invoices.balance` = total − alocações − `bad_debt_amount`, recalculado em `lib/payments/engine.ts`.
- Os depósitos sem alocação de uma quote são aplicados à invoice quando ela é criada a partir do job dessa quote.
- Ficou de fora, por ser exclusivo do Jobber Payments ou de outros módulos: cobrança online, payouts, disputas, refunds, gorjetas, client hub, jobs recorrentes, timesheets e expenses, assinatura e PDF.
