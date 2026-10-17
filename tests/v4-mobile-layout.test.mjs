import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('camada mobile v4 e carregada por ultimo e preserva desktop',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.includes('/mobile-v4.css?v=4.2'));
  const idx=html.indexOf('/mobile-v4.css?v=4.2');
  assert.ok(idx>html.indexOf('/atlas-sidebar-v4.css?v=4.1'));
});

test('mobile transforma processos em cards sem largura fixa',()=>{
  const css=fs.readFileSync('mobile-v4.css','utf8');
  assert.match(css,/@media\s*\(max-width:\s*760px\)/);
  assert.match(css,/\.v4-process-head\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(css,/\.v4-process-row\s*\{[^}]*min-width:\s*0\s*!important/s);
  assert.match(css,/\.v4-process-row\s*\{[^}]*grid-template-columns:\s*1fr\s+1fr\s*!important/s);
  assert.match(css,/\.v4-row-actions\s+\.mini-btn\s*\{[^}]*width:\s*100%\s*!important/s);
});

test('mobile ajusta dashboard header modais tabelas e safe area',()=>{
  const css=fs.readFileSync('mobile-v4.css','utf8');
  assert.match(css,/env\(safe-area-inset-top\)/);
  assert.match(css,/\.v4-kpis\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(css,/@media\s*\(max-width:\s*480px\)[\s\S]*?\.v4-kpis\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css,/\.atlas-modal\s*\{[^}]*width:\s*calc\(100vw\s*-\s*16px\)\s*!important/s);
  assert.match(css,/\.modal-form-grid[^\{]*\{[^}]*grid-template-columns:\s*1fr\s*!important/s);
  assert.match(css,/\.table-wrap\s*\{[^}]*overflow-x:\s*auto\s*!important/s);
  assert.match(css,/\.sidebar\s*\{[^}]*width:\s*min\(86vw,\s*320px\)\s*!important/s);
});
