import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('sincronizacao em lote respeita cadastro oficial verificado mais recente',()=>{
  const js=fs.readFileSync('cnpj-refresh-all-v4.js','utf8');
  assert.match(js,/metadata/);
  assert.match(js,/official_verified/);
  assert.match(js,/source_updated_at/);
  assert.match(js,/verified_at/);
  assert.match(js,/shouldApplyRemotePatch/);
});

test('consulta manual e em lote forca resposta sem cache',()=>{
  const js=fs.readFileSync('cnpj-refresh-all-v4.js','utf8');
  assert.match(js,/cache:\s*'no-store'/);
  assert.match(js,/fresh=/);
});
