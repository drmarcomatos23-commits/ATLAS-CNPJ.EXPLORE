((root)=>{
 let index=[];
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function buildIndex(data={}){
  const clients=data.clients||[]; const cname=id=>clients.find(c=>c.id===id)?.legal_name||clients.find(c=>c.id===id)?.trade_name||'';
  index=[];
  for(const c of clients)index.push({type:'empresa',id:c.id,label:c.legal_name||c.trade_name||'Empresa',meta:c.tax_id||c.cnpj||'',hay:norm([c.legal_name,c.trade_name,c.tax_id,c.cnpj,c.city,c.state].join(' '))});
  for(const p of data.processes||[])index.push({type:'processo',id:p.id,label:p.public_code||p.title||'Processo',meta:[p.title,cname(p.client_id)].filter(Boolean).join(' · '),hay:norm([p.public_code,p.title,p.service_type,p.status,cname(p.client_id)].join(' '))});
  for(const l of data.licenses||[])index.push({type:'licenca',id:l.id,label:l.name||'Licença',meta:[cname(l.client_id),l.expires_at].filter(Boolean).join(' · '),hay:norm([l.name,l.number,l.status,l.expires_at,cname(l.client_id)].join(' '))});
  for(const d of data.documents||[])index.push({type:'documento',id:d.id,label:d.name||'Documento',meta:[d.category,cname(d.client_id)].filter(Boolean).join(' · '),hay:norm([d.name,d.category,d.mime_type,cname(d.client_id)].join(' '))});
  return index;
 }
 function search(query){const q=norm(query).trim();if(!q)return [];return index.filter(x=>x.hay.includes(q)).slice(0,30);}
 function targetPage(t){return ({empresa:'clientes',processo:'processos',licenca:'licencas',documento:'documentos'})[t]||'dashboard';}
 function close(){root.document?.querySelector?.('#v4-command-results')?.remove();}
 function render(results,query){close();if(!query.trim())return;const host=root.document?.createElement?.('div');if(!host)return;host.id='v4-command-results';host.className='v4-command-results';host.innerHTML=results.length?`<div class="v4-command-title">Resultados</div>${results.map(x=>`<button data-v4-result="${x.type}"><span><strong>${String(x.label).replace(/[<>]/g,'')}</strong><small>${String(x.meta||'').replace(/[<>]/g,'')}</small></span><em>${x.type}</em></button>`).join('')}`:'<div class="v4-command-empty">Nenhum resultado encontrado.</div>';root.document.querySelector?.('.global-search')?.appendChild(host);host.querySelectorAll?.('[data-v4-result]').forEach(b=>b.addEventListener('click',()=>{root.document.querySelector?.(`[data-page="${targetPage(b.dataset.v4Result)}"]`)?.click();close();}));}
 async function ensureData(){try{if(typeof root.loadOperationalData==='function')buildIndex(await root.loadOperationalData());}catch(err){console.warn('ATLAS 4 busca indisponível',err);}}
 function bind(){const input=root.document?.querySelector?.('#global-search');if(!input||input.dataset.v4Bound)return;input.dataset.v4Bound='1';input.placeholder='Buscar empresa, processo, documento...';input.addEventListener('focus',ensureData);input.addEventListener('input',()=>render(search(input.value),input.value));input.addEventListener('keydown',e=>{if(e.key==='Escape')close();});}
 root.AtlasV4Search={buildIndex,search};
 if(root.document?.addEventListener){root.document.addEventListener('DOMContentLoaded',bind);setTimeout(bind,0);}
})(typeof window!=='undefined'?window:globalThis);
