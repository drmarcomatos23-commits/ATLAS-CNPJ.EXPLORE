import test from 'node:test';import assert from 'node:assert/strict';
test('dashboard aceita processo decorado com stage e owner como objetos',async()=>{
 globalThis.window=globalThis;
 globalThis.document={querySelector:()=>({textContent:'Marco'}),getElementById:()=>null,createElement:()=>({id:'',textContent:'',style:{}}),head:{appendChild(){}},body:{},addEventListener(){}};
 globalThis.esc=v=>String(v??'');globalThis.money=v=>String(v??0);globalThis.fmtDateBR=v=>v||'—';
 globalThis.setHead=()=>{};let rendered='';globalThis.page=h=>{rendered=h};
 globalThis.atlasCurrentProfile={role:'admin',full_name:'Marco Matos'};
 globalThis.loadOperationalData=async()=>({clients:[{id:'c1',legal_name:'Empresa A'}],groups:[],processes:[{id:'p1',public_code:'LEG-1',client_id:'c1',current_stage_id:'s1',owner_id:'u1',status:'in_progress',due_date:'2026-10-06'}],templates:[],stages:[{id:'s1',name:'Viabilidade'}],profiles:[{id:'u1',full_name:'João Silva',role:'operacao',active:true}],protocols:[],costs:[],licenses:[]});
 globalThis.decorateProcesses=d=>{const sm=new Map(d.stages.map(x=>[x.id,x])),pm=new Map(d.profiles.map(x=>[x.id,x]));return d.processes.map(p=>({...p,stage:sm.get(p.current_stage_id),owner:pm.get(p.owner_id)}));};
 await import('../atlas-v4-core.js?realshape=2');await import('../dashboard-v4.js?realshape=2');
 await globalThis.dashboard();
 assert.ok(rendered.includes('Viabilidade'));assert.ok(rendered.includes('João Silva'));assert.ok(rendered.includes('Saúde da Operação'));
});
