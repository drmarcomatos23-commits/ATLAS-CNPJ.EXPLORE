(function(root){
  const CLOSED=new Set(['completed','cancelled']);
  function localDay(v){
    if(!v)return null;
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v).slice(0,10));
    if(!m)return null;
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0);
    return Number.isNaN(d.getTime())?null:d;
  }
  function dayDiff(a,b){
    const aa=new Date(a.getFullYear(),a.getMonth(),a.getDate(),12);
    const bb=new Date(b.getFullYear(),b.getMonth(),b.getDate(),12);
    return Math.round((aa-bb)/86400000);
  }
  function safeAmount(v){
    const n=typeof v==='number'?v:Number(String(v??'').replace(/\./g,'').replace(',','.'));
    return Number.isFinite(n)?n:0;
  }
  function classifyDeadline(process,now=new Date()){
    if(CLOSED.has(String(process?.status||'').toLowerCase()))return 'none';
    const d=localDay(process?.due_date);
    if(!d)return 'none';
    const diff=dayDiff(d,now);
    if(diff<0)return 'overdue';
    if(diff===0)return 'today';
    if(diff===1)return 'tomorrow';
    return 'upcoming';
  }
  function bucketLicenses(licenses=[],now=new Date()){
    const out={vencidas:[],ate30:[],d31a60:[],d61a90:[],regulares:[]};
    for(const l of licenses||[]){
      if(!l?.expires_at||String(l.status||'')==='not_applicable')continue;
      const d=localDay(l.expires_at); if(!d)continue;
      const diff=dayDiff(d,now);
      if(diff<0)out.vencidas.push(l);
      else if(diff<=30)out.ate30.push(l);
      else if(diff<=60)out.d31a60.push(l);
      else if(diff<=90)out.d61a90.push(l);
      else out.regulares.push(l);
    }
    return out;
  }
  function isHonorario(c){return c?.fee_kind==='honorarios'||c?.cost_type==='hourly'||c?.cost_type==='honorarios';}
  function buildDashboardMetrics(data={},now=new Date()){
    const processes=data.processes||[];
    const active=processes.filter(p=>!CLOSED.has(String(p.status||'').toLowerCase()));
    const overdue=active.filter(p=>classifyDeadline(p,now)==='overdue').length;
    const pendingClient=active.filter(p=>/cliente|document/i.test(String(p.pending_from||p.status||p.notes||''))).length;
    const lb=bucketLicenses(data.licenses||[],now);
    const costs=data.costs||[];
    const honorarios=costs.filter(isHonorario); const taxas=costs.filter(c=>!isHonorario(c));
    const total=h=>h.reduce((s,c)=>s+safeAmount(c.amount),0);
    const paid=h=>h.filter(c=>c.payment_status==='paid').reduce((s,c)=>s+safeAmount(c.amount),0);
    return {
      active:active.length,
      overdue,
      pendingClient,
      licenses30:lb.vencidas.length+lb.ate30.length,
      licenseBuckets:lb,
      honorariosAReceber:Math.max(0,total(honorarios)-paid(honorarios)),
      taxasAPagar:Math.max(0,total(taxas)-paid(taxas)),
      companies:(data.clients||[]).length
    };
  }
  function priorityRank(p){return String(p?.priority||'').toLowerCase()==='high'?0:1;}
  function buildTodayQueue(processes=[],now=new Date()){
    const rank={overdue:0,today:1,tomorrow:2,upcoming:4,none:9};
    return (processes||[]).filter(p=>!CLOSED.has(String(p.status||'').toLowerCase()))
      .map(p=>({...p,_deadlineState:classifyDeadline(p,now)}))
      .filter(p=>p._deadlineState!=='none')
      .sort((a,b)=>rank[a._deadlineState]-rank[b._deadlineState]||priorityRank(a)-priorityRank(b)||String(a.due_date||'').localeCompare(String(b.due_date||'')));
  }
  function buildPendingSummary(data={},now=new Date()){
    const procs=(data.processes||[]).filter(p=>!CLOSED.has(String(p.status||'').toLowerCase()));
    const text=p=>String([p.pending_from,p.status,p.notes,p.title].filter(Boolean).join(' '));
    const b=bucketLicenses(data.licenses||[],now);
    return {
      cliente:procs.filter(p=>/cliente|document/i.test(text(p))).length,
      equipe:procs.filter(p=>/equipe|intern|respons/i.test(text(p))).length,
      orgao:procs.filter(p=>/órgão|orgao|análise|analise|junta|prefeitura|receita/i.test(text(p))).length,
      financeiro:(data.costs||[]).filter(c=>c.payment_status&&c.payment_status!=='paid').length,
      licencas:b.vencidas.length+b.ate30.length
    };
  }
  function canEditForRole(role){return ['admin','operacao','financeiro'].includes(String(role||''));}
  root.AtlasV4Core={classifyDeadline,buildDashboardMetrics,buildTodayQueue,bucketLicenses,buildPendingSummary,canEditForRole,safeAmount};
})(typeof window!=='undefined'?window:globalThis);
