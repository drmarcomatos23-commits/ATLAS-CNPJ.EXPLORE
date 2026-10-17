import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cssUrl = new URL('../dashboard-v6.css', import.meta.url);
const jsUrl = new URL('../dashboard-v6.js', import.meta.url);
const heroUrl = new URL('../assets/atlas-legalizacao-hero-v6.svg', import.meta.url);

test('V6 dashboard stylesheet and renderer load after the existing V5 dashboard layers', () => {
  assert.equal(existsSync(cssUrl), true, 'dashboard-v6.css must exist');
  const v5 = index.indexOf('/dashboard-v5.css?v=5.0');
  const v6 = index.indexOf('/dashboard-v6.css?v=6.0');
  assert.ok(v6 > v5, 'dashboard-v6.css must load after dashboard-v5.css');
  assert.match(index, /<script src="\/dashboard-v6\.js\?v=6\.0" defer><\/script>/);
});

test('V6 dashboard renderer contains the exact approved hero copy and official brand assets', () => {
  const js = readFileSync(jsUrl, 'utf8');
  assert.equal(existsSync(heroUrl), true, 'corporate hero asset must exist');
  assert.match(js, /BEM-VINDO AO/);
  assert.match(js, /LEGALIZAÇÃO E GERENCIAMENTO/);
  assert.match(js, /Gestão empresarial completa, com abertura, alterações, licenças e regularização, em um só lugar\./);
  for (const label of ['ABERTURA','ALTERAÇÕES','LICENÇAS','REGULARIZAÇÃO','GESTÃO EMPRESARIAL']) {
    assert.ok(js.includes(label), `missing hero service ${label}`);
  }
  assert.match(js, /atlas-dashboard-brand\.svg/);
  assert.match(js, /atlas-legalizacao-hero-v6\.svg/);
});

test('V6 dashboard has exactly the six approved KPI definitions and six approved pipeline stages', () => {
  const js = readFileSync(jsUrl, 'utf8');
  for (const label of ['Empresas','Processos em andamento','Licenças vencendo','Honorários (mês)','Pendências','Documentos']) {
    assert.ok(js.includes(label), `missing KPI ${label}`);
  }
  for (const label of [
    'Consulta de Viabilidade',
    'DBE / Receita Federal',
    'Junta Comercial',
    'Alvará Municipal',
    'Licenças / Órgãos Reguladores',
    'Pós-abertura / Regularização'
  ]) assert.ok(js.includes(label), `missing stage ${label}`);
});

test('V6 dashboard includes recent processes and the three approved bottom blocks', () => {
  const js = readFileSync(jsUrl, 'utf8');
  for (const label of ['PROCESSOS RECENTES','PROCESSOS POR SITUAÇÃO','EMPRESAS POR TIPO','PRÓXIMOS PRAZOS']) {
    assert.ok(js.includes(label), `missing dashboard block ${label}`);
  }
});

test('V6 dashboard desktop grid follows the approved wide-screen proportions', () => {
  const css = readFileSync(cssUrl, 'utf8');
  assert.match(css, /\.v6-kpi-grid\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.v6-dashboard-main-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(320px,\s*1fr\)/s);
  assert.match(css, /\.v6-dashboard-bottom-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /min-height:\s*265px/);
});

test('V6 dashboard source contains no approved-mockup fake business records', () => {
  const js = readFileSync(jsUrl, 'utf8');
  for (const fake of ['Tech Solutions Ltda','Restaurante Bom Sabor','Construtora Horizonte','Clínica Vida Plena','Logística Express']) {
    assert.equal(js.includes(fake), false, `fake record ${fake} must never be embedded`);
  }
});
