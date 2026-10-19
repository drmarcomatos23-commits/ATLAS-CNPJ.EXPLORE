import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const shellCss = readFileSync(new URL('../atlas-v6.css', import.meta.url), 'utf8');
const navigationJs = readFileSync(new URL('../atlas-v6-shell.js', import.meta.url), 'utf8');

test('Atlas Hub return is a same-tab link directly under the brand, outside rebuilt navigation', () => {
  const sidebarStart = index.indexOf('<aside class="sidebar">');
  const brandStart = index.indexOf('<div class="brand-box">', sidebarStart);
  const navStart = index.indexOf('<nav id="nav"', brandStart);
  const sidebarEnd = index.indexOf('</aside>', navStart);
  const linkMarkup = index.slice(brandStart, navStart);

  assert.ok(sidebarStart >= 0 && brandStart > sidebarStart && navStart > brandStart && sidebarEnd > navStart);
  assert.match(linkMarkup, /<a\s+class="atlas-hub-return"[^>]+href="https:\/\/atlas-hub-taupe\.vercel\.app"[^>]*>/);
  assert.match(linkMarkup, />Voltar ao Atlas Hub<\/span>/);
  assert.doesNotMatch(linkMarkup, /target=|data-page=|onclick=|logout/i);
  assert.match(navigationJs, /nav\.replaceChildren\(fragment\)/);
  assert.ok(index.indexOf('class="atlas-hub-return"') < navStart, 'dynamic nav replacement must not remove the link');
});

test('Atlas Hub return is styled as an accessible tap target on desktop and mobile', () => {
  assert.match(shellCss, /#app-shell\s+\.atlas-hub-return\s*\{[^}]*display:\s*flex/s);
  assert.match(shellCss, /#app-shell\s+\.atlas-hub-return\s*\{[^}]*min-height:\s*44px/s);
  assert.match(shellCss, /#app-shell\s+\.atlas-hub-return:focus-visible\s*\{/);
  assert.match(index, /<button id="mobile-menu-btn"/);
  assert.match(index, /<div id="mobile-nav-overlay"/);
});
