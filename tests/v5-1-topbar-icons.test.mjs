import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync('iconography-v5-1.js', 'utf8');
const css = readFileSync('iconography-v5-1.css', 'utf8');

test('V5.1 padroniza controles da topbar com SVGs da mesma biblioteca', () => {
  for (const icon of ['menu', 'bell', 'log-out', 'plus']) {
    assert.match(js, new RegExp(`['\"]${icon}['\"]\\s*:`));
  }
  assert.match(js, /function applyTopbarIcons\s*\(/);
  assert.match(js, /#mobile-menu-btn/);
  assert.match(js, /\.bell/);
  assert.match(js, /#logout-btn/);
  assert.match(js, /#new-process-btn/);
});

test('Novo processo preserva rotulo e recebe icone vetorial', () => {
  assert.match(js, /Novo processo/);
  assert.match(js, /atlas-action-label/);
  assert.match(js, /svg\(['\"]plus['\"]/);
});

test('controles vetoriais da topbar mantem alinhamento e tamanho consistente', () => {
  assert.match(css, /\.atlas-topbar-icon-button\s*\{[^}]*display:\s*(?:inline-)?grid!important/i);
  assert.match(css, /\.atlas-topbar-icon-button svg\s*\{[^}]*width:\s*18px!important/i);
  assert.match(css, /#new-process-btn\.atlas-action-with-icon\s*\{[^}]*display:\s*inline-flex!important/i);
  assert.match(css, /#new-process-btn\.atlas-action-with-icon svg\s*\{[^}]*width:\s*16px!important/i);
});
