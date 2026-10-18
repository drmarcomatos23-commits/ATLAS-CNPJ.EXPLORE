import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../atlas-ops-v7-doc-model.js',import.meta.url),'utf8');
function model(){const window={};vm.runInNewContext(source,{window},{filename:'atlas-ops-v7-doc-model.js'});return window.AtlasOpsV72DocumentModel;}

test('seven services have distinct identities and service-specific documentary requirements',()=>{
 const api=model();
 for(const service of ['abertura','alteracao_societaria','regularizacao','licenciamento','baixa','encerramento','legalizacao_empresarial']){
  assert.equal(api.normalizeService(service),service);
  assert.ok(api.referenceTemplatesFor(service).length>=5,service);
 }
 assert.notDeepEqual([...api.referenceTemplatesFor('abertura').map(x=>x.title)],[...api.referenceTemplatesFor('licenciamento').map(x=>x.title)]);
 assert.notDeepEqual([...api.referenceTemplatesFor('encerramento').map(x=>x.title)],[...api.referenceTemplatesFor('baixa').map(x=>x.title)]);
 assert.equal(api.normalizeService('desconhecido'),null);
 assert.equal(api.referenceTemplatesFor('desconhecido').length,0);
});

test('document workflow never approves without evidence or waives without justification',()=>{
 const api=model();
 assert.equal(api.canTransition('received','approved',{hasEvidence:false,reason:''}).ok,false);
 assert.equal(api.canTransition('received','approved',{hasEvidence:true,reason:''}).ok,true);
 assert.equal(api.canTransition('requested','waived',{hasEvidence:false,reason:' '}).ok,false);
 assert.equal(api.canTransition('requested','waived',{hasEvidence:false,reason:'Não aplicável'}).ok,true);
 assert.equal(api.canTransition('received','returned',{hasEvidence:true,reason:''}).ok,false);
 assert.equal(api.canTransition('received','returned',{hasEvidence:true,reason:'Arquivo ilegível'}).ok,true);
  assert.equal(api.canTransition('requested','received',{hasEvidence:false,reason:''}).ok,false);
  assert.equal(api.canTransition('requested','received',{hasEvidence:false,reason:'Recebido em papel no atendimento'}).ok,true);
 assert.equal(api.canTransition('approved','requested',{hasEvidence:true,reason:'Reaberto'}).ok,true);
});

test('summary separates documentary stage, origin and due date without treating received as complete',()=>{
 const api=model();
 const rows=[
  {id:'a',status:'received',pending_with:'operacao',due_on:'2026-10-17'},
  {id:'b',status:'requested',pending_with:'cliente',due_on:'2026-10-20'},
  {id:'c',status:'approved',pending_with:null,due_on:'2026-10-10'},
  {id:'d',status:'waived',pending_with:null},
  {id:'e',status:'in_review',pending_with:'financeiro'}
 ];
 const summary=api.summarizeRequirements(rows,'2026-10-18');
 assert.equal(summary.total,5);
 assert.equal(summary.completed,2);
 assert.equal(summary.open,3);
 assert.equal(summary.overdue,1);
 assert.equal(summary.dueSoon,1);
 assert.equal(summary.byOrigin.cliente,1);
 assert.equal(summary.byOrigin.financeiro,1);
 assert.equal(summary.byOrigin.operacao,1);
});
