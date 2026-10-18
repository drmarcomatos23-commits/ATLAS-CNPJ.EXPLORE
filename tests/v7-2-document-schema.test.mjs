import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const path=new URL('../supabase/migrations/20261018_atlas_v7_2_checklist_operacional.sql',import.meta.url);
const sql=existsSync(path)?readFileSync(path,'utf8'):'';

test('v7.2 uses additive migration and maps previous states to canonical checklist workflow',()=>{
 assert.ok(sql.length>100,'missing v7.2 migration');
 assert.doesNotMatch(sql,/drop table\s+public\.(documents|process_document_requirements)/i);
 for(const field of ['applicability','pending_with','assigned_to','notes','requested_at','received_at','resolved_at','archived_at','service_type_snapshot','manual_key'])
  assert.match(sql,new RegExp(String.raw`\b${field}\b`),field);
 for(const state of ['not_requested','requested','received','in_review','approved','returned','waived'])
  assert.ok(sql.includes(`'${state}'`),state);
 for(const origin of ['cliente','financeiro','orgao','operacao'])assert.ok(sql.includes(`'${origin}'`),origin);
 assert.match(sql,/when\s+'pending'\s+then\s+'not_requested'/i);
 assert.match(sql,/when\s+'submitted'\s+then\s+'received'/i);
 assert.match(sql,/when\s+'rejected'\s+then\s+'returned'/i);
 assert.match(sql,/set default 'not_requested'/i);
});

test('document RPCs are invoker-scoped and audited by authenticated server actor',()=>{
 for(const name of ['atlas_v72_init_document_checklist','atlas_v72_update_requirement','atlas_v72_add_manual_requirement','atlas_v72_reconcile_checklist']){
  const start=sql.toLowerCase().indexOf('create or replace function public.'+name);
  assert.ok(start>=0,name);
  const body=sql.slice(start,sql.indexOf('$$;',start)+3).toLowerCase();
  assert.match(body,/security invoker/,name);
  assert.match(body,/current_org_id\(\)/,name);
  assert.match(body,/has_atlas_permission/,name);
 }
 assert.match(sql,/process_document_events/i);
 assert.match(sql,/auth\.uid\(\)/i);
 assert.match(sql,/on conflict\s*\(process_id,template_id\)\s*do nothing/i);
 assert.match(sql,/p_manual_key\s+uuid/i);
 assert.match(sql,/p_instructions\s+text/i);
 assert.match(sql,/organization_id\s*=\s*public\.current_org_id\(\)/i);
 assert.match(sql,/document_id/i);
 assert.match(sql,/assigned_to/i);
 assert.match(sql,/v_new_status='received' and v_req\.document_id is null/i);
 assert.match(sql,/new\.reviewed_by is distinct from auth\.uid\(\)/i);
 assert.match(sql,/new\.created_by is distinct from auth\.uid\(\)/i);
});

test('document permissions and cross-process link validation remain on the server',()=>{
 assert.match(sql,/public\.atlas_v71_document_validate_links\(\)/i);
 assert.match(sql,/organization_id/i);
 assert.match(sql,/process_id/i);
 assert.match(sql,/documents\.review/i);
 assert.match(sql,/documents\.upload/i);
 assert.match(sql,/revoke all on function public\.atlas_v72_update_requirement/i);
 assert.match(sql,/grant execute on function public\.atlas_v72_update_requirement/i);
 assert.match(sql,/has_atlas_permission\('documents\.view'\) or public\.has_atlas_permission\('documents\.review'\)/i);
 assert.match(sql,/drop policy if exists v71_doc_requirement_write/i);
 assert.match(sql,/create policy v72_doc_requirement_insert[\s\S]*for insert[\s\S]*processes\.create/i);
 assert.match(sql,/create policy v72_doc_requirement_update[\s\S]*for update[\s\S]*documents\.review/i);
 assert.match(sql,/\('auditoria','documents\.view',true\)/i);
 assert.match(sql,/\('financeiro','documents\.view',true\)/i);
 assert.match(sql,/\('cliente','documents\.view',false\)/i);
});
