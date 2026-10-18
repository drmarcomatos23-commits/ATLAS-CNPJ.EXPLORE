import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../atlas-ops-v7-pending.js',import.meta.url),'utf8');
function pending(){const window={};vm.runInNewContext(source,{window});return window.AtlasOpsV72Pending;}

test('pending items identify their source and do not duplicate finance or agency records',()=>{
 const api=pending();
 const summary=api.summarize({
  requirements:[{id:'doc-1',process_id:'p1',title:'Identidade',status:'requested',pending_with:'cliente',due_on:'2026-10-17'}],
  costs:[{id:'cost-1',process_id:'p1',description:'Taxa Junta',payment_status:'pending',due_date:'2026-10-20'},
   {id:'cost-2',process_id:'p1',description:'Pago',payment_status:'paid'},
   {id:'cost-3',process_id:'p1',description:'Recebimento financeiro',payment_status:'received'}],
  exigencies:[{id:'gov-1',process_id:'p1',title:'Exigência Junta',status:'open',due_on:'2026-10-19'},
   {id:'gov-2',process_id:'p1',title:'Deferida',status:'accepted'}],
  tasks:[{id:'task-1',process_id:'p1',title:'Minuta',status:'pending',due_at:'2026-10-25'}],
  asOf:'2026-10-18'
 });
 assert.equal(summary.totalOpen,4);
 assert.deepEqual([...summary.items.map(x=>x.source_type)].sort(),['cost','document','exigency','task']);
 assert.equal(summary.byOrigin.cliente,1);
 assert.equal(summary.byOrigin.financeiro,1);
 assert.equal(summary.byOrigin.orgao,1);
 assert.equal(summary.byOrigin.operacao,1);
 assert.equal(summary.overdue,1);
 assert.equal(summary.dueSoon,2);
});

test('same source id only counts once; empty collections produce zero totals',()=>{
 const api=pending();
 const empty=api.summarize({requirements:[],costs:[],exigencies:[],tasks:[],asOf:'2026-10-18'});
 assert.equal(empty.totalOpen,0);
 const row={id:'r1',process_id:'p1',status:'requested',pending_with:'cliente'};
 const summary=api.summarize({requirements:[row,row],asOf:'2026-10-18'});
 assert.equal(summary.totalOpen,1);
});
