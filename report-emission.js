(() => {
  const previousReportsPage = window.reportsPage || reportsPage;

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
    const [
      procRes,clientRes,costRes,licenseRes,protocolRes,docRes,partnerRes
    ] = await Promise.all([
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
      start,end,
      processes,
      clients:clientRes.data||[],
      costs:(costRes.data||[]).filter(c=>processIds.has(c.process_id)),
      licenses:licenseRes.data||[],
      protocols:(protocolRes.data||[]).filter(p=>processIds.has(p.process_id)),
      documents:(docRes.data||[]).filter(d=>!d.process_id||processIds.has(d.process_id)),
      partners:partnerRes.data||[]
    };
  }

  function procTable(data){
    const cm=new Map(data.clients.map(c=>[c.id,c]));
    return `<table><thead><tr><th>Código</th><th>Empresa</th><th>Processo</th><th>Status</th><th>Prazo</th></tr></thead><tbody>${
      data.processes.length
      ? data.processes.map(p=>`<tr><td>${escR(p.public_code)}</td><td>${escR(cm.get(p.client_id)?.legal_name||'—')}</td><td>${escR(p.title)}</td><td>${escR(statusLabel(p.status))}</td><td>${fmtDate(p.due_date)}</td></tr>`).join('')
      : '<tr><td colspan="5">Nenhum processo no período.</td></tr>'
    }</tbody></table>`;
  }

  function financeSection(data){
    const pm=new Map(data.processes.map(p=>[p.id,p]));
    const total=data.costs.reduce((s,c)=>s+Number(c.amount||0),0);
    const paid=data.costs.filter(c=>c.payment_status==='paid').reduce((s,c)=>s+Number(c.amount||0),0);
    const pending=total-paid;
    return `
      <h2>Financeiro</h2>
      <div class="summary-grid"><div><b>Total</b><span>${moneyR(total)}</span></div><div><b>Pago</b><span>${moneyR(paid)}</span></div><div><b>Pendente</b><span>${moneyR(pending)}</span></div></div>
      <table><thead><tr><th>Processo</th><th>Descrição</th><th>Valor</th><th>Pagamento</th><th>Vencimento</th><th>Pago em</th><th>Responsável</th><th>CPF/CNPJ</th></tr></thead><tbody>${
        data.costs.length
        ? data.costs.map(c=>`<tr><td>${escR(pm.get(c.process_id)?.public_code||'—')}</td><td>${escR(c.description)}</td><td>${moneyR(c.amount)}</td><td>${c.payment_status==='paid'?'Pago':'Não pago'}</td><td>${fmtDate(c.due_date)}</td><td>${fmtDate(c.paid_at)}</td><td>${escR(c.payer_name||'—')}</td><td>${escR(c.payer_document||'—')}</td></tr>`).join('')
        : '<tr><td colspan="8">Nenhum lançamento financeiro.</td></tr>'
      }</tbody></table>`;
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
      return `<tr>
        <td>${escR(p.public_code||'—')}</td>
        <td>${escR(client.legal_name||'—')}</td>
        <td>${escR(p.title||'—')}</td>
        <td>${c.hourly_rate?moneyR(c.hourly_rate):'—'}</td>
        <td>${c.hours??'—'}</td>
        <td><b>${moneyR(c.amount)}</b></td>
        <td>${c.payment_status==='paid'?'RECEBIDO':'A RECEBER'}</td>
        <td>${fmtDate(c.due_date)}</td>
        <td>${fmtDate(c.paid_at)}</td>
        <td>${escR(c.payer_name||'—')}</td>
        <td>${escR(c.payer_document||'—')}</td>
        <td>${escR(boleto?.name||'—')}</td>
      </tr>`;
    }).join('');

    return `
      <h2>Honorários</h2>
      <div class="summary-grid honor-summary">
        <div><b>Honorários faturados</b><span>${moneyR(total)}</span></div>
        <div><b>Honorários recebidos</b><span>${moneyR(recebido)}</span></div>
        <div><b>Honorários a receber</b><span>${moneyR(aReceber)}</span></div>
        <div><b>Honorários vencidos</b><span>${moneyR(vencido)}</span></div>
      </div>
      <table>
        <thead><tr><th>Processo</th><th>Empresa</th><th>Descrição</th><th>Valor/h</th><th>Horas</th><th>Total</th><th>Situação</th><th>Vencimento</th><th>Recebido em</th><th>Pagador</th><th>CPF/CNPJ</th><th>Boleto</th></tr></thead>
        <tbody>${honorarios.length?rows:'<tr><td colspan="12">Nenhum honorário no período.</td></tr>'}</tbody>
      </table>`;
  }

  function generalSection(data){
    const cm=new Map(data.clients.map(c=>[c.id,c]));
    return `
      <h2>Empresas</h2>
      <table><thead><tr><th>Empresa</th><th>CNPJ</th><th>IE</th><th>IM</th><th>Cidade/UF</th></tr></thead><tbody>${
        data.clients.length
        ? data.clients.map(c=>`<tr><td>${escR(c.legal_name)}</td><td>${escR(c.tax_id||'—')}</td><td>${escR(c.state_registration||'—')}</td><td>${escR(c.municipal_registration||'—')}</td><td>${escR([c.city,c.state].filter(Boolean).join('/')||'—')}</td></tr>`).join('')
        : '<tr><td colspan="5">Nenhuma empresa cadastrada.</td></tr>'
      }</tbody></table>
      <h2>Sócios</h2>
      <table><thead><tr><th>Empresa</th><th>Nome</th><th>CPF</th><th>Participação</th><th>Administrador</th></tr></thead><tbody>${
        data.partners.length
        ? data.partners.map(p=>`<tr><td>${escR(cm.get(p.client_id)?.legal_name||'—')}</td><td>${escR(p.full_name)}</td><td>${escR(p.cpf||'—')}</td><td>${p.ownership_percentage??'—'}%</td><td>${p.is_administrator?'Sim':'Não'}</td></tr>`).join('')
        : '<tr><td colspan="5">Nenhum sócio cadastrado.</td></tr>'
      }</tbody></table>
      <h2>Licenças e documentos</h2>
      <div class="summary-grid"><div><b>Licenças</b><span>${data.licenses.length}</span></div><div><b>Empresas</b><span>${data.clients.length}</span></div><div><b>Documentos</b><span>${data.documents.length}</span></div></div>`;
  }

  async function emitReport(period,composition){
    const data=await collectReportData(period);
    const label=period==='weekly'?'Semanal':'Mensal';
    const compLabel=composition==='processes'?'PROCESSOS':composition==='finance'?'PROCESSOS + FINANCEIRO':composition==='honorarios'?'HONORÁRIOS':'GERAL';
    const popup=window.open('','_blank');
    if(!popup){alert('Permita pop-ups para emitir o relatório.');return}
    const logoUrl=window.location.origin+'/logo-atlas-legalizacao.png';
    const reportContent=composition==='honorarios'
      ? honorariosSection(data)
      : `<h2>Processos</h2>${procTable(data)}${composition!=='processes'?financeSection(data):''}${composition==='general'?generalSection(data):''}`;
    const body=`
      <div class="header">
        <div class="brand"><img src="${logoUrl}" class="report-logo" alt="ATLAS"><div><h1>ATLAS Legalização e Gerenciamento</h1><p>Relatório ${label} · ${compLabel}</p></div></div>
        <div class="period">Período<br><b>${fmtDate(data.start)} a ${fmtDate(data.end)}</b></div>
      </div>
      ${reportContent}
      <div class="footer">Emitido em ${new Date().toLocaleString('pt-BR')} · ATLAS Legalização e Gerenciamento</div>`;
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório ATLAS</title><style>
      body{font-family:Arial,sans-serif;color:#10263a;margin:28px;font-size:12px}
      .header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #079e9c;padding-bottom:14px;margin-bottom:22px}
      .brand{display:flex;align-items:center;gap:14px}.report-logo{width:82px;height:62px;object-fit:contain}
      h1{font-size:22px;margin:0 0 5px} h2{font-size:15px;margin:24px 0 9px}
      p{margin:0;color:#607589}.period{text-align:right;color:#607589}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}th,td{border:1px solid #d9e3ea;padding:7px;text-align:left;vertical-align:top}
      th{background:#f2f7fa;font-size:10px}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0 16px}.summary-grid.honor-summary{grid-template-columns:repeat(4,1fr)}
      .summary-grid div{border:1px solid #d9e3ea;border-radius:8px;padding:10px}.summary-grid b{display:block;font-size:10px;color:#607589}.summary-grid span{font-size:17px;font-weight:700}
      .footer{margin-top:28px;border-top:1px solid #d9e3ea;padding-top:10px;color:#718394;font-size:10px}
      @media print{body{margin:12mm}.no-print{display:none}}
    </style></head><body><button class="no-print" onclick="window.print()" style="float:right;margin-bottom:15px;padding:9px 14px">Imprimir / Salvar PDF</button>${body}</body></html>`);
    popup.document.close();
  }

  window.emitAtlasReport=emitReport;

  window.reportsPage=async function(){
    await previousReportsPage();
    const root=document.getElementById('page-content');
    if(!root)return;
    const controls=document.createElement('section');
    controls.className='surface pad report-emission-box';
    controls.innerHTML=`
      <div class="section-head"><div><h2>Emitir relatório</h2><span>Escolha período e composição</span></div></div>
      <div class="report-controls">
        <div class="field"><label>Periodicidade</label><select id="report-period"><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></div>
        <div class="field"><label>Composição</label><select id="report-composition"><option value="processes">PROCESSOS</option><option value="finance">PROCESSOS + FINANCEIRO</option><option value="general">GERAL</option><option value="honorarios">HONORÁRIOS</option></select></div>
        <div class="report-button-wrap"><button id="report-emit-btn" class="btn btn-primary">Emitir relatório</button></div>
      </div>`;
    root.prepend(controls);
    document.getElementById('report-emit-btn')?.addEventListener('click',()=>{
      emitReport(document.getElementById('report-period').value,document.getElementById('report-composition').value);
    });
  };
})();