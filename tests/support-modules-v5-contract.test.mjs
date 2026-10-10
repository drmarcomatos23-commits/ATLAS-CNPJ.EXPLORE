import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const modules=fs.readFileSync('modules-v5.css','utf8');
const css=fs.existsSync('support-modules-v5.css')?fs.readFileSync('support-modules-v5.css','utf8'):'';

test('V5 encadeia a camada de modulos de apoio antes das regras secundarias',()=>{
  assert.match(modules,/^\/\*[\s\S]*?\*\/\s*@import url\("\/support-modules-v5\.css\?v=5\.0"\);/);
});

test('Exigencias e Integracoes usam superficies e acoes legiveis',()=>{
  assert.match(css,/\.real-task\s*\{[^}]*min-height:72px/s);
  assert.match(css,/\.integration-card\s*\{[^}]*padding:16px/s);
  assert.match(css,/\.integration-card \.btn\s*\{[^}]*min-height:36px/s);
});

test('Base de Conhecimento V5 elimina microtipografia operacional',()=>{
  assert.match(css,/\.kb-category-btn\s*\{[^}]*font-size:var\(--v5-font-sm\)/s);
  assert.match(css,/\.kb-card p\s*\{[^}]*font-size:var\(--v5-font-sm\)/s);
  assert.match(css,/\.kb-tags span\s*\{[^}]*font-size:var\(--v5-font-xs\)/s);
});

test('Treinamento V5 melhora leitura e alvos de acao',()=>{
  assert.match(css,/\.training-card p\s*\{[^}]*font-size:var\(--v5-font-sm\)/s);
  assert.match(css,/\.training-actions \.btn\s*\{[^}]*min-height:36px/s);
  assert.match(css,/\.training-steps span\s*\{[^}]*font-size:var\(--v5-font-sm\)/s);
});

test('Usuarios V5 ganha tabela e controles consistentes',()=>{
  assert.match(css,/\.users-list-card\s*\{[^}]*padding:16px/s);
  assert.match(css,/\.users-table th\s*\{[^}]*font-size:var\(--v5-font-xs\)/s);
  assert.match(css,/\.users-table td\s*\{[^}]*font-size:var\(--v5-font-sm\)/s);
});

test('Modulos de apoio permanecem utilizaveis no mobile',()=>{
  assert.match(css,/@media \(max-width:760px\)[\s\S]*\.kb-categories\s*\{[^}]*overflow-x:auto/s);
  assert.match(css,/@media \(max-width:760px\)[\s\S]*\.training-actions\s*\{[^}]*display:grid/s);
  assert.match(css,/@media \(max-width:760px\)[\s\S]*\.integration-card \.btn\s*\{[^}]*width:100%/s);
});
