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

  function emptyCentral(reason=null) {
    return {
      available: reason == null,
      reason,
      tasks:[], blockers:[], processes:[], profiles:[], teams:[], operations:[]
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
    const [tasks, blockers, processes, profiles, teams, operations] = await Promise.all([
      scoped('tasks','*',taskConfigure),
      scoped('process_blockers','*',q => filters.blocker_type ? q.eq('blocker_type',filters.blocker_type) : q),
      scoped('processes','*',q => filters.process_status ? q.eq('status',filters.process_status) : q),
      scoped('profiles','id,full_name,role,active'),
      scoped('teams','*'),
      scoped('process_operations','*')
    ]);
    if ([tasks,blockers,operations].some(result => result.unavailable)) return emptyCentral('schema_unavailable');
    return {
      available:true,
      reason:null,
      tasks:tasks.data,
      blockers:blockers.data,
      processes:processes.data,
      profiles:profiles.data,
      teams:teams.data,
      operations:operations.data
    };
  }

  async function loadProcess(processId) {
    if (!processId) throw new TypeError('processId é obrigatório');
    const cap = await capabilities();
    if (!cap.available) return { available:false, reason:cap.reason, process:null, operation:null, tasks:[], blockers:[], pauses:[], transitions:[], events:[], documents:[] };
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
    return {
      available:true,
      reason:null,
      process:processes.data[0] || null,
      operation:operations.data[0] || null,
      tasks:tasks.data,
      blockers:blockers.data,
      pauses:pauses.data,
      transitions:transitions.data,
      events:events.data,
      documents:documents.data
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
