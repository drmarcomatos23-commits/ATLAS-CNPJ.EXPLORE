import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('tema global 4.0 e carregado por ultimo e cobre componentes compartilhados',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.includes('/atlas-ui-v4.css?v=4.0'));
  const links=[...html.matchAll(/<link[^>]+href="([^"]+\.css[^\"]*)"/g)].map(m=>m[1]);
  assert.equal(links.at(-1),'/atlas-ui-v4.css?v=4.0');
  const css=fs.readFileSync('atlas-ui-v4.css','utf8');
  for(const selector of ['.sidebar','.brand-box','.surface','.table-wrap','.atlas-modal','.field input','.btn']) assert.ok(css.includes(selector),selector);
  assert.match(css,/\.brand-box\s*\{[^}]*background\s*:\s*transparent/s);
});
