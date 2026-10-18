import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const processPath = new URL('../atlas-ops-v7-process.js', import.meta.url);
const processUi = existsSync(processPath) ? readFileSync(processPath, 'utf8') : '';
const data = readFileSync(new URL('../atlas-ops-v7-data.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../atlas-ops-v7.css', import.meta.url), 'utf8');
const loader = readFileSync(new URL('../pwa-v5-1.js', import.meta.url), 'utf8');

test('process module is loaded after the legacy operations shell without replacing Processos route', () => {
  assert.match(loader, /atlas-ops-v7-process\.js\?v=7\.1/);
  assert.match(processUi, /openAtlasV4Process/);
  assert.match(processUi, /legacyOpenProcess/);
  assert.doesNotMatch(processUi, /window\.processPage\s*=/, 'existing Processos route must remain owned by operations-v4');
});

test('process detail loads a complete 360 operational model', () => {
  assert.match(processUi, /Data\.loadProcess\(/);
  assert.match(data, /workflow_stages/);
  assert.match(data, /task_dependencies/);
  assert.match(data, /profiles/);
  assert.match(data, /teams/);
  for (const label of ['Visão Geral','Tarefas','Bloqueios','SLA e Prazos','Documentos','Histórico']) {
    assert.ok(processUi.includes(label), `missing process tab ${label}`);
  }
});

test('process overview highlights exactly one primary action and stage readiness', () => {
  assert.match(processUi, /Próxima Ação/);
  assert.match(processUi, /is_primary_action/);
  assert.match(processUi, /required/);
  assert.match(processUi, /Há pendências — avanço permitido/);
  assert.match(processUi, /Concluir etapa e avançar/);
  assert.match(processUi, /workflow\.advance/);
});

test('process detail exposes task actions, blocker actions and advisory stage advance', () => {
  for (const call of ['setPrimaryTask','startTask','completeTask','openBlocker','closeBlocker','advanceStage','createManualTask']) {
    assert.match(processUi, new RegExp(`Engine\\.${call}\\(`), `missing engine action ${call}`);
  }
  assert.doesNotMatch(processUi, /data-v71-force-advance/);
  assert.match(processUi, /Pendências documentais, financeiras, de órgão e tarefas continuarão abertas/i);
  assert.match(processUi, /Nova Tarefa/);
});

test('legacy process gets review-first activation CTA instead of automatic task generation', () => {
  assert.match(processUi, /Ativar Central Operacional neste processo/);
  assert.match(processUi, /previewLegacyActivation/);
  assert.doesNotMatch(processUi, /DOMContentLoaded[\s\S]{0,500}activateProcess\s*\(/);
});

test('process SLA cards preserve total calendar time versus internal business-day time', () => {
  assert.match(processUi, /Tempo total do processo/);
  assert.match(processUi, /Tempo operacional interno/);
  assert.match(processUi, /Tempo em bloqueio externo/);
  assert.match(processUi, /SLA da etapa atual/);
  assert.match(processUi, /Sla\.slaSnapshot|AtlasOpsV71Sla/);
});

test('process detail stylesheet supports timeline, tabs, task panel and mobile containment', () => {
  for (const selector of ['.v71-process','.v71-stage-track','.v71-process-tabs','.v71-primary-action','.v71-process-tasks','.v71-blocker-card']) {
    assert.ok(css.includes(selector), `missing style ${selector}`);
  }
  assert.match(css, /@media\(max-width:760px\)[\s\S]*\.v71-process/);
});
