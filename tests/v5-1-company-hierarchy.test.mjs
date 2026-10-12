import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const registration = readFileSync('company-registration.js', 'utf8');
const company360 = readFileSync('company-360-v5.js', 'utf8');
const api = readFileSync('api/cnpj.js', 'utf8');

test('consulta CNPJ identifica oficialmente matriz ou filial com fallback seguro', () => {
  assert.match(api, /descricao_identificador_matriz_filial/);
  assert.match(api, /identificador_matriz_filial/);
  assert.match(registration, /establishmentTypeFromPayload/);
  assert.match(registration, /cnpjRoot/);
  assert.match(registration, /estabelecimento\?\.tipo|e\?\.tipo/);
});

test('cadastro persiste hierarquia no metadata sem exigir alteração do banco de produção', () => {
  assert.match(registration, /establishment_type/);
  assert.match(registration, /parent_client_id/);
  assert.match(registration, /cnpj_root/);
  assert.match(registration, /client-establishment-type/);
  assert.match(registration, /client-parent-id/);
  assert.match(registration, /Filial precisa estar vinculada a uma matriz cadastrada/);
});

test('lista de empresas agrupa filiais dentro da matriz', () => {
  assert.match(registration, /company-branch-row/);
  assert.match(registration, /Matriz/);
  assert.match(registration, /Filial/);
  assert.match(registration, /\+ Filial/);
  assert.match(registration, /filiais/);
});

test('Empresa 360 mostra a estrutura matriz e filiais no mesmo cadastro visual', () => {
  assert.match(company360, /Matriz e filiais/);
  assert.match(company360, /companyFamily/);
  assert.match(company360, /establishment_type/);
  assert.match(company360, /parent_client_id/);
});
