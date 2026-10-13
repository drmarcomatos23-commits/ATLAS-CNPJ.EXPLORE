import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const index = readFileSync('index.html', 'utf8');

test('V5.1 carrega camada isolada de iconografia e compactacao', () => {
  assert.equal(existsSync('iconography-v5-1.js'), true);
  assert.equal(existsSync('iconography-v5-1.css'), true);
  assert.match(index, /iconography-v5-1\.css\?v=5\.1/);
  assert.match(index, /iconography-v5-1\.js\?v=5\.1/);
});

test('iconografia substitui glifos do menu por SVGs de traço consistente', () => {
  const source = existsSync('iconography-v5-1.js') ? readFileSync('iconography-v5-1.js', 'utf8') : '';
  for (const key of ['dashboard','processos','clientes','licencas','exigencias','documentos','integracoes','custos','relatorios','conhecimento','treinamento','usuarios','config']) {
    assert.match(source, new RegExp(`${key}:`));
  }
  assert.match(source, /<svg/);
  assert.match(source, /stroke="currentColor"/);
  assert.match(source, /stroke-width="1\.8"/);
  assert.match(source, /querySelectorAll\(['"]\.nav-item\[data-page\]['"]\)/);
});

test('KPIs usam os mesmos SVGs profissionais do sistema', () => {
  const dashboard = readFileSync('dashboard-v4.js', 'utf8');
  assert.match(dashboard, /AtlasV51Icons/);
  assert.match(dashboard, /folder-open/);
  assert.match(dashboard, /triangle-alert/);
  assert.match(dashboard, /messages-square/);
  assert.match(dashboard, /badge-check/);
  assert.match(dashboard, /wallet/);
  assert.match(dashboard, /receipt/);
});

test('sidebar reduz espacos entre grupos sem comprometer alvos de clique', () => {
  const css = existsSync('iconography-v5-1.css') ? readFileSync('iconography-v5-1.css', 'utf8') : '';
  assert.match(css, /\.nav-list\s*\{[^}]*gap:\s*0/i);
  assert.match(css, /\.nav-accordion-group\s*\{[^}]*margin:\s*0 0 2px/i);
  assert.match(css, /\.nav-group-toggle\s*\{[^}]*min-height:\s*24px/i);
  assert.match(css, /\.nav-group-items\s*\{[^}]*gap:\s*2px/i);
  assert.match(css, /\.sidebar \.nav-item\s*\{[^}]*min-height:\s*34px/i);
  assert.match(css, /\.nav-ico svg\s*\{[^}]*width:\s*16px/i);
});
