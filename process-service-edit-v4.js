(() => {
  async function openProcessServiceEditor(id){
    const db=window.atlasDb?.()||(typeof atlasDb==='function'?atlasDb():null);
    const shell=window.modalShell||(typeof modalShell==='function'?modalShell:null);
    const close=window.closeAtlasModal||(typeof closeAtlasModal==='function'?closeAtlasModal:null);
    const escape=typeof esc==='function'?esc:(v=>String(v??''));
    if(!db||!shell)return;

    const {data:rec,error}=await db.from('processes').select('id,public_code,title,service_type,status').eq('id',id).single();
    if(error)return alert(error.message);
    if(!rec)return;

    shell('Alterar serviço',`<form id="process-service-form" class="modal-form-grid">
      <div class="field span-2"><label>Processo</label><input value="${escape(rec.public_code||rec.title||id)}" disabled></div>
      <div class="field span-2"><label>Serviço</label><input id="process-service-value" required value="${escape(rec.service_type||'')}" placeholder="Informe o serviço"></div>
      <div class="modal-actions span-2"><button type="button" class="btn btn-muted" id="process-service-cancel">Cancelar</button><button id="process-service-save" class="btn btn-primary" type="submit">Salvar serviço</button></div>
      <div id="process-service-message" class="auth-message hidden span-2"></div>
    </form>`,true);

    document.getElementById('process-service-cancel')?.addEventListener('click',()=>close?.());
    document.getElementById('process-service-form')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const input=document.getElementById('process-service-value');
      const value=input?.value?.trim();
      if(!value)return;
      const btn=document.getElementById('process-service-save');
      if(btn){btn.disabled=true;btn.textContent='Salvando...';}
      const {error:updateError}=await db.from('processes').update({service_type:value}).eq('id',id);
      if(updateError){
        const m=document.getElementById('process-service-message');
        if(m){m.textContent=updateError.message;m.className='auth-message error span-2';}
        if(btn){btn.disabled=false;btn.textContent='Salvar serviço';}
        return;
      }
      close?.();
      if(typeof window.processPage==='function')await window.processPage();
    });
  }
  window.openProcessServiceEditor=openProcessServiceEditor;
})();
