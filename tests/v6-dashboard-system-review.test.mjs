import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('atlas-dashboard-polish.css','utf8');

test('desktop browser zoom keeps the desktop sidebar from 900px when a mouse is present', () => {
  assert.match(css, /@media\s*\(min-width:900px\)\s*and\s*\(max-width:1180px\)\s*and\s*\(hover:hover\)/i);
  assert.match(css, /#app-shell \.sidebar\{[\s\S]*?width:185px!important[\s\S]*?transform:none!important/i);
  assert.match(css, /#app-shell \.workspace\{[\s\S]*?margin-left:185px!important/i);
  assert.match(css, /#app-shell \.mobile-menu-btn\{[\s\S]*?display:none!important/i);
});

test('donut center is visually centered and readable', () => {
  assert.match(css, /\.atlas-chart-center\{[\s\S]*?position:absolute!important[\s\S]*?display:flex!important[\s\S]*?align-items:center!important[\s\S]*?justify-content:center!important/i);
  assert.match(css, /\.atlas-chart-center b\{[\s\S]*?font-size:18px!important[\s\S]*?line-height:1!important/i);
  assert.match(css, /\.atlas-chart-center small\{[\s\S]*?font-size:10px!important/i);
});

test('bottom charts are clipped inside their own cards and never cover headers', () => {
  assert.match(css, /\.atlas-card>header\{[\s\S]*?z-index:3/i);
  assert.match(css, /\.atlas-bars:has\(\.atlas-chart-canvas\)\{[\s\S]*?overflow:hidden!important/i);
  assert.match(css, /\.atlas-bars>\.atlas-chart-canvas\.bars\{[\s\S]*?position:relative!important/i);
});

test('mobile KPI cards contain long labels and currency values without horizontal overflow', () => {
  assert.match(css, /@media\s*\(max-width:760px\)[\s\S]*?\.atlas-kpi-copy\{[\s\S]*?min-width:0!important[\s\S]*?overflow:hidden!important/i);
  assert.match(css, /@media\s*\(max-width:760px\)[\s\S]*?\.atlas-kpi-copy strong\{[\s\S]*?font-size:clamp\(14px,4\.2vw,19px\)!important[\s\S]*?max-width:100%!important[\s\S]*?overflow-wrap:anywhere!important/i);
  assert.match(css, /@media\s*\(max-width:760px\)[\s\S]*?\.atlas-kpi-copy small[\s\S]*?overflow-wrap:anywhere!important/i);
  assert.match(css, /@media\s*\(max-width:760px\)[\s\S]*?\.atlas-kpi-copy>span\{[\s\S]*?margin-top:auto!important/i);
});
