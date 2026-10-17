import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const legacyMobile = await readFile(new URL('../mobile-responsive.css', import.meta.url), 'utf8');
const mobileV5 = await readFile(new URL('../mobile-v5.css', import.meta.url), 'utf8');

test('V5.1 mantém a busca global visível em celulares mesmo com a regra legada que a oculta', () => {
  assert.match(legacyMobile, /@media\(max-width:640px\)[\s\S]*?\.global-search\{display:none!important\}/);
  assert.match(mobileV5, /@media \(max-width:760px\)\{[\s\S]*?\.global-search\{[\s\S]*?display:block!important/);
});

test('topbar mobile aceita duas linhas sem altura fixa de 60px', () => {
  assert.match(legacyMobile, /@media\(max-width:1180px\)[\s\S]*?\.topbar\{[\s\S]*?height:60px!important/);
  assert.match(mobileV5, /@media \(max-width:760px\)\{[\s\S]*?\.topbar\{[\s\S]*?height:auto!important/);
  assert.match(mobileV5, /grid-template-rows:auto auto!important/);
});
