import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('sidebar segue a referencia Atlas Legalizacao e nao usa CNPJ Explore',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const css=fs.readFileSync('atlas-sidebar-v4.css','utf8');
  assert.ok(html.includes('src="/atlas-sidebar-brand.svg?v=4.4"'));
  assert.equal(html.includes('src="/logo-atlas.png?v=4.0"'),false);
  assert.ok(css.includes('--atlas-sidebar:#021732'));
  assert.match(css,/\.sidebar-footer\s*\{[^}]*display:none!important/s);
  assert.match(css,/@media\s*\(min-width:1181px\)[\s\S]*?\.sidebar\s*\{[^}]*width:190px!important[\s\S]*?\.workspace\s*\{[^}]*margin-left:190px!important/s);
  assert.match(css,/\.brand-logo\s*\{[^}]*width:148px!important/s);
});
