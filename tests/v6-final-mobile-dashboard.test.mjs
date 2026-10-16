import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('atlas-reference-mobile.css','utf8');
const runtime = fs.readFileSync('atlas-reference-runtime.js','utf8');

test('final mobile dashboard removes duplicate legacy header and dashboard FAB', () => {
  assert.match(css, /data-v6-page="dashboard"[^}]*page-head/s);
  assert.match(css, /#new-process-btn/);
  assert.match(css, /display:\s*none\s*!important/);
});

test('mobile drawer stays above its overlay and opens visibly', () => {
  assert.match(css, /\.sidebar\.mobile-open/);
  assert.match(css, /z-index:\s*2300/);
  assert.match(css, /mobile-nav-overlay[^}]*z-index:\s*2200/s);
  assert.match(css, /translateX\(0\)/);
});

test('final mobile reference stylesheet is injected after desktop reference CSS', () => {
  assert.ok(runtime.includes('atlas-reference-mobile-css'));
  assert.ok(runtime.includes('/atlas-reference-mobile.css?v=1.0'));
  assert.match(runtime, /ensureMobileStylesheet/);
});

test('mobile final dashboard uses two KPI columns and natural page scroll', () => {
  assert.match(css, /atlas-kpi-grid[^}]*repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
});
