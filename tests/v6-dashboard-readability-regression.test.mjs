import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const readabilityCss = fs.readFileSync('atlas-readability-fix.css','utf8');
const runtimeJs = fs.readFileSync('atlas-reference-runtime.js','utf8');

test('final dashboard hides the redundant Dashboard / Visão Geral page head', () => {
  assert.match(readabilityCss, /#app-shell\[data-v6-page="dashboard"\][\s\S]*?\.page-head[\s\S]*?display:\s*none!important/i);
  assert.match(runtimeJs, /pageHead\.style\.setProperty\(['"]display['"],['"]none['"],['"]important['"]\)/);
});

test('desktop dashboard typography is readable at normal browser zoom', () => {
  assert.match(readabilityCss, /\.atlas-kpi-copy small\{[^}]*font-size:\s*11px/i);
  assert.match(readabilityCss, /\.atlas-kpi-copy strong\{[^}]*font-size:\s*26px/i);
  assert.match(readabilityCss, /\.atlas-card>header h2\{[^}]*font-size:\s*12px/i);
  assert.match(readabilityCss, /\.atlas-row-main strong\{[^}]*font-size:\s*10px/i);
  assert.match(readabilityCss, /\.atlas-badge\{[^}]*font-size:\s*9px/i);
});

test('desktop sidebar groups are visually continuous without excessive vertical gaps', () => {
  assert.match(readabilityCss, /\.v6-nav-group\{[\s\S]*?margin:\s*0!important/i);
  assert.match(readabilityCss, /\.v6-functional-group-title\{[\s\S]*?display:\s*none!important/i);
  assert.match(readabilityCss, /\.v6-functional-nav-item,[\s\S]*?min-height:\s*42px!important/i);
});

test('runtime loads the readability layer after the final and mobile layers', () => {
  assert.match(runtimeJs, /ensureReadabilityStylesheet\(\)/);
  assert.match(runtimeJs, /atlas-readability-fix\.css\?v=1\.0/);
});
