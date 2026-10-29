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

## Envio por e-mail e texto, PDF e Preview as Client (observado em 28 out 2026)

Fonte: conta Jobber da Moving London, via Chrome com porta de debug (fluxo REA de observação), sem enviar nada.

**Invoice → More**: "Send as… Text Message / Email", Create Similar Invoice, Preview as Client, Collect Signature, Print or Save PDF, Close Invoice, Delete, Void Invoice.

**Email invoice #609**: To, Subject `Invoice from Moving London Removals & Transport - Removal Service`, Message ("Hi {cliente}, Thank you for your recent business with us. The invoice total is £380.00, with £380.00 to be paid by 28/10/2026. …"), checkbox com `invoice_<id>.pdf` anexado, Attachments, Send me a copy. À direita, preview do e-mail: INVOICE + empresa + logo, valor grande, "Your invoice is due on …", botão View Invoice, a mensagem e o rodapé.

**Text invoice**: "Hi {cliente}, here's your invoice from {empresa} for £380.00." + "View your invoice here: {link curto}". Contador de caracteres.

**Job → More**: Close Job, Create Similar Job, Send Job Follow-up Email, Resend Booking Confirmation Text / Email, Create Invoice, Collect Signature, Print or Save PDF, Delete. A confirmação de reserva por e-mail: "Booking confirmation from {empresa}", "Your booking is confirmed! … Location / Date / Estimated Arrival Time". Por texto: "Good news, your work has been booked! Location / Date / Estimated Arrival Time / View details here {link}". O Jobber não tem Preview as Client no job; o cliente vê o job no Client Hub.

**PDF** (`heavy.getjobber.com/invoices/<id>.pdf`, `/work_orders/<id>.pdf`): logo e empresa (morada | telefone | e-mail | site) no topo de cada página; RECIPIENT à esquerda; à direita caixa cinza-escura "Invoice #609" com Issued, Due e a linha Total; título; tabela com cabeçalho escuro Product/Service · Description · Qty. · Unit Price · Total (o job só tem Qty.); totais à direita e nota à esquerda; "Page x of y"; carimbo PAST DUE.

**Preview as Client da invoice**: Client Hub com empresa no topo, cartão com Invoice #, título, cliente, Issued/Due, estado, tabela e totais.

### Como o Job To Go reproduz

- Um único "Send email & text" (`components/funnel/send-dialog.tsx`) no More de request, quote, job e invoice e no menu do Save de New quote, New job e New invoice. Abas Email (composer + preview HTML ao lado, PDF anexado) e Text message (SMS curto + preview). Um clique envia os dois; o texto fica registado como não enviado até haver fornecedor de SMS.
- Rascunhos em `lib/send/drafts.ts` com os textos acima; entrega em `lib/send/deliver.ts` (Gmail com PDF e logo inline; registo em `email_deliveries`, `sms_deliveries`, `communications` e `activity_log`).
- PDFs em `lib/pdf/document.ts` (pdf-lib, layout acima) para quote, job e invoice; rotas `/api/{quotes,jobs,invoices}/<id>/pdf` e, para o cliente, `/q|/j|/i/<id>/pdf`.
- Preview as Client: `/i/<id>` (invoice) e `/j/<id>` (job), no estilo do Client Hub.

## Home: Today's appointments e Timesheets (observado em 29 out 2026)

Fonte: conta Jobber da Moving London, no Chrome do utilizador via CDP (REA `list-browser-targets`/`inspect-web-page` e captura das respostas GraphQL ao recarregar a Home), só leitura. Nenhuma entrada de tempo foi gravada.

**Today's appointments**: totais em £ (Total, Active, Completed, Overdue, Remaining), botão View Schedule e dois separadores.
- **Visit**: grupos `N OVERDUE`, `N ACTIVE`, `N REMAINING`, `N COMPLETED` (vazio: "No scheduled events"). Cada cartão tem barra de cor pelo tipo, título, janela ("9:00 AM – 3:00 PM" ou "Anytime"), avatares da equipa e valor.
- **Employee**: um bloco por utilizador ativo (avatar, nome, relógio `00:00:00` do tempo registado hoje) com as visitas dele por baixo, e um bloco "Unassigned".

**API**: `TodaysAppointmentsHomeInit` devolve `revenue.revenueByStatus` (ACTIVE, COMPLETED, OVERDUE, REMAINING), `revenueByVisit`, `revenueTotal`, `users` (com status ACTIVATED/DEACTIVATED) e `timeSheetEntries` do dia. `TodaysAppointmentsByStatus(appointmentStatus)` devolve `scheduledItems` (`Event` ou `Visit`). Uma `Visit` traz `title`, `startAt`, `endAt`, `allDay`, `isComplete`, `visitClient`, `job`, `assignedUsers` (vários) e `timeSheetEntries`.

**Timesheets** (`/timesheets`): Day/Week, um bloco por pessoa com Clock in e Add entry. "Create Timesheet Entry": Employee, alvo (jobs, assessments ou categoria, por omissão "General"), Start Date, Start Time, End Time, Hours, Minutes, Notes. Formato de duração da conta: horas e minutos.

### Como o Job To Go modela

- `team_members` (equipa, ativa/desativada), `job_visit_members` (várias pessoas por visita) e `time_entries` (pessoa, job, visita, início, fim nulo enquanto o relógio corre, notas; um relógio a correr por pessoa). Migração `0022_team_time.sql`.
- O Dashboard junta os dois separadores numa lista: os grupos e valores do Visit, e em cada visita a equipa, o tempo de cada pessoa nessa visita, Clock in/out, Assign, Time e "Unassigned". Por cima, uma faixa com o relógio do dia de cada pessoa (o cabeçalho do Employee).
- Estados (`lib/team/time.ts`): Completed se marcada feita; Active com alguém a trabalhar ou dentro da janela; Overdue depois da hora de fim; senão Remaining. Anytime nunca fica Overdue no próprio dia.
- Valor da visita: total do job dividido pelas visitas do job, para não contar o job duas vezes.
- Página do job: secção Labour com todas as entradas, total do job e total por pessoa. Equipa gerida em `/equipa`.
