import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../company-360-v5.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../company-360-v5.css', import.meta.url), 'utf8');

test('company 360 extension is wired without replacing base company modules', () => {
  assert.match(index, /company-360-v5\.css\?v=5\.0/);
  assert.match(index, /company-360-v5\.js\?v=5\.0/);
  assert.match(js, /const\s+previousClientPage\s*=\s*window\.clientPage/);
  assert.match(js, /window\.clientPage\s*=\s*async\s*function/);
});

test('company 360 consolidates the operational data domains', () => {
  for (const table of ['clients','client_partners','processes','licenses','costs','documents']) {
    assert.ok(js.includes(`from('${table}')`), `expected query for ${table}`);
  }
});

test('company 360 redecorates rows when group filters rebuild the company table', () => {
  assert.match(js, /new\s+MutationObserver/);
  assert.match(js, /observer\.observe\(view,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
});

test('company 360 has sectioned responsive presentation', () => {
  assert.match(css, /\.company-360-grid/);
  assert.match(css, /\.company-360-section/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
});
