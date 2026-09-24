const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits = value => String(value ?? '').replace(/\D/g,'');
const fmt = value => value == null || value===''?'Não informado':String(value);
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
const fields = [['razao_social','Razão social'],['nome_fantasia','Nome fantasia'],['situacao_cadastral','Situação cadastral'],['capital_social','Capital social'],['cnae_principal','CNAE principal'],['municipio','Município'],['uf','UF']];
let latest = null;
let pending = false;
function baseModel(data) {
 const e=data.estabelecimento||{};
 return {fonte:'CNPJws',cnpj:digits(e.cnpj),razao_social:data.razao_social||null,nome_fantasia:e.nome_fantasia||null,situacao_cadastral:typeof e.situacao_cadastral==='string'?e.situacao_cadastral:e.situacao_cadastral?.descricao||null,capital_social:data.capital_social||null,cnae_principal:e.atividade_principal?.id||null,municipio:e.cidade?.nome||null,uf:e.estado?.sigla||null,atualizado_em:data.atualizado_em||null};
}
function render(panel,sourceResults) {
 const sources=[latest.primary,...sourceResults.filter(Boolean)];
 const count=sourceResults.filter(Boolean).length;
 panel.innerHTML='<div class="compare-header"><div><span class="section-kicker">CONFERÊNCIA COMPLEMENTAR · ATLAS 5.1</span><h3>Comparação cadastral por fonte</h3><p>Dados de provedores independentes apresentados lado a lado. Nenhum dado original é substituído.</p></div><button type="button" class="secondary-btn" id="compare-btn" '+(pending?'disabled':'')+'>Consultar fontes gratuitas</button></div>'+
 (count?'<div class="compare-scroll"><table class="compare-table"><thead><tr><th>Informação</th>'+sources.map(s=>'<th>'+esc(s.fonte)+'</th>').join('')+'</tr></thead><tbody>'+
 fields.map(([key,label])=>{const present=sources.map(s=>normalize(s[key])).filter(Boolean);const discrepancy=new Set(present).size>1;return '<tr'+(discrepancy?' class="compare-difference"':'')+'><th>'+esc(label)+(discrepancy?' <span title="Há divergência entre fontes">≠</span>':'')+'</th>'+sources.map(s=>'<td>'+esc(fmt(s[key]))+'</td>').join('')+'</tr>';}).join('')+'</tbody></table></div>':'<p class="source-note">A comparação é opcional. Clique em “Consultar fontes gratuitas” para consultar BrasilAPI e OpenCNPJ.</p>')+
 '<div id="compare-status" class="source-note" aria-live="polite">'+esc(latest.message||'')+'</div>';
}
export function initComparison(data, host) {
 latest={primary:baseModel(data),extras:[],message:'',cnpj:digits(data.estabelecimento?.cnpj)};
 pending=false;
 const panel=document.createElement('section');
 panel.className='dashboard-card compare-card';
 host.appendChild(panel);
 render(panel,[]);
 panel.addEventListener('click',async event=>{
  if(event.target.id!=='compare-btn'||pending||!latest?.cnpj)return;
  pending=true;
  const button=panel.querySelector('#compare-btn');button.disabled=true;button.textContent='Consultando...';
  const selected=latest;
  const outcomes=await Promise.allSettled(['brasilapi','opencnpj'].map(async source=>{
    const response=await fetch('/api/comparar?cnpj='+selected.cnpj+'&fonte='+source);
    const json=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(source+': '+(json?.detalhes||json?.titulo||'indisponível'));
    if(json.cnpj!==selected.cnpj)throw new Error(source+': CNPJ divergente');
    return json;
  }));
  if(latest!==selected)return;
  selected.extras=outcomes.filter(o=>o.status==='fulfilled').map(o=>o.value);
  selected.message='Conferência em '+new Date().toLocaleString('pt-BR')+'. '+outcomes.filter(o=>o.status==='rejected').map(o=>o.reason.message).join(' · ');
  pending=false;
  render(panel,selected.extras);
 });
}
export function getComparisonReport() {
 if(!latest?.extras.length)return null;
 return {cnpj:latest.cnpj,principal:latest.primary,fontes:latest.extras,consultado_em:new Date().toLocaleString('pt-BR')};
}
