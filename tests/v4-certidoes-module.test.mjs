import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('bootstrap integra o modulo Certidoes ao ATLAS',()=>{
  const guard=fs.readFileSync('dashboard-brand-guard-v4.js','utf8');
  assert.match(guard,/data-page="certidoes"/);
  assert.match(guard,/certificates-v4\.css/);
  assert.match(guard,/certificates-v4\.js/);
  assert.match(guard,/>Certidões</);
});

test('modulo possui matriz e controles operacionais',()=>{
  const js=fs.readFileSync('certificates-v4.js','utf8');
  for(const token of ['federal','fgts','cndt','estadual','municipal']) assert.ok(js.includes(token));
  assert.match(js,/Atualizar todas/);
  assert.match(js,/Consultar agora/);
  assert.match(js,/30, 15 e 7/);
  assert.match(js,/atlas_certificates/);
});

test('API distingue automacao oficial de consulta assistida',()=>{
  const api=fs.readFileSync('api/certificates.js','utf8');
  assert.match(api,/SERPRO_CND_CLIENT_ID/);
  assert.match(api,/requires_configuration/);
  assert.match(api,/assisted/);
  assert.match(api,/fgts/);
  assert.match(api,/cndt/);
  assert.match(api,/estadual/);
  assert.match(api,/municipal/);
});
