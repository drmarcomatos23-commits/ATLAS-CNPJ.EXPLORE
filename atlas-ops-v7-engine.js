(() => {
  const Data = window.AtlasOpsV71Data;
  const primaryByProcess = new Map();

  function required(value,label){
    const normalized=String(value??'').trim();
    if(!normalized)throw new TypeError(`${label} é obrigatório`);
    return normalized;
  }

  function permission(key){
    if(typeof window.atlasHasPermission==='function'&&!window.atlasHasPermission(key)){
      throw new Error(`Sem permissão: ${key}`);
    }
  }

  async function call(name,args,processId){
    if(!Data?.rpc)throw new Error('ATLAS 7.1: adaptador de dados indisponível');
    const result=await Data.rpc(name,args);
    if(result?.available===false)throw new Error('ATLAS 7.1: recurso operacional indisponível');
    if(typeof document!=='undefined'&&typeof CustomEvent!=='undefined'){
      document.dispatchEvent(new CustomEvent('atlas:v71:changed',{detail:{processId:processId||null,command:name}}));
    }
    return result;
  }

  async function activateProcess(processId,templateIds=[]){
    permission('workflow.advance');
    const id=required(processId,'Processo');
    const ids=Array.isArray(templateIds)?templateIds.filter(Boolean):[];
    return call('atlas_v71_activate_process',{p_process_id:id,p_template_ids:ids.length?ids:null},id);
  }

  async function createManualTask(input={}){
    permission('tasks.create');
    const processId=required(input.processId,'Processo');
    const stageId=required(input.stageId,'Etapa');
    const title=required(input.title,'Título');
    const description=String(input.description??'').trim()||null;
    const priority=['low','normal','high','critical'].includes(input.priority)?input.priority:'normal';
    return call('atlas_v71_create_task',{
      p_process_id:processId,
      p_stage_id:stageId,
      p_title:title,
      p_description:description,
      p_required:Boolean(input.required),
      p_priority:priority,
      p_assignee_id:input.assigneeId||null,
      p_team_id:input.teamId||null,
      p_due_at:input.dueAt||null
    },processId);
  }

  async function setPrimaryTask(processId,taskId){
    permission('tasks.edit');
    const pid=required(processId,'Processo');
    const tid=required(taskId,'Tarefa');
    const result=await call('atlas_v71_set_primary_task',{p_process_id:pid,p_task_id:tid},pid);
    primaryByProcess.set(pid,tid);
    return result;
  }

  function primaryTaskFor(processId){return primaryByProcess.get(String(processId??'').trim())||null;}

  async function startTask(taskId,options={}){
    permission('tasks.edit');
    const tid=required(taskId,'Tarefa');
    return call('atlas_v71_start_task',{p_task_id:tid},options.processId||null);
  }

  async function completeTask(taskId,options={}){
    permission('tasks.complete');
    const tid=required(taskId,'Tarefa');
    return call('atlas_v71_complete_task',{p_task_id:tid},options.processId||null);
  }

  async function openBlocker(input={}){
    permission('blockers.manage');
    const processId=required(input.processId,'Processo');
    const type=required(input.type,'Tipo');
    const reason=required(input.reason,'Motivo');
    if(!['client','agency','external_finance','third_party','internal'].includes(type))throw new TypeError('Tipo de bloqueio inválido');
    return call('atlas_v71_open_blocker',{
      p_process_id:processId,
      p_task_id:input.taskId||null,
      p_type:type,
      p_reason:reason,
      p_pauses_sla:Boolean(input.pausesSla)
    },processId);
  }

  async function closeBlocker(blockerId,options={}){
    permission('blockers.manage');
    const id=required(blockerId,'Bloqueio');
    return call('atlas_v71_close_blocker',{p_blocker_id:id},options.processId||null);
  }

  async function advanceStage(processId,{force=false,justification=''}={}){
    permission('workflow.advance');
    const id=required(processId,'Processo');
    const note=String(justification??'').trim();
    if(force){
      permission('workflow.override');
      if(!note)throw new TypeError('Justificativa é obrigatória para avanço forçado');
    }
    return call('atlas_v71_advance_stage',{p_process_id:id,p_force:Boolean(force),p_justification:note||null},id);
  }

  window.AtlasOpsV71Engine=Object.freeze({
    activateProcess,
    createManualTask,
    setPrimaryTask,
    primaryTaskFor,
    startTask,
    completeTask,
    openBlocker,
    closeBlocker,
    advanceStage
  });
})();
