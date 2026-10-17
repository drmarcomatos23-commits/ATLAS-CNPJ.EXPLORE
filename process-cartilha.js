
(function(){
  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function digits(v){ return String(v||'').replace(/\D/g,''); }
  function cnpj(v){
    var d=digits(v).slice(0,14);
    return d.length===14?d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/,'$1.$2.$3/$4-$5'):String(v||'');
  }
  function cpf(v){
    var d=digits(v).slice(0,11);
    return d.length===11?d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/,'$1.$2.$3-$4'):String(v||'');
  }
  function cep(v){
    var d=digits(v).slice(0,8);
    return d.length===8?d.replace(/^(\d{5})(\d{3}).*/,'$1-$2'):String(v||'');
  }
  function money(v){
    var n=Number(v);
    return Number.isFinite(n)&&n>0?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'';
  }
  function address(c){
    return [c.street,c.address_number,c.address_complement,c.neighborhood,[c.city,c.state].filter(Boolean).join('/'),c.postal_code?'CEP '+cep(c.postal_code):''].filter(Boolean).join(' · ');
  }
  function serviceMark(type,label){
    var ok=(label==='Abertura'&&['abertura','legalizacao_empresarial'].indexOf(type)>=0)
      ||(label==='Alteração'&&type==='alteracao_societaria')
      ||(label==='Baixa'&&type==='encerramento');
    return ok?'☒':'☐';
  }
  function partnerTable(p){
    p=p||{};
    var role=p.is_administrator?'Sócio(a)/Administrador(a)':'Sócio(a)';
    return '<table class="form-table partner-table">'
      +'<tr><th>'+esc(role)+'</th><td>'+esc(p.full_name||'')+'</td></tr>'
      +'<tr><th>CPF:</th><td>'+esc(cpf(p.cpf||''))+'</td></tr>'
      +'<tr><th>Endereço:</th><td>'+esc(p.address||'')+'</td></tr>'
      +'<tr><th>E-mail:</th><td>'+esc(p.email||'')+'</td></tr>'
      +'<tr><th>Contato:</th><td>'+esc(p.phone||'')+'</td></tr>'
      +'</table>';
  }
  function brand(){
    return '<div class="model-brand official-letterhead"><img src="/assets/oea-cartilha-logo.png?v=3.57" alt="OEA"></div>';
  }
  function styles(){
    return '<style>'
      +'@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e9eef2;font-family:Arial,Helvetica,sans-serif;color:#111}'
      +'.printbar{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 18px;background:#fff;border-bottom:1px solid #dbe3e9}'
      +'.printbar strong{color:#123b68}.printbar button{border:0;border-radius:9px;background:#0aa6a3;color:#fff;padding:10px 15px;font-weight:700;cursor:pointer}'
      +'.sheet{position:relative;width:210mm;min-height:297mm;margin:18px auto;background:#fff;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.12);page-break-after:always}'
      +'.sheet:last-child{page-break-after:auto}.shape-a,.shape-b,.shape-c,.shape-d{position:absolute;z-index:0;pointer-events:none}'
      +'.shape-a{left:-80px;top:-90px;width:310px;height:430px;background:linear-gradient(135deg,#d9eef7 10%,#f5fbfd 80%);transform:rotate(38deg)}'
      +'.shape-b{left:-45px;top:180px;width:320px;height:16px;background:#eff8ca;transform:rotate(-48deg);opacity:.8}'
      +'.shape-c{right:-135px;bottom:-110px;width:420px;height:290px;background:linear-gradient(145deg,#f8f6bd 0 22%,#cfeaf4 23% 55%,#e4effb 56%);transform:rotate(-18deg);opacity:.72}'
      +'.shape-d{right:-125px;bottom:90px;width:250px;height:16px;background:#d8eff7;transform:rotate(-30deg)}'
      +'.content{position:relative;z-index:2;padding:18mm 16mm}.model-brand{height:34mm;display:flex;justify-content:center;align-items:center;margin-bottom:3mm}.official-letterhead img{height:30mm;width:auto;max-width:58mm;display:block;object-fit:contain}'
      +'.oea-mark{display:none}'
      +'.oea-mark:before{display:none}'
      +'.model-names{display:none}h1{text-align:center;margin:0;color:#284f77;font-size:18pt;letter-spacing:.4px}'
      +'h2{text-align:center;margin:7mm 0 10mm;font-size:12.5pt}.service{font-weight:700;font-size:11.5pt;margin-bottom:8mm}.service span{margin-right:8mm}'
      +'.activity-note{font-size:9.5pt;margin:-3mm 0 8mm}.section-title{font-size:12pt;font-weight:700;color:#53677c;margin:0 0 5mm}'
      +'table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.84);margin-bottom:7mm;break-inside:avoid}th,td{border:1px solid #444;padding:2.7mm 2mm;font-size:9.6pt;vertical-align:top}'
      +'th{width:32%;text-align:left;font-weight:700}.activity{border:1px solid #444;padding:3mm;margin:0 0 8mm;min-height:18mm;background:rgba(255,255,255,.84);font-size:9.6pt;line-height:1.45}'
      +'.partner-table{margin-bottom:5mm}.declaration{margin-top:8mm;font-size:11.5pt;line-height:1.55;text-align:justify}.date-line{text-align:center;margin-top:14mm;font-size:11pt}'
      +'.signature{text-align:center;margin:30mm auto 0;width:95mm}.signature-line{border-top:1px solid #222;margin-bottom:3mm}.signature strong{display:block;font-size:10.5pt}.signature span{font-size:10.5pt}'
      +'@media print{body{background:#fff}.printbar{display:none}.sheet{margin:0;box-shadow:none}}@media(max-width:900px){.sheet{width:100%;min-height:auto;margin:0;box-shadow:none}.content{padding:18px}.service span{display:block;margin:5px 0}}'
      +'</style>';
  }
  function build(proc,company,partners,profile){
    var first=(partners||[]).slice(0,2);
    var rest=(partners||[]).slice(2);
    while(first.length<2)first.push({});
    var summary=proc.completion_summary||proc.title||'';
    var d=new Date();
    var dateText=d.getDate()+' de '+d.toLocaleDateString('pt-BR',{month:'long'})+' de '+d.getFullYear();
    var ie=company.state_registration?'( X ) Possui   (   ) Não Possui - nº '+esc(company.state_registration):'(   ) Possui   (   ) Não Possui - nº';
    var im=company.municipal_registration?'( X ) Possui   (   ) Não Possui - nº '+esc(company.municipal_registration):'(   ) Possui   (   ) Não Possui - nº';
    var html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+styles()+'<title>Cartilha - '+esc(proc.public_code||'Processo')+'</title></head><body>';
    html+='<div class="printbar"><div><strong>Cartilha de Encaminhamento Empresarial</strong><div style="font-size:12px;color:#718394">'+esc(proc.public_code||'')+' · '+esc(company.legal_name||'')+'</div></div><button onclick="window.print()">Imprimir / Salvar PDF</button></div>';
    html+='<section class="sheet"><div class="shape-a"></div><div class="shape-b"></div><div class="shape-c"></div><div class="shape-d"></div><div class="content">'+brand();
    html+='<h1>CARTILHA DE ENCAMINHAMENTO<br>EMPRESARIAL</h1><h2>PROCEDIMENTOS DE LEGALIZAÇÃO</h2>';
    html+='<div class="service">Tipo de Serviço: <span>'+serviceMark(proc.service_type,'Abertura')+' Abertura</span><span>'+serviceMark(proc.service_type,'Alteração')+' Alteração</span><span>'+serviceMark(proc.service_type,'Baixa')+' Baixa</span></div>';
    html+='<div class="activity-note"><strong>Atividade realizada:</strong> '+esc(summary)+'</div><div class="section-title">Dados da Empresa:</div>';
    html+='<table class="form-table"><tr><th>Qualificação</th><td>'+esc(company.legal_name||'')+'</td></tr><tr><th>CNPJ:</th><td>'+esc(cnpj(company.tax_id||''))+'</td></tr><tr><th>Capital Social:</th><td>'+esc(money(company.capital_social))+'</td></tr><tr><th>Endereço:</th><td>'+esc(address(company))+'</td></tr><tr><th>Inscrição Estadual</th><td>'+ie+'</td></tr><tr><th>Inscrição Municipal</th><td>'+im+'</td></tr><tr><th>E-mail:</th><td>'+esc(company.email||'')+'</td></tr></table>';
    html+='<div class="section-title">Quadro Societário:</div>'+first.map(partnerTable).join('')+'</div></section>';
    html+='<section class="sheet"><div class="shape-a"></div><div class="shape-b"></div><div class="shape-c"></div><div class="shape-d"></div><div class="content">'+brand();
    if(rest.length)html+='<div class="section-title">Quadro Societário - Continuação:</div>'+rest.map(partnerTable).join('');
    html+='<div class="section-title">Atividade realizada / conclusão:</div><div class="activity">'+esc(summary)+'</div>';
    html+='<p class="declaration">Declara-se, para os devidos fins, que os documentos societários da empresa, incluindo contrato social e comprovante de inscrição no CNPJ, seguem anexos a este documento para análise e registro junto à contabilidade.</p>';
    html+='<div class="date-line">'+esc(company.city||'Santos')+', '+esc(dateText)+';</div><div class="signature"><div class="signature-line"></div><strong>'+esc(profile&&profile.full_name||'Responsável')+'</strong><span>Responsável</span></div>';
    html+='</div></section></body></html>';
    return html;
  }
  window.emitirCartilha=async function(processId){
    if(typeof canEditOps==='function'&&!canEditOps()){
      alert('Seu perfil não possui permissão para emitir a cartilha.');
      return;
    }
    var popup=window.open('','_blank');
    if(!popup){
      alert('O navegador bloqueou a nova janela. Libere pop-ups para o ATLAS e tente novamente.');
      return;
    }
    popup.document.write('<div style="font-family:Arial;padding:30px">Gerando cartilha...</div>');
    try{
      var db=atlasDb();
      var pRes=await db.from('processes').select('*').eq('id',processId).single();
      if(pRes.error)throw pRes.error;
      var proc=pRes.data;
      if(proc.status!=='completed')throw new Error('A cartilha só pode ser emitida para processos concluídos.');
      var results=await Promise.all([
        db.from('clients').select('*').eq('id',proc.client_id).single(),
        db.from('client_partners').select('*').eq('client_id',proc.client_id).order('created_at',{ascending:true})
      ]);
      if(results[0].error)throw results[0].error;
      if(results[1].error)throw results[1].error;
      popup.document.open();
      popup.document.write(build(proc,results[0].data||{},results[1].data||[],atlasProfile()));
      popup.document.close();
    }catch(err){
      popup.document.open();
      popup.document.write('<div style="font-family:Arial;padding:30px;color:#a13f4d"><h2>Não foi possível emitir a cartilha</h2><p>'+esc(err&&err.message||err)+'</p></div>');
      popup.document.close();
    }
  };
})();