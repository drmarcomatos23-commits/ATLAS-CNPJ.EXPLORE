import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('tema V4 base e camadas V5 sao carregados na ordem correta',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.includes('/atlas-ui-v4.css?v=4.0'));
  assert.ok(html.includes('/atlas-sidebar-v4.css?v=4.2'));
  assert.ok(html.includes('/atlas-v5.css?v=5.0'));
  assert.ok(html.includes('/mobile-v5.css?v=5.0'));
  const links=[...html.matchAll(/<link[^>]+href="([^"]+\.css[^\"]*)"/g)].map(m=>m[1]);
  assert.ok(links.indexOf('/atlas-sidebar-v4.css?v=4.2')<links.indexOf('/atlas-v5.css?v=5.0'));
  assert.equal(links.at(-1),'/mobile-v5.css?v=5.0');
  const css=fs.readFileSync('atlas-ui-v4.css','utf8');
  for(const selector of ['.sidebar','.brand-box','.surface','.table-wrap','.atlas-modal','.field input','.btn']) assert.ok(css.includes(selector),selector);
  assert.match(css,/\.brand-box\s*\{[^}]*background\s*:\s*transparent/s);
});
