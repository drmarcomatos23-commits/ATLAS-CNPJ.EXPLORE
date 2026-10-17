(()=>{
  const KPI_FACTS={
    'Empresas':'Base atual',
    'Processos em andamento':'Ativos agora',
    'Licenças vencendo':'Próximos 30 dias',
    'Honorários (mês)':'Competência do mês',
    'Pendências':'Atenções atuais',
    'Documentos':'Arquivos cadastrados'
  };

  function text(value){return String(value??'').trim();}
  function norm(value){return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}

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
    return {
      ...raw,
      clients,
      companies:clients,
      processes,
      costs,
      documents,
      pending:Array.isArray(raw.pending)?raw.pending:[]
    };
  }

  function patchKpiFacts(activeCount){
    document.querySelectorAll('.atlas-kpi').forEach(card=>{
      const label=text(card.querySelector('.atlas-kpi-copy small')?.textContent);
      const fact=KPI_FACTS[label];
      if(fact){
        const trend=card.querySelector('.atlas-kpi-copy em');
        if(trend)trend.textContent=fact;
      }
      if(label==='Processos em andamento'){
        const value=card.querySelector('.atlas-kpi-copy strong');
        if(value)value.textContent=new Intl.NumberFormat('pt-BR').format(activeCount);
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
    const previousLoad=window.loadOperationalData;
    window.loadOperationalData=async()=>enriched;
    let model=null;
    try{
      model=await finalRender();
    }finally{
      window.loadOperationalData=previousLoad;
    }
    if(model?.kpis)model.kpis.activeProcesses=activeCount;
    patchKpiFacts(activeCount);
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
    KPI_FACTS
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
  else setTimeout(install,0);
})();
