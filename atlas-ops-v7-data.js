(() => {
  const MISSING_SCHEMA_CODES = new Set(['42P01','PGRST205']);
  let capabilityCache = null;

  function context() {
    const profile = window.atlasAuth?.getProfile?.() || null;
    const client = window.atlasAuth?.client || null;
    return { profile, client };
  }

  async function ready() {
    const { profile, client } = context();
    return Boolean(profile?.id && profile?.organization_id && client);
  }

  function missingSchema(error) {
    return Boolean(error && MISSING_SCHEMA_CODES.has(String(error.code || '')));
  }

  function unavailable(reason) {
    return { available:false, reason };
  }

  async function capabilities({refresh=false} = {}) {
    if (!await ready()) return unavailable('auth_not_ready');
    if (capabilityCache && !refresh) return capabilityCache;
    const { profile, client } = context();
    const { error } = await client.from('process_operations')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .limit(1);
    if (missingSchema(error)) {
      capabilityCache = unavailable('schema_unavailable');
      return capabilityCache;
    }
    if (error) {
      capabilityCache = unavailable('query_error');
      return capabilityCache;
    }
    capabilityCache = { available:true, reason:null };
    return capabilityCache;
  }

  async function scoped(table, columns='*', configure=null) {
    const { profile, client } = context();
    if (!profile?.organization_id || !client) return { data:[], error:null };
    let query = client.from(table).select(columns).eq('organization_id', profile.organization_id);
    if (configure) query = configure(query) || query;
    const result = await query;
    if (missingSchema(result?.error)) return { data:[], error:result.error, unavailable:true };
    if (result?.error) throw result.error;
    return { data:result?.data || [], error:null };
  }

  async function relatedByIds(table, columns, column, ids) {
    const { client } = context();
    const values = [...new Set((ids || []).filter(Boolean))];
    if (!client || !values.length) return [];
    const { data, error } = await client.from(table).select(columns).in(column,values);
    if (missingSchema(error)) return [];
    if (error) throw error;
    return data || [];
  }

  function emptyCentral(reason=null) {
    return {
      available: reason == null,
      reason,
      tasks:[], blockers:[], pauses:[], processes:[], profiles:[], teams:[], operations:[], clients:[],
      stages:[], costs:[], licenses:[], events:[]
    };
  }

  async function loadCentral(filters={}) {
    const cap = await capabilities();
    if (!cap.available) return emptyCentral(cap.reason);
    const taskConfigure = query => {
      let q = query;
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.assignee_id) q = q.eq('assignee_id', filters.assignee_id);
      if (filters.team_id) q = q.eq('team_id', filters.team_id);
      if (filters.priority) q = q.eq('priority', filters.priority);
      if (filters.process_id) q = q.eq('process_id', filters.process_id);
      return q;
    };
    const [tasks, blockers, pauses, processes, profiles, teams, operations, clients, events] = await Promise.all([
      scoped('tasks','*',taskConfigure),
      scoped('process_blockers','*',q => filters.blocker_type ? q.eq('blocker_type',filters.blocker_type) : q),
      scoped('sla_pauses','*'),
      scoped('processes','*',q => filters.process_status ? q.eq('status',filters.process_status) : q),
      scoped('profiles','id,full_name,role,active'),
      scoped('teams','*'),
      scoped('process_operations','*'),
      scoped('clients','*'),
      scoped('task_events','*',q => q.order('created_at',{ascending:false}))
    ]);
    if ([tasks,blockers,pauses,operations].some(result => result.unavailable)) return emptyCentral('schema_unavailable');

    const processIds = processes.data.map(row => row.id);
    const clientIds = clients.data.map(row => row.id);
    const stageIds = [...operations.data.map(row => row.current_stage_id),...tasks.data.map(row => row.stage_id)].filter(Boolean);
    const [stages,costs,licenses] = await Promise.all([
      relatedByIds('workflow_stages','id,name,sla_days,position,workflow_template_id','id',stageIds),
      relatedByIds('costs','*','process_id',processIds),
      relatedByIds('licenses','*','client_id',clientIds)
    ]);

    return {
      available:true,
      reason:null,
      tasks:tasks.data,
      blockers:blockers.data,
      pauses:pauses.data,
      processes:processes.data,
      profiles:profiles.data,
      teams:teams.data,
      operations:operations.data,
      clients:clients.data,
      stages,
      costs,
      licenses,
      events:events.data
    };
  }

  async function loadProcess(processId) {
    if (!processId) throw new TypeError('processId é obrigatório');
    const cap = await capabilities();
    if (!cap.available) return { available:false, reason:cap.reason, process:null, operation:null, tasks:[], blockers:[], pauses:[], transitions:[], events:[], documents:[], dependencies:[], stages:[], profiles:[], teams:[], client:null };
    const [processes, operations, tasks, blockers, pauses, transitions, events, documents] = await Promise.all([
      scoped('processes','*',q => q.eq('id',processId)),
      scoped('process_operations','*',q => q.eq('process_id',processId)),
      scoped('tasks','*',q => q.eq('process_id',processId)),
      scoped('process_blockers','*',q => q.eq('process_id',processId)),
      scoped('sla_pauses','*',q => q.eq('process_id',processId)),
      scoped('stage_transitions','*',q => q.eq('process_id',processId)),
      scoped('task_events','*',q => q.eq('process_id',processId)),
      scoped('documents','*',q => q.eq('process_id',processId))
    ]);
    const process=processes.data[0] || null;
    const taskIds=tasks.data.map(row=>row.id);
    const [clientRows,profiles,teams,dependencies,stages] = process ? await Promise.all([
      scoped('clients','*',q=>q.eq('id',process.client_id)),
      scoped('profiles','id,full_name,role,active'),
      scoped('teams','*'),
      taskIds.length ? scoped('task_dependencies','*',q=>q.in('task_id',taskIds)) : Promise.resolve({data:[],error:null}),
      process.workflow_template_id ? relatedByIds('workflow_stages','id,name,sla_days,position,workflow_template_id,client_visible,notify_client','workflow_template_id',[process.workflow_template_id]) : Promise.resolve([])
    ]) : [{data:[],error:null},{data:[],error:null},{data:[],error:null},{data:[],error:null},[]];
    return {
      available:true,
      reason:null,
      process,
      operation:operations.data[0] || null,
      tasks:tasks.data,
      blockers:blockers.data,
      pauses:pauses.data,
      transitions:transitions.data,
      events:events.data,
      documents:documents.data,
      dependencies:dependencies.data,
      stages,
      profiles:profiles.data,
      teams:teams.data,
      client:clientRows.data[0] || null
    };
  }

  async function loadTaskTemplates(stageId) {
    if (!stageId) throw new TypeError('stageId é obrigatório');
    const cap = await capabilities();
    if (!cap.available) return [];
    const result = await scoped('task_templates','*',q => q.eq('stage_id',stageId).eq('active',true).order('suggested_order',{ascending:true}));
    return result.data;
  }

  async function loadTeams() {
    const cap = await capabilities();
    if (!cap.available) return [];
    const result = await scoped('teams','*',q => q.eq('active',true));
    return result.data;
  }

  async function loadHolidays() {
    const cap = await capabilities();
    if (!cap.available) return [];
    const result = await scoped('business_holidays','holiday_date,name,scope',q => q.order('holiday_date',{ascending:true}));
    return result.data.map(row => row.holiday_date);
  }

  async function rpc(name,args={}) {
    if (!await ready()) throw new Error('ATLAS 7.1: sessão ainda não está pronta');
    const { client } = context();
    const { data, error } = await client.rpc(name,args);
    if (missingSchema(error)) return unavailable('schema_unavailable');
    if (error) throw error;
    return data;
  }

  function resetCapabilities() { capabilityCache = null; }

  window.AtlasOpsV71Data = Object.freeze({
    ready,
    capabilities,
    loadCentral,
    loadProcess,
    loadTaskTemplates,
    loadTeams,
    loadHolidays,
    rpc,
    resetCapabilities
  });
})();
