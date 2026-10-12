import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('dashboard-v4.js', 'utf8');
const css = readFileSync('dashboard-v5.css', 'utf8');

test('Central de Pendências V5.1 torna as cinco categorias clicáveis', () => {
  assert.match(dashboard, /data-pending-kind="\$\{kind\}"/);
  for (const kind of ['cliente', 'financeiro', 'equipe', 'licencas', 'orgao']) {
    assert.match(dashboard, new RegExp(`item\\(['"]${kind}['"]`));
  }
  assert.match(dashboard, /openAtlasV51Pending/);
  assert.match(dashboard, /pendingRecords/);
});

test('Detalhe de pendência direciona ao processo ou à Empresa 360', () => {
  assert.match(dashboard, /openAtlasV4Process/);
  assert.match(dashboard, /openCompany360V5/);
  assert.match(dashboard, /openAtlasV51PendingTarget/);
  assert.match(dashboard, /Central de Pendências/);
});

test('Cards clicáveis preservam aparência e foco acessível na V5.1', () => {
  assert.match(css, /\.v4-pending-grid>button/);
  assert.match(css, /\.v4-pending-item:focus-visible/);
  assert.match(css, /cursor:pointer/);
});
