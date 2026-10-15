import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cssUrl = new URL('../mobile-v6.css', import.meta.url);

test('mobile-v6 is the final presentation layer', () => {
  assert.equal(existsSync(cssUrl), true, 'mobile-v6.css must exist');
  const links=[...index.matchAll(/<link[^>]+href="([^"]+\.css[^\"]*)"/g)].map(m=>m[1]);
  assert.equal(links.at(-1), '/mobile-v6.css?v=6.0');
  assert.ok(links.indexOf('/mobile-v6.css?v=6.0') > links.indexOf('/atlas-v6.css?v=6.0'));
});

test('mobile-v6 has the approved breakpoints and iOS-safe form sizing', () => {
  const css = readFileSync(cssUrl, 'utf8');
  for (const bp of ['1180px','1024px','760px','480px']) assert.ok(css.includes(bp), `missing breakpoint ${bp}`);
  assert.match(css, /font-size:\s*16px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /env\(safe-area-inset-top\)/);
});

test('mobile-v6 prevents shell and dashboard horizontal overflow', () => {
  const css = readFileSync(cssUrl, 'utf8');
  assert.match(css, /html[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /\.workspace[\s\S]*max-width:\s*100vw/);
  assert.match(css, /\.v6-dashboard[\s\S]*max-width:\s*100vw/);
});

test('mobile-v6 explicitly stabilizes drawer, tables, pipeline, forms, modals and action bars', () => {
  const css = readFileSync(cssUrl, 'utf8');
  for (const token of ['.sidebar','.table-wrap','.v6-pipeline-track','.field','.atlas-modal','.actions-bar']) {
    assert.ok(css.includes(token), `missing mobile treatment for ${token}`);
  }
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /position:\s*static/);
});
