import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../mobile-v5.css', import.meta.url), 'utf8');

test('mobile V5 defines the required breakpoints', () => {
  assert.match(css, /@media\s*\(max-width:\s*1180px\)/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)/);
});

test('mobile V5 prevents iOS zoom and horizontal shell overflow', () => {
  assert.match(css, /font-size:\s*16px/);
  assert.match(css, /\.workspace[\s\S]*max-width:\s*100%/);
  assert.match(css, /\.main[\s\S]*max-width:\s*100%/);
  assert.match(css, /\.v4-dashboard[\s\S]*max-width:\s*100%/);
});

test('mobile V5 keeps modal inside the dynamic viewport', () => {
  assert.match(css, /max-height:\s*calc\(100dvh\s*-\s*16px\)/);
});

test('dashboard today queue becomes vertical cards instead of horizontal table scrolling on mobile', () => {
  assert.match(css, /\.v4-today\s+\.v4-table-scroll\s*\{[^}]*overflow-x:\s*hidden!important/);
  assert.match(css, /\.v4-today\s+\.v4-ops-table\s*\{[^}]*min-width:\s*0!important[^}]*width:\s*100%!important/);
  assert.match(css, /\.v4-today\s+\.v4-ops-table\s+thead\s*\{[^}]*display:\s*none!important/);
  assert.match(css, /\.v4-today\s+\.v4-ops-table\s+tbody\s+tr\s*\{[^}]*display:\s*grid!important[^}]*grid-template-columns:\s*1fr!important/);
  assert.match(css, /\.v4-today\s+\.v4-ops-table\s+td\s*\{[^}]*min-width:\s*0!important[^}]*overflow-wrap:\s*anywhere!important/);
});
