(() => {
  function e(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function rowHtml(p={}){
    return `<div class="partner-card" data-partner-id="${p.id||''}">
      <div class="partner-card-head"><strong>Sócio / Administrador</strong><button type="button" class="mini-btn danger partner-remove">Remover</button></div>
      <div class="partner-grid">
        <div class="field span-2"><label>Nome completo *</label><input class="partner-name" value="${e(p.full_name||'')}" placeholder="Nome completo"></div>
        <div class="field"><label>CPF / CNPJ</label><input class="partner-cpf" value="${e(p.cpf||'')}"></div>
        <div class="field"><label>RG</label><input class="partner-rg" value="${e(p.rg||'')}"></div>
        <div class="field"><label>Data de nascimento</label><input type="date" class="partner-birth" value="${e(p.birth_date||'')}"></div>
        <div class="field"><label>Nacionalidade</label><input class="partner-nationality" value="${e(p.nationality||'Brasileira')}"></div>
        <div class="field"><label>Estado civil</label><input class="partner-marital" value="${e(p.marital_status||'')}"></div>
        <div class="field"><label>Profissão</label><input class="partner-profession" value="${e(p.profession||'')}"></div>
        <div class="field"><label>E-mail</label><input type="email" class="partner-email" value="${e(p.email||'')}"></div>
        <div class="field"><label>Telefone</label><input class="partner-phone" value="${e(p.phone||'')}"></div>
        <div class="field"><label>Participação (%)</label><input inputmode="decimal" class="partner-percent" value="${p.ownership_percentage??''}" placeholder="0,00"></div>
        <div class="field span-2"><label>Endereço</label><input class="partner-address" value="${e(p.address||'')}"></div>
        <div class="field span-2 partner-check"><label><input type="checkbox" class="partner-admin" ${p.is_administrator?'checked':''}> Administrador da sociedade</label></div>
        <input type="hidden" class="partner-notes" value="${e(p.notes||'')}">
        ${p.notes?`<div class="span-2 partner-import-note">${e(p.notes)}</div>`:''}
      </div>
    </div>`;
  }

  function bindPartnerButtons(){
    document.querySelectorAll('.partner-remove').forEach(btn=>btn.onclick=()=>btn.closest('.partner-card')?.remove());
  }

  function normalizePartnerName(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function applyPartnerSourceNote(card,notes){
    if(!card||!notes)return;
    let hidden=card.querySelector('.partner-notes');
    if(!hidden){
      hidden=document.createElement('input');
      hidden.type='hidden';
      hidden.className='partner-notes';
      card.querySelector('.partner-grid')?.appendChild(hidden);
    }
    hidden.value=notes;
    let note=card.querySelector('.partner-import-note');
    if(!note){
      note=document.createElement('div');
      note.className='span-2 partner-import-note';
      card.querySelector('.partner-grid')?.appendChild(note);
    }
    note.textContent=notes;
  }

  function importPartnersFromCnpj(partners=[],source='Consulta pública'){
    const list=document.getElementById('partners-list');
    const summary=document.querySelector('.partner-summary');
    if(!list)return;
    let added=0,updated=0;
    partners.forEach(p=>{
      const key=normalizePartnerName(p.full_name);
      let card=[...list.querySelectorAll('.partner-card')].find(x=>normalizePartnerName(x.querySelector('.partner-name')?.value)===key);
      if(card){
        const cpf=card.querySelector('.partner-cpf');
        const nationality=card.querySelector('.partner-nationality');
        const admin=card.querySelector('.partner-admin');
        if(cpf&&!cpf.value&&p.cpf)cpf.value=p.cpf;
        if(nationality&&!nationality.value&&p.nationality)nationality.value=p.nationality;
        if(admin&&p.is_administrator)admin.checked=true;
        if(p.notes)applyPartnerSourceNote(card,p.notes);
        updated++;
        return;
      }
      list.insertAdjacentHTML('beforeend',rowHtml(p));
      added++;
    });
    bindPartnerButtons();
    if(summary){
      const total=partners.length;
      summary.innerHTML=total
        ? '<strong>'+total+' sócio(s)/administrador(es) encontrados via '+e(source)+'.</strong> '+added+' incluído(s) e '+updated+' conciliado(s) com dados já existentes. Complete CPF/CNPJ, RG, participação e demais campos quando a fonte pública não fornecer.'
        : 'Nenhum sócio foi retornado pela fonte pública para este CNPJ.';
    }
  }


  function collectPartners(){
    return [...document.querySelectorAll('.partner-card')].map(card=>({
      full_name:card.querySelector('.partner-name')?.value.trim()||'',
      cpf:card.querySelector('.partner-cpf')?.value.trim()||null,
      rg:card.querySelector('.partner-rg')?.value.trim()||null,
      birth_date:card.querySelector('.partner-birth')?.value||null,
      nationality:card.querySelector('.partner-nationality')?.value.trim()||null,
      marital_status:card.querySelector('.partner-marital')?.value.trim()||null,
      profession:card.querySelector('.partner-profession')?.value.trim()||null,
      email:card.querySelector('.partner-email')?.value.trim()||null,
      phone:card.querySelector('.partner-phone')?.value.trim()||null,
      address:card.querySelector('.partner-address')?.value.trim()||null,
      ownership_percentage:Number(String(card.querySelector('.partner-percent')?.value||'0').replace(',','.'))||null,
      is_administrator:!!card.querySelector('.partner-admin')?.checked,
      notes:card.querySelector('.partner-notes')?.value.trim()||null
    })).filter(p=>p.full_name);
  }

  async function savePartners(clientId,partners){
    const db=atlasDb(), profile=atlasProfile();
    const {error:delErr}=await db.from('client_partners').delete().eq('client_id',clientId);
    if(delErr)throw delErr;
    if(!partners.length)return;
    const rows=partners.map(p=>({...p,organization_id:profile.organization_id,client_id:clientId}));
    const {error}=await db.from('client_partners').insert(rows);
    if(error)throw error;
  }

  async function resolveClientId(id,taxId,legalName){
    if(id)return id;
    const db=atlasDb();
    for(let i=0;i<12;i++){
      await new Promise(r=>setTimeout(r,200));
      if(window.atlasLastSavedClientId)return window.atlasLastSavedClientId;
      let q=db.from('clients').select('id,legal_name,tax_id').eq('organization_id',atlasProfile().organization_id).order('created_at',{ascending:false}).limit(20);
      const {data}=await q;
      const d=String(taxId||'').replace(/\D/g,'');
      const found=(data||[]).find(c=>(d&&String(c.tax_id||'').replace(/\D/g,'')===d)||(!d&&c.legal_name===legalName));
      if(found)return found.id;
    }
    return null;
  }

  window.addEventListener('atlas:cnpj-partners-loaded',event=>{
    const detail=event?.detail||{};
    importPartnersFromCnpj(detail.partners||[],detail.source||'Consulta pública');
  });

  const prev=window.openClientModal;
  window.openClientModal=async function(id=''){
    await prev(id);
    const form=document.getElementById('client-real-form');
    if(!form)return;

    let existing=[];
    if(id){
      const {data}=await atlasDb().from('client_partners').select('*').eq('client_id',id).order('created_at',{ascending:true});
      existing=data||[];
    }

    const actions=form.querySelector('.modal-actions');
    const section=document.createElement('div');
    section.className='span-2 partners-section';
    section.innerHTML=`
      <div class="partners-title"><div><strong>Sócios e administradores</strong><span>Dados pessoais e participação societária</span></div><button type="button" id="partner-add" class="btn btn-muted">＋ Adicionar sócio</button></div>
      <div id="partners-list">${existing.map(rowHtml).join('')}</div>
      <div class="partner-summary">A soma dos percentuais pode ser conferida antes do salvamento.</div>`;
    form.insertBefore(section,actions);
    bindPartnerButtons();

    document.getElementById('partner-add')?.addEventListener('click',()=>{
      document.getElementById('partners-list').insertAdjacentHTML('beforeend',rowHtml({}));
      bindPartnerButtons();
    });

    form.addEventListener('submit',async()=>{
      const partners=collectPartners();
      const taxId=document.getElementById('client-tax-id')?.value||'';
      const legalName=document.getElementById('client-legal-name')?.value.trim()||'';
      try{
        const clientId=await resolveClientId(id,taxId,legalName);
        if(clientId)await savePartners(clientId,partners);
      }catch(err){console.error('Falha ao salvar sócios',err)}
    });
  };
})();