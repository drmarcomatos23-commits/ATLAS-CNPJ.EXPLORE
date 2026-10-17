(()=>{
  const KPI_FACTS={
    'Empresas':'Base atual',
    'Processos em andamento':'Ativos agora',
    'Licenças vencendo':'Próximos 30 dias',
    'Documentos':'Arquivos cadastrados'
  };

  function text(value){return String(value??'').trim();}
  function norm(value){return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function number(value){const n=Number(value);return Number.isFinite(n)?n:0;}
  function formatCurrency(value){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}).format(number(value));}

  function legalNatureRaw(company={}){
    return text(company.legal_nature||company.natureza_juridica||company.company_type||company.metadata?.cnpj_sync?.legal_nature||'');
  }

  function legalNatureBucket(company={}){
    const raw=legalNatureRaw(company);
    const value=norm(raw);
    if(!value)return 'Não informado';
    if(value.includes('empresa individual de responsabilidade limitada')||value.includes('eireli'))return 'EIRELI';
    if(value.includes('microempreendedor individual')||value==='mei')return 'MEI';
    if(value.includes('sociedade anonima')||value.includes('sociedade anônima')||value==='s/a'||value==='sa')return 'S/A';
    if(value.includes('limitada')||value.includes('ltda'))return 'LTDA';
    if(value.includes('empresario')||value.includes('empresário'))return 'Empresário Individual';
    return 'Outros';
  }

  function dashboardStageName(value=''){
    const stage=norm(value);
    if(!stage)return '';
    if(stage.includes('briefing')||stage.includes('viabilidade'))return 'Consulta de Viabilidade';
    if(stage.includes('dbe')||stage.includes('receita'))return 'DBE / Receita Federal';
    if(stage.includes('registro')||stage.includes('junta'))return 'Junta Comercial';
    if(stage.includes('inscri')||stage.includes('alvara'))return 'Alvará Municipal';
    if(stage.includes('licenc')||stage.includes('regulador'))return 'Licenças / Órgãos Reguladores';
    if(stage.includes('conclu')||stage.includes('pos-abertura')||stage.includes('regulariza'))return 'Pós-abertura / Regularização';
    return text(value);
  }

  function isClosedProcess(process={}){
    const status=norm(process.status||process.process_status||process.state||'');
    return status==='completed'||status==='cancelled'||status==='canceled'||status.includes('conclu')||status.includes('finaliz')||status.includes('cancel');
  }

  function activeProcessCount(processes=[]){
    return processes.filter(process=>!isClosedProcess(process)).length;
  }

  function financialPendingStats(costs=[]){
    const unpaid=(Array.isArray(costs)?costs:[]).filter(cost=>{
      const status=norm(cost?.payment_status||cost?.status||'');
      return !!status && status!=='paid' && status!=='pago' && status!=='quitado' && status!=='settled';
    });
    return {
      count:unpaid.length,
      total:unpaid.reduce((sum,cost)=>sum+number(cost?.amount),0)
    };
  }

  function operationalPendingCount(data={}){
    const summary=window.AtlasV4Core?.buildPendingSummary?.(data)||{};
    return number(summary.cliente)+number(summary.equipe)+number(summary.orgao);
  }

  async function fetchDocuments(){
    const db=window.atlasDb?.()||window.atlasAuth?.client;
    if(!db?.from)return [];
    try{
      const {data,error}=await db.from('documents').select('*').order('created_at',{ascending:false});
      if(error){console.warn('ATLAS V7: documentos indisponíveis para a Dashboard',error);return [];}
      return data||[];
    }catch(error){
      console.warn('ATLAS V7: falha ao carregar documentos reais',error);
      return [];
    }
  }

  async function enrich(raw={}){
    const stages=Array.isArray(raw.stages)?raw.stages:[];
    const stageById=new Map(stages.map(stage=>[String(stage.id),stage]));
    const clients=(Array.isArray(raw.clients)?raw.clients:Array.isArray(raw.companies)?raw.companies:[])
      .filter(client=>!client?.deleted_at)
      .map(client=>({...client,legal_nature_raw:legalNatureRaw(client),legal_nature:legalNatureBucket(client)}));
    const processes=(Array.isArray(raw.processes)?raw.processes:[])
      .filter(process=>!process?.deleted_at)
      .map(process=>{
        const stage=stageById.get(String(process.current_stage_id||''));
        return {...process,stage_name:dashboardStageName(stage?.name||process.stage_name||process.current_stage_name||'')};
      });
    const costs=(Array.isArray(raw.costs)?raw.costs:[]).map(cost=>({
      ...cost,
      kind:cost.kind||cost.fee_kind||'',
      category:cost.category||cost.cost_type||'',
      type:cost.type||cost.fee_kind||cost.cost_type||''
    }));
    const documents=Array.isArray(raw.documents)?raw.documents:await fetchDocuments();
    const normalized={...raw,clients,companies:clients,processes,costs,documents};
    const operationalPending=operationalPendingCount(normalized);
    const financialPending=financialPendingStats(costs);
    return {
      ...normalized,
      pending:Array.isArray(raw.pending)?raw.pending:[],
      pendingCount:operationalPending,
      financialPending
    };
  }

  function patchKpiFacts(activeCount,operationalPending,financialPending){
    document.querySelectorAll('.atlas-kpi').forEach(card=>{
      const labelEl=card.querySelector('.atlas-kpi-copy small');
      const valueEl=card.querySelector('.atlas-kpi-copy strong');
      const trendEl=card.querySelector('.atlas-kpi-copy em');
      const actionEl=card.querySelector('.atlas-kpi-copy span');
      const label=text(labelEl?.textContent);
      const fact=KPI_FACTS[label];
      if(fact&&trendEl)trendEl.textContent=fact;

      if(label==='Processos em andamento'&&valueEl){
        valueEl.textContent=new Intl.NumberFormat('pt-BR').format(activeCount);
      }

      if(label==='Honorários (mês)'){
        if(labelEl)labelEl.textContent='Financeiro Pendente';
        if(valueEl)valueEl.textContent=formatCurrency(financialPending.total);
        if(trendEl)trendEl.textContent=`${new Intl.NumberFormat('pt-BR').format(financialPending.count)} lançamentos pendentes`;
        if(actionEl)actionEl.textContent='Ver financeiro →';
      }

      if(label==='Pendências'){
        if(labelEl)labelEl.textContent='Pendências Operacionais';
        if(valueEl)valueEl.textContent=new Intl.NumberFormat('pt-BR').format(operationalPending);
        if(trendEl)trendEl.textContent='Exigências e providências';
        if(actionEl)actionEl.textContent='Ver exigências →';
      }
    });
    const typeCard=[...document.querySelectorAll('.atlas-card')].find(card=>card.querySelector('h2')?.textContent?.trim()==='EMPRESAS POR TIPO');
    const subtitle=typeCard?.querySelector('header p');
    if(subtitle)subtitle.textContent='Natureza jurídica real disponível no cadastro/CNPJ.';
  }

  async function render(){
    const originalLoad=window.loadOperationalData;
    const finalRender=window.AtlasReferenceFinal?.render;
    if(typeof finalRender!=='function')return null;
    const raw=typeof originalLoad==='function'?await originalLoad():{};
    const enriched=await enrich(raw||{});
    const activeCount=activeProcessCount(enriched.processes);
    const operationalPending=number(enriched.pendingCount);
    const financialPending=enriched.financialPending||{count:0,total:0};
    const previousLoad=window.loadOperationalData;
    window.loadOperationalData=async()=>enriched;
    let model=null;
    try{
      model=await finalRender();
    }finally{
      window.loadOperationalData=previousLoad;
    }
    if(model?.kpis){
      model.kpis.activeProcesses=activeCount;
      model.kpis.pending=operationalPending;
      model.kpis.operationalPending=operationalPending;
      model.kpis.financialPending=financialPending.total;
      model.kpis.financialPendingCount=financialPending.count;
    }
    patchKpiFacts(activeCount,operationalPending,financialPending);
    return model;
  }

  function install(){
    if(!window.AtlasReferenceFinal?.render){setTimeout(install,80);return;}
    window.dashboard=render;
    const dashboardActive=document.querySelector('#nav .nav-item.active[data-page="dashboard"]')||document.querySelector('#page-content .atlas-final-dashboard');
    if(dashboardActive)render().catch(error=>console.error('ATLAS V7 Dashboard real-data:',error));
  }

  window.AtlasRealDataV7={
    enrich,
    render,
    legalNatureBucket,
    dashboardStageName,
    activeProcessCount,
    financialPendingStats,
    operationalPendingCount,
    KPI_FACTS
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
  else setTimeout(install,0);
})();
