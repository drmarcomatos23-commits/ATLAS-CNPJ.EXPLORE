import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('iconography-v5-1.css', 'utf8');

test('sidebar V5.1 usa densidade vertical compacta no desktop', () => {
  assert.match(css, /\.nav-accordion-group\s*\{[^}]*margin:\s*0!important/i);
  assert.match(css, /\.nav-group-toggle\s*\{[^}]*min-height:\s*20px!important/i);
  assert.match(css, /\.nav-group-toggle\s*\{[^}]*margin:\s*0 4px!important/i);
  assert.match(css, /\.nav-group-items\s*\{[^}]*gap:\s*0!important/i);
  assert.match(css, /\.sidebar \.nav-item\s*\{[^}]*min-height:\s*32px!important/i);
});

test('sidebar mantém alvo confortável no mobile apesar da compactação', () => {
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.nav-group-toggle\s*\{[^}]*min-height:\s*24px!important/i);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.sidebar \.nav-item\s*\{[^}]*min-height:\s*40px!important/i);
});
