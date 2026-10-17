import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read = path => existsSync(new URL('../'+path,import.meta.url)) ? readFileSync(new URL('../'+path,import.meta.url),'utf8') : '';
const sql=read('supabase/migrations/20261017_atlas_v7_1_document_exigencies.sql');
const module=read('atlas-ops-v7-docs.js');
const company=read('company-flow.js');
const process=read('atlas-ops-v7-process.js');
const loader=read('pwa-v5-1.js');
const roles=read('role-permissions.js');
const css=read('atlas-ops-v7.css');

test('additive document and formal exigences schema stays independent of production documents',()=>{
 for(const table of ['document_requirement_templates','process_document_requirements','process_document_versions','process_exigencies','process_exigency_evidence','process_document_events'])
   assert.match(sql,new RegExp('create table if not exists public\\.'+table));
 assert.doesNotMatch(sql,/drop table\s+public\.documents|truncate\s+public\.documents|alter table public\.documents drop/i);
 for(const token of ['organization_id','service_type','required_rule','stage_id','scope_state','scope_city','document_id','revision','reviewed_by','waiver_reason','agency','protocol_number','due_on','responded_at','accepted_at','created_by'])
   assert.ok(sql.includes(token),'schema missing '+token);
});
test('RLS and server-side authorization apply to requirements, versions and exigences',()=>{
 for(const table of ['document_requirement_templates','process_document_requirements','process_document_versions','process_exigencies','process_exigency_evidence','process_document_events']){
   assert.ok(sql.includes('alter table public.'+table+' enable row level security'),'RLS '+table);
   assert.ok(sql.includes("'"+table+"'"),'policy '+table);
 }
 for(const rpc of ['atlas_v71_init_document_checklist','atlas_v71_add_document_version','atlas_v71_review_document','atlas_v71_create_exigency','atlas_v71_mark_exigency_responded','atlas_v71_close_exigency'])
   assert.match(sql,new RegExp('function public\\.'+rpc+'\\('));
 assert.match(sql,/public\.current_org_id\(\)/);
 assert.match(sql,/public\.has_atlas_permission\(/);
 assert.match(sql,/waiver_reason|Justificativa/);
});
test('opening a process previews configured requirements and persists only after creation',()=>{
 assert.match(company,/AtlasOpsV71Documents\.decorateNewProcessForm/);
 assert.match(company,/AtlasOpsV71Documents\.afterProcessCreated/);
 assert.match(company,/insert\(payload\)\.select\('id'\)\.single\(\)/);
 assert.match(module,/decorateNewProcessForm/);
 assert.match(module,/afterProcessCreated/);
 assert.match(module,/atlas_v71_init_document_checklist/);
 assert.match(module,/document_requirement_templates/);
 assert.match(module,/proc-service/);
});
test('process-specific document management and official exigency response appear in the process modal',()=>{
 assert.match(process,/AtlasOpsV71Documents/);
 assert.match(process,/bindProcessActions/);
 assert.match(module,/Checklist documental/);
 assert.match(module,/Exigências formais/);
 assert.match(module,/Enviar arquivo/);
 assert.match(module,/Conferir documento/);
 assert.match(module,/Registrar exigência/);
 assert.match(module,/Registrar resposta/);
 assert.match(module,/Aceite pelo órgão/);
 assert.match(module,/createSignedUrl/);
 assert.match(module,/legalizacao-documents/);
 assert.match(module,/data-v71-doc-process/);
});
test('configurable administrative templates are permission gated and sensitive statuses require a recorded actor',()=>{
 assert.match(module,/Gerenciar modelos documentais/);
 assert.match(module,/documents\.templates\.manage/);
 assert.match(module,/documents\.review/);
 assert.match(module,/exigencies\.manage/);
 assert.match(sql,/process_document_events/);
 assert.match(roles,/documents\.templates\.manage/);
 assert.match(roles,/documents\.review/);
 assert.match(roles,/exigencies\.manage/);
});
test('loader and mobile styles preserve V7.1 process integration',()=>{
 assert.match(loader,/atlas-ops-v7-docs\.js\?v=7\.1/);
 assert.match(css,/\.v71-doc-panel/);
 assert.match(css,/@media\(max-width:760px\)[\s\S]*v71-doc-/);
});
