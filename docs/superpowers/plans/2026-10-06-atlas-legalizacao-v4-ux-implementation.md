# ATLAS Legalização 4.0 — UX Operacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o ATLAS Legalização 3.66 em um cockpit operacional 4.0, priorizando atrasos, pendências, próxima ação, licenças e visão por perfil, sem romper os fluxos existentes nem alterar a produção antes da homologação.

**Architecture:** Evolução incremental sobre a branch `atlas-legalizacao-v4-ux`, com uma camada nova de componentes 4.0 sobre os dados e helpers já existentes. Regras de cálculo ficam isoladas em um núcleo puro e testável; a UI 4.0 consome esse núcleo e reutiliza `loadOperationalData()`, `decorateProcesses()`, helpers de data/moeda e as permissões atuais. Produção 3.66 permanece preservada e somente será promovida após preview Vercel, testes e validação.

**Tech Stack:** HTML5, CSS3, JavaScript ES202x, Supabase Auth/Postgres/Storage/RLS, Node.js 24.x, `node:test`, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-06-atlas-legalizacao-v4-ux-design.md`

## Global Constraints

- Preservar a identidade visual institucional atual.
- Preservar a branch `atlas-legalizacao-production` sem alterações até validação da nova versão.
- Não alterar o schema de banco de dados sem necessidade comprovada.
- Reutilizar dados já existentes de processos, custos, licenças, clientes, responsáveis, prazos e status.
- Manter compatibilidade com perfis `admin`, `operacao`, `financeiro`, `cliente` e `auditoria`.
- Manter Supabase Auth/Postgres/Storage/RLS.
- Não remover recursos já publicados, inclusive cartilha, treinamentos, base de conhecimento, cadastro por CNPJ, sócios, licenças e financeiro.
- Nenhum KPI, timeline ou pendência pode inserir dado fictício no banco.
- Em telas com dados insuficientes, apresentar estado vazio informativo.
- A produção 3.66 deve permanecer recuperável pelo commit `a6363e7cddf7293a41ab29d31c4d62342c768a63` e pela branch `backup-atlas-legalizacao-v3.66-2026-10-06`.

## Review Focus

- Datas ausentes, inválidas ou em timezone diferente não podem gerar falso atraso; devem resultar em estado neutro/sem prazo.
- Processos `completed` ou `cancelled` nunca entram em atrasados nem em “Minha Operação Hoje”, salvo se houver regra explícita de reabertura.
- Custos sem valor ou com `payment_status` ausente não podem produzir `NaN` nem saldos negativos.
- Licenças sem `expires_at` ou `status='not_applicable'` não entram em alertas de vencimento.
- Perfis `cliente` e `auditoria` não podem receber ações de edição que hoje não possuem.

---

### Task 1: Núcleo operacional 4.0 e testes de regras

**Files:**
- Create: `atlas-v4-core.js`
- Create: `tests/atlas-v4-core.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: objetos de processo já decorados por `decorateProcesses(data)`, arrays de `costs`, `licenses`, `clients` e perfil atual.
- Produces: `window.AtlasV4Core` com `classifyDeadline(process, now)`, `buildDashboardMetrics(data, now)`, `buildTodayQueue(processes, now)`, `bucketLicenses(licenses, now)`, `buildPendingSummary(data, now)`, `canEditForRole(role)` e `safeAmount(value)`.

- [ ] **Step 1: Escrever testes falhando para classificação de prazo**

Cobrir: sem prazo, prazo futuro, hoje, amanhã, vencido, `completed` e `cancelled`.

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `node --test tests/atlas-v4-core.test.mjs`
Expected: FAIL porque `atlas-v4-core.js` ainda não existe.

- [ ] **Step 3: Implementar `window.AtlasV4Core` em `atlas-v4-core.js`**

Regras exatas: usar datas locais normalizadas; estados permitidos `overdue`, `today`, `tomorrow`, `upcoming`, `none`; processos encerrados retornam `none`; `safeAmount` retorna `0` para valor inválido.

- [ ] **Step 4: Adicionar testes de métricas financeiras e licenças**

Asserções mínimas: honorários a receber nunca negativos; taxas a pagar nunca negativas; licença vencida separada de `<=30`, `31-60`, `61-90` e `regular`; `not_applicable` ignorada.

- [ ] **Step 5: Adicionar script de teste ao `package.json`**

Adicionar `"scripts": { "test": "node --test tests/*.test.mjs" }` preservando os campos existentes.

- [ ] **Step 6: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add atlas-v4-core.js tests/atlas-v4-core.test.mjs package.json
git commit -m "feat: add Atlas 4 operational metrics core"
```

### Task 2: Dashboard 4.0 e Minha Operação Hoje

**Files:**
- Create: `dashboard-v4.js`
- Create: `dashboard-v4.css`
- Modify: `index.html`
- Test: `tests/dashboard-v4-contract.test.mjs`

**Interfaces:**
- Consumes: `window.AtlasV4Core`, `loadOperationalData()`, `decorateProcesses()`, `setHead()`, `page()`, `money()`, `fmtDateBR()`, `esc()` e `atlasCurrentProfile`/perfil ativo.
- Produces: override `window.dashboard`, `window.openAtlasV4Process(processId)`, markup para KPIs, “Minha Operação Hoje”, “Saúde da Operação”, “Central de Pendências”, “Central de Licenças” e pipeline-resumo.

- [ ] **Step 1: Escrever teste de contrato do dashboard**

Ler `dashboard-v4.js` e verificar a presença de seis KPIs aprovados: `Processos ativos`, `Atrasados`, `Pendências de cliente`, `Licenças ≤ 30 dias`, `Honorários a receber`, `Taxas a pagar`; verificar também `Minha Operação Hoje`, `Saúde da Operação`, `Central de Pendências` e `Central de Licenças`.

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `node --test tests/dashboard-v4-contract.test.mjs`
Expected: FAIL porque os arquivos 4.0 ainda não existem.

- [ ] **Step 3: Implementar `dashboard-v4.js`**

A fila deve ordenar: atrasados → hoje → amanhã → prioridade alta → demais. Se não houver campo persistente de próxima ação, exibir `Definir próxima ação`; nunca escrever esse valor no banco.

- [ ] **Step 4: Implementar `dashboard-v4.css`**

Reproduzir o layout aprovado: seis cards compactos, bloco principal de operação, painel lateral de saúde, pipeline horizontal e centrais de pendências/licenças; preservar azul-marinho, superfícies claras e cores apenas semânticas.

- [ ] **Step 5: Carregar a camada 4.0 por último em `index.html`**

Incluir `atlas-v4-core.js`, `dashboard-v4.css` e `dashboard-v4.js` depois dos módulos atuais, mantendo os assets 3.66 e sem remover scripts existentes.

- [ ] **Step 6: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add dashboard-v4.js dashboard-v4.css index.html tests/dashboard-v4-contract.test.mjs
git commit -m "feat: add Atlas Legalizacao 4 dashboard"
```

### Task 3: Navegação agrupada e Processos em Lista/Pipeline

**Files:**
- Create: `operations-v4.js`
- Create: `operations-v4.css`
- Modify: `index.html`
- Modify: `mobile-responsive.css`
- Test: `tests/operations-v4-contract.test.mjs`

**Interfaces:**
- Consumes: dados e modais de processos já existentes, `realProcessTable()`/renderização operacional atual quando disponível, `window.AtlasV4Core` e permissões `data-roles`.
- Produces: navegação agrupada (`Visão Geral`, `Operação`, `Gestão`, `ATLAS`, `Administração`), alternador `Lista | Pipeline`, cards mobile e filtros de atraso/responsável/status.

- [ ] **Step 1: Escrever teste de contrato da navegação e processos**

Asserções: os cinco grupos existem; rotas existentes não foram removidas; `Processos` oferece `Lista` e `Pipeline`; ações de edição não aparecem para `cliente`/`auditoria`.

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `node --test tests/operations-v4-contract.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Reorganizar visualmente o sidebar em `index.html` sem mudar `data-page` existentes**

Adicionar títulos de grupo não interativos e manter os mesmos botões, papéis e permissões.

- [ ] **Step 4: Implementar `operations-v4.js`**

Criar alternância de visualização, filtros e renderização de lista operacional com: processo, empresa, tipo, etapa, responsável, prazo, status e próxima ação derivada/placeholder neutro.

- [ ] **Step 5: Implementar `operations-v4.css` e ajustes mobile**

Abaixo de 760 px a lista deve virar cards sem scroll horizontal. O pipeline pode manter scroll horizontal com `scroll-snap`.

- [ ] **Step 6: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add operations-v4.js operations-v4.css index.html mobile-responsive.css tests/operations-v4-contract.test.mjs
git commit -m "feat: improve Atlas process operations and navigation"
```

### Task 4: Pendências, Exigências, Licenças e Pesquisa Global

**Files:**
- Create: `command-center-v4.js`
- Create: `command-center-v4.css`
- Modify: `dashboard-v4.js`
- Modify: `index.html`
- Test: `tests/command-center-v4.test.mjs`

**Interfaces:**
- Consumes: `window.AtlasV4Core`, dados já carregados do Supabase e `#global-search`.
- Produces: `window.AtlasV4Search.buildIndex(data)`, `window.AtlasV4Search.search(query)`, painel de resultados agrupados, filtros de pendência/exigência e central de licenças.

- [ ] **Step 1: Escrever testes de busca e agrupamento**

Asserções: busca é case-insensitive; encontra por código de processo, nome de empresa, licença e documento quando presente; query vazia não retorna overlay; itens sem campos opcionais não quebram a indexação.

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `node --test tests/command-center-v4.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar índice e busca em `command-center-v4.js`**

Pesquisa local sobre os dados já autorizados ao perfil. Não fazer consultas que ampliem o escopo de dados do usuário.

- [ ] **Step 4: Implementar Central de Exigências fase 1**

Classificar apenas registros já existentes cujo status/observação corresponda a `exigência`, `pendência` ou equivalente; não criar entidade nova nem gravar exigências fictícias.

- [ ] **Step 5: Implementar Central de Licenças completa**

Grupos exatos: `Vencidas`, `Até 30 dias`, `31–60 dias`, `61–90 dias`, `Regulares`.

- [ ] **Step 6: Integrar pesquisa global e estilos**

O campo existente do cabeçalho abre resultados por categoria e permite navegar ao item correspondente quando a rota/ação já existir.

- [ ] **Step 7: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add command-center-v4.js command-center-v4.css dashboard-v4.js index.html tests/command-center-v4.test.mjs
git commit -m "feat: add Atlas command center and compliance hubs"
```

### Task 5: Dashboards por perfil e proteção de ações

**Files:**
- Modify: `dashboard-v4.js`
- Modify: `operations-v4.js`
- Modify: `role-permissions.js`
- Test: `tests/role-dashboard-v4.test.mjs`

**Interfaces:**
- Consumes: perfil atual `admin|operacao|financeiro|cliente|auditoria` e permissões existentes.
- Produces: `renderDashboardForRole(role, data)` e visões específicas sem ampliar autorização de dados.

- [ ] **Step 1: Escrever matriz de testes por perfil**

Admin: executivo + operação + financeiro. Operação: fila, atrasos, pendências, processos e licenças. Financeiro: honorários, taxas e pagamentos. Cliente: somente dados próprios já permitidos. Auditoria: leitura sem ações de edição.

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `node --test tests/role-dashboard-v4.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar seleção de painel por perfil**

Não alterar políticas RLS; UI é apenas uma camada adicional de restrição, nunca substituto de autorização no banco.

- [ ] **Step 4: Auditar botões de ação**

Toda ação nova deve chamar `AtlasV4Core.canEditForRole(role)` ou respeitar `data-roles` existente.

- [ ] **Step 5: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard-v4.js operations-v4.js role-permissions.js tests/role-dashboard-v4.test.mjs
git commit -m "feat: tailor Atlas 4 dashboards by role"
```

### Task 6: Mobile, acessibilidade e regressão funcional

**Files:**
- Modify: `dashboard-v4.css`
- Modify: `operations-v4.css`
- Modify: `command-center-v4.css`
- Modify: `mobile-responsive.css`
- Test: `tests/v4-regression-contract.test.mjs`

**Interfaces:**
- Consumes: componentes criados nas Tasks 2–5.
- Produces: layout responsivo sem scroll horizontal nas áreas principais, foco visível, labels acessíveis e preservação dos fluxos 3.66.

- [ ] **Step 1: Escrever teste de regressão estática**

Asserções: `process-cartilha.js?v=3.66` permanece carregado; módulos de cadastro CNPJ/sócios, financeiro, licenças, conhecimento e treinamentos continuam referenciados; nenhuma rota principal foi removida.

- [ ] **Step 2: Implementar breakpoints mobile**

Em `<=760px`, tabelas operacionais novas viram cards; em `<=430px`, KPIs ficam em uma coluna; ações preservam área mínima de toque de 38 px já usada no projeto.

- [ ] **Step 3: Implementar acessibilidade básica**

Adicionar `aria-label`, `aria-expanded`, foco visível e semântica de botões/abas nas novas interações.

- [ ] **Step 4: Rodar testes automatizados**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard-v4.css operations-v4.css command-center-v4.css mobile-responsive.css tests/v4-regression-contract.test.mjs
git commit -m "fix: harden Atlas 4 mobile and regression safety"
```

### Task 7: Preview Vercel, QA visual e homologação

**Files:**
- Modify only if QA finds defects in files from Tasks 1–6.

**Interfaces:**
- Consumes: branch `atlas-legalizacao-v4-ux` completa.
- Produces: deployment Preview Vercel validado e pronto para decisão de promoção.

- [ ] **Step 1: Rodar suite completa**

Run: `npm test`
Expected: PASS, zero falhas.

- [ ] **Step 2: Criar deployment Preview da branch `atlas-legalizacao-v4-ux`**

Não apontar o domínio de produção para esse deployment.

- [ ] **Step 3: Verificar visualmente desktop**

Checar: login, Dashboard 4.0, Minha Operação Hoje, saúde, processos Lista/Pipeline, pendências, licenças, pesquisa e dashboards por perfil.

- [ ] **Step 4: Verificar visualmente mobile**

Checar larguras aproximadas de 390 px, 430 px e 760 px; confirmar ausência de scroll horizontal nas áreas principais.

- [ ] **Step 5: Testar fluxos legados críticos**

Cadastrar/editar empresa, processo, custos, botão PAGO, licenças, reabrir processo concluído, emitir cartilha com data do dia, base de conhecimento e treinamentos.

- [ ] **Step 6: Verificar console e erros de runtime**

Expected: nenhuma exceção nova causada pelos módulos 4.0.

- [ ] **Step 7: Registrar commit final de correções de QA, se necessário**

```bash
git add <arquivos-corrigidos>
git commit -m "fix: finalize Atlas 4 preview QA"
```

- [ ] **Step 8: Entregar URL de preview para homologação do usuário**

A promoção para `atlas-legalizacao-production` fica fora desta task e exige homologação explícita do preview.
