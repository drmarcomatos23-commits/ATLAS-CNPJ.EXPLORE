(() => {
  let financeChannel=null;

  function e(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function m(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function d(v){if(!v)return '—'; const x=new Date(v+'T12:00:00'); return Number.isNaN(x.getTime())?'—':x.toLocaleDateString('pt-BR')}
  function paymentLabel(v){return v==='paid'?'Pago':'Não pago'}
  function typeLabel(c){
    if(c.fee_kind==='honorarios'||c.cost_type==='hourly')return 'Honorários';
    if(c.fee_kind==='junta_cartorio'||c.cost_type==='registry_fee')return 'Junta / Cartório';
    return c.cost_type||'Custo';
  }

  async function loadFinance(){
    const db=atlasDb();
    const [costsRes,processRes,clientsRes,docsRes]=await Promise.all([
      db.from('costs').select('*'),
      db.from('processes').select('id,public_code,title,client_id,status,due_date').order('created_at',{ascending:false}),
      db.from('clients').select('id,legal_name,tax_id'),
      db.from('documents').select('id,name,category,process_id,created_at').order('created_at',{ascending:false})
    ]);
    return {
      costs:costsRes.error?[]:(costsRes.data||[]),
      processes:processRes.error?[]:(processRes.data||[]),
      clients:clientsRes.error?[]:(clientsRes.data||[]),
      docs:docsRes.error?[]:(docsRes.data||[])
    };
  }

  function attachmentFor(data,cost){
    const category=(cost.fee_kind==='honorarios'||cost.cost_type==='hourly')
      ? 'Financeiro · Honorários'
      : 'Financeiro · Taxa Junta/Cartório';
    return data.docs.find(x=>x.process_id===cost.process_id&&x.category===category)||null;
  }

  window.costPage=async function(){
    setHead('Custos e taxas','FINANCEIRO','Honorários, taxas, vencimentos, responsáveis e comprovantes vinculados aos processos.');
    page('<div class="loading-box"><span class="spinner"></span><div>Carregando financeiro...</div></div>');

    const data=await loadFinance();
    const pm=new Map(data.processes.map(p=>[p.id,p]));
    const cm=new Map(data.clients.map(c=>[c.id,c]));
    const total=data.costs.reduce((s,c)=>s+Number(c.amount||0),0);
    const paid=data.costs.filter(c=>c.payment_status==='paid').reduce((s,c)=>s+Number(c.amount||0),0);
    const pending=total-paid;
    const overdue=data.costs.filter(c=>c.payment_status!=='paid'&&c.due_date&&new Date(c.due_date+'T23:59:59')<new Date()).length;

    const rows=data.costs.map(c=>{
      const p=pm.get(c.process_id)||{};
      const client=cm.get(p.client_id)||{};
      const doc=attachmentFor(data,c);
      return `<tr>
        <td><strong>${e(p.public_code||'—')}</strong><div class="muted">${e(p.title||'Processo')}</div></td>
        <td><strong>${e(client.legal_name||'—')}</strong><div class="muted">${e(client.tax_id||'')}</div></td>
        <td>${e(typeLabel(c))}<div class="muted">${e(c.description||'')}</div></td>
        <td>${c.hourly_rate?'<span class="muted">'+m(c.hourly_rate)+'/h · '+e(c.hours||0)+'h</span><br>':''}<strong>${m(c.amount)}</strong></td>
        <td>${c.payment_status==='paid'?'<span class="pill ok">Pago</span>':'<span class="pill warn">Não pago</span>'}</td>
        <td>${d(c.due_date)}</td>
        <td><strong>${e(c.payer_name||'—')}</strong><div class="muted">${e([c.payer_type,c.payer_document].filter(Boolean).join(' · ')||'')}</div></td>
        <td>${doc?`<button class="mini-btn" onclick="openStoredDocument('${doc.id}')">Abrir anexo</button><div class="muted" style="margin-top:4px">${e(doc.name)}</div>`:'<span class="muted">Sem anexo</span>'}</td>
        <td><button class="mini-btn" onclick="openProcessModal('${c.process_id}')">Editar processo</button></td>
      </tr>`;
    }).join('');

    page(`
      <div class="grid kpi-grid finance-kpis">
        <div class="surface kpi"><span class="kpi-label">Total lançado</span><strong>${m(total)}</strong><small>Honorários e taxas</small></div>
        <div class="surface kpi"><span class="kpi-label">Pago</span><strong>${m(paid)}</strong><small>Valores quitados</small></div>
        <div class="surface kpi"><span class="kpi-label">Pendente</span><strong>${m(pending)}</strong><small>Aguardando pagamento</small></div>
        <div class="surface kpi"><span class="kpi-label">Vencidos</span><strong>${overdue}</strong><small>Pagamentos em atraso</small></div>
      </div>
      <section class="surface pad" style="margin-top:16px">
        <div class="section-head">
          <div><h2>Custos dos processos</h2><span>${data.costs.length} lançamento(s)</span></div>
          <button class="btn btn-primary" onclick="openProcessModal()">＋ Novo processo</button>
        </div>
        ${data.costs.length
          ? `<div class="table-wrap"><table><thead><tr><th>Processo</th><th>Empresa</th><th>Tipo</th><th>Valor</th><th>Pagamento</th><th>Vencimento</th><th>Responsável</th><th>Guia / boleto</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`
          : '<div class="empty-state"><div class="empty-icon">R$</div><h3>Nenhum custo cadastrado</h3><p>Preencha honorários ou taxas dentro de um processo. O lançamento aparecerá aqui automaticamente.</p></div>'
        }
      </section>
    `);

    startFinanceRealtime();
  };

  function startFinanceRealtime(){
    const db=atlasDb();
    if(!db||financeChannel)return;
    financeChannel=db.channel('atlas-costs-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'costs'},()=>{
        const active=document.querySelector('#nav [data-page].active')?.dataset?.page;
        if(active==='custos') window.costPage();
      })
      .subscribe();
  }
})();