import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const context = readFileSync('establishment-context-v5-1.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const pwa = readFileSync('pwa-v5-1.js', 'utf8');

test('contexto operacional expõe rótulos consistentes de matriz e filial', () => {
  assert.match(context, /AtlasEstablishmentContextV51/);
  assert.match(context, /establishmentNumber/);
  assert.match(context, /contextForClient/);
  assert.match(context, /labelForClient/);
  assert.match(context, /Filial/);
  assert.match(context, /Matriz/);
});

test('processos e seletores mostram o estabelecimento correto', () => {
  assert.match(context, /proc-client/);
  assert.match(context, /process-table-desktop/);
  assert.match(context, /process-mobile-company/);
  assert.match(context, /task-card\.real-task/);
});

test('documentos e financeiro identificam matriz ou filial pelo cliente do processo', () => {
  assert.match(context, /doc-client/);
  assert.match(context, /doc-process/);
  assert.match(context, /decorateDocumentsPage/);
  assert.match(context, /decorateFinancePage/);
  assert.match(context, /public_code/);
});

test('licenças e relatórios exibem contexto do estabelecimento', () => {
  assert.match(context, /decorateLicensesPage/);
  assert.match(context, /license-expiry-row/);
  assert.match(context, /decorateReportsPage/);
  assert.match(context, /Concluídos recentemente/);
});

test('busca global acrescenta matriz ou filial sem substituir o mecanismo existente', () => {
  assert.match(context, /v4-command-results/);
  assert.match(context, /decorateGlobalSearch/);
  assert.match(context, /MutationObserver/);
});

test('camada de contexto é inicializada depois da hierarquia V5.1', () => {
  assert.match(pwa, /establishment-context-v5-1\.js\?v=5\.1/);
  assert.match(pwa, /loadEstablishmentContext/);
  assert.equal(index.indexOf('company-hierarchy-v5-1.js') < index.indexOf('pwa-v5-1.js'), true);
});
