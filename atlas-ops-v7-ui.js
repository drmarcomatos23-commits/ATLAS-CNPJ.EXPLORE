(() => {
  const Data = window.AtlasOpsV71Data;
  const Engine = window.AtlasOpsV71Engine;
  const Sla = window.AtlasOpsV71Sla;
  const CENTRAL_PAGE = 'central-operacional';
  const ACTIVE_TASK_STATUS = new Set(['pending','in_progress','waiting_client','waiting_agency','waiting_finance','blocked']);
  let renderHooked = false;
  let centralRaw = null;
  let centralFilterState = {};

  const e = value => typeof window.esc === 'function'
    ? window.esc(value)
    : String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function hasPermission(key) {
    return typeof window.atlasHasPermission === 'function' ? window.atlasHasPermission(key) : false;
  }

  function canManageTeams() {
    return hasPermission('teams.manage');
  }

  function ensureStylesheet() {
    if (document.querySelector('link[data-atlas-ops-v71]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/atlas-ops-v7.css?v=7.1';
    link.dataset.atlasOpsV71 = '1';
    document.head.appendChild(link);
  }

  function ensureCentralNavItem() {
    const nav = document.querySelector('#nav');
    if (!nav || nav.querySelector('[data-page="central-operacional"]')) return;
    const processItem = nav.querySelector('[data-page="processos"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item';
    button.dataset.page = CENTRAL_PAGE;
    button.dataset.roles = 'admin,operacao,financeiro,auditoria';
    button.innerHTML = '<span class="nav-ico">◎</span><span>Central Operacional</span>';
    if (processItem) nav.insertBefore(button, processItem);
    else nav.appendChild(button);
    button.addEventListener('click', () => {
      if (!hasPermission('operations.view')) return;
      nav.querySelectorAll('[data-page]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      if (typeof window.render === 'function') window.render(CENTRAL_PAGE);
    });
    window.atlasPermissions?.apply?.();
  }

  function pageHtml(html) {
    if (typeof window.page === 'function') return window.page(html);
    const host = document.getElementById('page-content');
    if (host) host.innerHTML = html;
  }

  function setPageHead(title,kicker,description) {
    if (typeof window.setHead === 'function') return window.setHead(title,kicker,description);
    const titleEl = document.getElementById('page-title');
    const kickerEl = document.getElementById('page-kicker');
    const descEl = document.getElementById('page-desc');
    if (titleEl) titleEl.textContent = title;
    if (kickerEl) kickerEl.textContent = kicker;
    if (descEl) descEl.textContent = description;
  }

  function localDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  function plusDays(key,days) {
    const date = new Date(`${key}T12:00:00`);
    date.setDate(date.getDate()+days);
    return localDateKey(date);
  }

  function dateLabel(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR');
  }

  function daysSince(value, now = Date.now()) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 0;
    return Math.max(0,Math.floor((now-date.getTime())/86400000));
  }

  function clientName(client) {
    return client?.legal_name || client?.trade_name || client?.name || client?.razao_social || '—';
  }

  function clientGroup(client) {
    return client?.group_name || client?.group?.name || client?.metadata?.group_name || client?.metadata?.group || '';
  }

  function processCode(process) {
    return process?.public_code || process?.title || process?.id || '—';
  }

  function activeTask(task) {
    return ACTIVE_TASK_STATUS.has(String(task?.status || ''));
  }

  function statusLabel(status) {
    return ({
      pending:'Pendente',in_progress:'Em andamento',waiting_client:'Aguardando cliente',
      waiting_agency:'Aguardando órgão',waiting_finance:'Financeiro',blocked:'Bloqueada',
      completed:'Concluída',cancelled:'Cancelada'
    })[status] || String(status || '—').replaceAll('_',' ');
  }

  function statusTone(status) {
    if (status==='completed') return 'success';
    if (status==='blocked') return 'danger';
    if (['waiting_client','waiting_agency','waiting_finance'].includes(status)) return 'warning';
    if (status==='in_progress') return 'info';
    return '';
  }

  function priorityLabel(priority) {
    return ({low:'Baixa',normal:'Normal',high:'Alta',critical:'Crítica'})[priority] || 'Normal';
  }

  function buildCentralModel(raw) {
    const today = localDateKey();
    const currentUserId = window.atlasAuth?.getProfile?.()?.id || window.atlasCurrentProfile?.id || null;
    const processById = new Map((raw.processes || []).map(row => [row.id,row]));
    const clientById = new Map((raw.clients || []).map(row => [row.id,row]));
    const profileById = new Map((raw.profiles || []).map(row => [row.id,row]));
    const teamById = new Map((raw.teams || []).map(row => [row.id,row]));
    const stageById = new Map((raw.stages || []).map(row => [row.id,row]));
    const operationByProcess = new Map((raw.operations || []).map(row => [row.process_id,row]));
    const openBlockers = (raw.blockers || []).filter(row => !row.ended_at);
    const blockersByProcess = new Map();
    for (const blocker of openBlockers) {
      if (!blockersByProcess.has(blocker.process_id)) blockersByProcess.set(blocker.process_id,[]);
      blockersByProcess.get(blocker.process_id).push(blocker);
    }
    const pausesByProcess = new Map();
    for (const pause of raw.pauses || []) {
      if (!pausesByProcess.has(pause.process_id)) pausesByProcess.set(pause.process_id,[]);
      pausesByProcess.get(pause.process_id).push({start:pause.started_at,end:pause.ended_at});
    }
    const lastEventByProcess = new Map();
    for (const event of raw.events || []) {
      const current = lastEventByProcess.get(event.process_id);
      if (!current || new Date(event.created_at) > new Date(current.created_at)) lastEventByProcess.set(event.process_id,event);
    }

    const slaByProcess = new Map();
    for (const process of raw.processes || []) {
      const operation = operationByProcess.get(process.id);
      const stage = stageById.get(operation?.current_stage_id || process.current_stage_id);
      if (!operation?.stage_started_at || stage?.sla_days == null || !Sla?.slaSnapshot) continue;
      try {
        const snapshot = Sla.slaSnapshot({
          stageStartedAt:operation.stage_started_at,
          now:new Date().toISOString(),
          slaDays:Number(stage.sla_days),
          pauses:pausesByProcess.get(process.id) || [],
          holidays:raw.holidays || []
        });
        slaByProcess.set(process.id,snapshot);
      } catch (_) {}
    }

    const tasks = (raw.tasks || []).map(task => {
      const process = processById.get(task.process_id) || null;
      const client = clientById.get(process?.client_id) || null;
      const dueKey = localDateKey(task.due_at);
      const sla = slaByProcess.get(task.process_id) || null;
      return {
        ...task,
        process,
        client,
        dueKey,
        assigneeName:profileById.get(task.assignee_id)?.full_name || 'Não atribuído',
        teamName:teamById.get(task.team_id)?.name || 'Sem equipe',
        stageName:stageById.get(task.stage_id)?.name || '—',
        service:process?.service_type || process?.title || '—',
        group:clientGroup(client),
        outsideSla:sla?.state==='overdue',
        blockers:blockersByProcess.get(task.process_id) || []
      };
    });
    const activeTasks = tasks.filter(activeTask);
    const activeProcesses = (raw.processes || []).filter(process => !['completed','cancelled','canceled'].includes(String(process.status||'').toLowerCase()));
    const processOutSla = activeProcesses.filter(process => slaByProcess.get(process.id)?.state==='overdue');
    const blockedProcesses = activeProcesses.filter(process => blockersByProcess.has(process.id));
    const staleProcesses = activeProcesses.filter(process => {
      const last = lastEventByProcess.get(process.id)?.created_at || operationByProcess.get(process.id)?.updated_at || process.started_at || process.created_at;
      return last && daysSince(last) >= 7;
    });
    const costsPending = (raw.costs || []).filter(cost => !['paid','pago','received','recebido'].includes(String(cost.payment_status || '').toLowerCase()));
    const financeProcesses = new Set([
      ...activeTasks.filter(task => task.status==='waiting_finance').map(task => task.process_id),
      ...costsPending.map(cost => cost.process_id).filter(Boolean)
    ]);
    const licenseAlerts = (raw.licenses || []).filter(license => {
      const key = localDateKey(license.expires_at);
      return key && key >= today && key <= plusDays(today,30);
    });
    const tasksToday = activeTasks.filter(task => task.assignee_id===currentUserId && task.dueKey===today);
    const overdueTasks = activeTasks.filter(task => task.dueKey && task.dueKey < today);
    const waitingClient = new Set([
      ...activeTasks.filter(task => task.status==='waiting_client').map(task => task.process_id),
      ...openBlockers.filter(blocker => blocker.blocker_type==='client').map(blocker => blocker.process_id)
    ]);
    const waitingAgency = new Set([
      ...activeTasks.filter(task => task.status==='waiting_agency').map(task => task.process_id),
      ...openBlockers.filter(blocker => blocker.blocker_type==='agency').map(blocker => blocker.process_id)
    ]);

    const teamLoad = new Map();
    const responsibleLoad = new Map();
    for (const task of activeTasks) {
      teamLoad.set(task.teamName,(teamLoad.get(task.teamName)||0)+1);
      responsibleLoad.set(task.assigneeName,(responsibleLoad.get(task.assigneeName)||0)+1);
    }
    const critical = [...activeTasks].filter(task => task.priority==='critical' || task.priority==='high' || (task.dueKey && task.dueKey<today))
      .sort((a,b) => (a.dueKey||'9999').localeCompare(b.dueKey||'9999') || String(a.priority).localeCompare(String(b.priority)));

    return {
      today,currentUserId,processById,clientById,profileById,teamById,stageById,operationByProcess,blockersByProcess,slaByProcess,
      tasks,activeTasks,tasksToday,overdueTasks,processOutSla,blockedProcesses,staleProcesses,waitingClient,waitingAgency,
      financeProcesses,licenseAlerts,teamLoad,responsibleLoad,critical,costsPending
    };
  }

  function options(values,selected,label='Todos') {
    const unique = [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    return `<option value="">${e(label)}</option>${unique.map(value => `<option value="${e(value)}" ${String(selected||'')===String(value)?'selected':''}>${e(value)}</option>`).join('')}`;
  }

  function centralFilterHtml(model) {
    const f=centralFilterState;
    return `<div class="v71-filter-grid">
      <label>Responsável<select data-v71-filter-responsible>${options(model.activeTasks.map(t=>t.assigneeName),f.responsible,'Todos')}</select></label>
      <label>Equipe<select data-v71-filter-team>${options(model.activeTasks.map(t=>t.teamName),f.team,'Todas')}</select></label>
      <label>Cliente<select data-v71-filter-client>${options(model.activeTasks.map(t=>clientName(t.client)),f.client,'Todos')}</select></label>
      <label>Grupo<select data-v71-filter-group>${options(model.activeTasks.map(t=>t.group),f.group,'Todos')}</select></label>
      <label>Serviço<select data-v71-filter-service>${options(model.activeTasks.map(t=>t.service),f.service,'Todos')}</select></label>
      <label>Etapa<select data-v71-filter-stage>${options(model.activeTasks.map(t=>t.stageName),f.stage,'Todas')}</select></label>
      <label>Status<select data-v71-filter-status>${options(model.activeTasks.map(t=>t.status),f.status,'Todos')}</select></label>
      <label>Prioridade<select data-v71-filter-priority>${options(model.activeTasks.map(t=>t.priority),f.priority,'Todas')}</select></label>
      <label>Bloqueio<select data-v71-filter-blocker>${options(['client','agency','external_finance','third_party','internal'],f.blocker,'Todos')}</select></label>
      <label>Período<select data-v71-filter-period>${options(['today','7d','30d','overdue'],f.period,'Todos')}</select></label>
      <label>SLA<select data-v71-filter-sla>${options(['within_sla','due_today','overdue'],f.sla,'Todos')}</select></label>
      <label>Busca<input data-v71-filter-search value="${e(f.search||'')}" placeholder="Processo ou tarefa"></label>
    </div>`;
  }

  function taskMatches(task,model) {
    const f=centralFilterState;
    if (f.queue==='today' && !model.tasksToday.includes(task)) return false;
    if (f.queue==='overdue' && !model.overdueTasks.includes(task)) return false;
    if (f.queue==='outsideSla' && !task.outsideSla) return false;
    if (f.queue==='blocked' && !task.blockers.length) return false;
    if (f.queue==='waitingClient' && !model.waitingClient.has(task.process_id)) return false;
    if (f.queue==='waitingAgency' && !model.waitingAgency.has(task.process_id)) return false;
    if (f.queue==='finance' && !model.financeProcesses.has(task.process_id)) return false;
    if (f.queue==='stale' && !model.staleProcesses.some(p=>p.id===task.process_id)) return false;
    if (f.responsible && task.assigneeName!==f.responsible) return false;
    if (f.team && task.teamName!==f.team) return false;
    if (f.client && clientName(task.client)!==f.client) return false;
    if (f.group && task.group!==f.group) return false;
    if (f.service && task.service!==f.service) return false;
    if (f.stage && task.stageName!==f.stage) return false;
    if (f.status && task.status!==f.status) return false;
    if (f.priority && task.priority!==f.priority) return false;
    if (f.blocker && !task.blockers.some(b=>b.blocker_type===f.blocker)) return false;
    if (f.sla && model.slaByProcess.get(task.process_id)?.state!==f.sla) return false;
    if (f.period==='today' && task.dueKey!==model.today) return false;
    if (f.period==='overdue' && !(task.dueKey && task.dueKey<model.today)) return false;
    if (f.period==='7d' && !(task.dueKey && task.dueKey>=model.today && task.dueKey<=plusDays(model.today,7))) return false;
    if (f.period==='30d' && !(task.dueKey && task.dueKey>=model.today && task.dueKey<=plusDays(model.today,30))) return false;
    if (f.search) {
      const haystack=[task.title,task.description,processCode(task.process),clientName(task.client)].filter(Boolean).join(' ').toLowerCase();
      if(!haystack.includes(String(f.search).toLowerCase()))return false;
    }
    return true;
  }

  function kpi(label,value,queue,icon,tone,sub) {
    return `<button type="button" class="v71-kpi" data-v71-kpi="${queue}" data-tone="${tone||''}"><span class="v71-kpi-icon">${icon}</span><span class="v71-kpi-copy"><small>${label}</small><strong>${value}</strong><span>${sub}</span></span></button>`;
  }

  function loadRows(map,maxValue) {
    const rows=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
    if(!rows.length)return '<div class="v71-empty">Sem tarefas ativas para distribuir.</div>';
    return `<div class="v71-list">${rows.map(([name,count])=>`<div class="v71-list-row"><div><strong>${e(name)}</strong><div class="v71-load-bar"><i style="width:${Math.max(7,Math.round((count/Math.max(1,maxValue))*100))}%"></i></div></div><b>${count}</b></div>`).join('')}</div>`;
  }

  function licensesHtml(model) {
    if(!model.licenseAlerts.length)return '<div class="v71-empty">Nenhuma licença vence nos próximos 30 dias.</div>';
    const clients=model.clientById;
    return `<div class="v71-list">${model.licenseAlerts.slice(0,8).map(license=>`<div class="v71-list-row"><div><strong>${e(license.name||'Licença')}</strong><small>${e(clientName(clients.get(license.client_id)))} · ${e(license.agency||'Órgão não informado')}</small></div><b>${e(dateLabel(license.expires_at))}</b></div>`).join('')}</div>`;
  }

  function centralTaskTable(model) {
    const source=(centralFilterState.queue?model.activeTasks:model.critical).filter(task=>taskMatches(task,model)).slice(0,30);
    if(!source.length)return '<div class="v71-empty">Nenhuma tarefa corresponde aos filtros atuais.</div>';
    return `<div class="v71-task-table-wrap"><table class="v71-task-table"><thead><tr><th>Tarefa</th><th>Processo</th><th>Cliente</th><th>Etapa</th><th>Responsável</th><th>Prazo</th><th>Status</th><th>Prioridade</th></tr></thead><tbody>${source.map(task=>`<tr>
      <td><div class="v71-task-title"><strong>${e(task.title)}</strong><small>${task.is_primary_action?'Próxima Ação Principal':e(task.teamName)}</small></div></td>
      <td><button class="v71-process-link" type="button" data-v71-process-open="${e(task.process_id)}">${e(processCode(task.process))}</button></td>
      <td>${e(clientName(task.client))}</td><td>${e(task.stageName)}</td><td>${e(task.assigneeName)}</td>
      <td>${e(dateLabel(task.due_at))}</td><td><span class="v71-badge ${statusTone(task.status)}">${e(statusLabel(task.status))}</span></td>
      <td><span class="v71-badge ${task.priority==='critical'?'danger':task.priority==='high'?'warning':''}">${e(priorityLabel(task.priority))}</span></td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  function centralHtml(model) {
    const maxTeam=Math.max(1,...model.teamLoad.values());
    const maxResponsible=Math.max(1,...model.responsibleLoad.values());
    return `<div class="v71-central">
      <div class="v71-toolbar"><div class="v71-toolbar-copy"><h2>Central Operacional</h2><p>O que precisa ser feito, por quem, até quando e o que está bloqueando a operação.</p></div><div class="v71-toolbar-actions">${teamsControl()}<button class="btn btn-muted" type="button" data-v71-clear-filters>Limpar filtros</button></div></div>
      ${centralFilterHtml(model)}
      <div class="v71-kpi-grid">
        ${kpi('Minhas tarefas hoje',model.tasksToday.length,'today','✓','info','Atribuídas a você com prazo hoje')}
        ${kpi('Tarefas atrasadas',model.overdueTasks.length,'overdue','!','danger','Tarefas ativas com prazo vencido')}
        ${kpi('Processos fora do SLA',model.processOutSla.length,'outsideSla','⌛','danger','SLA interno da etapa excedido')}
        ${kpi('Processos bloqueados',model.blockedProcesses.length,'blocked','Ⅱ','warning','Bloqueios ativos registrados')}
        ${kpi('Aguardando cliente',model.waitingClient.size,'waitingClient','C','warning','Processos dependentes do cliente')}
        ${kpi('Aguardando órgão',model.waitingAgency.size,'waitingAgency','O','purple','Processos dependentes de órgão público')}
        ${kpi('Financeiro pendente',model.financeProcesses.size,'finance','R$','warning','Tarefas ou lançamentos financeiros pendentes')}
        ${kpi('Sem movimentação',model.staleProcesses.length,'stale','7+','danger','Processos ativos sem evento há 7 dias ou mais')}
      </div>
      <div class="v71-central-grid">
        <section class="v71-panel"><div class="v71-panel-head"><div><h3>Próximas ações críticas</h3><span>${centralFilterState.queue?'Fila selecionada':'Alta prioridade e atrasos'}</span></div><span>${model.activeTasks.filter(t=>taskMatches(t,model)).length} tarefa(s)</span></div>${centralTaskTable(model)}</section>
        <aside class="v71-side-stack">
          <section class="v71-panel"><div class="v71-panel-head"><h3>Carga por equipe</h3><span>Tarefas ativas</span></div>${loadRows(model.teamLoad,maxTeam)}</section>
          <section class="v71-panel"><div class="v71-panel-head"><h3>Carga por responsável</h3><span>Tarefas ativas</span></div>${loadRows(model.responsibleLoad,maxResponsible)}</section>
          <section class="v71-panel"><div class="v71-panel-head"><h3>Licenças e prazos</h3><span>Próximos 30 dias</span></div>${licensesHtml(model)}</section>
        </aside>
      </div>
    </div>`;
  }

  function readCentralFilters(root=document) {
    const get=name=>root.querySelector(`[data-v71-filter-${name}]`)?.value || '';
    return {
      ...centralFilterState,
      responsible:get('responsible'),team:get('team'),client:get('client'),group:get('group'),service:get('service'),stage:get('stage'),
      status:get('status'),priority:get('priority'),blocker:get('blocker'),period:get('period'),sla:get('sla'),search:get('search')
    };
  }

  function applyCentralFilters() {
    if(!centralRaw)return;
    centralFilterState=readCentralFilters();
    renderCentral(centralRaw);
  }

  function bindCentral(model) {
    document.querySelectorAll('[data-v71-filter-responsible],[data-v71-filter-team],[data-v71-filter-client],[data-v71-filter-group],[data-v71-filter-service],[data-v71-filter-stage],[data-v71-filter-status],[data-v71-filter-priority],[data-v71-filter-blocker],[data-v71-filter-period],[data-v71-filter-sla]')
      .forEach(control=>control.addEventListener('change',applyCentralFilters));
    document.querySelector('[data-v71-filter-search]')?.addEventListener('input',event=>{
      centralFilterState={...readCentralFilters(),search:event.currentTarget.value};
      clearTimeout(window.__atlasV71SearchTimer);
      window.__atlasV71SearchTimer=setTimeout(()=>renderCentral(centralRaw),160);
    });
    document.querySelectorAll('[data-v71-kpi]').forEach(button=>button.addEventListener('click',()=>{
      centralFilterState={...centralFilterState,queue:button.dataset.v71Kpi};
      renderCentral(centralRaw);
    }));
    document.querySelector('[data-v71-clear-filters]')?.addEventListener('click',()=>{
      centralFilterState={};
      renderCentral(centralRaw);
    });
    document.querySelectorAll('[data-v71-process-open]').forEach(button=>button.addEventListener('click',()=>{
      if(typeof window.openAtlasV4Process==='function')window.openAtlasV4Process(button.dataset.v71ProcessOpen);
    }));
    window.atlasPermissions?.apply?.();
  }

  function renderCentral(raw) {
    const model=buildCentralModel(raw);
    pageHtml(centralHtml(model));
    bindCentral(model);
  }

  async function centralOperationalPage() {
    setPageHead('Central Operacional','OPERAÇÃO','Prioridades, tarefas, bloqueios e SLA em uma única visão.');
    if (!hasPermission('operations.view')) {
      pageHtml('<div class="error-box">Seu perfil não possui acesso à Central Operacional.</div>');
      return;
    }
    pageHtml('<section class="surface pad"><div class="loading-box"><span class="spinner"></span><div>Carregando Central Operacional...</div></div></section>');
    const capability = await Data?.capabilities?.() || {available:false,reason:'adapter_unavailable'};
    if (!capability.available) {
      pageHtml(`<section class="surface pad"><div class="section-head"><div><h2>Central Operacional</h2><span>ATLAS 7.1</span></div></div><div class="v71-capability-note"><strong>Recurso preparado para homologação</strong><p>A estrutura operacional ainda não está ativa neste banco (${e(capability.reason||'schema_unavailable')}). Os módulos atuais do ATLAS continuam funcionando normalmente.</p></div></section>`);
      return;
    }
    try {
      const [raw,holidays]=await Promise.all([Data.loadCentral({}),Data.loadHolidays()]);
      if(!raw?.available){
        pageHtml('<section class="surface pad"><div class="v71-capability-note"><strong>Central Operacional indisponível</strong><p>Os módulos atuais do ATLAS continuam funcionando normalmente.</p></div></section>');
        return;
      }
      centralRaw={...raw,holidays};
      centralFilterState={};
      renderCentral(centralRaw);
    } catch(error) {
      console.error('ATLAS 7.1: falha ao carregar Central Operacional',error);
      pageHtml(`<div class="error-box">Não foi possível carregar a Central Operacional: ${e(error?.message||error)}</div>`);
    }
  }

  function installRenderHook() {
    if (renderHooked || typeof window.render !== 'function') return false;
    const legacyRender = window.render;
    window.render = function(pageName) {
      if (pageName === CENTRAL_PAGE) return centralOperationalPage();
      return legacyRender(pageName);
    };
    renderHooked = true;
    return true;
  }

  function modal(body) {
    const shell = window.modalShell;
    if (typeof shell === 'function') {
      shell('Ativar Central Operacional', body);
      return document.querySelector('#atlas-modal-root') || document;
    }
    const root = document.getElementById('atlas-modal-root');
    if (!root) return document;
    root.innerHTML = `<div class="modal-backdrop"><div class="atlas-modal"><div class="atlas-modal-body">${body}</div></div></div>`;
    return root;
  }

  function closeActivationModal() {
    if (typeof window.closeAtlasModal === 'function') window.closeAtlasModal();
    else {
      const root = document.getElementById('atlas-modal-root');
      if (root) root.innerHTML = '';
    }
  }

  function activationHtml(processId,templates) {
    const rows = templates.length ? templates.map(template => `
      <label class="v71-activation-task">
        <input type="checkbox" data-v71-template-id="${e(template.id)}" checked>
        <span><strong>${e(template.title)}</strong><small>${template.required ? 'Obrigatória' : 'Opcional'} · ${e(template.priority || 'normal')}</small></span>
      </label>`).join('') : '<div class="v71-empty">Nenhuma tarefa automática está configurada para esta etapa.</div>';
    return `<div class="v71-activation-review" data-v71-activation-process="${e(processId)}">
      <h3>Revisar tarefas propostas</h3>
      <p>Confira as tarefas antes de ativar a Central Operacional neste processo. Nada será criado até sua confirmação.</p>
      <div class="v71-activation-list">${rows}</div>
      <div class="v71-activation-actions">
        <button type="button" class="btn btn-muted" data-v71-activate-cancel>Cancelar</button>
        <button type="button" class="btn btn-primary" data-v71-activate-confirm>Ativar Central Operacional neste processo</button>
      </div>
    </div>`;
  }

  async function previewLegacyActivation(processId) {
    if (!hasPermission('workflow.advance')) throw new Error('Sem permissão para ativar a Central Operacional');
    const detail = await Data.loadProcess(processId);
    if (!detail?.available) throw new Error('ATLAS 7.1 ainda não está disponível neste ambiente');
    if (detail.operation) return {alreadyActive:true,operation:detail.operation};
    const stageId = detail.process?.current_stage_id;
    if (!stageId) throw new Error('O processo precisa possuir uma etapa atual antes da ativação');
    const templates = await Data.loadTaskTemplates(stageId);
    const root = modal(activationHtml(processId,templates));
    root.querySelector?.('[data-v71-activate-cancel]')?.addEventListener('click',closeActivationModal);
    root.querySelector?.('[data-v71-activate-confirm]')?.addEventListener('click',async event => {
      event.currentTarget.disabled = true;
      try { await confirmLegacyActivation(processId,root); }
      finally { event.currentTarget.disabled = false; }
    });
    return {alreadyActive:false,stageId,templates};
  }

  async function confirmLegacyActivation(processId,root=document) {
    const templateIds = [...root.querySelectorAll?.('[data-v71-template-id]:checked') || []]
      .map(input => input.dataset.v71TemplateId)
      .filter(Boolean);
    const result = await Engine.activateProcess(processId,templateIds);
    closeActivationModal();
    document.dispatchEvent?.(new CustomEvent('atlas:v71:activation-complete',{detail:{processId,templateIds}}));
    return result;
  }

  function legacyActivationButton(processId) {
    if (!hasPermission('workflow.advance')) return '';
    return `<button class="btn btn-primary" type="button" data-v71-legacy-activate="${e(processId)}">Ativar Central Operacional neste processo</button>`;
  }

  function bindLegacyActivation(root=document) {
    root.querySelectorAll?.('[data-v71-legacy-activate]').forEach(button => {
      if (button.dataset.v71Bound === '1') return;
      button.dataset.v71Bound = '1';
      button.addEventListener('click',() => previewLegacyActivation(button.dataset.v71LegacyActivate));
    });
  }

  function teamsControl() {
    return canManageTeams() ? '<button type="button" class="btn btn-muted" data-v71-team-manage>Gerenciar equipes</button>' : '';
  }

  document.addEventListener('atlas:v71:changed',event=>{
    if(document.querySelector('[data-page="central-operacional"].active'))centralOperationalPage();
    else if(event.detail?.processId)window.AtlasOpsV71UI?.refreshProcess?.(event.detail.processId);
  });

  document.addEventListener('DOMContentLoaded', () => {
    ensureStylesheet();
    ensureCentralNavItem();
    installRenderHook();
    bindLegacyActivation(document);
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      ensureCentralNavItem();
      if (installRenderHook() || tries > 20) clearInterval(timer);
    }, 150);
  });

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-v71-legacy-activate]');
    if (button && button.dataset.v71Bound !== '1') previewLegacyActivation(button.dataset.v71LegacyActivate);
  });

  window.AtlasOpsV71UI = Object.freeze({
    ensureStylesheet,
    ensureCentralNavItem,
    centralOperationalPage,
    buildCentralModel,
    applyCentralFilters,
    previewLegacyActivation,
    confirmLegacyActivation,
    legacyActivationButton,
    bindLegacyActivation,
    canManageTeams,
    teamsControl
  });
})();
