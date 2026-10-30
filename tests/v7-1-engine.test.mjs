import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadEngine({permission=true}={}) {
  const calls=[];
  const events=[];
  const data={
    async rpc(name,args){ calls.push({name,args}); return {ok:true,name,args}; }
  };
  class CustomEvent { constructor(type,init={}){ this.type=type; this.detail=init.detail; } }
  const sandbox={
    window:{AtlasOpsV71Data:data,AtlasOpsV71Sla:{},atlasHasPermission:()=>permission},
    document:{dispatchEvent:event=>{events.push(event);return true;}},
    CustomEvent,
    console
  };
  const source=readFileSync(new URL('../atlas-ops-v7-engine.js',import.meta.url),'utf8');
  vm.runInNewContext(source,sandbox,{filename:'atlas-ops-v7-engine.js'});
  return {engine:sandbox.window.AtlasOpsV71Engine,calls,events};
}

test('engine exposes approved ATLAS 7.1 command API',()=>{
  const {engine}=loadEngine();
  for(const name of ['activateProcess','createManualTask','setPrimaryTask','startTask','completeTask','openBlocker','closeBlocker','advanceStage']){
    assert.equal(typeof engine[name],'function',name);
  }
});

test('engine normalizes activation and task RPC arguments',async()=>{
  const {engine,calls}=loadEngine();
  await engine.activateProcess('p1',['tpl1']);
  await engine.createManualTask({processId:'p1',stageId:'s1',title:'  Protocolar DBE  ',description:'  Conferir antes  ',required:true,priority:'high',assigneeId:'u1',teamId:'team1',dueAt:'2026-10-20T12:00:00Z'});
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{name:'atlas_v71_activate_process',args:{p_process_id:'p1',p_template_ids:['tpl1']}});
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])),{name:'atlas_v71_create_task',args:{p_process_id:'p1',p_stage_id:'s1',p_title:'Protocolar DBE',p_description:'Conferir antes',p_required:true,p_priority:'high',p_assignee_id:'u1',p_team_id:'team1',p_due_at:'2026-10-20T12:00:00Z'}});
});

test('manual task and blocker reject incomplete user input before RPC',async()=>{
  const {engine,calls}=loadEngine();
  await assert.rejects(()=>engine.createManualTask({processId:'p1',stageId:'s1',title:'   '}),/título/i);
  await assert.rejects(()=>engine.createManualTask({title:'Teste',stageId:'s1'}),/processo/i);
  await assert.rejects(()=>engine.openBlocker({processId:'p1',type:'client',reason:'   '}),/motivo/i);
  await assert.rejects(()=>engine.openBlocker({processId:'p1',reason:'Aguardando'}),/tipo/i);
  assert.equal(calls.length,0);
});

test('engine maps task, primary and blocker commands to authoritative RPC names',async()=>{
  const {engine,calls}=loadEngine();
  await engine.setPrimaryTask('p1','t1');
  await engine.setPrimaryTask('p1','t2');
  await engine.startTask('t2');
  await engine.completeTask('t2');
  await engine.openBlocker({processId:'p1',taskId:'t3',type:'agency',reason:'Aguardando Prefeitura',pausesSla:true});
  await engine.closeBlocker('b1');
  assert.deepEqual(calls.map(c=>c.name),[
    'atlas_v71_set_primary_task','atlas_v71_set_primary_task','atlas_v71_start_task','atlas_v71_complete_task','atlas_v71_open_blocker','atlas_v71_close_blocker'
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].args)),{p_process_id:'p1',p_task_id:'t2'});
  assert.equal(engine.primaryTaskFor('p1'),'t2');
});

test('forced advance requires justification before contacting database',async()=>{
  const {engine,calls}=loadEngine();
  await assert.rejects(()=>engine.advanceStage('p1',{force:true,justification:'   '}),/justificativa/i);
  assert.equal(calls.length,0);
  await engine.advanceStage('p1',{force:true,justification:'Exceção aprovada pelo administrador'});
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{name:'atlas_v71_advance_stage',args:{p_process_id:'p1',p_force:true,p_justification:'Exceção aprovada pelo administrador'}});
});

test('successful commands emit a narrow process refresh event',async()=>{
  const {engine,events}=loadEngine();
  await engine.startTask('t1',{processId:'p9'});
  assert.equal(events.at(-1).type,'atlas:v71:changed');
  assert.equal(events.at(-1).detail.processId,'p9');
});

test('visible permission denial stops command before RPC',async()=>{
  const {engine,calls}=loadEngine({permission:false});
  await assert.rejects(()=>engine.completeTask('t1'),/permissão/i);
  assert.equal(calls.length,0);
});
