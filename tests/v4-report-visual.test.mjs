import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('report-emission-v4.js','utf8');

test('relatorio de processos traz resumo executivo e status em badges',()=>{
  assert.match(src,/processSummary/);
  assert.match(src,/Total de processos/);
  assert.match(src,/Em andamento/);
  assert.match(src,/Concluídos/);
  assert.match(src,/Vencidos/);
  assert.match(src,/report-status/);
});

test('visual de impressão é institucional e otimizado para A4',()=>{
  assert.match(src,/@page\s*\{/);
  assert.match(src,/size:\s*A4/);
  assert.match(src,/thead\s*\{\s*display:\s*table-header-group/);
  assert.match(src,/break-inside:\s*avoid/);
  assert.match(src,/report-toolbar/);
  assert.match(src,/report-meta-card/);
  assert.match(src,/tbody\s+tr:nth-child\(even\)/);
});

test('financeiro e honorarios usam orientação paisagem',()=>{
  assert.match(src,/landscape/);
  assert.match(src,/composition==='finance'/);
  assert.match(src,/composition==='honorarios'/);
});