import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const guard = readFileSync(new URL('../process-completion-guard-v5.js', import.meta.url), 'utf8');

test('V5 delegates completed_at exclusively to the database trigger', () => {
  assert.match(index, /process-completion-guard-v5\.js\?v=5\.0/);
  assert.match(guard, /delete\s+clean\.completed_at/);
  assert.match(guard, /table\s*!==\s*['"]processes['"]/);
});

test('completion guard sanitizes process inserts and updates', () => {
  assert.match(guard, /prop\s*===\s*['"]update['"]\s*\|\|\s*prop\s*===\s*['"]insert['"]/);
  assert.match(guard, /Array\.isArray\(payload\)/);
});
