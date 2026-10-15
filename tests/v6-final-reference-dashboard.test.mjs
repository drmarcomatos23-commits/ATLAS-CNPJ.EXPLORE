import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('atlas-reference-final.css','utf8');
const js = fs.readFileSync('atlas-reference-final.js','utf8');

test('final reference uses approved desktop shell geometry and design tokens', () => {
  assert.match(css,/--atlas-sidebar:\s*185px/);
  assert.match(css,/--atlas-bg:\s*#F3F6FB/i);
  assert.match(css,/--atlas-primary:\s*#1565D8/i);
  assert.match(css,/--atlas-orange:\s*#F7931E/i);
  assert.match(css,/--atlas-card-radius:\s*12px/);
  assert.match(css,/height:\s*180px!important/);
});

test('final reference includes responsive KPI 6-3-2 grid', () => {
  assert.match(css,/grid-template-columns:\s*repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css,/@media \(max-width:1100px\)[\s\S]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media \(max-width:700px\)[\s\S]*repeat\(2,minmax\(0,1fr\)\)/);
});

test('final reference provides mock fallback without replacing available real data', () => {
  assert.match(js,/MOCK_KPIS/);
  assert.match(js,/MOCK_RECENT/);
  assert.match(js,/MOCK_DEADLINES/);
  assert.match(js,/useMockOnlyWhenMissing/);
});

test('final reference uses line SVG icons instead of text glyphs', () => {
  assert.match(js,/stroke="currentColor"/);
  assert.match(js,/data-atlas-icon/);
});
