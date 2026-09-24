const form = document.querySelector('#people-form');
const nameInput = document.querySelector('#person-name');
const cpfInput = document.querySelector('#person-cpf');
const cnpjsInput = document.querySelector('#person-cnpjs');
const submit = document.querySelector('#people-submit');
const output = document.querySelector('#people-results');
const searchMode = document.querySelector('#person-mode');
const searchStatus = document.querySelector('#person-search-status');
const digits = value => String(value || '').replace(/\D/g, '');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const formatCnpj = value => digits(value).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
function validCpf(value) {
  const d=digits(value);if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;
  const check=n=>{let total=0;for(let i=0;i<n;i++)total+=Number(d[i])*(n+1-i);return (total*10%11)%10;};
  return check(9)===Number(d[9])&&check(10)===Number(d[10]);
}
function validCnpj(value) {
  const d=digits(value);if(d.length!==14||/^(\d)\1{13}$/.test(d))return false;
  const calc=(base,weights)=>{const sum=[...base].reduce((n,x,i)=>n+Number(x)*weights[i],0);return sum%11<2?0:11-sum%11;};
  return calc(d.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2])===Number(d[12])&&calc(d.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(d[13]);
}
function candidates() {
  return [...new Set((cnpjsInput.value.match(/\d[\d.\/-]{12,20}\d/g)||[]).map(digits).filter(x=>x.length===14))];
}
function update() {
  const name=nameInput.value.trim(), cpf=digits(cpfInput.value), items=candidates();
  submit.disabled=!name || Boolean(cpf && !validCpf(cpf)) || (searchMode.value==='manual' && !items.length);
  cnpjsInput.closest('.people-manual-input').hidden=searchMode.value!=='manual';
}
searchMode.addEventListener('change',update);
[nameInput,cpfInput,cnpjsInput].forEach(el=>el.addEventListener('input',update));
const status = (value) => value === 'ATIVA' ? 'Ativa' : value || 'Não informada';
async function consult(cnpj) {
  if(!validCnpj(cnpj))return {cnpj,error:'CNPJ com dígitos verificadores inválidos.'};
  try {
    const response=await fetch('/api/cnpj/'+cnpj,{headers:{Accept:'application/json'}});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(data?.detalhes || data?.titulo || 'Falha HTTP '+response.status);
    if(!data||!Array.isArray(data.socios))return {cnpj,error:'O cadastro não retornou quadro societário verificável.'};
    return {cnpj,data};
  }catch(error){return {cnpj,error:error.message || 'Falha na consulta.'};}
}

let latestPeopleReport = null;
const maskedCpf = cpf => cpf ? '***.' + cpf.slice(3,6) + '.' + cpf.slice(6,9) + '-**' : 'Não informado';
function reportField(label,value) {
  return '<div class="report-field"><span>'+escape(label)+'</span><strong>'+escape(value ?? 'Não informado')+'</strong></div>';
}
function buildPeopleReport(model) {
  const verified=model.rows.filter(r=>r.level==='Correspondência nominal');
  const reportHeader='<header class="print-header"><img class="print-logo" src="/logo-atlas.png" alt="ATLAS CNPJ.EXPLORE"><div><div class="print-kicker">RELATÓRIO DE VÍNCULOS SOCIETÁRIOS · ATLAS EXPLORE</div><h1>'+escape(model.name)+'</h1><p>CPF informado: '+escape(maskedCpf(model.cpf))+'</p><p>Emitido em '+escape(model.createdAt)+'</p></div></header>';
  const summary='<section class="report-chapter report-summary"><h2>Identificação e escopo</h2><div class="report-fields">'+
    reportField('Pessoa pesquisada',model.name)+reportField('CPF (mascarado)',maskedCpf(model.cpf))+
    reportField('Abrangência',model.mode==='automatic'?'Primeira página de resultados da API comercial CNPJws — sem garantia de exaustividade':'CNPJs indicados para verificação — sem busca nacional exaustiva')+
    reportField('CNPJs consultados',String(model.rows.length))+
    reportField('Correspondências nominais',String(verified.length))+
    reportField('Data e hora',model.createdAt)+'</div></section>';
  const methodology='<section class="report-chapter"><h2>Metodologia e ressalvas</h2><p>Pesquisa por nome e CPF (quando informado) na API comercial CNPJws, ou verificação dos CNPJs fornecidos, seguida de consulta cadastral pela API pública CNPJws. O nome pesquisado foi comparado aos nomes constantes dos quadros societários retornados. A situação cadastral refere-se à empresa; não certifica, isoladamente, a atualidade da participação societária.</p><p><strong>Correspondência nominal não comprova identidade pelo CPF.</strong> A pesquisa não permite concluir que todas as empresas vinculadas à pessoa foram identificadas. A conferência conclusiva exige QSA oficial e atos societários atualizados, quando aplicável.</p></section>';
  const items=model.rows.map((row,i)=>'<div class="report-record people-report-item"><strong class="record-heading">'+(i+1)+'. '+escape(row.company || 'Consulta não concluída')+'</strong>'+
    reportField('CNPJ',formatCnpj(row.cnpj))+reportField('Situação cadastral',row.status || 'Não verificada')+
    reportField('Vínculo / qualificação',row.role || 'Não verificado')+
    reportField('Grau de evidência',row.level)+reportField('Observação',row.reason || '—')+
    '<div class="report-field"><span>Fontes e conferência</span><strong><a href="https://cnpj.ws/'+encodeURIComponent(row.cnpj)+'">CNPJws — '+escape(formatCnpj(row.cnpj))+'</a><br><a href="https://www.gov.br/pt-br/servicos/consultar-cadastro-nacional-de-pessoas-juridicas">Receita Federal — consulta oficial de CNPJ</a></strong></div></div>').join('');
  const conclusion='<section class="report-chapter"><h2>Conclusão</h2><p>Foram encontradas '+verified.length+' correspondência(s) nominal(is) entre '+model.rows.length+' CNPJ(s) submetido(s) à verificação. Os resultados não constituem confirmação de identidade pelo CPF, comprovação de percentual societário ou certidão de inexistência de outros vínculos.</p></section>';
  return '<div class="print-page people-print-page">'+reportHeader+summary+methodology+
    '<section class="report-chapter"><h2>Empresas verificadas</h2>'+items+'</section>'+conclusion+
    '<footer class="print-footer">ATLAS CNPJ.EXPLORE · Relatório informativo de pesquisa societária assistida. Fontes: API pública CNPJws; Receita Federal indicada para conferência oficial.</footer></div>';
}
function printPeopleReport() {
  if (!latestPeopleReport) return;
  let area=document.querySelector('#print-area');
  if (!area){area=document.createElement('div');area.id='print-area';document.body.appendChild(area);}
  area.innerHTML=buildPeopleReport(latestPeopleReport);
  window.print();
}
output.addEventListener('click',event=>{
  if(event.target.closest('#people-print-btn'))printPeopleReport();
});

form.addEventListener('submit',async event=>{
  event.preventDefault();update();if(submit.disabled)return;
  const name=normalize(nameInput.value);
  const cpf=digits(cpfInput.value);
  let items=candidates();
  latestPeopleReport=null;
  const requestId=++window.atlasPeopleRequestId;
  searchStatus.textContent='';
  submit.disabled=true;submit.textContent='Pesquisando...';
  output.hidden=false;output.innerHTML='<p>Consultando '+items.length+' CNPJ(s), em sequência para respeitar o limite da API pública...</p>';
  if(searchMode.value==='automatic') {
    output.innerHTML='<p>Pesquisando vínculos na base integrada, sem sair do Atlas...</p>';
    try {
      const response=await fetch('/api/socios',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({nome:nameInput.value.trim(),cpf})});
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.detalhes || result?.titulo || 'Falha na pesquisa automática.');
      items=Array.isArray(result?.cnpjs)?result.cnpjs:[];
      if(requestId!==window.atlasPeopleRequestId)return;
      searchStatus.textContent=(result?.total ?? items.length)+' registro(s) indicado(s) na fonte comercial'+(result?.tem_proxima_pagina?' · existem mais páginas não consultadas':'')+'.';
      if(!items.length) {
        output.innerHTML='<p>Nenhum CNPJ encontrado nos filtros pesquisados. Isso não comprova inexistência de vínculos.</p>';
        submit.textContent='Pesquisar vínculos';update();return;
      }
    } catch(error) {
      output.innerHTML='<p class="person-warning">'+escape(error?.message || 'Pesquisa indisponível.')+'</p>';
      submit.textContent='Pesquisar vínculos';update();return;
    }
  }
  output.innerHTML='<p>Verificando '+items.length+' CNPJ(s) dentro do Atlas. A confirmação do QSA respeita o limite da API pública...</p>';
  const checked=[];
  for (const cnpj of items) {
    if(requestId!==window.atlasPeopleRequestId)return;
    checked.push(await consult(cnpj));
    output.innerHTML='<p>Verificados '+checked.length+' de '+items.length+' CNPJ(s)...</p>';
    if(checked.length<items.length)await new Promise(resolve=>setTimeout(resolve,21000));
  }
  if(requestId!==window.atlasPeopleRequestId)return;
  const rows=checked.map(item=>{
    if(item.error)return {cnpj:item.cnpj,reason:item.error,level:'Não verificado'};
    const data=item.data;
    const matches=data.socios.filter(s=>normalize(s.nome||s.nome_socio||s.razao_social)===name);
    const matched=matches[0], presented=digits(matched?.cpf_cnpj_socio);
    // A public API may mask the CPF. Never interpret a partial CPF as definitive proof of identity.
    const identityMismatch=cpf&&presented.length===11&& presented!==cpf;
    const level=matches.length===0?'Nome não localizado':identityMismatch?'CPF divergente':'Correspondência nominal';
    const e=data.estabelecimento||{};
    return {cnpj:item.cnpj,company:data.razao_social||'Não informada',status:status(e.situacao_cadastral),role:matched?.qualificacao_socio?.descricao||matched?.qualificacao?.descricao||'Não informada',level,reason:matches.length?'CPF não validado por fonte oficial nesta consulta.':'Nome não consta do QSA retornado.'};
  });
  latestPeopleReport={name:nameInput.value.trim(),cpf,mode:searchMode.value,rows,createdAt:new Date().toLocaleString('pt-BR')};
  output.innerHTML='<div class="register-head"><h3>Resultado da verificação</h3><span>'+rows.length+' CNPJ(s)</span></div>'+
    '<p class="person-warning">A pesquisa é restrita aos CNPJs retornados na página consultada ou indicados manualmente. Correspondência nominal não confirma identidade pelo CPF nem certifica a inexistência de outros vínculos. Situação cadastral da empresa não comprova, isoladamente, a atualidade do QSA.</p>'+
    '<div class="people-table-wrap"><table class="people-table"><thead><tr><th>Empresa / CNPJ</th><th>Situação</th><th>Vínculo</th><th>Evidência</th><th>Fonte</th></tr></thead><tbody>'+
    rows.map(row=>'<tr><td><strong>'+escape(row.company||'Consulta não concluída')+'</strong><br>'+escape(formatCnpj(row.cnpj))+'</td><td>'+escape(row.status||'—')+'</td><td>'+escape(row.role||'—')+'</td><td><strong>'+escape(row.level)+'</strong><br>'+escape(row.reason||'')+'</td><td><a href="https://cnpj.ws/'+encodeURIComponent(row.cnpj)+'" target="_blank" rel="noopener noreferrer">CNPJws ↗</a><br><a href="https://www.gov.br/pt-br/servicos/consultar-cadastro-nacional-de-pessoas-juridicas" target="_blank" rel="noopener noreferrer">Receita Federal ↗</a></td></tr>').join('')+
    '</tbody></table></div><div class="people-report-actions"><button type="button" class="secondary-btn" id="people-print-btn">Gerar relatório societário · Imprimir / Salvar PDF</button></div><p class="person-warning">Consulta realizada em '+escape(latestPeopleReport.createdAt)+'. Para prova documental, obtenha o QSA oficial e a ficha cadastral na Junta Comercial competente.</p>';
  submit.textContent='Pesquisar vínculos';update();
});
window.atlasPeopleRequestId=0;
update();
