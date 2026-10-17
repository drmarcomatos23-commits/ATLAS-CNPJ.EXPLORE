import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const adapter = fs.readFileSync('atlas-real-data-v7.js','utf8');
const loader = fs.readFileSync('pwa-v5-1.js','utf8');

test('real-data adapter is loaded without changing the production shell contract', () => {
  assert.match(loader, /atlas-real-data-v7\.js\?v=7\.0/);
  assert.match(loader, /data-atlas-real-data-v7|dataset\.atlasRealDataV7/);
  assert.match(adapter, /window\.AtlasRealDataV7/);
});

test('adapter uses real documents and removes archived companies/processes from dashboard data', () => {
  assert.match(adapter, /db\.from\('documents'\)\.select\('\*'\)/);
  assert.match(adapter, /filter\(client=>!client\?\.deleted_at\)/);
  assert.match(adapter, /filter\(process=>!process\?\.deleted_at\)/);
  assert.match(adapter, /documents,/);
  assert.match(adapter, /pending:Array\.isArray\(raw\.pending\)\?raw\.pending:\[\]/);
});

test('adapter recognizes real fee fields and nested CNPJ legal nature', () => {
  assert.match(adapter, /fee_kind/);
  assert.match(adapter, /cost_type/);
  assert.match(adapter, /metadata\?\.cnpj_sync\?\.legal_nature/);
  assert.match(adapter, /Não informado/);
  assert.match(adapter, /Empresário Individual/);
});

test('real workflow stages map into the six approved dashboard buckets', () => {
  assert.match(adapter, /registro/);
  assert.match(adapter, /inscri/);
  assert.match(adapter, /conclu/);
  assert.match(adapter, /Junta Comercial/);
  assert.match(adapter, /Alvará Municipal/);
  assert.match(adapter, /Pós-abertura \/ Regularização/);
});

test('active process KPI is calculated from every non-closed real process', () => {
  assert.match(adapter, /function activeProcessCount/);
  assert.match(adapter, /!isClosedProcess\(process\)/);
  assert.match(adapter, /model\.kpis\.activeProcesses=activeCount/);
});

test('fixed illustrative trend percentages are replaced with factual labels', () => {
  assert.match(adapter, /'Empresas':'Base atual'/);
  assert.match(adapter, /'Processos em andamento':'Ativos agora'/);
  assert.match(adapter, /'Licenças vencendo':'Próximos 30 dias'/);
  assert.match(adapter, /'Honorários \(mês\)':'Competência do mês'/);
  assert.match(adapter, /'Documentos':'Arquivos cadastrados'/);
});
