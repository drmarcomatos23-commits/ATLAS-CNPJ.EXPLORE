# ATLAS Legalização — Mockup Exato V6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduzir fielmente o mockup final aprovado do ATLAS Legalização e Gerenciamento, preservando todas as funcionalidades, regras de negócio, dados reais, autenticação e produção atual até aprovação expressa do preview.

**Architecture:** A V6 será uma camada visual isolada carregada por último, com shell, Dashboard e módulos internos próprios, mantendo os contratos de DOM e JavaScript já usados pela V5.1. O Dashboard ganhará um adaptador/renderer específico apenas onde a composição aprovada exigir novo markup, consumindo as mesmas fontes de dados atuais. Nenhuma migração de banco, alteração de autenticação ou promoção de produção faz parte deste plano.

**Tech Stack:** HTML5, CSS3, JavaScript vanilla, Supabase existente, Node.js `node:test`, GitHub, Vercel Preview.

**Spec:** `docs/superpowers/specs/2026-10-15-atlas-legalizacao-mockup-exato-design.md`

## Global Constraints

- Trabalhar exclusivamente no Atlas Legalização e Gerenciamento.
- Branch obrigatória: `atlas-legalizacao-v6-mockup-exato`.
- Não alterar Atlas Hub nem Atlas Contencioso.
- Não promover, atribuir alias de produção ou publicar em produção antes de aprovação expressa de Marco Matos.
- Preservar Supabase, autenticação, perfis, permissões, contratos de dados e regras de negócio existentes.
- Não usar números fictícios na homologação funcional.
- Não redesenhar ou substituir o logo oficial.
- Não criar dependências pagas ou custos adicionais.
- Preservar rollback simples para `atlas-legalizacao-v5.1`.
- Manter IDs/classes funcionais existentes quando forem consumidos por scripts; qualquer adaptação deve ser explícita e testada.

## Review Focus

- **CSS legado concorrente:** a V6 deve vencer a apresentação sem quebrar componentes V4/V5 que continuam funcionais; teste de ordem de carregamento e ausência de `display:none` indevido no shell.
- **Permissões por perfil:** menus visuais reorganizados não podem tornar funções ocultas visíveis nem funções permitidas inacessíveis; teste com `data-roles` e regras atuais.
- **Dados incompletos/reais:** Dashboard deve renderizar `0`, vazio ou estado sem dados sem inventar valores nem quebrar layout; teste de normalização do adaptador.
- **Mobile 390–430 px:** nenhum formulário, modal, barra de ação, busca ou pipeline pode sobrepor conteúdo; testes contratuais de overflow e breakpoints.
- **Produção protegida:** deployment final do plano deve ter `target=preview`/sem target de produção, sem promote e sem alias; verificação explícita no Vercel antes da entrega.

---

### Task 1: Congelar contratos atuais e criar guardrails V6

**Files:**
- Create: `tests/v6-production-guard.test.mjs`
- Create: `tests/v6-shell-contract.test.mjs`
- Modify: `package.json` only if the existing test glob does not already include the new files.

**Interfaces:**
- Consumes: `index.html`, `atlas-auth.js`, `role-permissions.js`, `vercel.json`, existing V5/V5.1 styles.
- Produces: regression contract proving the V6 can be added without changing authentication, role hooks, production URLs or database configuration.

- [ ] **Step 1: Write the failing shell/guard tests**

Create assertions that require:
- `index.html` to keep `#login-screen`, `#app-shell`, `#nav`, `#global-search`, `#logout-btn`, `#page-content`, `#atlas-modal-root`;
- existing `data-page` values for `dashboard`, `clientes`, `processos`, `licencas`, `documentos`, `custos`, `relatorios`, `config` to remain available;
- a future `/atlas-v6.css?v=6.0` link to be loaded after all V5/V5.1 CSS;
- no V6 migration under `supabase/migrations/`;
- no production alias/promotion instructions added to `vercel.json`.

- [ ] **Step 2: Run the targeted tests and verify failure**

Run: `node --test tests/v6-production-guard.test.mjs tests/v6-shell-contract.test.mjs`

Expected: FAIL only because V6 assets are not yet wired.

- [ ] **Step 3: Do not change application code in this task**

This task locks baseline behavior only.

- [ ] **Step 4: Commit**

```bash
git add tests/v6-production-guard.test.mjs tests/v6-shell-contract.test.mjs package.json
git commit -m "test: lock Atlas Legalizacao V6 guardrails"
```

---

### Task 2: Implementar shell V6 fiel ao mockup

**Files:**
- Create: `atlas-v6.css`
- Create: `atlas-v6-shell.js`
- Modify: `index.html`
- Test: `tests/v6-shell-contract.test.mjs`
- Test: `tests/v6-role-navigation.test.mjs`

**Interfaces:**
- Consumes: existing `.app-shell`, `.sidebar`, `.workspace`, `.topbar`, `#nav`, existing `data-page` and `data-roles` attributes.
- Produces: CSS tokens `--v6-sidebar-width`, `--v6-topbar-height`, `--v6-navy`, `--v6-blue`, `--v6-cyan`, `--v6-orange`, `--v6-surface`, `--v6-border`; function `window.AtlasV6Shell.syncUserChrome(sessionUser)` for visual user metadata only.

- [ ] **Step 1: Extend the failing tests for exact shell requirements**

Assert:
- desktop sidebar width token is `300px` at the 1672px reference scale, with responsive clamp allowed below 1440px;
- topbar target height is `74px`;
- sidebar uses `100dvh` and remains fixed on desktop;
- active nav has orange left indicator and blue surface;
- search placeholder is exactly `Buscar empresas, processos, documentos...`;
- main menu visual order is Dashboard, Empresas, Processos, Licenças, Documentos, Financeiro, Relatórios, Configurações;
- secondary items remain in the DOM and keep original `data-roles` permissions.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/v6-shell-contract.test.mjs tests/v6-role-navigation.test.mjs`

Expected: FAIL because V6 shell is not implemented.

- [ ] **Step 3: Implement `atlas-v6.css`**

Implement only shell responsibilities: tokens, sidebar, logo block, primary/secondary navigation, user/account block, topbar, search, notification/avatar alignment, workspace offsets and shared surface defaults. Preserve existing functional selectors.

- [ ] **Step 4: Implement `atlas-v6-shell.js`**

Expose `window.AtlasV6Shell.syncUserChrome(sessionUser)` and visually reorganize existing nav nodes without changing their `data-page`/`data-roles`. Secondary features (`exigencias`, `integracoes`, `conhecimento`, `treinamento`, `usuarios`) must remain reachable through a compact secondary section.

- [ ] **Step 5: Wire V6 assets in `index.html`**

Load `/atlas-v6.css?v=6.0` after all legacy/V5 CSS and `/atlas-v6-shell.js?v=6.0` after existing core scripts, without removing existing scripts.

- [ ] **Step 6: Run tests**

Run: `node --test tests/v6-shell-contract.test.mjs tests/v6-role-navigation.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add atlas-v6.css atlas-v6-shell.js index.html tests/v6-shell-contract.test.mjs tests/v6-role-navigation.test.mjs
git commit -m "feat: add exact Atlas Legalizacao V6 shell"
```

---

### Task 3: Criar adaptador de dados reais do Dashboard V6

**Files:**
- Create: `dashboard-v6.js`
- Create: `tests/dashboard-v6-data.test.mjs`
- Modify only if necessary to expose already-loaded state: `dashboard-v4.js` or `legalizacao.js` with additive getters, not altered business rules.

**Interfaces:**
- Consumes: existing in-memory collections/state for companies, processes, licenses, costs/honoraria, pending/exigencias and documents; existing navigation handlers.
- Produces: `window.AtlasDashboardV6.buildModel(sourceState)` returning `{kpis, pipeline, recentProcesses, statusDistribution, companyTypes, deadlines}` with normalized real values; `window.AtlasDashboardV6.render(container, model)`.

- [ ] **Step 1: Write failing data-model tests**

Test `buildModel(sourceState)` for:
- zero/empty arrays returning numeric zero and empty lists, never mock values;
- active-process count excluding concluded/cancelled states according to current status mapping;
- license deadline ordering ascending by final date;
- monthly honoraria summing only current-month records using existing financial field semantics;
- recent processes sorted by last update descending;
- pipeline grouping into the six approved display stages while preserving existing workflow source values;
- company type grouping from real legal/nature/type fields;
- status distribution totals matching process total.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/dashboard-v6-data.test.mjs`

Expected: FAIL because `window.AtlasDashboardV6` does not exist.

- [ ] **Step 3: Implement `buildModel(sourceState)` in `dashboard-v6.js`**

Use pure normalization/mapping helpers. Do not query Supabase again if the current dashboard already has the data loaded; consume existing state first.

- [ ] **Step 4: Implement click routing adapters**

Map KPI/pipeline/recent/deadline interactions to the existing `data-page` navigation and filters rather than introducing new URLs.

- [ ] **Step 5: Run tests**

Run: `node --test tests/dashboard-v6-data.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard-v6.js tests/dashboard-v6-data.test.mjs dashboard-v4.js legalizacao.js
git commit -m "feat: add real-data dashboard V6 adapter"
```

---

### Task 4: Reproduzir visualmente o Dashboard aprovado

**Files:**
- Create: `dashboard-v6.css`
- Create: `assets/atlas-legalizacao-hero-v6.webp`
- Modify: `index.html`
- Modify: `dashboard-v6.js`
- Test: `tests/dashboard-v6-layout.test.mjs`

**Interfaces:**
- Consumes: `AtlasDashboardV6.buildModel()` and official logo asset already present in the repository.
- Produces: exact V6 Dashboard markup classes prefixed `.v6-dashboard-*`; no new data contract.

- [ ] **Step 1: Write failing layout contract tests**

Assert renderer markup contains:
- hero with `BEM-VINDO AO`, `ATLAS`, `LEGALIZAÇÃO E GERENCIAMENTO`, approved descriptive sentence and five right-side service labels;
- six KPI cards in approved order;
- `PIPELINE DE PROCESSOS` with six approved stages;
- `PROCESSOS RECENTES`;
- `PROCESSOS POR SITUAÇÃO`;
- `EMPRESAS POR TIPO`;
- `PRÓXIMOS PRAZOS`;
- no hard-coded example company names or numeric KPI values.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/dashboard-v6-layout.test.mjs`

Expected: FAIL because the visual renderer/styles are incomplete.

- [ ] **Step 3: Create the hero background asset**

Create `assets/atlas-legalizacao-hero-v6.webp` as a text-free corporate glass-building background matching the approved reference composition. The official ATLAS logo/text remains HTML/SVG overlay, not baked into the background.

- [ ] **Step 4: Implement `AtlasDashboardV6.render(container, model)`**

Render the approved DOM structure with real model values and existing click handlers. Keep all text specified by the mockup exact.

- [ ] **Step 5: Implement `dashboard-v6.css`**

Pin the 1672px reference geometry and responsive scaling:
- hero approximately 265–300px visual height;
- six KPI columns at wide desktop;
- main grid approximately 2/3 pipeline + 1/3 recent processes;
- three lower panels in one row at wide desktop;
- approved navy/blue/cyan/orange/white palette;
- restrained border radius, shadows and spacing consistent with reference.

- [ ] **Step 6: Wire `/dashboard-v6.css?v=6.0` and `/dashboard-v6.js?v=6.0`**

Ensure V6 dashboard layers load after V5 dashboard assets.

- [ ] **Step 7: Run tests**

Run: `node --test tests/dashboard-v6-data.test.mjs tests/dashboard-v6-layout.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add dashboard-v6.css dashboard-v6.js assets/atlas-legalizacao-hero-v6.webp index.html tests/dashboard-v6-layout.test.mjs
git commit -m "feat: reproduce approved Atlas Legalizacao dashboard"
```

---

### Task 5: Aplicar o design system V6 aos módulos internos

**Files:**
- Create: `modules-v6.css`
- Create: `tests/modules-v6-contract.test.mjs`
- Modify: `index.html`
- Modify only when a module has markup that cannot be styled safely: its current renderer file, preserving IDs/actions.

**Interfaces:**
- Consumes: existing pages `clientes`, `processos`, `licencas`, `documentos`, `custos`, `relatorios`, `config`, plus secondary modules.
- Produces: shared V6 classes/tokens for page headers, cards, filters, tables, forms, status badges, buttons, modals, loading/error/success states.

- [ ] **Step 1: Write failing module contract tests**

Assert:
- all primary pages continue to exist by `data-page`;
- no existing action IDs used by tests are removed;
- `modules-v6.css` defines shared selectors for `.table`, form controls, modal surfaces, buttons, cards and status states scoped under the V6 shell;
- focus-visible styles exist for keyboard users;
- disabled/loading states remain legible.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/modules-v6-contract.test.mjs`

Expected: FAIL because V6 module layer is absent.

- [ ] **Step 3: Implement `modules-v6.css`**

Apply the same visual language to Empresas, Processos, Licenças, Documentos, Financeiro, Relatórios, Configurações and secondary modules without changing business logic.

- [ ] **Step 4: Make only minimal markup adaptations where required**

Preserve event-bound IDs and existing action buttons including `PAGO`, process reopen actions, CNPJ/CEP/sócio controls, report actions and cartilha actions.

- [ ] **Step 5: Wire `/modules-v6.css?v=6.0` after legacy module styles**

- [ ] **Step 6: Run module and legacy regression tests**

Run: `npm test`

Expected: all existing tests plus V6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add modules-v6.css index.html tests/modules-v6-contract.test.mjs
git commit -m "feat: unify Atlas Legalizacao modules with V6 design"
```

---

### Task 6: Estabilizar mobile e tablet V6

**Files:**
- Create: `mobile-v6.css`
- Create: `tests/mobile-v6-contract.test.mjs`
- Modify: `index.html`
- Modify: `atlas-v6-shell.js` only if drawer behavior requires a visual compatibility fix.

**Interfaces:**
- Consumes: V6 shell, Dashboard V6 and current mobile drawer behavior.
- Produces: responsive rules at 1180px, 1024px, 760px, 480px and safe behavior at 390–430px.

- [ ] **Step 1: Write failing mobile tests**

Assert:
- desktop sidebar becomes overlay drawer at <=1180px;
- `.workspace`, `.main`, `.v6-dashboard` use `max-width:100%` and prevent unintended horizontal overflow;
- mobile form controls use at least `font-size:16px`;
- modal width uses viewport-safe constraints;
- sticky/fixed action bars reserve content space or are disabled when unsafe;
- hero content, KPIs and lower panels stack predictably;
- pipeline becomes horizontal scroll/stack without clipping interactions;
- safe-area inset is used for mobile fixed chrome.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/mobile-v6-contract.test.mjs`

Expected: FAIL because V6 mobile layer is absent.

- [ ] **Step 3: Implement `mobile-v6.css`**

Ensure no insertion bar, form footer, modal action or search overlay can remain floating over the center of content.

- [ ] **Step 4: Wire `/mobile-v6.css?v=6.0` last among all CSS files**

- [ ] **Step 5: Run mobile and full regression tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile-v6.css atlas-v6-shell.js index.html tests/mobile-v6-contract.test.mjs
git commit -m "feat: stabilize Atlas Legalizacao V6 mobile"
```

---

### Task 7: Homologação funcional, visual e preview isolado

**Files:**
- Create: `docs/v6-homologation-checklist.md`
- No production configuration changes.

**Interfaces:**
- Consumes: completed V6 branch.
- Produces: evidence that tests pass and one Vercel preview URL ready for Marco Matos to review.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Compare branch against the approved base**

Compare: `atlas-legalizacao-v5.1...atlas-legalizacao-v6-mockup-exato`.

Expected: no Supabase migration, auth contract, production alias or production URL change; changes limited to V6 presentation/adapters/tests/docs plus any explicitly justified additive getter.

- [ ] **Step 3: Complete `docs/v6-homologation-checklist.md`**

Record pass/fail for:
- login/logout;
- Admin, Operação, Financeiro;
- Empresas/CNPJ/CEP/sócios/grupos;
- Processos/pipeline/conclusão/reabertura;
- Licenças/vencimentos/data final;
- Documentos/anexos;
- Financeiro/PAGO/data/status;
- Relatórios;
- cartilha/data do dia;
- Base de Conhecimento/Treinamentos;
- desktop 1366/1440/1672/1920;
- tablet 1024;
- mobile 390/412/430.

- [ ] **Step 4: Create a Vercel preview only**

Deploy branch `atlas-legalizacao-v6-mockup-exato` to project `atlas-legalizacao-gerenciamento` with preview target only (`target` omitted or preview). Do not call promote, production target or alias assignment.

- [ ] **Step 5: Verify deployment state**

Expected: `READY`, HTTP-accessible preview, branch metadata equals `atlas-legalizacao-v6-mockup-exato`.

- [ ] **Step 6: Verify production remains unchanged**

List production deployments/aliases and confirm no deployment created by this plan has `target=production` and no production alias points to the V6 preview.

- [ ] **Step 7: Present the preview to Marco Matos and STOP**

Do not promote. Await explicit production approval in a separate turn.

- [ ] **Step 8: Commit homologation evidence**

```bash
git add docs/v6-homologation-checklist.md
git commit -m "test: record Atlas Legalizacao V6 homologation"
```

## Self-review outcome

- **Spec coverage:** shell, hero, KPIs, pipeline, recent processes, lower analytics, modules, mobile, functionality preservation, data realism, testing and preview-only deployment are all assigned to tasks.
- **Type/interface consistency:** `AtlasDashboardV6.buildModel(sourceState)` is the single model contract consumed by `render(container, model)`; shell remains independent.
- **Review Focus coverage:** CSS precedence (Tasks 1–2), role permissions (Task 2), empty/real data (Task 3), mobile overflow (Task 6) and production protection (Tasks 1 and 7) each have explicit tests/checks.
- **Scope:** no new database schema, authentication rewrite, URL redesign or unrelated refactor is included.
