import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const mobileCss = await readFile(new URL('../mobile-app-v4.css', import.meta.url), 'utf8');
const mobileJs = await readFile(new URL('../mobile-app-v4.js', import.meta.url), 'utf8');
const responsiveJs = await readFile(new URL('../mobile-responsive.js', import.meta.url), 'utf8');

test('shell mobile carrega a camada app explicitamente depois da V5.1', () => {
  assert.match(html, /mobile-v5\.css\?v=5\.1[\s\S]*mobile-app-v4\.css\?v=4\.4/);
  assert.match(html, /iconography-v5-1\.js\?v=5\.1[\s\S]*mobile-app-v4\.js\?v=4\.4/);
});

test('botao de menu preserva o SVG de iconografia ao abrir e fechar drawer', () => {
  assert.doesNotMatch(responsiveJs, /button\.textContent\s*=\s*open\?/);
  assert.match(responsiveJs, /AtlasV51Icons\?\.applyTopbarIcons\?\.\(\)/);
});

test('barra inferior usa a mesma iconografia SVG do desktop', () => {
  assert.match(mobileJs, /AtlasV51Icons\?\.svg/);
  assert.match(mobileJs, /AtlasV51Icons\?\.pageIcons/);
  assert.doesNotMatch(mobileJs, /dashboard:'⌂'/);
  assert.match(mobileCss, /\.atlas-mobile-tab \.tab-ico svg\s*\{/);
});

test('camada app preserva busca V5.1 e protege conteudo da barra inferior', () => {
  assert.doesNotMatch(mobileCss, /\.global-search\{display:none!important\}/);
  assert.match(mobileCss, /\.workspace\{[^}]*padding-bottom:calc\(92px \+ env\(safe-area-inset-bottom\)\)/s);
  assert.match(mobileCss, /#atlas-mobile-bottom-nav\{[^}]*height:calc\(72px \+ env\(safe-area-inset-bottom\)\)/s);
});

test('FAB nao duplica a acao principal na pagina de processos', () => {
  assert.match(mobileJs, /mobile-fab-suppressed/);
  assert.match(mobileCss, /#new-process-btn\.mobile-fab-suppressed\{display:none!important\}/);
});
