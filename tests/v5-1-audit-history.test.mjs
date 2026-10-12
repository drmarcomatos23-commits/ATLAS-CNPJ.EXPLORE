import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const migrationPath = 'supabase/migrations/20261012_audit_history_v5_1.sql';
const company360 = readFileSync('company-360-v5.js', 'utf8');

test('V5.1 registra auditoria automaticamente nas entidades operacionais', () => {
  assert.equal(existsSync(migrationPath), true, 'a migration de auditoria da V5.1 deve existir');
  const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

  assert.match(migration, /insert\s+into\s+public\.audit_logs/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /create\s+trigger\s+atlas_audit_clients/i);
  assert.match(migration, /create\s+trigger\s+atlas_audit_processes/i);
  assert.match(migration, /create\s+trigger\s+atlas_audit_costs/i);
  assert.match(migration, /create\s+trigger\s+atlas_audit_licenses/i);
  assert.match(migration, /create\s+trigger\s+atlas_audit_documents/i);
  assert.match(migration, /create\s+trigger\s+atlas_audit_client_partners/i);
});

test('Empresa 360 exibe histórico operacional a partir de audit_logs', () => {
  assert.match(company360, /db\.from\('audit_logs'\)/);
  assert.match(company360, /Histórico operacional/);
  assert.match(company360, /auditLogs/);
  assert.match(company360, /entity_type/);
  assert.match(company360, /created_at/);
});
