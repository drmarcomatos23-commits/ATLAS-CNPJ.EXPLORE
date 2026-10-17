import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const realtime = fs.readFileSync('company-realtime.js','utf8');

function read(path){ return fs.existsSync(path) ? fs.readFileSync(path,'utf8') : ''; }

test('operational data waits for an authenticated Supabase session before querying', () => {
  assert.match(realtime, /async function waitForAuthenticatedSession\(\)/);
  assert.match(realtime, /auth\.getSession\(\)/);
  assert.match(realtime, /originalLoadOperationalData/);
  assert.match(realtime, /window\.loadOperationalData\s*=\s*async function/);
  assert.match(realtime, /const ctx = await waitForAuthenticatedSession\(\)/);
  assert.match(realtime, /if \(!ctx\) return emptyOperationalData\(\)/);
});

test('company realtime refuses background reads without an authenticated profile/session', () => {
  assert.match(realtime, /async function authenticatedContext\(\)/);
  assert.match(realtime, /auth\.getSession\(\)/);
  assert.match(realtime, /if\s*\(!ctx\)\s*return\s*\[\]/);
  assert.match(realtime, /if\s*\(!ctx\)\s*return;/);
});

test('database remediation fixes archived client state type and adds safe costs created_at', () => {
  const sql = read('supabase/migrations/20261017_audit_remediation_v6.sql');
  assert.ok(sql, 'audit remediation migration must exist');
  assert.match(sql, /atlas_list_archived_clients\s*\(\s*\)/i);
  assert.match(sql, /c\.state::text/i);
  assert.match(sql, /add column if not exists created_at timestamptz/i);
  assert.match(sql, /alter column created_at set default now\(\)/i);
  assert.doesNotMatch(sql, /update\s+public\.costs\s+set\s+created_at/i, 'existing financial history must not be backfilled with invented dates');
});
