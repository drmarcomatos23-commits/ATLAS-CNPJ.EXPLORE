(() => {
  const previousOpen = window.openProcessModal;

  function brMoneyToNumber(v){
    const s=String(v||'').trim();
    if(!s)return 0;
    if(s.includes(',')) return Number(s.replace(/./g,'').replace(',','.'))||0;
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
        <div class="field"><label>Situação do pagamento</label><select id="proc-payment-status"><option value="pending" ${base.payment_status!=='paid'?'selected':''}>Não pago</option><option value="paid" ${base.payment_status==='paid'?'selected':''}>Pago</option></select></div>
        <div class="field"><label>Vencimento</label><input id="proc-payment-due" type="date" value="${base.due_date||''}"></div>
        <div class="field"><label>Responsável pelo pagamento</label><input id="proc-payer-name" value="${String(base.payer_name||'').replace(/"/g,'&quot;')}" placeholder="Empresa ou sócio"></div>
        <div class="field"><label>Tipo do documento</label><select id="proc-payer-type"><option value="CNPJ" ${base.payer_type!=='CPF'?'selected':''}>CNPJ</option><option value="CPF" ${base.payer_type==='CPF'?'selected':''}>CPF</option></select></div>
        <div class="field span-2"><label>CPF / CNPJ do responsável</label><input id="proc-payer-document" value="${String(base.payer_document||'').replace(/"/g,'&quot;')}" placeholder="Somente números ou formatado"></div>
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

  async function saveFinance(processId){
    const db=atlasDb();
    const hourlyRate=brMoneyToNumber(document.getElementById('proc-hourly-rate')?.value);
    const hours=brMoneyToNumber(document.getElementById('proc-hours')?.value);
    const feeAmount=brMoneyToNumber(document.getElementById('proc-registry-fee')?.value);
    const paymentStatus=document.getElementById('proc-payment-status')?.value||'pending';
    const dueDate=document.getElementById('proc-payment-due')?.value||null;
    const payerName=document.getElementById('proc-payer-name')?.value.trim()||null;
    const payerType=document.getElementById('proc-payer-type')?.value||null;
    const payerDocument=document.getElementById('proc-payer-document')?.value.trim()||null;
    const paidAt=paymentStatus==='paid'?new Date().toISOString().slice(0,10):null;

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
        payment_status:paymentStatus,
        paid_at:paidAt,
        due_date:dueDate,
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
        payment_status:paymentStatus,
        paid_at:paidAt,
        due_date:dueDate,
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
  }

  window.openProcessModal = async function(id=''){
    await previousOpen(id);
    const form=document.getElementById('process-real-form');
    if(!form)return;

    let existing=[];
    if(id){
      const {data}=await atlasDb().from('costs').select('*').eq('process_id',id);
      existing=data||[];
    }
    injectFinance(form,existing);

    const cloned=form.cloneNode(true);
    form.replaceWith(cloned);
    injectFinance(cloned,existing);

    // Reativa cadastro rápido de empresa quando o processo é novo.
    if(!id){
      document.getElementById('quick-company-toggle')?.addEventListener('click',()=>document.getElementById('quick-company-panel')?.classList.toggle('hidden'));
      document.getElementById('quick-company-close')?.addEventListener('click',()=>document.getElementById('quick-company-panel')?.classList.toggle('hidden'));
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