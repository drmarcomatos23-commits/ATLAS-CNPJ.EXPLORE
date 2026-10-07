(() => {
  const AUTO_TYPES=new Set(['federal','fgts','cndt','estadual']);
  const db=()=>window.atlasAuth?.client;
  const profile=()=>window.atlasAuth?.getProfile?.()||{};
  const digits=v=>String(v||'').replace(/\D/g,'');
  const notify=(msg,type='info')=>{const el=document.querySelector('#cert-query-feedback');if(el){el.hidden=false;el.className=`cert-query-feedback ${type}`;el.textContent=msg}else alert(msg)};
  const b64blob=b64=>{const clean=String(b64||'').replace(/^data:application\/pdf;base64,/,'');const bin=atob(clean);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:'application/pdf'})};
  async function persistPdf(cert,client,base64){if(!base64)return null;const org=profile().organization_id;if(!org)return null;const key=`${org}/${client.id}/${cert.cert_type}/${Date.now()}.pdf`;const {error}=await db().storage.from('atlas-certificates').upload(key,b64blob(base64),{contentType:'application/pdf',upsert:true});if(error)throw error;return key}
  async function getRecord(id){const {data:cert,error}=await db().from('atlas_certificates').select('*').eq('id',id).single();if(error)throw error;const {data:client,error:e2}=await db().from('clients').select('id,tax_id,city,state').eq('id',cert.client_id).single();if(e2)throw e2;return{cert,client}}
  async function runRecord(cert,client,interactive=true){
    if(!cert||!client)return{status:'error'};
    const api=await fetch(`/api/certificates?type=${encodeURIComponent(cert.cert_type)}&cnpj=${digits(client.tax_id)}&uf=${encodeURIComponent(client.state||'SP')}&city=${encodeURIComponent(client.city||'')}`,{cache:'no-store'});
    const out=await api.json();const now=new Date().toISOString();
    if(out.status==='success'&&out.certificate){
      let storageKey=cert.metadata?.storage_key||null;
      if(out.certificate.pdf_base64){try{storageKey=await persistPdf(cert,client,out.certificate.pdf_base64)}catch(e){console.warn('ATLAS certidões: PDF não armazenado',e)}}
      const metadata={...(cert.metadata||{}),connector:out,storage_key:storageKey,raw_status:out.certificate.raw_status||null,raw_status_text:out.certificate.raw_status_text||null,verification_url:out.certificate.verification_url||null,authority:out.certificate.authority||null,provider:out.provider||null};
      const {error}=await db().from('atlas_certificates').update({status:out.certificate.status||'pending',certificate_number:out.certificate.certificate_number||null,issued_at:out.certificate.issued_at||null,expires_at:out.certificate.expires_at||null,last_checked_at:now,source:out.source||'FiscalAPI',metadata}).eq('id',cert.id);if(error)throw error;
      if(interactive)notify(out.certificate.status==='irregular'?'Consulta concluída: a certidão indica irregularidade.':'Certidão consultada e atualizada automaticamente.',out.certificate.status==='irregular'?'warning':'success');
      return out;
    }
    await db().from('atlas_certificates').update({last_checked_at:now,source:out.source||cert.source,metadata:{...(cert.metadata||{}),connector:out}}).eq('id',cert.id);
    if(out.status==='processing'){if(interactive)notify(out.message||'Certidão em processamento. Consulte novamente em instantes.','info');return out}
    if(out.status==='requires_configuration'){if(interactive)notify('Integração automática preparada, mas a chave FiscalAPI ainda não está configurada.','warning');return out}
    if(out.status==='assisted'){if(interactive){notify(out.message||'Consulta assistida.','info');if(out.portal)window.open(out.portal,'_blank','noopener')}return out}
    if(interactive)notify(out.message||'Não foi possível concluir a consulta.','warning');return out;
  }
  async function runById(id,interactive=true){const {cert,client}=await getRecord(id);return runRecord(cert,client,interactive)}
  async function openPdf(id){const {cert}=await getRecord(id);if(cert.metadata?.storage_key){const {data,error}=await db().storage.from('atlas-certificates').createSignedUrl(cert.metadata.storage_key,3600);if(error)throw error;if(data?.signedUrl)window.open(data.signedUrl,'_blank','noopener');return}if(cert.pdf_url)window.open(cert.pdf_url,'_blank','noopener')}
  async function refreshAll(btn){const [{data:rows,error},{data:clients,error:e2}]=await Promise.all([db().from('atlas_certificates').select('*'),db().from('clients').select('id,tax_id,city,state').is('deleted_at',null)]);if(error||e2)throw(error||e2);const cmap=new Map((clients||[]).map(c=>[c.id,c]));let ok=0,assisted=0,pending=0,failed=0;for(const cert of rows||[]){const out=await runRecord(cert,cmap.get(cert.client_id),false);if(out?.status==='success')ok++;else if(out?.status==='assisted')assisted++;else if(out?.status==='requires_configuration'||out?.status==='processing')pending++;else failed++}notify(`Atualização concluída. Automáticas: ${ok}. Assistidas: ${assisted}. Pendentes de configuração/processamento: ${pending}. Falhas: ${failed}.`,'info');if(window.certificatesPage)await window.certificatesPage();if(btn){btn.disabled=false;btn.textContent='Atualizar todas'}}
  async function enhance(){const buttons=[...document.querySelectorAll('[data-cert-check]')];if(!buttons.length)return;const ids=buttons.map(b=>b.dataset.certCheck);const {data}=await db().from('atlas_certificates').select('id,cert_type,metadata,pdf_url').in('id',ids);const map=new Map((data||[]).map(r=>[r.id,r]));for(const b of buttons){const r=map.get(b.dataset.certCheck);if(!r)continue;if(AUTO_TYPES.has(r.cert_type))b.textContent='Consultar agora';const actions=b.closest('.cert-actions');if(actions&&(r.metadata?.storage_key||r.pdf_url)&&!actions.querySelector(`[data-cert-pdf="${r.id}"]`)){const p=document.createElement('button');p.type='button';p.className='cert-btn';p.dataset.certPdf=r.id;p.textContent='PDF';actions.appendChild(p)}}}
  document.addEventListener('click',async e=>{
    const check=e.target.closest?.('[data-cert-check]');if(check){e.preventDefault();e.stopImmediatePropagation();check.disabled=true;try{await runById(check.dataset.certCheck,true);if(window.certificatesPage)await window.certificatesPage()}catch(err){notify(`Falha na consulta: ${err?.message||err}`,'error')}finally{check.disabled=false}return}
    const pdf=e.target.closest?.('[data-cert-pdf]');if(pdf){e.preventDefault();e.stopImmediatePropagation();try{await openPdf(pdf.dataset.certPdf)}catch(err){notify(`Não foi possível abrir o PDF: ${err?.message||err}`,'error')}return}
    const all=e.target.closest?.('#cert-refresh-all');if(all){e.preventDefault();e.stopImmediatePropagation();all.disabled=true;all.textContent='Consultando...';try{await refreshAll(all)}catch(err){all.disabled=false;all.textContent='Atualizar todas';notify(`Falha na atualização: ${err?.message||err}`,'error')}return}
  },true);
  const mo=new MutationObserver(()=>{clearTimeout(window.__atlasCertEnhance);window.__atlasCertEnhance=setTimeout(()=>enhance().catch(()=>{}),80)});document.addEventListener('DOMContentLoaded',()=>{mo.observe(document.body,{childList:true,subtree:true});enhance().catch(()=>{})});
  window.AtlasCertificatesAuto={runById,refreshAll,enhance};
})();
