import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('guard v4 carrega o visual executivo dos relatorios',()=>{
  const src=fs.readFileSync('dashboard-brand-guard-v4.js','utf8');
  assert.match(src,/report-emission-v4\.js\?v=4\.0/);
  assert.match(src,/ensureReportVisualV4/);
});