(() => {
  const previousReportsPage = window.reportsPage;

  function escR(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtDate(v){
    if(!v)return '—';
    const d=new Date(String(v).includes('T')?v:v+'T12:00:00');
    return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR');
  }
  function moneyR(v){
    return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }
  function periodRange(kind){
    const end=new Date();
    const start=new Date(end);
    if(kind==='weekly') start.setDate(end.getDate()-6);
    else start.setMonth(end.getMonth()-1);
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);
    return {start,end};
  }
  function within(v,start,end){
    if(!v)return false;
    const d=new Date(v);
    return !Number.isNaN(d.getTime()) && d>=start && d<=end;
  }

  async function collectReportData(period){
    const db=atlasDb();
    const {start,end}=periodRange(period);
    const [procRes,clientRes,costRes,licenseRes,protocolRes,docRes,partnerRes]=await Promise.all([
      db.from('processes').select('*').order('created_at',{ascending:false}),
      db.from('clients').select('*').order('legal_name',{ascending:true}),
      db.from('costs').select('*'),
      db.from('licenses').select('*').order('expires_at',{ascending:true}),
      db.from('protocols').select('*'),
      db.from('documents').select('id,name,category,client_id,process_id,created_at'),
      db.from('client_partners').select('*').order('full_name',{ascending:true})
    ]);
    const processes=(procRes.data||[]).filter(p=>within(p.created_at,start,end)||!['completed','cancelled'].includes(p.status));
    const processIds=new Set(processes.map(p=>p.id));
    return {
      start,end,processes,
      clients:clientRes.data||[],
      costs:(costRes.data||[]).filter(c=>processIds.has(c.process_id)),
      licenses:licenseRes.data||[],
      protocols:(protocolRes.data||[]).filter(p=>processIds.has(p.process_id)),
      documents:(docRes.data||[]).filter(d=>!d.process_id||processIds.has(d.process_id)),
      partners:partnerRes.data||[]
    };
  }

  function processSummary(data){
    const now=new Date();
    const items=data.processes||[];
    const completed=items.filter(p=>p.status==='completed').length;
    const open=items.filter(p=>p.status==='open').length;
    const inProgress=items.filter(p=>p.status==='in_progress').length;
    const overdue=items.filter(p=>p.status!=='completed'&&p.status!=='cancelled'&&p.due_date&&new Date(p.due_date+'T23:59:59')<now).length;
    const cards=[
      ['Total de processos',items.length,'total'],
      ['Abertos',open,'open'],
      ['Em andamento',inProgress,'progress'],
      ['Concluídos',completed,'done'],
      ['Vencidos',overdue,'overdue']
    ];
    return `<div class="process-summary">${cards.map(([label,value,tone])=>`<div class="summary-card ${tone}"><span>${escR(label)}</span><strong>${value}</strong></div>`).join('')}</div>`;
  }

  function statusClass(status){
    if(status==='completed')return 'is-done';
    if(status==='in_progress')return 'is-progress';
    if(status==='open')return 'is-open';
    if(status==='cancelled')return 'is-cancelled';
    return 'is-neutral';
  }

  function procTable(data){
    const cm=new Map(data.clients.map(c=>[c.id,c]));
    const now=new Date();
    return `<table class="report-table process-table"><thead><tr><th>Código</th><th>Empresa</th><th>Processo</th><th>Status</th><th>Prazo</th></tr></thead><tbody>${data.processes.length
      ? data.processes.map(p=>{
          const overdue=p.status!=='completed'&&p.status!=='cancelled'&&p.due_date&&new Date(p.due_date+'T23:59:59')<now;
          return `<tr><td class="process-code">${escR(p.public_code)}</td><td>${escR(cm.get(p.client_id)?.legal_name||'—')}</td><td>${escR(p.title)}</td><td><span class="report-status ${statusClass(p.status)}">${escR(statusLabel(p.status))}</span></td><td class="${overdue?'due-overdue':''}">${fmtDate(p.due_date)}</td></tr>`;
        }).join('')
      : '<tr><td colspan="5" class="empty-row">Nenhum processo no período.</td></tr>'}</tbody></table>`;
  }

  function financeSection(data){
    const pm=new Map(data.processes.map(p=>[p.id,p]));
    const total=data.costs.reduce((s,c)=>s+Number(c.amount||0),0);
    const paid=data.costs.filter(c=>c.payment_status==='paid').reduce((s,c)=>s+Number(c.amount||0),0);
    const pending=total-paid;
    return `<h2>Financeiro</h2>
      <div class="summary-grid"><div><b>Total</b><span>${moneyR(total)}</span></div><div><b>Pago</b><span>${moneyR(paid)}</span></div><div><b>Pendente</b><span>${moneyR(pending)}</span></div></div>
      <table><thead><tr><th>Processo</th><th>Descrição</th><th>Valor</th><th>Pagamento</th><th>Vencimento</th><th>Pago em</th><th>Responsável</th><th>CPF/CNPJ</th></tr></thead><tbody>${data.costs.length
        ? data.costs.map(c=>`<tr><td class="process-code">${escR(pm.get(c.process_id)?.public_code||'—')}</td><td>${escR(c.description)}</td><td><b>${moneyR(c.amount)}</b></td><td>${c.payment_status==='paid'?'<span class="report-status is-done">Pago</span>':'<span class="report-status is-progress">Não pago</span>'}</td><td>${fmtDate(c.due_date)}</td><td>${fmtDate(c.paid_at)}</td><td>${escR(c.payer_name||'—')}</td><td>${escR(c.payer_document||'—')}</td></tr>`).join('')
        : '<tr><td colspan="8" class="empty-row">Nenhum lançamento financeiro.</td></tr>'}</tbody></table>`;
  }

  function honorariosSection(data){
    const pm=new Map(data.processes.map(p=>[p.id,p]));
    const cm=new Map(data.clients.map(c=>[c.id,c]));
    const honorarios=data.costs.filter(c=>c.fee_kind==='honorarios'||c.cost_type==='hourly');
    const total=honorarios.reduce((s,c)=>s+Number(c.amount||0),0);
    const recebido=honorarios.filter(c=>c.payment_status==='paid').reduce((s,c)=>s+Number(c.amount||0),0);
    const aReceber=total-recebido;
    const vencido=honorarios.filter(c=>c.payment_status!=='paid'&&c.due_date&&new Date(c.due_date+'T23:59:59')<new Date()).reduce((s,c)=>s+Number(c.amount||0),0);
    const rows=honorarios.map(c=>{
      const p=pm.get(c.process_id)||{};
      const client=cm.get(p.client_id)||{};
      const boleto=data.documents.find(d=>d.process_id===c.process_id&&d.category==='Financeiro · Honorários');
      return `<tr><td class="process-code">${escR(p.public_code||'—')}</td><td>${escR(client.legal_name||'—')}</td><td>${escR(p.title||'—')}</td><td>${c.hourly_rate?moneyR(c.hourly_rate):'—'}</td><td>${c.hours??'—'}</td><td><b>${moneyR(c.amount)}</b></td><td>${c.payment_status==='paid'?'<span class="report-status is-done">Recebido</span>':'<span class="report-status is-progress">A receber</span>'}</td><td>${fmtDate(c.due_date)}</td><td>${fmtDate(c.paid_at)}</td><td>${escR(c.payer_name||'—')}</td><td>${escR(c.payer_document||'—')}</td><td>${escR(boleto?.name||'—')}</td></tr>`;
    }).join('');
    return `<h2>Honorários</h2><div class="summary-grid honor-summary"><div><b>Honorários faturados</b><span>${moneyR(total)}</span></div><div><b>Honorários recebidos</b><span>${moneyR(recebido)}</span></div><div><b>Honorários a receber</b><span>${moneyR(aReceber)}</span></div><div><b>Honorários vencidos</b><span>${moneyR(vencido)}</span></div></div><table><thead><tr><th>Processo</th><th>Empresa</th><th>Descrição</th><th>Valor/h</th><th>Horas</th><th>Total</th><th>Situação</th><th>Vencimento</th><th>Recebido em</th><th>Pagador</th><th>CPF/CNPJ</th><th>Boleto</th></tr></thead><tbody>${honorarios.length?rows:'<tr><td colspan="12" class="empty-row">Nenhum honorário no período.</td></tr>'}</tbody></table>`;
  }

  function generalSection(data){
    const cm=new Map(data.clients.map(c=>[c.id,c]));
    return `<h2>Empresas</h2><table><thead><tr><th>Empresa</th><th>CNPJ</th><th>IE</th><th>IM</th><th>Cidade/UF</th></tr></thead><tbody>${data.clients.length
      ? data.clients.map(c=>`<tr><td>${escR(c.legal_name)}</td><td>${escR(c.tax_id||'—')}</td><td>${escR(c.state_registration||'—')}</td><td>${escR(c.municipal_registration||'—')}</td><td>${escR([c.city,c.state].filter(Boolean).join('/')||'—')}</td></tr>`).join('')
      : '<tr><td colspan="5" class="empty-row">Nenhuma empresa cadastrada.</td></tr>'}</tbody></table>
      <h2>Sócios</h2><table><thead><tr><th>Empresa</th><th>Nome</th><th>CPF</th><th>Participação</th><th>Administrador</th></tr></thead><tbody>${data.partners.length
        ? data.partners.map(p=>`<tr><td>${escR(cm.get(p.client_id)?.legal_name||'—')}</td><td>${escR(p.full_name)}</td><td>${escR(p.cpf||'—')}</td><td>${p.ownership_percentage??'—'}%</td><td>${p.is_administrator?'Sim':'Não'}</td></tr>`).join('')
        : '<tr><td colspan="5" class="empty-row">Nenhum sócio cadastrado.</td></tr>'}</tbody></table>
      <h2>Licenças e documentos</h2><div class="summary-grid"><div><b>Licenças</b><span>${data.licenses.length}</span></div><div><b>Empresas</b><span>${data.clients.length}</span></div><div><b>Documentos</b><span>${data.documents.length}</span></div></div>`;
  }

  async function emitReport(period,composition){
    const data=await collectReportData(period);
    const label=period==='weekly'?'Semanal':'Mensal';
    const compLabel=composition==='processes'?'PROCESSOS':composition==='finance'?'PROCESSOS + FINANCEIRO':composition==='honorarios'?'HONORÁRIOS':'GERAL';
    const landscape=composition==='finance'||composition==='honorarios';
    const popup=window.open('','_blank');
    if(!popup){alert('Permita pop-ups para emitir o relatório.');return}
    const logoUrl=window.location.origin+'/logo-atlas-legalizacao.png';
    const reportContent=composition==='honorarios'?honorariosSection(data):`${processSummary(data)}<h2>Processos</h2>${procTable(data)}${composition!=='processes'?financeSection(data):''}${composition==='general'?generalSection(data):''}`;
    const body=`<main class="report-shell ${landscape?'landscape':'portrait'}"><header class="report-header"><div class="brand"><img src="${logoUrl}" class="report-logo" alt="ATLAS"><div><div class="eyebrow">RELATÓRIO INSTITUCIONAL</div><h1>ATLAS Legalização e Gerenciamento</h1><p>Relatório ${label} · ${compLabel}</p></div></div><div class="report-meta-card"><span>Período analisado</span><strong>${fmtDate(data.start)} a ${fmtDate(data.end)}</strong><small>Emitido em ${new Date().toLocaleString('pt-BR')}</small></div></header>${reportContent}<footer class="footer"><span>ATLAS Legalização e Gerenciamento</span><span>Relatório ${label} · ${compLabel}</span></footer></main>`;
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório ATLAS</title><style>
      :root{--navy:#0b2945;--teal:#079e9c;--ink:#17324a;--muted:#6b7f91;--line:#dfe7ed;--soft:#f5f8fa;--danger:#b42318;--danger-bg:#fff0ed;--done:#176b46;--done-bg:#eaf7f0;--progress:#8a5a00;--progress-bg:#fff4d6;--open:#2457a6;--open-bg:#edf3ff}
      *{box-sizing:border-box}body{font-family:Inter,Segoe UI,Arial,sans-serif;color:var(--ink);margin:0;background:#eef3f6;font-size:12px;line-height:1.42}.report-toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:flex-end;padding:12px 24px;background:rgba(238,243,246,.96);border-bottom:1px solid #dce5eb}.report-toolbar button{border:0;border-radius:9px;background:var(--navy);color:#fff;font-weight:700;padding:10px 16px;cursor:pointer;box-shadow:0 4px 12px rgba(11,41,69,.16)}.report-shell{max-width:1240px;margin:22px auto;background:#fff;padding:28px 30px 20px;box-shadow:0 10px 34px rgba(11,41,69,.10);border-radius:14px}.report-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:28px;border-bottom:3px solid var(--teal);padding-bottom:18px;margin-bottom:22px}.brand{display:flex;align-items:center;gap:16px}.report-logo{width:74px;height:68px;object-fit:contain}.eyebrow{font-size:9px;letter-spacing:.14em;font-weight:800;color:var(--teal);margin-bottom:4px}h1{font-size:24px;line-height:1.1;color:#071d31;margin:0 0 5px;font-weight:800}h2{font-size:15px;color:var(--navy);margin:26px 0 10px;padding-left:10px;border-left:4px solid var(--teal)}p{margin:0;color:var(--muted);font-size:12px}.report-meta-card{min-width:220px;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-align:right}.report-meta-card span,.report-meta-card small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.06em}.report-meta-card strong{display:block;color:var(--navy);font-size:13px;margin:4px 0 7px}.process-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:0 0 22px}.summary-card{border:1px solid var(--line);border-radius:11px;padding:11px 12px;background:#fff}.summary-card span{display:block;color:var(--muted);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.summary-card strong{display:block;color:var(--navy);font-size:20px;margin-top:4px}.summary-card.overdue{background:var(--danger-bg);border-color:#ffd5cc}.summary-card.overdue strong{color:var(--danger)}table{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:18px;border:1px solid var(--line);border-radius:10px;overflow:hidden}th,td{border:0;border-bottom:1px solid var(--line);padding:8px 9px;text-align:left;vertical-align:top}th{background:var(--navy);color:#fff;font-size:9px;text-transform:uppercase;letter-spacing:.045em;font-weight:800}tbody tr:nth-child(even){background:#f8fafb}tbody tr:last-child td{border-bottom:0}.process-code{font-weight:800;color:var(--navy);white-space:nowrap}.empty-row{text-align:center;color:var(--muted);padding:18px}.due-overdue{color:var(--danger);font-weight:800}.report-status{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:9px;font-weight:800;white-space:nowrap}.report-status.is-done{background:var(--done-bg);color:var(--done)}.report-status.is-progress{background:var(--progress-bg);color:var(--progress)}.report-status.is-open{background:var(--open-bg);color:var(--open)}.report-status.is-cancelled,.report-status.is-neutral{background:#eef2f5;color:#526777}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0 18px}.summary-grid.honor-summary{grid-template-columns:repeat(4,1fr)}.summary-grid div{border:1px solid var(--line);border-radius:10px;padding:11px;background:var(--soft)}.summary-grid b{display:block;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.summary-grid span{display:block;font-size:17px;font-weight:800;color:var(--navy);margin-top:3px}.footer{display:flex;justify-content:space-between;gap:16px;margin-top:28px;border-top:1px solid var(--line);padding-top:10px;color:#7b8d9b;font-size:9px}@page{size:A4 portrait;margin:11mm}.landscape{--page-orientation:landscape}
      @media print{@page{size:A4 portrait;margin:10mm}body:has(.report-shell.landscape){page:atlas-landscape}@page atlas-landscape{size:A4 landscape;margin:9mm}body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report-toolbar{display:none!important}.report-shell{max-width:none;margin:0;padding:0;box-shadow:none;border-radius:0}.report-header{margin-bottom:16px}.process-summary{gap:6px}.summary-card{padding:8px 9px}h2{margin-top:18px}thead{display:table-header-group}tfoot{display:table-footer-group}tr,.summary-card,.report-meta-card{break-inside:avoid;page-break-inside:avoid}table{break-inside:auto}tbody tr:nth-child(even){background:#f8fafb!important}.footer{break-inside:avoid}}
      @media(max-width:760px){.report-shell{margin:0;padding:18px 14px;border-radius:0}.report-header{grid-template-columns:1fr}.report-meta-card{text-align:left}.process-summary{grid-template-columns:repeat(2,1fr)}.summary-grid,.summary-grid.honor-summary{grid-template-columns:1fr 1fr}table{font-size:10px;display:block;overflow-x:auto}.report-toolbar{padding:8px 12px}}
    </style></head><body><div class="report-toolbar"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>${body}</body></html>`);
    popup.document.close();
  }

  window.emitAtlasReportV4=emitReport;
  window.emitAtlasReport=emitReport;
  window.reportsPage=async function(){
    if(typeof previousReportsPage==='function') await previousReportsPage();
    const oldBtn=document.getElementById('report-emit-btn');
    if(!oldBtn)return;
    const btn=oldBtn.cloneNode(true);
    oldBtn.replaceWith(btn);
    btn.addEventListener('click',()=>{
      emitReport(document.getElementById('report-period')?.value||'monthly',document.getElementById('report-composition')?.value||'processes');
    });
  };
})();