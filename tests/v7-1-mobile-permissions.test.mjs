import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const roleSource = readFileSync(new URL('../role-permissions.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const uiPath = new URL('../atlas-ops-v7-ui.js', import.meta.url);
const uiSource = existsSync(uiPath) ? readFileSync(uiPath, 'utf8') : '';

const permissions = [
  'operations.view','tasks.view','tasks.create','tasks.edit','tasks.assign',
  'tasks.complete','blockers.manage','workflow.advance','workflow.override','teams.manage'
];

test('permission matrix exposes the full ATLAS 7.1 operational vocabulary', () => {
  for (const key of permissions) assert.ok(roleSource.includes(`'${key}'`), `missing permission ${key}`);
  assert.match(roleSource, /Central Operacional/);
  assert.match(roleSource, /Tarefas/);
  assert.match(roleSource, /Fluxo operacional|Workflow|Etapas/i);
  assert.match(roleSource, /Equipes/);
});

test('Central Operacional route is protected by operations.view and present in navigation', () => {
  assert.match(roleSource, /['"]central-operacional['"]\s*:\s*['"]operations\.view['"]/);
  assert.match(index, /data-page=["']central-operacional["']/);
  assert.match(index, />\s*Central Operacional\s*</);
});

test('admin remains unconditional while mutation permissions stay matrix-driven for other roles', () => {
  assert.match(roleSource, /currentRole\(\)===['"]admin['"]\s*\|\|\s*currentPermissions\.has\(key\)/);
  assert.match(roleSource, /tasks\.create/);
  assert.match(roleSource, /tasks\.complete/);
  assert.match(roleSource, /workflow\.override/);
  assert.match(roleSource, /teams\.manage/);
});

test('legacy process activation is review-first and never automatic on page load', () => {
  assert.ok(uiSource.length > 0, 'atlas-ops-v7-ui.js must exist');
  assert.match(uiSource, /Ativar Central Operacional neste processo/);
  assert.match(uiSource, /Revisar tarefas propostas|Tarefas propostas/i);
  assert.match(uiSource, /previewLegacyActivation|previewActivation/i);
  assert.match(uiSource, /confirmLegacyActivation|confirmActivation/i);
  assert.match(uiSource, /AtlasOpsV71Engine\.activateProcess|Engine\.activateProcess/);
  const domReady = uiSource.match(/DOMContentLoaded[\s\S]{0,1200}/)?.[0] || '';
  assert.doesNotMatch(domReady, /activateProcess\s*\(/, 'legacy activation cannot run automatically on DOMContentLoaded');
});

test('activation preview loads task templates but only confirms after explicit user action', () => {
  assert.match(uiSource, /task_templates/);
  assert.match(uiSource, /task_template_id|templateIds/);
  assert.match(uiSource, /data-v71-activate-confirm|confirmLegacyActivation/);
  assert.match(uiSource, /data-v71-activate-cancel|cancel/i);
});

test('teams management is restricted to teams.manage in the UI contract', () => {
  assert.match(uiSource, /teams\.manage/);
  assert.match(uiSource, /atlasHasPermission/);
});
