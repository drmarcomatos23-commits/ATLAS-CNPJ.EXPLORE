import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell = fs.readFileSync('atlas-v6-shell.js','utf8');
const css = fs.readFileSync('atlas-v6.css','utf8');

test('dashboard V6 removes duplicate legacy page header before rendering hero',()=>{
  assert.match(shell,/page-head/);
  assert.match(shell,/style\.display\s*=\s*['"]none['"]/);
  assert.match(shell,/data-v6-page=\\"dashboard\\"/);
});

test('shell V6 enforces exact approved search placeholder after legacy mutations',()=>{
  assert.ok(shell.includes('Buscar empresas, processos, documentos...'));
  assert.match(shell,/MutationObserver/);
  assert.match(shell,/placeholder/);
});

test('desktop shell keeps approved 300px sidebar and 74px topbar targets',()=>{
  assert.match(css,/--v6-sidebar-width:\s*300px/);
  assert.match(css,/--v6-topbar-height:\s*74px/);
});
