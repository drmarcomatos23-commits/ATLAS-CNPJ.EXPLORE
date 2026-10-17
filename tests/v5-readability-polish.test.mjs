import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('V5 centraliza escala tipografica e melhora hierarquia global', () => {
  const css = read('atlas-v5.css');
  for (const token of [
    '--v5-font-xs:10px',
    '--v5-font-sm:11px',
    '--v5-font-md:12px',
    '--v5-font-lg:14px'
  ]) assert.ok(css.includes(token), token);
  assert.match(css, /\.page-head\s*\{[^}]*gap:/s);
  assert.match(css, /\.page-head h1\s*\{[^}]*font-size:26px/s);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:/s);
  assert.match(css, /\.btn\s*\{[^}]*min-height:36px/s);
});

test('Dashboard V5 usa tipografia operacional legivel', () => {
  const css = read('dashboard-v5.css');
  assert.match(css, /\.v4-ops-table th\s*\{[^}]*font-size:var\(--v5-font-xs\)/s);
  assert.match(css, /\.v4-ops-table td\s*\{[^}]*font-size:var\(--v5-font-sm\)/s);
  assert.match(css, /\.v4-section-head h2\s*\{[^}]*font-size:16px/s);
});

test('Processos V5 aumenta legibilidade e preserva densidade', () => {
  const css = read('operations-v5.css');
  assert.match(css, /\.v4-process-row\s*\{[^}]*font-size:var\(--v5-font-sm\)/s);
  assert.match(css, /\.v4-process-head\s*\{[^}]*font-size:var\(--v5-font-xs\)/s);
  assert.match(css, /\.v4-pipe-col article>strong\s*\{[^}]*font-size:var\(--v5-font-md\)/s);
});

test('Empresa 360 V5 melhora leitura e alvos de interacao', () => {
  const css = read('company-360-v5.css');
  assert.match(css, /\.company-360-open\s*\{[^}]*min-height:36px/s);
  assert.match(css, /\.company-360-facts dd\s*\{[^}]*font-size:var\(--v5-font-sm\)/s);
  assert.match(css, /\.company-360-table-wrap td\s*\{[^}]*font-size:var\(--v5-font-sm\)/s);
});
