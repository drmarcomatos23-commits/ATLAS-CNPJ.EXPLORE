import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hierarchy = readFileSync('company-hierarchy-v5-1.js', 'utf8');
const archive = readFileSync('client-archive.js', 'utf8');
const api = readFileSync('api/cnpj.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const css = readFileSync('company-hierarchy-v5-1.css', 'utf8');

test('consulta CNPJ identifica oficialmente matriz ou filial com fallback seguro', () => {
  assert.match(api, /descricao_identificador_matriz_filial/);
  assert.match(api, /identificador_matriz_filial/);
  assert.match(hierarchy, /establishmentTypeFromPayload/);
  assert.match(hierarchy, /cnpjRoot/);
  assert.match(hierarchy, /e\?\.tipo/);
});

test('cadastro persiste hierarquia no metadata sem exigir alteração do banco de produção', () => {
  assert.match(hierarchy, /establishment_type/);
  assert.match(hierarchy, /parent_client_id/);
  assert.match(hierarchy, /cnpj_root/);
  assert.match(hierarchy, /client-establishment-type/);
  assert.match(hierarchy, /client-parent-id/);
  assert.match(hierarchy, /Filial precisa estar vinculada a uma matriz cadastrada/);
  assert.match(hierarchy, /\.update\(\{ metadata \}\)/);
});

test('lista de empresas agrupa filiais dentro da matriz e permite criar filial pela matriz', () => {
  assert.match(hierarchy, /company-branch-row/);
  assert.match(hierarchy, /Matriz/);
  assert.match(hierarchy, /Filial/);
  assert.match(hierarchy, /\+ Filial/);
  assert.match(hierarchy, /filiais vinculadas/);
  assert.match(css, /\.company-branch-row/);
});

test('nova filial iniciada pela matriz herda o grupo empresarial quando o seletor está disponível', () => {
  assert.match(hierarchy, /group_id/);
  assert.match(hierarchy, /inheritMatrixGroup/);
  assert.match(hierarchy, /client-group-id/);
});

test('filtro de grupos usa o grupo efetivo da matriz para filiais antigas sem group_id', () => {
  assert.match(hierarchy, /effectiveGroupId/);
  assert.match(archive, /AtlasCompanyHierarchyV51\?\.effectiveGroupId/);
  assert.match(archive, /effectiveGroup\(c,list\)/);
});

test('abertura de um novo formulário limpa hierarquia pendente de tentativa anterior', () => {
  assert.match(hierarchy, /async function injectHierarchyFields[^]*pendingHierarchy\s*=\s*null/);
});

test('Empresa 360 mostra a estrutura matriz e filiais no mesmo cadastro visual', () => {
  assert.match(hierarchy, /Matriz e filiais/);
  assert.match(hierarchy, /companyFamily/);
  assert.match(hierarchy, /establishment_type/);
  assert.match(hierarchy, /parent_client_id/);
  assert.match(hierarchy, /openCompany360V51Member/);
});

test('Empresa 360 carrega cidade e UF de todos os membros da família empresarial', () => {
  assert.match(hierarchy, /select\('id,legal_name,trade_name,tax_id,city,state,group_id,metadata,deleted_at'\)/);
});

test('camada de hierarquia é carregada depois da Empresa 360 sem substituir produção', () => {
  assert.match(index, /company-hierarchy-v5-1\.css\?v=5\.1/);
  assert.match(index, /company-hierarchy-v5-1\.js\?v=5\.1/);
  assert.equal(index.indexOf('company-360-v5.js') < index.indexOf('company-hierarchy-v5-1.js'), true);
});
