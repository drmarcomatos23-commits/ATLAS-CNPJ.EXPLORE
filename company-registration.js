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
  function companyFromPayload(d){
    const e=d?.estabelecimento||{};
    const city=typeof e.cidade==='object'?e.cidade?.nome:e.cidade;
    const state=typeof e.estado==='object'?e.estado?.sigla:e.estado;
    return {
      legal_name:d?.razao_social||'',
      trade_name:e?.nome_fantasia||'',
      tax_id:formatCnpj(e?.cnpj||d?.cnpj||''),
      state_registration:activeStateRegistration(d),
      city:city||'',
      state:state||'',
      phone:[e?.ddd1,e?.telefone1].filter(Boolean).join(' ')||'',
      email:e?.email||''
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
      document.getElementById('client-city').value=company.city;
      document.getElementById('client-state').value=company.state;
      if(company.phone && !document.getElementById('client-phone').value)document.getElementById('client-phone').value=company.phone;
      if(company.email && !document.getElementById('client-email').value)document.getElementById('client-email').value=company.email;
      msg.textContent=company.state_registration
        ? 'Dados cadastrais e Inscrição Estadual carregados. Revise antes de salvar.'
        : 'Dados cadastrais carregados. A Inscrição Estadual não foi encontrada na fonte consultada.';
      msg.className='auth-message success span-2';
    }catch(err){
      msg.textContent=err.message||'Falha na consulta do CNPJ.';
      msg.className='auth-message error span-2';
    }finally{
      btn.disabled=false;btn.textContent='Consultar CNPJ';
    }
  }

  window.openClientModal = async function(id=''){
    const db=atlasDb();
    let record=null;
    if(id){
      const {data,error}=await db.from('clients').select('*').eq('id',id).single();
      if(error)return alert('Não foi possível carregar a empresa: '+error.message);
      record=data;
    }

    modalShell(id?'Editar empresa':'Nova empresa',`<form id="client-real-form" class="modal-form-grid">
      <div class="field span-2">
        <label>CNPJ</label>
        <div class="company-cnpj-row">
          <input id="client-tax-id" inputmode="numeric" placeholder="00.000.000/0000-00" value="${escHtml(record?.tax_id||'')}">
          <button id="client-cnpj-consult" class="btn btn-muted" type="button">Consultar CNPJ</button>
        </div>
      </div>
      <div id="client-cnpj-message" class="auth-message hidden span-2"></div>

      <div class="field span-2"><label>Razão social *</label><input id="client-legal-name" required value="${escHtml(record?.legal_name||'')}"></div>
      <div class="field"><label>Nome fantasia</label><input id="client-trade-name" value="${escHtml(record?.trade_name||'')}"></div>
      <div class="field"><label>Inscrição Estadual</label><input id="client-state-registration" value="${escHtml(record?.state_registration||'')}" placeholder="IE"></div>
      <div class="field"><label>Inscrição Municipal</label><input id="client-municipal-registration" value="${escHtml(record?.municipal_registration||'')}" placeholder="IM"></div>
      <div class="field"><label>Contato</label><input id="client-contact" value="${escHtml(record?.contact_name||'')}"></div>
      <div class="field"><label>E-mail</label><input id="client-email" type="email" value="${escHtml(record?.email||'')}"></div>
      <div class="field"><label>Telefone</label><input id="client-phone" value="${escHtml(record?.phone||'')}"></div>
      <div class="field"><label>Cidade</label><input id="client-city" value="${escHtml(record?.city||'')}"></div>
      <div class="field"><label>UF</label><input id="client-state" maxlength="2" value="${escHtml(record?.state||'')}"></div>

      <div class="modal-actions span-2">
        <button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button>
        <button id="client-save-btn" class="btn btn-primary" type="submit">Salvar empresa</button>
      </div>
      <div id="client-form-message" class="auth-message hidden span-2"></div>
    </form>`,true);

    const cnpjInput=document.getElementById('client-tax-id');
    cnpjInput?.addEventListener('input',()=>{
      const d=digits(cnpjInput.value);
      cnpjInput.value=d.length===14?formatCnpj(d):d;
      if(d.length===14 && !id) lookupCompanyCnpj();
    });
    document.getElementById('client-cnpj-consult')?.addEventListener('click',lookupCompanyCnpj);

    document.getElementById('client-real-form')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=document.getElementById('client-save-btn');
      const msg=document.getElementById('client-form-message');
      btn.disabled=true;btn.textContent='Salvando...';
      msg.className='auth-message hidden span-2';

      const rawCnpj=document.getElementById('client-tax-id').value.trim();
      const cnpjDigits=digits(rawCnpj);
      const normalizedCnpj=cnpjDigits.length===14?formatCnpj(cnpjDigits):(rawCnpj||null);

      try{
        if(cnpjDigits.length===14){
          const {data:existing,error:existError}=await db.from('clients')
            .select('id,legal_name,tax_id')
            .eq('organization_id',atlasProfile().organization_id);
          if(existError)throw existError;
          const duplicate=(existing||[]).find(c=>c.id!==id && digits(c.tax_id)===cnpjDigits);
          if(duplicate)throw new Error('Este CNPJ já está cadastrado para '+duplicate.legal_name+'.');
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
          city:document.getElementById('client-city').value.trim()||null,
          state:document.getElementById('client-state').value.trim().toUpperCase()||null
        };

        const q=id
          ? db.from('clients').update(payload).eq('id',id)
          : db.from('clients').insert(payload);
        const {error}=await q;
        if(error)throw error;

        closeAtlasModal();
        await clientPage();
      }catch(err){
        msg.textContent=err.message||'Não foi possível salvar a empresa.';
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
        <td><strong>${escHtml(c.legal_name)}</strong><div class="muted">${escHtml(c.trade_name||'')}</div></td>
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