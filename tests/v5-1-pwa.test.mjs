import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const index = readFileSync('index.html', 'utf8');

test('V5.1 possui manifesto PWA institucional e instalável', () => {
  assert.equal(existsSync('manifest.webmanifest'), true);
  assert.equal(existsSync('atlas-pwa-icon.svg'), true);
  const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(manifest.name, 'ATLAS Legalização e Gerenciamento');
  assert.equal(manifest.short_name, 'ATLAS');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  assert.match(manifest.start_url, /^\//);
  assert.equal(manifest.icons.some(icon => icon.src === '/atlas-pwa-icon.svg' && /maskable/.test(icon.purpose || '')), true);
  assert.match(index, /rel="manifest"[^>]+manifest\.webmanifest/);
});

test('service worker da V5.1 não intercepta Supabase nem API dinâmica', () => {
  assert.equal(existsSync('sw-v5-1.js'), true);
  const sw = readFileSync('sw-v5-1.js', 'utf8');
  assert.match(sw, /url\.origin\s*!==\s*self\.location\.origin/);
  assert.match(sw, /pathname\.startsWith\(['"]\/api\/['"]\)/);
  assert.match(sw, /request\.method\s*!==\s*['"]GET['"]/);
  assert.match(sw, /request\.mode\s*===\s*['"]navigate['"]/);
  assert.doesNotMatch(sw, /supabase\.co[^\n]*cache/i);
});

test('registro PWA oferece instalação sem alterar autenticação', () => {
  assert.equal(existsSync('pwa-v5-1.js'), true);
  const pwa = readFileSync('pwa-v5-1.js', 'utf8');
  assert.match(pwa, /serviceWorker\.register\(['"]\/sw-v5-1\.js/);
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /appinstalled/);
  assert.match(index, /pwa-v5-1\.js\?v=5\.1/);
  assert.match(index, /apple-mobile-web-app-capable/);
});
