import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const atlasCss = await readFile(new URL('../atlas-v5.css', import.meta.url), 'utf8');
const accordionJs = await readFile(new URL('../sidebar-accordion-v4.js', import.meta.url), 'utf8');
const sw = await readFile(new URL('../sw-v5-1.js', import.meta.url), 'utf8');
const pwa = await readFile(new URL('../pwa-v5-1.js', import.meta.url), 'utf8');

test('assets críticos da busca e sidebar usam revisão V5.1.2 para invalidar cache antigo', () => {
  assert.match(indexHtml, /command-center-v4\.js\?v=5\.1\.2/);
  assert.match(indexHtml, /sidebar-accordion-v4\.js\?v=5\.1\.2/);
  assert.match(indexHtml, /atlas-v5\.css\?v=5\.1\.2/);
  assert.match(pwa, /sw-v5-1\.js\?v=5\.1\.2/);
  assert.match(sw, /atlas-legalizacao-v5\.1-static-2/);
});

test('chaves de setorização da sidebar usam espaçamento compacto', () => {
  assert.match(atlasCss, /\.nav-group-title\s*\{[\s\S]*?margin:8px 8px 2px!important/);
  assert.match(accordionJs, /\.nav-accordion-group\{display:block;margin:0 0 1px\}/);
});

test('busca expõe carregamento assíncrono para validar que o índice aguarda os dados', async () => {
  globalThis.window = globalThis;
  globalThis.document = {};
  globalThis.loadOperationalData = async () => ({
    clients: [{ id: 'c1', legal_name: 'Reliance Agenciamento e Serviços Portuários Ltda', tax_id: '12345678000190', city: 'Santos', state: 'SP' }],
    processes: [], licenses: [], documents: [], costs: []
  });
  await import(`../command-center-v4.js?regression=${Date.now()}`);
  const search = globalThis.AtlasV4Search;
  assert.equal(typeof search.ensureData, 'function');
  await search.ensureData(true);
  assert.equal(search.search('reliance').some(item => item.type === 'empresa'), true);
});
