(() => {
  function escA(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function sortCompaniesAlpha(list){
    return [...(list||[])].sort((a,b)=>String(a?.legal_name||'').localeCompare(String(b?.legal_name||''),'pt-BR',{sensitivity:'base',numeric:true}));
  }
  function sortGroupsAlpha(list){
    return [...(list||[])].sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'pt-BR',{sensitivity:'base',numeric:true}));
  }

  window.archiveClient=async function(id){
    if(!confirm('Arquivar esta empresa? Ela sairá das telas operacionais, mas todos os dados e vínculos serão preservados e poderão ser restaurados.')) return;
    const db=atlasDb();
    const {error}=await db.rpc('atlas_archive_client',{p_client_id:id});
    if(error) return alert('Não foi possível arquivar: '+error.message);
    await window.clientPage();
    window.atlasRealtime?.refreshCompanies?.();
  };

  window.restoreClient=async function(id){
    if(!confirm('Restaurar esta empresa para as telas operacionais?')) return;
    const db=atlasDb();
    const {error}=await db.rpc('atlas_restore_client',{p_client_id:id});
    if(error) return alert('Não foi possível restaurar: '+error.message);
    await window.clientPage();
    window.atlasRealtime?.refreshCompanies?.();
  };

  window.deleteClient=window.archiveClient;

  function companyTable(list,processCounts,role){
    const ordered=sortCompaniesAlpha(list);
    if(!ordered.length)return '';
    return `<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Processos</th><th>CNPJ</th><th>IE</th><th>IM</th><th>Cidade/UF</th><th>Contato</th>${canEditOps()?'<th>Ações</th>':''}</tr></thead><tbody>
      ${ordered.map(c=>`<tr>
        <td>
          <strong>${escA(c.legal_name)}</strong>
          <div class="muted">${escA(c.trade_name||'')}</div>
          <div class="muted company-address-inline">${escA([c.street,c.address_number,c.address_complement,c.neighborhood,[c.city,c.state].filter(Boolean).join('/'),c.postal_code?String(c.postal_code).replace(/^(\\d{5})(\\d{3})$/,'$1-$2'):null].filter(Boolean).join(' · ')||'')}</div>
        </td>
        <td>
          ${(()=>{const pc=processCounts.get(c.id)||{total:0,active:0};return `<div class="company-process-count"><strong>${pc.total} ${pc.total===1?'processo':'processos'}</strong><span>${pc.active} ${pc.active===1?'ativo':'ativos'}</span></div>`})()}
        </td>
        <td>${escA(c.tax_id||'—')}</td>
        <td>${escA(c.state_registration||'—')}</td>
        <td>${escA(c.municipal_registration||'—')}</td>
        <td>${escA([c.city,c.state].filter(Boolean).join('/')||'—')}</td>
        <td>${escA(c.contact_name||c.email||'—')}</td>
        ${canEditOps()?`<td><div class="row-actions"><button class="mini-btn" onclick="openClientModal('${c.id}')">Editar</button>${role==='admin'?`<button class="mini-btn danger" onclick="archiveClient('${c.id}')">Arquivar</button>`:''}</div></td>`:''}
      </tr>`).join('')}
    </tbody></table></div>`;
  }

  function groupBlock(group,clients,processCounts,role){
    const ordered=sortCompaniesAlpha(clients);
    return `
      <section class="company-group-block">
        <div class="company-group-head">
          <div>
            <span class="company-group-kicker">GRUPO EMPRESARIAL</span>
            <h3>${escA(group.name)}</h3>
          </div>
          <div class="company-group-count">${ordered.length} ${ordered.length===1?'empresa':'empresas'}</div>
        </div>
        ${companyTable(ordered,processCounts,role)}
      </section>`;
  }

  function ungroupedBlock(clients,processCounts,role){
    const ordered=sortCompaniesAlpha(clients);
    return `
      <section class="company-group-block company-group-ungrouped">
        <div class="company-group-head">
          <div>
            <span class="company-group-kicker">SEM GRUPO</span>
            <h3>Empresas não categorizadas</h3>
          </div>
          <div class="company-group-count">${ordered.length} ${ordered.length===1?'empresa':'empresas'}</div>
        </div>
        ${companyTable(ordered,processCounts,role)}
      </section>`;
  }

  function printGroupsReport(groups,list,processCounts){
    const popup=window.open('','_blank');
    if(!popup){
      alert('Permita pop-ups para imprimir o relatório.');
      return;
    }

    const gm=new Map(groups.map(g=>[g.id,g]));
    const grouped=new Map(groups.map(g=>[g.id,[]]));
    const ungrouped=[];
    sortCompaniesAlpha(list).forEach(c=>{
      if(c.group_id&&grouped.has(c.group_id))grouped.get(c.group_id).push(c);
      else ungrouped.push(c);
    });

    const reportGroups=sortGroupsAlpha(groups)
      .filter(g=>(grouped.get(g.id)||[]).length)
      .map(g=>{
        const companies=sortCompaniesAlpha(grouped.get(g.id)||[]);
        const totalProcesses=companies.reduce((sum,c)=>sum+(processCounts.get(c.id)?.total||0),0);
        const activeProcesses=companies.reduce((sum,c)=>sum+(processCounts.get(c.id)?.active||0),0);
        return `
          <section class="report-group">
            <div class="group-head">
              <div><span>GRUPO EMPRESARIAL</span><h2>${escA(g.name)}</h2></div>
              <div class="group-metrics"><b>${companies.length}</b> empresa(s) · <b>${totalProcesses}</b> processo(s) · <b>${activeProcesses}</b> ativo(s)</div>
            </div>
            <table>
              <thead><tr><th>Empresa</th><th>CNPJ</th><th>Cidade/UF</th><th>Processos</th><th>Ativos</th></tr></thead>
              <tbody>${companies.map(c=>{
                const pc=processCounts.get(c.id)||{total:0,active:0};
                return `<tr><td><strong>${escA(c.legal_name)}</strong>${c.trade_name?`<br><small>${escA(c.trade_name)}</small>`:''}</td><td>${escA(c.tax_id||'—')}</td><td>${escA([c.city,c.state].filter(Boolean).join('/')||'—')}</td><td>${pc.total}</td><td>${pc.active}</td></tr>`;
              }).join('')}</tbody>
            </table>
          </section>`;
      }).join('');

    const ungroupedReport=ungrouped.length?`
      <section class="report-group ungrouped">
        <div class="group-head">
          <div><span>SEM GRUPO</span><h2>Empresas não categorizadas</h2></div>
          <div class="group-metrics"><b>${ungrouped.length}</b> empresa(s)</div>
        </div>
        <table>
          <thead><tr><th>Empresa</th><th>CNPJ</th><th>Cidade/UF</th><th>Processos</th><th>Ativos</th></tr></thead>
          <tbody>${ungrouped.map(c=>{
            const pc=processCounts.get(c.id)||{total:0,active:0};
            return `<tr><td><strong>${escA(c.legal_name)}</strong>${c.trade_name?`<br><small>${escA(c.trade_name)}</small>`:''}</td><td>${escA(c.tax_id||'—')}</td><td>${escA([c.city,c.state].filter(Boolean).join('/')||'—')}</td><td>${pc.total}</td><td>${pc.active}</td></tr>`;
          }).join('')}</tbody>
        </table>
      </section>`:'';

    const logo=window.location.origin+'/logo-atlas-legalizacao.png';
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Grupos Empresariais - ATLAS</title><style>
      @page{size:A4;margin:12mm}
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#10263a;margin:0;font-size:11px}
      .print-actions{position:fixed;right:18px;top:14px;z-index:5}.print-actions button{border:0;border-radius:8px;padding:9px 13px;background:#078f90;color:#fff;font-weight:700;cursor:pointer}
      .report-header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:2px solid #079e9c;padding-bottom:14px;margin-bottom:18px}
      .brand{display:flex;align-items:center;gap:12px}.brand img{width:86px;height:64px;object-fit:contain}.brand h1{font-size:20px;margin:0 0 4px}.brand p{margin:0;color:#62798c}
      .report-meta{text-align:right;color:#62798c}.report-summary{display:flex;gap:10px;margin:0 0 18px}.report-summary div{border:1px solid #d9e3ea;border-radius:8px;padding:9px 11px}.report-summary b{font-size:15px}
      .report-group{margin:0 0 18px;break-inside:avoid}.group-head{display:flex;justify-content:space-between;align-items:end;gap:14px;background:#f3f9fa;border:1px solid #d7e7e9;border-bottom:0;padding:10px 12px;border-radius:10px 10px 0 0}.group-head span{font-size:8px;font-weight:800;letter-spacing:.08em;color:#078987}.group-head h2{margin:3px 0 0;font-size:15px}.group-metrics{font-size:9px;color:#607589;white-space:nowrap}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #d9e3ea;padding:7px;text-align:left;vertical-align:top}th{background:#f7fafc;font-size:9px;text-transform:uppercase;color:#607589}small{color:#6b7d8e}
      .footer{border-top:1px solid #d9e3ea;margin-top:22px;padding-top:9px;color:#718394;font-size:9px}
      @media print{.print-actions{display:none}.report-group{break-inside:avoid}}
    </style></head><body>
      <div class="print-actions"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
      <header class="report-header">
        <div class="brand"><img src="${logo}" alt="ATLAS"><div><h1>Relatório de Grupos Empresariais</h1><p>ATLAS Legalização e Gerenciamento</p></div></div>
        <div class="report-meta">Emitido em<br><strong>${new Date().toLocaleString('pt-BR')}</strong></div>
      </header>
      <div class="report-summary"><div><span>Grupos</span><br><b>${groups.filter(g=>(grouped.get(g.id)||[]).length).length}</b></div><div><span>Empresas</span><br><b>${list.length}</b></div></div>
      ${reportGroups}
      ${ungroupedReport}
      <div class="footer">ATLAS Legalização e Gerenciamento · Relatório de grupos empresariais</div>
    </body></html>`);
    popup.document.close();
  }

  window.clientPage=async function(){
    setHead('Empresas e clientes','CADASTRO','Cadastre empresas e utilize o filtro por grupo quando precisar visualizar uma estrutura empresarial.');
    page('<div class="loading-box"><span class="spinner"></span><div>Carregando empresas...</div></div>');
    const db=atlasDb();

    const [clientsRes,processesRes,groupsRes]=await Promise.all([
      db.from('clients')
        .select('*')
        .is('deleted_at',null)
        .order('legal_name',{ascending:true}),
      db.from('processes')
        .select('id,client_id,status')
        .is('deleted_at',null),
      db.from('client_groups')
        .select('id,name,description')
        .order('name',{ascending:true})
    ]);

    if(clientsRes.error){
      page('<div class="error-box">Não foi possível carregar as empresas: '+escA(clientsRes.error.message)+'</div>');
      return;
    }

    const list=sortCompaniesAlpha(clientsRes.data||[]);
    const groups=sortGroupsAlpha(groupsRes.error?[]:(groupsRes.data||[]));
    const processCounts=new Map();
    (processesRes.data||[]).forEach(p=>{
      const current=processCounts.get(p.client_id)||{total:0,active:0};
      current.total+=1;
      if(!['completed','cancelled'].includes(p.status))current.active+=1;
      processCounts.set(p.client_id,current);
    });

    const role=atlasProfile().role;
    const toolbar=`
      <div class="company-page-actions">
        <button id="company-groups-report-btn" class="btn btn-muted" type="button">Imprimir relatório de grupos</button>
        ${canEditOps()?'<button class="btn btn-primary" onclick="openClientModal()">＋ Nova empresa</button>':''}
      </div>`;

    const groupOptions=groups.map(g=>`<option value="${g.id}">${escA(g.name)}</option>`).join('');

    page(`<section class="surface pad">
      <div class="section-head company-section-head">
        <div><h2>Empresas cadastradas</h2><span>${list.length} empresa(s) · ${groups.length} grupo(s)</span></div>
        ${toolbar}
      </div>
      <div class="company-filter-bar">
        <div class="field company-group-filter-field">
          <label>Filtrar por grupo</label>
          <select id="company-group-filter">
            <option value="__all__">Todas as empresas</option>
            ${groupOptions}
            <option value="__ungrouped__">Sem grupo</option>
          </select>
        </div>
        <div class="company-filter-actions">
          ${role==='admin'?'<button id="company-group-rename-btn" class="btn btn-muted hidden" type="button" disabled>Editar nome do grupo</button>':''}
          <div class="company-filter-note">A visualização por bloco de grupo aparece somente quando um grupo é selecionado.</div>
        </div>
      </div>
      <div id="company-list-view">
        ${list.length
          ? companyTable(list,processCounts,role)
          : emptyState('Nenhuma empresa cadastrada','Cadastre a primeira empresa para iniciar um processo.',canEditOps()?'<button class="btn btn-primary" onclick="openClientModal()">＋ Cadastrar empresa</button>':'')}
      </div>
    </section>`);

    const filter=document.getElementById('company-group-filter');
    const view=document.getElementById('company-list-view');
    const renameBtn=document.getElementById('company-group-rename-btn');

    const syncGroupAdminAction=()=>{
      if(!renameBtn||!filter)return;
      const hasSelectedGroup=groups.some(g=>g.id===filter.value);
      renameBtn.disabled=!hasSelectedGroup;
      renameBtn.classList.toggle('hidden',!hasSelectedGroup);
    };
    syncGroupAdminAction();

    filter?.addEventListener('change',()=>{
      const value=filter.value;
      syncGroupAdminAction();
      if(value==='__all__'){
        view.innerHTML=companyTable(list,processCounts,role);
        return;
      }
      if(value==='__ungrouped__'){
        const rows=list.filter(c=>!c.group_id);
        view.innerHTML=rows.length
          ? ungroupedBlock(rows,processCounts,role)
          : '<div class="empty-state"><div class="empty-icon">↳</div><h3>Nenhuma empresa sem grupo</h3><p>Todas as empresas estão categorizadas.</p></div>';
        return;
      }
      const group=groups.find(g=>g.id===value);
      const rows=list.filter(c=>c.group_id===value);
      view.innerHTML=group&&rows.length
        ? groupBlock(group,rows,processCounts,role)
        : '<div class="empty-state"><div class="empty-icon">↳</div><h3>Nenhuma empresa neste grupo</h3><p>Vincule empresas ao grupo no cadastro ou edição da empresa.</p></div>';
    });

    renameBtn?.addEventListener('click',async ()=>{
      if(role!=='admin'||!filter)return;
      const group=groups.find(g=>g.id===filter.value);
      if(!group)return;
      const nextName=prompt('Novo nome do grupo empresarial:',group.name);
      if(nextName===null)return;
      const normalized=nextName.trim();
      if(!normalized){
        alert('O nome do grupo não pode ficar vazio.');
        return;
      }
      if(normalized===group.name)return;

      renameBtn.disabled=true;
      const originalText=renameBtn.textContent;
      renameBtn.textContent='Salvando...';
      try{
        const {error}=await db
          .from('client_groups')
          .update({name:normalized,updated_at:new Date().toISOString()})
          .eq('id',group.id);
        if(error)throw error;
        group.name=normalized;
        const option=[...filter.options].find(o=>o.value===group.id);
        if(option)option.textContent=normalized;
        filter.value=group.id;
        view.innerHTML=groupBlock(group,list.filter(c=>c.group_id===group.id),processCounts,role);
        alert('Nome do grupo atualizado com sucesso.');
      }catch(err){
        const raw=String(err?.message||err||'');
        alert(/duplicate key|uq_client_groups_org_name/i.test(raw)
          ? 'Já existe um grupo com esse nome.'
          : 'Não foi possível alterar o nome do grupo: '+raw);
      }finally{
        renameBtn.textContent=originalText;
        syncGroupAdminAction();
      }
    });

    document.getElementById('company-groups-report-btn')?.addEventListener('click',()=>{
      printGroupsReport(groups,list,processCounts);
    });

    if(role==='admin'){
      const {data:archived,error:archivedError}=await db.rpc('atlas_list_archived_clients');
      if(!archivedError && archived?.length){
        document.getElementById('page-content')?.insertAdjacentHTML('beforeend',`
          <section class="surface pad" style="margin-top:14px">
            <div class="section-head">
              <div><h2>Empresas arquivadas</h2><span>${archived.length} registro(s) preservado(s)</span></div>
            </div>
            <div class="source-note" style="margin-bottom:12px"><strong>Nenhum dado é apagado.</strong> Processos, documentos, custos, sócios e licenças permanecem preservados.</div>
            <div class="table-wrap"><table><thead><tr><th>Empresa</th><th>CNPJ</th><th>Arquivada em</th><th>Ação</th></tr></thead><tbody>
              ${sortCompaniesAlpha(archived).map(c=>`<tr>
                <td><strong>${escA(c.legal_name)}</strong></td>
                <td>${escA(c.tax_id||'—')}</td>
                <td>${c.deleted_at?new Date(c.deleted_at).toLocaleString('pt-BR'):'—'}</td>
                <td><button class="mini-btn" onclick="restoreClient('${c.id}')">Restaurar</button></td>
              </tr>`).join('')}
            </tbody></table></div>
          </section>`);
      }
    }
  };
})();
