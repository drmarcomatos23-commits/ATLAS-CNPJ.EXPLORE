import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('sidebar-accordion-v4.js', 'utf8');

test('todos os grupos da sidebar iniciam expandidos', () => {
  assert.doesNotMatch(source, /const shouldOpen = index === 0 \|\| items\.querySelector\('\.nav-item\.active'\)/);
  assert.match(source, /group\.append\(toggle, items\);[\s\S]*?setExpanded\(group, true\);/);
});

test('grupo recolhido pelo usuario nao e reaberto automaticamente por item ativo', () => {
  assert.doesNotMatch(source, /if \(active\) setExpanded\(group, true\);/);
  assert.match(source, /toggle\.addEventListener\('click', \(\) => setExpanded\(group, toggle\.getAttribute\('aria-expanded'\) !== 'true'\)\)/);
});
