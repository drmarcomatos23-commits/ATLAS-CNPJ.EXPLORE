import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../command-center-v4.css', import.meta.url), 'utf8');

function mobile640Block(source) {
  const marker = '@media(max-width:640px){';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'bloco mobile de 640px precisa existir');
  return source.slice(start);
}

test('resultados da busca mobile ficam ancorados ao campo, sem coordenada fixa da viewport', () => {
  const mobile = mobile640Block(css);
  assert.match(mobile, /\.v4-command-results\{[^}]*position:absolute/);
  assert.match(mobile, /\.v4-command-results\{[^}]*top:calc\(100% \+ 8px\)/);
  assert.doesNotMatch(mobile, /\.v4-command-results\{[^}]*position:fixed/);
  assert.doesNotMatch(mobile, /\.v4-command-results\{[^}]*top:66px/);
});
