(() => {
  const ROLE_LABELS = {
    operacao:'Operação',
    financeiro:'Financeiro',
    auditoria:'Auditoria',
    cliente:'Cliente'
  };

  const MODULES = [
    {name:'Dashboard', rows:[['dashboard.view','Acessar']]},
    {name:'Processos', rows:[['processes.view','Visualizar'],['processes.create','Criar'],['processes.edit','Editar'],['processes.archive','Arquivar']]},
    {name:'Empresas', rows:[['companies.view','Visualizar'],['companies.groups.view','Visualizar grupos empresariais'],['companies.create','Criar'],['companies.edit','Editar'],['companies.archive','Arquivar']]},
    {name:'Documentos', rows:[['documents.view','Visualizar'],['documents.upload','Anexar'],['documents.delete','Excluir']]},
    {name:'Custos', rows:[['costs.view','Visualizar'],['costs.edit','Editar financeiro / registrar pagamentos']]},
    {name:'Licenças', rows:[['licenses.view','Visualizar'],['licenses.edit','Editar']]},
    {name:'Integrações', rows:[['integrations.view','Visualizar']]},
    {name:'Relatórios', rows:[['reports.view','Visualizar']]},
    {name:'Usuários', rows:[['users.view','Visualizar'],['users.manage','Administrar']]}
  ];

  const PAGE_PERMISSIONS = {
    dashboard:'dashboard.view',
    processos:'processes.view',
    clientes:'companies.view',
    documentos:'documents.view',
    custos:'costs.view',
    licencas:'licenses.view',
    integracoes:'integrations.view',
    relatorios:'reports.view',
    usuarios:'users.view'
  };

  let currentPermissions = new Set();
  let permissionChannel = null;
  let loadedRole = null;

  function currentRole(){
    return window.atlasAuth?.getProfile?.()?.role || window.atlasCurrentProfile?.role || 'cliente';
  }

  window.atlasHasPermission = function(key){
    return currentRole()==='admin' || currentPermissions.has(key);
  };

  async function loadCurrentPermissions(){
    const db=window.atlasAuth?.client;
    const profile=window.atlasAuth?.getProfile?.();
    if(!db||!profile)return;
    loadedRole=profile.role;
    if(profile.role==='admin'){
      currentPermissions=new Set(MODULES.flatMap(m=>m.rows.map(r=>r[0])));
      applyPermissionsToUi();
      return;
    }
    const {data,error}=await db.from('role_permissions')
      .select('permission_key,enabled')
      .eq('organization_id',profile.organization_id)
      .eq('role',profile.role);
    if(error){
      console.error('Falha ao carregar permissões',error);
      return;
    }
    currentPermissions=new Set((data||[]).filter(x=>x.enabled).map(x=>x.permission_key));
    applyPermissionsToUi();
    startPermissionRealtime();
  }

  function pageName(){
    return document.querySelector('#nav [data-page].active')?.dataset?.page || 'dashboard';
  }

  function applyNavigation(){
    const role=currentRole();
    document.querySelectorAll('#nav [data-page]').forEach(el=>{
      const p=el.dataset.page;
      if(p==='config'){
        el.classList.toggle('hidden',role!=='admin');
        return;
      }
      const key=PAGE_PERMISSIONS[p];
      if(!key)return;
      el.classList.toggle('hidden',!window.atlasHasPermission(key));
    });

    const active=document.querySelector('#nav [data-page].active');
    if(active?.classList.contains('hidden')){
      active.classList.remove('active');
      const first=[...document.querySelectorAll('#nav [data-page]')].find(x=>!x.classList.contains('hidden'));
      if(first){
        first.classList.add('active');
        if(typeof window.render==='function')window.render(first.dataset.page);
      }
    }
  }

  function toggleByOnclick(selector,permission){
    document.querySelectorAll(selector).forEach(el=>el.classList.toggle('hidden',!window.atlasHasPermission(permission)));
  }

  function applyActionPermissions(){
    const p=pageName();
    const newProcess=document.getElementById('new-process-btn');
    if(newProcess)newProcess.classList.toggle('hidden',!window.atlasHasPermission('processes.create'));

    if(p==='processos'){
      document.querySelectorAll('[onclick^="openProcessModal"]').forEach(el=>{
        const click=el.getAttribute('onclick')||'';
        const isCreate=/openProcessModal\(\s*\)/.test(click);
        el.classList.toggle('hidden',!window.atlasHasPermission(isCreate?'processes.create':'processes.edit'));
      });
      toggleByOnclick('[onclick^="advanceProcess"]','processes.edit');
      toggleByOnclick('[onclick^="deleteProcess"]','processes.archive');
    }

    if(p==='clientes'){
      document.querySelectorAll('[onclick^="openClientModal"]').forEach(el=>{
        const click=el.getAttribute('onclick')||'';
        const isCreate=/openClientModal\(\s*\)/.test(click);
        el.classList.toggle('hidden',!window.atlasHasPermission(isCreate?'companies.create':'companies.edit'));
      });
      toggleByOnclick('[onclick^="archiveClient"]','companies.archive');
      toggleByOnclick('[onclick^="restoreClient"]','companies.archive');
    }

    if(p==='documentos'){
      toggleByOnclick('[onclick^="openDocumentModal"]','documents.upload');
      toggleByOnclick('[onclick^="deleteStoredDocument"]','documents.delete');
      toggleByOnclick('[onclick^="deleteProcessDocument"]','documents.delete');
    }

    if(p==='custos'){
      toggleByOnclick('[onclick^="setHonorarioRecebido"]','costs.edit');
      toggleByOnclick('[onclick^="setTaxaPaga"]','costs.edit');
      document.querySelectorAll('[onclick^="openProcessModal"]').forEach(el=>{
        el.classList.toggle('hidden',!(window.atlasHasPermission('costs.edit')&&window.atlasHasPermission('processes.edit')));
      });
    }

    if(p==='licencas'){
      toggleByOnclick('[onclick^="openCompanyLicenses"]','licenses.edit');
    }

    if(p==='usuarios'){
      const canManage=window.atlasHasPermission('users.manage');
      const createForm=document.getElementById('user-create-form');
      if(createForm)createForm.classList.toggle('hidden',!canManage);
      document.querySelectorAll('[data-user-action]').forEach(el=>el.classList.toggle('hidden',!canManage));
    }
  }

  function applyPermissionsToUi(){
    applyNavigation();
    applyActionPermissions();
  }

  async function startPermissionRealtime(){
    const db=window.atlasAuth?.client;
    const profile=window.atlasAuth?.getProfile?.();
    if(!db||!profile||profile.role==='admin')return;
    if(permissionChannel){
      try{await db.removeChannel(permissionChannel)}catch{}
    }
    permissionChannel=db.channel('atlas-role-permissions-'+profile.role)
      .on('postgres_changes',{
        event:'*',
        schema:'public',
        table:'role_permissions',
        filter:'role=eq.'+profile.role
      },()=>loadCurrentPermissions())
      .subscribe();
  }

  async function savePermissionMatrix(){
    const db=window.atlasAuth?.client;
    const profile=window.atlasAuth?.getProfile?.();
    if(!db||profile?.role!=='admin')return;

    const btn=document.getElementById('permissions-save-btn');
    const msg=document.getElementById('permissions-message');
    btn.disabled=true;
    btn.textContent='Salvando...';
    msg.className='auth-message hidden';

    const rows=[];
    document.querySelectorAll('[data-permission-checkbox]').forEach(cb=>{
      rows.push({
        organization_id:profile.organization_id,
        role:cb.dataset.role,
        permission_key:cb.dataset.permission,
        enabled:cb.checked,
        updated_at:new Date().toISOString(),
        updated_by:profile.id
      });
    });

    const {error}=await db.from('role_permissions').upsert(rows,{onConflict:'organization_id,role,permission_key'});
    if(error){
      msg.textContent='Não foi possível salvar as permissões: '+error.message;
      msg.className='auth-message error';
      btn.disabled=false;
      btn.textContent='Salvar permissões';
      return;
    }

    msg.textContent='Permissões atualizadas com sucesso.';
    msg.className='auth-message success';
    btn.disabled=false;
    btn.textContent='Salvar permissões';
  }

  async function renderPermissionConfig(){
    const db=window.atlasAuth?.client;
    const profile=window.atlasAuth?.getProfile?.();
    if(!db||profile?.role!=='admin'){
      page('<div class="error-box">Somente o Administrador pode alterar permissões.</div>');
      return;
    }

    const {data,error}=await db.from('role_permissions')
      .select('role,permission_key,enabled')
      .eq('organization_id',profile.organization_id)
      .order('role');

    if(error){
      page('<div class="error-box">Não foi possível carregar as permissões: '+String(error.message||error)+'</div>');
      return;
    }

    const map=new Map((data||[]).map(x=>[x.role+'|'+x.permission_key,x.enabled]));
    const roles=Object.keys(ROLE_LABELS);

    const rows=MODULES.map(module=>{
      const inner=module.rows.map(([key,label])=>`<tr>
        <td class="permission-action">${label}</td>
        ${roles.map(role=>`<td class="permission-check"><label class="permission-switch"><input type="checkbox" data-permission-checkbox data-role="${role}" data-permission="${key}" ${map.get(role+'|'+key)?'checked':''}><span></span></label></td>`).join('')}
      </tr>`).join('');
      return `<tr class="permission-module-row"><th>${module.name}</th><th colspan="${roles.length}"></th></tr>${inner}`;
    }).join('');

    setHead('Configurações','SISTEMA','Defina o que cada perfil pode visualizar e executar no ATLAS.');
    page(`
      <section class="surface pad">
        <div class="section-head">
          <div><h2>Permissões por perfil</h2><span>As alterações são aplicadas aos usuários vinculados a cada perfil.</span></div>
          <button id="permissions-save-btn" class="btn btn-primary">Salvar permissões</button>
        </div>
        <div class="permission-admin-note"><strong>Administrador</strong><span>Acesso total protegido. O perfil Administrador não pode perder permissões por esta tela.</span></div>
        <div class="table-wrap permission-table-wrap">
          <table class="permission-table">
            <thead><tr><th>Função</th>${roles.map(r=>`<th>${ROLE_LABELS[r]}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div id="permissions-message" class="auth-message hidden"></div>
      </section>
      <section class="surface pad" style="margin-top:14px">
        <div class="section-head"><h2>Ambiente</h2><span>Produção</span></div>
        <div class="data-list">
          <div class="data-row"><span>Modo</span><strong>Sistema autenticado</strong></div>
          <div class="data-row"><span>Supabase</span><strong>Ativo · Auth, banco, RLS, permissões e Edge Functions</strong></div>
          <div class="data-row"><span>Documentos</span><strong>Ativo · Storage privado</strong></div>
          <div class="data-row"><span>Comunicações</span><strong>E-mail ainda não configurado</strong></div>
        </div>
      </section>`);

    document.getElementById('permissions-save-btn')?.addEventListener('click',savePermissionMatrix);
  }

  window.configPage=renderPermissionConfig;

  const previousShow=window.showApp;
  if(typeof previousShow==='function'){
    window.showApp=function(profile){
      const result=previousShow(profile);
      setTimeout(loadCurrentPermissions,0);
      return result;
    };
  }

  const observer=new MutationObserver(()=>applyActionPermissions());
  const startObserver=()=>{
    const target=document.getElementById('page-content');
    if(target)observer.observe(target,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver);
  else startObserver();

  window.atlasPermissions={
    reload:loadCurrentPermissions,
    has:window.atlasHasPermission,
    apply:applyPermissionsToUi
  };
})();