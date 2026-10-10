import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../atlas-v5.css', import.meta.url), 'utf8');

test('V5 shell stylesheet is loaded after the V4 layers', () => {
  const v4Pos = index.indexOf('/mobile-v4.css?v=4.2');
  const v5Pos = index.indexOf('/atlas-v5.css?v=5.0');
  assert.ok(v4Pos >= 0, 'V4 mobile stylesheet must exist');
  assert.ok(v5Pos > v4Pos, 'V5 shell stylesheet must load after all V4 styles');
});

test('V5 shell centralizes desktop sidebar geometry', () => {
  assert.match(css, /--v5-sidebar-width:\s*208px/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /margin-left:\s*var\(--v5-sidebar-width\)/);
  assert.match(css, /overflow-y:\s*auto/);
});

test('V5 releases desktop offset at tablet breakpoint', () => {
  assert.match(css, /@media\s*\(max-width:\s*1180px\)/);
  assert.match(css, /margin-left:\s*0/);
});
