(() => {
  window.dashboard=async function(){
    setHead('Dashboard','VISÃO GERAL','Acompanhe processos, licenças, empresas, honorários, taxas e vencimentos em um único painel.');
    page('<div class="loading-box"><span class="spinner"></span><div>Carregando dados operacionais...</div></div>');
    const data=await loadOperationalData();
    const procs=decorateProcesses(data);
    const active=procs.filter(p=>!['completed','cancelled'].includes(p.status));
    const licenseAttention=data.licenses.filter(l=>{
      if(!l.expires_at||l.status==='not_applicable')return false;
      const exp=new Date(l.expires_at+'T12:00:00');
      return exp<=new Date(Date.now()+90*86400000);
    }).length;
    const companies=data.clients.length;

    const isHonorario=c=>c?.fee_kind==='honorarios'||c?.cost_type==='hourly';
    const honorarios=data.costs.filter(isHonorario);
    const taxas=data.costs.filter(c=>!isHonorario(c));
    const honorariosTotal=honorarios.reduce((s,c)=>s+(Number(c.amount)||0),0);
    const honorariosRecebidos=honorarios.filter(c=>c.payment_status==='paid').reduce((s,c)=>s+(Number(c.amount)||0),0);
    const honorariosAReceber=Math.max(0,honorariosTotal-honorariosRecebidos);
    const taxasTotal=taxas.reduce((s,c)=>s+(Number(c.amount)||0),0);
    const taxasPagas=taxas.filter(c=>c.payment_status==='paid').reduce((s,c)=>s+(Number(c.amount)||0),0);
    const taxasAPagar=Math.max(0,taxasTotal-taxasPagas);

    const recent=procs.slice(0,6);
    const upcoming=data.licenses
      .filter(l=>l.expires_at&&l.status!=='not_applicable')
      .sort((a,b)=>String(a.expires_at).localeCompare(String(b.expires_at)))
      .slice(0,5);

    page(`<div class="grid kpi-grid">
      <div class="surface kpi"><span class="kpi-label">Processos ativos</span><strong>${active.length}</strong><small>Registros reais em andamento</small></div>
      <div class="surface kpi"><span class="kpi-label">Licenças em atenção</span><strong>${licenseAttention}</strong><small>Vencimentos em até 90 dias</small></div>
      <div class="surface kpi"><span class="kpi-label">Empresas cadastradas</span><strong>${companies}</strong><small>Empresas monitoradas</small></div>
      <div class="surface kpi"><span class="kpi-label">Honorários a receber</span><strong>${money(honorariosAReceber)}</strong><small>Recebidos: ${money(honorariosRecebidos)} · Total: ${money(honorariosTotal)}</small></div>
    </div>
    <div class="grid kpi-grid" style="margin-top:16px">
      <div class="surface kpi"><span class="kpi-label">Taxas a pagar</span><strong>${money(taxasAPagar)}</strong><small>Pagas: ${money(taxasPagas)} · Total: ${money(taxasTotal)}</small></div>
    </div>
    <div class="grid two-col" style="margin-top:16px">
      <section class="surface pad"><div class="section-head"><h2>Processos recentes</h2><span>Dados do Supabase</span></div>
        ${recent.length?realProcessTable(recent,false):emptyState('Nenhum processo cadastrado','Crie a primeira empresa e depois o primeiro processo.',canEditOps()?'<button class="btn btn-primary" onclick="openProcessModal()">＋ Novo processo</button>':'')}
      </section>
      <section class="surface pad"><div class="section-head"><h2>Vencimentos de licenças</h2><span>Próximos alertas</span></div>
        ${upcoming.length?'<div class="alert-list">'+upcoming.map(l=>`<div class="alert-item"><div><strong>${esc(l.name)}</strong><div class="muted" style="font-size:10px;margin-top:3px">${esc(clientNameById(data.clients,l.client_id))}</div></div><div class="date">${fmtDateBR(l.expires_at)}</div></div>`).join('')+'</div>':'<div class="muted" style="padding:18px 0;font-size:11px">Nenhum vencimento de licença cadastrado.</div>'}
      </section>
    </div>`);
  };
})();
