import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../dashboard-v5.css', import.meta.url), 'utf8');

test('dashboard V5 stylesheet loads after V4 dashboard and before global V5 shell', () => {
  const v4 = index.indexOf('/dashboard-v4.css?v=4.0');
  const v5 = index.indexOf('/dashboard-v5.css?v=5.0');
  const shell = index.indexOf('/atlas-v5.css?v=5.0');
  assert.ok(v4 >= 0 && v5 > v4, 'dashboard V5 must load after V4 dashboard');
  assert.ok(shell > v5, 'global V5 shell must remain last among dashboard layers');
});

test('dashboard V5 defines progressive KPI breakpoints', () => {
  assert.match(css, /grid-template-columns:\s*repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*1400px\)/);
  assert.match(css, /repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*520px\)/);
  assert.match(css, /grid-template-columns:\s*1fr/);
});

test('dashboard V5 keeps dense tables and elevated cards', () => {
  assert.match(css, /\.v4-card[\s\S]*border-radius:/);
  assert.match(css, /\.v4-ops-table th[\s\S]*position:\s*sticky/);
});
