import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('relatorios usam OEA e removem ATLAS do conteudo visivel',()=>{
  const patch=fs.readFileSync('report-brand-patch-v4.js','utf8');
  assert.match(patch,/assets\/oea-cartilha-logo\.png\?v=1\.2/);
  assert.doesNotMatch(patch,/oea-report-logo-correct\.png/);
  assert.match(patch,/OEA · ORGANIZAÇÃO EXCELÊNCIA ASSESSORIA/);
  assert.match(patch,/Relatório Gerencial/);
  assert.match(patch,/Relatório Institucional/);
  assert.match(patch,/replaceAll\('ATLAS Legalização e Gerenciamento'/);
  assert.match(patch,/replaceAll\('Relatório ATLAS'/);
  assert.match(patch,/width:108px;height:80px/);
  assert.match(patch,/object-position:center center/);
});

test('patch intercepta qualquer popup do gerador de relatorios',()=>{
  const patch=fs.readFileSync('report-brand-patch-v4.js','utf8');
  assert.match(patch,/window\.open = function/);
  assert.match(patch,/window\.__oeaReportWindowOpenPatchedV4/);
  assert.match(patch,/patchPopupDocument\(nativeOpen\(\.\.\.args\)\)/);
});

test('guard carrega a versão atualizada do patch de marca',()=>{
  const guard=fs.readFileSync('dashboard-brand-guard-v4.js','utf8');
  assert.match(guard,/report-brand-patch-v4\.js\?v=4\.6/);
  assert.match(guard,/addEventListener\('load', ensureReportBrandPatchV4/);
});
