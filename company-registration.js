(() => {
  function digits(v){ return String(v||'').replace(/\D/g,''); }
  function formatCnpj(v){
    const d=digits(v).slice(0,14);
    if(d.length!==14) return d;
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
  }
  function escHtml(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function activeStateRegistration(payload){
    const e=payload?.estabelecimento||{};
    const list=Array.isArray(e.inscricoes_estaduais)?e.inscricoes_estaduais:[];
    const state=typeof e.estado==='object'?e.estado?.sigla:e.estado;
    const active=list.filter(x=>x?.ativo!==false);
    const match=active.find(x=>{
      const uf=typeof x?.estado==='object'?x.estado?.sigla:x?.estado;
      return state && uf===state;
    }) || active[0] || list[0];
    return match?.inscricao_estadual ? String(match.inscricao_estadual) : '';
  }
  function partnersFromPayload(d){
    const list=Array.isArray(d?.socios)?d.socios:(Array.isArray(d?.qsa)?d.qsa:[]);
    return list.map(p=>{
      const qualification=p?.qualificacao_socio?.descricao||p?.qualificacao_socio||p?.qualificacao||'';
      const publicDocument=String(p?.cpf_cnpj_socio||p?.cnpj_cpf_do_socio||p?.cpf_cnpj||'').trim();
      const docDigits=digits(publicDocument);
      const fullDocument=/^\d{11}$/.test(docDigits)||/^\d{14}$/.test(docDigits) ? docDigits : '';
      const countryName=p?.pais?.nome||p?.pais||'';
      const entryDate=p?.data_entrada||p?.data_entrada_sociedade||'';
      const notes=[
        'Importado automaticamente da consulta pública do CNPJ',
        qualification?'Qualificação: '+qualification.trim():'',
        entryDate?'Entrada na sociedade: '+entryDate:'',
        publicDocument&&!fullDocument?'CPF/CNPJ disponibilizado de forma parcial pela fonte: '+publicDocument:''
      ].filter(Boolean).join(' | ');
      return {
        full_name:String(p?.nome||p?.nome_socio||'').trim(),
        cpf:fullDocument,
        nationality:/brasil/i.test(String(countryName))?'Brasileira':'',
        is_administrator:/administrador/i.test(String(qualification)),
        notes,
        source_qualification:String(qualification||'').trim(),
        source_document:publicDocument
      };
    }).filter(p=>p.full_name);
  }

  function normalizePartnerKey(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function ensurePartnersVisible(partners=[]){
    const list=document.getElementById('partners-list');
    if(!list||!partners.length)return;
    const existingNames=()=>[...list.querySelectorAll('.partner-name')].map(x=>normalizePartnerKey(x.value));
    partners.forEach(p=>{
      const key=normalizePartnerKey(p.full_name);
      if(!key||existingNames().includes(key))return;
      const card=document.createElement('div');
      card.className='partner-card';
      card.innerHTML=`
        <div class="partner-card-head"><strong>Sócio / Administrador</strong><button type="button" class="mini-btn danger partner-remove">Remover</button></div>
        <div class="partner-grid">
          <div class="field span-2"><label>Nome completo *</label><input class="partner-name" value="${escHtml(p.full_name||'')}" placeholder="Nome completo"></div>
          <div class="field"><label>CPF / CNPJ</label><input class="partner-cpf" value="${escHtml(p.cpf||'')}" placeholder="Preenchimento manual quando não disponível"></div>
          <div class="field"><label>RG</label><input class="partner-rg" value="" placeholder="Preenchimento manual"></div>
          <div class="field"><label>Data de nascimento</label><input type="date" class="partner-birth" value=""></div>
          <div class="field"><label>Nacionalidade</label><input class="partner-nationality" value="${escHtml(p.nationality||'Brasileira')}"></div>
          <div class="field"><label>Estado civil</label><input class="partner-marital" value=""></div>
          <div class="field"><label>Profissão</label><input class="partner-profession" value=""></div>
          <div class="field"><label>E-mail</label><input type="email" class="partner-email" value=""></div>
          <div class="field"><label>Telefone</label><input class="partner-phone" value=""></div>
          <div class="field"><label>Participação (%)</label><input inputmode="decimal" class="partner-percent" value="" placeholder="0,00"></div>
          <div class="field span-2"><label>Endereço</label><input class="partner-address" value=""></div>
          <div class="field span-2 partner-check"><label><input type="checkbox" class="partner-admin" ${p.is_administrator?'checked':''}> Administrador da sociedade</label></div>
          <input type="hidden" class="partner-notes" value="${escHtml(p.notes||'')}">
          ${p.notes?`<div class="span-2 partner-import-note">${escHtml(p.notes)}</div>`:''}
        </div>`;
      card.querySelector('.partner-remove')?.addEventListener('click',()=>card.remove());
      list.appendChild(card);
    });
    const summary=document.querySelector('.partner-summary');
    if(summary){
      summary.innerHTML='<strong>Quadro societário importado automaticamente.</strong> Os nomes e a qualificação disponíveis foram preenchidos. Complete manualmente CPF/CNPJ, RG, participação, estado civil, profissão, contatos e endereço quando a fonte pública não disponibilizar esses dados.';
    }
  }

  function companyFromPayload(d){
    const e=d?.estabelecimento||{};
    const city=typeof e.cidade==='object'?e.cidade?.nome:e.cidade;
    const state=typeof e.estado==='object'?e.estado?.sigla:e.estado;
    const streetType=e?.tipo_logradouro||e?.descricao_tipo_de_logradouro||'';
    const streetName=e?.logradouro||e?.nome_logradouro||'';
    const street=[streetType,streetName].filter(Boolean).join(' ').trim();
    return {
      legal_name:d?.razao_social||d?.razaoSocial||'',
      trade_name:e?.nome_fantasia||d?.nome_fantasia||d?.nomeFantasia||'',
      tax_id:formatCnpj(e?.cnpj||d?.cnpj||''),
      state_registration:activeStateRegistration(d),
      postal_code:digits(e?.cep||d?.cep||'').slice(0,8),
      street:street||d?.logradouro||d?.street||'',
      address_number:e?.numero||d?.numero||d?.number||'',
      address_complement:e?.complemento||d?.complemento||d?.complement||'',
      neighborhood:e?.bairro||d?.bairro||d?.neighborhood||'',
      city:city||d?.municipio||d?.city||'',
      state:state||d?.uf||d?.state||'',
      phone:[e?.ddd1,e?.telefone1].filter(Boolean).join(' ')||d?.telefone||'',
      email:e?.email||d?.email||''
    };
  }

  async function lookupCompanyCnpj(){
    const input=document.getElementById('client-tax-id');
    const msg=document.getElementById('client-cnpj-message');
    const btn=document.getElementById('client-cnpj-consult');
    if(!input||!msg||!btn)return;
    const cnpj=digits(input.value);
    if(cnpj.length!==14){
      msg.textContent='Informe os 14 dígitos do CNPJ.';
      msg.className='auth-message error span-2';
      return;
    }
    btn.disabled=true;btn.textContent='Consultando...';
    msg.className='auth-message hidden span-2';
    try{
      const res=await fetch('/api/cnpj?cnpj='+encodeURIComponent(cnpj),{headers:{Accept:'application/json'}});
      const data=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(data?.detalhes||data?.titulo||'Não foi possível consultar o CNPJ.');
      const company=companyFromPayload(data);
      document.getElementById('client-tax-id').value=company.tax_id;
      document.getElementById('client-legal-name').value=company.legal_name;
      document.getElementById('client-trade-name').value=company.trade_name;
      document.getElementById('client-state-registration').value=company.state_registration;
      document.getElementById('client-postal-code').value=company.postal_code||'';
      document.getElementById('client-street').value=company.street||'';
      document.getElementById('client-address-number').value=company.address_number||'';
      document.getElementById('client-address-complement').value=company.address_complement||'';
      document.getElementById('client-neighborhood').value=company.neighborhood||'';
      document.getElementById('client-city').value=company.city;
      document.getElementById('client-state').value=company.state;
      if(company.phone && !document.getElementById('client-phone').value)document.getElementById('client-phone').value=company.phone;
      if(company.email && !document.getElementById('client-email').value)document.getElementById('client-email').value=company.email;
      const partners=partnersFromPayload(data);
      window.dispatchEvent(new CustomEvent('atlas:cnpj-partners-loaded',{
        detail:{cnpj,partners,source:data?._atlas_source||'Consulta pública'}
      }));
      // Fallback robusto: garante o preenchimento dos nomes mesmo se o módulo de sócios
      // estiver em uma versão anterior no cache/navegador.
      setTimeout(()=>ensurePartnersVisible(partners),0);
      const partnerInfo=partners.length?' '+partners.length+' sócio(s)/administrador(es) também foram localizados e incluídos para revisão.':'';
      msg.textContent=(company.state_registration
        ? 'Dados cadastrais e Inscrição Estadual carregados.'
        : 'Dados cadastrais carregados. A Inscrição Estadual não foi encontrada na fonte consultada.')+partnerInfo+' Revise antes de salvar.';
      msg.className='auth-message success span-2';
    }catch(err){
      msg.textContent=err.message||'Falha na consulta do CNPJ.';
      msg.className='auth-message error span-2';
    }finally{
      btn.disabled=false;btn.textContent='Consultar CNPJ';
    }
  }

  async function lookupCompanyCep(){
    const input=document.getElementById('client-postal-code');
    const msg=document.getElementById('client-address-message');
    const btn=document.getElementById('client-cep-consult');
    if(!input||!msg||!btn)return;
    const cep=digits(input.value);
    if(cep.length!==8){
      msg.textContent='Informe os 8 dígitos do CEP.';
      msg.className='auth-message error span-2';
      return;
    }
    btn.disabled=true;btn.textContent='Consultando...';
    msg.className='auth-message hidden span-2';
    try{
      const res=await fetch('/api/cep?cep='+encodeURIComponent(cep),{headers:{Accept:'application/json'}});
      const data=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(data?.message||data?.detalhes||'Não foi possível consultar o CEP.');
      const street=data?.street||data?.logradouro||'';
      const neighborhood=data?.neighborhood||data?.bairro||'';
      const city=data?.city||data?.municipio||'';
      const state=data?.state||data?.uf||'';
      const complement=data?.complement||data?.complemento||'';
      document.getElementById('client-postal-code').value=cep.replace(/^(\d{5})(\d{3})$/,'$1-$2');
      if(street)document.getElementById('client-street').value=street;
      if(neighborhood)document.getElementById('client-neighborhood').value=neighborhood;
      if(city)document.getElementById('client-city').value=city;
      if(state)document.getElementById('client-state').value=String(state).toUpperCase();
      const complementInput=document.getElementById('client-address-complement');
      if(complement&&complementInput&&!complementInput.value)complementInput.value=complement;
      msg.textContent='Endereço localizado pelo CEP'+(data?._atlas_source?' via '+data._atlas_source:'')+'. Informe o número e revise os dados antes de salvar.';
      msg.className='auth-message success span-2';
    }catch(err){
      msg.textContent=err.message||'Falha na consulta do CEP.';
      msg.className='auth-message error span-2';
    }finally{
      btn.disabled=false;btn.textContent='Consultar CEP';
    }
  }

  window.openClientModal = async function(id=''){
    if(!id)window.atlasLastSavedClientId=null;
    const db=atlasDb();
    let record=null;
    if(id){
      const {data,error}=await db.from('clients').select('*').eq('id',id).single();
      if(error)return alert('Não foi possível carregar a empresa: '+error.message);
      record=data;
    }
    const canViewGroups=atlasProfile().role==='admin'||window.atlasHasPermission?.('companies.groups.view')===true;
    const groupQuery=canViewGroups
      ? await db.from('client_groups').select('id,name').order('name',{ascending:true})
      : {data:[],error:null};
    const groups=groupQuery.data||[];

    modalShell(id?'Editar empresa':'Nova empresa',`<form id="client-real-form" class="modal-form-grid">
      <div class="field span-2">
        <label>CNPJ <span class="field-optional">(opcional para empresa em constituição)</span></label>
        <div class="company-cnpj-row">
          <input id="client-tax-id" inputmode="numeric" placeholder="00.000.000/0000-00" value="${escHtml(record?.tax_id||'')}">
          <button id="client-cnpj-consult" class="btn btn-muted" type="button">Consultar CNPJ</button>
        </div>
      </div>
      <div id="client-cnpj-message" class="auth-message hidden span-2"></div>

      <div class="field span-2"><label>Razão social / nome provisório *</label><input id="client-legal-name" required value="${escHtml(record?.legal_name||'')}" placeholder="Ex.: Empresa em constituição ou razão social pretendida"></div>
      <div class="field"><label>Nome fantasia</label><input id="client-trade-name" value="${escHtml(record?.trade_name||'')}"></div>
      ${canViewGroups?`<div class="field">
        <label>Grupo empresarial</label>
        <select id="client-group-id">
          <option value="">Sem grupo</option>
          ${groups.map(g=>`<option value="${g.id}" ${record?.group_id===g.id?'selected':''}>${escHtml(g.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field span-2">
        <label>Novo grupo <span class="field-optional">(opcional)</span></label>
        <div class="company-cnpj-row">
          <input id="client-new-group-name" placeholder="Ex.: Sorriso Maroto, Grupo Seven, Reliance...">
          <button id="client-group-create" class="btn btn-muted" type="button">＋ Criar grupo</button>
        </div>
        <small class="company-group-help">Use um grupo para reunir várias empresas do mesmo cliente ou estrutura econômica.</small>
      </div>
      <div id="client-group-message" class="auth-message hidden span-2"></div>`:''}
      <div class="field"><label>Inscrição Estadual</label><input id="client-state-registration" value="${escHtml(record?.state_registration||'')}" placeholder="IE"></div>
      <div class="field"><label>Inscrição Municipal</label><input id="client-municipal-registration" value="${escHtml(record?.municipal_registration||'')}" placeholder="IM"></div>
      <div class="field"><label>Contato</label><input id="client-contact" value="${escHtml(record?.contact_name||'')}"></div>
      <div class="field"><label>E-mail</label><input id="client-email" type="email" value="${escHtml(record?.email||'')}"></div>
      <div class="field"><label>Telefone</label><input id="client-phone" value="${escHtml(record?.phone||'')}"></div>

      <div class="span-2 company-address-title">
        <strong>Endereço da empresa</strong>
        <span>Preencha o endereço completo da sede ou estabelecimento principal.</span>
      </div>
      <div class="field span-2">
        <label>CEP</label>
        <div class="company-cnpj-row">
          <input id="client-postal-code" inputmode="numeric" placeholder="00000-000" value="${escHtml(record?.postal_code||'')}">
          <button id="client-cep-consult" class="btn btn-muted" type="button">Consultar CEP</button>
        </div>
      </div>
      <div id="client-address-message" class="auth-message hidden span-2"></div>
      <div class="field span-2"><label>Logradouro</label><input id="client-street" value="${escHtml(record?.street||'')}" placeholder="Rua, Avenida, Praça..."></div>
      <div class="field"><label>Número</label><input id="client-address-number" value="${escHtml(record?.address_number||'')}" placeholder="Número"></div>
      <div class="field"><label>Complemento</label><input id="client-address-complement" value="${escHtml(record?.address_complement||'')}" placeholder="Sala, conjunto, bloco..."></div>
      <div class="field"><label>Bairro</label><input id="client-neighborhood" value="${escHtml(record?.neighborhood||'')}"></div>
      <div class="field"><label>Cidade</label><input id="client-city" value="${escHtml(record?.city||'')}"></div>
      <div class="field"><label>UF</label><input id="client-state" maxlength="2" value="${escHtml(record?.state||'')}"></div>
      <div class="field"><label>País</label><input id="client-country" value="${escHtml(record?.country||'Brasil')}"></div>
      <div class="field span-2"><label>Referência</label><input id="client-address-reference" value="${escHtml(record?.address_reference||'')}" placeholder="Ponto de referência (opcional)"></div>

      <div class="modal-actions span-2">
        <button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button>
        <button id="client-save-btn" class="btn btn-primary" type="submit">Salvar empresa</button>
      </div>
      <div id="client-form-message" class="auth-message hidden span-2"></div>
    </form>`,true);

    let duplicateClient=null;

    async function checkDuplicateCnpj(){
      duplicateClient=null;
      const msg=document.getElementById('client-cnpj-message');
      const saveBtn=document.getElementById('client-save-btn');
      const cnpj=digits(document.getElementById('client-tax-id')?.value||'');
      if(!msg||!saveBtn)return false;
      if(cnpj.length!==14){
        saveBtn.disabled=false;
        return false;
      }
      const {data,error}=await db.rpc('atlas_find_client_by_cnpj',{
        p_cnpj:cnpj,
        p_exclude_id:id||null
      });
      if(error){
        console.error('Falha ao verificar duplicidade',error);
        return false;
      }
      duplicateClient=(data||[])[0]||null;
      if(duplicateClient){
        const archived=duplicateClient.archived===true;
        msg.innerHTML='<strong>Atenção:</strong> este CNPJ já está cadastrado para <strong>'+escHtml(duplicateClient.legal_name)+'</strong>.'+(archived?' O cadastro está arquivado; solicite restauração em vez de criar uma nova empresa.':'');
        msg.className='auth-message error span-2';
        saveBtn.disabled=true;
        return true;
      }
      if(msg.textContent?.includes('CNPJ já está cadastrado')||msg.textContent?.includes('este CNPJ já está cadastrado')){
        msg.textContent='';
        msg.className='auth-message hidden span-2';
      }
      saveBtn.disabled=false;
      return false;
    }

    const cnpjInput=document.getElementById('client-tax-id');
    const cnpjMsg=document.getElementById('client-cnpj-message');
    const showNoCnpjState=()=>{
      const d=digits(cnpjInput?.value||'');
      if(d.length===0 && cnpjMsg){
        cnpjMsg.textContent='Empresa em constituição: o cadastro pode ser salvo sem CNPJ e atualizado posteriormente.';
        cnpjMsg.className='auth-message info span-2';
      }
    };
    cnpjInput?.addEventListener('input',async ()=>{
      const d=digits(cnpjInput.value);
      cnpjInput.value=d.length===14?formatCnpj(d):d;
      if(d.length===14){
        const duplicated=await checkDuplicateCnpj();
        if(!duplicated && !id) lookupCompanyCnpj();
      }else{
        duplicateClient=null;
        const saveBtn=document.getElementById('client-save-btn');
        if(saveBtn)saveBtn.disabled=false;
        if(d.length===0)showNoCnpjState();
        else if(cnpjMsg){
          cnpjMsg.textContent='CNPJ incompleto. Complete os 14 dígitos ou deixe o campo vazio para empresa em constituição.';
          cnpjMsg.className='auth-message info span-2';
        }
      }
    });
    cnpjInput?.addEventListener('blur',async ()=>{
      const d=digits(cnpjInput?.value||'');
      if(d.length===14) await checkDuplicateCnpj();
      else if(d.length===0) showNoCnpjState();
    });
    if(!id && !digits(cnpjInput?.value||''))showNoCnpjState();
    document.getElementById('client-cnpj-consult')?.addEventListener('click',async ()=>{
      const duplicated=await checkDuplicateCnpj();
      if(!duplicated)lookupCompanyCnpj();
    });

    document.getElementById('client-group-create')?.addEventListener('click',async ()=>{
      const input=document.getElementById('client-new-group-name');
      const select=document.getElementById('client-group-id');
      const msg=document.getElementById('client-group-message');
      const btn=document.getElementById('client-group-create');
      const name=input?.value.trim()||'';
      if(!name){
        msg.textContent='Informe o nome do grupo.';
        msg.className='auth-message error span-2';
        return;
      }
      btn.disabled=true;btn.textContent='Criando...';
      msg.className='auth-message hidden span-2';
      try{
        const {data:existing}=await db.from('client_groups')
          .select('id,name')
          .eq('organization_id',atlasProfile().organization_id)
          .ilike('name',name)
          .limit(1);
        let group=(existing||[])[0]||null;
        if(!group){
          const {data:created,error}=await db.from('client_groups')
            .insert({organization_id:atlasProfile().organization_id,name})
            .select('id,name')
            .single();
          if(error)throw error;
          group=created;
        }
        if(group&&select){
          if(![...select.options].some(o=>o.value===group.id))select.add(new Option(group.name,group.id));
          select.value=group.id;
        }
        if(input)input.value='';
        msg.textContent='Grupo selecionado para esta empresa.';
        msg.className='auth-message success span-2';
      }catch(err){
        msg.textContent=err.message||'Não foi possível criar o grupo.';
        msg.className='auth-message error span-2';
      }finally{
        btn.disabled=false;btn.textContent='＋ Criar grupo';
      }
    });

    const cepInput=document.getElementById('client-postal-code');
    cepInput?.addEventListener('input',()=>{
      const d=digits(cepInput.value).slice(0,8);
      cepInput.value=d.length===8?d.replace(/^(\d{5})(\d{3})$/,'$1-$2'):d;
    });
    cepInput?.addEventListener('blur',()=>{
      if(digits(cepInput.value).length===8 && !document.getElementById('client-street')?.value)lookupCompanyCep();
    });
    document.getElementById('client-cep-consult')?.addEventListener('click',lookupCompanyCep);

    document.getElementById('client-real-form')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=document.getElementById('client-save-btn');
      const msg=document.getElementById('client-form-message');
      btn.disabled=true;btn.textContent='Salvando...';
      msg.className='auth-message hidden span-2';

      const rawCnpj=document.getElementById('client-tax-id').value.trim();
      const cnpjDigits=digits(rawCnpj);
      const normalizedCnpj=cnpjDigits.length===14?formatCnpj(cnpjDigits):null;

      try{
        if(cnpjDigits.length>0 && cnpjDigits.length!==14){
          throw new Error('CNPJ incompleto. Informe os 14 dígitos ou deixe o campo vazio para cadastrar empresa em constituição.');
        }
        if(cnpjDigits.length===14){
          const {data:existing,error:existError}=await db.rpc('atlas_find_client_by_cnpj',{
            p_cnpj:cnpjDigits,
            p_exclude_id:id||null
          });
          if(existError)throw existError;
          const duplicate=(existing||[])[0];
          if(duplicate){
            throw new Error('Cadastro bloqueado: este CNPJ já está cadastrado para '+duplicate.legal_name+(duplicate.archived?' (empresa arquivada).':' .'));
          }
        }

        const payload={
          organization_id:atlasProfile().organization_id,
          legal_name:document.getElementById('client-legal-name').value.trim(),
          trade_name:document.getElementById('client-trade-name').value.trim()||null,
          tax_id:normalizedCnpj,
          state_registration:document.getElementById('client-state-registration').value.trim()||null,
          municipal_registration:document.getElementById('client-municipal-registration').value.trim()||null,
          contact_name:document.getElementById('client-contact').value.trim()||null,
          email:document.getElementById('client-email').value.trim()||null,
          phone:document.getElementById('client-phone').value.trim()||null,
          postal_code:digits(document.getElementById('client-postal-code').value).slice(0,8)||null,
          street:document.getElementById('client-street').value.trim()||null,
          address_number:document.getElementById('client-address-number').value.trim()||null,
          address_complement:document.getElementById('client-address-complement').value.trim()||null,
          neighborhood:document.getElementById('client-neighborhood').value.trim()||null,
          city:document.getElementById('client-city').value.trim()||null,
          state:document.getElementById('client-state').value.trim().toUpperCase()||null,
          country:document.getElementById('client-country').value.trim()||'Brasil',
          address_reference:document.getElementById('client-address-reference').value.trim()||null
        };
        if(canViewGroups){
          payload.group_id=document.getElementById('client-group-id')?.value||null;
        }

        let savedClientId=id||null;
        if(id){
          const {error}=await db.from('clients').update(payload).eq('id',id);
          if(error)throw error;
        }else{
          const {data:created,error}=await db.from('clients').insert(payload).select('id').single();
          if(error)throw error;
          savedClientId=created?.id||null;
        }

        window.atlasLastSavedClientId=savedClientId;
        if(savedClientId){
          window.dispatchEvent(new CustomEvent('atlas:client-saved',{detail:{clientId:savedClientId,taxId:normalizedCnpj,legalName:payload.legal_name}}));
        }
        closeAtlasModal();
        await clientPage();
        window.atlasRealtime?.refreshCompanies?.();
      }catch(err){
        const raw=String(err?.message||err||'');
        msg.textContent=/row-level security|permission denied/i.test(raw)
          ? 'Não foi possível salvar por falta de permissão ou sessão expirada. Atualize a página e entre novamente no ATLAS.'
          : (raw||'Não foi possível salvar a empresa.');
        msg.className='auth-message error span-2';
        btn.disabled=false;btn.textContent='Salvar empresa';
      }
    });
  };

  window.clientPage = async function(){
    setHead('Empresas e clientes','CADASTRO','Cadastre e mantenha as empresas vinculadas aos processos.');
    page('<div class="loading-box"><span class="spinner"></span><div>Carregando empresas...</div></div>');
    const db=atlasDb();
    const {data,error}=await db.from('clients').select('*').order('legal_name',{ascending:true});
    if(error){page('<div class="error-box">Não foi possível carregar as empresas: '+escHtml(error.message)+'</div>');return}
    const list=data||[];
    const toolbar=canEditOps()?'<button class="btn btn-primary" onclick="openClientModal()">＋ Nova empresa</button>':'';
    page(`<section class="surface pad">
      <div class="section-head"><div><h2>Empresas cadastradas</h2><span>${list.length} registro(s)</span></div>${toolbar}</div>
      ${list.length?`<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>CNPJ</th><th>IE</th><th>IM</th><th>Cidade/UF</th><th>Contato</th>${canEditOps()?'<th>Ações</th>':''}</tr></thead><tbody>
      ${list.map(c=>`<tr>
        <td><strong>${escHtml(c.legal_name)}</strong><div class="muted">${escHtml(c.trade_name||'')}</div><div class="muted company-address-inline">${escHtml([c.street,c.address_number,c.address_complement,c.neighborhood,[c.city,c.state].filter(Boolean).join('/'),c.postal_code?String(c.postal_code).replace(/^(\d{5})(\d{3})$/,'$1-$2'):null].filter(Boolean).join(' · ')||'')}</div></td>
        <td>${escHtml(c.tax_id||'—')}</td>
        <td>${escHtml(c.state_registration||'—')}</td>
        <td>${escHtml(c.municipal_registration||'—')}</td>
        <td>${escHtml([c.city,c.state].filter(Boolean).join('/')||'—')}</td>
        <td>${escHtml(c.contact_name||c.email||'—')}</td>
        ${canEditOps()?`<td><div class="row-actions"><button class="mini-btn" onclick="openClientModal('${c.id}')">Editar</button><button class="mini-btn danger" onclick="deleteClient('${c.id}')">Excluir</button></div></td>`:''}
      </tr>`).join('')}</tbody></table></div>`
      :emptyState('Nenhuma empresa cadastrada','Cadastre a primeira empresa para iniciar um processo.',canEditOps()?'<button class="btn btn-primary" onclick="openClientModal()">＋ Cadastrar empresa</button>':'')}
    </section>`);
  };
})();