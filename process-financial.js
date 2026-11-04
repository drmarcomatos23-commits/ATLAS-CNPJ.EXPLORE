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
  function localIsoDate(){
    const now=new Date();
    const y=now.getFullYear();
    const m=String(now.getMonth()+1).padStart(2,'0');
    const d=String(now.getDate()).padStart(2,'0');
    return y+'-'+m+'-'+d;
  }

  const SERVICE_FEE_PRESETS={
    abertura:3242.00,
    alteracao_societaria:2431.50,
    alteracao:2431.50,
    baixa:4052.50,
    encerramento:4052.50
  };

  function normalizeService(v){
    return String(v||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().trim();
  }

  function servicePreset(v){
    const s=normalizeService(v);
    if(!s)return null;
    if(s.includes('abertura'))return SERVICE_FEE_PRESETS.abertura;
    if(s.includes('alteracao'))return SERVICE_FEE_PRESETS.alteracao_societaria;
    if(s.includes('baixa')||s.includes('encerramento'))return SERVICE_FEE_PRESETS.baixa;
    return null;
  }

  const isFeeRow=c=>c&&(c.fee_kind==='honorarios'||c.metadata?.kind==='service_fee'||c.metadata?.kind==='hourly'||c.cost_type==='hourly');
  const instOf=c=>Number(c?.metadata?.installment?.n||0);
  const escAttr=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const F=()=>window.AtlasFinanceiro;

  function instRowHtml(it,total){
    const paid=it.payment_status==='paid';
    return `<div class="inst-row" data-n="${it.n}">
      <span class="inst-n">${it.n}/${total}</span>
      <input class="inst-amount" inputmode="decimal" value="${it.amount?fmt(it.amount):''}" placeholder="0,00" aria-label="Valor da parcela ${it.n}">
      <input class="inst-due" type="date" value="${escAttr(it.due_date||'')}" required aria-label="Vencimento da parcela ${it.n}">
      <select class="inst-status" aria-label="Situação da parcela ${it.n}"><option value="pending" ${paid?'':'selected'}>A receber</option><option value="paid" ${paid?'selected':''}>Recebida</option></select>
      <input class="inst-paid-at" type="date" value="${escAttr(it.paid_at||'')}" ${paid?'':'disabled'} aria-label="Recebida em (parcela ${it.n})" title="Data do recebimento">
    </div>`;
  }

  function servicePresetLabel(v){
    const s=normalizeService(v);
    if(s.includes('abertura'))return 'Abertura';
    if(s.includes('alteracao'))return 'Alteração';
    if(s.includes('baixa')||s.includes('encerramento'))return 'Baixa';
    return '';
  }

  function injectFinance(form, existingCosts=[]){
    if(!form || form.querySelector('#proc-finance-section')) return;
    const fees=existingCosts.filter(isFeeRow).sort((a,b)=>(instOf(a)-instOf(b))||String(a.due_date||'').localeCompare(String(b.due_date||'')));
    const honorario=fees[0]||{};
    const installmentMode=fees.length>1||!!honorario.metadata?.installment;
    const fee=existingCosts.find(c=>c.metadata?.source==='process_form'&&c.metadata?.kind==='registry_fee')||{};
    const base=honorario.id?honorario:fee;

    const wrap=document.createElement('div');
    wrap.id='proc-finance-section';
    wrap.className='span-2 process-finance-box';
    const serviceField=form.querySelector('#proc-service');
    const initialPreset=servicePreset(serviceField?.value);
    const initialHonorario=honorario.id?(Number(honorario.metadata?.total_amount)||fees.reduce((n,c)=>n+Number(c.amount||0),0)):initialPreset;

    wrap.innerHTML=`
      <div class="finance-title"><div><strong>Financeiro do processo</strong><span>Honorários, taxas e responsável pelo pagamento</span></div></div>
      <div class="finance-grid">
        <div class="field span-2">
          <label>Honorários do serviço (R$)</label>
          <div class="honorario-preset-row">
            <input id="proc-honorario-total" inputmode="decimal" value="${initialHonorario?fmt(initialHonorario):''}" placeholder="0,00">
            <button id="proc-apply-fee-preset" class="mini-btn" type="button">Usar valor sugerido</button>
          </div>
          <small id="proc-fee-preset-hint" class="finance-preset-hint"></small>
        </div>
        <div class="field"><label>Taxa Junta / Cartório (R$)</label><input id="proc-registry-fee" inputmode="decimal" value="${fee.amount?fmt(fee.amount):''}" placeholder="0,00"></div>
        <div class="field span-2 honor-mode"><label>Forma de pagamento dos honorários</label>
          <div class="honor-mode-toggle" role="radiogroup">
            <label><input type="radio" name="proc-honor-mode" value="avista" ${installmentMode?'':'checked'}> À vista (parcela única)</label>
            <label><input type="radio" name="proc-honor-mode" value="parcelado" ${installmentMode?'checked':''}> Parcelado</label>
          </div>
        </div>
        <div class="field finance-status-field honor-status honor-avista"><label>Honorários recebidos?</label><select id="proc-hourly-payment-status"><option value="pending" ${honorario.payment_status!=='paid'?'selected':''}>A receber</option><option value="paid" ${honorario.payment_status==='paid'?'selected':''}>Recebido</option></select></div>
        <div class="field finance-status-field honor-due honor-avista"><label>Vencimento dos honorários *</label><input id="proc-hourly-due" type="date" value="${installmentMode?'':(honorario.due_date||'')}"></div>
        <div class="field finance-status-field honor-avista"><label>Recebido em</label><input id="proc-hourly-paid-at" type="date" value="${installmentMode?'':(honorario.paid_at||'')}" ${honorario.payment_status==='paid'&&!installmentMode?'':'disabled'}></div>
        <div class="field span-2 honor-parcelado" id="proc-inst-box">
          <div class="inst-setup">
            <div class="field"><label>Nº de parcelas</label><input id="proc-inst-count" type="number" min="2" max="36" value="${installmentMode?fees.length:3}"></div>
            <div class="field"><label>1º vencimento</label><input id="proc-inst-first" type="date" value="${escAttr(fees[0]?.due_date||'')}"></div>
            <button id="proc-inst-generate" class="mini-btn" type="button">Gerar parcelas mensais</button>
          </div>
          <div class="inst-head"><span>Parcela</span><span>Valor (R$)</span><span>Vencimento *</span><span>Situação</span><span>Recebida em</span></div>
          <div id="proc-inst-list">${installmentMode?fees.map(c=>instRowHtml({n:instOf(c)||fees.indexOf(c)+1,amount:Number(c.amount||0),due_date:c.due_date,payment_status:c.payment_status,paid_at:c.paid_at},fees.length)).join(''):''}</div>
          <small id="proc-inst-sum" class="finance-preset-hint"></small>
        </div>
        <div class="field finance-status-field fee-status"><label>Taxa Junta / Cartório paga?</label><select id="proc-fee-payment-status"><option value="pending" ${fee.payment_status!=='paid'?'selected':''}>Não paga</option><option value="paid" ${fee.payment_status==='paid'?'selected':''}>Paga</option></select></div>
        <div class="field finance-status-field fee-due"><label>Vencimento da taxa</label><input id="proc-fee-due" type="date" value="${fee.due_date||''}"></div>
        <div class="field finance-status-field fee-paid-at"><label>Data do pagamento da taxa</label><input id="proc-fee-paid-at" type="date" value="${fee.paid_at||''}" readonly></div>
        <div class="field"><label>Responsável pelo pagamento</label><input id="proc-payer-name" value="${String((honorario.payer_name||fee.payer_name||'')).replace(/"/g,'&quot;')}" placeholder="Empresa ou sócio"></div>
        <div class="field"><label>Tipo do documento</label><select id="proc-payer-type"><option value="CNPJ" ${(honorario.payer_type||fee.payer_type)!=='CPF'?'selected':''}>CNPJ</option><option value="CPF" ${(honorario.payer_type||fee.payer_type)==='CPF'?'selected':''}>CPF</option></select></div>
        <div class="field span-2"><label>CPF / CNPJ do responsável</label><input id="proc-payer-document" value="${String((honorario.payer_document||fee.payer_document||'')).replace(/"/g,'&quot;')}" placeholder="Somente números ou formatado"></div>
        <div class="field"><label>Guia / boleto de honorários</label><input id="proc-hourly-attachment" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"></div>
        <div class="field"><label>Guia / boleto da taxa Junta / Cartório</label><input id="proc-fee-attachment" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"></div>
      </div>`;

    const actions=form.querySelector('.modal-actions');
    form.insertBefore(wrap,actions);

    const honorarioInput=document.getElementById('proc-honorario-total');
    const presetButton=document.getElementById('proc-apply-fee-preset');
    const presetHint=document.getElementById('proc-fee-preset-hint');
    let honorarioManuallyEdited=!!honorario.id;

    const refreshPreset=(apply=false)=>{
      const preset=servicePreset(serviceField?.value);
      const label=servicePresetLabel(serviceField?.value);
      if(presetHint){
        presetHint.textContent=preset
          ? `Valor sugerido para ${label}: R$ ${fmt(preset)}. Você pode alterar livremente este valor.`
          : 'Sem valor sugerido para este serviço. Digite o valor de honorários.';
      }
      if(presetButton)presetButton.disabled=!preset;
      if(apply&&preset&&honorarioInput){
        honorarioInput.value=fmt(preset);
        honorarioManuallyEdited=false;
      }
    };

    // ---- À vista x parcelado ----
    const modeValue=()=>wrap.querySelector('input[name="proc-honor-mode"]:checked')?.value||'avista';
    const instList=document.getElementById('proc-inst-list');
    const instSum=document.getElementById('proc-inst-sum');
    const refreshInstSum=()=>{
      if(!instSum)return;
      const total=brMoneyToNumber(honorarioInput?.value);
      const sum=[...instList.querySelectorAll('.inst-amount')].reduce((n,i)=>n+brMoneyToNumber(i.value),0);
      const diff=Math.round((total-sum)*100)/100;
      instSum.textContent=instList.children.length
        ? `Soma das parcelas: R$ ${fmt(sum)} de R$ ${fmt(total)}`+(Math.abs(diff)>=0.01?` · diferença de R$ ${fmt(diff)}`:' · confere')
        : 'Informe o nº de parcelas e o 1º vencimento e clique em "Gerar parcelas mensais".';
      instSum.classList.toggle('inst-sum-bad',instList.children.length>0&&Math.abs(diff)>=0.01);
    };
    const applyMode=()=>{
      const parc=modeValue()==='parcelado';
      wrap.querySelectorAll('.honor-avista').forEach(el=>{el.hidden=parc;});
      wrap.querySelectorAll('.honor-parcelado').forEach(el=>{el.hidden=!parc;});
      if(parc&&!instList.children.length){
        const due=document.getElementById('proc-hourly-due')?.value;
        if(due)document.getElementById('proc-inst-first').value=due;
      }
      refreshInstSum();
    };
    wrap.querySelectorAll('input[name="proc-honor-mode"]').forEach(r=>r.addEventListener('change',applyMode));
    document.getElementById('proc-inst-generate')?.addEventListener('click',()=>{
      const total=brMoneyToNumber(honorarioInput?.value);
      const count=Math.max(2,Math.min(36,Math.round(Number(document.getElementById('proc-inst-count')?.value||0))));
      const first=document.getElementById('proc-inst-first')?.value;
      if(!(total>0)){alert('Informe primeiro o valor total dos honorários.');return;}
      if(!first){alert('Informe a data do 1º vencimento.');return;}
      if(instList.children.length&&!confirm('Substituir as parcelas atuais por '+count+' parcelas mensais?'))return;
      const list=F()?.splitInstallments?F().splitInstallments(total,count,first):[];
      instList.innerHTML=list.map(it=>instRowHtml({...it,payment_status:'pending'},count)).join('');
      refreshInstSum();
    });
    instList?.addEventListener('input',refreshInstSum);
    instList?.addEventListener('change',ev=>{
      const sel=ev.target.closest('.inst-status');if(!sel)return;
      const paidAt=sel.closest('.inst-row').querySelector('.inst-paid-at');
      paidAt.disabled=sel.value!=='paid';
      if(sel.value==='paid'&&!paidAt.value)paidAt.value=localIsoDate();
      if(sel.value!=='paid')paidAt.value='';
    });
    honorarioInput?.addEventListener('input',refreshInstSum);
    const hStatus=document.getElementById('proc-hourly-payment-status'),hPaid=document.getElementById('proc-hourly-paid-at');
    hStatus?.addEventListener('change',()=>{if(!hPaid)return;hPaid.disabled=hStatus.value!=='paid';if(hStatus.value==='paid'&&!hPaid.value)hPaid.value=localIsoDate();if(hStatus.value!=='paid')hPaid.value='';});
    applyMode();

    const feeStatusField=document.getElementById('proc-fee-payment-status');
    const feePaidAtField=document.getElementById('proc-fee-paid-at');
    feeStatusField?.addEventListener('change',()=>{
      if(!feePaidAtField)return;
      if(feeStatusField.value==='paid'&&!feePaidAtField.value)feePaidAtField.value=localIsoDate();
      if(feeStatusField.value!=='paid')feePaidAtField.value='';
    });

    refreshPreset(!honorario.id&&!!initialPreset);
    honorarioInput?.addEventListener('input',()=>{honorarioManuallyEdited=true;});
    presetButton?.addEventListener('click',()=>refreshPreset(true));
    serviceField?.addEventListener('change',()=>{
      const preset=servicePreset(serviceField.value);
      if(!honorarioManuallyEdited&&preset&&honorarioInput)honorarioInput.value=fmt(preset);
      refreshPreset(false);
    });
    serviceField?.addEventListener('input',()=>{
      const preset=servicePreset(serviceField.value);
      if(!honorarioManuallyEdited&&preset&&honorarioInput)honorarioInput.value=fmt(preset);
      refreshPreset(false);
    });
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

  // Lê e valida os honorários antes de gravar o processo (evita processo salvo sem financeiro)
  function readHonorarios(){
    const total=brMoneyToNumber(document.getElementById('proc-honorario-total')?.value);
    const mode=document.querySelector('input[name="proc-honor-mode"]:checked')?.value||'avista';
    if(!(total>0))return {total:0,mode,items:[]};
    if(mode==='parcelado'){
      const rows=[...document.querySelectorAll('#proc-inst-list .inst-row')];
      if(rows.length<2)return {error:'Honorários parcelados: gere ao menos 2 parcelas (informe o nº de parcelas e o 1º vencimento).'};
      const items=rows.map((r,i)=>({n:i+1,amount:brMoneyToNumber(r.querySelector('.inst-amount').value),due_date:r.querySelector('.inst-due').value||null,payment_status:r.querySelector('.inst-status').value,paid_at:r.querySelector('.inst-status').value==='paid'?(r.querySelector('.inst-paid-at').value||localIsoDate()):null}));
      const noDue=items.find(i=>!i.due_date);if(noDue)return {error:`Informe o vencimento da parcela ${noDue.n}/${items.length}. O vencimento é obrigatório para o controle mensal.`};
      const zero=items.find(i=>!(i.amount>0));if(zero)return {error:`Informe o valor da parcela ${zero.n}/${items.length}.`};
      const sum=items.reduce((n,i)=>n+i.amount,0);
      if(Math.abs(Math.round((total-sum)*100))>=1)return {error:`A soma das parcelas (R$ ${fmt(sum)}) não confere com o total dos honorários (R$ ${fmt(total)}).`};
      return {total,mode,items};
    }
    const due=document.getElementById('proc-hourly-due')?.value||null;
    if(!due)return {error:'Informe o vencimento dos honorários. Ele é obrigatório para o controle mensal (sem baixa até a data, o honorário aparece como vencido).'};
    const status=document.getElementById('proc-hourly-payment-status')?.value||'pending';
    return {total,mode,items:[{n:1,amount:total,due_date:due,payment_status:status,paid_at:status==='paid'?(document.getElementById('proc-hourly-paid-at')?.value||localIsoDate()):null}]};
  }

  async function saveFinance(processId){
    const db=atlasDb();
    const H=readHonorarios();
    if(H.error)throw new Error(H.error);
    const feeAmount=brMoneyToNumber(document.getElementById('proc-registry-fee')?.value);
    const feePaymentStatus=document.getElementById('proc-fee-payment-status')?.value||'pending';
    const feeDueDate=document.getElementById('proc-fee-due')?.value||null;
    const payerName=document.getElementById('proc-payer-name')?.value.trim()||null;
    const payerType=document.getElementById('proc-payer-type')?.value||null;
    const payerDocument=document.getElementById('proc-payer-document')?.value.trim()||null;
    const serviceType=document.getElementById('proc-service')?.value||'';

    const {data:old}=await db.from('costs').select('*').eq('process_id',processId);
    const oldFees=(old||[]).filter(c=>c.metadata?.source==='process_form'&&isFeeRow(c)).sort((a,b)=>(instOf(a)-instOf(b))||String(a.due_date||'').localeCompare(String(b.due_date||'')));
    const oldFee=(old||[]).find(c=>c.metadata?.source==='process_form'&&c.metadata?.kind==='registry_fee')||{};
    const feePaidAt=feePaymentStatus==='paid'
      ? (oldFee.payment_status==='paid'&&oldFee.paid_at?oldFee.paid_at:(document.getElementById('proc-fee-paid-at')?.value||localIsoDate()))
      : null;
    const ids=(old||[]).filter(c=>c.metadata?.source==='process_form').map(c=>c.id);
    if(ids.length) await db.from('costs').delete().in('id',ids);

    const rows=[];
    const N=H.items.length;
    H.items.forEach((it,i)=>{
      const prev=oldFees[i]||{};
      const row={
        process_id:processId,
        description:N>1?`Honorários do serviço · Parcela ${it.n}/${N}`:'Honorários do serviço',
        cost_type:'hourly',
        fee_kind:'honorarios',
        hourly_rate:null,
        hours:null,
        amount:Math.round(it.amount*100)/100,
        payment_status:it.payment_status,
        paid_at:it.paid_at,
        due_date:it.due_date,
        payer_name:payerName,
        payer_type:payerType,
        payer_document:payerDocument,
        metadata:{source:'process_form',kind:'service_fee',service_type:serviceType,preset_amount:servicePreset(serviceType),total_amount:H.total,...(N>1?{installment:{n:it.n,total:N}}:{})}
      };
      if(prev.created_at)row.created_at=prev.created_at;
      rows.push(row);
    });
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
    // Clona primeiro para remover o submit original e só depois injeta o financeiro.
    // Assim, os listeners de tipo de serviço/honorários ficam vinculados ao formulário real.
    const cloned=form.cloneNode(true);
    form.replaceWith(cloned);
    injectFinance(cloned,existing);
    injectProcessDocuments(cloned,processDocs);

    // v3.42 - conclusão reversível: permite reabrir e mover o processo para qualquer etapa/status.
    const stageSelect=document.getElementById('proc-stage');
    const statusSelect=document.getElementById('proc-status');
    const stageOptions=[...(stageSelect?.options||[])];
    const completedStageOption=stageOptions.find(opt=>/conclu[ií]do/i.test(String(opt.textContent||'')));
    const fallbackNonCompletedStage=stageOptions.filter(opt=>opt.value!==completedStageOption?.value).slice(-1)[0];
    let lastNonCompletedStage=stageSelect?.value&&stageSelect.value!==completedStageOption?.value
      ? stageSelect.value
      : (fallbackNonCompletedStage?.value||'');

    let syncingStageStatus=false;
    const syncFromStage=()=>{
      if(syncingStageStatus||!stageSelect||!statusSelect)return;
      syncingStageStatus=true;
      if(completedStageOption&&stageSelect.value===completedStageOption.value){
        statusSelect.value='completed';
      }else{
        if(stageSelect.value)lastNonCompletedStage=stageSelect.value;
        if(statusSelect.value==='completed')statusSelect.value='in_progress';
      }
      syncingStageStatus=false;
    };
    const syncFromStatus=()=>{
      if(syncingStageStatus||!stageSelect||!statusSelect)return;
      syncingStageStatus=true;
      if(statusSelect.value==='completed'&&completedStageOption){
        if(stageSelect.value!==completedStageOption.value&&stageSelect.value)lastNonCompletedStage=stageSelect.value;
        stageSelect.value=completedStageOption.value;
      }else if(completedStageOption&&stageSelect.value===completedStageOption.value){
        stageSelect.value=lastNonCompletedStage||fallbackNonCompletedStage?.value||stageSelect.value;
      }
      syncingStageStatus=false;
    };
    stageSelect?.addEventListener('change',syncFromStage);
    statusSelect?.addEventListener('change',syncFromStatus);

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
      const finCheck=readHonorarios();
      if(finCheck.error){msg.textContent=finCheck.error;msg.className='auth-message error span-2';msg.scrollIntoView?.({block:'nearest'});return;}
      btn.disabled=true;btn.textContent='Salvando...';
      try{
        const status=document.getElementById('proc-status').value;
        const data=await loadOperationalData();
        const existingProcess=id?data.processes.find(p=>p.id===id):null;
        const template=id
          ? (data.templates.find(t=>t.id===existingProcess?.workflow_template_id)||data.templates[0])
          : data.templates[0];
        const stagesFor=data.stages
          .filter(s=>!template||s.workflow_template_id===template.id)
          .sort((a,b)=>a.position-b.position);
        const finalStage=stagesFor.find(s=>/conclu[ií]do/i.test(String(s.name||'')))||stagesFor[stagesFor.length-1];
        const selectedStageId=document.getElementById('proc-stage').value||null;
        const payload={
          organization_id:atlasProfile().organization_id,
          client_id:clientId,
          workflow_template_id:id?undefined:(template?.id||null),
          title:document.getElementById('proc-title').value.trim(),
          service_type:document.getElementById('proc-service').value,
          status,
          current_stage_id:status==='completed'?(finalStage?.id||selectedStageId):selectedStageId,
          owner_id:document.getElementById('proc-owner').value||null,
          priority:document.getElementById('proc-priority').value,
          due_date:document.getElementById('proc-due').value||null,
          completed_at:status==='completed'
            ? (existingProcess?.status==='completed'&&existingProcess?.completed_at?existingProcess.completed_at:new Date().toISOString())
            : null
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