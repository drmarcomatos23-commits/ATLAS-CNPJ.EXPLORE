import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const completion = readFileSync(new URL('../completion-date-v4.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('completion-date waits for authenticated ATLAS session before querying processes', () => {
  assert.match(completion, /async function refreshWhenAuthenticated\s*\(/);
  assert.match(completion, /atlasAuth\?\.getProfile\?\.\(\)/);
  assert.match(completion, /atlasAuth\?\.client/);
  const domReady = completion.match(/document\.addEventListener\('DOMContentLoaded',[\s\S]*?\n\s*\}\);/i)?.[0] || '';
  assert.match(domReady, /refreshWhenAuthenticated\(\)/);
  assert.doesNotMatch(domReady, /\brefreshCompletionDates\(\)\s*;/);
});

test('ATLAS 7.1 scripts load after auth and permissions in deterministic order', () => {
  const rolePermissions = index.indexOf('/role-permissions.js?v=3.58');
  const sla = index.indexOf('/atlas-ops-v7-sla.js?v=7.1');
  const data = index.indexOf('/atlas-ops-v7-data.js?v=7.1');
  const engine = index.indexOf('/atlas-ops-v7-engine.js?v=7.1');
  const ui = index.indexOf('/atlas-ops-v7-ui.js?v=7.1');
  assert.ok(rolePermissions >= 0, 'role-permissions loader must exist');
  assert.ok(sla > rolePermissions, 'SLA module must load after role permissions');
  assert.ok(data > sla, 'data module must load after SLA module');
  assert.ok(engine > data, 'engine module must load after data module');
  assert.ok(ui > engine, 'UI module must load after engine module');
});
