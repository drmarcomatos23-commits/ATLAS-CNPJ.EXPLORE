(() => {
 'use strict';
 const DONE_DOC=new Set(['approved','waived']);
 const DONE_EXIGENCY=new Set(['accepted','cancelled']);
 const DONE_TASK=new Set(['completed','cancelled']);
 const DONE_COST=new Set(['paid','pago','quitado','received','recebido','cancelled','cancelado','reembolsado']);
 const ORIGINS=['cliente','financeiro','orgao','operacao'];
 const iso=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?Date.parse(value+'T00:00:00Z'):NaN;
 const status=value=>String(value||'pending').trim().toLowerCase();
 function summarize({requirements=[],costs=[],exigencies=[],tasks=[],asOf=new Date().toISOString().slice(0,10)}={}){
  const items=[];const seen=new Set();
  const add=(type,row,pending_with,due_on,title)=>{
   if(!row?.id)return;
   const key=type+':'+row.id;
   if(seen.has(key))return;
   seen.add(key);
   items.push({source_type:type,source_id:row.id,process_id:row.process_id||null,pending_with,status:row.status||row.payment_status||'pending',due_on:due_on||null,title:title||'Pendência'});
  };
  for(const r of requirements){if(!r.archived_at&&!DONE_DOC.has(status(r.status)))add('document',r,ORIGINS.includes(r.pending_with)?r.pending_with:'operacao',r.due_on,r.title);}
  for(const r of costs){if(!DONE_COST.has(status(r.payment_status)))add('cost',r,'financeiro',r.due_date||r.due_on,r.description);}
  for(const r of exigencies){if(!DONE_EXIGENCY.has(status(r.status)))add('exigency',r,'orgao',r.due_on,r.title);}
  for(const r of tasks){if(!DONE_TASK.has(status(r.status)))add('task',r,'operacao',r.due_at||r.due_date,r.title);}
  const byOrigin=Object.fromEntries(ORIGINS.map(o=>[o,0]));
  let overdue=0,dueSoon=0;
  const today=iso(asOf);
  for(const row of items){
   byOrigin[row.pending_with]++;
   const due=iso(row.due_on),days=Math.round((due-today)/86400000);
   if(Number.isFinite(days)){if(days<0)overdue++;else if(days<=3)dueSoon++;}
  }
  return {items,totalOpen:items.length,byOrigin,overdue,dueSoon};
 }
 window.AtlasOpsV72Pending=Object.freeze({summarize});
})();
