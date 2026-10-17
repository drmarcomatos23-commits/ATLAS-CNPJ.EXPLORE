import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path='supabase/migrations/20261007_finance_fee_notifications.sql';

test('migration cria notificacoes financeiras de taxa com RLS, deduplicacao e realtime',()=>{
  assert.equal(fs.existsSync(path),true,'migration deve existir');
  const sql=fs.readFileSync(path,'utf8');
  assert.match(sql,/create\s+table\s+(if\s+not\s+exists\s+)?public\.atlas_notifications/i);
  assert.match(sql,/unique\s*\(\s*recipient_profile_id\s*,\s*event_type\s*,\s*cost_id\s*\)/i);
  assert.match(sql,/atlas_notify_finance_fee_created/i);
  assert.match(sql,/coalesce\(new\.fee_kind,\s*''\)\s*<>\s*'junta_cartorio'/i);
  assert.match(sql,/coalesce\(new\.cost_type,\s*''\)\s*<>\s*'registry_fee'/i);
  assert.match(sql,/role\s*=\s*'financeiro'/i);
  assert.match(sql,/active\s*=\s*true/i);
  assert.match(sql,/atlas_notifications_fee_process_once_idx/i);
  assert.match(sql,/recipient_profile_id\s*,\s*event_type\s*,\s*process_id/i);
  assert.match(sql,/on\s+conflict\s+do\s+nothing/i);
  assert.match(sql,/after\s+insert\s+on\s+public\.costs/i);
  assert.match(sql,/enable\s+row\s+level\s+security/i);
  assert.match(sql,/for\s+select/i);
  assert.match(sql,/for\s+update/i);
  assert.doesNotMatch(sql,/create\s+policy[\s\S]*?for\s+insert/i);
  assert.match(sql,/supabase_realtime/i);
  assert.match(sql,/pg_publication_tables/i);
});
