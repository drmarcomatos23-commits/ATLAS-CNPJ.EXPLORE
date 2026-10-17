import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html','utf8');
const realtime = fs.readFileSync('company-realtime.js','utf8');

function read(path){ return fs.existsSync(path) ? fs.readFileSync(path,'utf8') : ''; }

test('operational data waits for an authenticated Supabase session before querying', () => {
  const guard = read('auth-readiness-v6.js');
  assert.ok(guard, 'auth-readiness-v6.js must exist');
  assert.match(guard, /auth\.getSession\(\)/);
  assert.match(guard, /loadOperationalData/);
  assert.match(guard, /await\s+waitForAuthenticatedSession\(\)/);
  assert.match(index, /<script src="\/auth-readiness-v6\.js\?v=6\.1" defer><\/script>/);
  assert.ok(index.indexOf('/atlas-auth.js') < index.indexOf('/auth-readiness-v6.js'), 'guard must load after atlas-auth');
  assert.ok(index.indexOf('/auth-readiness-v6.js') < index.indexOf('/role-permissions.js'), 'guard must load before modules that can query operational data');
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
});
