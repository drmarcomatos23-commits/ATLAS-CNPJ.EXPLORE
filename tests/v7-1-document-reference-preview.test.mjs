import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../atlas-ops-v7-docs.js',import.meta.url),'utf8');
const loader=readFileSync(new URL('../pwa-v5-1.js',import.meta.url),'utf8');

function missingSchemaClient(){
 const query={
  select(){return this;},
  eq(){return this;},
  limit(){return Promise.resolve({data:null,error:{code:'42P01',message:'relation does not exist'}});}
 };
 return {from(){return query;},rpc(){throw Error('Preview must not mutate an unavailable database');}};
}

function fixture(service='abertura'){
 const host={isConnected:true,innerHTML:'',textContent:''};
 const listeners={};
 const fields={
  '#proc-service':{value:service},
  '#proc-stage':{value:'initial-stage'},
  '#proc-client':{value:'sample-client'}
 };
 for(const [key,field] of Object.entries(fields))field.addEventListener=(name,listener)=>{listeners[key+':'+name]=listener;};
 let section;
 const footer={before(element){section=element;}};
 const form={querySelector(selector){return selector==='.modal-actions'?footer:
  selector==='[data-v71-doc-new]'?null:fields[selector]||null;}};
 const panel={isConnected:true,dataset:{v71DocProcess:'sample-process',v71DocKind:'documents'},
  innerHTML:'',matches:selector=>selector==='[data-v71-doc-process]'};
 const document={createElement:()=>({
  dataset:{},className:'',innerHTML:'',querySelector:selector=>selector==='[data-v71-doc-preview]'?host:null,
  addEventListener(){}
 })};
 const window={atlasAuth:{client:missingSchemaClient(),getProfile:()=>({id:'sample-user',organization_id:'sample-org'})}};
 vm.runInNewContext(source,{window,document,console:{warn(){},error(){}},setTimeout,clearTimeout},{filename:'atlas-ops-v7-docs.js'});
 return {api:window.AtlasOpsV71Documents,form,fields,listeners,host,panel,getSection:()=>section};
}

test('missing database templates show a useful opening checklist marked as non-persistent',async()=>{
 const {api,form,host,getSection}=fixture('abertura');
 await api.decorateNewProcessForm(form);
 assert.ok(getSection(),'checklist section was inserted into the new process form');
 assert.match(host.innerHTML,/Identificação e qualificação dos sócios/i);
 assert.match(host.innerHTML,/Endereço do estabelecimento/i);
 assert.match(host.innerHTML,/prévia orientativa/i);
 assert.match(host.innerHTML,/não (?:está|será) gravad/i);
 assert.doesNotMatch(host.innerHTML,/Verificando modelos/);
});

test('a provisional list is visible immediately while the configured models are being checked',async()=>{
 const {api,form,host}=fixture('abertura');
 const pending=api.decorateNewProcessForm(form);
 assert.match(host.innerHTML,/Identificação e qualificação dos sócios/i);
 assert.match(host.innerHTML,/Consultando modelos configurados/i);
 await pending;
});

test('changing service refreshes provisional requirements without mixing unrelated services',async()=>{
 const {api,form,fields,listeners,host}=fixture('abertura');
 await api.decorateNewProcessForm(form);
 fields['#proc-service'].value='baixa';
 listeners['#proc-service:change']();
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(host.innerHTML,/Distrato social|ato de extinção/i);
 assert.doesNotMatch(host.innerHTML,/Dados para elaboração do ato constitutivo/i);
});

test('the checklist heading remains accurate for services other than opening',async()=>{
 const {api,form,getSection}=fixture('baixa');
 await api.decorateNewProcessForm(form);
 assert.match(getSection().innerHTML,/Checklist documental do processo/i);
 assert.doesNotMatch(getSection().innerHTML,/Checklist de documentos na abertura/i);
});

test('existing process without document schema never suggests reference items are attached',async()=>{
 const {api,panel}=fixture('alteracao_societaria');
 api.bindProcessActions({querySelectorAll:()=>[panel]},
  {process:{id:'sample-process',service_type:'alteracao_societaria'}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(panel.innerHTML,/Checklist operacional indisponível/i);
 assert.doesNotMatch(panel.innerHTML,/Instrumento de alteração societária/i);
 assert.doesNotMatch(panel.innerHTML,/data-v71-doc-review|data-v71-doc-upload/,
  'a provisional preview must not display controls that imply persisted requirements');
});

test('a missing schema does not mislabel reference documents as formal exigencies',async()=>{
 const {api,panel}=fixture('abertura');
 panel.dataset.v71DocKind='exigencies';
 api.bindProcessActions({querySelectorAll:()=>[panel]},
  {process:{id:'sample-process',service_type:'abertura'}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(panel.innerHTML,/Exigências formais/i);
 assert.match(panel.innerHTML,/indisponíve/i);
 assert.doesNotMatch(panel.innerHTML,/Identificação e qualificação dos sócios/i);
});

test('preview has coverage for supported service types including historical encerramento',()=>{
 const {api}=fixture();
 for(const service of ['abertura','alteracao_societaria','baixa','encerramento','regularizacao','licenciamento','legalizacao_empresarial']){
  const titles=api.referenceTemplatesFor(service).map(item=>item.title);
  assert.ok(titles.length>=5,`service ${service} lacks a usable starter checklist`);
  assert.equal(new Set(titles).size,titles.length,`service ${service} duplicates a document`);
 }
 assert.deepEqual(
  [...api.referenceTemplatesFor('encerramento').map(item=>item.title)],
  [...api.referenceTemplatesFor('baixa').map(item=>item.title)]
 );
});

test('mobile PWA requests a fresh checklist script instead of reusing the cached V7.1 asset',()=>{
 const scripts=[];
 const document={querySelector:()=>null,createElement:()=>({dataset:{}}),head:{appendChild:s=>scripts.push(s)}};
 const window={addEventListener(){}};
 vm.runInNewContext(loader,{window,document,navigator:{serviceWorker:{}},console:{warn(){}},setTimeout,clearTimeout});
 const checklist=scripts.find(s=>s.src?.includes('atlas-ops-v7-docs.js'));
 assert.ok(checklist,'checklist script must be requested by the PWA');
 assert.match(checklist.src,/atlas-ops-v7-docs\.js\?v=7\.2-checklist/);
});
