/** Consultas adicionais são iniciadas pelo usuário; os dados CNPJws não são substituídos. */
const sources=Object.freeze([
 {key:'minhareceita',label:'Minha Receita',help:'Compare situação, endereço e capital com outro retrato cadastral.'},
 {key:'opencnpj',label:'OpenCNPJ',help:'Segunda fonte cadastral, sujeita à disponibilidade pública.'},
 {key:'viacep',label:'ViaCEP',help:'Confira município, UF e logradouro associados ao CEP informado.'},
 {key:'tcu',label:'Consulta consolidada TCU',help:'Consulte os resultados publicados pelo TCU, CNJ e CGU para o CNPJ.'}
]);
export const htmlSafe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const cleanDigits=v=>String(v??'').replace(/\D/g,'');
export const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export function compareFields(fonte,dados,main){
 const e=main?.estabelecimento||{};
 const city=typeof e.cidade==='object'?e.cidade?.nome:e.cidade;
 const uf=typeof e.estado==='object'?e.estado?.sigla:e.estado;
 const fields=fonte==='viacep'
 ? [['CEP',e.cep,dados.cep,'digits'],['Município',city,dados.municipio,'text'],['UF',uf,dados.uf,'text']]
 : [['Razão social',main?.razao_social,dados.razaoSocial,'text'],['Situação cadastral',e.situacao_cadastral,dados.situacao,'text'],['CEP',e.cep,dados.cep,'digits'],['UF',uf,dados.uf,'text'],['Capital social',main?.capital_social,dados.capitalSocial,'money']];
 return fields.map(([label,left,right,type])=>{
  const lv=left??'',rv=right??'';
  const a=type==='digits'?cleanDigits(lv):type==='money'?Number(String(lv).replace(',','.')):fold(lv);
  const b=type==='digits'?cleanDigits(rv):type==='money'?Number(String(rv).replace(',','.')):fold(rv);
  let status='indeterminado';
  if(String(lv).trim()&&String(rv).trim()&&!Number.isNaN(a)&&!Number.isNaN(b))status=a===b?'coincidente':'divergente';
  return {label,principal:String(lv||'Não informado'),alternativa:String(rv||'Não informado'),status};
 });
}
const cnpjOf=data=>cleanDigits(data?.estabelecimento?.cnpj);
export function createExtrasManager(getCurrent){
 let results={},busy={},generation=0,controllers={};
 const getResults=()=>structuredClone(results);
 const reset=()=>{generation++;Object.values(controllers).forEach(x=>x.abort());controllers={};results={};busy={};};
 function panel(){return '<section class="dashboard-card extras-card" aria-labelledby="extras-title"><div class="extras-intro"><span class="section-kicker">BASES PÚBLICAS · SOB DEMANDA</span><h3 id="extras-title">Informações complementares</h3><p>Confronte o cadastro com outras fontes e consulte os resultados da consulta consolidada do TCU. Nenhuma pesquisa é automática: selecione cada fonte. Divergências não comprovam irregularidades.</p></div><div id="extras-live" aria-live="polite"></div></section>';}
 function render(){
  const root=document.querySelector('#extras-live'),main=getCurrent();if(!root||!main)return;
  const cep=cleanDigits(main?.estabelecimento?.cep);
  root.innerHTML='<div class="extras-grid">'+sources.map(src=>{
   const r=results[src.key],loading=busy[src.key];let view='';
   if(r?.erro)view='<p class="extras-error">'+htmlSafe(r.erro)+'</p>';
   else if(r?.dados){
    const d=r.dados,caption='<p class="extras-timestamp">Fonte: '+htmlSafe(r.fonte)+' · Consultada em '+htmlSafe(new Date(r.consultadoEm).toLocaleString('pt-BR'))+'</p>';
    if(src.key==='tcu'){
     const list=d.certidoes||[];
     view=caption+(list.length?list.map(c=>'<div class="extras-tcu"><strong>'+htmlSafe(c.emissor)+' · '+htmlSafe(c.tipo)+'</strong><span>Resultado informado: '+htmlSafe(c.situacao||'Não informado')+'</span><p>'+htmlSafe(c.observacao||c.descricao||'Sem observação adicional.')+'</p><small>Emissão: '+htmlSafe(c.emissao||'Não informada')+'</small></div>').join(''):'<p>Nenhum item retornado. Isso não comprova regularidade geral.</p>')+'<a class="extras-official" href="https://certidoes-apf.apps.tcu.gov.br/" target="_blank" rel="noopener noreferrer">Abrir consulta oficial TCU ↗</a>';
    } else {
     const pairs=compareFields(src.key,d,main),count=pairs.filter(v=>v.status==='divergente').length;
     view=caption+'<p class="extras-comparison">'+(count?count+' possível(is) divergência(s)':'Comparação apresentada abaixo')+' · confirme na fonte oficial.</p>'+
      pairs.map(p=>'<div class="extras-row"><b>'+htmlSafe(p.label)+'</b><span>CNPJws: '+htmlSafe(p.principal)+'</span><span>'+htmlSafe(r.fonte)+': '+htmlSafe(p.alternativa)+'</span><em class="extras-'+p.status+'">'+(p.status==='coincidente'?'Coincidente':p.status==='divergente'?'Divergência':'Indeterminado')+'</em></div>').join('')+
      '<p class="extras-address">'+htmlSafe([d.logradouro,d.numero,d.bairro,d.municipio,d.uf,d.cep].filter(Boolean).join(' · '))+'</p>';
    }
   }
   return '<article class="extras-source"><div class="extras-source-top"><div><h4>'+htmlSafe(src.label)+'</h4><p>'+htmlSafe(src.help)+'</p></div><button type="button" class="secondary-btn" data-extra="'+src.key+'" '+(loading||src.key==='viacep'&&cep.length!==8?'disabled':'')+'>'+(loading?'Consultando…':r?'Atualizar':'Consultar')+'</button></div>'+(src.key==='viacep'&&cep.length!==8?'<p class="extras-error">CEP não informado no cadastro.</p>':'')+view+'</article>';
  }).join('')+'</div><p class="extras-disclaimer">Os resultados se referem à fonte consultada e podem estar desatualizados. O ATLAS não emite certidões oficiais. Consulta indisponível ou sem registros não equivale à ausência de restrições.</p>';
  root.querySelectorAll('[data-extra]').forEach(btn=>btn.addEventListener('click',()=>load(btn.dataset.extra)));
 }
 async function load(fonte){
  const main=getCurrent();if(!main||busy[fonte]||!sources.some(s=>s.key===fonte))return;
  const gen=generation,cnpj=cnpjOf(main),cep=cleanDigits(main.estabelecimento?.cep);
  if(fonte==='viacep'&&cep.length!==8)return;
  const ac=new AbortController();controllers[fonte]=ac;busy[fonte]=true;render();
  try {
   const params=new URLSearchParams({fonte,...(fonte==='viacep'?{cep}:{cnpj})});
   const response=await fetch('/api/complementos?'+params,{headers:{Accept:'application/json'},signal:ac.signal});
   const body=await response.json().catch(()=>({}));
   if(gen!==generation||getCurrent()!==main)return;
   if(!response.ok||!body.ok)throw new Error(body.erro||'Fonte indisponível.');
   results[fonte]=body;
  }catch(e){if(gen!==generation||e.name==='AbortError')return;results[fonte]={erro:e.message||'Consulta indisponível.'};}
  finally{if(gen===generation){delete busy[fonte];delete controllers[fonte];render();}}
 }
 return {reset,panel,render,getResults};
}
