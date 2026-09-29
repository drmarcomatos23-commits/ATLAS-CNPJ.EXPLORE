(() => {
  const LICENSE_TYPES = [
    {name:'AVCB', agency:'Corpo de Bombeiros'},
    {name:'ALVARÁ DE FUNCIONAMENTO', agency:'Prefeitura Municipal'},
    {name:'LICENÇA SANITÁRIA', agency:'Vigilância Sanitária'},
    {name:'ANVISA', agency:'ANVISA'}
  ];

  let licenseChannel=null;

  function ee(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function dateBR(v){if(!v)return '—';const d=new Date(v+'T12:00:00');return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')}
  function daysUntil(v){
    if(!v)return null;
    const today=new Date();today.setHours(0,0,0,0);
    const exp=new Date(v+'T12:00:00');exp.setHours(0,0,0,0);
    return Math.ceil((exp-today)/86400000);
  }
  function alertInfo(license){
    if(!license)return {label:'Não informado',cls:'muted',days:null,text:'Vencimento não cadastrado'};
    if(license.status==='not_applicable')return {label:'Não se aplica',cls:'muted',days:null,text:'Dispensada para esta empresa'};
    if(!license.expires_at)return {label:'Sem vencimento',cls:'warn',days:null,text:'Informe a data de vencimento'};
    const days=daysUntil(license.expires_at);
    if(days<0)return {label:'Vencida',cls:'bad',days,text:'Vencida há '+Math.abs(days)+' dia(s)'};
    if(days<=30)return {label:'Urgente',cls:'bad',days,text:days+' dia(s) para vencer'};
    if(days<=60)return {label:'Atenção',cls:'warn',days,text:days+' dia(s) para vencer'};
    if(days<=90)return {label:'Renovar',cls:'warn',days,text:days+' dia(s) para vencer'};
    return {label:'Regular',cls:'ok',days,text:days+' dia(s) para vencer'};
  }

  async function loadLicenseCompliance(){
    const db=atlasDb();
    const [clientsRes,licensesRes]=await Promise.all([
      db.from('clients').select('id,legal_name,trade_name,tax_id,city,state').order('legal_name',{ascending:true}),
      db.from('licenses').select('*')
    ]);
    if(clientsRes.error)throw clientsRes.error;
    if(licensesRes.error)throw licensesRes.error;
    return {clients:clientsRes.data||[],licenses:licensesRes.data||[]};
  }

  function licenseCard(client,def,record){
    const a=alertInfo(record);
    return `<article class="license-card ${a.cls}">
      <div class="license-card-top"><div><strong>${ee(def.name)}</strong><span>${ee(record?.agency||def.agency)}</span></div><span class="pill ${a.cls}">${ee(a.label)}</span></div>
      <div class="license-meta">
        <div><span>Número</span><strong>${ee(record?.document_number||'—')}</strong></div>
        <div><span>Vencimento</span><strong>${dateBR(record?.expires_at)}</strong></div>
        <div class="license-countdown"><span>Renovação</span><strong>${ee(a.text)}</strong></div>
      </div>
    </article>`;
  }

  window.licensePage=async function(){
    setHead('Licenças','CONFORMIDADE','Controle de AVCB, Alvará de Funcionamento, Licença Sanitária e ANVISA por empresa.');
    page('<div class="loading-box"><span class="spinner"></span><div>Carregando empresas e licenças...</div></div>');
    try{
      const data=await loadLicenseCompliance();
      const map=new Map(data.licenses.map(l=>[l.client_id+'|'+String(l.name).toUpperCase(),l]));
      const allAssignments=data.clients.flatMap(c=>LICENSE_TYPES.map(def=>({client:c,def,record:map.get(c.id+'|'+def.name)})));
      const attention=allAssignments.filter(x=>{const a=alertInfo(x.record);return ['bad','warn'].includes(a.cls)}).length;
      const expired=allAssignments.filter(x=>alertInfo(x.record).label==='Vencida').length;
      const regular=allAssignments.filter(x=>alertInfo(x.record).label==='Regular').length;
      const missing=allAssignments.filter(x=>!x.record).length;

      const companies=data.clients.map(c=>{
        const cards=LICENSE_TYPES.map(def=>licenseCard(c,def,map.get(c.id+'|'+def.name))).join('');
        return `<section class="surface pad company-license-block">
          <div class="section-head license-company-head">
            <div><h2>${ee(c.legal_name)}</h2><span>${ee(c.tax_id||'CNPJ não informado')} · ${ee([c.city,c.state].filter(Boolean).join('/')||'Local não informado')}</span></div>
            ${canEditOps()? `<button class="btn btn-muted" onclick="openCompanyLicenses('${c.id}')">Editar licenças</button>` : ''}
          </div>
          <div class="license-grid">${cards}</div>
        </section>`;
      }).join('');

      page(`
        <div class="grid kpi-grid">
          <div class="surface kpi"><span class="kpi-label">Empresas</span><strong>${data.clients.length}</strong><small>Empresas monitoradas</small></div>
          <div class="surface kpi"><span class="kpi-label">Licenças regulares</span><strong>${regular}</strong><small>Mais de 90 dias</small></div>
          <div class="surface kpi"><span class="kpi-label">Renovação / atenção</span><strong>${attention}</strong><small>Até 90 dias ou sem vencimento</small></div>
          <div class="surface kpi"><span class="kpi-label">Vencidas</span><strong>${expired}</strong><small>Exigem ação imediata</small></div>
        </div>
        ${missing ? `<div class="source-note" style="margin-top:14px"><strong>${missing} atribuição(ões) ainda sem cadastro.</strong> Empresas novas aparecem automaticamente com os quatro controles padrão.</div>` : ''}
        <div class="license-company-list">${companies || '<section class="surface pad"><div class="empty-state"><h3>Nenhuma empresa cadastrada</h3><p>Cadastre uma empresa para iniciar o controle de licenças.</p></div></section>'}</div>
      `);
      startLicenseRealtime();
    }catch(err){
      page('<div class="error-box">Não foi possível carregar as licenças: '+ee(err.message||err)+'</div>');
    }
  };

  window.openCompanyLicenses=async function(clientId){
    const db=atlasDb();
    const [{data:client,error:clientError},{data:records,error:licensesError}]=await Promise.all([
      db.from('clients').select('id,legal_name,tax_id').eq('id',clientId).single(),
      db.from('licenses').select('*').eq('client_id',clientId)
    ]);
    if(clientError||!client)return alert('Empresa não encontrada.');
    if(licensesError)return alert('Não foi possível carregar as licenças.');

    const byName=new Map((records||[]).map(x=>[String(x.name).toUpperCase(),x]));
    const rows=LICENSE_TYPES.map((def,idx)=>{
      const r=byName.get(def.name)||{};
      const mode=r.status==='not_applicable'?'not_applicable':(r.id?'active':'not_informed');
      return `<div class="license-edit-row" data-license-name="${ee(def.name)}" data-license-id="${r.id||''}">
        <div class="license-edit-title"><strong>${ee(def.name)}</strong><span>${ee(def.agency)}</span></div>
        <div class="license-edit-grid">
          <div class="field"><label>Situação</label><select class="lic-mode"><option value="not_informed" ${mode==='not_informed'?'selected':''}>Não informado</option><option value="active" ${mode==='active'?'selected':''}>Aplicável / Controlar</option><option value="not_applicable" ${mode==='not_applicable'?'selected':''}>Não se aplica</option></select></div>
          <div class="field"><label>Número / registro</label><input class="lic-number" value="${ee(r.document_number||'')}"></div>
          <div class="field"><label>Data de emissão</label><input class="lic-issued" type="date" value="${r.issued_at||''}"></div>
          <div class="field"><label>Data de vencimento</label><input class="lic-expires" type="date" value="${r.expires_at||''}"></div>
        </div>
      </div>`;
    }).join('');

    modalShell('Licenças · '+client.legal_name,`<form id="licenses-company-form">
      <div class="source-note"><strong>Alertas automáticos:</strong> o ATLAS sinaliza renovações em 90, 60 e 30 dias e destaca licenças vencidas.</div>
      <div class="license-edit-list">${rows}</div>
      <div id="licenses-form-message" class="auth-message hidden"></div>
      <div class="modal-actions"><button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button id="licenses-save-btn" class="btn btn-primary" type="submit">Salvar licenças</button></div>
    </form>`,true);

    document.getElementById('licenses-company-form')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=document.getElementById('licenses-save-btn');
      const msg=document.getElementById('licenses-form-message');
      btn.disabled=true;btn.textContent='Salvando...';
      try{
        for(const row of document.querySelectorAll('.license-edit-row')){
          const name=row.dataset.licenseName;
          const existingId=row.dataset.licenseId;
          const mode=row.querySelector('.lic-mode').value;
          if(mode==='not_informed'){
            if(existingId){
              const {error}=await db.from('licenses').delete().eq('id',existingId);
              if(error)throw error;
            }
            continue;
          }
          const def=LICENSE_TYPES.find(x=>x.name===name);
          const payload={
            client_id:clientId,
            name,
            agency:def?.agency||null,
            document_number:row.querySelector('.lic-number').value.trim()||null,
            issued_at:row.querySelector('.lic-issued').value||null,
            expires_at:row.querySelector('.lic-expires').value||null,
            renewal_lead_days:[90,60,30],
            status:mode==='not_applicable'?'not_applicable':'active'
          };
          if(existingId){
            const {error}=await db.from('licenses').update(payload).eq('id',existingId);
            if(error)throw error;
          }else{
            const {error}=await db.from('licenses').insert(payload);
            if(error)throw error;
          }
        }
        closeAtlasModal();
        await window.licensePage();
      }catch(err){
        msg.textContent=err.message||'Não foi possível salvar as licenças.';
        msg.className='auth-message error';
        btn.disabled=false;btn.textContent='Salvar licenças';
      }
    });
  };

  function startLicenseRealtime(){
    const db=atlasDb();
    if(!db||licenseChannel)return;
    licenseChannel=db.channel('atlas-licenses-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'licenses'},()=>{
        const pageName=document.querySelector('#nav [data-page].active')?.dataset?.page;
        if(pageName==='licencas')window.licensePage();
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'clients'},()=>{
        const pageName=document.querySelector('#nav [data-page].active')?.dataset?.page;
        if(pageName==='licencas')window.licensePage();
      })
      .subscribe();
  }
})();