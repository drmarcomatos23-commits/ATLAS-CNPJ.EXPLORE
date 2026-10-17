(() => {
  const Data=window.AtlasOpsV71Data;
  const Engine=window.AtlasOpsV71Engine;
  const Sla=window.AtlasOpsV71Sla;
  const UI=window.AtlasOpsV71UI;
  const legacyOpenProcess=window.openAtlasV4Process;
  const ACTIVE=new Set(['pending','in_progress','waiting_client','waiting_agency','waiting_finance','blocked']);
  let currentProcessId=null;
  let currentDetail=null;
  let currentTab='overview';

  const e=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const has=key=>typeof window.atlasHasPermission==='function'&&window.atlasHasPermission(key);
  const fmtDate=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR');};
  const fmtDateTime=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});};
  const processCode=p=>p?.public_code||p?.title||p?.id||'—';
  const clientName=c=>c?.legal_name||c?.trade_name||c?.name||c?.razao_social||'—';
  const profileName=(detail,id)=>detail.profiles?.find(p=>p.id===id)?.full_name||'Não atribuído';
  const teamName=(detail,id)=>detail.teams?.find(t=>t.id===id)?.name||'Sem equipe';
  const stageById=(detail,id)=>detail.stages?.find(s=>s.id===id)||null;
  const activeTask=task=>ACTIVE.has(String(task?.status||''));
  const statusLabel=status=>({pending:'Pendente',in_progress:'Em andamento',waiting_client:'Aguardando cliente',waiting_agency:'Aguardando órgão',waiting_finance:'Aguardando financeiro',blocked:'Bloqueada',completed:'Concluída',cancelled:'Cancelada'})[status]||String(status||'—').replaceAll('_',' ');
  const statusTone=status=>status==='completed'?'success':status==='blocked'?'danger':['waiting_client','waiting_agency','waiting_finance'].includes(status)?'warning':status==='in_progress'?'info':'';

  function dayDiff(start,end=new Date()){
    const a=new Date(start);const b=end instanceof Date?end:new Date(end);
    if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return 0;
    return Math.max(0,Math.floor((b.getTime()-a.getTime())/86400000));
  }

  function processModel(detail){
    const process=detail.process;
    const operation=detail.operation;
    const currentStage=stageById(detail,operation?.current_stage_id||process?.current_stage_id);
    const stages=[...(detail.stages||[])].sort((a,b)=>(a.position||0)-(b.position||0));
    const currentPosition=currentStage?.position||0;
    const dependencies=new Map();
    for(const dep of detail.dependencies||[]){if(!dependencies.has(dep.task_id))dependencies.set(dep.task_id,[]);dependencies.get(dep.task_id).push(dep.depends_on_task_id);}
    const taskById=new Map((detail.tasks||[]).map(task=>[task.id,task]));
    const eligible=task=>activeTask(task)&&(dependencies.get(task.id)||[]).every(id=>taskById.get(id)?.status==='completed');
    const activeTasks=(detail.tasks||[]).filter(activeTask);
    const primary=activeTasks.find(task=>task.is_primary_action)||activeTasks.filter(eligible).sort((a,b)=>String(a.due_at||'9999').localeCompare(String(b.due_at||'9999')))[0]||null;
    const stageTasks=(detail.tasks||[]).filter(task=>task.stage_id===(currentStage?.id||process?.current_stage_id));
    const required=stageTasks.filter(task=>task.required);
    const unfinishedRequired=required.filter(task=>!['completed','cancelled'].includes(task.status));
    const ready=unfinishedRequired.length===0;
    const openBlockers=(detail.blockers||[]).filter(b=>!b.ended_at);
    let sla=null;
    if(operation?.stage_started_at&&currentStage?.sla_days!=null&&Sla?.slaSnapshot){
      try{sla=Sla.slaSnapshot({stageStartedAt:operation.stage_started_at,now:new Date().toISOString(),slaDays:Number(currentStage.sla_days),pauses:(detail.pauses||[]).map(p=>({start:p.started_at,end:p.ended_at})),holidays:detail.holidays||[]});}catch{}
    }
    const pauseIntervals=Sla?.mergePauseIntervals?Sla.mergePauseIntervals((detail.pauses||[]).map(p=>({start:p.started_at,end:p.ended_at||new Date().toISOString()}))):[];
    const blockedHours=pauseIntervals.reduce((sum,p)=>sum+Math.max(0,(new Date(p.end)-new Date(p.start))/3600000),0);
    return {process,operation,currentStage,stages,currentPosition,dependencies,taskById,eligible,activeTasks,primary,stageTasks,required,unfinishedRequired,ready,openBlockers,sla,blockedHours,totalDays:dayDiff(process?.started_at||process?.created_at)};
  }

  function modal(title,body){
    if(typeof window.modalShell==='function'){
      window.modalShell(title,body);
      return document.getElementById('atlas-modal-root')||document;
    }
    const root=document.getElementById('atlas-modal-root');
    if(root)root.innerHTML=`<div class="modal-backdrop"><div class="atlas-modal"><div class="atlas-modal-body"><h2>${e(title)}</h2>${body}</div></div></div>`;
    return root||document;
  }

  function closeModal(){if(typeof window.closeAtlasModal==='function')window.closeAtlasModal();else{const root=document.getElementById('atlas-modal-root');if(root)root.innerHTML='';}}

  function stageTrack(model){
    return `<div class="v71-stage-track">${model.stages.map(stage=>{
      const state=stage.id===model.currentStage?.id?'current':(stage.position||0)<model.currentPosition?'done':'upcoming';
      return `<div class="v71-stage-step ${state}"><span>${state==='done'?'✓':e(stage.position||'•')}</span><div><strong>${e(stage.name)}</strong><small>${stage.sla_days==null?'Sem SLA':`${e(stage.sla_days)} dias úteis`}</small></div></div>`;
    }).join('')}</div>`;
  }

  function metrics(model){
    const remaining=model.sla?.remainingBusinessDays;
    const slaText=model.sla?`${model.sla.elapsedBusinessDays} dias úteis`:'—';
    const state=model.sla?.state==='overdue'?'Fora do prazo':model.sla?.state==='due_today'?'Vence hoje':model.sla?'Dentro do prazo':'Sem SLA';
    return `<div class="v71-process-metrics">
      <div class="v71-metric"><small>Tempo total do processo</small><strong>${model.totalDays} dias</strong><span>dias corridos</span></div>
      <div class="v71-metric"><small>Tempo operacional interno</small><strong>${e(slaText)}</strong><span>desconta pausas externas válidas</span></div>
      <div class="v71-metric"><small>Tempo em bloqueio externo</small><strong>${Math.round(model.blockedHours/24*10)/10} dias</strong><span>${model.openBlockers.length} bloqueio(s) aberto(s)</span></div>
      <div class="v71-metric"><small>SLA da etapa atual</small><strong>${model.currentStage?.sla_days??'—'} dias úteis</strong><span>${e(state)}${remaining!=null?` · saldo ${remaining}`:''}</span></div>
    </div>`;
  }

  function primaryAction(model,detail){
    if(!model.primary)return '<section class="v71-primary-action"><span class="v71-primary-icon">→</span><div><small>Próxima Ação</small><strong>Nenhuma tarefa elegível definida</strong><p>Defina uma tarefa principal ou conclua as dependências pendentes.</p></div></section>';
    const task=model.primary;
    return `<section class="v71-primary-action"><span class="v71-primary-icon">▶</span><div><small>Próxima Ação</small><strong>${e(task.title)}</strong><p>Responsável: ${e(profileName(detail,task.assignee_id))} · Prazo: ${e(fmtDate(task.due_at))}${task.sla_days!=null?` · SLA: ${e(task.sla_days)} dias úteis`:''}</p></div><button class="btn btn-primary" type="button" data-v71-task-focus="${e(task.id)}">Abrir tarefa</button></section>`;
  }

  function taskActions(task,model){
    if(!activeTask(task))return '';
    const actions=[];
    if(has('tasks.edit')&&task.status==='pending')actions.push(`<button type="button" data-v71-task-start="${e(task.id)}">Iniciar</button>`);
    if(has('tasks.edit')&&!task.is_primary_action&&model.eligible(task))actions.push(`<button type="button" data-v71-task-primary="${e(task.id)}">Tornar principal</button>`);
    if(has('blockers.manage'))actions.push(`<button type="button" data-v71-task-block="${e(task.id)}">Bloquear</button>`);
    if(has('tasks.complete'))actions.push(`<button type="button" data-v71-task-complete="${e(task.id)}">Concluir</button>`);
    return `<div class="v71-task-actions">${actions.join('')}</div>`;
  }

  function tasksTable(model,detail,onlyCurrent=false){
    const tasks=(onlyCurrent?model.stageTasks:detail.tasks||[]).slice().sort((a,b)=>Number(b.is_primary_action)-Number(a.is_primary_action)||String(a.due_at||'9999').localeCompare(String(b.due_at||'9999')));
    if(!tasks.length)return '<div class="v71-empty">Nenhuma tarefa cadastrada.</div>';
    return `<div class="v71-process-tasks"><table><thead><tr><th>Tarefa</th><th>Responsável</th><th>Equipe</th><th>Prazo</th><th>Status</th><th>Prioridade</th><th>Ações</th></tr></thead><tbody>${tasks.map(task=>`<tr data-v71-task-row="${e(task.id)}"><td><strong>${e(task.title)}</strong>${task.is_primary_action?'<small>Próxima Ação Principal</small>':''}${task.required?'<small>Obrigatória</small>':''}</td><td>${e(profileName(detail,task.assignee_id))}</td><td>${e(teamName(detail,task.team_id))}</td><td>${e(fmtDate(task.due_at))}</td><td><span class="v71-badge ${statusTone(task.status)}">${e(statusLabel(task.status))}</span></td><td>${e(task.priority||'normal')}</td><td>${taskActions(task,model)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function blockers(model,detail){
    if(!(detail.blockers||[]).length)return '<div class="v71-empty">Nenhum bloqueio registrado.</div>';
    return `<div class="v71-blocker-list">${(detail.blockers||[]).slice().sort((a,b)=>String(b.started_at).localeCompare(String(a.started_at))).map(blocker=>`<article class="v71-blocker-card ${blocker.ended_at?'closed':'open'}"><div><span class="v71-badge ${blocker.ended_at?'':'warning'}">${e(blocker.blocker_type)}</span><strong>${e(blocker.reason)}</strong><small>Início: ${e(fmtDateTime(blocker.started_at))}${blocker.ended_at?` · Encerrado: ${e(fmtDateTime(blocker.ended_at))}`:' · Em aberto'}</small>${blocker.pauses_sla?'<em>SLA interno pausado neste período.</em>':''}</div>${!blocker.ended_at&&has('blockers.manage')?`<button class="btn btn-muted" type="button" data-v71-blocker-close="${e(blocker.id)}">Encerrar bloqueio</button>`:''}</article>`).join('')}</div>`;
  }

  function documents(detail){
    if(!(detail.documents||[]).length)return '<div class="v71-empty">Nenhum documento vinculado ao processo.</div>';
    return `<div class="v71-document-list">${detail.documents.map(doc=>`<div class="v71-document-row"><div><strong>${e(doc.name||'Documento')}</strong><small>${e(doc.category||doc.mime_type||'Arquivo')} · ${e(fmtDateTime(doc.created_at))}</small></div></div>`).join('')}</div>`;
  }

  function history(detail){
    const items=[...(detail.events||[]).map(item=>({at:item.created_at,label:`Tarefa · ${item.event_type}`,actor:item.actor_id,payload:item.payload})),...(detail.transitions||[]).map(item=>({at:item.transitioned_at,label:`Etapa · ${item.transition_type}`,actor:item.actor_id,payload:{from:item.from_stage_id,to:item.to_stage_id,justification:item.justification}}))].sort((a,b)=>new Date(b.at)-new Date(a.at));
    if(!items.length)return '<div class="v71-empty">Ainda não há histórico operacional.</div>';
    return `<div class="v71-history">${items.map(item=>`<div class="v71-history-row"><span></span><div><strong>${e(item.label)}</strong><small>${e(fmtDateTime(item.at))} · ${e(profileName(detail,item.actor))}</small>${item.payload?.justification?`<p>${e(item.payload.justification)}</p>`:''}</div></div>`).join('')}</div>`;
  }

  function readiness(model){
    if(model.ready&&has('workflow.advance'))return `<div class="v71-stage-ready"><div><strong>Etapa pronta para avanço</strong><span>Todas as tarefas obrigatórias desta etapa foram concluídas.</span></div><button class="btn btn-primary" type="button" data-v71-stage-advance>Concluir etapa e avançar</button></div>`;
    const force=has('workflow.override')?'<button class="btn btn-muted" type="button" data-v71-force-advance>Avançar com exceção</button>':'';
    return `<div class="v71-stage-ready pending"><div><strong>Etapa ainda não pode ser concluída</strong><span>${model.unfinishedRequired.length} tarefa(s) obrigatória(s) pendente(s).</span></div>${force}</div>`;
  }

  function overview(model,detail){
    return `<div class="v71-process-overview">${primaryAction(model,detail)}<div class="v71-process-columns"><section class="v71-panel"><div class="v71-panel-head"><h3>Tarefas da etapa — ${e(model.currentStage?.name||'Etapa atual')}</h3>${has('tasks.create')?'<button class="btn btn-primary" type="button" data-v71-new-task>＋ Nova Tarefa</button>':''}</div>${tasksTable(model,detail,true)}</section><aside class="v71-side-stack"><section class="v71-panel"><div class="v71-panel-head"><h3>Bloqueio atual</h3>${has('blockers.manage')?'<button class="btn btn-muted" type="button" data-v71-new-blocker>Novo bloqueio</button>':''}</div>${blockers(model,{...detail,blockers:model.openBlockers})}</section><section class="v71-panel"><div class="v71-panel-head"><h3>Avanço da etapa</h3><span>${model.required.length-model.unfinishedRequired.length}/${model.required.length} obrigatórias</span></div><div class="v71-ready-wrap">${readiness(model)}</div></section></aside></div></div>`;
  }

  function tabBody(tab,model,detail){
    if(tab==='tasks')return `<section class="v71-panel"><div class="v71-panel-head"><h3>Tarefas</h3>${has('tasks.create')?'<button class="btn btn-primary" type="button" data-v71-new-task>＋ Nova Tarefa</button>':''}</div>${tasksTable(model,detail,false)}</section>`;
    if(tab==='blockers')return `<section class="v71-panel"><div class="v71-panel-head"><h3>Bloqueios</h3>${has('blockers.manage')?'<button class="btn btn-primary" type="button" data-v71-new-blocker>Novo bloqueio</button>':''}</div>${blockers(model,detail)}</section>`;
    if(tab==='sla')return `<section class="v71-panel"><div class="v71-panel-head"><h3>SLA e Prazos</h3><span>Tempo total x responsabilidade interna</span></div><div class="v71-sla-detail">${metrics(model)}${blockers(model,detail)}</div></section>`;
    if(tab==='documents')return `<section class="v71-panel"><div class="v71-panel-head"><h3>Documentos</h3><span>${detail.documents?.length||0} arquivo(s)</span></div>${window.AtlasOpsV71Documents?.documentPanel(detail)||documents(detail)}</section>`;
    if(tab==='exigencies')return `<section class="v71-panel">${window.AtlasOpsV71Documents?.exigenciesPanel(detail)||'<div class="v71-empty">Exigências indisponíveis</div>'}</section>`;
    if(tab==='history')return `<section class="v71-panel"><div class="v71-panel-head"><h3>Histórico</h3><span>Trilha operacional</span></div>${history(detail)}</section>`;
    return overview(model,detail);
  }

  function processHtml(detail){
    const model=processModel(detail);const p=detail.process;
    const owner=profileName(detail,p.owner_id);
    return `<div class="v71-process" data-v71-process="${e(p.id)}"><div class="v71-process-head"><div><small>Processo</small><h2>${e(processCode(p))}</h2><span class="v71-badge info">${e(p.status||'Em andamento')}</span></div><div class="v71-process-meta"><div><small>Cliente</small><strong>${e(clientName(detail.client))}</strong></div><div><small>Serviço</small><strong>${e(p.service_type||p.title||'—')}</strong></div><div><small>Responsável</small><strong>${e(owner)}</strong></div><div><small>Data de abertura</small><strong>${e(fmtDate(p.started_at||p.created_at))}</strong></div><div><small>Prazo geral</small><strong>${e(fmtDate(p.due_date))}</strong></div></div></div>${stageTrack(model)}${metrics(model)}<div class="v71-process-tabs">${[['overview','Visão Geral'],['tasks','Tarefas'],['blockers','Bloqueios'],['sla','SLA e Prazos'],['documents','Documentos'],['exigencies','Exigências'],['history','Histórico']].map(([key,label])=>`<button type="button" data-v71-tab="${key}" class="${currentTab===key?'active':''}">${label}</button>`).join('')}</div><div class="v71-tab-body">${tabBody(currentTab,model,detail)}</div></div>`;
  }

  function legacyProcessHtml(detail){
    const p=detail.process||{};
    return `<div class="v71-process"><div class="v71-process-head"><div><small>Processo</small><h2>${e(processCode(p))}</h2><span class="v71-badge">Processo legado</span></div><div class="v71-process-meta"><div><small>Cliente</small><strong>${e(clientName(detail.client))}</strong></div><div><small>Serviço</small><strong>${e(p.service_type||p.title||'—')}</strong></div><div><small>Data de abertura</small><strong>${e(fmtDate(p.started_at||p.created_at))}</strong></div></div></div><div class="v71-legacy-activation"><strong>Ativar Central Operacional neste processo</strong><p>O Atlas identificará a etapa atual e apresentará as tarefas propostas para sua revisão antes de criar qualquer pendência.</p><button class="btn btn-primary" type="button" data-v71-activate-legacy>Revisar tarefas propostas</button></div>${window.AtlasOpsV71Documents?.documentPanel(detail)||''}${window.AtlasOpsV71Documents?.exigenciesPanel(detail)||''}</div>`;
  }

  function renderDetail(detail){
    currentDetail=detail;
    const root=modal(`Processo ${processCode(detail.process)}`,detail.operation?processHtml(detail):legacyProcessHtml(detail));
    bindDetail(root,detail);
    window.AtlasOpsV71Documents?.bindProcessActions?.(root,detail);
  }

  async function refreshProcess(){
    if(!currentProcessId)return;
    const detail=await Data.loadProcess(currentProcessId);
    detail.holidays=await Data.loadHolidays();
    if(detail?.available)renderDetail(detail);
  }

  function taskModal(detail){
    const model=processModel(detail);const stageId=model.currentStage?.id||detail.process.current_stage_id;
    const root=modal('Nova Tarefa',`<form class="v71-form" data-v71-task-form><label>Título<input name="title" required></label><label>Descrição<textarea name="description"></textarea></label><div class="v71-form-grid"><label>Prazo<input name="due" type="date"></label><label>Prioridade<select name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option><option value="low">Baixa</option></select></label><label>Responsável<select name="assignee"><option value="">Não atribuído</option>${(detail.profiles||[]).filter(p=>p.active!==false).map(p=>`<option value="${e(p.id)}">${e(p.full_name)}</option>`).join('')}</select></label><label>Equipe<select name="team"><option value="">Sem equipe</option>${(detail.teams||[]).filter(t=>t.active!==false).map(t=>`<option value="${e(t.id)}">${e(t.name)}</option>`).join('')}</select></label></div><label class="v71-check"><input name="required" type="checkbox"> Tarefa obrigatória para concluir a etapa</label><div class="v71-activation-actions"><button type="button" class="btn btn-muted" data-v71-form-cancel>Cancelar</button><button class="btn btn-primary" type="submit">Criar tarefa</button></div></form>`);
    root.querySelector('[data-v71-form-cancel]')?.addEventListener('click',()=>renderDetail(detail));
    root.querySelector('[data-v71-task-form]')?.addEventListener('submit',async event=>{
      event.preventDefault();const form=new FormData(event.currentTarget);
      await Engine.createManualTask({processId:detail.process.id,stageId,title:form.get('title'),description:form.get('description'),required:form.get('required')==='on',priority:form.get('priority'),assigneeId:form.get('assignee')||null,teamId:form.get('team')||null,dueAt:form.get('due')?`${form.get('due')}T12:00:00`:null});
      await refreshProcess();
    });
  }

  function blockerModal(detail,taskId=null){
    const root=modal('Registrar bloqueio',`<form class="v71-form" data-v71-blocker-form><label>Tipo<select name="type" required><option value="client">Cliente</option><option value="agency">Órgão público</option><option value="external_finance">Financeiro externo</option><option value="third_party">Terceiro</option><option value="internal">Interno</option></select></label><label>Motivo<textarea name="reason" required></textarea></label><label class="v71-check"><input name="pause" type="checkbox" checked> Pausar SLA interno quando o bloqueio for externo</label><div class="v71-activation-actions"><button type="button" class="btn btn-muted" data-v71-form-cancel>Cancelar</button><button class="btn btn-primary" type="submit">Registrar bloqueio</button></div></form>`);
    root.querySelector('[data-v71-form-cancel]')?.addEventListener('click',()=>renderDetail(detail));
    root.querySelector('[data-v71-blocker-form]')?.addEventListener('submit',async event=>{event.preventDefault();const form=new FormData(event.currentTarget);await Engine.openBlocker({processId:detail.process.id,taskId,type:form.get('type'),reason:form.get('reason'),pausesSla:form.get('pause')==='on'});await refreshProcess();});
  }

  function bindDetail(root,detail){
    const model=processModel(detail);
    root.querySelectorAll('[data-v71-tab]').forEach(button=>button.addEventListener('click',()=>{currentTab=button.dataset.v71Tab;renderDetail(detail);}));
    root.querySelector('[data-v71-new-task]')?.addEventListener('click',()=>taskModal(detail));
    root.querySelector('[data-v71-new-blocker]')?.addEventListener('click',()=>blockerModal(detail));
    root.querySelectorAll('[data-v71-task-start]').forEach(button=>button.addEventListener('click',async()=>{await Engine.startTask(button.dataset.v71TaskStart,{processId:detail.process.id});await refreshProcess();}));
    root.querySelectorAll('[data-v71-task-primary]').forEach(button=>button.addEventListener('click',async()=>{await Engine.setPrimaryTask(detail.process.id,button.dataset.v71TaskPrimary);await refreshProcess();}));
    root.querySelectorAll('[data-v71-task-complete]').forEach(button=>button.addEventListener('click',async()=>{await Engine.completeTask(button.dataset.v71TaskComplete,{processId:detail.process.id});await refreshProcess();}));
    root.querySelectorAll('[data-v71-task-block]').forEach(button=>button.addEventListener('click',()=>blockerModal(detail,button.dataset.v71TaskBlock)));
    root.querySelectorAll('[data-v71-blocker-close]').forEach(button=>button.addEventListener('click',async()=>{await Engine.closeBlocker(button.dataset.v71BlockerClose,{processId:detail.process.id});await refreshProcess();}));
    root.querySelector('[data-v71-stage-advance]')?.addEventListener('click',async()=>{await Engine.advanceStage(detail.process.id,{force:false});await refreshProcess();});
    root.querySelector('[data-v71-force-advance]')?.addEventListener('click',async()=>{if(!has('workflow.override'))return;const justification=window.prompt('Informe a justificativa para avançar com tarefas obrigatórias pendentes:')||'';if(!justification.trim())return;await Engine.advanceStage(detail.process.id,{force:true,justification});await refreshProcess();});
    root.querySelector('[data-v71-activate-legacy]')?.addEventListener('click',()=>UI.previewLegacyActivation(detail.process.id));
    root.querySelector('[data-v71-task-focus]')?.addEventListener('click',event=>{currentTab='tasks';renderDetail(detail);setTimeout(()=>document.querySelector(`[data-v71-task-row="${event.currentTarget.dataset.v71TaskFocus}"]`)?.scrollIntoView?.({block:'center'}),0);});
    if(model.primary)Engine.primaryTaskFor?.(detail.process.id);
  }

  async function openOperationalProcess(id){
    currentProcessId=id;currentTab='overview';
    try{
      const cap=await Data.capabilities();
      if(!cap.available)return typeof legacyOpenProcess==='function'?legacyOpenProcess(id):null;
      const detail=await Data.loadProcess(id);
      detail.holidays=await Data.loadHolidays();
      if(!detail.process)return typeof legacyOpenProcess==='function'?legacyOpenProcess(id):null;
      renderDetail(detail);
      return detail;
    }catch(error){
      console.error('ATLAS 7.1: falha ao abrir processo operacional',error);
      return typeof legacyOpenProcess==='function'?legacyOpenProcess(id):null;
    }
  }

  window.openAtlasV4Process=openOperationalProcess;
  document.addEventListener('atlas:v71:activation-complete',event=>{if(event.detail?.processId===currentProcessId)refreshProcess();});
  document.addEventListener('atlas:v71:changed',event=>{if(event.detail?.processId===currentProcessId)refreshProcess();});

  window.AtlasOpsV71Process=Object.freeze({openOperationalProcess,refreshProcess,processModel,legacyOpenProcess});
})();
