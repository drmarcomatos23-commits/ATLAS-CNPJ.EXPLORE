(() => {
  window.dashboard=async function(){
    setHead('Dashboard','VISÃO GERAL','Acompanhe processos, licenças, empresas, custos e vencimentos em um único painel.');
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
    const costTotal=data.costs.reduce((s,c)=>s+(Number(c.amount)||0),0);
    const recent=procs.slice(0,6);
    const upcoming=data.licenses
      .filter(l=>l.expires_at&&l.status!=='not_applicable')
      .sort((a,b)=>String(a.expires_at).localeCompare(String(b.expires_at)))
      .slice(0,5);

    page(`<div class="grid kpi-grid">
      <div class="surface kpi"><span class="kpi-label">Processos ativos</span><strong>${active.length}</strong><small>Registros reais em andamento</small></div>
      <div class="surface kpi"><span class="kpi-label">Licenças em atenção</span><strong>${licenseAttention}</strong><small>Vencimentos em até 90 dias</small></div>
      <div class="surface kpi"><span class="kpi-label">Empresas cadastradas</span><strong>${companies}</strong><small>Empresas monitoradas</small></div>
      <div class="surface kpi"><span class="kpi-label">Custos controlados</span><strong>${money(costTotal)}</strong><small>Honorários e taxas cadastrados</small></div>
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