import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('completion patch exposes completed_at in system and reports', () => {
  const src = read('completion-date-v4.js');
  assert.match(src, /completed_at/);
  assert.match(src, /Data de conclusão/);
  assert.match(src, /process-table/);
});

test('sidebar patch creates expandable menu groups', () => {
  const src = read('sidebar-accordion-v4.js');
  assert.match(src, /nav-group-toggle/);
  assert.match(src, /aria-expanded/);
  assert.match(src, /nav-group-items/);
});

test('database rule clears and regenerates completion date', () => {
  const sql = read('supabase/migrations/20261008_process_completion_date_rule.sql');
  assert.match(sql, /new\.status = 'completed'/i);
  assert.match(sql, /new\.completed_at := now\(\)/i);
  assert.match(sql, /new\.completed_at := null/i);
});
