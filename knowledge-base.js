(() => {
  const ROLE_LABELS={admin:'Administrador',operacao:'Operação',financeiro:'Financeiro',auditoria:'Auditoria',cliente:'Cliente',all:'Todos'};
  let kbArticles=[];
  let kbSearch='';
  let kbCategory='Todos';

  function kbe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function nl(v){return kbe(v||'').replace(/\n/g,'<br>')}
  function roleLabel(role){return ROLE_LABELS[role]||role}
  function articleMatches(a){
    const q=kbSearch.trim().toLowerCase();
    const categoryOk=kbCategory==='Todos'||a.category===kbCategory;
    if(!categoryOk)return false;
    if(!q)return true;
    const hay=[a.title,a.summary,a.category,a.system_path,a.instructions,a.attachment_location,a.troubleshooting,...(a.tags||[])].join(' ').toLowerCase();
    return hay.includes(q);
  }
  function categoryIcon(cat){
    const map={Acesso:'↪',Empresas:'▥',Processos:'▤',Documentos:'□',Financeiro:'R$',Licenças:'✓',Relatórios:'▦',Administração:'⚙','Portal do Cliente':'◉',Geral:'?'};
    return map[cat]||'?';
  }

  async function loadArticles(){
    const db=atlasDb();
    const {data,error}=await db.from('knowledge_articles')
      .select('*')
      .order('sort_order',{ascending:true})
      .order('title',{ascending:true});
    if(error)throw error;
    kbArticles=data||[];
  }

  function card(a){
    const tags=(a.tags||[]).slice(0,5).map(x=>`<span>${kbe(x)}</span>`).join('');
    const audience=(a.audience_roles||[]).map(roleLabel).join(', ');
    return `<article class="kb-card" onclick="openKnowledgeArticle('${a.id}')">
      <div class="kb-card-icon">${categoryIcon(a.category)}</div>
      <div class="kb-card-body">
        <div class="kb-card-top"><span class="kb-category">${kbe(a.category)}</span>${a.active===false?'<span class="pill warn">Inativo</span>':''}</div>
        <h3>${kbe(a.title)}</h3>
        <p>${kbe(a.summary||'')}</p>
        <div class="kb-tags">${tags}</div>
        <div class="kb-audience">Para: ${kbe(audience||'Todos')}</div>
      </div>
    </article>`;
  }

  function renderKnowledge(){
    const categories=['Todos',...[...new Set(kbArticles.map(a=>a.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'))];
    const filtered=kbArticles.filter(articleMatches);
    const profile=atlasProfile();
    setHead('Base de Conhecimento','AUTOATENDIMENTO','Encontre orientações rápidas sobre como usar o ATLAS, onde anexar documentos e como resolver dúvidas recorrentes.');

    page(`
      <section class="kb-toolbar">
        <div class="kb-search-wrap">
          <span>⌕</span>
          <input id="kb-search" placeholder="O que você precisa resolver?" value="${kbe(kbSearch)}">
        </div>
        ${profile?.role==='admin'?'<button class="btn btn-primary" id="kb-new-btn">＋ Novo artigo</button>':''}
      </section>
      <div class="kb-categories">
        ${categories.map(c=>`<button class="kb-category-btn ${kbCategory===c?'active':''}" data-kb-category="${kbe(c)}">${kbe(c)}</button>`).join('')}
      </div>
      <section class="kb-grid">
        ${filtered.length?filtered.map(card).join(''):`<div class="surface pad kb-empty"><strong>Nenhum artigo encontrado</strong><span>Tente outro termo ou categoria.</span></div>`}
      </section>
    `);

    document.getElementById('kb-search')?.addEventListener('input',e=>{
      kbSearch=e.target.value;
      renderKnowledge();
      requestAnimationFrame(()=>{const el=document.getElementById('kb-search'); if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}});
    });
    document.querySelectorAll('[data-kb-category]').forEach(btn=>btn.addEventListener('click',()=>{
      kbCategory=btn.dataset.kbCategory;
      renderKnowledge();
    }));
    document.getElementById('kb-new-btn')?.addEventListener('click',()=>openKnowledgeEditor());
  }

  window.knowledgePage=async function(){
    page('<div class="loading-box"><span class="spinner"></span><div>Carregando base de conhecimento...</div></div>');
    try{await loadArticles();renderKnowledge()}
    catch(err){page('<div class="error-box">Não foi possível carregar a base de conhecimento: '+kbe(err.message||err)+'</div>')}
  };

  window.openKnowledgeArticle=function(id){
    const a=kbArticles.find(x=>x.id===id);
    if(!a)return;
    const profile=atlasProfile();
    modalShell(a.title,`
      <article class="kb-article-view">
        <div class="kb-article-meta"><span class="pill ok">${kbe(a.category)}</span><span>Perfil: ${kbe((a.audience_roles||[]).map(roleLabel).join(', ')||'Todos')}</span></div>
        ${a.summary?`<p class="kb-lead">${kbe(a.summary)}</p>`:''}
        ${a.system_path?`<section class="kb-answer-box path"><h3>Onde clicar</h3><p>${kbe(a.system_path)}</p></section>`:''}
        <section class="kb-article-section"><h3>Como fazer</h3><div class="kb-article-text">${nl(a.instructions)}</div></section>
        ${a.attachment_location?`<section class="kb-answer-box attach"><h3>Onde anexar</h3><div>${nl(a.attachment_location)}</div></section>`:''}
        ${a.troubleshooting?`<section class="kb-answer-box trouble"><h3>Como resolver problemas</h3><div>${nl(a.troubleshooting)}</div></section>`:''}
        ${(a.tags||[]).length?`<div class="kb-tags article">${a.tags.map(x=>`<span>${kbe(x)}</span>`).join('')}</div>`:''}
        ${profile?.role==='admin'?`<div class="modal-actions kb-admin-actions"><button class="btn btn-muted" type="button" onclick="openKnowledgeEditor('${a.id}')">Editar artigo</button><button class="btn btn-danger" type="button" onclick="deleteKnowledgeArticle('${a.id}')">Excluir</button></div>`:''}
      </article>
    `,true);
  };

  function roleChecks(selected=[]){
    const roles=['all','operacao','financeiro','auditoria','cliente'];
    return roles.map(r=>`<label class="kb-role-check"><input type="checkbox" value="${r}" ${selected.includes(r)?'checked':''}> <span>${roleLabel(r)}</span></label>`).join('');
  }

  window.openKnowledgeEditor=function(id=''){
    const profile=atlasProfile();
    if(profile?.role!=='admin')return;
    const a=id?kbArticles.find(x=>x.id===id):null;
    modalShell(a?'Editar artigo':'Novo artigo',`
      <form id="kb-editor-form" class="modal-form-grid">
        <div class="field span-2"><label>Título *</label><input id="kb-title" required value="${kbe(a?.title||'')}"></div>
        <div class="field"><label>Categoria *</label><input id="kb-category-field" required value="${kbe(a?.category||'Geral')}"></div>
        <div class="field"><label>Ordem</label><input id="kb-sort" type="number" value="${Number(a?.sort_order||100)}"></div>
        <div class="field span-2"><label>Resumo</label><textarea id="kb-summary" rows="2">${kbe(a?.summary||'')}</textarea></div>
        <div class="field span-2"><label>Caminho no sistema</label><input id="kb-path" value="${kbe(a?.system_path||'')}" placeholder="Ex.: Menu → Processos → Editar processo"></div>
        <div class="field span-2"><label>Como fazer *</label><textarea id="kb-instructions" required rows="8" placeholder="Escreva o passo a passo...">${kbe(a?.instructions||'')}</textarea></div>
        <div class="field span-2"><label>Onde anexar</label><textarea id="kb-attachment" rows="3">${kbe(a?.attachment_location||'')}</textarea></div>
        <div class="field span-2"><label>Como resolver problemas</label><textarea id="kb-troubleshooting" rows="4">${kbe(a?.troubleshooting||'')}</textarea></div>
        <div class="field span-2"><label>Tags (separadas por vírgula)</label><input id="kb-tags" value="${kbe((a?.tags||[]).join(', '))}"></div>
        <div class="field span-2"><label>Disponível para</label><div id="kb-role-checks" class="kb-role-checks">${roleChecks(a?.audience_roles||['all'])}</div></div>
        <div class="field span-2"><label class="kb-active-check"><input id="kb-active" type="checkbox" ${a?.active===false?'':'checked'}> Artigo ativo</label></div>
        <div id="kb-editor-message" class="auth-message hidden span-2"></div>
        <div class="modal-actions span-2"><button class="btn btn-muted" type="button" onclick="closeAtlasModal()">Cancelar</button><button id="kb-save-btn" class="btn btn-primary" type="submit">Salvar artigo</button></div>
      </form>
    `,true);

    document.getElementById('kb-editor-form')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const db=atlasDb();
      const btn=document.getElementById('kb-save-btn');
      const msg=document.getElementById('kb-editor-message');
      const roles=[...document.querySelectorAll('#kb-role-checks input:checked')].map(x=>x.value);
      if(!roles.length){msg.textContent='Selecione ao menos um perfil.';msg.className='auth-message error span-2';return}
      btn.disabled=true;btn.textContent='Salvando...';
      const payload={
        organization_id:profile.organization_id,
        title:document.getElementById('kb-title').value.trim(),
        category:document.getElementById('kb-category-field').value.trim(),
        summary:document.getElementById('kb-summary').value.trim()||null,
        system_path:document.getElementById('kb-path').value.trim()||null,
        instructions:document.getElementById('kb-instructions').value.trim(),
        attachment_location:document.getElementById('kb-attachment').value.trim()||null,
        troubleshooting:document.getElementById('kb-troubleshooting').value.trim()||null,
        tags:document.getElementById('kb-tags').value.split(',').map(x=>x.trim()).filter(Boolean),
        audience_roles:roles,
        active:document.getElementById('kb-active').checked,
        sort_order:Number(document.getElementById('kb-sort').value||100),
        updated_by:profile.id,
        updated_at:new Date().toISOString()
      };
      if(!a)payload.created_by=profile.id;
      const q=a?db.from('knowledge_articles').update(payload).eq('id',a.id):db.from('knowledge_articles').insert(payload);
      const {error}=await q;
      if(error){msg.textContent='Erro ao salvar: '+error.message;msg.className='auth-message error span-2';btn.disabled=false;btn.textContent='Salvar artigo';return}
      closeAtlasModal();
      await window.knowledgePage();
    });
  };

  window.deleteKnowledgeArticle=async function(id){
    if(atlasProfile()?.role!=='admin')return;
    if(!confirm('Excluir este artigo da Base de Conhecimento?'))return;
    const {error}=await atlasDb().from('knowledge_articles').delete().eq('id',id);
    if(error)return alert('Não foi possível excluir: '+error.message);
    closeAtlasModal();
    await window.knowledgePage();
  };

  let kbChannel=null;
  function startRealtime(){
    const db=atlasDb();
    if(!db||kbChannel)return;
    kbChannel=db.channel('atlas-knowledge-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'knowledge_articles'},()=>{
        const active=document.querySelector('#nav [data-page].active')?.dataset?.page;
        if(active==='conhecimento')window.knowledgePage();
      }).subscribe();
  }

  const oldShow=window.showApp;
  if(typeof oldShow==='function'){
    window.showApp=function(profile){const r=oldShow(profile);setTimeout(startRealtime,0);return r}
  }
})();