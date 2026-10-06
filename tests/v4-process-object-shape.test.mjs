import test from 'node:test';
import assert from 'node:assert/strict';

test('lista e pipeline exibem nomes de etapa e responsavel em vez de objetos brutos', async()=>{
  globalThis.window=globalThis;
  globalThis.atlasCurrentProfile={role:'admin',full_name:'Marco Matos'};
  globalThis.esc=v=>String(v??'');
  globalThis.fmtDateBR=v=>v||'—';
  globalThis.setHead=()=>{};
  let body={innerHTML:''};
  globalThis.document={querySelector:(sel)=>sel==='#v4-process-body'?body:null,querySelectorAll:()=>[]};
  globalThis.page=()=>{};
  globalThis.loadOperationalData=async()=>({clients:[{id:'c1',legal_name:'RPA PRODUÇÕES E EVENTOS'}],processes:[{id:'p1',public_code:'LEG-2026-000016',client_id:'c1',service_type:'legalizacao_empresarial',stage:{id:'s1',name:'Constituição'},owner:{id:'u1',full_name:'Juliana Silva'},status:'in_progress'}],groups:[],templates:[],stages:[],profiles:[],protocols:[],costs:[],licenses:[]});
  globalThis.decorateProcesses=d=>d.processes;
  await import('../atlas-v4-core.js?procshape=1');
  await import('../operations-v4.js?procshape=1');
  await globalThis.processPage();
  assert.match(body.innerHTML,/Constitui[cç][aã]o/i);
  assert.match(body.innerHTML,/Juliana Silva/);
  assert.equal(body.innerHTML.includes('[object Object]'),false);
});
