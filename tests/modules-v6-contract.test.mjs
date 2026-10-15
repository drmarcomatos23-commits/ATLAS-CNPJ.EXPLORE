import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cssUrl = new URL('../modules-v6.css', import.meta.url);

const pages = ['clientes','processos','licencas','documentos','custos','relatorios','config'];

test('all approved internal modules preserve their existing navigation hooks', () => {
  for (const page of pages) {
    assert.match(index, new RegExp(`data-page=["']${page}["']`), `missing ${page}`);
  }
});

test('modules-v6 is loaded after V5 module presentation and before final V6 shell', () => {
  assert.equal(existsSync(cssUrl), true, 'modules-v6.css must exist');
  const v5 = Math.max(index.indexOf('/operations-v5.css?v=5.0'), index.indexOf('/company-360-v5.css?v=5.0'));
  const modules = index.indexOf('/modules-v6.css?v=6.0');
  const shell = index.indexOf('/atlas-v6.css?v=6.0');
  assert.ok(modules > v5, 'modules-v6 must load after V5 module layers');
  assert.ok(shell > modules, 'atlas-v6 shell must remain after modules-v6');
});

test('V6 module design system covers shared page, card, table, form, filter and modal surfaces', () => {
  const css = readFileSync(cssUrl, 'utf8');
  for (const selector of [
    '.page-head', '.surface', '.table-wrap', 'table', '.field input', '.field select',
    '.filters', '.atlas-modal', '.btn-primary', '.mini-btn'
  ]) assert.ok(css.includes(selector), `missing ${selector}`);
  assert.match(css, /--v6-module-radius:/);
  assert.match(css, /--v6-module-border:/);
});

test('critical business-action hooks remain present in existing production modules', () => {
  const financial = readFileSync(new URL('../process-financial.js', import.meta.url), 'utf8');
  const completion = readFileSync(new URL('../process-completion-guard-v5.js', import.meta.url), 'utf8');
  const registration = readFileSync(new URL('../company-registration.js', import.meta.url), 'utf8');
  const report = readFileSync(new URL('../report-emission.js', import.meta.url), 'utf8');
  assert.match(financial, /PAGO|paid|payment/i);
  assert.match(completion, /reopen|reabr|completed|conclu/i);
  assert.match(registration, /cnpj/i);
  assert.match(registration, /cep/i);
  assert.match(report, /cartilha|relat[oó]rio|report/i);
});
