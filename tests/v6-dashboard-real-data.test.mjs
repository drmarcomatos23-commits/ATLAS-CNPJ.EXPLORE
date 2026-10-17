import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const legalizacao = fs.readFileSync('legalizacao.js','utf8');
const dashboard = fs.readFileSync('dashboard-v6.js','utf8');
const finalDashboard = fs.readFileSync('atlas-reference-final.js','utf8');

test('operational loader includes real documents and excludes archived companies/processes', () => {
  assert.match(legalizacao, /documents:\[\]/);
  assert.match(legalizacao, /db\.from\('documents'\)\.select\('\*'\)/);
  assert.match(legalizacao, /db\.from\('clients'\)\.select\('\*'\)\.is\('deleted_at',null\)/);
  assert.match(legalizacao, /db\.from\('processes'\)\.select\('\*'\)\.is\('deleted_at',null\)/);
  assert.match(legalizacao, /'documents'/);
});

test('dashboard recognizes real fee fields, service type and nested CNPJ legal nature', () => {
  assert.match(dashboard, /fee_kind/);
  assert.match(dashboard, /cost_type/);
  assert.match(dashboard, /service_type/);
  assert.match(dashboard, /cnpj_sync/);
  assert.match(dashboard, /legal_nature/);
  assert.match(dashboard, /Não informado/);
});

test('real workflow stages map into the six approved dashboard buckets', () => {
  assert.match(dashboard, /registro/i);
  assert.match(dashboard, /inscri[cç][oõ]es/i);
  assert.match(dashboard, /conclu[ií]do/i);
});

test('active process KPI stays based on all non-closed processes', () => {
  assert.doesNotMatch(finalDashboard, /model\.kpis\.activeProcesses\s*=/);
});

test('final dashboard contains no illustrative mock values or fixed trend percentages', () => {
  assert.doesNotMatch(finalDashboard, /MOCK_/);
  assert.doesNotMatch(finalDashboard, /useMockOnlyWhenMissing/);
  assert.doesNotMatch(finalDashboard, /\+8%|\+12%|\+33%|\+18%|\+17%|\+21%/);
  assert.match(finalDashboard, /Base atual/);
  assert.match(finalDashboard, /Próximos 30 dias/);
  assert.match(finalDashboard, /Competência do mês/);
});
