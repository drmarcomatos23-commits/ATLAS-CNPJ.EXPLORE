import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync('index.html','utf8');
const css=fs.existsSync('modules-v5.css')?fs.readFileSync('modules-v5.css','utf8'):'';

test('V5 carrega camada dos modulos secundarios antes do shell e mobile',()=>{
  const modules=index.indexOf('/modules-v5.css?v=5.0');
  const shell=index.indexOf('/atlas-v5.css?v=5.0');
  const mobile=index.indexOf('/mobile-v5.css?v=5.0');
  assert.ok(modules>=0,'modules-v5.css ausente do index');
  assert.ok(modules<shell,'modules-v5.css deve carregar antes do shell global');
  assert.ok(shell<mobile,'mobile-v5.css deve continuar sendo a ultima camada responsiva');
});

test('Licencas V5 ganham leitura operacional e alertas consistentes',()=>{
  assert.match(css,/\.license-card-top strong\s*\{[^}]*font-size:var\(--v5-font-sm\)/s);
  assert.match(css,/\.license-expiry-row\s*\{[^}]*min-height:72px/s);
  assert.match(css,/\.license-expiry-row \.mini-btn\s*\{[^}]*min-height:36px/s);
});

test('Financeiro V5 organiza KPIs tabelas e acoes',()=>{
  assert.match(css,/\.finance-kpis\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/s);
  assert.match(css,/\.honorarios-control \.table-wrap\s*\{[^}]*border-radius:var\(--v5-radius\)/s);
  assert.match(css,/\.payment-confirm-btn\s*\{[^}]*min-height:36px/s);
});

test('Documentos Relatorios e Configuracoes compartilham superficies V5',()=>{
  assert.match(css,/\.source-note\s*\{[^}]*border-radius:10px/s);
  assert.match(css,/\.data-row\s*\{[^}]*min-height:44px/s);
  assert.match(css,/\.report-actions\s*\{/s);
});

test('Modulos secundarios empilham de forma segura no mobile',()=>{
  assert.match(css,/@media \(max-width:760px\)[\s\S]*\.finance-kpis\s*\{[^}]*grid-template-columns:1fr/s);
  assert.match(css,/@media \(max-width:760px\)[\s\S]*\.license-grid\s*\{[^}]*grid-template-columns:1fr/s);
  assert.match(css,/@media \(max-width:760px\)[\s\S]*\.data-row\s*\{[^}]*grid-template-columns:1fr/s);
});
