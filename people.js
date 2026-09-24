const form = document.querySelector('#people-form');
const nameInput = document.querySelector('#person-name');
const cpfInput = document.querySelector('#person-cpf');
const cnpjsInput = document.querySelector('#person-cnpjs');
const submit = document.querySelector('#people-submit');
const output = document.querySelector('#people-results');
const discovery = document.querySelector('#person-discovery');
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
  discovery.href='https://www.google.com/search?q='+encodeURIComponent('"'+name+'" "sócio" "CNPJ"');
  discovery.hidden=!name;
  submit.disabled=!name||!items.length||(cpf.length>0&&!validCpf(cpf));
}
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
form.addEventListener('submit',async event=>{
  event.preventDefault();update();if(submit.disabled)return;
  const name=normalize(nameInput.value);
  const cpf=digits(cpfInput.value);
  const items=candidates();
  const requestId=++window.atlasPeopleRequestId;
  submit.disabled=true;submit.textContent='Verificando...';
  output.hidden=false;output.innerHTML='<p>Consultando '+items.length+' CNPJ(s), em sequência para respeitar o limite da API pública...</p>';
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
    const identityMismatch=cpf&&presented.length===11&& !presented.includes('*') && presented!==cpf;
    const level=matches.length===0?'Nome não localizado':identityMismatch?'CPF divergente':'Correspondência nominal';
    const e=data.estabelecimento||{};
    return {cnpj:item.cnpj,company:data.razao_social||'Não informada',status:status(e.situacao_cadastral),role:matched?.qualificacao_socio?.descricao||matched?.qualificacao?.descricao||'Não informada',level,reason:matches.length?'CPF não validado por fonte oficial nesta consulta.':'Nome não consta do QSA retornado.'};
  });
  output.innerHTML='<div class="register-head"><h3>Resultado da verificação</h3><span>'+rows.length+' CNPJ(s)</span></div>'+
    '<p class="person-warning">A pesquisa é assistida, restrita aos CNPJs fornecidos. Correspondência nominal não confirma identidade pelo CPF nem certifica a inexistência de outros vínculos. Situação cadastral da empresa não comprova, isoladamente, a atualidade do QSA.</p>'+
    '<div class="people-table-wrap"><table class="people-table"><thead><tr><th>Empresa / CNPJ</th><th>Situação</th><th>Vínculo</th><th>Evidência</th><th>Fonte</th></tr></thead><tbody>'+
    rows.map(row=>'<tr><td><strong>'+escape(row.company||'Consulta não concluída')+'</strong><br>'+escape(formatCnpj(row.cnpj))+'</td><td>'+escape(row.status||'—')+'</td><td>'+escape(row.role||'—')+'</td><td><strong>'+escape(row.level)+'</strong><br>'+escape(row.reason||'')+'</td><td><a href="https://cnpj.ws/'+encodeURIComponent(row.cnpj)+'" target="_blank" rel="noopener noreferrer">CNPJws ↗</a><br><a href="https://www.gov.br/pt-br/servicos/consultar-cadastro-nacional-de-pessoas-juridicas" target="_blank" rel="noopener noreferrer">Receita Federal ↗</a></td></tr>').join('')+
    '</tbody></table></div><p class="person-warning">Consulta realizada em '+escape(new Date().toLocaleString('pt-BR'))+'. Para prova documental, obtenha o QSA oficial e a ficha cadastral na Junta Comercial competente.</p>';
  submit.textContent='Verificar vínculos';update();
});
window.atlasPeopleRequestId=0;
update();
