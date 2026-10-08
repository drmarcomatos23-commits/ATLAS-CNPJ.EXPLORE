import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('relatorios substituem a marca antiga pela nova marca final',()=>{
  const patch=fs.readFileSync('report-brand-patch-v4.js','utf8');
  assert.match(patch,/atlas-brand-final\.svg\?v=4\.0/);
  assert.match(patch,/logo-atlas-legalizacao\.png/);
  assert.match(patch,/emitAtlasReportV4/);
  assert.match(patch,/window\.open/);
  assert.match(patch,/width:190px;height:64px/);
});

test('guard carrega o patch somente depois do gerador de relatorios',()=>{
  const guard=fs.readFileSync('dashboard-brand-guard-v4.js','utf8');
  assert.match(guard,/report-brand-patch-v4\.js\?v=4\.0/);
  assert.match(guard,/addEventListener\('load', ensureReportBrandPatchV4/);
});
