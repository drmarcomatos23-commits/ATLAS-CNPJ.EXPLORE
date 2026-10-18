import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>{const url=new URL('../'+path,import.meta.url);return existsSync(url)?readFileSync(url,'utf8'):'';};
const workflow=read('.github/workflows/atlas-v71-db-homologation.yml');
const fixture=read('tests/fixtures/atlas-v72-pg-integration.sql');
const baseline=read('tests/fixtures/atlas-v71-pg-baseline.sql');

test('ephemeral PostgreSQL applies v7.2 after both v7.1 migrations and runs v7.2 integration',()=>{
 const v71=workflow.indexOf('20261017_atlas_v7_1_document_exigencies.sql');
 const v72=workflow.indexOf('20261018_atlas_v7_2_checklist_operacional.sql');
 const pg=workflow.indexOf('tests/fixtures/atlas-v72-pg-integration.sql');
 assert.ok(v71>=0&&v72>v71&&pg>v72);
 assert.match(workflow,/feat\/atlas-checklist-operacional-v72/);
 assert.match(baseline,/create table public\.costs/i);
});

test('SQL integration covers idempotency, audit, foreign links, and nonblocking pending states',()=>{
 for(const expr of ['atlas_v72_init_document_checklist','atlas_v72_update_requirement','atlas_v72_add_manual_requirement','atlas_v72_reconcile_checklist','atlas_v71_add_document_version','atlas_v71_advance_stage'])
  assert.ok(fixture.includes(expr),expr);
 assert.match(fixture,/pending_with/);
 assert.match(fixture,/stage_transitions/);
 assert.match(fixture,/process_document_events/);
 assert.match(fixture,/payment_status/);
 assert.match(fixture,/other.organization|outra organização|cross.?tenant/i);
});
