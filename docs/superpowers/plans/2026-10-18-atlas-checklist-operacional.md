# ATLAS Legalização — Checklist operacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a lista meramente orientativa em checklist documental persistente por processo, dinâmico por serviço, com estados, responsáveis, prazos, arquivos, auditoria e alertas de pendência **sem bloquear avanço de etapas**.

**Architecture:** Estender as tabelas documentais v7.1 por migração aditiva v7.2, criar operações transacionais com RLS e reutilizar `documents`, `costs`, `tasks` e `process_exigencies` como fontes de verdade. Separar modelo puro de interface, comandos de banco, agregação de pendências e renderização responsiva; não alterar silenciosamente registros preexistentes.

**Tech Stack:** JavaScript sem bundler (IIFEs globais), Supabase JS 2.117.2, PostgreSQL 16/PLpgSQL, Node.js `node --test`, CSS responsivo, GitHub Actions com banco descartável, preview isolado com dados sintéticos.

**Spec:** `docs/superpowers/specs/2026-10-18-atlas-checklist-operacional-design.md` (aprovada em 18/10/2026).

## Global Constraints

- Branch de execução futura: criar `feat/atlas-checklist-operacional-v72` a partir de `design/atlas-checklist-operacional-20261018`; não trabalhar na branch de produção.
- **Não executar SQL no Supabase de produção, não modificar registros reais, não aplicar migrations remotas, não publicar produção**, não mexer no Atlas Hub ou Contencioso. Não criar recursos pagos. Autorização de produção será solicitada separadamente.
- `atlas-auth.js` contém endereço fixo do Supabase de produção. Portanto, **nunca hospedar ou chamar de “homologação gravável” um preview que carregue o cliente Supabase atual**. Sem banco separado validado, só preview demonstrativo isolado sem SDK, credenciais, sessão ou chamadas de rede; banco PostgreSQL efêmero para ensaios SQL.
- Migração aditiva em novo arquivo após os SQL v7.1 existentes; não reescrever migrations históricas já versionadas. Scripts de testes recebem apenas dados sintéticos.
- Procedimento por tarefa: teste vermelho, menor implementação válida, teste verde, revisão de diferenças, commit. Testes que codificam bloqueio antigo devem ser atualizados na mesma tarefa da mudança.
- A transição de etapa é **permitida com qualquer pendência documental, financeira, de órgão ou tarefa**, desde que o usuário tenha permissão e existam etapas válidas. Alertas são informativos; erros reais de segurança/integridade continuam impedindo a operação.
- Não declarar conclusão de persistência multiusuário sem prova em ambiente autenticado e isolado. Aprovação final do Dr. Marco precede qualquer produção.

## Review Focus

1. Serviço legado/desconhecido: expor “sem modelo configurado” — jamais disfarçar checklist genérico como vinculante.
2. Trocas rápidas de serviço e resposta lenta: a última seleção vence, sem descartar escolhas por mudança somente de empresa ou etapa.
3. Processo persistido e inicialização do checklist em timeout: mostrar sucesso **parcial**, permitir repetição idempotente; não criar cópias duplicadas.
4. Arquivo, responsável ou requisito de outra organização/processo: RLS/validação SQL negam inclusive a chamada direta à RPC, ainda que a UI seja burlada.
5. Avanço com documentos, exigências, tarefas e custos abertos: transição é gravada com fotografia das pendências e **nenhuma pendência é resolvida automaticamente**.

---

## Task 1 — Isolar a execução e fixar contratos de teste

**Files:** `package.json`, `tests/v7-2-doc-model.test.mjs` (new), `tests/v7-2-pending-aggregate.test.mjs` (new); ler `index.html`, `pwa-v5-1.js`, `atlas-auth.js`, `.github/workflows/atlas-v71-db-homologation.yml`.

- [ ] Antes de editar código de aplicação, criar branch indicada e registrar `git status --short`, HEAD e saída inicial de `npm test`.
- [ ] Escrever os primeiros testes Node que importam os novos módulos por `vm.runInNewContext` e exigem `AtlasOpsV72DocumentModel` e `AtlasOpsV72Pending`; por exemplo:

  ```js
  assert.equal(model.normalizeService('encerramento'), 'encerramento');
  assert.equal(model.normalizeService('servico_legado'), null);
  assert.equal(pending.summarize({requirements:[],costs:[],exigencies:[],tasks:[],asOf:'2026-10-18'}).totalOpen, 0);
  ```

- [ ] Rodar `node --test tests/v7-2-doc-model.test.mjs tests/v7-2-pending-aggregate.test.mjs`; registrar falha por ausência do contrato.
- [ ] Não commitar testes vermelhos isoladamente; manter o ciclo até a implementação mínima das Tasks 2 e 7 e só então registrar os testes verdes nos respectivos commits.

## Task 2 — Modelo puro, sete serviços e estados

**Files:** `atlas-ops-v7-doc-model.js` (new), `tests/v7-2-doc-model.test.mjs`; migrar matriz de referência de `atlas-ops-v7-docs.js` sem duplicar a fonte de consulta.

**Interface:** `window.AtlasOpsV72DocumentModel = Object.freeze({normalizeService, referenceTemplatesFor, summarizeRequirements, reconcilePreview, canTransition})`. `normalizeService(value)` retorna um dos sete códigos ou `null`; não converte `encerramento` em `baixa` na identidade, embora possa reutilizar as sugestões iniciais. `referenceTemplatesFor(code)` devolve itens `{title,instructions,required_rule,category,applicability}`; são **sugestões locais provisórias**, não itens persistidos até validação no banco. `summarizeRequirements(rows,asOf)` devolve contagens por situação, `pending_with`, vencidos/vencendo. `canTransition(from,to,{hasEvidence,reason})` valida justificativa e evidência.

- [ ] Ampliar testes vermelhos cobrindo cada serviço, valor desconhecido, estado `not_requested → requested → received → in_review → approved`, devolução `returned` e dispensa `waived` com motivo:

  ```js
  assert.equal(model.referenceTemplatesFor('abertura').length > 0, true);
  assert.notDeepEqual(model.referenceTemplatesFor('abertura'), model.referenceTemplatesFor('licenciamento'));
  assert.deepEqual(model.referenceTemplatesFor('desconhecido'), []);
  assert.equal(model.canTransition('received','approved',{hasEvidence:false,reason:''}).ok, false);
  assert.equal(model.canTransition('requested','waived',{hasEvidence:false,reason:'Não aplicável'}).ok, true);
  ```

- [ ] Rodar teste e observar falha; implementar funções puras sem acesso a DOM, rede ou `localStorage`.
- [ ] Validar enum de status (`not_requested`, `requested`, `received`, `in_review`, `approved`, `returned`, `waived`), origem (`cliente`, `financeiro`, `orgao`, `operacao`) e aplicabilidade (`to_confirm`, `applicable`, `not_applicable`); comentários documentam que `approved`/`waived` são os únicos concluídos.
- [ ] Rodar `node --test tests/v7-2-doc-model.test.mjs`, ajustar cobertura de entradas `null`, acentos e UTC, commitar `feat(v72): add service-aware document model`.

## Task 3 — Migração aditiva e isolamento das organizações

**Files:** `supabase/migrations/20261018_atlas_v7_2_checklist_operacional.sql` (new), `tests/v7-2-document-schema.test.mjs` (new), `tests/fixtures/atlas-v72-pg-integration.sql` (new).

**Esquema:** depois da v7.1, adicionar a `process_document_requirements`: `applicability`, `pending_with`, `assigned_to`, `notes`, `requested_at`, `received_at`, `resolved_at`, `archived_at`, `service_type_snapshot`, `manual_key` (UUID de idempotência opcional). Ampliar `document_requirement_templates` com `scope_legal_nature`, `scope_activity` somente onde houver critérios verificáveis; não inferir regra jurídica automaticamente. Adicionar índices `(organization_id,process_id,pending_with,status,due_on)` e unicidade condicional de `manual_key`. FK `assigned_to` existente `profiles` e validação organizacional por trigger. Reutilizar `process_document_events`.

- [ ] Criar teste estático vermelho que procure todos os campos, RLS, `SECURITY INVOKER`, `current_org_id()`, status e `check` de `pending_with`; rodar `node --test tests/v7-2-document-schema.test.mjs`.
- [ ] Criar SQL de migração com conversão segura de estados legados: `pending → not_requested`, `submitted → received`, `rejected → returned`; alterar também o `DEFAULT` de `pending` para `not_requested`, normalizar campos novos e só depois substituir o `CHECK` antigo. Preservar timestamps, eventos e vínculos. Constraints: `returned`/`waived` exigem motivo, `approved` exige evidência e revisor, pendência ativa tem origem explícita após solicitação; arquivamento é lógico. Garantir idempotência da migração em ensaio com reexecução quando viável.
- [ ] Validar por trigger que `assigned_to` pertence à organização e que `document_id`/`requirement_id` coincidem em organização e processo; reaproveitar `atlas_v71_document_validate_links`, não enfraquecer RLS existente.
- [ ] Adicionar testes SQL negativos (cross-org, cross-process, perfil auditor/financeiro tentando aprovar), positivos (admin/operação) em transações isoladas. Exemplo:

  ```sql
  -- Executar com organização B em contexto de auth sintético:
  -- SELECT COUNT(*) ... WHERE process_id = '<processo-da-org-A>'::uuid deve ser 0.
  -- UPDATE por ID de org A deve atingir 0 linhas; RPC deve rejeitar identidade cruzada.
  ```

- [ ] Rodar SQL na base efêmera, nunca no Supabase; `node --test tests/v7-2-document-schema.test.mjs` verde; commit `feat(v72): extend documentary schema with secure ownership`.

## Task 4 — Comandos transacionais para checklist e auditoria

**Files:** mesma migração v7.2, `tests/fixtures/atlas-v72-pg-integration.sql`, `tests/v7-2-document-schema.test.mjs`.

**RPCs:** `atlas_v72_init_document_checklist(p_process_id uuid)` idempotente; `atlas_v72_update_requirement(p_requirement_id uuid,p_patch jsonb)` valida campos permitidos, estado, motivo, `pending_with`, `assigned_to`, prazo e grava evento com antes/depois; `atlas_v72_add_manual_requirement(p_process_id uuid,p_title text,p_required_rule text,p_manual_key uuid)`; `atlas_v72_reconcile_checklist(p_process_id uuid,p_service_type text)` só após confirmação da UI, com atualização de serviço e arquivamento lógico sob uma transação. Readequar `atlas_v71_add_document_version` (`received`, não aprovação automática) e `atlas_v71_review_document` aos estados novos, mantendo compatibilidade para chamadas existentes durante transição.

- [ ] Primeiro criar SQL de regressão que falhe: inicializar duas vezes, `count` inalterado; mudar estado e recuperar evento com `actor_id`; devolver/dispensar sem motivo deve falhar; reaplicar `manual_key` não duplica; upload sem documento do mesmo processo falha.
- [ ] Implementar RPCs com `SECURITY INVOKER`, busca filtrada por `organization_id=current_org_id()`, permissão por ação (`documents.review`, `documents.upload`, `processes.create`) e operação atômica. Restringir chaves JSON aceitas, validar permissões de `assigned_to` e registrar audit trigger sem permitir escrita direta em eventos.
- [ ] Na reconciliação, manter requisitos movimentados e versões com `archived_at` (não `DELETE`); adicionar apenas modelos do novo serviço; manter foto de `service_type_snapshot` por requisito. Proteção contra duas solicitações simultâneas e mudança concorrente de serviço.
- [ ] Testar retorno `received` após anexo, revisão e restauração de `returned`, justificativa de `waived`, leitura da trilha e arquivo versionado; executar SQL efêmero até ficar verde; commit `feat(v72): add idempotent checklist commands and audit`.

## Task 5 — Seleção reativa e criação persistente

**Files:** `atlas-ops-v7-docs.js`, `company-flow.js`, `legalizacao.js`, `pwa-v5-1.js`, `tests/v7-2-form-checklist.test.mjs` (new), atualizar `tests/v7-1-document-reference-preview.test.mjs`, `tests/v7-1-mobile-checklist-timeout.test.mjs`.

**Contrato da UI:** `decorateNewProcessForm(form)` renderiza imediatamente o conjunto do serviço selecionado; consulta remota autorizada refina os modelos sem substituir a seleção mais recente. Escolhas manuais/condicionais devem compor payload do checklist e ser persistidas após o `process.id`. `afterProcessCreated(id, draft)` retorna `{ok,created,retryable,error}`; falha não deve fechar modal sem aviso claro.

- [ ] Teste vermelho com fake Supabase e promises controladas: selecionar `abertura`, depois `licenciamento`, resolver primeiro `abertura` por último e confirmar títulos apenas do licenciamento; verificar os sete códigos e mensagem distinta para desconhecido.
- [ ] Teste de falha: RPC indisponível e processo criado devem renderizar “Processo salvo; checklist ainda não gerado”, mostrar botão “Tentar novamente” com `id`, e nunca passar um falso `{ok:true}`. Conferir `afterProcessCreated` chamado exatamente uma vez, sem duplicação na repetição.
- [ ] Implementar atualização imediata a cada `change` de `#proc-service`; `requestNumber` impede resposta obsoleta; consultas de cliente/etapa não zeram seleção; troca de serviço com edições locais pergunta confirmação antes de descartá-las.
- [ ] Adaptar modal legado `openProcessModal(id)` em `legalizacao.js` ao seletor canônico ou entrada com validação explícita e ação de reconciliação na edição. Ao gravar alteração de serviço, chamar RPC transacional **somente após confirmação**; não fazer `update processes` isolado seguido de reconciliação não atômica.
- [ ] Remover a apresentação de `referenceChecklistHtml` como checklist operacional do processo existente quando schema não estiver pronto. Substituir por indisponibilidade honesta e retry; texto orientativo pode existir só com rótulo inequívoco de sugestão.
- [ ] Teste e commit `feat(v72): bind checklist drafts to service and process`.

## Task 6 — Edição operacional e vínculo com o dossiê

**Files:** `atlas-ops-v7-docs.js`, `atlas-ops-v7-data.js`, `atlas-ops-v7.css`, `tests/v7-2-document-ui.test.mjs` (new), atualizar `tests/v7-1-document-exigencies.test.mjs`.

- [ ] Teste vermelho: renderização de `data-v72-doc-item` inclui status e origem separados; clique em Solicitar/Receber/Conferir/Devolver/Dispensar gera RPC correta; auditor sem permissão não recebe botões; retorno de erro preserva o estado previamente confirmado, nunca exibe sucesso otimista.
- [ ] Renderizar resumo de aprovados/dispensados/solicitados/em conferência/vencidos e filtros combinados por situação, origem, usuário e prazo, mais busca. Lista desktop e cartão mobile compartilham a mesma função de dados, com rótulos de acessibilidade.
- [ ] Formular edição com `status`, `applicability`, `pending_with`, `assigned_to` (perfis da mesma org), `due_on`, `notes`, motivo e histórico de eventos. `approved` exige evidência e revisor, `returned` e `waived` exigem motivo. A UI espelha validação do banco, mas não a substitui.
- [ ] Conectar `uploadModal`/`openDocument` existentes ao `requirement_id` e `process_document_versions`; mostrar histórico de versões, data e arquivo. Erro de vínculo exibe “arquivo no dossiê, sem vínculo”, com botão de retry, não faz sucesso fictício.
- [ ] Garantir atualização dos contadores somente após retorno bem-sucedido e reload; testar reabertura do mesmo processo e manutenção de `id` e estados; commit `feat(v72): add operational document controls`.

## Task 7 — Agregar pendências sem cadastros duplicados

**Files:** `atlas-ops-v7-pending.js` (new), `atlas-ops-v7-data.js`, `atlas-ops-v7-process.js`, `atlas-ops-v7-ui.js` (se a Central atual exigir), `tests/v7-2-pending-aggregate.test.mjs`, `tests/v7-1-central-ui.test.mjs`.

**Interface:** `window.AtlasOpsV72Pending.summarize({requirements,costs,exigencies,tasks,asOf})` retorna `{totalOpen,byOrigin:{cliente,financeiro,orgao,operacao},dueSoon,overdue,items:[{source_type,source_id,process_id,pending_with,status,due_on,title}]}`. `source_type` só aceita `document`, `cost`, `exigency`, `task`; `source_id` sempre chave do registro de origem. Não criar tabela para cópia de custos/exigências.

- [ ] Teste vermelho: documento aguardando cliente, taxa não paga, exigência de órgão e tarefa operacional geram quatro itens com quatro `source_type` distintos; custo quitado e exigência aceita não entram; mesmo `source_type:source_id` não conta duas vezes.
- [ ] Implementar função pura com mapeamento explícito dos campos reais de `costs`, `process_exigencies`, `tasks`; não presumir `status` de pagamento: conferir esquema existente antes de codificar. Classificar vencido/vencendo pela data (fuso estável) sem inferir “órgão respondeu” por prazo passado.
- [ ] Integrar `loadProcess`/`loadCentral` sem consultas N+1, indicar indisponibilidade de domínio em caso de tabela não acessível; totais incompletos devem ser rotulados, nunca apresentados como zero confiável.
- [ ] Renderizar alerta em visão geral, dashboard e relatório/caminho existente da Central com atalho à fonte; botões abrem registro de origem sob permissões atuais. Teste de links conserva `source_id`; commit `feat(v72): aggregate documentary and financial pending alerts`.

## Task 8 — Avanço sem bloqueios documentais, financeiros ou operacionais

**Files:** `supabase/migrations/20261018_atlas_v7_2_checklist_operacional.sql`, `atlas-ops-v7-process.js`, `atlas-ops-v7-engine.js`, `tests/v7-2-nonblocking-advance.test.mjs` (new); atualizar `tests/v7-1-process-detail.test.mjs`, `tests/v7-1-operational-schema.test.mjs`, `tests/v7-1-document-exigencies.test.mjs`, `tests/fixtures/atlas-v71-pg-integration.sql`.

- [ ] Começar com teste SQL vermelho: processo com tarefa required, documento `requested`, custo pendente e exigência `open` avança por `atlas_v71_advance_stage(process_id)` **sem** `p_force`, mantendo os quatro estados e respectivos IDs. Testar também permissão negada, etapa final e `process_id` inexistente.
- [ ] Fazer migração `CREATE OR REPLACE FUNCTION atlas_v71_advance_stage(uuid,boolean,text)` conservar assinatura e verificações de autorização, mas substituir exceções de pendência por contagens de aviso; remover exigência de permissão especial de override para fluxo normal. `p_force` legado deve ser interpretado só para compatibilidade, sem criar caminho que trate pendência como exceção.
- [ ] Em `stage_transitions.metadata`, gravar contagens `{tasks,documents,costs,exigencies}` antes da atualização, ator e instante pela própria transição. Preservar geração idempotente de tarefas/modelos da etapa seguinte, integridade e SLA.
- [ ] Adaptar `readiness(model)` para “Existem pendências — você pode avançar”; mostrar ação normal `data-v71-stage-advance` ao usuário autorizado e confirmação com contagens. Excluir o CTA de “avanço forçado” para pendências, mantendo direitos de workflow.
- [ ] Atualizar assertions legadas contraditórias. Rodar testes Node e fixture efêmera até passar; commit `fix(v72): make stage advancement advisory-only`.

## Task 9 — Matriz de permissões, auditoria e regressão mobile

**Files:** `atlas-ops-v7-docs.js`, `atlas-ops-v7.css`, `atlas-ops-v7-mobile.css` (se existente), `tests/v7-2-mobile-permissions.test.mjs` (new), `tests/v7-1-mobile-permissions.test.mjs`, `tests/fixtures/atlas-v72-pg-integration.sql`.

- [ ] Testes vermelhos de UI e RLS para admin, operação, financeiro, auditoria e cliente. Admin/operador com permissão podem alterar documental; financeiro pode gerir o próprio custo mas não aprovar documento societário; auditoria só lê; cliente não acessa checklist nesta versão. Permissão granular precede simples rótulo.
- [ ] Ajustar políticas e comandos SQL para impedir `INSERT/UPDATE` direto não autorizado, inclusive quando o navegador fabricar RPC ou `organization_id`; garantir que eventos não tenham grant de escrita de usuário final.
- [ ] Criar viewport tests para largura 320/375 px (DOM + CSS estático e inspeção manual): modal não cobre barra fixa, filtros expansíveis, botões clicáveis, sem rolagem horizontal e estados acessíveis.
- [ ] Testar logs sem dados pessoais, tratamento de timeout/offline/retry, eventos que guardam `old/new` sem vazar conteúdo de arquivo; commit `test(v72): secure roles and mobile checklist`.

## Task 10 — Integrar a homologação descartável no CI

**Files:** `.github/workflows/atlas-v71-db-homologation.yml`, `tests/fixtures/atlas-v71-pg-integration.sql`, `tests/fixtures/atlas-v72-pg-integration.sql`, `package.json` (somente se comando auxiliar for útil).

- [ ] Teste vermelho: fixture v7.2 não roda na ordem anterior por ausência de colunas/funções. Alterar workflow para disparar também em `feat/atlas-checklist-operacional-v72` e, após os dois SQL v7.1, executar **migração v7.2** e ambas as fixtures revistas.
- [ ] Confirmar `psql -X -v ON_ERROR_STOP=1` na ordem baseline → engine v7.1 → docs v7.1 → checklist v7.2 → integração atualizada v7.1 → integração v7.2. Todas as falhas explícitas encerram o job.
- [ ] Rodar `npm test` completo, `node --check` em scripts alterados e o workflow descartável (ou reproduzir no PostgreSQL local isolado). Não usar credenciais ou URL Supabase real no CI.
- [ ] Gerar relatório curto de casos que passaram/falharam, incluindo reentrada, IDs preservados e quatro pendências no avanço. Commit `ci(v72): validate persistent checklist in ephemeral database`.

## Task 11 — Preview seguro e verificações de aceite

**Files:** `previews/atlas-checklist-operacional.html` (new, somente se nenhum banco isolado disponível), `previews/README.md` (new), `pwa-v5-1.js`, `sw-v5-1.js` (se alteração de cache necessária), testes de loader existentes.

- [ ] Antes de subir qualquer preview, checar URL do Supabase realmente carregada, scripts, cookies/sessões e destino de escrita. Se for a URL de `atlas-auth.js` (produção), **interromper preview gravável**.
- [ ] Sem banco isolado autorizado: criar **preview navegável demonstrativo** com dados sintéticos e interações locais claramente identificadas “Demonstração — não grava”; não carregar `atlas-auth.js`, sessão, SDK Supabase, Storage ou funções de produção. Não usar dados pessoais verdadeiros. Esse preview comprova UX, não persistência.
- [ ] Com projeto Supabase de homologação separado já disponível e autorizado: parametrizar cliente de staging sem fallback para URL de produção, usar usuários/testes sintéticos, aplicar SQL somente ali e demonstrar criação, fechamento/reabertura em outra sessão, versão de arquivo e RLS. Não criar projeto pago ou mover registros sem nova permissão.
- [ ] Validar manualmente os **12 casos de aceite** da especificação, distinguindo no relatório: `OK em UI`, `OK SQL efêmero`, `OK multiusuário em banco isolado` ou `Pendente: requer ambiente isolado`. Conferir celular e cache PWA, `npm test`, diff limpo e links servidos.
- [ ] Apresentar preview e branch para aprovação; **não** executar migration de produção, alterar variáveis de produção ou fazer deploy de produção. Commit `preview(v72): add safely isolated checklist demonstration` se aplicável.

## Final Review / Delivery Gate

- [ ] Verificar rastreabilidade dos 12 critérios de aceite: 1/2/9 Task 5; 3/4/5 Task 4+6; 6 Task 3+6; 7 Task 7; 8 Task 8; 10 Task 9; 11 Task 9+11; 12 Task 10+11.
- [ ] Inspecionar diff de SQL, RLS, arquivos estáticos e workflows; revisar casos especiais listados em **Review Focus**, testes novos e regressões alteradas.
- [ ] `npm test` verde e SQL efêmero verde são obrigatórios antes de afirmar correção. Prévia local/mock não substitui validação multiusuário; declarar limitação em destaque quando houver.
- [ ] Mostrar ao Dr. Marco: branch/commits, telas e link seguro do preview, evidências de testes, matriz do que está implementado versus pendente, sem pedir autorização implícita para publicar.
- [ ] Solicitar **outra autorização expressa** para eventual plano de implantação em produção (backup, migração, validação pós-deploy e reversão), fora desta execução.

## Execução proposta após aprovação deste plano

**Modo direto/nativo**: o mesmo agente implementa uma tarefa por vez, aplica TDD e revisão final; sem agentes auxiliares e sem custo adicional. O usuário aprova o plano e esse modo antes de começar alterações de produto. Qualquer necessidade de banco de homologação adicional, compra ou publicação é apresentada antes, com alternativa demonstrativa segura.
