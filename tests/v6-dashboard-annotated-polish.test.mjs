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
