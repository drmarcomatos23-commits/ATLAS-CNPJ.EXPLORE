(() => {
  let running=false;
  const digits=v=>String(v||'').replace(/\D/g,'');

  function activeStateRegistration(payload){
    const e=payload?.estabelecimento||{};
    const list=Array.isArray(e.inscricoes_estaduais)?e.inscricoes_estaduais:[];
    const state=typeof e.estado==='object'?e.estado?.sigla:e.estado;
    const active=list.filter(x=>x?.ativo!==false);
    const match=active.find(x=>{
      const uf=typeof x?.estado==='object'?x.estado?.sigla:x?.estado;
      return state&&uf===state;
    })||active[0]||list[0];
    return match?.inscricao_estadual?String(match.inscricao_estadual):'';
  }

  function officialCompanyPatch(payload){
    const e=payload?.estabelecimento||{};
    const city=typeof e.cidade==='object'?e.cidade?.nome:e.cidade;
    const state=typeof e.estado==='object'?e.estado?.sigla:e.estado;
    const streetType=e?.tipo_logradouro||e?.descricao_tipo_de_logradouro||'';
    const streetName=e?.logradouro||e?.nome_logradouro||'';
    const source={
      legal_name:payload?.razao_social||payload?.razaoSocial||'',
      trade_name:e?.nome_fantasia||payload?.nome_fantasia||payload?.nomeFantasia||'',
      state_registration:activeStateRegistration(payload),
      postal_code:digits(e?.cep||payload?.cep||'').slice(0,8),
      street:[streetType,streetName].filter(Boolean).join(' ').trim()||payload?.logradouro||payload?.street||'',
      address_number:e?.numero||payload?.numero||payload?.number||'',
      address_complement:e?.complemento||payload?.complemento||payload?.complement||'',
      neighborhood:e?.bairro||payload?.bairro||payload?.neighborhood||'',
      city:city||payload?.municipio||payload?.city||'',
      state:state||payload?.uf||payload?.state||''
    };
    return Object.fromEntries(Object.entries(source).filter(([,value])=>value!==undefined&&value!==null&&String(value).trim()!==''));
  }

  function sourceUpdatedAt(payload){
    const raw=payload?.atualizado_em||payload?.ultima_atualizacao||payload?.estabelecimento?.atualizado_em||payload?.estabelecimento?.ultima_atualizacao||'';
    const time=raw?Date.parse(raw):NaN;
    return Number.isFinite(time)?new Date(time).toISOString():null;
  }

  function shouldApplyRemotePatch(client,payload){
    const sync=client?.metadata?.cnpj_sync||{};
    if(!sync?.official_verified)return true;
    const verified=Date.parse(sync?.verified_at||'');
    const remote=Date.parse(sourceUpdatedAt(payload)||'');
    if(!Number.isFinite(verified))return true;
    if(!Number.isFinite(remote))return false;
    return remote>verified;
  }

  async function refreshAllRegisteredCnpjs(){
    if(running)return null;
    running=true;
    try{
      const db=atlasDb();
      const {data,error}=await db.from('clients').select('id,tax_id,metadata');
      if(error)throw new Error(error.message||'Falha ao carregar empresas.');
      const clients=(data||[]).filter(client=>digits(client?.tax_id).length===14);
      let updated=0,failed=0,protectedCount=0;
      for(const client of clients){
        const cnpj=digits(client.tax_id);
        try{
          const fresh=Date.now();
          const res=await fetch('/api/cnpj?cnpj='+encodeURIComponent(cnpj)+'&fresh='+fresh,{headers:{Accept:'application/json'},cache:'no-store'});
          const payload=await res.json().catch(()=>null);
          if(!res.ok)throw new Error(payload?.detalhes||payload?.titulo||'Falha na consulta');
          if(!shouldApplyRemotePatch(client,payload)){
            protectedCount++;
            updated++;
            continue;
          }
          const patch=officialCompanyPatch(payload);
          const remoteUpdatedAt=sourceUpdatedAt(payload);
          patch.metadata={
            ...(client.metadata||{}),
            cnpj_sync:{
              ...(client.metadata?.cnpj_sync||{}),
              source:payload?._atlas_source||'Consulta CNPJ',
              synced_at:new Date().toISOString(),
              source_updated_at:remoteUpdatedAt,
              official_verified:false
            }
          };
          if(Object.keys(patch).length){
            const {error:updateError}=await db.from('clients').update(patch).eq('id',client.id);
            if(updateError)throw updateError;
          }
          updated++;
        }catch(err){
          failed++;
          console.warn('[ATLAS] Falha ao atualizar CNPJ',cnpj,err?.message||err);
        }
      }
      return {total:clients.length,updated,failed,protected:protectedCount};
    } finally {
      running=false;
    }
  }

  async function afterIndividualLookup(btn,msg){
    const started=Date.now();
    while(btn.disabled&&Date.now()-started<30000){
      await new Promise(resolve=>setTimeout(resolve,120));
    }
    if(!msg?.classList?.contains('success'))return;
    btn.disabled=true;
    const previous=btn.textContent;
    btn.textContent='Atualizando base...';
    try{
      const result=await refreshAllRegisteredCnpjs();
      if(!result)return;
      const protectedInfo=result.protected?`; ${result.protected} cadastro(s) oficial(is) mais recente(s) preservado(s)`:'';
      const info=result.total
        ? ` Base atualizada: ${result.updated} de ${result.total} CNPJ(s) consultado(s)${result.failed?`; ${result.failed} com falha`:''}${protectedInfo}.`
        : ' Não há CNPJs válidos cadastrados para atualização.';
      msg.textContent=String(msg.textContent||'').replace(/\s*Base atualizada:.*$/,'').trim()+info;
      msg.className='auth-message success span-2';
    }catch(err){
      console.warn('[ATLAS] Atualização geral de CNPJs não concluída',err?.message||err);
      msg.textContent=String(msg.textContent||'').trim()+' Não foi possível atualizar toda a base de CNPJs.';
      msg.className='auth-message error span-2';
    }finally{
      btn.disabled=false;
      btn.textContent=previous||'Consultar CNPJ';
    }
  }

  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('#client-cnpj-consult');
    if(!btn)return;
    const input=document.getElementById('client-tax-id');
    const msg=document.getElementById('client-cnpj-message');
    if(digits(input?.value).length!==14)return;
    queueMicrotask(()=>afterIndividualLookup(btn,msg));
  });

  window.AtlasCnpjRefreshAll={refreshAllRegisteredCnpjs,officialCompanyPatch,shouldApplyRemotePatch,sourceUpdatedAt};
})();
