# Notificações de Taxas para o Financeiro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar notificações internas em tempo real para usuários do perfil Financeiro sempre que uma nova Taxa Junta/Cartório for criada em um processo do ATLAS.

**Architecture:** O evento nasce no banco por trigger PostgreSQL após `INSERT` em `costs`, garantindo entrega mesmo quando a taxa for criada fora do formulário atual. As notificações ficam em `atlas_notifications`, protegidas por RLS por destinatário e organização; `notifications-v4.js` usa o cliente Supabase já autenticado para carregar, marcar como lida e assinar Realtime, enquanto `notifications-v4.css` controla o painel responsivo e o badge do sino.

**Tech Stack:** PostgreSQL/Supabase, RLS, Supabase Realtime, JavaScript ES5/ES6 compatível com o app estático atual, CSS, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-07-notificacoes-financeiro-taxas.md`

## Global Constraints

- O gatilho é apenas a criação de Taxa Junta/Cartório em `costs` com `fee_kind = 'junta_cartorio'` ou `cost_type = 'registry_fee'`.
- Apenas perfis `financeiro` ativos da mesma organização recebem notificações.
- Cada destinatário recebe exatamente uma notificação por `cost_id` e `event_type='fee_created'`.
- Usuários não podem inserir notificações manualmente pelo cliente.
- A primeira versão não notifica alterações posteriores de valor/vencimento.
- Nenhum serviço pago ou API externa será usado.
- O fluxo existente de `saveFinance()` em `process-financial.js` não deve mudar de semântica.
- A interface deve funcionar em desktop e mobile e reutilizar `openAtlasV4Process(processId)` quando disponível.

## Review Focus

- Taxa criada para processo sem `client_id`: ainda deve resolver organização pelo processo e criar notificação sem quebrar o trigger.
- Organização sem perfil financeiro ativo: o INSERT da taxa deve continuar normalmente, gerando zero notificações.
- Dois perfis financeiros ativos na mesma organização: ambos devem receber uma notificação independente, sem duplicidade por destinatário.
- Perfil financeiro de outra organização: não deve conseguir ler nem atualizar a notificação via RLS.
- Realtime reconectado ou painel reaberto: não deve duplicar itens na interface nem inflar o contador de não lidas.

---

### Task 1: Persistência, trigger e segurança no Supabase

**Files:**
- Create: `supabase/migrations/20261007_finance_fee_notifications.sql`
- Test: `tests/v4-finance-notifications-db-contract.test.mjs`

**Interfaces:**
- Consumes: `public.costs`, `public.processes`, `public.clients`, `public.profiles`, `current_org_id()` e autenticação Supabase já existentes.
- Produces: tabela `public.atlas_notifications`; função `public.atlas_notify_finance_fee_created()`; trigger `atlas_cost_fee_created_notify` em `public.costs`; publicação Realtime de `atlas_notifications`.

- [ ] **Step 1: Write the failing contract test**

Criar `tests/v4-finance-notifications-db-contract.test.mjs` e validar por regex que a migration contém:
- `create table ... atlas_notifications`;
- unique `(recipient_profile_id, event_type, cost_id)`;
- função `atlas_notify_finance_fee_created`;
- condição de taxa `junta_cartorio`/`registry_fee`;
- filtro de `profiles.role = 'financeiro'` e `active = true`;
- trigger `after insert on public.costs`;
- RLS habilitado e políticas de SELECT/UPDATE sem política de INSERT para `authenticated`;
- inclusão de `atlas_notifications` na publicação `supabase_realtime` de forma idempotente.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/v4-finance-notifications-db-contract.test.mjs`
Expected: FAIL porque a migration ainda não existe.

- [ ] **Step 3: Implement the migration**

Criar `supabase/migrations/20261007_finance_fee_notifications.sql` com:
- tabela e índices por `recipient_profile_id, read_at, created_at` e `organization_id`;
- FK para `profiles`, `processes`, `clients`, `costs` com comportamento de deleção seguro (`set null` para entidades operacionais; destinatário pode usar `cascade`);
- `unique(recipient_profile_id,event_type,cost_id)`;
- função `security definer` com `set search_path = public` que retorna `NEW` e ignora custos que não sejam taxa;
- resolução de `organization_id`, empresa, `public_code`, valor, vencimento, pagador e usuário originador quando disponível;
- `insert ... select` para todos os perfis financeiros ativos da organização com `on conflict do nothing`;
- policies: destinatário autenticado pode `select` e `update` apenas quando `recipient_profile_id = auth.uid()` e `organization_id = current_org_id()`; nenhum `insert/delete` para cliente;
- configuração idempotente do Realtime.

- [ ] **Step 4: Run the contract test**

Run: `node --test tests/v4-finance-notifications-db-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Apply migration to Supabase and verify behavior with SQL**

Aplicar a migration ao projeto `oorpvbxxpbxoaaykrtcf`.
Verificar em transação de teste ou usando uma taxa controlada que:
- taxa de Junta/Cartório cria N notificações para N financeiros ativos da mesma organização;
- perfil de outra organização recebe 0;
- tentativa de repetir a mesma combinação de `recipient_profile_id/event_type/cost_id` não duplica;
- custo que não seja `registry_fee/junta_cartorio` gera 0 notificações.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261007_finance_fee_notifications.sql tests/v4-finance-notifications-db-contract.test.mjs
git commit -m "feat: criar notificacoes financeiras por taxa"
```

### Task 2: Sino, painel e operações de leitura

**Files:**
- Create: `notifications-v4.js`
- Create: `notifications-v4.css`
- Modify: `index.html`
- Test: `tests/v4-finance-notifications-ui.test.mjs`

**Interfaces:**
- Consumes: `window.atlasAuth.client`, `window.atlasAuth.getProfile()`, `window.openAtlasV4Process(id)`, tabela `atlas_notifications` da Task 1.
- Produces: `window.AtlasNotificationsV4.init()`, `window.AtlasNotificationsV4.refresh()`, `window.AtlasNotificationsV4.markRead(id)`, `window.AtlasNotificationsV4.markAllRead()`.

- [ ] **Step 1: Write the failing UI contract test**

Criar `tests/v4-finance-notifications-ui.test.mjs` verificando:
- `index.html` possui `.bell` com `id="atlas-notification-bell"` e carrega `/notifications-v4.css` e `/notifications-v4.js` após `atlas-auth.js`;
- JS consulta `atlas_notifications` filtrando `recipient_profile_id`;
- JS calcula não lidas por `read_at === null`;
- JS implementa `markRead`, `markAllRead`, `openProcess` e subscription Realtime com filtro `recipient_profile_id=eq.<profileId>`;
- CSS possui badge e painel com breakpoint mobile.

- [ ] **Step 2: Run the UI test and verify it fails**

Run: `node --test tests/v4-finance-notifications-ui.test.mjs`
Expected: FAIL porque os arquivos e IDs ainda não existem.

- [ ] **Step 3: Update the bell markup and asset loading in `index.html`**

Alterar o botão atual para manter o ícone, adicionar `id="atlas-notification-bell"`, `aria-expanded="false"` e um `<span id="atlas-notification-count" ...>` interno; carregar `notifications-v4.css` no `<head>` e `notifications-v4.js` depois de `atlas-auth.js` e antes das camadas V4 que dependam do app autenticado.

- [ ] **Step 4: Implement `notifications-v4.js`**

Implementar um módulo isolado que:
- aguarda `atlasAuth.getProfile()` existir;
- somente ativa painel/contagem para perfil autenticado; para outros perfis o sino pode permanecer vazio, mas sem erro;
- busca as 50 notificações mais recentes do destinatário atual;
- usa Map/Set por `id` para deduplicar carga inicial + Realtime;
- renderiza título, corpo, data/hora e ação `Abrir processo` quando houver `process_id`;
- atualiza `read_at` da própria notificação;
- `markAllRead()` atualiza apenas registros do destinatário atual com `read_at is null`;
- assina `postgres_changes` INSERT em `public.atlas_notifications` com filtro por `recipient_profile_id`;
- encerra/substitui subscription quando o perfil muda ou sai da sessão;
- ao abrir processo, fecha o painel e chama `openAtlasV4Process(process_id)`.

- [ ] **Step 5: Implement `notifications-v4.css`**

Criar estilos para:
- badge numérico no sino, oculto quando zero;
- dropdown/painel ancorado no topbar;
- item não lido destacado;
- ações compactas e acessíveis;
- mobile `max-width: 760px` usando largura disponível (`calc(100vw - 24px)`) sem overflow horizontal.

- [ ] **Step 6: Run the UI contract test**

Run: `node --test tests/v4-finance-notifications-ui.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html notifications-v4.js notifications-v4.css tests/v4-finance-notifications-ui.test.mjs
git commit -m "feat: adicionar central de notificacoes financeiras"
```

### Task 3: Integração com autenticação, Realtime e processo

**Files:**
- Modify: `notifications-v4.js`
- Test: `tests/v4-finance-notifications-behavior.test.mjs`

**Interfaces:**
- Consumes: APIs expostas na Task 2 e eventos de sessão do `atlas-auth.js`.
- Produces: comportamento estável ao entrar/sair, receber Realtime e abrir processo.

- [ ] **Step 1: Write behavioral tests with DOM/Supabase stubs**

Criar `tests/v4-finance-notifications-behavior.test.mjs` cobrindo:
- contador 0 fica oculto; contador 3 mostra `3`; acima de 99 mostra `99+`;
- evento Realtime repetido com o mesmo `id` não duplica item nem contador;
- `markRead(id)` reduz contador uma vez;
- `markAllRead()` zera contador local após sucesso;
- `openProcess` não quebra se `openAtlasV4Process` não existir e chama a função quando existir;
- perfil diferente substitui a subscription anterior.

- [ ] **Step 2: Run the behavioral test and verify any failures**

Run: `node --test tests/v4-finance-notifications-behavior.test.mjs`
Expected: FAIL nos comportamentos ainda não implementados/extraídos para teste.

- [ ] **Step 3: Make `notifications-v4.js` testable without changing public behavior**

Expor helpers puros sob `window.AtlasNotificationsV4.__test` apenas para testes: `formatCount(n)`, `mergeById(current,incoming)`, `countUnread(items)`; manter o runtime principal encapsulado.

- [ ] **Step 4: Run behavioral tests**

Run: `node --test tests/v4-finance-notifications-behavior.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run relevant regression suite**

Run:
```bash
node --test \
  tests/v4-finance-notifications-db-contract.test.mjs \
  tests/v4-finance-notifications-ui.test.mjs \
  tests/v4-finance-notifications-behavior.test.mjs \
  tests/v4-regression-contract.test.mjs \
  tests/operations-v4-contract.test.mjs \
  tests/role-dashboard-v4.test.mjs
```
Expected: todos os testes relacionados PASS; qualquer falha antiga da suíte completa deve ser reportada separadamente, sem ser atribuída a esta feature.

- [ ] **Step 6: Commit**

```bash
git add notifications-v4.js tests/v4-finance-notifications-behavior.test.mjs
git commit -m "test: validar notificacoes financeiras em tempo real"
```

### Task 4: Verificação ponta a ponta e preview

**Files:**
- No new source files expected.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: preview Vercel validado e evidência funcional da feature.

- [ ] **Step 1: Create a controlled end-to-end scenario**

Usar uma empresa/processo de teste ou registro controlado e dois perfis: um `financeiro` da organização correta e, se disponível, um perfil de outra organização. Criar uma nova taxa via fluxo normal do processo para validar que o trigger, não o front-end, gera a notificação.

- [ ] **Step 2: Verify persisted notification**

Confirmar no Supabase que a linha possui `event_type='fee_created'`, `cost_id`, `process_id`, `client_id`, valor/vencimento no metadata/body e destinatário financeiro correto.

- [ ] **Step 3: Verify UI and Realtime**

Com sessão financeira aberta:
- contador incrementa sem reload;
- painel mostra a empresa/processo/valor/vencimento;
- `Marcar como lida` reduz o contador;
- `Marcar todas como lidas` zera;
- `Abrir processo` abre o processo correto.

- [ ] **Step 4: Verify duplicate and authorization protection**

Salvar novamente o processo sem criar nova taxa e confirmar que não há nova notificação. Validar por consulta com contexto autenticado que outro usuário/organização não consegue ler nem atualizar a notificação.

- [ ] **Step 5: Deploy preview from `atlas-legalizacao-v4-ux` and inspect served assets**

Criar deployment Vercel de preview, aguardar `READY` e buscar `/notifications-v4.js` e `/notifications-v4.css` para confirmar que o commit correto está servido.

- [ ] **Step 6: Final verification before completion**

Rodar novamente os testes relacionados e registrar URL do preview, commit(s), resultado da migration e qualquer limitação remanescente. Não promover para produção sem aprovação explícita.
