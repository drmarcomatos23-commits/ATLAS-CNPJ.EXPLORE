import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window=globalThis;
await import('../atlas-v4-core.js');
const C=globalThis.AtlasV4Core;
const now=new Date('2026-10-06T12:00:00');
test('classifica prazos sem falsos atrasos',()=>{
 assert.equal(C.classifyDeadline({},now),'none');
 assert.equal(C.classifyDeadline({due_date:'2026-10-06',status:'open'},now),'today');
 assert.equal(C.classifyDeadline({due_date:'2026-10-07',status:'open'},now),'tomorrow');
 assert.equal(C.classifyDeadline({due_date:'2026-10-10',status:'open'},now),'upcoming');
 assert.equal(C.classifyDeadline({due_date:'2026-10-05',status:'open'},now),'overdue');
 assert.equal(C.classifyDeadline({due_date:'2026-10-05',status:'completed'},now),'none');
 assert.equal(C.classifyDeadline({due_date:'invalida',status:'open'},now),'none');
});
test('financeiro nunca fica negativo ou NaN',()=>{
 const m=C.buildDashboardMetrics({processes:[],costs:[{fee_kind:'honorarios',amount:100,payment_status:'paid'},{fee_kind:'honorarios',amount:'abc',payment_status:'pending'},{cost_type:'tax',amount:50,payment_status:'paid'}],licenses:[],clients:[]},now);
 assert.equal(m.honorariosAReceber,0);assert.equal(m.taxasAPagar,0);
});
test('agrupa licenças por vencimento e ignora não aplicáveis',()=>{
 const b=C.bucketLicenses([{expires_at:'2026-10-05',status:'active'},{expires_at:'2026-10-20',status:'active'},{expires_at:'2026-11-20',status:'active'},{expires_at:'2026-12-20',status:'active'},{expires_at:'2027-02-01',status:'active'},{expires_at:'2026-10-10',status:'not_applicable'},{status:'active'}],now);
 assert.deepEqual(Object.fromEntries(Object.entries(b).map(([k,v])=>[k,v.length])),{vencidas:1,ate30:1,d31a60:1,d61a90:1,regulares:1});
});
test('fila de hoje exclui encerrados e ordena atrasados primeiro',()=>{
 const q=C.buildTodayQueue([{id:'b',due_date:'2026-10-06',status:'open',priority:'normal'},{id:'a',due_date:'2026-10-05',status:'open',priority:'normal'},{id:'c',due_date:'2026-10-01',status:'completed',priority:'high'}],now);
 assert.deepEqual(q.map(x=>x.id),['a','b']);
});
test('edição só para admin operação e financeiro',()=>{
 assert.equal(C.canEditForRole('admin'),true);assert.equal(C.canEditForRole('operacao'),true);assert.equal(C.canEditForRole('financeiro'),true);assert.equal(C.canEditForRole('cliente'),false);assert.equal(C.canEditForRole('auditoria'),false);
});
