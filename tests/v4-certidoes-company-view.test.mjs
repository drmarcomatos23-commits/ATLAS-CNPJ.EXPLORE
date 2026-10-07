import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('certidoes aparecem agrupadas por empresa e detalhes abrem sob demanda',()=>{
  const js=fs.readFileSync('certificates-v4.js','utf8');
  assert.match(js,/cert-company-card/);
  assert.match(js,/data-cert-company-open/);
  assert.match(js,/cert-company-details/);
  assert.doesNotMatch(js,/<th>Fonte<\/th>/);
  assert.doesNotMatch(js,/data-label="Fonte"/);
});

test('consulta deixa claro quando e assistida ou exige configuracao',()=>{
  const js=fs.readFileSync('certificates-v4.js','utf8');
  assert.match(js,/requires_configuration/);
  assert.match(js,/assisted/);
  assert.match(js,/Abrir consulta oficial/);
  assert.match(js,/Consulta automática indisponível/);
});
