# ATLAS Legalização Dados Reais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a Dashboard aprovada consumir somente dados reais e atuais do Supabase, sem valores, percentuais ou distribuições demonstrativas.

**Architecture:** Manter o layout final e a navegação existentes. Ampliar `loadOperationalData()` para trazer documentos reais, normalizar natureza jurídica e estágios no `dashboard-v6.js`, e remover fallbacks ilustrativos da camada `atlas-reference-final.js`.

**Tech Stack:** HTML/CSS/JavaScript, Supabase JS, Node test runner, Vercel.

**Spec:** Conversa de homologação do ATLAS Legalização em 17/10/2026.

## Global Constraints

- Trabalhar somente na branch/preview até nova aprovação expressa.
- Não alterar Atlas Hub nem Atlas Contencioso.
- Preservar o layout final aprovado, rotas, permissões, autenticação e comportamento mobile do Pipeline.
- Não apresentar números fictícios quando uma fonte real estiver ausente; mostrar zero/estado vazio.
- Dados arquivados (`deleted_at`) não entram nos indicadores operacionais.

## Review Focus

- Empresas e processos arquivados não podem inflar KPIs.
- Documentos precisam vir da tabela real `documents`, nunca de mock.
- Honorários devem reconhecer `fee_kind='honorarios'` e `cost_type='hourly'`.
- Natureza jurídica deve ler `metadata.cnpj_sync.legal_nature` e agrupar rótulos extensos de forma legível.
- Estágios reais Registro/Inscrições/Concluído precisam aparecer nos seis blocos visuais já aprovados.

---

### Task 1: Contratos de dados reais

**Files:**
- Create: `tests/v6-dashboard-real-data.test.mjs`
- Modify: `.github/workflows/atlas-legalizacao-v5-checks.yml`

- [ ] Escrever testes que proíbem os valores mock no dashboard final.
- [ ] Exigir `documents` no `loadOperationalData()` e filtro `deleted_at is null` para empresas/processos.
- [ ] Exigir leitura de `fee_kind`, `cost_type` e `metadata.cnpj_sync.legal_nature`.
- [ ] Executar CI e confirmar falha antes da implementação.

### Task 2: Fonte operacional real

**Files:**
- Modify: `legalizacao.js`
- Modify: `dashboard-v6.js`

- [ ] Adicionar `documents` ao carregamento operacional autenticado.
- [ ] Excluir registros arquivados de empresas/processos.
- [ ] Normalizar natureza jurídica real em LTDA, S/A, MEI, EIRELI, Empresário Individual, Não informado ou Outros.
- [ ] Corrigir identificação de honorários e título de serviço.
- [ ] Mapear estágios reais para os seis blocos visuais aprovados.

### Task 3: Dashboard sem dados ilustrativos

**Files:**
- Modify: `atlas-reference-final.js`

- [ ] Remover fallback para KPIs, pipeline, recentes, situação, tipos e prazos.
- [ ] Remover percentuais de tendência fixos e substituir por descritores factuais.
- [ ] Manter estados vazios quando a fonte real não tiver registros.

### Task 4: Verificação e preview

**Files:**
- Test: `tests/v6-dashboard-real-data.test.mjs`

- [ ] Rodar suíte completa e checks de sintaxe.
- [ ] Conferir os números reais no Supabase contra o modelo do Dashboard.
- [ ] Criar deployment Vercel de preview da branch, sem target de produção.
- [ ] Confirmar `READY` e HTTP 200 antes de apresentar o link.
