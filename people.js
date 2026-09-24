const form = document.querySelector('#people-form');
const nameInput = document.querySelector('#person-name');
const cpfInput = document.querySelector('#person-cpf');
const cnpjsInput = document.querySelector('#person-cnpjs');
const submit = document.querySelector('#people-submit');
const output = document.querySelector('#people-results');
const searchMode = document.querySelector('#person-mode');
const searchStatus = document.querySelector('#person-search-status');
const digits = value => String(value || '').replace(/\D/g,'');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatCnpj = value => digits(value).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const formatCpf = value => digits(value).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
let latest = null;
let running = false;

function validCpf(value) {
  const d=digits(value);
  if(d.length!==11 || /^(\d)\1{10}$/.test(d))return false;
  const dv=n=>{let total=0;for(let i=0;i<n;i++)total+=Number(d[i])*(n+1-i);return (total*10%11)%10;};
  return dv(9)===Number(d[9]) && dv(10)===Number(d[10]);
}
function validCnpj(value) {
  const d=digits(value);
  if(d.length!==14 || /^(\d)\1{13}$/.test(d))return false;
  const dv=(base,w)=>{const total=[...base].reduce((sum,n,i)=>sum+Number(n)*w[i],0);return total%11<2?0:11-total%11;};
  return dv(d.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2])===Number(d[12]) &&
    dv(d.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(d[13]);
}
function candidates() {
  return [...new Set((cnpjsInput.value.match(/\d[\d.\/-]{12,20}\d/g)||[]).map(digits).filter(validCnpj))];
}
function refresh() {
  const cpf=digits(cpfInput.value);
  submit.disabled=running || nameInput.value.trim().length<3 || (cpf.length>0 && !validCpf(cpf)) || (searchMode.value==='manual'&&!candidates().length);
  document.querySelector('.people-manual-input').hidden=searchMode.value!=='manual';
}
[nameInput,cpfInput,cnpjsInput,searchMode].forEach(element=>element.addEventListener(element===searchMode?'change':'input',refresh));
const maskedCpf = cpf => cpf ? '***.'+cpf.slice(3,6)+'.'+cpf.slice(6,9)+'-**' : 'Não informado';

function printList() {
  if(!latest)return;
  let area=document.querySelector('#print-area');
  if(!area){area=document.createElement('div');area.id='print-area';document.body.appendChild(area);}
  const fields=(label,value)=>'<div class="report-field"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong></div>';
  area.innerHTML='<div class="print-page people-print-page"><header class="print-header"><img class="print-logo" src="/logo-atlas.png" alt="Atlas Explore"><div><div class="print-kicker">ATLAS CNPJ.EXPLORE · PESQUISA SOCIETÁRIA</div><h1>Relação de empresas e CNPJs</h1><p>Pesquisa: '+escapeHtml(latest.name)+'</p><p>Emitido em '+escapeHtml(latest.date)+'</p></div></header>'+
    '<section class="report-chapter"><h2>Escopo</h2>'+fields('Pessoa pesquisada',latest.name)+fields('CPF informado (mascarado)',maskedCpf(latest.cpf))+fields('CNPJs apresentados',String(latest.empresas.length))+fields('Fonte',latest.source)+ '</section>'+
    '<section class="report-chapter"><h2>Empresas identificadas</h2>'+latest.empresas.map((company,i)=>'<div class="report-record people-report-item"><strong class="record-heading">'+(i+1)+'. '+escapeHtml(company.razao_social||'Razão social não disponível')+'</strong>'+fields('CNPJ',formatCnpj(company.cnpj))+'</div>').join('')+'</section>'+
    '<section class="report-chapter"><h2>Ressalvas</h2><p>Relação indicativa para seleção e posterior consulta individual de CNPJ. A correspondência por nome ou CPF não constitui confirmação documental de participação societária. A lista pode ser parcial, conforme paginação e atualização do provedor. Não constitui certidão negativa de outros vínculos.</p></section>'+
    '<footer class="print-footer">ATLAS CNPJ.EXPLORE · Confirme dados essenciais nos canais oficiais.</footer></div>';
  window.print();
}
function renderList() {
  const model=latest;
  output.hidden=false;
  if(!model.empresas.length){output.innerHTML='<p>Nenhum CNPJ retornado para os filtros informados. Isso não comprova inexistência de outros vínculos.</p>';return;}
  output.innerHTML='<div class="register-head"><h3>Empresas encontradas</h3><span>'+model.empresas.length+' CNPJ(s)</span></div>'+
    '<p class="person-warning">Copie o CNPJ desejado e insira-o na consulta empresarial acima. Nenhuma consulta cadastral completa será aberta automaticamente.</p>'+
    '<div class="people-table-wrap"><table class="people-table"><thead><tr><th>Razão social</th><th>CNPJ</th><th>Ação</th></tr></thead><tbody>'+
    model.empresas.map(company=>'<tr><td><strong>'+escapeHtml(company.razao_social||'Razão social não disponível')+'</strong></td><td>'+escapeHtml(formatCnpj(company.cnpj))+'</td><td><button type="button" class="secondary-btn people-copy" data-cnpj="'+escapeHtml(company.cnpj)+'">Copiar CNPJ</button></td></tr>').join('')+
    '</tbody></table></div><div class="people-report-actions"><button type="button" class="secondary-btn" id="people-print-btn">Imprimir / Salvar relação em PDF</button></div>'+
    '<p class="person-warning">Fonte: '+escapeHtml(model.source)+'. Lista indicativa: a identidade e a participação devem ser validadas nos registros oficiais. '+(model.more?'Existem outras páginas não incluídas nesta relação.':'Não há garantia de exaustividade.')+'</p>';
}
output.addEventListener('click',async event=>{
  const copy=event.target.closest('[data-cnpj]');
  if(copy){
    const value=copy.dataset.cnpj;
    try {
      await navigator.clipboard.writeText(formatCnpj(value));
      copy.textContent='Copiado ✓';
    }catch{
      const field=document.querySelector('#cnpj-input');
      field.value=formatCnpj(value);
      field.dispatchEvent(new Event('input',{bubbles:true}));
      copy.textContent='CNPJ colocado no campo acima';
    }
  }
  if(event.target.closest('#people-print-btn'))printList();
});
form.addEventListener('submit',async event=>{
  event.preventDefault();refresh();if(submit.disabled)return;
  running=true;refresh();latest=null;
  output.hidden=false;output.innerHTML='<p>Pesquisando CNPJs e nomes empresariais dentro do Atlas...</p>';
  searchStatus.textContent='';
  try {
    let empresas=[];
    let meta={};
    if(searchMode.value==='automatic'){
      const response=await fetch('/api/socios',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({nome:nameInput.value.trim(),cpf:digits(cpfInput.value)})});
      const body=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(body?.detalhes||body?.titulo||'Falha na pesquisa societária.');
      empresas=Array.isArray(body?.empresas)?body.empresas:[];
      meta={more:Boolean(body?.tem_proxima_pagina),source:body?.fonte||'CNPJws'};
    }else{
      empresas=candidates().map(cnpj=>({cnpj,razao_social:null}));
      meta={more:false,source:'CNPJs fornecidos pelo usuário (nomes não consultados)'};
    }
    latest={name:nameInput.value.trim(),cpf:digits(cpfInput.value),empresas,source:meta.source,more:meta.more,date:new Date().toLocaleString('pt-BR')};
    searchStatus.textContent=empresas.length+' CNPJ(s) apresentado(s)'+(meta.more?' · há mais resultados não exibidos':'')+'.';
    renderList();
  }catch(error){
    output.innerHTML='<p class="person-warning">'+escapeHtml(error?.message||'Pesquisa indisponível.')+'</p>';
  }finally{
    running=false;refresh();
  }
});
refresh();
