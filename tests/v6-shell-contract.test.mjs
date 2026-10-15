import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const v6Url = new URL('../atlas-v6.css', import.meta.url);

test('V6 stylesheet is wired after all V5/V5.1 presentation layers', () => {
  const v5Positions = [
    index.lastIndexOf('/atlas-v5.css?v=5.0'),
    index.lastIndexOf('/dashboard-v5.css?v=5.0'),
    index.lastIndexOf('/mobile-v5.css?v=5.1')
  ].filter(pos => pos >= 0);
  assert.ok(v5Positions.length >= 2, 'expected existing V5 styles');
  const v6Pos = index.indexOf('/atlas-v6.css?v=6.0');
  assert.ok(v6Pos > Math.max(...v5Positions), 'atlas-v6.css must load after V5/V5.1 styles');
});

test('V6 shell file exists and defines the approved geometry tokens', () => {
  assert.equal(existsSync(v6Url), true, 'atlas-v6.css must exist');
  const css = readFileSync(v6Url, 'utf8');
  assert.match(css, /--v6-sidebar-width:\s*300px/);
  assert.match(css, /--v6-topbar-height:\s*74px/);
  assert.match(css, /height:\s*100dvh/);
});
