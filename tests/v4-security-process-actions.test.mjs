import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('processos V4 exibem editar e excluir apenas para perfis operacionais autorizados', () => {
  const operations = read('operations-v4.js');
  const actions = read('process-actions-v4.js');
  assert.match(operations, /C\.canEditForRole\(r\)&&!\['cliente','auditoria'\]\.includes\(r\)/);
  assert.match(actions, /\['admin',\s*'operacao'\]\.includes/);
  assert.match(actions, />Editar</);
  assert.match(actions, />Excluir</);
  assert.match(actions, /deleteProcess\(/);
});

test('edição de processo concluído delega completed_at exclusivamente ao banco', () => {
  const guard = read('process-completion-guard-v5.js');
  const html = read('index.html');
  assert.match(html, /process-completion-guard-v5\.js\?v=5\.0/);
  assert.match(guard, /delete\s+clean\.completed_at/);
  assert.match(guard, /table\s*!==\s*'processes'/);
});

test('política de segurança V1 protege as sete tabelas pendentes e revoga anon', () => {
  const sql = read('supabase/migrations/20261009_security_policies_v1.sql');
  for (const table of ['audit_logs','briefings','client_registry_snapshots','client_units','communications','integration_accounts','integration_events']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon`, 'i'));
  }
  assert.match(sql, /atlas_audit_logs_select/i);
  assert.match(sql, /atlas_briefings_select/i);
  assert.match(sql, /atlas_client_units_select/i);
  assert.match(sql, /atlas_communications_select/i);
  assert.match(sql, /atlas_integration_accounts_select/i);
  assert.match(sql, /atlas_integration_events_select/i);
});

test('patches de conclusão, ações e menu lateral estão carregados no app', () => {
  const html = read('index.html');
  const guard = read('dashboard-brand-guard-v4.js');
  assert.match(html, /sidebar-accordion-v4\.js\?v=4\.1/);
  assert.match(guard, /completion-date-v4\.js\?v=4\.1/);
  assert.match(guard, /process-actions-v4\.js\?v=4\.2/);
});
