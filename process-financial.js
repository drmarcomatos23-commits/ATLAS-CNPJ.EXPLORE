(() => {
  const previousOpen = window.openProcessModal;

  function brMoneyToNumber(v){
    const s=String(v||'').trim();
    if(!s)return 0;
    if(s.includes(',')) return Number(s.replace(/\./g,'').replace(',','.'))||0;
    return Number(s)||0;
  }
  function num(v){ return Number(v||0)||0; }
  function fmt(v){ return num(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }

  function injectFinance(form, existingCosts=[]){
    if(!form || form.querySelector('#proc-finance-section')) return;
    const hourly=existingCosts.find(c=>c.metadata?.source==='process_form'&&c.metadata?.kind==='hourly')||{};
    const fee=existingCosts.find(c=>c.metadata?.source==='process_form'&&c.metadata?.kind==='registry_fee')||{};
    const base=hourly.id?hourly:fee;

    const wrap=document.createElement('div');
    wrap.id='proc-finance-section';
    wrap.className='span-2 process-finance-box';
    wrap.innerHTML=`
      <div class="finance-title"><div><strong>Financeiro do processo</strong><span>Honorários, taxas e responsável pelo pagamento</span></div></div>
      <div class="finance-grid">
        <div class="field"><label>Valor por hora (R$)</label><input id="proc-hourly-rate" inputmode="decimal" value="${hourly.hourly_rate?fmt(hourly.hourly_rate):''}" placeholder="0,00"></div>
        <div class="field"><label>Horas previstas</label><input id="proc-hours" inputmode="decimal" value="${hourly.hours||''}" placeholder="0"></div>
        <div class="field"><label>Total honorários (R$)</label><input id="proc-hourly-total" value="${hourly.amount?fmt(hourly.amount):'0,00'}" readonly></div>
        <div class="field"><label>Taxa Junta / Cartório (R$)</label><input id="proc-registry-fee" inputmode="decimal" value="${fee.amount?fmt(fee.amount):''}" placeholder="0,00"></div>
        <div class="field finance-status-field honor-status"><label>Honorários recebidos?</label><select id="proc-hourly-payment-status"><option value="pending" ${hourly.payment_status!=='paid'?'selected':''}>A receber</option><option value="paid" ${hourly.payment_status==='paid'?'selected':''}>Recebido</option></select></div>
        <div class="field finance-status-field honor-due"><label>Vencimento dos honorários</label><input id="proc-hourly-due" type="date" value="${hourly.due_date||''}"></div>
        <div class="field finance-status-field fee-status"><label>Taxa Junta / Cartório paga?</label><select id="proc-fee-payment-status"><option value="pending" ${fee.payment_status!=='paid'?'selected':''}>Não paga</option><option value="paid" ${fee.payment_status==='paid'?'selected':''}>Paga</option></select></div>
        <div class="field finance-status-field fee-due"><label>Vencimento da taxa</label><input id="proc-fee-due" type="date" value="${fee.due_date||''}"></div>
        <div class="field"><label>Responsável pelo pagamento</label><input id="proc-payer-name" value="${String((hourly.payer_name||fee.payer_name||'')).replace(/"/g,'&quot;')}" placeholder="Empresa ou sócio"></div>
        <div class="field"><label>Tipo do documento</label><select id="proc-payer-type"><option value="CNPJ" ${(hourly.payer_type||fee.payer_type)!=='CPF'?'selected':''}>CNPJ</option><option value="CPF" ${(hourly.payer_type||fee.payer_type)==='CPF'?'selected':''}>CPF</option></select></div>
        <div class="field span-2"><label>CPF / CNPJ do responsável</label><input id="proc-payer-document" value="${String((hourly.payer_document||fee.payer_document||'')).replace(/"/g,'&quot;')}" placeholder="Somente números ou formatado"></div>
        <div class="field"><label>Guia / boleto de honorários</label><input id="proc-hourly-attachment" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"></div>
        <div class="field"><label>Guia / boleto da taxa Junta / Cartório</label><input id="proc-fee-attachment" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"></div>
      </div>`;

    const actions=form.querySelector('.modal-actions');
    form.insertBefore(wrap,actions);

    const calc=()=>{
      const rate=brMoneyToNumber(document.getElementById('proc-hourly-rate')?.value);
      const hours=brMoneyToNumber(document.getElementById('proc-hours')?.value);
      const total=document.getElementById('proc-hourly-total');
      if(total)total.value=fmt(rate*hours);
    };
    document.getElementById('proc-hourly-rate')?.addEventListener('input',calc);
    document.getElementById('proc-hours')?.addEventListener('input',calc);
  }


  function safeFileName(name){
    return String(name||'arquivo')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9._-]+/g,'-')
      .replace(/-+/g,'-')
      .slice(-120);
  }

  async function uploadFinanceDocument(processId, kind, file){
    if(!file)return;
    const db=atlasDb();
    const profile=atlasProfile();
    const {data:proc,error:procError}=await db.from('processes').select('id,client_id,public_code').eq('id',processId).single();
    if(procError)throw procError;

    const fileName=safeFileName(file.name);
    const objectKey=`${profile.organization_id}/${proc.client_id||'sem-empresa'}/${processId}/financeiro/${kind}/${crypto.randomUUID()}-${fileName}`;
    const {error:uploadError}=await db.storage.from('legalizacao-documents').upload(objectKey,file,{upsert:false,contentType:file.type||undefined});
    if(uploadError)throw uploadError;

    const category=kind==='honorarios'?'Financeiro · Honorários':'Financeiro · Taxa Junta/Cartório';
    const {error:docError}=await db.from('documents').insert({
      organization_id:profile.organization_id,
      client_id:proc.client_id||null,
      process_id:processId,
      name:file.name,
      category,
      storage_key:objectKey,
      mime_type:file.type||null,
      size_bytes:file.size,
      uploaded_by:profile.id
    });
    if(docError){
      await db.storage.from('legalizacao-documents').remove([objectKey]);
      throw docError;
    }
  }

  function processDocCategoryOptions(selected=''){
    const options=['Societário','Documento pessoal','Comprovante','Exigência','Requerimento','Certidão','Fiscal','Contrato','Licença','Outros'];
    return options.map(x=>`<option value="${x}" ${x===selected?'selected':''}>${x}</option>`).join('');
  }

  function processDocSize(value){
    const n=Number(value||0);
    if(!n)return '—';
    if(n<1024)return n+' B';
    if(n<1048576)return (n/1024).toLocaleString('pt-BR',{maximumFractionDigits:1})+' KB';
    return (n/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB';
  }

  function injectProcessDocuments(form,docs=[]){
    if(!form||form.querySelector('#proc-documents-section'))return;
    const actions=form.querySelector('.modal-actions');
    const wrap=document.createElement('div');
    wrap.id='proc-documents-section';
    wrap.className='span-2 process-documents-box';
    wrap.innerHTML=`
      <div class="process-documents-title">
        <div><strong>Documentos do processo</strong><span>Anexe arquivos gerais vinculados à empresa e ao processo.</span></div>
      </div>
      <div class="process-documents-upload">
        <div class="field"><label>Categoria</label><select id="proc-doc-category">${processDocCategoryOptions()}</select></div>
        <div class="field"><label>Arquivos</label><input id="proc-doc-files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"></div>
      </div>
      <div class="process-documents-note">Você pode selecionar vários arquivos de uma vez. Limite de 50 MB por arquivo.</div>
      <div id="proc-existing-documents" class="process-existing-documents">
        ${docs.length?docs.map(d=>`<div class="process-doc-row" data-doc-id="${d.id}">
          <div><strong>${String(d.name||'Documento').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</strong><span>${String(d.category||'Geral').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))} · ${processDocSize(d.size_bytes)}</span></div>
          <div class="row-actions"><button type="button" class="mini-btn" onclick="openStoredDocument('${d.id}')">Abrir</button><button type="button" class="mini-btn danger" onclick="deleteProcessDocument('${d.id}')">Excluir</button></div>
        </div>`).join(''):'<div class="muted process-no-docs">Nenhum documento geral anexado a este processo.</div>'}
      </div>`;
    form.insertBefore(wrap,actions);
  }

  async function uploadProcessDocuments(processId){
    const input=document.getElementById('proc-doc-files');
    const files=[...(input?.files||[])];
    if(!files.length)return;
    const category=document.getElementById('proc-doc-category')?.value||'Outros';
    const db=atlasDb();
    const profile=atlasProfile();
    const {data:proc,error:procError}=await db.from('processes').select('id,client_id').eq('id',processId).single();
    if(procError)throw procError;

    for(const file of files){
      if(file.size>50*1024*1024)throw new Error('O arquivo "'+file.name+'" excede o limite de 50 MB.');
      const fileName=safeFileName(file.name);
      const objectKey=`${profile.organization_id}/${proc.client_id||'sem-empresa'}/${processId}/processo/${crypto.randomUUID()}-${fileName}`;
      const {error:uploadError}=await db.storage.from('legalizacao-documents').upload(objectKey,file,{upsert:false,contentType:file.type||undefined});
      if(uploadError)throw uploadError;

      const {error:docError}=await db.from('documents').insert({
        organization_id:profile.organization_id,
        client_id:proc.client_id||null,
        process_id:processId,
        name:file.name,
        category,
        storage_key:objectKey,
        mime_type:file.type||null,
        size_bytes:file.size,
        uploaded_by:profile.id
      });
      if(docError){
        await db.storage.from('legalizacao-documents').remove([objectKey]);
        throw docError;
      }
    }
  }

  window.deleteProcessDocument=async function(id){
    if(!confirm('Excluir este documento do processo?'))return;
    const db=atlasDb();
    const {data:doc,error}=await db.from('documents').select('id,storage_key').eq('id',id).single();
    if(error||!doc)return alert('Documento não encontrado.');
    const {error:storageError}=await db.storage.from('legalizacao-documents').remove([doc.storage_key]);
    if(storageError)return alert('Não foi possível excluir o arquivo: '+storageError.message);
    const {error:metaError}=await db.from('documents').delete().eq('id',id);
    if(metaError)return alert('Arquivo removido, mas houve falha ao remover o registro: '+metaError.message);
    document.querySelector('.process-doc-row[data-doc-id="'+id+'"]')?.remove();
    const list=document.getElementById('proc-existing-documents');
    if(list&&!list.querySelector('.process-doc-row'))list.innerHTML='<div class="muted process-no-docs">Nenhum documento geral anexado a este processo.</div>';
  };

  async function saveFinance(processId){
    const db=atlasDb();
    const hourlyRate=brMoneyToNumber(document.getElementById('proc-hourly-rate')?.value);
    const hours=brMoneyToNumber(document.getElementById('proc-hours')?.value);
    const feeAmount=brMoneyToNumber(document.getElementById('proc-registry-fee')?.value);
    const hourlyPaymentStatus=document.getElementById('proc-hourly-payment-status')?.value||'pending';
    const hourlyDueDate=document.getElementById('proc-hourly-due')?.value||null;
    const feePaymentStatus=document.getElementById('proc-fee-payment-status')?.value||'pending';
    const feeDueDate=document.getElementById('proc-fee-due')?.value||null;
    const payerName=document.getElementById('proc-payer-name')?.value.trim()||null;
    const payerType=document.getElementById('proc-payer-type')?.value||null;
    const payerDocument=document.getElementById('proc-payer-document')?.value.trim()||null;
    const hourlyPaidAt=hourlyPaymentStatus==='paid'?new Date().toISOString().slice(0,10):null;
    const feePaidAt=feePaymentStatus==='paid'?new Date().toISOString().slice(0,10):null;

    const {data:old}=await db.from('costs').select('id,metadata').eq('process_id',processId);
    const ids=(old||[]).filter(c=>c.metadata?.source==='process_form').map(c=>c.id);
    if(ids.length) await db.from('costs').delete().in('id',ids);

    const rows=[];
    if(hourlyRate>0 || hours>0){
      rows.push({
        process_id:processId,
        description:'Honorários por hora',
        cost_type:'hourly',
        fee_kind:'honorarios',
        hourly_rate:hourlyRate,
        hours,
        amount:hourlyRate*hours,
        payment_status:hourlyPaymentStatus,
        paid_at:hourlyPaidAt,
        due_date:hourlyDueDate,
        payer_name:payerName,
        payer_type:payerType,
        payer_document:payerDocument,
        metadata:{source:'process_form',kind:'hourly'}
      });
    }
    if(feeAmount>0){
      rows.push({
        process_id:processId,
        description:'Taxa Junta / Cartório',
        cost_type:'registry_fee',
        fee_kind:'junta_cartorio',
        amount:feeAmount,
        payment_status:feePaymentStatus,
        paid_at:feePaidAt,
        due_date:feeDueDate,
        payer_name:payerName,
        payer_type:payerType,
        payer_document:payerDocument,
        metadata:{source:'process_form',kind:'registry_fee'}
      });
    }
    if(rows.length){
      const {error}=await db.from('costs').insert(rows);
      if(error) throw error;
    }

    const hourlyFile=document.getElementById('proc-hourly-attachment')?.files?.[0];
    const feeFile=document.getElementById('proc-fee-attachment')?.files?.[0];
    if(hourlyFile) await uploadFinanceDocument(processId,'honorarios',hourlyFile);
    if(feeFile) await uploadFinanceDocument(processId,'taxa',feeFile);
  }

  window.openProcessModal = async function(id=''){
    await previousOpen(id);
    const form=document.getElementById('process-real-form');
    if(!form)return;

    let existing=[];
    let processDocs=[];
    if(id){
      const [costsRes,docsRes]=await Promise.all([
        atlasDb().from('costs').select('*').eq('process_id',id),
        atlasDb().from('documents').select('id,name,category,size_bytes,storage_key,mime_type').eq('process_id',id).not('category','like','Financeiro ·%').order('created_at',{ascending:false})
      ]);
      existing=costsRes.data||[];
      processDocs=docsRes.data||[];
    }
    injectFinance(form,existing);

    const cloned=form.cloneNode(true);
    form.replaceWith(cloned);
    injectFinance(cloned,existing);
    injectProcessDocuments(cloned,processDocs);

    // Reativa cadastro rápido de empresa quando o processo é novo.
    if(!id){
      const quick=window.atlasQuickCompany;
      document.getElementById('quick-company-toggle')?.addEventListener('click',()=>quick?.toggleQuickCompany?.());
      document.getElementById('quick-company-close')?.addEventListener('click',()=>quick?.toggleQuickCompany?.());
      document.getElementById('quick-company-consult')?.addEventListener('click',()=>quick?.consultQuickCnpj?.());
      document.getElementById('quick-company-save')?.addEventListener('click',()=>quick?.saveQuickCompany?.());
    }

    cloned.addEventListener('submit',async e=>{
      e.preventDefault();
      const db=atlasDb();
      const btn=document.getElementById('proc-save-btn');
      const msg=document.getElementById('proc-form-message');
      const clientId=document.getElementById('proc-client')?.value;
      if(!clientId){
        msg.textContent='Selecione uma empresa.';msg.className='auth-message error span-2';return;
      }
      btn.disabled=true;btn.textContent='Salvando...';
      try{
        const status=document.getElementById('proc-status').value;
        const data=await loadOperationalData();
        const template=data.templates[0];
        const payload={
          organization_id:atlasProfile().organization_id,
          client_id:clientId,
          workflow_template_id:id?undefined:(template?.id||null),
          title:document.getElementById('proc-title').value.trim(),
          service_type:document.getElementById('proc-service').value,
          status,
          current_stage_id:document.getElementById('proc-stage').value||null,
          owner_id:document.getElementById('proc-owner').value||null,
          priority:document.getElementById('proc-priority').value,
          due_date:document.getElementById('proc-due').value||null,
          completed_at:status==='completed'?new Date().toISOString():null
        };
        Object.keys(payload).forEach(k=>payload[k]===undefined&&delete payload[k]);

        let processId=id;
        if(id){
          const {error}=await db.from('processes').update(payload).eq('id',id);
          if(error)throw error;
        }else{
          const {data:created,error}=await db.from('processes').insert(payload).select('id').single();
          if(error)throw error;
          processId=created.id;
        }
        await saveFinance(processId);
        await uploadProcessDocuments(processId);
        closeAtlasModal();
        await processPage();
      }catch(err){
        msg.textContent=err.message||'Não foi possível salvar o processo.';
        msg.className='auth-message error span-2';
        btn.disabled=false;btn.textContent='Salvar processo';
      }
    });
  };
})();