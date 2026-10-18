import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const docs=readFileSync(new URL('../atlas-ops-v7-docs.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../atlas-ops-v7.css',import.meta.url),'utf8');
const company=readFileSync(new URL('../company-flow.js',import.meta.url),'utf8');
function isolated(client){
 const ctx={
  console:{error(){},warn(){}},
  window:{atlasAuth:{client,getProfile:()=>({id:'user',organization_id:'org'})}},
  document:{createElement(){throw Error('not needed')}},
  setTimeout:(fn)=>{queueMicrotask(fn);return 1},
  clearTimeout:()=>{}
 };
 vm.runInNewContext(docs,ctx,{filename:'atlas-ops-v7-docs.js'});
 return ctx.window.AtlasOpsV71Documents;
}
test('document table probe has timeout and safely terminates when network request never settles',async()=>{
 const never=new Promise(()=>{});
 const api=isolated({from:()=>({select:()=>({eq:()=>({limit:()=>never})})})});
 const result=await Promise.race([api.available(),new Promise(resolve=>setTimeout(()=>resolve('stuck'),100))]);
 assert.equal(result,false);
});
test('document post-save checklist cannot hold a successfully saved process hostage',async()=>{
 const api=isolated({
  from:()=>({select:()=>({eq:()=>({limit:()=>({data:[],error:null})})})}),
  rpc:()=>new Promise(()=>{})
 });
 const result=await Promise.race([api.afterProcessCreated('process-id'),new Promise(resolve=>setTimeout(()=>resolve('stuck'),100))]);
 assert.notEqual(result,'stuck');
 assert.match(result.error||'',/prazo|tempo|confirmar|indisponível/i);
});
test('opening checklist gives an explicit fallback and retry rather than indefinite loading',()=>{
 assert.match(docs,/Verificando modelos/);
 assert.match(docs,/Tentar novamente/);
 assert.match(docs,/não está ativad|indisponível/i);
 assert.match(docs,/aria-live="polite"/);
 assert.match(company,/checklist\?\.error/);
 assert.match(css,/\.v71-doc-new/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
});
