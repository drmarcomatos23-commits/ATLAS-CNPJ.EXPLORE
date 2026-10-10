import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../operations-v5.css', import.meta.url), 'utf8');

test('operations V5 stylesheet is wired after V4 operations', () => {
  const v4 = index.indexOf('/operations-v4.css?v=4.0');
  const v5 = index.indexOf('/operations-v5.css?v=5.0');
  assert.ok(v4 >= 0 && v5 > v4, 'operations V5 must load after operations V4');
});

test('operations V5 preserves list and pipeline visual modes', () => {
  assert.match(css, /\.v4-view-toggle/);
  assert.match(css, /\.v4-process-list/);
  assert.match(css, /\.v4-process-pipeline/);
  assert.match(css, /\.v4-pipe-col/);
});

test('operations V5 keeps workflow usable on mobile', () => {
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /scroll-snap-type:\s*x\s+proximity/);
  assert.match(css, /min-height:\s*44px/);
});
