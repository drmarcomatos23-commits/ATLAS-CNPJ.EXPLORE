import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const migrationPath = new URL('../supabase/migrations/20261017_atlas_v7_1_operational_engine.sql', import.meta.url);
const source = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
const normalized = source.replace(/\s+/g, ' ').toLowerCase();

const requiredTables = [
  'process_operations','teams','team_members','task_templates','tasks',
  'task_dependencies','task_events','process_blockers','sla_pauses',
  'stage_transitions','business_holidays'
];

test('ATLAS 7.1 operational migration exists and creates every approved entity', () => {
  assert.ok(source.length > 0, 'operational migration must exist');
  for (const table of requiredTables) {
    assert.match(normalized, new RegExp(`create table(?: if not exists)? public\\.${table}\\b`), `missing table ${table}`);
  }
});

test('operational entities keep organization/process/stage/profile foreign-key boundaries', () => {
  assert.match(normalized, /organization_id uuid[^,]*references public\.organizations\s*\(id\)/);
  assert.match(normalized, /process_id uuid[^,]*references public\.processes\s*\(id\)/);
  assert.match(normalized, /stage_id uuid[^,]*references public\.workflow_stages\s*\(id\)/);
  assert.match(normalized, /assignee_id uuid[^,]*references public\.profiles\s*\(id\)/);
  assert.match(normalized, /created_by uuid[^,]*references public\.profiles\s*\(id\)/);
});

test('task and workflow enums are database constrained instead of free text', () => {
  for (const value of ['pending','in_progress','waiting_client','waiting_agency','waiting_finance','blocked','completed','cancelled']) {
    assert.ok(normalized.includes(`'${value}'`), `missing task status ${value}`);
  }
  for (const value of ['automatic','manual']) assert.ok(normalized.includes(`'${value}'`), `missing task origin ${value}`);
  for (const value of ['low','normal','high','critical']) assert.ok(normalized.includes(`'${value}'`), `missing priority ${value}`);
  for (const value of ['client','agency','external_finance','third_party','internal']) assert.ok(normalized.includes(`'${value}'`), `missing blocker type ${value}`);
  assert.match(normalized, /check\s*\([^)]*status[^)]*\)/);
  assert.match(normalized, /check\s*\([^)]*origin[^)]*\)/);
  assert.match(normalized, /check\s*\([^)]*priority[^)]*\)/);
  assert.match(normalized, /check\s*\([^)]*blocker_type[^)]*\)/);
  assert.match(normalized, /check\s*\([^)]*transition_type[^)]*\)/);
});

test('schema enforces one active primary action, no self-dependency, and valid time intervals', () => {
  assert.match(normalized, /create unique index[^;]*tasks[^;]*process_id[^;]*where[^;]*is_primary_action\s*=\s*true[^;]*status\s+not\s+in\s*\(\s*'completed'\s*,\s*'cancelled'\s*\)/);
  assert.match(normalized, /check\s*\(\s*task_id\s*<>\s*depends_on_task_id\s*\)/);
  assert.match(normalized, /check\s*\(\s*ended_at\s+is\s+null\s+or\s+ended_at\s*>=\s*started_at\s*\)/);
});

test('schema adds operational indexes and enables RLS with authenticated-only grants', () => {
  for (const table of requiredTables) {
    assert.match(normalized, new RegExp(`alter table public\\.${table} enable row level security`), `RLS missing on ${table}`);
    assert.match(normalized, new RegExp(`revoke all on table public\\.${table} from anon`), `anon revoke missing on ${table}`);
  }
  assert.match(normalized, /create index[^;]*tasks[^;]*organization_id/);
  assert.match(normalized, /create index[^;]*tasks[^;]*process_id/);
  assert.match(normalized, /create index[^;]*tasks[^;]*status/);
  assert.match(normalized, /create index[^;]*tasks[^;]*due_at/);
  assert.match(normalized, /grant select[^;]*to authenticated/);
});

test('migration seeds the complete ATLAS 7.1 permission vocabulary without weakening admin', () => {
  const keys = [
    'operations.view','tasks.view','tasks.create','tasks.edit','tasks.assign',
    'tasks.complete','blockers.manage','workflow.advance','workflow.override','teams.manage'
  ];
  for (const key of keys) assert.ok(source.includes(`'${key}'`), `missing permission ${key}`);
  assert.match(normalized, /role_permissions/);
  assert.match(normalized, /on conflict\s*\(\s*organization_id\s*,\s*role\s*,\s*permission_key\s*\)/);
});
