(() => {
  let financeChannel=null;

  function e(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function m(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function d(v){if(!v)return '—'; const x=new Date(v+'T12:00:00'); return Number.isNaN(x.getTime())?'—':x.toLocaleDateString('pt-BR')}
  function paymentLabel(v){return v==='paid'?'Pago':'Não pago'}
  function isHonorario(c){return c?.fee_kind==='honorarios'||c?.cost_type==='hourly'}
  function typeLabel(c){
    if(isHonorario(c))return 'Honorários';
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
    const category=isHonorario(cost)
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
    const honorarios=data.costs.filter(isHonorario);
    const honorariosTotal=honorarios.reduce((s,c)=>s+Number(c.amount||0),0);
    const honorariosRecebidos=honorarios.filter(c=>c.payment_status==='paid').reduce((s,c)=>s+Number(c.amount||0),0);
    const honorariosAReceber=honorariosTotal-honorariosRecebidos;
    const honorariosVencidos=honorarios.filter(c=>c.payment_status!=='paid'&&c.due_date&&new Date(c.due_date+'T23:59:59')<new Date()).reduce((s,c)=>s+Number(c.amount||0),0);

    const taxas=data.costs.filter(c=>!isHonorario(c));
    const taxasTotal=taxas.reduce((s,c)=>s+Number(c.amount||0),0);
    const taxasPagas=taxas.filter(c=>c.payment_status==='paid').reduce((s,c)=>s+Number(c.amount||0),0);
    const taxasAPagar=taxasTotal-taxasPagas;
    const taxasVencidas=taxas.filter(c=>c.payment_status!=='paid'&&c.due_date&&new Date(c.due_date+'T23:59:59')<new Date()).reduce((s,c)=>s+Number(c.amount||0),0);

    const honorariosRows=honorarios.map(c=>{
      const p=pm.get(c.process_id)||{};
      const client=cm.get(p.client_id)||{};
      const doc=attachmentFor(data,c);
      return `<tr>
        <td><strong>${e(p.public_code||'—')}</strong><div class="muted">${e(p.title||'Processo')}</div></td>
        <td><strong>${e(client.legal_name||'—')}</strong></td>
        <td><strong>${m(c.amount)}</strong><div class="muted">${c.hourly_rate?m(c.hourly_rate)+'/h · '+e(c.hours||0)+'h':''}</div></td>
        <td>${c.payment_status==='paid'?'<span class="pill ok">Recebido</span>':'<span class="pill warn">A receber</span>'}</td>
        <td>${d(c.due_date)}</td>
        <td>${c.paid_at?d(c.paid_at):'—'}</td>
        <td><strong>${e(c.payer_name||'—')}</strong><div class="muted">${e([c.payer_type,c.payer_document].filter(Boolean).join(' · ')||'')}</div></td>
        <td>${doc?`<button class="mini-btn" onclick="openStoredDocument('${doc.id}')">Abrir boleto</button>`:'<span class="muted">Sem boleto</span>'}</td>
        <td>
          <div class="row-actions">
            ${c.payment_status==='paid'
              ? `<button class="mini-btn" onclick="setHonorarioRecebido('${c.id}',false)">Voltar p/ pendente</button>`
              : `<button class="mini-btn" onclick="setHonorarioRecebido('${c.id}',true)">Marcar recebido</button>`}
            <button class="mini-btn" onclick="openProcessModal('${c.process_id}')">Editar</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    const rows=taxas.map(c=>{
      const p=pm.get(c.process_id)||{};
      const client=cm.get(p.client_id)||{};
      const doc=attachmentFor(data,c);
      return `<tr>
        <td><strong>${e(p.public_code||'—')}</strong><div class="muted">${e(p.title||'Processo')}</div></td>
        <td><strong>${e(client.legal_name||'—')}</strong><div class="muted">${e(client.tax_id||'')}</div></td>
        <td>${e(typeLabel(c))}<div class="muted">${e(c.description||'')}</div></td>
        <td>${c.hourly_rate?'<span class="muted">'+m(c.hourly_rate)+'/h · '+e(c.hours||0)+'h</span><br>':''}<strong>${m(c.amount)}</strong></td>
        <td>${c.payment_status==='paid'?'<span class="pill ok">Paga</span>':'<span class="pill warn">A pagar</span>'}</td>
        <td>${d(c.due_date)}</td>
        <td><strong>${e(c.payer_name||'—')}</strong><div class="muted">${e([c.payer_type,c.payer_document].filter(Boolean).join(' · ')||'')}</div></td>
        <td>${doc?`<button class="mini-btn" onclick="openStoredDocument('${doc.id}')">Abrir anexo</button><div class="muted" style="margin-top:4px">${e(doc.name)}</div>`:'<span class="muted">Sem anexo</span>'}</td>
        <td><button class="mini-btn" onclick="openProcessModal('${c.process_id}')">Editar processo</button></td>
      </tr>`;
    }).join('');

    page(`
      <section class="surface pad honorarios-control">
        <div class="section-head">
          <div><h2>Controle de honorários recebidos</h2><span>${honorarios.length} lançamento(s) de honorários</span></div>
        </div>
        <div class="grid kpi-grid finance-kpis" style="margin-bottom:16px">
          <div class="surface kpi"><span class="kpi-label">Honorários faturados</span><strong>${m(honorariosTotal)}</strong><small>Total lançado</small></div>
          <div class="surface kpi"><span class="kpi-label">Honorários recebidos</span><strong>${m(honorariosRecebidos)}</strong><small>Já quitados</small></div>
          <div class="surface kpi"><span class="kpi-label">Honorários a receber</span><strong>${m(honorariosAReceber)}</strong><small>Pendentes</small></div>
          <div class="surface kpi"><span class="kpi-label">Honorários vencidos</span><strong>${m(honorariosVencidos)}</strong><small>Em atraso</small></div>
        </div>
        ${honorarios.length
          ? `<div class="table-wrap"><table><thead><tr><th>Processo</th><th>Empresa</th><th>Honorários</th><th>Situação</th><th>Vencimento</th><th>Recebido em</th><th>Pagador</th><th>Boleto</th><th>Ações</th></tr></thead><tbody>${honorariosRows}</tbody></table></div>`
          : '<div class="muted" style="padding:18px 0">Nenhum honorário lançado nos processos.</div>'}
      </section>

      <div class="grid kpi-grid finance-kpis" style="margin-top:16px">
        <div class="surface kpi"><span class="kpi-label">Taxas lançadas</span><strong>${m(taxasTotal)}</strong><small>Total de despesas cadastradas</small></div>
        <div class="surface kpi"><span class="kpi-label">Taxas pagas</span><strong>${m(taxasPagas)}</strong><small>Despesas já quitadas</small></div>
        <div class="surface kpi"><span class="kpi-label">Taxas a pagar</span><strong>${m(taxasAPagar)}</strong><small>Obrigações pendentes</small></div>
        <div class="surface kpi"><span class="kpi-label">Taxas vencidas</span><strong>${m(taxasVencidas)}</strong><small>Despesas em atraso</small></div>
      </div>
      <section class="surface pad" style="margin-top:16px">
        <div class="section-head">
          <div><h2>Taxas dos processos</h2><span>${taxas.length} lançamento(s)</span></div>
          <button class="btn btn-primary" onclick="openProcessModal()">＋ Novo processo</button>
        </div>
        ${taxas.length
          ? `<div class="table-wrap"><table><thead><tr><th>Processo</th><th>Empresa</th><th>Tipo</th><th>Valor</th><th>Situação</th><th>Vencimento</th><th>Responsável</th><th>Guia / boleto</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`
          : '<div class="empty-state"><div class="empty-icon">R$</div><h3>Nenhuma taxa cadastrada</h3><p>Cadastre as taxas dentro dos processos. Elas serão tratadas como valores a pagar.</p></div>'
        }
      </section>
    `);

    startFinanceRealtime();
  };

  window.setHonorarioRecebido=async function(costId,received){
    const db=atlasDb();
    const patch={
      payment_status:received?'paid':'pending',
      paid_at:received?new Date().toISOString().slice(0,10):null
    };
    const {error}=await db.from('costs').update(patch).eq('id',costId);
    if(error){
      alert('Não foi possível atualizar o recebimento: '+error.message);
      return;
    }
    await window.costPage();
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