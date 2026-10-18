import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261018_atlas_v7_2_checklist_operacional.sql').toLowerCase();
const process=read('atlas-ops-v7-process.js');
const data=read('atlas-ops-v7-data.js');
const legacy=read('legalizacao.js');

test('v7.2 advance RPC records all four pending domains without using them as blockers',()=>{
 const at=sql.lastIndexOf('create or replace function public.atlas_v71_advance_stage');
 assert.ok(at>=0,'v7.2 override must replace old gate');
 const body=sql.slice(at);
 for(const token of ['v_pending','v_doc_pending','v_exigency_pending','v_cost_pending','stage_transitions','jsonb_build_object','from public.costs'])
  assert.ok(body.includes(token),`missing ${token}`);
 assert.doesNotMatch(body,/if\s+v_(?:pending|doc_pending|exigency_pending|cost_pending)\s*>\s*0\s+and\s+not\s+p_force/);
 assert.match(body,/workflow\.advance/);
 assert.match(body,/from public\.task_templates/);
});

test('advance button remains available for authorized actor despite unfinished items',()=>{
 const at=process.indexOf('function readiness(model)');
 const end=process.indexOf('\n  function overview',at);
 assert.ok(at>0&&end>at);
 const body=process.slice(at,end);
 assert.match(body,/data-v71-stage-advance/);
 assert.doesNotMatch(body,/data-v71-force-advance/);
 assert.doesNotMatch(body,/Etapa ainda não pode ser concluída|Avanço indisponível/);
 assert.match(body,/pendências|pendente/i);
});

test('process loader includes original costs so advisory totals include finance',()=>{
 assert.match(data,/scoped\('costs','\*',q\s*=>\s*q\.eq\('process_id',processId\)\)/);
 assert.match(process,/costs:detail\.costs/);
});

test('process list quick-advance also uses advisory-only RPC, never a direct stage update',()=>{
 const start=legacy.indexOf('async function advanceProcess(id)');
 const end=legacy.indexOf('window.advanceProcess=advanceProcess',start);
 assert.ok(start>=0&&end>start);
 const body=legacy.slice(start,end);
 assert.match(body,/atlas_v71_advance_stage/);
 assert.doesNotMatch(body,/\.from\('processes'\)\.update\(patch\)/);
});
