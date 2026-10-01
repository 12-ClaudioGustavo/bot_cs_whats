# Motor Multi-Bot — Changelog

## 1. Bugs de isolamento corrigidos (críticos para SaaS)
Estes já quebravam o "não pode sobrepor conversas" assim que houvesse 2+ tenants:

- **`clientService.js`** — buscava clientes só por `phone`, sem filtrar `tenant_id`. Dois tenants com o mesmo número de cliente colidiam no mesmo registo.
- **`stateManager.js`** — cache de conversa em memória chaveada só por `phone`. Corrigido para `tenantId::phone`.
- **`catalog.js` / `faq.js`** — liam `services`/`faqs` sem filtrar por tenant: todos os tenants viam o mesmo catálogo/FAQ.
- **`messageHandler.js`** — `tenantService.recordMessageUsage()` era chamado sem `tenantId`, debitando SEMPRE o consumo de mensagens do primeiro tenant, quebrando o controlo de limite de plano de todos os outros.
- **`/api/admin/subscriptions/assign`** — usava variáveis (`tenantId`, `planCode`) que não existiam (bug de referência), o endpoint nunca funcionou.
- **Sessão de desconexão** — `disconnect` só marcava `status: disconnected` na BD, mas deixava o socket Baileys vivo em memória (fantasma), continuando a responder mensagens mesmo depois do utilizador desligar pelo painel.

## 2. Motor multi-bot (novo)
- **`src/bot/botManager.js`** (novo) — substitui o `connection.js` de sessão única. Mantém um socket Baileys por `(tenant_id, session_name)`, com QR, reconexão e logout próprios.
- **`src/services/supabaseAuthState.js`** — credenciais WhatsApp agora guardadas por tenant/sessão (tabela `bot_auth_state` com chave composta), em vez de uma única identidade global.
- **`supabase_bot_engine_migration.sql`** (novo) — corre isto no Supabase depois do `supabase_multi_tenant_schema.sql`. Adiciona o escopo por tenant ao `bot_auth_state` e `notification_phone` à tabela `tenants`.

## 3. Endpoints novos/corrigidos (`src/bot/httpServer.js`)
- `POST /api/whatsapp/sessions` — liga um número novo, respeitando o limite `max_whatsapp_accounts` do plano (`planService.canCreateSession`).
- `POST /api/whatsapp/sessions/disconnect` e `DELETE /api/whatsapp/sessions/:sessionName` — agora fazem logout real (apagam a sessão do botManager e da BD).
- `GET /events` (SSE) — agora autenticado e **escopado ao tenant**: cada empresa só recebe o QR/estado dos seus próprios números.
- `GET /health` e `GET /` — deixaram de depender de um `botStatus` global; reportam quantas sessões estão ligadas na plataforma.

## 4. Painel (`cspace-web/src/app/dashboard/whatsapp/page.tsx`)
- Reescrito para suportar **vários números por tenant**, cada um com o seu cartão, QR e estado independentes.
- Botão "Adicionar número" (chama o novo endpoint, mostra erro se o plano tiver atingido o limite).
- `EventSource` corrigido com `withCredentials: true` (necessário para o cookie de sessão viajar entre `localhost:3000` e `localhost:3001`).

## 5. Isolamento de dados via RLS (novo — `supabase_rls_hardening.sql`)
Contexto importante: o backend usa sempre a `service_role key`, que **ignora RLS por natureza** — nenhuma policy muda isso. O que o RLS aqui protege é o cenário em que a `anon key` (a chave pública) seja alguma vez exposta no frontend por engano: sem RLS bem configurado, essa chave leria/escreveria os dados de **todos os tenants**, ignorando a aplicação por completo.

- Corrigi 3 policies que eu próprio (e o schema original, no caso de `audit_logs`) tinha criado com `USING (true)` **sem restringir a role** — isso na prática abria a tabela a qualquer chave, incluindo a `anon`. Agora estão explicitamente `TO service_role`.
- Ativei RLS em todas as tabelas de negócio que ainda não tinham (`clients`, `conversations`, `appointments`, `services`, `faqs`) — sem isto, ficavam completamente abertas por omissão no Supabase.
- Sem nenhuma policy visível para `anon`/`authenticated`, o RLS nega por omissão — é assim que o Postgres funciona.
- Revoguei também os grants de tabela (`REVOKE ALL ... FROM anon, authenticated`) como camada extra: a query falha de forma explícita em vez de devolver silenciosamente 0 linhas.
- Confirmei que o `cspace-web` nunca fala com o Supabase diretamente (sempre via gateway), por isso este endurecimento não quebra nada no frontend.

## 6. Avisos de limite de plano na UI
- **Bug corrigido**: `/api/dashboard/stats` chamava `recordMessageUsage(tenantId, 'check')`, que na verdade **incrementava o contador de mensagens recebidas a cada carregamento do painel** (efeito colateral não intencional). Substituído por `tenantService.getUsageStatus()`, uma função só de leitura.
- `tenantService.js` — nova função `getUsageStatus(tenantId)`: calcula `messagesUsed`, `messagesLimit`, `usagePercent`, `nearLimit` (≥80%) e `limitReached` (100%+), a partir do plano e do `usage_logs` do mês corrente. Também corrigi dois `.single()` que rebentavam com erro quando um tenant ainda não tinha subscrição/log (agora `.maybeSingle()`).
- **Banner global** (`dashboard/layout.tsx`) — aparece em qualquer página do painel: amarelo a partir de 80% de uso, vermelho ao atingir 100%, com link directo para a página de planos. Atualiza a cada 2 minutos.
- **Barra de uso detalhada** (`dashboard/billing/page.tsx`) — mostra `mensagens usadas / limite do plano`, com barra de progresso colorida (verde/amarelo/vermelho) e uma nota explicativa.

> **Actualização:** o bloqueio automático já foi implementado — ver secção 7 abaixo.

## 7. Bloqueio real do bot ao atingir o limite (novo)
- `messageHandler.js` — depois dos comandos de admin (que continuam a funcionar) e antes de qualquer resposta automática, verifica `tenantService.getUsageStatus(tenantId)`. Se `limitReached`, o fluxo normal do bot é cortado.
- O **cliente recebe um único aviso** ("atendimento automático temporariamente indisponível") — não repete a cada mensagem nova, fica guardado no estado da conversa (`limitNoticeShown`). Se a conversa resetar (ex: timeout de inactividade), o aviso pode voltar a ser mostrado uma vez.
- O **admin é notificado** (`notifyLimitReached`), mas no máximo uma vez a cada 6 horas por tenant — evita inundar o WhatsApp do admin caso o número receba muitas mensagens depois de estourar o limite.
- Os comandos directos do admin (`!aprovar <id>` / `!cancelar <id>`) continuam a funcionar mesmo com o limite atingido — só o atendimento automático a clientes é cortado.


## Próximos passos sugeridos (não incluídos ainda)
1. Correr `supabase_bot_engine_migration.sql` **e depois** `supabase_rls_hardening.sql` no teu projeto Supabase (por esta ordem).
2. Página de faturação: ligar a um gateway de pagamento real (Stripe/Multicaixa Express) — hoje o `planService`/`subscriptions` só gerem o estado, não cobram.

