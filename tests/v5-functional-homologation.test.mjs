import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

const index = read('index.html');
const permissions = read('role-permissions.js');
const company = read('company-registration.js');
const finance = read('financial-costs.js');
const licenses = read('license-compliance.js');
const cartilha = read('process-cartilha.js');
const company360 = read('company-360-v5.js');
const completionGuard = read('process-completion-guard-v5.js');
const reports = read('report-emission.js');

test('homologacao V5 preserva matriz de perfis e protege acoes criticas', () => {
  for (const key of [
    'processes.view','processes.create','processes.edit','processes.archive',
    'companies.view','companies.create','companies.edit','companies.archive',
    'documents.view','documents.upload','documents.delete',
    'costs.view','costs.edit','licenses.view','licenses.edit','reports.view',
    'users.view','users.manage'
  ]) assert.ok(permissions.includes(key), `permissao ausente: ${key}`);

  assert.match(permissions, /currentRole\(\)==='admin'\s*\|\|\s*currentPermissions\.has\(key\)/);
  assert.match(permissions, /setTaxaPaga[^]*costs\.edit/);
  assert.match(permissions, /openCompanyLicenses[^]*licenses\.edit/);
});

test('homologacao V5 cadastro de empresa consulta CNPJ, endereco e socios sem apagar campos manuais', () => {
  assert.match(company, /fetch\('\/api\/cnpj\?cnpj='/);
  assert.match(company, /atlas:cnpj-partners-loaded/);
  assert.match(company, /client-street/);
  assert.match(company, /client-address-number/);
  assert.match(company, /client-address-complement/);
  assert.match(company, /client-neighborhood/);
  assert.match(company, /client-city/);
  assert.match(company, /client-state/);
  assert.match(company, /Preenchimento manual quando não disponível/);
});

test('homologacao V5 conclusao de processo permanece autoritativa no banco', () => {
  assert.match(completionGuard, /const cleanPayload = \(payload\) =>/);
  assert.match(completionGuard, /delete\s+clean\.completed_at/);
  assert.match(completionGuard, /payload\.map\(cleanPayload\)/);
  assert.match(completionGuard, /cleanPayload\(payload\)/);
  assert.match(index, /process-completion-guard-v5\.js\?v=5\.0/);
});

test('homologacao V5 financeiro registra pagamento com data e restringe PAGO a admin ou financeiro', () => {
  assert.match(finance, /window\.setTaxaPaga=async function/);
  assert.match(finance, /\['admin','financeiro'\]\.includes\(role\)/);
  assert.match(finance, /payment_status:'paid',paid_at:paidAt/);
  assert.match(finance, /atlas:financial-payment-updated/);
  assert.match(finance, /window\.setHonorarioRecebido=async function/);
});

test('homologacao V5 licencas cobre quatro tipos, alertas 30 60 90 dias e realtime', () => {
  for (const kind of ['AVCB','ALVARÁ DE FUNCIONAMENTO','LICENÇA SANITÁRIA','ANVISA']) {
    assert.ok(licenses.includes(kind), `tipo de licenca ausente: ${kind}`);
  }
  assert.match(licenses, /days<=30/);
  assert.match(licenses, /days<=60/);
  assert.match(licenses, /days<=90/);
  assert.match(licenses, /renewal_lead_days:\[90,60,30\]/);
  assert.match(licenses, /postgres_changes[^]*table:'licenses'/);
});

test('homologacao V5 Empresa 360 consolida dominios operacionais essenciais', () => {
  for (const table of ['clients','client_partners','processes','licenses','costs','documents']) {
    assert.match(company360, new RegExp(`from\\('${table}'\\)`), `Empresa 360 nao consulta ${table}`);
  }
  assert.match(company360, /tax_id/);
  assert.match(company360, /legal_name/);
});

test('homologacao V5 cartilha exige processo concluido, usa data de emissao e timbrado OEA', () => {
  assert.match(cartilha, /proc\.status!=='completed'/);
  assert.match(cartilha, /var d=new Date\(\)/);
  assert.match(cartilha, /oea-cartilha-logo\.png/);
  assert.match(cartilha, /client_partners/);
});

test('homologacao V5 relatorios permanecem roteados e sujeitos a permissao', () => {
  assert.match(index, /report-emission\.js\?v=3\.59/);
  assert.match(index, /dashboard-brand-guard-v4\.js\?v=4\.2/);
  assert.match(permissions, /relatorios:'reports\.view'/);
  assert.match(reports, /window\.emitAtlasReport=emitReport/);
  for (const mode of ['processes','finance','general','honorarios']) assert.ok(reports.includes(`value="${mode}"`));
});
