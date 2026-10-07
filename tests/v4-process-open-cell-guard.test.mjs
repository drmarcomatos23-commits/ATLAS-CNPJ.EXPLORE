import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('adiciona botão Abrir também na coluna Processo',()=>{
  const js=fs.readFileSync('dashboard-brand-guard-v4.js','utf8');
  assert.match(js,/syncProcessOpenButtons/);
  assert.match(js,/v4-process-cell-open/);
  assert.match(js,/\.v4-row-actions \.mini-btn/);
  assert.match(js,/cloneNode\(true\)/);
});
