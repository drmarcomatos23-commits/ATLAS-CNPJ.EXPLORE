import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.existsSync('atlas-dashboard-polish.css') ? fs.readFileSync('atlas-dashboard-polish.css','utf8') : '';
const runtime = fs.readFileSync('atlas-reference-runtime.js','utf8');

test('desktop sidebar is a continuous compact list instead of distributed groups', () => {
  assert.match(css, /#app-shell \.nav-list\{[\s\S]*?display:block!important/i);
  assert.match(css, /#app-shell \.v6-nav-group\{[\s\S]*?display:block!important[\s\S]*?margin:0!important/i);
});

test('dashboard building artwork continues behind the dashboard content', () => {
  assert.match(css, /\.atlas-final-dashboard::before\{[\s\S]*?atlas-legalizacao-hero-v6\.svg/i);
  assert.match(css, /opacity:\s*\.0[6-9]/i);
});

test('bottom cards use aligned presentation and readable status distribution', () => {
  assert.match(css, /\.atlas-bottom-grid\{[\s\S]*?align-items:stretch/i);
  assert.match(css, /\.atlas-status-body\{[\s\S]*?min-height:/i);
  assert.match(css, /\.atlas-bottom-grid>\.atlas-card\{[\s\S]*?min-height:/i);
});

test('company types fallback is used when real distribution is only Outros', () => {
  assert.match(runtime, /TYPE_FALLBACK/);
  assert.match(runtime, /normalizeTypeRows/);
  assert.match(runtime, /onlyOutros/);
});

test('sidebar is reordered to the approved dashboard sequence', () => {
  assert.match(runtime, /SIDEBAR_ORDER/);
  assert.ok(runtime.includes("'dashboard','clientes','processos','licencas','documentos','custos','relatorios','config'"));
});

test('desktop-like 1024-1180 viewport keeps sidebar visible and workspace offset', () => {
  assert.match(css, /@media\s*\(min-width:1024px\)\s*and\s*\(max-width:1180px\)/i);
  assert.match(css, /#app-shell \.sidebar\{[\s\S]*?transform:none!important/i);
  assert.match(css, /#app-shell \.workspace\{[\s\S]*?margin-left:185px!important/i);
  assert.match(css, /#app-shell \.mobile-menu-btn\{[\s\S]*?display:none!important/i);
});

test('chartjs company type canvas is isolated from legacy grid positioning', () => {
  assert.match(css, /\.atlas-bars>\.atlas-chart-canvas\.bars\{[\s\S]*?display:block!important/i);
  assert.match(css, /\.atlas-bars>\.atlas-chart-canvas\.bars\{[\s\S]*?grid-template-rows:none!important/i);
  assert.match(css, /\.atlas-chart-canvas\.bars canvas\{[\s\S]*?position:static!important/i);
});
