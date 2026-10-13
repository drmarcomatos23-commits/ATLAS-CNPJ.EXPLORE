import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync('index.html', 'utf8');
const css = readFileSync('atlas-v5.css', 'utf8');

test('rodapé premium da sidebar usa ícone, identidade e badge de preview', () => {
  assert.match(index, /class="sidebar-footer-brand"/);
  assert.match(index, /class="sidebar-footer-icon"[^>]+atlas-pwa-icon\.svg/);
  assert.match(index, /class="sidebar-footer-copy"/);
  assert.match(index, /class="sidebar-footer-title">ATLAS</);
  assert.match(index, /class="sidebar-footer-subtitle">Legalização e Gerenciamento</);
  assert.match(index, /class="sidebar-footer-badge"/);
  assert.match(index, /class="sidebar-footer-status-dot"/);
  assert.match(index, />Preview 5\.1</);
});

test('rodapé premium permanece integrado à sidebar sem card isolado', () => {
  assert.match(css, /\.sidebar-footer\{[\s\S]*background:transparent!important/);
  assert.match(css, /\.sidebar-footer-brand\{[\s\S]*display:flex!important/);
  assert.match(css, /\.sidebar-footer-icon\{[\s\S]*width:28px!important/);
  assert.match(css, /\.sidebar-footer-badge\{[\s\S]*border-radius:999px!important/);
  assert.match(css, /\.sidebar-footer-status-dot\{[\s\S]*border-radius:50%!important/);
  assert.doesNotMatch(css, /\.sidebar-footer\{[\s\S]{0,500}box-shadow:/);
});
