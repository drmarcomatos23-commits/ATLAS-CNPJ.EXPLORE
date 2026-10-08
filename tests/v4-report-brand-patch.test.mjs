import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('relatorios usam OEA e removem ATLAS do conteudo visivel',()=>{
  const patch=fs.readFileSync('report-brand-patch-v4.js','utf8');
  assert.match(patch,/oea-report-logo\.png\?v=1\.0/);
  assert.match(patch,/OEA · ORGANIZAÇÃO EXCELÊNCIA ASSESSORIA/);
  assert.match(patch,/Relatório Gerencial/);
  assert.match(patch,/Relatório Institucional/);
  assert.match(patch,/replaceAll\('ATLAS Legalização e Gerenciamento'/);
  assert.match(patch,/replaceAll\('Relatório ATLAS'/);
  assert.match(patch,/width:92px;height:68px/);
});

test('guard carrega a versão atualizada do patch de marca',()=>{
  const guard=fs.readFileSync('dashboard-brand-guard-v4.js','utf8');
  assert.match(guard,/report-brand-patch-v4\.js\?v=4\.2/);
  assert.match(guard,/addEventListener\('load', ensureReportBrandPatchV4/);
});
