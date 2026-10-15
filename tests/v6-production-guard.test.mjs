import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
const migrationsDir = new URL('../supabase/migrations/', import.meta.url);

const requiredIds = [
  'login-screen',
  'app-shell',
  'nav',
  'global-search',
  'logout-btn',
  'page-content',
  'atlas-modal-root'
];

const requiredPages = [
  'dashboard',
  'clientes',
  'processos',
  'licencas',
  'documentos',
  'custos',
  'relatorios',
  'config'
];

test('V6 preserves functional shell hooks used by authentication and navigation', () => {
  for (const id of requiredIds) {
    assert.match(index, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  for (const page of requiredPages) {
    assert.match(index, new RegExp(`data-page=["']${page}["']`), `missing data-page=${page}`);
  }
});

test('V6 does not add database migrations', () => {
  const names = readdirSync(migrationsDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name);
  assert.equal(names.some(name => /v6/i.test(name)), false, 'V6 must not add a Supabase migration');
});

test('Vercel config does not hard-code production promotion or aliases', () => {
  assert.doesNotMatch(vercel, /"target"\s*:\s*"production"/i);
  assert.doesNotMatch(vercel, /"alias"\s*:/i);
  assert.doesNotMatch(vercel, /promote/i);
});
