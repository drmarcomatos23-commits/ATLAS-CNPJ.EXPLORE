# ATLAS Legalização V5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma V5 visualmente consistente do ATLAS Legalização, com shell unificado, sidebar full-height, Dashboard refinada e responsividade estável, sem alterar produção ou regras de negócio.

**Architecture:** Adicionar uma camada V5 carregada por último no `index.html`, responsável por tokens, shell e refinamentos visuais. Os scripts e IDs funcionais da V4 permanecem intactos; a V5 muda apresentação primeiro e só cria JS adicional se necessário para comportamento visual.

**Tech Stack:** HTML, CSS, JavaScript ES modules/vanilla, Node.js 24 `node:test`, Supabase existente.

**Spec:** `docs/superpowers/specs/2026-10-10-atlas-legalizacao-v5-design.md`

## Global Constraints

- Não promover para produção durante o desenvolvimento.
- Não criar custos adicionais nem dependências pagas.
- Preservar Supabase, autenticação, regras de perfil e módulos funcionais existentes.
- Evitar refatorações de negócio que não sejam necessárias ao redesign.
- Manter compatibilidade com os fluxos atuais de Processos, Empresas, Licenças, Financeiro, Relatórios, Treinamento e Configurações.

## Review Focus

- Conflitos de especificidade entre CSS V4 e V5: a camada V5 deve vencer apenas o shell e superfícies explicitamente redesenhadas.
- Breakpoint 1180 px: não pode existir estado intermediário com sidebar fixa sobre o conteúdo.
- iPhone 390–430 px: nenhum overflow horizontal inesperado no shell e cards principais.
- Sidebar com viewport baixa: navegação deve rolar sem encurtar o fundo da barra.
- Scripts existentes que consultam IDs/classes: nenhuma alteração de DOM pode quebrar autenticação ou navegação.

---

### Task 1: Contrato e camada de shell V5

**Files:**
- Create: `atlas-v5.css`
- Create: `tests/atlas-v5-shell.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `.app-shell`, `.sidebar`, `.workspace`, `.topbar`, `.main`, `.nav-list`, `.brand-box`, `.brand-logo` existentes.
- Produces: tokens CSS `--v5-sidebar-width`, `--v5-topbar-height`, `--v5-bg`, `--v5-card`, `--v5-border`, `--v5-text`, `--v5-muted`.

- [ ] **Step 1: Write failing contract test**
  - Assert `index.html` references `/atlas-v5.css?v=5.0` after all V4 styles.
  - Assert `atlas-v5.css` defines `--v5-sidebar-width:208px`, fixed desktop sidebar with `height:100dvh`, and workspace offset using the token.
  - Assert nav list has vertical overflow handling.

- [ ] **Step 2: Run test and confirm failure**
  - Run: `npm test`
  - Expected: new V5 shell contract fails because file/link do not exist.

- [ ] **Step 3: Implement `atlas-v5.css` and wire it in `index.html`**
  - Centralize shell geometry and palette.
  - Desktop >=1181 px: fixed 208 px sidebar, workspace margin-left 208 px, full-height background.
  - Tablet/mobile <=1180 px: workspace margin 0 and sidebar behaves as existing drawer.
  - Keep existing IDs/classes unchanged.

- [ ] **Step 4: Run tests**
  - Run: `npm test`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: add unified ATLAS V5 shell`

### Task 2: Dashboard V5 visual hierarchy

**Files:**
- Create: `dashboard-v5.css`
- Create: `tests/dashboard-v5-contract.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `.v4-dashboard`, `.v4-top-intro`, `.v4-kpis`, `.v4-kpi`, `.v4-card`, `.v4-main-grid`, `.v4-bottom-grid`, `.v4-ops-table`, `.v4-health-*`, `.v4-pipeline-*`.
- Produces: V5 visual presentation only; no data/API changes.

- [ ] **Step 1: Write failing dashboard contract test**
  - Assert `index.html` loads `/dashboard-v5.css?v=5.0` after `dashboard-v4.css` and `atlas-v5.css` remains last global shell layer.
  - Assert KPI layout has six columns desktop, three at <=1400 px, two at <=900 px, one at <=520 px.
  - Assert card radius, spacing and table density tokens are present.

- [ ] **Step 2: Run tests and confirm failure**
  - Run: `npm test`

- [ ] **Step 3: Implement `dashboard-v5.css`**
  - Refine title/filters, KPI cards, main operation table, health panel, pipeline, pending actions and licenses.
  - Preserve all V4 class names and JS behavior.

- [ ] **Step 4: Run tests**
  - Run: `npm test`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: refine ATLAS V5 dashboard`

### Task 3: Mobile V5 stabilization

**Files:**
- Create: `mobile-v5.css`
- Create: `tests/mobile-v5-contract.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: current mobile drawer and process-card behavior.
- Produces: V5 safe-area, touch target and overflow guarantees.

- [ ] **Step 1: Write failing mobile contract test**
  - Assert V5 stylesheet has breakpoints for 1180, 760 and 480 px.
  - Assert iOS form controls use `font-size:16px` on mobile.
  - Assert `.main`, `.workspace`, `.v4-dashboard` cannot exceed viewport width.

- [ ] **Step 2: Run tests and confirm failure**
  - Run: `npm test`

- [ ] **Step 3: Implement `mobile-v5.css`**
  - Normalize drawer width, sticky topbar, search row, card stacking, process rows and modal sizing.
  - Do not change mobile navigation JS unless a functional defect is reproduced.

- [ ] **Step 4: Run tests**
  - Run: `npm test`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: stabilize ATLAS V5 mobile layout`

### Task 4: Empresa 360° presentation layer

**Files:**
- Create: `company-360-v5.css`
- Create: `tests/company-360-v5-contract.test.mjs`
- Modify: `index.html`
- Modify only if required by existing markup: `legalizacao.js` or the current company-page renderer that owns the Empresas page.

**Interfaces:**
- Consumes: existing company card/detail DOM and data from `clients`, partners, processes, licenses, costs and documents.
- Produces: sectioned 360° layout without changing Supabase contracts.

- [ ] **Step 1: Pin existing company markup in a contract test**
  - Assert current company page still exposes the selectors used by existing actions.
  - Add V5 contract for grouped sections and responsive stacking.

- [ ] **Step 2: Run tests and confirm any missing V5 selectors fail**
  - Run: `npm test`

- [ ] **Step 3: Implement presentation layer**
  - Reorganize visual sections only where markup permits safely.
  - Preserve action buttons, IDs and event bindings.

- [ ] **Step 4: Run tests**
  - Run: `npm test`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: add ATLAS V5 company 360 presentation`

### Task 5: Branch verification and preview-only deployment

**Files:**
- No production file changes beyond Tasks 1–4.

**Interfaces:**
- Consumes: completed V5 branch.
- Produces: preview deployment only, not production promotion.

- [ ] **Step 1: Run full test suite**
  - Run: `npm test`
  - Expected: all tests PASS.

- [ ] **Step 2: Verify V5 branch diff against `atlas-legalizacao-v4-ux`**
  - Confirm no Supabase schema, env, auth or production configuration changes.

- [ ] **Step 3: Create Vercel preview deployment from `atlas-legalizacao-v5`**
  - Target must remain preview (`target` omitted / non-production).

- [ ] **Step 4: Inspect build state and preview page**
  - Expected: deployment `READY` and HTTP 200.

- [ ] **Step 5: Do not promote**
  - Production aliases and current production deployment remain unchanged.
