import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('process action patch exposes explicit edit and delete controls only for authorized operational roles', () => {
  const src = read('process-actions-v4.js');
  assert.match(src, /Editar/);
  assert.match(src, /Excluir/);
  assert.match(src, /admin/);
  assert.match(src, /operacao/);
  assert.match(src, /deleteProcess/);
  assert.match(src, /Consulta/);
});

test('security migration protects sensitive tables and audit logs', () => {
  const sql = read('supabase/migrations/20261009_security_policies_v1.sql');
  assert.match(sql, /revoke all on table public\.audit_logs from anon/i);
  assert.match(sql, /grant select on table public\.audit_logs to authenticated/i);
  assert.match(sql, /atlas_audit_logs_select/i);
  assert.match(sql, /integration_accounts/i);
  assert.match(sql, /current_org_id\(\)/i);
});
