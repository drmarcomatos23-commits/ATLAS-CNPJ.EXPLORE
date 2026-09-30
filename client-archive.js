(() => {
  function escA(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

  window.clientPage=async function(){
    setHead('Empresas e clientes','CADASTRO','Cadastre e mantenha as empresas vinculadas aos processos.');
    page('<div class="loading-box"><span class="spinner"></span><div>Carregando empresas...</div></div>');
    const db=atlasDb();

    const [clientsRes,processesRes]=await Promise.all([
      db.from('clients')
        .select('*')
        .is('deleted_at',null)
        .order('legal_name',{ascending:true}),
      db.from('processes')
        .select('id,client_id,status')
        .is('deleted_at',null)
    ]);

    if(clientsRes.error){
      page('<div class="error-box">Não foi possível carregar as empresas: '+escA(clientsRes.error.message)+'</div>');
      return;
    }

    const list=clientsRes.data||[];
    const processCounts=new Map();
    (processesRes.data||[]).forEach(p=>{
      const current=processCounts.get(p.client_id)||{total:0,active:0};
      current.total+=1;
      if(!['completed','cancelled'].includes(p.status))current.active+=1;
      processCounts.set(p.client_id,current);
    });
    const role=atlasProfile().role;
    const toolbar=canEditOps()?'<button class="btn btn-primary" onclick="openClientModal()">＋ Nova empresa</button>':'';

    page(`<section class="surface pad">
      <div class="section-head"><div><h2>Empresas cadastradas</h2><span>${list.length} registro(s)</span></div>${toolbar}</div>
      ${list.length?`<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Processos</th><th>CNPJ</th><th>IE</th><th>IM</th><th>Cidade/UF</th><th>Contato</th>${canEditOps()?'<th>Ações</th>':''}</tr></thead><tbody>
      ${list.map(c=>`<tr>
        <td>
          <strong>${escA(c.legal_name)}</strong>
          <div class="muted">${escA(c.trade_name||'')}</div>
          <div class="muted company-address-inline">${escA([c.street,c.address_number,c.address_complement,c.neighborhood,[c.city,c.state].filter(Boolean).join('/'),c.postal_code?String(c.postal_code).replace(/^(\d{5})(\d{3})$/,'$1-$2'):null].filter(Boolean).join(' · ')||'')}</div>
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
      </tr>`).join('')}</tbody></table></div>`
      :emptyState('Nenhuma empresa cadastrada','Cadastre a primeira empresa para iniciar um processo.',canEditOps()?'<button class="btn btn-primary" onclick="openClientModal()">＋ Cadastrar empresa</button>':'')}
    </section>`);

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
              ${archived.map(c=>`<tr>
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