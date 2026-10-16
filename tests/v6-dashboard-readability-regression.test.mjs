import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const finalJs = fs.readFileSync('atlas-reference-final.js','utf8');
const finalCss = fs.readFileSync('atlas-reference-final.css','utf8');
const sidebarCss = fs.readFileSync('functional-atlas-sidebar-v6.css','utf8');

test('final dashboard does not create the redundant Dashboard / Visão Geral page head', () => {
  assert.doesNotMatch(finalJs, /setHead\(['"]Dashboard['"],['"]VISÃO GERAL['"]/);
});

test('desktop dashboard typography is readable at normal browser zoom', () => {
  assert.match(finalCss, /\.atlas-kpi-copy small\{[^}]*font-size:\s*11px/i);
  assert.match(finalCss, /\.atlas-kpi-copy strong\{[^}]*font-size:\s*26px/i);
  assert.match(finalCss, /\.atlas-card>header h2\{[^}]*font-size:\s*12px/i);
  assert.match(finalCss, /\.atlas-row-main strong\{[^}]*font-size:\s*10px/i);
  assert.match(finalCss, /\.atlas-badge\{[^}]*font-size:\s*9px/i);
});

test('desktop sidebar groups are visually continuous without excessive vertical gaps', () => {
  assert.match(sidebarCss, /\.v6-nav-group\{[\s\S]*?margin:\s*0!important/i);
  assert.match(sidebarCss, /\.v6-functional-group-title\{[\s\S]*?display:\s*none!important/i);
  assert.match(sidebarCss, /\.v6-functional-nav-item\{[\s\S]*?min-height:\s*42px!important/i);
});
