# ATLAS Legalização 7.1 — Central Operacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a Central Operacional 7.1 sobre o ATLAS Legalização existente, com múltiplas tarefas por processo, próxima ação principal, equipes, bloqueios, SLA em dias úteis, avanço controlado de etapa, auditoria e telas operacionais, sem alterar produção durante o desenvolvimento.

**Architecture:** Preservar `workflow_templates -> workflow_stages -> processes` e acrescentar uma camada operacional normalizada no Supabase. Regras críticas de integridade e transição ficam em PostgreSQL/RPCs atômicos; o front-end vanilla JS usa adaptadores pequenos (`data`, `sla`, `engine`, `ui`) e mantém os fluxos V4/V6 existentes como fallback enquanto a capacidade 7.1 não estiver ativa.

**Tech Stack:** HTML/CSS/Vanilla JavaScript, Supabase JS 2.117.2, PostgreSQL/Supabase RLS, Node.js 24 `node:test`, Vercel preview.

**Spec:** `docs/superpowers/specs/2026-10-17-atlas-legalizacao-v7-1-central-operacional-design.md`

## Global Constraints

- Trabalhar exclusivamente na branch `atlas-legalizacao-v7-1-central-operacional-20261017` até nova aprovação.
- Não publicar em produção e não aplicar migration no banco de produção sem aprovação expressa posterior ao preview.
- Preservar autenticação, rotas, dados, permissões, Dashboard, Empresas, Financeiro, Licenças, Documentos, Relatórios e demais módulos existentes.
- Não alterar Atlas Hub nem Atlas Contencioso.
- Node.js continua em `24.x`; não adicionar dependências npm para esta fase.
- Todo acesso novo ao Supabase deve aguardar sessão autenticada e respeitar `organization_id`/RLS.
- Processos legados não recebem tarefas retroativas automaticamente.
- O SLA operacional usa dias úteis; o tempo total usa dias corridos; bloqueios externos podem pausar apenas o SLA interno.
- Um processo pode ter várias tarefas ativas, mas no máximo uma Próxima Ação Principal.
- Tarefas obrigatórias bloqueiam avanço; avanço forçado exige perfil autorizado e justificativa auditável.
- A interface 7.1 deve manter a identidade visual atual e ser funcional em desktop e mobile.

## Review Focus

1. **Sessão ainda não restaurada em Safari/iPhone:** nenhuma query 7.1 deve disparar antes de `atlasAuth` estar pronta; o fallback não pode gerar 401 em loop.
2. **Duas tentativas concorrentes de tornar tarefas principais:** banco deve garantir unicidade por processo e o front deve refletir a vencedora sem duplicidade.
3. **Etapa com tarefa obrigatória pendente ou dependência não satisfeita:** avanço normal deve falhar de forma legível; avanço forçado só com permissão e justificativa.
4. **Bloqueio aberto/fechado duas vezes ou sobreposição de pausas:** fechamento deve ser idempotente e o cálculo de SLA não pode descontar o mesmo intervalo duas vezes.
5. **Banco ainda sem schema 7.1 no preview:** o sistema atual deve continuar utilizável e exibir estado de recurso indisponível, nunca quebrar Processos/Dashboard.

---

## File Map

**Criar**
- `supabase/migrations/20261017_atlas_v7_1_operational_engine.sql` — schema, constraints, RLS, índices e RPCs atômicos 7.1.
- `atlas-ops-v7-sla.js` — cálculo puro de dias úteis/SLA.
- `atlas-ops-v7-data.js` — sessão, capability detection e leitura/gravação Supabase.
- `atlas-ops-v7-engine.js` — comandos de tarefa, bloqueio, ativação e transição de etapa.
- `atlas-ops-v7-ui.js` — Central Operacional, detalhe do processo, tarefas e eventos.
- `atlas-ops-v7.css` — layout desktop/mobile da 7.1 sem sobrescrever o Dashboard aprovado.
- `tests/v7-1-operational-schema.test.mjs`
- `tests/v7-1-sla.test.mjs`
- `tests/v7-1-data-auth.test.mjs`
- `tests/v7-1-engine.test.mjs`
- `tests/v7-1-ui-contract.test.mjs`
- `tests/v7-1-mobile-permissions.test.mjs`

**Modificar**
- `index.html` — carregar CSS/JS 7.1 na ordem correta e adicionar navegação mínima.
- `operations-v4.js` — enriquecer Lista/Pipeline com Próxima Ação/SLA 7.1 sem remover modos existentes.
- `role-permissions.js` — chaves de permissões 7.1 e aplicação no menu/ações.
- `completion-date-v4.js` — remover query eager antes da sessão, pois é risco conhecido para o mesmo fluxo de Processos.

---

### Task 1: Blindar readiness de sessão e carregar a 7.1 sem regressão

**Files:**
- Modify: `completion-date-v4.js`
- Modify: `index.html`
- Create: `tests/v7-1-data-auth.test.mjs`

**Interfaces:**
- Consumes: `window.atlasAuth`, `window.atlasAuth.getProfile()`, `window.atlasAuth.client`.
- Produces: regra comum de que módulos 7.1 só inicializam após perfil/sessão válidos; scripts 7.1 carregados após autenticação/base existente.

- [ ] **Step 1: Write the failing test**

Criar testes que afirmem que `completion-date-v4.js` não chama refresh/query diretamente em `DOMContentLoaded` sem checar sessão, e que `index.html` contém os loaders 7.1 após `role-permissions.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/v7-1-data-auth.test.mjs`
Expected: FAIL porque o guard e os scripts 7.1 ainda não existem.

- [ ] **Step 3: Implement the minimal readiness guard**

Em `completion-date-v4.js`, substituir o refresh eager por função `refreshWhenAuthenticated()` que aguarda `window.atlasAuth.getProfile()` e cliente válidos antes de consultar `processes`. Em `index.html`, reservar ordem de carga: `atlas-ops-v7-sla.js` -> `atlas-ops-v7-data.js` -> `atlas-ops-v7-engine.js` -> `atlas-ops-v7-ui.js`, todos depois das dependências de auth/permissão.

- [ ] **Step 4: Run focused and regression tests**

Run: `node --test tests/v7-1-data-auth.test.mjs tests/v6-audit-remediation.test.mjs tests/v4-completion-date-sidebar-accordion.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "fix: gate process queries behind authenticated session"`

---

### Task 2: Criar schema operacional 7.1, RLS e invariantes

**Files:**
- Create: `supabase/migrations/20261017_atlas_v7_1_operational_engine.sql`
- Create: `tests/v7-1-operational-schema.test.mjs`

**Interfaces:**
- Consumes: `processes`, `workflow_stages`, `workflow_templates`, `profiles`, `role_permissions`.
- Produces: `process_operations`, `teams`, `team_members`, `task_templates`, `tasks`, `task_dependencies`, `task_events`, `process_blockers`, `sla_pauses`, `stage_transitions`, `business_holidays`.

- [ ] **Step 1: Write the failing schema contract test**

O teste deve exigir todas as tabelas acima, FKs para processo/etapa/perfil, checks de `tasks.status`, `tasks.origin`, `priority`, `blocker_type`, `transition_type`, índices por `organization_id/process_id/status/due_at` e RLS habilitado.

- [ ] **Step 2: Add invariants to the failing test**

Exigir índice parcial único equivalente a `UNIQUE process_id WHERE is_primary_action = true AND status NOT IN ('completed','cancelled')`; impedir dependência de uma tarefa com ela mesma; impedir `ended_at < started_at`.

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/v7-1-operational-schema.test.mjs`
Expected: FAIL por migration inexistente.

- [ ] **Step 4: Implement migration only in source control**

Criar schema com `gen_random_uuid()`, timestamps com timezone, políticas RLS por `organization_id`, e grants apenas para `authenticated`. Não aplicar no banco de produção nesta tarefa.

- [ ] **Step 5: Add permission keys in migration seed/upsert**

Chaves: `operations.view`, `tasks.view`, `tasks.create`, `tasks.edit`, `tasks.assign`, `tasks.complete`, `blockers.manage`, `workflow.advance`, `workflow.override`, `teams.manage`. Administrador permanece acesso total.

- [ ] **Step 6: Run tests and commit**

Run: `node --test tests/v7-1-operational-schema.test.mjs`
Expected: PASS.

Commit: `git add supabase/migrations/20261017_atlas_v7_1_operational_engine.sql tests/v7-1-operational-schema.test.mjs && git commit -m "feat: define ATLAS 7.1 operational schema"`

---

### Task 3: Implementar cálculo determinístico de SLA em dias úteis

**Files:**
- Create: `atlas-ops-v7-sla.js`
- Create: `tests/v7-1-sla.test.mjs`

**Interfaces:**
- Produces `window.AtlasOpsV71Sla` com:
  - `businessDaysBetween(startISO, endISO, holidays=[]) -> number`
  - `addBusinessDays(startISO, days, holidays=[]) -> string`
  - `mergePauseIntervals(pauses=[]) -> Array<{start:string,end:string}>`
  - `slaSnapshot({stageStartedAt, now, slaDays, pauses, holidays}) -> {elapsedBusinessDays, remainingBusinessDays, state}`

- [ ] **Step 1: Write failing unit tests**

Cobrir segunda-sexta, fim de semana, feriado explícito, intervalo com horário, pausa cruzando fim de semana e duas pausas sobrepostas.

- [ ] **Step 2: Add Review Focus tests**

Afirmar que `mergePauseIntervals()` une sobreposições e que SLA nunca desconta duas vezes o mesmo período.

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/v7-1-sla.test.mjs`
Expected: FAIL porque `AtlasOpsV71Sla` não existe.

- [ ] **Step 4: Implement pure functions**

Sem rede e sem dependências; normalizar datas em calendário local controlado e retornar `state` em `within_sla | due_today | overdue`.

- [ ] **Step 5: Run and commit**

Run: `node --test tests/v7-1-sla.test.mjs`
Expected: PASS.

Commit: `git add atlas-ops-v7-sla.js tests/v7-1-sla.test.mjs && git commit -m "feat: add business-day SLA engine"`

---

### Task 4: Criar RPCs atômicos do motor operacional

**Files:**
- Modify: `supabase/migrations/20261017_atlas_v7_1_operational_engine.sql`
- Modify: `tests/v7-1-operational-schema.test.mjs`

**Interfaces:**
- Produces RPCs SECURITY INVOKER:
  - `atlas_v71_activate_process(p_process_id uuid, p_template_ids uuid[] default null)`
  - `atlas_v71_create_task(p_process_id uuid, p_stage_id uuid, p_title text, p_description text, p_required boolean, p_priority text, p_assignee_id uuid, p_team_id uuid, p_due_at timestamptz)`
  - `atlas_v71_set_primary_task(p_process_id uuid, p_task_id uuid)`
  - `atlas_v71_start_task(p_task_id uuid)`
  - `atlas_v71_complete_task(p_task_id uuid)`
  - `atlas_v71_open_blocker(p_process_id uuid, p_task_id uuid, p_type text, p_reason text, p_pauses_sla boolean)`
  - `atlas_v71_close_blocker(p_blocker_id uuid)`
  - `atlas_v71_advance_stage(p_process_id uuid, p_force boolean default false, p_justification text default null)`

- [ ] **Step 1: Extend failing schema tests for RPC names and SECURITY INVOKER**

Também exigir `task_events`/`stage_transitions` insertados dentro dos RPCs críticos.

- [ ] **Step 2: Add transition failure tests as SQL contract assertions**

Exigir que `atlas_v71_advance_stage` verifique tarefas obrigatórias ativas, rejeite `p_force=true` sem justificativa e gere tarefas automáticas da próxima etapa.

- [ ] **Step 3: Run to verify failure**

Run: `node --test tests/v7-1-operational-schema.test.mjs`
Expected: FAIL nas RPCs.

- [ ] **Step 4: Implement RPCs in the migration**

Cada comando deve obter organização pelo processo/perfil autenticado, operar em uma única transação implícita PostgreSQL e registrar evento auditável. `close_blocker` deve ser idempotente quando já encerrado.

- [ ] **Step 5: Run and commit**

Run: `node --test tests/v7-1-operational-schema.test.mjs`
Expected: PASS.

Commit: `git add supabase/migrations/20261017_atlas_v7_1_operational_engine.sql tests/v7-1-operational-schema.test.mjs && git commit -m "feat: add atomic operational workflow RPCs"`

---

### Task 5: Implementar adaptador de dados com capability fallback

**Files:**
- Create: `atlas-ops-v7-data.js`
- Modify: `tests/v7-1-data-auth.test.mjs`

**Interfaces:**
- Produces `window.AtlasOpsV71Data`:
  - `ready() -> Promise<boolean>`
  - `capabilities() -> Promise<{available:boolean,reason:string|null}>`
  - `loadCentral(filters={}) -> Promise<CentralModel>`
  - `loadProcess(processId) -> Promise<ProcessOperationalModel>`
  - `loadTeams() -> Promise<Array>`
  - `loadHolidays() -> Promise<Array<string>>`
  - `rpc(name,args) -> Promise<any>`

- [ ] **Step 1: Write failing tests for auth gating and capability detection**

Afirmar ausência de query enquanto perfil é nulo e tratamento de erro `42P01/PGRST205` como `{available:false}` sem throw para a UI.

- [ ] **Step 2: Add organization scope tests**

As queries diretas devem usar `organization_id` do perfil quando a tabela o possuir; nenhuma função aceita `organization_id` arbitrário vindo da UI.

- [ ] **Step 3: Run to verify failure**

Run: `node --test tests/v7-1-data-auth.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Implement adapter**

Reutilizar `window.atlasAuth.client`, não criar segundo cliente Supabase. `loadCentral()` deve buscar tasks, blockers, processes, profiles/teams necessários e devolver dados crus normalizados; agregação visual fica na UI.

- [ ] **Step 5: Run and commit**

Run: `node --test tests/v7-1-data-auth.test.mjs tests/v6-audit-remediation.test.mjs`
Expected: PASS.

Commit: `git add atlas-ops-v7-data.js tests/v7-1-data-auth.test.mjs && git commit -m "feat: add authenticated operational data adapter"`

---

### Task 6: Implementar API de comandos do front-end

**Files:**
- Create: `atlas-ops-v7-engine.js`
- Create: `tests/v7-1-engine.test.mjs`

**Interfaces:**
- Consumes: `AtlasOpsV71Data.rpc`, `AtlasOpsV71Sla`.
- Produces `window.AtlasOpsV71Engine`:
  - `activateProcess(processId, templateIds=[])`
  - `createManualTask(input)`
  - `setPrimaryTask(processId, taskId)`
  - `startTask(taskId)`
  - `completeTask(taskId)`
  - `openBlocker(input)`
  - `closeBlocker(blockerId)`
  - `advanceStage(processId,{force=false,justification=''})`

- [ ] **Step 1: Write failing contract/behavior tests**

Validar nomes de RPC, normalização de inputs, exigência de `processId/title` para tarefa manual e `type/reason` para bloqueio.

- [ ] **Step 2: Add Review Focus tests**

`advanceStage(...,{force:true,justification:''})` deve rejeitar no cliente antes da RPC; duas chamadas de `setPrimaryTask` não devem produzir estado local com duas principais.

- [ ] **Step 3: Run to verify failure**

Run: `node --test tests/v7-1-engine.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Implement thin command facade**

Sem duplicar regras do banco: validar formato/permissão visível, chamar RPC e disparar `document.dispatchEvent(new CustomEvent('atlas:v71:changed', {detail:{processId}}))` após sucesso.

- [ ] **Step 5: Run and commit**

Run: `node --test tests/v7-1-engine.test.mjs`
Expected: PASS.

Commit: `git add atlas-ops-v7-engine.js tests/v7-1-engine.test.mjs && git commit -m "feat: add ATLAS 7.1 operational command engine"`

---

### Task 7: Integrar permissões, equipes e ativação controlada de processos legados

**Files:**
- Modify: `role-permissions.js`
- Create/Modify: `tests/v7-1-mobile-permissions.test.mjs`
- Modify: `atlas-ops-v7-ui.js` (criar skeleton se ainda inexistente)

**Interfaces:**
- Consumes: `window.atlasHasPermission(key)`, `AtlasOpsV71Engine.activateProcess`.
- Produces: menu/ações 7.1 visíveis apenas conforme permissão; fluxo `Ativar Central Operacional neste processo` com preview de templates antes da confirmação.

- [ ] **Step 1: Write failing permissions tests**

Exigir as novas chaves no módulo de permissões e mapear `central-operacional` para `operations.view`.

- [ ] **Step 2: Write failing legacy activation UI contract**

Exigir copy `Ativar Central Operacional neste processo`, revisão das tarefas propostas e ausência de ativação automática em `DOMContentLoaded`/load do processo.

- [ ] **Step 3: Run to verify failure**

Run: `node --test tests/v7-1-mobile-permissions.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Implement permission matrix + activation wizard**

Administrador pode gerenciar equipes; Operação recebe permissões de execução conforme matriz. Cliente/auditoria não ganham ações de mutação por default.

- [ ] **Step 5: Run and commit**

Run: `node --test tests/v7-1-mobile-permissions.test.mjs tests/v6-role-navigation.test.mjs`
Expected: PASS.

Commit: `git add role-permissions.js atlas-ops-v7-ui.js tests/v7-1-mobile-permissions.test.mjs && git commit -m "feat: add operational permissions and legacy activation"`

---

### Task 8: Construir Central Operacional e enriquecer Lista/Pipeline de Processos

**Files:**
- Create/Modify: `atlas-ops-v7-ui.js`
- Create: `atlas-ops-v7.css`
- Modify: `operations-v4.js`
- Create: `tests/v7-1-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `AtlasOpsV71Data.loadCentral`, `AtlasOpsV71Sla.slaSnapshot`, `openAtlasV4Process`.
- Produces:
  - `window.atlasV71CentralPage()`
  - `window.AtlasOpsV71UI.decorateProcess(process, operational)`
  - filtros por responsável/equipe/cliente/serviço/etapa/status/prioridade/bloqueio/SLA.

- [ ] **Step 1: Write failing UI contract tests**

Exigir cards: `Minhas tarefas hoje`, `Tarefas atrasadas`, `Fora do SLA`, `Bloqueados`, `Aguardando cliente`, `Aguardando órgão`, `Financeiro pendente`, `Sem movimentação`.

- [ ] **Step 2: Test that cards are actionable**

Cada KPI deve gerar filtro e abrir lista correspondente; nenhum valor fixo ilustrativo pode existir no JS.

- [ ] **Step 3: Test Processos compatibility**

`operations-v4.js` deve preservar `mode='pipeline'`, botões Lista/Pipeline e enriquecer coluna/controle de próxima ação quando 7.1 estiver disponível; fallback continua `Definir próxima ação`.

- [ ] **Step 4: Run to verify failure**

Run: `node --test tests/v7-1-ui-contract.test.mjs tests/operations-v4-contract.test.mjs tests/operations-v5-contract.test.mjs`
Expected: FAIL apenas nos novos contratos.

- [ ] **Step 5: Implement Central + integration**

Adicionar item de navegação `Central Operacional` sem remover menus atuais. Se `capabilities().available === false`, renderizar estado informativo e manter Processos legacy funcional.

- [ ] **Step 6: Run and commit**

Run: `node --test tests/v7-1-ui-contract.test.mjs tests/operations-v4-contract.test.mjs tests/operations-v5-contract.test.mjs`
Expected: PASS.

Commit: `git add atlas-ops-v7-ui.js atlas-ops-v7.css operations-v4.js tests/v7-1-ui-contract.test.mjs && git commit -m "feat: add ATLAS 7.1 operational command center"`

---

### Task 9: Construir tela interna do processo, tarefas, bloqueios e avanço

**Files:**
- Modify: `atlas-ops-v7-ui.js`
- Modify: `atlas-ops-v7.css`
- Modify: `tests/v7-1-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `AtlasOpsV71Data.loadProcess`, todos os comandos de `AtlasOpsV71Engine`.
- Produces: `window.openAtlasV71Process(processId)` e `window.openAtlasV71Task(taskId)`.

- [ ] **Step 1: Add failing process-detail tests**

Exigir timeline de etapas, Próxima Ação, tarefas, bloqueio atual, quatro indicadores de tempo/SLA e abas `Visão Geral`, `Tarefas`, `Bloqueios`, `SLA e Prazos`, `Documentos`, `Histórico`.

- [ ] **Step 2: Add failing transition tests**

Enquanto houver obrigatória ativa, botão normal de avanço deve estar desabilitado e indicar quantidade pendente. Quando elegível, copy deve ser `Concluir etapa e avançar para ...`. Ação de override só aparece com `workflow.override` e exige justificativa.

- [ ] **Step 3: Add task-detail contract**

Detalhe deve mostrar status, responsável, equipe, prazo, prioridade, dependências, checklist textual/descrição, anexos relacionados disponíveis, comentários/eventos e ações iniciar/concluir/bloquear conforme permissão.

- [ ] **Step 4: Run to verify failure**

Run: `node --test tests/v7-1-ui-contract.test.mjs`
Expected: FAIL.

- [ ] **Step 5: Implement process/task views and event refresh**

Escutar `atlas:v71:changed` e recarregar apenas o modelo operacional afetado, sem full-page reload.

- [ ] **Step 6: Run and commit**

Run: `node --test tests/v7-1-ui-contract.test.mjs tests/v4-process-object-shape.test.mjs tests/process-security-actions.test.mjs`
Expected: PASS.

Commit: `git add atlas-ops-v7-ui.js atlas-ops-v7.css tests/v7-1-ui-contract.test.mjs && git commit -m "feat: add operational process and task workspace"`

---

### Task 10: Finalizar mobile, acessibilidade e comportamento de erro

**Files:**
- Modify: `atlas-ops-v7.css`
- Modify: `atlas-ops-v7-ui.js`
- Modify: `tests/v7-1-mobile-permissions.test.mjs`

**Interfaces:**
- Produces: mobile “Meu dia” dentro da Central; ações rápidas; tabelas transformadas em cards/scroll controlado abaixo de 760px.

- [ ] **Step 1: Write failing mobile tests**

Exigir breakpoint `max-width:760px`, touch targets `min-height:44px`, ausência de largura fixa que cause overflow e prioridade para `Meu dia`, atrasadas, bloqueadas e próximas ações.

- [ ] **Step 2: Add accessibility/error-state tests**

Botões icon-only precisam `aria-label`; loading/empty/error states devem existir; capability ausente não pode esconder os módulos legados.

- [ ] **Step 3: Run to verify failure**

Run: `node --test tests/v7-1-mobile-permissions.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Implement responsive/error states**

Preservar topbar/sidebar mobile existentes; não reintroduzir bottom nav onde o Dashboard final já a suprimiu.

- [ ] **Step 5: Run and commit**

Run: `node --test tests/v7-1-mobile-permissions.test.mjs tests/v6-final-mobile-dashboard.test.mjs tests/v5-1-mobile-shell-polish.test.mjs`
Expected: PASS.

Commit: `git add atlas-ops-v7.css atlas-ops-v7-ui.js tests/v7-1-mobile-permissions.test.mjs && git commit -m "fix: complete ATLAS 7.1 mobile operational UX"`

---

### Task 11: Homologação de branch, schema em ambiente isolado e preview

**Files:**
- Modify if needed: `.github/workflows/atlas-legalizacao-v5-checks.yml`
- Modify if needed: `sw-v5-1.js` only for cache busting of new assets
- No production files outside the approved branch.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: branch green, isolated DB migration result when an isolated Supabase environment is authorized, and Vercel preview URL for user approval.

- [ ] **Step 1: Run complete repository test suite**

Run: `npm test`
Expected: all tests PASS, including existing V4/V5/V6 suites.

- [ ] **Step 2: Verify source diff does not modify Hub/Contencioso or production config unexpectedly**

Run: `git diff main...HEAD --name-only`
Expected: only Atlas Legalização files listed; no unrelated project files.

- [ ] **Step 3: Prepare isolated database validation**

Use a Supabase development branch or other explicitly isolated environment. If branch creation incurs cost, stop and obtain user cost approval before creating it. Apply `20261017_atlas_v7_1_operational_engine.sql` only there, never on production.

- [ ] **Step 4: Validate real RPC flows in the isolated DB**

Test one disposable process path: activate -> generate templates -> set primary -> complete task -> open/close blocker -> reject premature advance -> valid advance -> audit records. Verify RLS with at least admin, operação and consulta-only role.

- [ ] **Step 5: Deploy Vercel preview from the branch**

Confirm HTTP 200, authenticated login, Central Operacional, Processos fallback, process detail, desktop and mobile. Do not promote.

- [ ] **Step 6: Final regression and evidence**

Run: `npm test`
Expected: PASS. Record commit SHA, preview URL, DB branch/project reference used for homologation, and any known limitations.

- [ ] **Step 7: Stop before production**

Present preview and evidence to the user. Production merge, production DB migration and Vercel promotion require a new explicit approval.

---

## Self-Review Result

- **Spec coverage:** tarefas múltiplas, templates automáticos, tarefas manuais, dependências, equipes, próxima ação, bloqueios, SLA, avanço controlado, override, legado, Central, tela de processo, mobile, permissões e auditoria estão mapeados para Tasks 2–10.
- **Type/interface consistency:** comandos de UI dependem apenas de `AtlasOpsV71Engine`; Engine depende de `AtlasOpsV71Data`; SLA permanece puro e independente.
- **Production safety:** migration é criada em source control, mas aplicação real só ocorre em ambiente isolado até aprovação posterior.
- **Known risk addressed:** `completion-date-v4.js` recebe guard de sessão antes de introduzir novas queries do motor operacional.
- **YAGNI:** Portal do Cliente 2.0, IA, rentabilidade avançada, Regulatory Matrix e automação preditiva ficam fora da 7.1 e permanecem para versões posteriores.
