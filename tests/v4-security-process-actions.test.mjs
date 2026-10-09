import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('processos V4 exibem editar e excluir apenas para perfis operacionais autorizados', () => {
  const src = read('operations-v4.js');
  assert.match(src, /\['admin','operacao'\]\.includes/);
  assert.match(src, />Editar</);
  assert.match(src, />Excluir</);
  assert.match(src, /deleteProcess\(/);
});

test('edição de processo concluído não sobrescreve completed_at no frontend', () => {
  const src = read('legalizacao.js');
  assert.doesNotMatch(src, /completed_at:\$\('#proc-status'\)\.value==='completed'\?new Date\(\)\.toISOString\(\):null/);
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

test('patches pendentes de conclusão e menu lateral estão carregados no app', () => {
  const html = read('index.html');
  assert.match(html, /completion-date-v4\.js/);
  assert.match(html, /sidebar-accordion-v4\.js/);
});
