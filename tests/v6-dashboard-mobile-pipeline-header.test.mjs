import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('atlas-reference-mobile-fix.css','utf8');

test('mobile pipeline scroll keeps header and Ver todos os processos fixed', () => {
  assert.match(css, /\.atlas-pipeline>header\s*\{[\s\S]*?position:sticky!important[\s\S]*?left:0!important[\s\S]*?z-index:/i);
  assert.match(css, /\.atlas-pipeline>header\s*\{[\s\S]*?width:100%!important/i);
});
