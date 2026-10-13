((root)=>{
 let index=[];
 let activeIndex=-1;
 let visibleResults=[];
 let dataPromise=null;
 let lastLoadedAt=0;
 const CACHE_MS=30000;
 const TYPE_ORDER=['empresa','processo','licenca','documento','financeiro'];
 const TYPE_LABEL={empresa:'Empresas',processo:'Processos',licenca:'Licenças',documento:'Documentos',financeiro:'Financeiro'};
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const clean=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const brl=v=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'';};
 const digits=v=>String(v??'').replace(/\D/g,'');

 function establishmentType(client){
  const saved=String(client?.metadata?.establishment_type||'').toLowerCase();
  if(saved==='matriz'||saved==='filial')return saved;
  const d=digits(client?.tax_id||client?.cnpj);
  return d.length===14&&d.slice(8,12)!=='0001'?'filial':'matriz';
 }

 function establishmentNumber(client){
  const d=digits(client?.tax_id||client?.cnpj);
  return d.length>=12?d.slice(8,12):'';
 }

 function hierarchyContext(client,clients=[]){
  if(!client)return {type:'',number:'',matrix:null,matrixName:'',location:'',short:'',search:''};
  const type=establishmentType(client);
  const number=establishmentNumber(client);
  const rootCnpj=digits(client?.tax_id||client?.cnpj).slice(0,8);
  let matrix=null;
  if(type==='matriz')matrix=client;
  else{
    const parentId=client?.metadata?.parent_client_id||null;
    matrix=clients.find(candidate=>candidate.id===parentId)||clients.find(candidate=>{
      if(candidate.id===client.id||establishmentType(candidate)!=='matriz')return false;
      return digits(candidate?.tax_id||candidate?.cnpj).slice(0,8)===rootCnpj;
    })||null;
  }
  const matrixName=matrix?(matrix.legal_name||matrix.trade_name||''):'';
  const location=[client.city,client.state].filter(Boolean).join('/');
  const typeLabel=type==='filial'?`Filial ${number||''}`.trim():'Matriz';
  const short=[typeLabel,type==='filial'&&matrixName?`Matriz: ${matrixName}`:'',location].filter(Boolean).join(' · ');
  const search=[typeLabel,type,number,matrixName,location,client.city,client.state,client.tax_id,client.cnpj].filter(Boolean).join(' ');
  return {type,number,matrix,matrixName,location,short,search};
 }

 function buildIndex(data={}){
  const clients=data.clients||[];
  const processes=data.processes||[];
  const clientById=new Map(clients.map(c=>[c.id,c]));
  const processById=new Map(processes.map(p=>[p.id,p]));
  const cname=id=>{const c=clientById.get(id);return c?.legal_name||c?.trade_name||'';};
  const ccontext=id=>hierarchyContext(clientById.get(id),clients);
  const processContext=processId=>{const p=processById.get(processId);return {process:p,client_id:p?.client_id||null,company:cname(p?.client_id),hierarchy:ccontext(p?.client_id)};};

  index=[];
  for(const c of clients){
    const h=hierarchyContext(c,clients);
    index.push({
      type:'empresa',id:c.id,client_id:c.id,label:c.legal_name||c.trade_name||'Empresa',
      meta:[h.short,c.tax_id||c.cnpj].filter(Boolean).join(' · '),
      hay:norm([c.legal_name,c.trade_name,c.tax_id,c.cnpj,c.city,c.state,c.contact_name,c.email,h.search].join(' '))
    });
  }
  for(const p of processes){
    const h=ccontext(p.client_id);
    index.push({
      type:'processo',id:p.id,process_id:p.id,client_id:p.client_id||null,label:p.public_code||p.title||'Processo',
      meta:[p.title,cname(p.client_id),h.short].filter(Boolean).join(' · '),
      hay:norm([p.public_code,p.title,p.service_type,p.status,p.priority,cname(p.client_id),h.search].join(' '))
    });
  }
  for(const l of data.licenses||[]){
    const h=ccontext(l.client_id);
    index.push({
      type:'licenca',id:l.id,client_id:l.client_id||null,label:l.name||l.license_type||'Licença',
      meta:[cname(l.client_id),h.short,l.expires_at].filter(Boolean).join(' · '),
      hay:norm([l.name,l.license_type,l.number,l.status,l.expires_at,cname(l.client_id),h.search].join(' '))
    });
  }
  for(const d of data.documents||[]){
    const ctx=processContext(d.process_id);
    const clientId=d.client_id||ctx.client_id||null;
    const h=ccontext(clientId);
    index.push({
      type:'documento',id:d.id,client_id:clientId,process_id:d.process_id||null,label:d.name||'Documento',
      meta:[d.category,cname(clientId),h.short,ctx.process?.public_code].filter(Boolean).join(' · '),
      hay:norm([d.name,d.category,d.mime_type,cname(clientId),h.search,ctx.process?.public_code,ctx.process?.title].join(' '))
    });
  }
  for(const c of data.costs||[]){
    const ctx=processContext(c.process_id);
    index.push({
      type:'financeiro',id:c.id,process_id:c.process_id||null,client_id:ctx.client_id||null,
      label:c.description||c.name||'Lançamento financeiro',
      meta:[ctx.process?.public_code,ctx.company,ctx.hierarchy.short,brl(c.amount),c.payment_status==='paid'?'Pago':'Pendente'].filter(Boolean).join(' · '),
      hay:norm([c.description,c.name,c.cost_type,c.fee_kind,c.payment_status,c.amount,ctx.process?.public_code,ctx.process?.title,ctx.company,ctx.hierarchy.search].join(' '))
    });
  }
  return index;
 }

 function search(query){
  const q=norm(query).trim();
  if(!q)return [];
  const tokens=q.split(/\s+/).filter(Boolean);
  return index.filter(x=>tokens.every(token=>x.hay.includes(token))).slice(0,40);
 }

 function groupResults(results=[]){
  return TYPE_ORDER.map(type=>({type,label:TYPE_LABEL[type],items:results.filter(x=>x.type===type)})).filter(group=>group.items.length);
 }

 function targetPage(t){return ({empresa:'clientes',processo:'processos',licenca:'licencas',documento:'documentos',financeiro:'custos'})[t]||'dashboard';}

 function close(){
  root.document?.querySelector?.('#v4-command-results')?.remove();
  activeIndex=-1;
  visibleResults=[];
 }

 function navigatePage(type){
  root.document?.querySelector?.(`[data-page="${targetPage(type)}"]`)?.click?.();
 }

 function activate(result){
  if(!result)return false;
  close();
  if(result.type==='empresa'&&result.id&&typeof root.openCompany360V5==='function'){
    root.openCompany360V5(result.id);return true;
  }
  if(result.type==='processo'&&result.id&&typeof root.openAtlasV4Process==='function'){
    root.openAtlasV4Process(result.id);return true;
  }
  if(['documento','financeiro'].includes(result.type)&&result.process_id&&typeof root.openAtlasV4Process==='function'){
    root.openAtlasV4Process(result.process_id);return true;
  }
  if(['licenca','documento','financeiro'].includes(result.type)&&result.client_id&&typeof root.openCompany360V5==='function'){
    root.openCompany360V5(result.client_id);return true;
  }
  navigatePage(result.type);
  return true;
 }

 function setActive(next){
  const host=root.document?.querySelector?.('#v4-command-results');
  const buttons=[...(host?.querySelectorAll?.('[data-v4-index]')||[])];
  if(!buttons.length){activeIndex=-1;return;}
  activeIndex=Math.max(0,Math.min(next,buttons.length-1));
  buttons.forEach((button,i)=>{
    const active=i===activeIndex;
    button.classList?.toggle?.('is-active',active);
    button.setAttribute?.('aria-selected',active?'true':'false');
    if(active)button.scrollIntoView?.({block:'nearest'});
  });
 }

 function render(results,query){
  close();
  const q=String(query||'').trim();
  if(!q)return;
  const host=root.document?.createElement?.('div');
  if(!host)return;
  host.id='v4-command-results';
  host.className='v4-command-results';
  host.setAttribute?.('role','listbox');
  host.setAttribute?.('aria-label','Resultados da busca global');

  const groups=groupResults(results);
  visibleResults=groups.flatMap(group=>group.items);
  let cursor=0;
  host.innerHTML=visibleResults.length?groups.map(group=>`<section class="v4-command-group"><div class="v4-command-title"><span>${clean(group.label)}</span><b>${group.items.length}</b></div>${group.items.map(x=>{const current=cursor++;return `<button type="button" role="option" aria-selected="false" data-v4-index="${current}"><span><strong>${clean(x.label)}</strong><small>${clean(x.meta||'')}</small></span><em>${clean(x.type)}</em></button>`;}).join('')}</section>`).join(''):`<div class="v4-command-empty"><strong>Nenhum resultado encontrado</strong><span>Tente CNPJ, código do processo, nome da empresa, matriz, filial, licença ou documento.</span></div>`;
  root.document.querySelector?.('.global-search')?.appendChild(host);
  host.querySelectorAll?.('[data-v4-index]').forEach(button=>button.addEventListener('click',()=>activate(visibleResults[Number(button.dataset.v4Index)])));
  if(visibleResults.length)setActive(0);
 }

 async function ensureData(force=false){
  const fresh=Date.now()-lastLoadedAt<CACHE_MS&&index.length;
  if(!force&&fresh)return index;
  if(dataPromise)return dataPromise;
  dataPromise=(async()=>{
    try{
      if(typeof root.loadOperationalData==='function'){
        const data=await root.loadOperationalData();
        buildIndex(data);
        lastLoadedAt=Date.now();
      }
      return index;
    }catch(err){
      console.warn('ATLAS 5.1 busca indisponível',err);
      return index;
    }finally{
      dataPromise=null;
    }
  })();
  return dataPromise;
 }

 async function refreshAndRender(input){
  await ensureData();
  render(search(input.value),input.value);
 }

 function bind(){
  const input=root.document?.querySelector?.('#global-search');
  if(!input||input.dataset.v4Bound)return;
  input.dataset.v4Bound='1';
  input.placeholder='Buscar empresa, CNPJ, matriz, filial, processo, licença, documento ou financeiro...';
  input.setAttribute?.('autocomplete','off');
  input.setAttribute?.('aria-haspopup','listbox');
  input.addEventListener('focus',()=>refreshAndRender(input));
  input.addEventListener('input',()=>refreshAndRender(input));
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){
      e.preventDefault();
      setActive(activeIndex<0?0:activeIndex+1);
      return;
    }
    if(e.key==='ArrowUp'){
      e.preventDefault();
      setActive(activeIndex<=0?0:activeIndex-1);
      return;
    }
    if(e.key==='Escape'){
      e.preventDefault();
      close();
      input.blur?.();
      return;
    }
    if(e.key==='Enter'&&String(input.value||'').trim()){
      e.preventDefault();
      e.stopImmediatePropagation?.();
      const choice=visibleResults[activeIndex>=0?activeIndex:0];
      if(choice)activate(choice);
      else refreshAndRender(input);
    }
  },true);

  root.document?.addEventListener?.('click',event=>{
    if(!event.target?.closest?.('.global-search'))close();
  });
 }

 root.AtlasV4Search={buildIndex,search,groupResults,activate,targetPage,hierarchyContext};
 if(root.document?.addEventListener){
  root.document.addEventListener('DOMContentLoaded',bind);
  root.document.addEventListener('keydown',event=>{
    const input=root.document?.querySelector?.('#global-search');
    if(!input)return;
    const tag=String(event.target?.tagName||'').toLowerCase();
    const typing=['input','textarea','select'].includes(tag)||event.target?.isContentEditable;
    if((event.ctrlKey||event.metaKey)&&String(event.key).toLowerCase()==='k'){
      event.preventDefault();input.focus?.();input.select?.();
    }else if(event.key==='/'&&!typing){
      event.preventDefault();input.focus?.();
    }
  });
  setTimeout(bind,0);
 }
})(typeof window!=='undefined'?window:globalThis);