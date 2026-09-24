const $=selector=>document.querySelector(selector);
const form=$('#person-form'),nameField=$('#person-name'),cpfField=$('#person-cpf'),output=$('#person-results'),button=$('#person-submit');
const digits=value=>String(value??'').replace(/\D/g,'');
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cnpjFmt=value=>digits(value).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
const maskCpf=cpf=>cpf?'***.'+cpf.slice(3,6)+'.'+cpf.slice(6,9)+'-**':'Não informado';
let running=false;
let last=null;
function validCpf(v){const d=digits(v);if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;const check=n=>{let sum=0;for(let i=0;i<n;i++)sum+=Number(d[i])*(n+1-i);return sum*10%11%10;};return check(9)===Number(d[9])&&check(10)===Number(d[10]);}
function refresh(){const cpf=digits(cpfField.value);button.disabled=running||nameField.value.trim().length<5||!!cpf&&!validCpf(cpf);}
[nameField,cpfField].forEach(input=>input.addEventListener('input',refresh));
const disclaimer='Fonte histórica de 20/09/2020. Os nomes e CNPJs são indícios para investigação, não confirmação de vínculo societário atual. Não é uma pesquisa nacional exaustiva.';
function printList(){
 if(!last)return;
 let area=$('#print-area');if(!area){area=document.createElement('div');area.id='print-area';document.body.appendChild(area);}
 area.innerHTML='<div class="print-page"><header class="print-header"><img class="print-logo" src="/logo-atlas.png" alt="Atlas"><div><div class="print-kicker">ATLAS CNPJ.EXPLORE · RELAÇÃO HISTÓRICA</div><h1>Empresas e CNPJs localizados</h1><p>Pesquisa por '+escapeHtml(last.name)+' · CPF '+escapeHtml(maskCpf(last.cpf))+'</p><p>Emitido em '+escapeHtml(last.when)+'</p></div></header><section class="report-chapter"><h2>Relação indicativa</h2>'+last.items.map((item,i)=>'<div class="report-record"><strong class="record-heading">'+(i+1)+'. '+escapeHtml(item.razao_social)+'</strong><div class="report-field"><span>CNPJ</span><strong>'+escapeHtml(cnpjFmt(item.cnpj))+'</strong></div></div>').join('')+'</section><section class="report-chapter"><h2>Fonte e limitações</h2><p>'+escapeHtml(disclaimer)+'</p><p>Brasil.IO — Sócios das Empresas Brasileiras. '+escapeHtml(last.more?'Apenas primeira página de resultados, podendo haver outros registros.':'Registros disponíveis na página consultada.')+'</p></section><footer class="print-footer">Confira identidade, QSA e situação cadastral nos canais oficiais antes de utilizar em procedimento jurídico.</footer></div>';
 window.print();
}
output.addEventListener('click',async event=>{
 const copy=event.target.closest('[data-cnpj]');
 if(copy){
  const value=cnpjFmt(copy.dataset.cnpj);
  try{await navigator.clipboard.writeText(value);copy.textContent='Copiado ✓';}
  catch{const original=$('#cnpj-input');original.value=value;original.dispatchEvent(new Event('input',{bubbles:true}));copy.textContent='Inserido na consulta acima';}
 }
 if(event.target.closest('#person-report'))printList();
});
form.addEventListener('submit',async event=>{
 event.preventDefault();refresh();if(button.disabled)return;
 running=true;refresh();last=null;output.hidden=false;output.innerHTML='<p>Pesquisando a base histórica de sócios...</p>';
 try{
  const response=await fetch('/api/pessoas',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({nome:nameField.value.trim(),cpf:digits(cpfField.value)})});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.detalhes||data?.titulo||'Falha na pesquisa.');
  const items=Array.isArray(data.empresas)?data.empresas:[];
  last={name:nameField.value.trim(),cpf:digits(cpfField.value),items,more:Boolean(data.proxima_pagina),when:new Date().toLocaleString('pt-BR')};
  output.innerHTML='<div class="register-head"><h3>CNPJs localizados</h3><span>'+items.length+' empresa(s) nesta página</span></div><p class="person-caution">'+escapeHtml(disclaimer)+'</p>'+
  (items.length?'<div class="people-table-wrap"><table class="people-table"><thead><tr><th>Razão social (histórica)</th><th>CNPJ</th><th>Ação</th></tr></thead><tbody>'+
  items.map(item=>'<tr><td>'+escapeHtml(item.razao_social)+'</td><td>'+escapeHtml(cnpjFmt(item.cnpj))+'</td><td><button type="button" class="secondary-btn" data-cnpj="'+escapeHtml(item.cnpj)+'">Copiar CNPJ</button></td></tr>').join('')+'</tbody></table></div><div class="people-actions"><button type="button" class="secondary-btn" id="person-report">Imprimir / Salvar PDF</button></div>':'<p>Nenhum registro localizado com esses filtros no recorte histórico consultado. Isso não comprova ausência de vínculos.</p>')+
  '<p class="person-caution">'+escapeHtml(data.proxima_pagina?'Há outros registros não exibidos. A listagem pode estar incompleta.':'Fonte: Brasil.IO, captura de 20/09/2020.')+'</p>';
 }catch(error){output.innerHTML='<div class="person-caution" role="alert"><strong>Consulta não concluída.</strong> '+escapeHtml(error.message)+'</div>';}
 finally{running=false;refresh();}
});
refresh();
