import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../atlas-ops-v7-ui.js', import.meta.url), 'utf8');
const data = readFileSync(new URL('../atlas-ops-v7-data.js', import.meta.url), 'utf8');
const cssPath = new URL('../atlas-ops-v7.css', import.meta.url);
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';

test('Central Operacional loads real operational data and never embeds mock KPI values', () => {
  assert.match(ui, /Data\.loadCentral\(/);
  assert.match(ui, /buildCentralModel|centralModel/);
  assert.match(ui, /tasksToday|todayTasks|today/i);
  assert.match(ui, /overdue/i);
  assert.match(ui, /outsideSla|outSla|fora do SLA/i);
  assert.match(ui, /blocked/i);
  assert.match(ui, /waiting_client|Aguardando cliente/);
  assert.match(ui, /waiting_agency|Aguardando órgão/);
  assert.match(ui, /waiting_finance|Financeiro/);
  assert.doesNotMatch(ui, /\b128\b|\b72\b|\b34\b/, 'mockup numbers must not leak into runtime UI');
});

test('data adapter enriches central data with clients, stage SLA and external operational signals', () => {
  assert.match(data, /clients/);
  assert.match(data, /workflow_stages/);
  assert.match(data, /costs/);
  assert.match(data, /licenses/);
  assert.match(data, /task_events/);
});

test('Central Operacional exposes the approved management filters and clickable drill-down', () => {
  for (const token of ['responsible','team','client','group','service','stage','status','priority','blocker','period','sla']) {
    assert.match(ui, new RegExp(`data-v71-filter[^>]*${token}|data-v71-filter-${token}|${token}Filter`, 'i'), `missing ${token} filter`);
  }
  assert.match(ui, /data-v71-kpi/);
  assert.match(ui, /applyCentralFilters/);
  assert.match(ui, /data-v71-process-open|openAtlasV4Process/);
});

test('central dashboard contains actionable queues, capacity and alerts', () => {
  for (const label of [
    'Minhas tarefas hoje','Tarefas atrasadas','Processos fora do SLA','Processos bloqueados',
    'Aguardando cliente','Aguardando órgão','Financeiro pendente','Sem movimentação',
    'Carga por equipe','Carga por responsável','Próximas ações críticas','Licenças e prazos'
  ]) assert.ok(ui.includes(label), `missing section ${label}`);
});

test('central schema-unavailable state preserves existing ATLAS instead of crashing', () => {
  assert.match(ui, /schema_unavailable|Recurso preparado para homologação/);
  assert.match(ui, /continuam funcionando normalmente/);
});

test('ATLAS 7.1 stylesheet is loaded and defines desktop central grid with constrained cards', () => {
  assert.ok(css.length > 0, 'atlas-ops-v7.css must exist');
  assert.match(ui, /atlas-ops-v7\.css\?v=7\.1/);
  assert.match(css, /\.v71-central/);
  assert.match(css, /\.v71-kpi-grid/);
  assert.match(css, /\.v71-central-grid/);
  assert.match(css, /\.v71-task-table/);
  assert.match(css, /overflow[^;]*:/);
});
