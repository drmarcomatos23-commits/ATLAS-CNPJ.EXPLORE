const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const stages=['Briefing','Viabilidade','DBE / Receita','Registro','Inscrições','Licenciamento'];
const clients=[
{id:'c1',name:'Alfa Participações Ltda',cnpj:'12.345.678/0001-10',city:'Santos/SP',contact:'Camila Souza'},
{id:'c2',name:'Beta Logística S.A.',cnpj:'22.345.678/0001-20',city:'São Paulo/SP',contact:'Rafael Lima'},
{id:'c3',name:'Clínica Horizonte Ltda',cnpj:'32.345.678/0001-30',city:'Praia Grande/SP',contact:'Ana Reis'}];
const processes=[
{id:'LEG-2026-041',client:'Alfa Participações Ltda',title:'Constituição Holding Patrimonial',stage:1,owner:'Mariana',deadline:'08/10/2026',progress:22,status:'Em andamento'},
{id:'LEG-2026-038',client:'Beta Logística S.A.',title:'Alteração de endereço e CNAEs',stage:3,owner:'Lucas',deadline:'03/10/2026',progress:51,status:'Em andamento'},
{id:'LEG-2026-035',client:'Clínica Horizonte Ltda',title:'Licença Sanitária + AVCB',stage:5,owner:'Fernanda',deadline:'30/09/2026',progress:78,status:'Pendência'}];
const protocols=[
{proc:'LEG-2026-041',org:'Prefeitura de Santos',kind:'Viabilidade',num:'VIA-2026-77831',status:'Em análise'},
{proc:'LEG-2026-038',org:'JUCESP',kind:'Registro',num:'SPN2601188002',status:'Deferido'}];
const costs=[
{proc:'LEG-2026-041',desc:'Taxa de registro',type:'DARE',amount:'R$ 286,52',status:'Pago'},
{proc:'LEG-2026-035',desc:'Taxa sanitária municipal',type:'Taxa Municipal',amount:'R$ 412,80',status:'Pago'},
{proc:'LEG-2026-038',desc:'Emolumentos',type:'Junta Comercial',amount:'R$ 175,00',status:'A pagar'}];
const licenses=[
{client:'Clínica Horizonte Ltda',name:'Licença Sanitária',exp:'22/10/2026',status:'Vencendo'},
{client:'Beta Logística S.A.',name:'AVCB - Unidade SP',exp:'14/03/2027',status:'Regular'},
{client:'Alfa Participações Ltda',name:'Alvará de Funcionamento',exp:'15/12/2026',status:'Atenção'}];

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function digits(v){return String(v??'').replace(/\D/g,'')}
function formatCnpj(v){const d=digits(v).slice(0,14);return d.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\/\d{4})(\d)/,'$1-$2')}
function validCnpj(v){const d=digits(v);if(d.length!==14||/^(\d)\1{13}$/.test(d))return false;const dv=(base,w)=>{const s=[...base].reduce((a,x,i)=>a+Number(x)*w[i],0);return s%11<2?0:11-s%11};const a=dv(d.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]);const b=dv(d.slice(0,12)+a,[6,5,4,3,2,9,8,7,6,5,4,3,2]);return d.endsWith(`${a}${b}`)}
function money(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n):'Não informado'}
function date(v){if(!v)return'Não informado';const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));return m?`${m[3]}/${m[2]}/${m[1]}`:String(v)}
function pill(s){const c=/defer|regular|pago|ativa/i.test(s)?'ok':/pend|venc|inativa|baixada/i.test(s)?'bad':/anál|aten|pagar/i.test(s)?'warn':'neutral';return `<span class="pill ${c}">${esc(s)}</span>`}
function setHead(title,kicker,desc){$('#page-title').textContent=title;$('#page-kicker').textContent=kicker||'ATLAS';$('#page-desc').textContent=desc||''}
let atlasCurrentProfile=null;
function initials(name){return String(name||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
function showApp(profile){
 atlasCurrentProfile=profile||{};
 $('#login-screen').classList.add('hidden');
 $('#app-shell').classList.remove('hidden');
 const role=atlasCurrentProfile.role||'cliente';
 $('[data-roles]').forEach(el=>{
   const allowed=(el.dataset.roles||'').split(',').map(x=>x.trim());
   el.classList.toggle('hidden',!allowed.includes(role));
 });
 const fullName=atlasCurrentProfile.full_name||'Usuário';
 $('#user-name').textContent=fullName;
 $('#user-role').textContent=window.atlasAuth?.roleLabel?.(role)||role;
 $('#user-avatar').textContent=initials(fullName);
 const newBtn=$('#new-process-btn');
 if(newBtn)newBtn.classList.toggle('hidden',!['admin','operacao'].includes(role));
 const firstVisible=$('#nav [data-page]:not(.hidden)');
 $('#nav [data-page]').forEach(x=>x.classList.remove('active'));
 if(firstVisible)firstVisible.classList.add('active');
 render(firstVisible?.dataset.page||'dashboard');
}
function hideAtlasApp(){
 $('#app-shell').classList.add('hidden');
 $('#login-screen').classList.remove('hidden');
 atlasCurrentProfile=null;
}
window.showApp=showApp;
window.hideAtlasApp=hideAtlasApp;

$('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b)return;$$('[data-page]').forEach(x=>x.classList.remove('active'));b.classList.add('active');render(b.dataset.page)});

function render(page){
 if(page==='dashboard')return dashboard();if(page==='processos')return processPage();if(page==='clientes')return clientPage();if(page==='protocolos')return protocolPage();if(page==='custos')return costPage();if(page==='licencas')return licensePage();if(page==='integracoes')return integrationPage();if(page==='documentos')return docsPage();if(page==='relatorios')return reportsPage();if(page==='conhecimento')return window.knowledgePage?.();if(page==='treinamento')return window.trainingPage?.();if(page==='usuarios')return usersPage();if(page==='config')return configPage();
}
function page(html){$('#page-content').innerHTML=html}
function dashboard(){
 setHead('Dashboard','VISÃO GERAL','Acompanhe processos, pendências, custos e vencimentos em um único painel.');
 page(`<div class="grid kpi-grid">
  <div class="surface kpi"><span class="kpi-label">Processos ativos</span><strong>${processes.length}</strong><small>Fluxos em andamento</small></div>
  <div class="surface kpi"><span class="kpi-label">Licenças em atenção</span><strong>2</strong><small>Alertas 90/60/30 dias</small></div>
  <div class="surface kpi"><span class="kpi-label">Protocolos monitorados</span><strong>${protocols.length}</strong><small>Órgãos e registros</small></div>
  <div class="surface kpi"><span class="kpi-label">Custos controlados</span><strong>R$ 874</strong><small>Taxas e reembolsos</small></div>
 </div>
 <div class="grid two-col" style="margin-top:16px"><section class="surface pad"><div class="section-head"><h2>Processos recentes</h2><span>Atualização operacional</span></div>${processTable()}</section>
 <section class="surface pad"><div class="section-head"><h2>Vencimentos</h2><span>Próximos alertas</span></div><div class="alert-list">${licenses.map(l=>`<div class="alert-item"><div><strong>${esc(l.name)}</strong><div class="muted" style="font-size:10px;margin-top:3px">${esc(l.client)}</div></div><div class="date">${esc(l.exp)}<br>${pill(l.status)}</div></div>`).join('')}</div></section></div>`)
}
function processTable(){return `<div class="table-wrap"><table><thead><tr><th>Processo</th><th>Cliente</th><th>Etapa</th><th>Responsável</th><th>Status</th></tr></thead><tbody>${processes.map(p=>`<tr><td><strong>${p.id}</strong><div class="muted">${esc(p.title)}</div></td><td>${esc(p.client)}</td><td>${stages[p.stage]}</td><td>${p.owner}</td><td>${pill(p.status)}</td></tr>`).join('')}</tbody></table></div>`}
function processPage(){setHead('Processos','LEGALIZAÇÃO','Gerencie cada processo por etapa, responsável, prazo e pendência.');let cols=stages.map((s,i)=>{const list=processes.filter(p=>p.stage===i);return `<div class="kanban-col"><div class="kanban-title"><span>${s}</span><span>${list.length}</span></div>${list.map(p=>`<article class="task-card"><b>${p.id}</b><strong>${esc(p.client)}</strong><p>${esc(p.title)}</p><div class="bar"><i style="width:${p.progress}%"></i></div><p>${p.owner} · ${p.deadline}</p></article>`).join('')}</div>`}).join('');page(`<section class="surface pad"><div class="section-head"><h2>Pipeline de legalização</h2><span>${processes.length} processos</span></div><div class="kanban">${cols}</div></section>`)}
function clientPage(){setHead('Empresas e clientes','CADASTRO','Cadastros empresariais, responsáveis e briefing de legalização.');page(`<section class="surface pad"><div class="section-head"><h2>Empresas cadastradas</h2><button class="btn btn-primary" onclick="alert('Cadastro completo será ativado com o banco de dados.')">＋ Nova empresa</button></div><div class="table-wrap"><table><thead><tr><th>Empresa</th><th>CNPJ</th><th>Cidade</th><th>Contato</th></tr></thead><tbody>${clients.map(c=>`<tr><td><strong>${c.name}</strong></td><td>${c.cnpj}</td><td>${c.city}</td><td>${c.contact}</td></tr>`).join('')}</tbody></table></div></section>`)}
function protocolPage(){setHead('Protocolos','CONTROLE','Acompanhe números de protocolo, órgãos e situação de cada solicitação.');page(`<section class="surface pad"><div class="section-head"><h2>Protocolos registrados</h2><span>${protocols.length} itens</span></div><div class="table-wrap"><table><thead><tr><th>Processo</th><th>Órgão</th><th>Tipo</th><th>Protocolo</th><th>Status</th></tr></thead><tbody>${protocols.map(p=>`<tr><td>${p.proc}</td><td>${p.org}</td><td>${p.kind}</td><td><strong>${p.num}</strong></td><td>${pill(p.status)}</td></tr>`).join('')}</tbody></table></div></section>`)}
function costPage(){setHead('Custos e taxas','FINANCEIRO','Controle DARE, DARF, taxas municipais, emolumentos e reembolsos.');page(`<section class="surface pad"><div class="section-head"><h2>Custos do processo</h2><span>Taxas e reembolsos</span></div><div class="table-wrap"><table><thead><tr><th>Processo</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Status</th></tr></thead><tbody>${costs.map(c=>`<tr><td>${c.proc}</td><td>${c.desc}</td><td>${c.type}</td><td><strong>${c.amount}</strong></td><td>${pill(c.status)}</td></tr>`).join('')}</tbody></table></div></section>`)}
function licensePage(){setHead('Licenças','RENOVAÇÕES','Monitore validade e renovações com alertas de 90, 60 e 30 dias.');page(`<section class="surface pad"><div class="section-head"><h2>Licenças e alvarás</h2><span>Alertas recorrentes</span></div><div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Documento</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>${licenses.map(l=>`<tr><td>${l.client}</td><td><strong>${l.name}</strong></td><td>${l.exp}</td><td>${pill(l.status)}</td></tr>`).join('')}</tbody></table></div></section>`)}
async function docsPage(){
 setHead('Documentos','DOSSIÊ DIGITAL','Armazene e acesse documentos privados vinculados a empresas e processos.');
 page('<div class="loading-box"><span class="spinner"></span><div>Carregando documentos...</div></div>');
 const db=atlasDb();
 if(!db){page('<div class="error-box">Storage indisponível.</div>');return}

 const profile=atlasProfile();
 const canUpload=['admin','operacao','financeiro'].includes(profile.role);
 const canDelete=['admin','operacao'].includes(profile.role);

 const [docsRes,clientsRes,processesRes]=await Promise.all([
   db.from('documents').select('*').order('created_at',{ascending:false}),
   db.from('clients').select('id,legal_name').order('legal_name',{ascending:true}),
   db.from('processes').select('id,public_code,title,client_id').order('created_at',{ascending:false})
 ]);

 if(docsRes.error){
   page('<div class="error-box">Não foi possível carregar os documentos: '+esc(docsRes.error.message)+'</div>');
   return;
 }

 const docs=docsRes.data||[];
 const clients=clientsRes.error?[]:(clientsRes.data||[]);
 const processes=processesRes.error?[]:(processesRes.data||[]);
 const cm=new Map(clients.map(x=>[x.id,x]));
 const pm=new Map(processes.map(x=>[x.id,x]));

 page(`<section class="surface pad">
  <div class="section-head">
    <div><h2>Dossiê de documentos</h2><span>${docs.length} arquivo(s) armazenado(s)</span></div>
    ${canUpload?'<button class="btn btn-primary" onclick="openDocumentModal()">＋ Documento</button>':''}
  </div>
  <div class="source-note" style="margin-bottom:14px"><strong>Storage privado ativo.</strong> Os arquivos não possuem URL pública. O acesso é autenticado e controlado pelas permissões do usuário.</div>
  ${docs.length?`<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Categoria</th><th>Empresa</th><th>Processo</th><th>Tamanho</th><th>Enviado em</th><th>Ações</th></tr></thead><tbody>${docs.map(d=>`<tr>
   <td><strong>${esc(d.name)}</strong><div class="muted">${esc(d.mime_type||'Arquivo')}</div></td>
   <td>${esc(d.category||'Geral')}</td>
   <td>${esc(cm.get(d.client_id)?.legal_name||'—')}</td>
   <td>${esc(pm.get(d.process_id)?.public_code||'—')}</td>
   <td>${formatBytes(d.size_bytes)}</td>
   <td>${d.created_at?new Date(d.created_at).toLocaleString('pt-BR'):'—'}</td>
   <td><div class="row-actions"><button class="mini-btn" onclick="openStoredDocument('${d.id}')">Abrir</button>${canDelete?`<button class="mini-btn danger" onclick="deleteStoredDocument('${d.id}')">Excluir</button>`:''}</div></td>
  </tr>`).join('')}</tbody></table></div>`:emptyState('Nenhum documento armazenado','Use “+ Documento” para enviar o primeiro arquivo para o Storage privado.') }
 </section>`);
}

function formatBytes(value){
 const n=Number(value||0);
 if(!n)return '—';
 if(n<1024)return n+' B';
 if(n<1048576)return (n/1024).toLocaleString('pt-BR',{maximumFractionDigits:1})+' KB';
 return (n/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB';
}

function safeFileName(name){
 return String(name||'arquivo')
   .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .replace(/[^a-zA-Z0-9._-]+/g,'-')
   .replace(/-+/g,'-')
   .slice(-120);
}

async function openDocumentModal(){
 const db=atlasDb();
 const profile=atlasProfile();
 if(!['admin','operacao','financeiro'].includes(profile.role))return;

 const [clientsRes,processesRes]=await Promise.all([
   db.from('clients').select('id,legal_name').order('legal_name',{ascending:true}),
   db.from('processes').select('id,public_code,title,client_id').order('created_at',{ascending:false})
 ]);
 const clients=clientsRes.data||[], processes=processesRes.data||[];

 modalShell('Enviar documento',`<form id="document-upload-form" class="modal-form-grid">
   <div class="field span-2"><label>Arquivo *</label><input id="doc-file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"></div>
   <div class="field"><label>Empresa</label><select id="doc-client"><option value="">Sem vínculo</option>${clients.map(x=>`<option value="${x.id}">${esc(x.legal_name)}</option>`).join('')}</select></div>
   <div class="field"><label>Processo</label><select id="doc-process"><option value="">Sem vínculo</option>${processes.map(x=>`<option value="${x.id}" data-client="${x.client_id||''}">${esc(x.public_code+' · '+x.title)}</option>`).join('')}</select></div>
   <div class="field"><label>Categoria</label><select id="doc-category"><option>Societário</option><option>Documento pessoal</option><option>Comprovante</option><option>Protocolo</option><option>Licença</option><option>Fiscal</option><option>Contrato</option><option>Outros</option></select></div>
   <div class="field"><label>Nome no sistema</label><input id="doc-name" placeholder="Usará o nome do arquivo se vazio"></div>
   <div class="modal-actions span-2"><button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button id="doc-upload-btn" class="btn btn-primary" type="submit">Enviar arquivo</button></div>
   <div id="doc-upload-message" class="auth-message hidden span-2"></div>
 </form>`);

 const processSelect=$('#doc-process');
 processSelect?.addEventListener('change',()=>{
   const opt=processSelect.selectedOptions?.[0];
   const cid=opt?.dataset?.client;
   if(cid)$('#doc-client').value=cid;
 });

 $('#document-upload-form').addEventListener('submit',async e=>{
   e.preventDefault();
   const file=$('#doc-file').files?.[0];
   const msg=$('#doc-upload-message'),btn=$('#doc-upload-btn');
   if(!file)return;
   if(file.size>50*1024*1024){msg.textContent='O arquivo excede o limite de 50 MB.';msg.className='auth-message error span-2';return}

   btn.disabled=true;btn.textContent='Enviando...';msg.className='auth-message hidden span-2';

   const clientId=$('#doc-client').value||null;
   const processId=$('#doc-process').value||null;
   const fileName=safeFileName(file.name);
   const objectKey=`${profile.organization_id}/${clientId||'sem-empresa'}/${processId||'sem-processo'}/${crypto.randomUUID()}-${fileName}`;

   const {error:uploadError}=await db.storage.from('legalizacao-documents').upload(objectKey,file,{upsert:false,contentType:file.type||undefined});
   if(uploadError){
     msg.textContent='Falha no upload: '+uploadError.message;msg.className='auth-message error span-2';btn.disabled=false;btn.textContent='Enviar arquivo';return;
   }

   const {error:metaError}=await db.from('documents').insert({
     organization_id:profile.organization_id,
     client_id:clientId,
     process_id:processId,
     name:$('#doc-name').value.trim()||file.name,
     category:$('#doc-category').value,
     storage_key:objectKey,
     mime_type:file.type||null,
     size_bytes:file.size,
     uploaded_by:profile.id
   });

   if(metaError){
     await db.storage.from('legalizacao-documents').remove([objectKey]);
     msg.textContent='Falha ao registrar documento: '+metaError.message;msg.className='auth-message error span-2';btn.disabled=false;btn.textContent='Enviar arquivo';return;
   }

   closeAtlasModal();
   await docsPage();
 });
}
window.openDocumentModal=openDocumentModal;

async function openStoredDocument(id){
 const db=atlasDb();
 const {data:doc,error}=await db.from('documents').select('id,name,storage_key').eq('id',id).single();
 if(error||!doc)return alert('Documento não encontrado.');
 const {data,error:signError}=await db.storage.from('legalizacao-documents').createSignedUrl(doc.storage_key,300);
 if(signError||!data?.signedUrl)return alert('Não foi possível gerar o acesso ao arquivo: '+(signError?.message||'erro'));
 window.open(data.signedUrl,'_blank','noopener,noreferrer');
}
window.openStoredDocument=openStoredDocument;

async function deleteStoredDocument(id){
 if(!confirm('Excluir este documento definitivamente do Storage? Esta ação não poderá ser desfeita.'))return;
 const db=atlasDb();
 const {data:doc,error}=await db.from('documents').select('id,storage_key').eq('id',id).single();
 if(error||!doc)return alert('Documento não encontrado.');
 const {error:storageError}=await db.storage.from('legalizacao-documents').remove([doc.storage_key]);
 if(storageError)return alert('Não foi possível excluir o arquivo: '+storageError.message);
 const {error:metaError}=await db.from('documents').delete().eq('id',id);
 if(metaError)return alert('Arquivo removido, mas houve falha ao remover o registro: '+metaError.message);
 await docsPage();
}
window.deleteStoredDocument=deleteStoredDocument;

async function reportsPage(){
 setHead('Relatórios','GESTÃO','Indicadores calculados exclusivamente com os dados reais cadastrados no ATLAS.');
 page('<div class="loading-box"><span class="spinner"></span><div>Calculando indicadores...</div></div>');
 const db=atlasDb();
 if(!db){page('<div class="error-box">Banco de dados indisponível.</div>');return}

 const now=new Date();
 const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
 const nextMonth=new Date(now.getFullYear(),now.getMonth()+1,1);
 const in90=new Date(now.getTime()+90*86400000);

 const [procRes,licRes,costRes,protoRes]=await Promise.all([
   db.from('processes').select('id,status,started_at,completed_at,created_at,due_date,priority,title,public_code').order('created_at',{ascending:false}),
   db.from('licenses').select('id,name,status,expires_at,client_id').order('expires_at',{ascending:true}),
   db.from('costs').select('id,amount,payment_status,created_at'),
   db.from('protocols').select('id,status,agency,protocol_type,protocol_number')
 ]);

 if(procRes.error){page('<div class="error-box">Não foi possível carregar os relatórios: '+esc(procRes.error.message)+'</div>');return}

 const procs=procRes.data||[];
 const licenses=licRes.error?[]:(licRes.data||[]);
 const costs=costRes.error?[]:(costRes.data||[]);
 const protocols=protoRes.error?[]:(protoRes.data||[]);

 const completed=procs.filter(p=>p.status==='completed'&&p.completed_at);
 const completedThisMonth=completed.filter(p=>{
   const d=new Date(p.completed_at);
   return d>=monthStart&&d<nextMonth;
 }).length;

 const durations=completed.map(p=>{
   const start=new Date(p.started_at||p.created_at);
   const end=new Date(p.completed_at);
   return (end-start)/86400000;
 }).filter(v=>Number.isFinite(v)&&v>=0);
 const avgDays=durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null;

 const pending=procs.filter(p=>p.status==='pending').length;
 const renewals=licenses.filter(l=>{
   if(!l.expires_at)return false;
   const d=new Date(l.expires_at+'T12:00:00');
   return d>=now&&d<=in90;
 }).length;
 const active=procs.filter(p=>!['completed','cancelled'].includes(p.status)).length;
 const overdue=procs.filter(p=>p.due_date&&!['completed','cancelled'].includes(p.status)&&new Date(p.due_date+'T23:59:59')<now).length;
 const totalCosts=costs.reduce((s,c)=>s+(Number(c.amount)||0),0);
 const openProtocols=protocols.filter(p=>!/(deferido|conclu[ií]do|finalizado|encerrado)/i.test(String(p.status||''))).length;

 const recentCompleted=completed.slice(0,5);
 const upcomingLicenses=licenses.filter(l=>l.expires_at&&new Date(l.expires_at+'T12:00:00')>=now).slice(0,5);

 page(`
  <div class="grid kpi-grid">
   <div class="surface kpi"><span class="kpi-label">Tempo médio</span><strong>${avgDays===null?'—':avgDays.toLocaleString('pt-BR',{maximumFractionDigits:1})+'d'}</strong><small>${durations.length?'Processos concluídos':'Sem processos concluídos'}</small></div>
   <div class="surface kpi"><span class="kpi-label">Concluídos</span><strong>${completedThisMonth}</strong><small>No mês atual</small></div>
   <div class="surface kpi"><span class="kpi-label">Pendências</span><strong>${pending}</strong><small>Exigem ação</small></div>
   <div class="surface kpi"><span class="kpi-label">Renovações</span><strong>${renewals}</strong><small>Próximos 90 dias</small></div>
  </div>
  <div class="grid kpi-grid" style="margin-top:16px">
   <div class="surface kpi"><span class="kpi-label">Processos ativos</span><strong>${active}</strong><small>Em aberto</small></div>
   <div class="surface kpi"><span class="kpi-label">Prazos vencidos</span><strong>${overdue}</strong><small>Processos não concluídos</small></div>
   <div class="surface kpi"><span class="kpi-label">Custos registrados</span><strong>${money(totalCosts)}</strong><small>Valores cadastrados</small></div>
   <div class="surface kpi"><span class="kpi-label">Protocolos em aberto</span><strong>${openProtocols}</strong><small>Não encerrados</small></div>
  </div>
  <div class="grid two-col" style="margin-top:16px">
   <section class="surface pad">
    <div class="section-head"><h2>Concluídos recentemente</h2><span>Base real</span></div>
    ${recentCompleted.length?`<div class="table-wrap"><table><thead><tr><th>Processo</th><th>Título</th><th>Conclusão</th></tr></thead><tbody>${recentCompleted.map(p=>`<tr><td><strong>${esc(p.public_code||'—')}</strong></td><td>${esc(p.title||'—')}</td><td>${new Date(p.completed_at).toLocaleDateString('pt-BR')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="muted" style="padding:20px 0">Nenhum processo concluído.</div>'}
   </section>
   <section class="surface pad">
    <div class="section-head"><h2>Próximas renovações</h2><span>Licenças</span></div>
    ${upcomingLicenses.length?`<div class="alert-list">${upcomingLicenses.map(l=>`<div class="alert-item"><div><strong>${esc(l.name||'Licença')}</strong><div class="muted" style="font-size:10px;margin-top:3px">${esc(l.status||'')}</div></div><div class="date">${fmtDateBR(l.expires_at)}</div></div>`).join('')}</div>`:'<div class="muted" style="padding:20px 0">Nenhuma renovação cadastrada.</div>'}
   </section>
  </div>
 `);
}
function configPage(){setHead('Configurações','SISTEMA','Usuários, perfis, storage e parâmetros operacionais.');page(`<section class="surface pad"><div class="section-head"><h2>Ambiente</h2><span>Produção</span></div><div class="data-list"><div class="data-row"><span>Modo</span><strong>Sistema autenticado</strong></div><div class="data-row"><span>Supabase</span><strong>Ativo · Auth, banco, RLS e Edge Functions</strong></div><div class="data-row"><span>Documentos</span><strong>Ativo · Storage privado</strong></div><div class="data-row"><span>Comunicações</span><strong>E-mail ainda não configurado</strong></div></div></section>`)}

function integrationPage(){
 setHead('Integrações','APIs E CONECTORES','Conecte e consulte fontes oficiais e serviços auxiliares para agilizar seus processos.');
 page(`<div class="grid integration-layout"><section class="surface cnpj-card">
  <div class="section-head"><div class="title-with-icon"><div class="title-icon">▦</div><div><h2>Consulta CNPJ</h2><p>Consulta empresarial completa no padrão ATLAS Explore, com CNPJws e fallback BrasilAPI.</p></div></div></div>
  <form id="cnpj-form" class="cnpj-form"><div class="input-shell"><input id="cnpj-input" inputmode="numeric" placeholder="00.000.000/0000-00" maxlength="18" autocomplete="off"><span id="input-count" class="input-count">0/14</span></div><button id="cnpj-button" class="btn btn-primary" type="submit">⌕ Consultar</button></form>
  <div id="cnpj-feedback" class="cnpj-feedback">Digite os 14 números do CNPJ. A validação dos dígitos é automática.</div><div id="cnpj-result"></div>
 </section>
 <aside class="surface integration-status"><div class="section-head"><h2>Status das integrações</h2></div>
  ${integrationRow('DB','CNPJws','Consulta cadastral CNPJ','Ativa','ok')}${integrationRow('IB','IBGE','UF e municípios','Ativa','ok')}${integrationRow('SB','Supabase','Auth, banco, Storage, RLS e Edge Functions','Ativa','ok')}
  <div class="integration-info"><strong>Status atual</strong>Supabase está em operação com autenticação, banco, RLS, Edge Functions e Storage privado de documentos.</div>
 </aside></div>`);
 bindCnpj();
}
function integrationRow(icon,name,desc,status,cls){return `<div class="integration-row"><div class="integration-icon">${icon}</div><div><strong>${name}</strong><small>${desc}</small></div>${pillWithClass(status,cls)}</div>`}
function pillWithClass(s,c){return `<span class="pill ${c}">${esc(s)}</span>`}
function bindCnpj(){const input=$('#cnpj-input'),form=$('#cnpj-form'),feedback=$('#cnpj-feedback');input.addEventListener('input',()=>{input.value=formatCnpj(input.value);const n=digits(input.value);$('#input-count').textContent=`${n.length}/14`;feedback.textContent=n.length===14&&!validCnpj(n)?'CNPJ inválido: verifique os dígitos informados.':'Digite os 14 números do CNPJ. A validação dos dígitos é automática.'});form.addEventListener('submit',lookupCnpj)}
async function lookupCnpj(e){e.preventDefault();const n=digits($('#cnpj-input').value),out=$('#cnpj-result'),btn=$('#cnpj-button');if(!validCnpj(n)){out.innerHTML='<div class="error-box">Informe um CNPJ válido com 14 dígitos.</div>';return}btn.disabled=true;btn.textContent='Consultando...';out.innerHTML='<div class="loading-box"><span class="spinner"></span><div><strong>Consultando cadastro empresarial</strong><div style="font-size:10px;margin-top:3px">Buscando dados na CNPJws...</div></div></div>';
 try{const r=await fetch(`/api/cnpj?cnpj=${encodeURIComponent(n)}`,{headers:{Accept:'application/json'}});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.detalhes||d?.titulo||`Falha HTTP ${r.status}`);out.innerHTML=renderCompany(d,n)}catch(err){out.innerHTML=`<div class="error-box"><strong>Não foi possível consultar.</strong><br>${esc(err.message||'Tente novamente em instantes.')}</div>`}finally{btn.disabled=false;btn.textContent='⌕ Consultar'}}
function renderCompany(d,n){const e=d.estabelecimento||{};const status=String(e.situacao_cadastral||'Não informada');const sclass=/ativa/i.test(status)?'ok':/baix|inap|susp/i.test(status)?'bad':'warn';const city=typeof e.cidade==='object'?e.cidade?.nome:e.cidade;const uf=typeof e.estado==='object'?e.estado?.sigla:e.estado;const street=[e.tipo_logradouro,e.logradouro].filter(Boolean).join(' ');const address=[street,e.numero,e.complemento,e.bairro,e.cep?`CEP ${String(e.cep).replace(/(\d{5})(\d{3})/,'$1-$2')}`:'',[city,uf].filter(Boolean).join('/ ')].filter(Boolean).join(' · ');const main=e.atividade_principal||{};const secondary=Array.isArray(e.atividades_secundarias)?e.atividades_secundarias:Array.isArray(e.atividade_secundaria)?e.atividade_secundaria:[];const partners=Array.isArray(d.socios)?d.socios:[];const nature=d.natureza_juridica?.descricao||d.natureza_juridica||'Não informado';const porte=d.porte?.descricao||d.porte||'Não informado';return `<div class="company-result">
 <div class="company-hero"><div class="company-symbol">▥</div><div class="company-meta"><span class="eyebrow">EMPRESA ENCONTRADA</span><h3>${esc(d.razao_social||e.nome_fantasia||'Razão social não informada')}</h3><p>CNPJ ${esc(formatCnpj(e.cnpj||n))}${e.nome_fantasia?` · ${esc(e.nome_fantasia)}`:''}</p></div><div class="company-status ${sclass}"><strong>${esc(status)}</strong><span>Situação cadastral</span></div></div>
 <div class="grid company-grid"><div class="data-card"><h4>▤ Dados cadastrais</h4><div class="data-list">${dataRow('CNPJ',formatCnpj(e.cnpj||n))}${dataRow('Razão social',d.razao_social)}${dataRow('Nome fantasia',e.nome_fantasia||'—')}${dataRow('Capital social',money(d.capital_social))}${dataRow('Natureza jurídica',nature)}${dataRow('Porte',porte)}${dataRow('Início da atividade',date(e.data_inicio_atividade))}</div></div>
 <div class="stack"><div class="data-card"><h4>◉ Situação da empresa</h4><div class="status-panel"><span class="status-dot"></span><div><strong>${esc(status)}</strong><small>Situação cadastral informada pela base consultada.</small></div></div></div><div class="data-card"><h4>⌖ Localização</h4><div class="address-line">${esc(address||'Endereço não informado')}</div></div></div></div>
 <div class="grid company-grid"><div class="data-card"><h4>▦ Atividades econômicas</h4><div class="activity-list">${mini(main.id||main.codigo||'CNAE principal',main.descricao||'Não informado')}${secondary.slice(0,5).map(x=>mini(x.id||x.codigo||'CNAE secundário',x.descricao||'')).join('')}${secondary.length>5?`<div class="muted" style="font-size:9px">+ ${secondary.length-5} atividades secundárias</div>`:''}</div></div><div class="data-card"><h4>◫ Quadro societário</h4><div class="partner-list">${partners.length?partners.slice(0,6).map(p=>mini(p.nome||p.razao_social||'Sócio',p.qualificacao_socio?.descricao||p.qualificacao_socio||p.tipo||'Participação societária')).join(''):'<div class="muted" style="font-size:10px">Quadro societário não informado pela consulta.</div>'}</div></div></div>
 <div class="source-note"><strong>Fonte da consulta cadastral:</strong> ${esc(d._atlas_source||'CNPJws')}, com dados públicos do Cadastro Nacional da Pessoa Jurídica. Para atos formais, protocolos e decisões, confirme as informações nos canais oficiais da Receita Federal e do órgão de registro competente.</div>
 </div>`}
function dataRow(label,value){return `<div class="data-row"><span>${esc(label)}</span><strong>${esc(value??'Não informado')}</strong></div>`}function mini(title,desc){return `<div class="mini-item"><strong>${esc(title)}</strong><span>${esc(desc)}</span></div>`}


async function usersPage(){
 setHead('Usuários','ACESSOS E PERMISSÕES','Crie e gerencie os acessos ao ATLAS por função.');
 page(`<div class="grid users-layout">
  <section class="surface pad">
    <div class="section-head"><div><h2>Novo usuário</h2><span>O usuário receberá acesso conforme o perfil definido.</span></div></div>
    <form id="user-create-form" class="user-form-grid">
      <div class="field"><label>Nome completo</label><input id="new-user-name" required placeholder="Nome do usuário"></div>
      <div class="field"><label>E-mail</label><input id="new-user-email" type="email" required placeholder="usuario@empresa.com.br"></div>
      <div class="field"><label>Perfil</label><select id="new-user-role" required><option value="operacao">Legalização / Operação</option><option value="financeiro">Financeiro</option><option value="auditoria">Auditoria</option><option value="cliente">Cliente</option><option value="admin">Administrador</option></select></div>
      <div class="field"><label>Senha temporária</label><input id="new-user-password" type="password" minlength="10" required placeholder="Mínimo 10 caracteres"></div>
      <div class="user-form-actions"><button id="create-user-btn" class="btn btn-primary" type="submit">＋ Criar acesso</button></div>
    </form>
    <div id="user-create-message" class="auth-message hidden"></div>
  </section>
  <section class="surface pad users-list-card">
    <div class="section-head"><div><h2>Usuários cadastrados</h2><span id="users-count">Carregando...</span></div><button id="refresh-users-btn" class="btn btn-muted" type="button">Atualizar</button></div>
    <div id="users-list"><div class="loading-box"><span class="spinner"></span><div>Carregando usuários...</div></div></div>
  </section>
 </div>`);
 $('#user-create-form')?.addEventListener('submit',createAtlasUser);
 $('#refresh-users-btn')?.addEventListener('click',loadAtlasUsers);
 await loadAtlasUsers();
}

function roleName(role){return window.atlasAuth?.roleLabel?.(role)||role}
function userStatusBadge(active){return active?'<span class="pill ok">Ativo</span>':'<span class="pill bad">Desativado</span>'}

async function loadAtlasUsers(){
 const box=$('#users-list'); if(!box)return;
 box.innerHTML='<div class="loading-box"><span class="spinner"></span><div>Carregando usuários...</div></div>';
 try{
   const data=await window.atlasAuth.adminRequest({action:'list'});
   const users=data.users||[];
   $('#users-count').textContent=users.length+' '+(users.length===1?'usuário':'usuários');
   box.innerHTML=`<div class="table-wrap"><table class="users-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th>Ações</th></tr></thead><tbody>${users.map(u=>`<tr>
     <td><strong>${esc(u.fullName||'Sem nome')}</strong><div class="muted">${esc(u.email||'')}</div></td>
     <td><select class="user-role-select" data-user-id="${u.id}" ${u.id===atlasCurrentProfile?.id?'disabled':''}><option value="admin" ${u.role==='admin'?'selected':''}>Administrador</option><option value="operacao" ${u.role==='operacao'?'selected':''}>Operação</option><option value="financeiro" ${u.role==='financeiro'?'selected':''}>Financeiro</option><option value="auditoria" ${u.role==='auditoria'?'selected':''}>Auditoria</option><option value="cliente" ${u.role==='cliente'?'selected':''}>Cliente</option></select></td>
     <td>${userStatusBadge(u.active)}</td>
     <td class="muted">${u.lastSignInAt?new Date(u.lastSignInAt).toLocaleString('pt-BR'):'Nunca'}</td>
     <td><div class="user-actions"><button class="mini-btn" data-user-action="save" data-user-id="${u.id}" ${u.id===atlasCurrentProfile?.id?'disabled':''}>Salvar perfil</button><button class="mini-btn ${u.active?'danger':''}" data-user-action="toggle" data-user-id="${u.id}" data-active="${u.active}" ${u.id===atlasCurrentProfile?.id?'disabled':''}>${u.active?'Desativar':'Ativar'}</button><button class="mini-btn" data-user-action="password" data-user-id="${u.id}">Redefinir senha</button></div></td>
   </tr>`).join('')}</tbody></table></div>`;
   box.querySelectorAll('[data-user-action]').forEach(btn=>btn.addEventListener('click',handleUserAction));
 }catch(err){box.innerHTML=`<div class="error-box">${esc(err.message||'Falha ao carregar usuários.')}</div>`}
}

async function createAtlasUser(e){
 e.preventDefault();
 const msg=$('#user-create-message'),btn=$('#create-user-btn');
 const payload={action:'create',fullName:$('#new-user-name').value.trim(),email:$('#new-user-email').value.trim(),role:$('#new-user-role').value,password:$('#new-user-password').value};
 msg.className='auth-message hidden';btn.disabled=true;btn.textContent='Criando...';
 try{
   await window.atlasAuth.adminRequest(payload);
   msg.textContent='Usuário criado com sucesso.';msg.className='auth-message success';
   e.target.reset();await loadAtlasUsers();
 }catch(err){msg.textContent=err.message||'Falha ao criar usuário.';msg.className='auth-message error'}
 finally{btn.disabled=false;btn.textContent='＋ Criar acesso'}
}

async function handleUserAction(e){
 const btn=e.currentTarget,userId=btn.dataset.userId,action=btn.dataset.userAction;
 btn.disabled=true;
 try{
   if(action==='save'){
     const role=$(`.user-role-select[data-user-id="${userId}"]`)?.value;
     await window.atlasAuth.adminRequest({action:'update',userId,role});
   }else if(action==='toggle'){
     const active=btn.dataset.active==='true';
     await window.atlasAuth.adminRequest({action:'update',userId,active:!active});
   }else if(action==='password'){
     const password=prompt('Informe uma nova senha temporária (mínimo 10 caracteres):');
     if(!password)return;
     if(password.length<10)throw new Error('A senha deve ter ao menos 10 caracteres.');
     await window.atlasAuth.adminRequest({action:'update',userId,password});
     alert('Senha redefinida com sucesso.');
   }
   await loadAtlasUsers();
 }catch(err){alert(err.message||'Não foi possível atualizar o usuário.')}
 finally{btn.disabled=false}
}

$('#global-search').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=e.target.value.trim();if(q)alert(`Pesquisa global será conectada ao banco de dados. Busca: ${q}`)}});


/* ============================
   v3.8 - Dados operacionais reais
   ============================ */
function atlasDb(){return window.atlasAuth?.client}
function atlasProfile(){return window.atlasAuth?.getProfile?.()||atlasCurrentProfile||{}}
function canEditOps(){return ['admin','operacao'].includes(atlasProfile().role)}
function canDeleteOps(){return ['admin','operacao'].includes(atlasProfile().role)}
function fmtDateBR(v){if(!v)return '—';try{return new Date(v+'T12:00:00').toLocaleDateString('pt-BR')}catch{return v}}
function statusLabel(v){return ({open:'Aberto',in_progress:'Em andamento',pending:'Pendência',completed:'Concluído',cancelled:'Cancelado'})[v]||v||'Aberto'}
function priorityLabel(v){return ({low:'Baixa',normal:'Normal',high:'Alta',urgent:'Urgente'})[v]||v||'Normal'}
function emptyState(title,text,buttonHtml=''){return `<div class="empty-state"><div class="empty-icon">＋</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${buttonHtml}</div>`}

async function safeTable(table,queryBuilder){
 const db=atlasDb(); if(!db)return {data:[],error:new Error('Banco indisponível')};
 try{
   const q=queryBuilder?queryBuilder(db.from(table)):db.from(table).select('*');
   const {data,error}=await q;
   return {data:data||[],error};
 }catch(error){return {data:[],error}}
}

async function loadOperationalData(){
 const db=atlasDb();
 if(!db) return {clients:[],processes:[],templates:[],stages:[],profiles:[],protocols:[],costs:[],licenses:[]};
 const results=await Promise.all([
   db.from('clients').select('*').order('legal_name',{ascending:true}),
   db.from('processes').select('*').order('created_at',{ascending:false}),
   db.from('workflow_templates').select('*').eq('active',true).order('name',{ascending:true}),
   db.from('workflow_stages').select('*').order('position',{ascending:true}),
   db.from('profiles').select('id,full_name,role,active').eq('active',true).order('full_name',{ascending:true}),
   db.from('protocols').select('*'),
   db.from('costs').select('*'),
   db.from('licenses').select('*').order('expires_at',{ascending:true})
 ]);
 const keys=['clients','processes','templates','stages','profiles','protocols','costs','licenses'];
 const out={};
 results.forEach((r,i)=>{out[keys[i]]=r.error?[]:(r.data||[]);});
 return out;
}

function decorateProcesses(data){
 const cm=new Map(data.clients.map(c=>[c.id,c]));
 const sm=new Map(data.stages.map(s=>[s.id,s]));
 const pm=new Map(data.profiles.map(p=>[p.id,p]));
 return data.processes.map(p=>({...p,client:cm.get(p.client_id),stage:sm.get(p.current_stage_id),owner:pm.get(p.owner_id)}));
}

async function dashboard(){
 setHead('Dashboard','VISÃO GERAL','Acompanhe processos, pendências, custos e vencimentos em um único painel.');
 page('<div class="loading-box"><span class="spinner"></span><div>Carregando dados operacionais...</div></div>');
 const data=await loadOperationalData();
 const procs=decorateProcesses(data);
 const active=procs.filter(p=>!['completed','cancelled'].includes(p.status));
 const licenseAttention=data.licenses.filter(l=>l.expires_at && new Date(l.expires_at)<=new Date(Date.now()+90*86400000)).length;
 const protocolCount=data.protocols.length;
 const costTotal=data.costs.reduce((s,c)=>s+(Number(c.amount)||0),0);
 const recent=procs.slice(0,6);
 const upcoming=data.licenses.filter(l=>l.expires_at).slice(0,5);

 page(`<div class="grid kpi-grid">
  <div class="surface kpi"><span class="kpi-label">Processos ativos</span><strong>${active.length}</strong><small>Registros reais em andamento</small></div>
  <div class="surface kpi"><span class="kpi-label">Licenças em atenção</span><strong>${licenseAttention}</strong><small>Vencimentos em até 90 dias</small></div>
  <div class="surface kpi"><span class="kpi-label">Protocolos monitorados</span><strong>${protocolCount}</strong><small>Protocolos cadastrados</small></div>
  <div class="surface kpi"><span class="kpi-label">Custos controlados</span><strong>${money(costTotal)}</strong><small>Taxas e reembolsos cadastrados</small></div>
 </div>
 <div class="grid two-col" style="margin-top:16px">
  <section class="surface pad"><div class="section-head"><h2>Processos recentes</h2><span>Dados do Supabase</span></div>
    ${recent.length?realProcessTable(recent,false):emptyState('Nenhum processo cadastrado','Crie a primeira empresa e depois o primeiro processo.',canEditOps()?'<button class="btn btn-primary" onclick="openProcessModal()">＋ Novo processo</button>':'')}
  </section>
  <section class="surface pad"><div class="section-head"><h2>Vencimentos</h2><span>Próximos alertas</span></div>
    ${upcoming.length?'<div class="alert-list">'+upcoming.map(l=>`<div class="alert-item"><div><strong>${esc(l.name)}</strong><div class="muted" style="font-size:10px;margin-top:3px">${esc(clientNameById(data.clients,l.client_id))}</div></div><div class="date">${fmtDateBR(l.expires_at)}<br>${pill(statusLabel(l.status))}</div></div>`).join('')+'</div>':'<div class="muted" style="padding:18px 0;font-size:11px">Nenhuma licença cadastrada.</div>'}
  </section>
 </div>`);
}

function clientNameById(clients,id){return clients.find(c=>c.id===id)?.legal_name||'Empresa'}

function processActionButtons(p){
 const id=String(p?.id||'');
 const edit='<button class="mini-btn" onclick="openProcessModal(\''+id+'\')">Editar</button>';
 const middle=p?.status==='completed'
   ? '<button class="mini-btn cartilha-btn" onclick="emitirCartilha(\''+id+'\')">Emitir cartilha</button>'
   : '<button class="mini-btn" onclick="advanceProcess(\''+id+'\')">Avançar</button>';
 const del='<button class="mini-btn danger" onclick="deleteProcess(\''+id+'\')">Excluir</button>';
 return edit+middle+del;
}
function realProcessTable(list,actions=true){
 const canAct=actions&&canEditOps();
 const desktop=`<div class="table-wrap process-table-desktop"><table><thead><tr><th>Processo</th><th>Empresa</th><th>Etapa</th><th>Responsável</th><th>Prazo</th><th>Status</th>${canAct?'<th>Ações</th>':''}</tr></thead><tbody>${list.map(p=>`<tr>
  <td><strong>${esc(p.public_code||'Sem código')}</strong><div class="muted">${esc(p.title)}</div></td>
  <td>${esc(p.client?.legal_name||'—')}</td>
  <td>${esc(p.stage?.name||'—')}</td>
  <td>${esc(p.owner?.full_name||'Não atribuído')}</td>
  <td>${fmtDateBR(p.due_date)}</td>
  <td>${pill(statusLabel(p.status))}</td>
  ${canAct?`<td><div class="row-actions">${processActionButtons(p)}</div></td>`:''}
 </tr>`).join('')}</tbody></table></div>`;

 const mobile=`<div class="process-mobile-list">${list.map(p=>`
   <article class="process-mobile-card">
     <div class="process-mobile-head">
       <div class="process-mobile-code">${esc(p.public_code||'Sem código')}</div>
       <div class="process-mobile-status">${pill(statusLabel(p.status))}</div>
     </div>
     <h3>${esc(p.title||'Processo')}</h3>
     <div class="process-mobile-company">${esc(p.client?.legal_name||'Empresa não informada')}</div>
     <div class="process-mobile-meta">
       <div><span>Etapa</span><strong>${esc(p.stage?.name||'—')}</strong></div>
       <div><span>Prazo</span><strong>${fmtDateBR(p.due_date)}</strong></div>
       <div class="process-mobile-owner"><span>Responsável</span><strong>${esc(p.owner?.full_name||'Não atribuído')}</strong></div>
     </div>
     ${canAct?`<div class="process-mobile-actions">
       ${processActionButtons(p)}
     </div>`:''}
   </article>`).join('')}</div>`;

 return desktop+mobile;
}

async function processPage(){
 setHead('Processos','LEGALIZAÇÃO','Crie, edite, mova e acompanhe processos reais de legalização.');
 page('<div class="loading-box"><span class="spinner"></span><div>Carregando processos...</div></div>');
 const data=await loadOperationalData();
 const procs=decorateProcesses(data);
 const role=atlasProfile().role;
 const toolbar=canEditOps()?'<button class="btn btn-primary" onclick="openProcessModal()">＋ Novo processo</button>':'';
 if(!procs.length){
   page(`<section class="surface pad"><div class="section-head"><h2>Processos</h2>${toolbar}</div>${emptyState('Nenhum processo cadastrado','Os dados de demonstração foram removidos. Cadastre uma empresa e crie seu primeiro processo.',canEditOps()?'<button class="btn btn-primary" onclick="openProcessModal()">＋ Criar processo</button>':'')}</section>`);
   return;
 }
 const template=data.templates[0];
 const stages=data.stages.filter(s=>!template||s.workflow_template_id===template.id);
 const cardsByStage=new Map(stages.map(s=>[s.id,[]]));
 const finalStage=stages.find(s=>/conclu[ií]do/i.test(String(s.name||'')))||stages[stages.length-1];
 procs.forEach(p=>{
   const targetStageId=p.status==='completed'&&finalStage?.id?finalStage.id:p.current_stage_id;
   if(cardsByStage.has(targetStageId))cardsByStage.get(targetStageId).push(p);
 });
 let kanban=stages.map(s=>`<div class="kanban-col"><div class="kanban-title"><span>${esc(s.name)}</span><span>${(cardsByStage.get(s.id)||[]).length}</span></div>
 ${(cardsByStage.get(s.id)||[]).map(p=>`<article class="task-card real-task"><b>${esc(p.public_code)}</b><strong>${esc(p.client?.legal_name||'Empresa')}</strong><p>${esc(p.title)}</p><p>${p.owner?.full_name?esc(p.owner.full_name):'Sem responsável'} · ${fmtDateBR(p.due_date)}</p>${canEditOps()?`<div class="task-actions">${processActionButtons(p)}</div>`:''}</article>`).join('')||'<div class="kanban-empty">Nenhum processo</div>'}
 </div>`).join('');
 page(`<section class="surface pad"><div class="section-head"><div><h2>Pipeline de legalização</h2><span>${procs.length} processo(s) cadastrado(s)</span></div>${toolbar}</div><div class="kanban">${kanban}</div><div style="margin-top:18px"><div class="section-head"><h3>Lista completa</h3></div>${realProcessTable(procs,true)}</div></section>`);
}

async function clientPage(){
 setHead('Empresas e clientes','CADASTRO','Cadastre e mantenha as empresas vinculadas aos processos.');
 page('<div class="loading-box"><span class="spinner"></span><div>Carregando empresas...</div></div>');
 const db=atlasDb();
 const {data,error}=await db.from('clients').select('*').order('legal_name',{ascending:true});
 const list=error?[]:(data||[]);
 const toolbar=canEditOps()?'<button class="btn btn-primary" onclick="openClientModal()">＋ Nova empresa</button>':'';
 page(`<section class="surface pad"><div class="section-head"><div><h2>Empresas cadastradas</h2><span>${list.length} registro(s)</span></div>${toolbar}</div>
 ${list.length?`<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>CNPJ</th><th>Cidade/UF</th><th>Contato</th>${canEditOps()?'<th>Ações</th>':''}</tr></thead><tbody>${list.map(c=>`<tr><td><strong>${esc(c.legal_name)}</strong><div class="muted">${esc(c.trade_name||'')}</div></td><td>${esc(c.tax_id||'—')}</td><td>${esc([c.city,c.state].filter(Boolean).join('/')||'—')}</td><td>${esc(c.contact_name||c.email||'—')}</td>${canEditOps()?`<td><div class="row-actions"><button class="mini-btn" onclick="openClientModal('${c.id}')">Editar</button><button class="mini-btn danger" onclick="deleteClient('${c.id}')">Excluir</button></div></td>`:''}</tr>`).join('')}</tbody></table></div>`:emptyState('Nenhuma empresa cadastrada','Cadastre a primeira empresa para iniciar um processo.',canEditOps()?'<button class="btn btn-primary" onclick="openClientModal()">＋ Cadastrar empresa</button>':'')}
 </section>`);
}

async function protocolPage(){
 setHead('Protocolos','CONTROLE','Protocolos vinculados aos processos cadastrados.');
 const db=atlasDb();
 const {data}=await db.from('protocols').select('*');
 const list=data||[];
 page(`<section class="surface pad"><div class="section-head"><h2>Protocolos registrados</h2><span>${list.length} itens</span></div>${list.length?'<div class="table-wrap"><table><thead><tr><th>Órgão</th><th>Tipo</th><th>Número</th><th>Status</th></tr></thead><tbody>'+list.map(p=>`<tr><td>${esc(p.agency||'—')}</td><td>${esc(p.protocol_type||'—')}</td><td><strong>${esc(p.protocol_number||'—')}</strong></td><td>${pill(p.status||'Registrado')}</td></tr>`).join('')+'</tbody></table></div>':'<div class="muted" style="padding:20px 0">Nenhum protocolo cadastrado.</div>'}</section>`);
}

async function costPage(){
 setHead('Custos e taxas','FINANCEIRO','Custos reais vinculados aos processos.');
 const db=atlasDb(); const {data}=await db.from('costs').select('*'); const list=data||[];
 page(`<section class="surface pad"><div class="section-head"><h2>Custos do processo</h2><span>${list.length} itens</span></div>${list.length?'<div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Pagamento</th></tr></thead><tbody>'+list.map(c=>`<tr><td>${esc(c.description)}</td><td>${esc(c.cost_type||'—')}</td><td><strong>${money(c.amount)}</strong></td><td>${pill(c.payment_status||'Pendente')}</td></tr>`).join('')+'</tbody></table></div>':'<div class="muted" style="padding:20px 0">Nenhum custo cadastrado.</div>'}</section>`);
}

async function licensePage(){
 setHead('Licenças','RENOVAÇÕES','Licenças reais e vencimentos cadastrados.');
 const data=await loadOperationalData(); const list=data.licenses;
 page(`<section class="surface pad"><div class="section-head"><h2>Licenças e alvarás</h2><span>${list.length} itens</span></div>${list.length?'<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Documento</th><th>Órgão</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>'+list.map(l=>`<tr><td>${esc(clientNameById(data.clients,l.client_id))}</td><td><strong>${esc(l.name)}</strong></td><td>${esc(l.agency||'—')}</td><td>${fmtDateBR(l.expires_at)}</td><td>${pill(l.status||'Ativa')}</td></tr>`).join('')+'</tbody></table></div>':'<div class="muted" style="padding:20px 0">Nenhuma licença cadastrada.</div>'}</section>`);
}

function modalShell(title,body,wide=false){
 const root=$('#atlas-modal-root');
 root.innerHTML=`<div class="atlas-modal-backdrop" onclick="if(event.target===this)closeAtlasModal()"><div class="atlas-modal ${wide?'wide':''}"><div class="atlas-modal-head"><div><span class="eyebrow">ATLAS</span><h2>${esc(title)}</h2></div><button class="modal-close" onclick="closeAtlasModal()">×</button></div><div class="atlas-modal-body">${body}</div></div></div>`;
}
function closeAtlasModal(){$('#atlas-modal-root').innerHTML=''}
window.closeAtlasModal=closeAtlasModal;

async function openClientModal(id=''){
 const db=atlasDb(); let record=null;
 if(id){const {data}=await db.from('clients').select('*').eq('id',id).single();record=data}
 modalShell(id?'Editar empresa':'Nova empresa',`<form id="client-real-form" class="modal-form-grid">
  <div class="field span-2"><label>Razão social *</label><input id="client-legal-name" required value="${esc(record?.legal_name||'')}"></div>
  <div class="field"><label>Nome fantasia</label><input id="client-trade-name" value="${esc(record?.trade_name||'')}"></div>
  <div class="field"><label>CNPJ</label><input id="client-tax-id" value="${esc(record?.tax_id||'')}"></div>
  <div class="field"><label>Contato</label><input id="client-contact" value="${esc(record?.contact_name||'')}"></div>
  <div class="field"><label>E-mail</label><input id="client-email" type="email" value="${esc(record?.email||'')}"></div>
  <div class="field"><label>Telefone</label><input id="client-phone" value="${esc(record?.phone||'')}"></div>
  <div class="field"><label>Cidade</label><input id="client-city" value="${esc(record?.city||'')}"></div>
  <div class="field"><label>UF</label><input id="client-state" maxlength="2" value="${esc(record?.state||'')}"></div>
  <div class="modal-actions span-2"><button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button id="client-save-btn" class="btn btn-primary" type="submit">Salvar empresa</button></div>
  <div id="client-form-message" class="auth-message hidden span-2"></div>
 </form>`);
 $('#client-real-form').addEventListener('submit',async e=>{
  e.preventDefault(); const btn=$('#client-save-btn'); btn.disabled=true;btn.textContent='Salvando...';
  const payload={organization_id:atlasProfile().organization_id,legal_name:$('#client-legal-name').value.trim(),trade_name:$('#client-trade-name').value.trim()||null,tax_id:$('#client-tax-id').value.trim()||null,contact_name:$('#client-contact').value.trim()||null,email:$('#client-email').value.trim()||null,phone:$('#client-phone').value.trim()||null,city:$('#client-city').value.trim()||null,state:($('#client-state').value.trim().toUpperCase()||null)};
  const q=id?db.from('clients').update(payload).eq('id',id):db.from('clients').insert(payload);
  const {error}=await q;
  if(error){const m=$('#client-form-message');m.textContent=error.message;m.className='auth-message error span-2';btn.disabled=false;btn.textContent='Salvar empresa';return}
  closeAtlasModal();await clientPage();
 });
}
window.openClientModal=openClientModal;

async function deleteClient(id){
 if(!confirm('Excluir esta empresa? A exclusão só será permitida se ela não possuir processos ou outros vínculos.'))return;
 const db=atlasDb();const {error}=await db.from('clients').delete().eq('id',id);
 if(error)return alert('Não foi possível excluir: '+error.message);
 await clientPage();
}
window.deleteClient=deleteClient;

async function openProcessModal(id=''){
 const db=atlasDb();
 const data=await loadOperationalData();
 if(!data.clients.length){
   if(confirm('Nenhuma empresa cadastrada. Deseja cadastrar uma empresa agora?')){closeAtlasModal();openClientModal()}
   return;
 }
 let rec=null;
 if(id){const {data:r,error}=await db.from('processes').select('*').eq('id',id).single();if(error)return alert(error.message);rec=r}
 const template=rec?data.templates.find(t=>t.id===rec.workflow_template_id)||data.templates[0]:data.templates[0];
 const stagesFor=data.stages.filter(s=>!template||s.workflow_template_id===template.id);
 const firstStage=stagesFor[0];
 modalShell(id?'Editar processo':'Novo processo',`<form id="process-real-form" class="modal-form-grid">
   <div class="field span-2"><label>Título do processo *</label><input id="proc-title" required value="${esc(rec?.title||'')}"></div>
   <div class="field"><label>Empresa *</label><select id="proc-client" required>${data.clients.map(c=>`<option value="${c.id}" ${rec?.client_id===c.id?'selected':''}>${esc(c.legal_name)}</option>`).join('')}</select></div>
   <div class="field"><label>Tipo de serviço</label><input id="proc-service" value="${esc(rec?.service_type||'legalizacao_empresarial')}"></div>
   <div class="field"><label>Etapa atual *</label><select id="proc-stage" required>${stagesFor.map(s=>`<option value="${s.id}" ${(rec?.current_stage_id||firstStage?.id)===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
   <div class="field"><label>Responsável</label><select id="proc-owner"><option value="">Não atribuído</option>${data.profiles.filter(p=>['admin','operacao'].includes(p.role)).map(p=>`<option value="${p.id}" ${rec?.owner_id===p.id?'selected':''}>${esc(p.full_name)}</option>`).join('')}</select></div>
   <div class="field"><label>Prioridade</label><select id="proc-priority"><option value="low" ${rec?.priority==='low'?'selected':''}>Baixa</option><option value="normal" ${!rec||rec?.priority==='normal'?'selected':''}>Normal</option><option value="high" ${rec?.priority==='high'?'selected':''}>Alta</option><option value="urgent" ${rec?.priority==='urgent'?'selected':''}>Urgente</option></select></div>
   <div class="field"><label>Status</label><select id="proc-status"><option value="open" ${!rec||rec?.status==='open'?'selected':''}>Aberto</option><option value="in_progress" ${rec?.status==='in_progress'?'selected':''}>Em andamento</option><option value="pending" ${rec?.status==='pending'?'selected':''}>Pendência</option><option value="completed" ${rec?.status==='completed'?'selected':''}>Concluído</option><option value="cancelled" ${rec?.status==='cancelled'?'selected':''}>Cancelado</option></select></div>
   <div class="field"><label>Prazo</label><input id="proc-due" type="date" value="${esc(rec?.due_date||'')}"></div>
   <div class="modal-actions span-2"><button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button id="proc-save-btn" class="btn btn-primary" type="submit">Salvar processo</button></div>
   <div id="proc-form-message" class="auth-message hidden span-2"></div>
 </form>`,true);
 $('#process-real-form').addEventListener('submit',async e=>{
   e.preventDefault();const btn=$('#proc-save-btn');btn.disabled=true;btn.textContent='Salvando...';
   const payload={organization_id:atlasProfile().organization_id,client_id:$('#proc-client').value,workflow_template_id:template?.id||null,title:$('#proc-title').value.trim(),service_type:$('#proc-service').value.trim()||'legalizacao_empresarial',status:$('#proc-status').value,current_stage_id:$('#proc-stage').value||null,owner_id:$('#proc-owner').value||null,priority:$('#proc-priority').value,due_date:$('#proc-due').value||null,completed_at:$('#proc-status').value==='completed'?new Date().toISOString():null};
   const q=id?db.from('processes').update(payload).eq('id',id):db.from('processes').insert(payload);
   const {error}=await q;
   if(error){const m=$('#proc-form-message');m.textContent=error.message;m.className='auth-message error span-2';btn.disabled=false;btn.textContent='Salvar processo';return}
   closeAtlasModal();await processPage();
 });
}
window.openProcessModal=openProcessModal;

async function advanceProcess(id){
 const db=atlasDb();const data=await loadOperationalData();
 const rec=data.processes.find(p=>p.id===id);if(!rec)return;
 const stagesFor=data.stages.filter(s=>s.workflow_template_id===rec.workflow_template_id).sort((a,b)=>a.position-b.position);
 const idx=stagesFor.findIndex(s=>s.id===rec.current_stage_id);
 if(idx<0||idx===stagesFor.length-1)return alert('O processo já está na última etapa.');
 const next=stagesFor[idx+1];
 const patch={current_stage_id:next.id,status:next.name==='Concluído'?'completed':'in_progress',completed_at:next.name==='Concluído'?new Date().toISOString():null};
 const {error}=await db.from('processes').update(patch).eq('id',id);
 if(error)return alert('Não foi possível avançar: '+error.message);
 await processPage();
}
window.advanceProcess=advanceProcess;

async function deleteProcess(id){
 if(!confirm('Excluir este processo da operação? Ele ficará preservado no banco para auditoria, mas desaparecerá das telas.'))return;
 try{
   const db=atlasDb();
   const {data:{session}}=await db.auth.getSession();
   if(!session?.access_token)throw new Error('Sessão expirada.');
   const res=await fetch('https://oorpvbxxpbxoaaykrtcf.supabase.co/functions/v1/atlas-processes',{
     method:'POST',
     headers:{
       'Content-Type':'application/json',
       'apikey':'sb_publishable_5261il-Rwu1wPQG_sTBb5g_tE52L_DQ',
       'Authorization':'Bearer '+session.access_token
     },
     body:JSON.stringify({action:'soft_delete',processId:id})
   });
   const body=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(body?.detail||body?.error||'Falha ao excluir processo.');
   await processPage();
 }catch(err){
   alert('Não foi possível excluir: '+(err.message||err));
 }
}
window.deleteProcess=deleteProcess;

$('#new-process-btn')?.addEventListener('click',()=>openProcessModal());
