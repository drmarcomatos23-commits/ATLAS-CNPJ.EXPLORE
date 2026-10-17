import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cssUrl = new URL('../atlas-v6.css', import.meta.url);
const jsUrl = new URL('../atlas-v6-shell.js', import.meta.url);

const primary = [
  ['dashboard', 'Dashboard'],
  ['clientes', 'Empresas'],
  ['processos', 'Processos'],
  ['licencas', 'Licenças'],
  ['documentos', 'Documentos'],
  ['custos', 'Financeiro'],
  ['relatorios', 'Relatórios'],
  ['config', 'Configurações']
];

const secondary = ['exigencias', 'integracoes', 'conhecimento', 'treinamento', 'usuarios'];

test('V6 keeps all primary and secondary navigation hooks with role metadata', () => {
  for (const [page, label] of primary) {
    assert.match(index, new RegExp(`data-page=["']${page}["'][^>]*data-roles=["'][^"']+["']`, 'i'), `${label} must preserve data-roles`);
  }
  for (const page of secondary) {
    assert.match(index, new RegExp(`data-page=["']${page}["'][^>]*data-roles=["'][^"']+["']`, 'i'), `${page} must remain role-aware`);
  }
});

test('V6 shell assets implement approved shell geometry and visual states', () => {
  assert.equal(existsSync(cssUrl), true, 'atlas-v6.css must exist');
  assert.equal(existsSync(jsUrl), true, 'atlas-v6-shell.js must exist');
  const css = readFileSync(cssUrl, 'utf8');
  assert.match(css, /--v6-sidebar-width:\s*300px/);
  assert.match(css, /--v6-topbar-height:\s*74px/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /\.nav-item\.active[\s\S]*border-left[^;]*var\(--v6-orange\)/);
  assert.match(css, /\.nav-item\.active[\s\S]*background[^;]*var\(--v6-blue\)/);
});

test('V6 shell exposes syncUserChrome without changing navigation contracts', () => {
  const js = readFileSync(jsUrl, 'utf8');
  assert.match(js, /window\.AtlasV6Shell/);
  assert.match(js, /syncUserChrome/);
  assert.match(js, /data-page/);
  assert.doesNotMatch(js, /removeAttribute\(['"]data-roles['"]\)/);
});

test('V6 search copy matches the approved mockup exactly', () => {
  assert.match(index, /placeholder=["']Buscar empresas, processos, documentos\.\.\.["']/);
});
