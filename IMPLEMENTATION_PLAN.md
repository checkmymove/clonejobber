# Plano de implementação — Gestão de mudanças em Londres

> Documento de referência do produto. Última atualização: 26 de setembro de 2026.

**Hospedagem (ler antes de git/deploy):** este projecto **não** é da conta GitHub `korenonline7` nem da equipa Vercel KOREN. Repositório, Vercel e Supabase estão em `AGENTS.md`.

## 1. Objetivo

Construir uma ferramenta interna para gerir uma empresa de mudanças sediada em Londres, Reino Unido. A aplicação será usada por uma única pessoa e por uma única empresa; não é um SaaS, não haverá multiempresa, cobrança de assinatura ou gestão de equipa nesta primeira versão.

O produto toma como referência visual e de fluxo o Jobber, sem tentar reproduzir toda a plataforma. As imagens de consulta ficam em `plints/`.

## 1.1 Estado actual (26 de setembro de 2026)

Stack: Next.js 15 App Router, Server Actions, postgres.js, Supabase PostgreSQL (`jstvjtbenlsasqjytxmx`). Dinheiro em pence. Locale `en-GB`, GBP, fuso `Europe/London`. Empresa única: slug `moving-london`.

**Já funciona (local):**
- Funil Cliente → Solicitação → Cotação → Serviço → Fatura, persistido na base, com conversões (cotação aprovada → serviço; serviço concluído → fatura) e reutilização se já existir o documento destino.
- Listas com pesquisa `?q=`, detalhes, criar e **editar** cotações em rascunho, serviços agendados/em andamento e faturas em rascunho. Documentos enviados/concluídos/pagos não são sobrescritos.
- Gmail OAuth interno (Workspace **Internal**): página `/configuracoes/email`, envio real de cotação/fatura, pasta Sent, log em `email_deliveries` + `communications`. Testado com sucesso em 26/09/2026.
- Login de um administrador (`hello@movinglondontransport.com`) via Supabase Auth. Middleware e `requireAdmin()` fecham o painel, as mutations e os ficheiros. O formulário público `/r/[slug]` continua aberto. Senha só em `.env` (`ADMIN_PASSWORD`), criada com `node scripts/ensure-admin.mjs`.
- RLS: migração `0009`. `anon` sem grants. `authenticated` só lê/escreve se `auth.uid()` for o perfil admin. Tabelas `google_oauth_tokens` e `google_oauth_states` ficam sem policy. A app continua a usar `DATABASE_URL` como owner (ignora RLS); a autorização dessa ligação é o login.
- Testes: `npm test` (unitários + integração com rollback, incluindo RLS). Migrações em `supabase/migrations/` (`0001`–`0009`).

**Ainda não feito:**
- Fotos da solicitação no Storage; desconto/imposto na cotação; agenda do dashboard; edição completa de solicitações.
- Testes públicos no domínio da Vercel `https://clonejobber.vercel.app`, até existir um domínio novo. `movinglondontransport.com` continua ligado ao projeto, mas não é o endereço de teste. OAuth **local** continua com `GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/api/integrations/google/callback`. O redirect de produção aponta para `https://clonejobber.vercel.app/api/integrations/google/callback` e ainda precisa de ser acrescentado no cliente Google Cloud para o Gmail funcionar nesse host.
- Pagamentos, WhatsApp, portal do cliente.

**OAuth Google (confirmado):**
- Origins: `http://127.0.0.1:3000`, `http://localhost:3000`, `https://movinglondontransport.com`
- Redirects: os mesmos hosts + `/api/integrations/google/callback`
- Scopes: `gmail.send` e `userinfo.email` (não usar `users/me/profile`; `gmail.send` não chega)
- Audience: Internal (Workspace). Não tornar External.
- O `state` OAuth fica na tabela `google_oauth_states` (cookies em `127.0.0.1` falharam no callback)

**Onde o próximo chat deve partir:** confirmar o login em `https://clonejobber.vercel.app`. O domínio novo ainda não foi comprado; `movinglondontransport.com` não é o endereço de teste. Em local, o que falta no produto é fotos da solicitação, desconto/imposto, agenda do dashboard ou edição de solicitações.

## 2. Escopo aprovado (MVP)

O funil principal será:

```text
Cliente → Solicitação → Cotação → Serviço → Fatura
```

### Módulos incluídos

1. **Dashboard principal**
   - Resumo do funil: solicitações, cotações, serviços e faturas por status.
   - Agenda de serviços do dia.
   - Valores a receber, faturamento do período e alertas de faturas vencidas.

2. **Clientes**
   - Criar, editar, pesquisar e consultar clientes.
   - Nome, e-mail, telefone, notas e endereços associados.
   - Histórico de solicitações, cotações, serviços e faturas do cliente.

3. **Solicitações de mudança (New Request)**
   - Captura do pedido inicial e dados para estimativa.
   - Origem e destino; postcodes; andares; elevador; estacionamento; quartos; data desejada; duração estimada; embalagem; inventário; fotos; notas e itens iniciais.
   - Painel/lista de solicitações por status.

4. **Cotações (New Quote)**
   - Criar a partir de solicitação ou diretamente para um cliente.
   - Itens de cobrança, quantidade, preço unitário, desconto, impostos se aplicáveis, total, validade e observações.
   - Estados: rascunho, enviada, aprovada, recusada e expirada.
   - Conversão de uma cotação aprovada em serviço, sem redigitar os dados.

5. **Serviços (New Job)**
   - Criar a partir da cotação aprovada ou diretamente.
   - Data/hora, janela de atendimento, endereços, escopo, instruções e status de execução.
   - Visualização de agenda e painel de serviços.
   - Estados: agendado, em andamento, concluído e cancelado.

6. **Faturas (New Invoice)**
   - Criar a partir de serviço concluído ou diretamente.
   - Linhas de cobrança, vencimento, status, total e notas para cliente.
   - Estados: rascunho, enviada, paga, vencida e cancelada.
   - Painel de faturas e valores pendentes.

7. **E-mail de operação**
   - Conectar uma conta profissional do Google Workspace/Gmail via OAuth.
   - Enviar cotações e faturas usando o endereço da própria empresa e preservar a mensagem na pasta “Enviados”.
   - Registrar no sistema quando e para qual endereço cada documento foi enviado.

## 3. Fora de escopo inicial

- Plataforma SaaS, tenants/multiempresa, convites ou permissões de equipa.
- Portal do cliente.
- Pagamento online, conciliação bancária e recorrência.
- Integração WhatsApp/Wacli (fica para a etapa final).
- Roteirização, rastreamento GPS, aplicativo de motoristas e controle de frota.
- Marketing, CRM avançado e automações complexas.
- Migração de dados de outro sistema.

Esses itens devem ser construídos apenas quando houver uma necessidade operacional clara, sem comprometer a estrutura do MVP.

## 4. Arquitetura proposta

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| Interface | Next.js, TypeScript, Tailwind CSS e shadcn/ui | Telas, formulários, listas, dashboard e experiência responsiva. |
| Aplicação/back-end | Next.js Server Actions e Route Handlers | Regras de negócio, validações, geração de documentos e integrações. |
| Dados, login e arquivos | Supabase: PostgreSQL, Auth e Storage | Banco de dados, login individual, anexos/fotos e políticas de segurança. |
| Hospedagem da aplicação | Vercel | Build, preview e produção do projeto Next.js. |
| Código | GitHub | Histórico de código, revisão e integração contínua. |

O front-end e o back-end vivem no mesmo repositório e projeto Next.js. Isso reduz manutenção sem sacrificar a separação entre interface, regras de negócio e banco de dados.

## 5. Ambientes

Inicialmente, manter apenas dois ambientes de dados e aplicação:

| Ambiente | Finalidade |
|---|---|
| Desenvolvimento/preview | Mudanças em teste, associadas a branches e previews da Vercel. Banco Supabase de desenvolvimento. |
| Produção | Sistema usado na operação real. Projeto Supabase e deployment Vercel de produção separados. |

Nunca usar dados reais de clientes para testes. As chaves de produção ficam somente nas variáveis de ambiente da Vercel e do Supabase, nunca no GitHub ou no navegador.

## 6. Modelo inicial de dados

### Entidades principais

| Entidade | Dados principais | Relações |
|---|---|---|
| `profiles` | Conta administradora vinculada ao Supabase Auth | 1 usuário administrador nesta fase. |
| `clients` | Nome, e-mail, telefone, notas | Um cliente possui muitas solicitações, cotações, serviços e faturas. |
| `client_addresses` | Linha de endereço, cidade, postcode, instruções | Pertence ao cliente; pode ser usada como coleta ou entrega. |
| `requests` | Data desejada, tipo de mudança, origem/destino, andares, elevador, estacionamento, quartos, embalagem, inventário, notas e status | Pertence a um cliente; pode originar várias cotações. |
| `request_photos` | Caminho privado no Storage, legenda e ordem | Pertence a uma solicitação. |
| `quotes` | Número, status, validade, subtotal, desconto, imposto, total, mensagem e data de envio | Pertence ao cliente e opcionalmente à solicitação. |
| `quote_line_items` | Descrição, quantidade, unidade, valor unitário e total | Pertence a uma cotação. |
| `jobs` | Número, data/hora, janela de atendimento, status, instruções e totais operacionais | Pertence a cliente e pode derivar de cotação/solicitação. |
| `invoices` | Número, status, data de emissão, vencimento, subtotal, imposto, total, saldo e data de envio | Pertence ao cliente e pode derivar de serviço/cotação. |
| `invoice_line_items` | Descrição, quantidade, unidade, valor unitário e total | Pertence a uma fatura. |
| `activity_log` | Tipo de evento, entidade, data, resumo e metadados | Linha do tempo auditável de ações importantes. |
| `email_deliveries` | Tipo do documento, destinatário, assunto, horário, status e identificador do Gmail | Histórico operacional de e-mails. |

### Regras de dados

- Valores monetários serão armazenados em **pence** como inteiro: `125000` representa `£1,250.00`.
- Exibição padrão em libra esterlina, locale `en-GB` e fuso `Europe/London`.
- Todos os documentos recebem numeração legível e imutável, por exemplo `REQ-0001`, `Q-0001`, `JOB-0001` e `INV-0001`.
- Depois de enviada, uma cotação não deve ser sobrescrita silenciosamente. Alterações relevantes geram revisão/histórico.
- Exclusão física deve ser evitada para registros financeiros; preferir cancelamento/arquivamento e log de atividade.

## 7. Funil e regras de negócio

```text
Criar cliente
  └─ Criar solicitação com dados da mudança
       └─ Criar cotação com itens e preço
            └─ Aprovar cotação
                 └─ Criar/agendar serviço
                      └─ Concluir serviço
                           └─ Criar/enviar fatura
                                └─ Registrar pagamento (futuro)
```

- Uma solicitação pode ter mais de uma cotação; apenas a aprovada pode gerar o serviço padrão.
- Uma cotação aprovada copia seus dados para o serviço, mantendo links de origem entre todos os registros.
- O serviço concluído pode gerar uma fatura pré-preenchida, que ainda pode ser revisada antes do envio.
- Conversões não apagam o documento original e devem aparecer no histórico.
- Criação direta de cotação, serviço e fatura continua permitida para casos operacionais excepcionais.

## 8. Dashboards e telas

### Navegação lateral inicial

```text
Dashboard
Clientes
Solicitações
Cotações
Serviços
Faturas
```

O botão **Create** terá atalhos para criar Cliente, Solicitação, Cotação, Serviço e Fatura, conforme as imagens de referência.

### Dashboard principal

- Cartões do funil por status e valor: solicitações novas, cotações aprovadas, serviços que requerem ação e faturas pendentes.
- Serviços de hoje, próximos e atrasados.
- Contas a receber e faturas vencidas.
- Receita mensal e próximos serviços, desde que haja dados suficientes.

### Dashboards por módulo

- **Clientes:** pesquisa, lista, últimos clientes e dados de contato.
- **Solicitações:** nova, aguardando análise, cotada, fechada/arquivada.
- **Cotações:** rascunhos, enviadas, aprovadas, recusadas e expiradas; valores por etapa.
- **Serviços:** agenda/lista por dia/semana e status de execução.
- **Faturas:** rascunhos, enviadas, pagas e vencidas; saldo a receber.

## 9. Autenticação e segurança

- Um único usuário administrador será criado no Supabase Auth.
- Ainda que o uso seja individual, todas as tabelas públicas terão Row Level Security (RLS) ativada.
- As políticas permitirão dados apenas para o usuário autenticado autorizado.
- Fotos e anexos serão armazenados em bucket privado do Supabase Storage; arquivos são acessados por URLs assinadas de curta duração.
- A chave `service_role` nunca será exposta ao front-end. Apenas chaves públicas apropriadas podem usar prefixo `NEXT_PUBLIC_`.
- Validações acontecem no servidor; o navegador não é fonte de autorização.
- Auditoria mínima em `activity_log` para criação, alteração de status, envio e cancelamento.
- Backup e exportação periódica do banco devem ser configurados antes de operar com dados reais.

## 10. E-mail: decisão inicial

Não é necessário contratar uma plataforma transacional de e-mail para o MVP.

Usaremos OAuth do Google para conectar uma conta profissional de Gmail/Google Workspace. A aplicação enviará mensagens por esta conta, sob o domínio e remetente da empresa, e registrará o envio internamente.

Uma ferramenta como Resend, Postmark ou SendGrid poderá ser adicionada no futuro para automações de alto volume, melhor controle de entrega ou envio independente da caixa Gmail. A camada de envio será construída como uma interface de serviço para permitir essa troca sem reescrever cotações ou faturas.

### 10.1 Estado atual da infraestrutura de e-mail e domínio

| Item | Estado | Observação |
|---|---|---|
| Projeto Google Cloud / cliente OAuth | Criado | O Client ID e o Client Secret foram gerados pelo proprietário. |
| Segredos Google OAuth locais | Configurado | `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão apenas no `.env`, que é ignorado pelo Git. |
| Template de ambiente | Protegido | `.env.example` contém somente placeholders e jamais deve receber valores reais. |
| Domínio de produção | Configurado | `movinglondontransport.com` está associado, verificado e respondendo por HTTPS no projeto Vercel `clonejobber`. |
| URL pública da aplicação | Configurada localmente | `NEXT_PUBLIC_APP_URL=https://movinglondontransport.com` está no `.env`. |
| Callback OAuth na aplicação | Feito | `/api/integrations/google/start` e `/api/integrations/google/callback`. |
| Cadastro no Google Cloud | Feito | Origins e redirects locais (`127.0.0.1` e `localhost`) e de produção. |
| Escopos | Feito | `gmail.send` + `userinfo.email`. |
| Ligação Gmail local | Feito | Conta Workspace ligada; envio de cotação/fatura validado. |
| Variáveis na Vercel | Feito | Produção: Supabase, `ADMIN_EMAIL`, `DATABASE_URL`, OAuth. `NEXT_PUBLIC_APP_URL` e `GOOGLE_REDIRECT_URI` apontam para `https://clonejobber.vercel.app`. |

#### Configuração Google Cloud que deverá permanecer cadastrada

```text
Authorized JavaScript origins
http://127.0.0.1:3000
http://localhost:3000
https://movinglondontransport.com

Authorized redirect URIs
http://127.0.0.1:3000/api/integrations/google/callback
http://localhost:3000/api/integrations/google/callback
https://movinglondontransport.com/api/integrations/google/callback

OAuth scopes
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/userinfo.email
```

Não usar `app.movinglondontransport.com` enquanto esse subdomínio não tiver sido criado e apontado. A aplicação usará o domínio raiz como origem canônica.

## 11. Pagamentos e WhatsApp: fases posteriores

### Pagamentos

No MVP, a fatura terá status operacional manual. A integração posterior deve ser adicionada por um módulo de pagamentos conectado às faturas, sem alterar o funil central.

Opções a avaliar na etapa adequada:

- Stripe, para cartão e links de pagamento.
- GoCardless, se débito direto fizer sentido para a operação no Reino Unido.
- Transferência bancária, com instruções na fatura e marcação manual de pagamento.

### WhatsApp via Wacli

Fica para a fase final. Casos de uso previstos: confirmação de cotação, lembrete de serviço, aviso de equipe a caminho, envio de fatura e lembrete de vencimento. A integração deve respeitar consentimento do cliente, templates aprovados quando necessários e registro de cada comunicação.

## 12. Fases de implementação

### Fase 0 — Fundação

1. Criar repositório GitHub, projeto Supabase e projeto Vercel.
2. Configurar ambientes de desenvolvimento e produção.
3. Criar aplicação Next.js com TypeScript, Tailwind, componentes e convenções de código.
4. Configurar Supabase Auth, schema, migrações, RLS e bucket privado de arquivos.
5. Criar layout visual base a partir das referências em `plints/`.

**Critério de aceite:** login administrador funciona; aplicação está publicada em preview; banco protegido e acessível apenas pelo usuário autorizado.

### Fase 1 — Clientes e solicitações

1. Cadastro, edição, lista e busca de clientes.
2. Formulário de solicitação de mudança com todos os campos essenciais.
3. Upload e visualização privada de fotos.
4. Lista/dashboard de solicitações e linha do tempo.

**Critério de aceite:** é possível registrar uma demanda real de mudança, anexar fotos e localizá-la rapidamente depois.

### Fase 2 — Cotações

1. Catálogo simples de itens/serviços reutilizáveis.
2. Cotação com cálculos em GBP, desconto, validade e notas.
3. Fluxo de rascunho, envio, aprovação, recusa e expiração.
4. Visualização/impressão em formato profissional e e-mail via Gmail.

**Critério de aceite:** uma solicitação pode resultar em cotação enviada por e-mail, com valores corretos e histórico preservado.

### Fase 3 — Serviços

1. Conversão de cotação aprovada em serviço.
2. Agenda diária/semanal e lista de serviços.
3. Status, instruções operacionais e conclusão.

**Critério de aceite:** uma cotação aprovada cria um serviço agendado sem reentrada dos dados essenciais.

### Fase 4 — Faturas e dashboard

1. Conversão de serviço em fatura e edição final de itens.
2. Vencimento, status e envio por e-mail.
3. Dashboard principal e dashboards dos módulos com métricas reais.
4. Estado de pagamento manual inicialmente.

**Critério de aceite:** o ciclo completo é executável de ponta a ponta e os valores pendentes aparecem no dashboard.

### Fase 5 — Estabilização e integrações futuras

1. Testes dos fluxos críticos e validação em dispositivos de uso real.
2. Backups, logs de erro e exportação de dados.
3. Integração de pagamento escolhida.
4. Integração WhatsApp pela Wacli.

## 13. Testes e qualidade

- Testar obrigatoriamente a jornada completa: cliente → solicitação → cotação → serviço → fatura.
- Testar cálculos de totais, descontos, arredondamentos e valores em GBP.
- Testar upload privado, permissões, sessão expirada e tentativas de acesso sem login.
- Testar criação a partir de registros anteriores e criação direta.
- Testar envio de e-mail com conta de teste antes de usar clientes reais.
- Manter dados de demonstração separados dos dados operacionais.
- Validar funcionalmente em produção após cada publicação relevante; build bem-sucedido não substitui esse teste.

## 14. Itens necessários do proprietário antes da Fase 0

- Repositório GitHub criado e vinculado à Vercel: `checkmymove/clonejobber`.
- Conta e projeto Supabase criados: referência `jstvjtbenlsasqjytxmx`.
- Conta e projeto Vercel criados: projeto `clonejobber` e domínio `movinglondontransport.com` configurado.
- E-mail profissional Google Workspace/Gmail que será usado como remetente.
- Nome comercial, logotipo e cores, se já disponíveis.
- Idioma oficial da interface: inglês britânico (`en-GB`).
- Lista inicial de serviços e preços comuns, mesmo que provisória.

Não compartilhar senhas, tokens, chaves privadas, credenciais do Gmail ou chaves `service_role` em conversas. As credenciais devem ser configuradas diretamente como variáveis de ambiente nos provedores apropriados.

## 15. Decisões registradas

| Tema | Decisão |
|---|---|
| Público | Ferramenta interna para uma única empresa de mudanças em Londres. |
| Usuários | Um administrador; sem gestão de equipa na primeira versão. |
| Funil | Cliente → Solicitação → Cotação → Serviço → Fatura. |
| Idioma | Inglês britânico (`en-GB`) em toda a interface. |
| Banco e autenticação | Supabase. |
| Aplicação | Next.js no mesmo repositório para front-end e back-end. |
| Hospedagem | Vercel para a aplicação; Supabase gerenciado para dados/arquivos/login. |
| E-mail inicial | Conta Google Workspace/Gmail conectada via OAuth. |
| Domínio de produção | `movinglondontransport.com`, hospedado no projeto Vercel `clonejobber`. |
| Pagamentos | Posteriores; status manual no MVP. |
| WhatsApp | Posterior, via Wacli. |
| Referência visual | Imagens localizadas em `plints/`. |
