import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('V5.1 publica os CSS alterados com versões de cache atualizadas', () => {
  assert.match(index, /command-center-v4\.css\?v=4\.1/);
  assert.match(index, /mobile-v5\.css\?v=5\.1/);
  assert.doesNotMatch(index, /command-center-v4\.css\?v=4\.0/);
  assert.doesNotMatch(index, /mobile-v5\.css\?v=5\.0/);
});
