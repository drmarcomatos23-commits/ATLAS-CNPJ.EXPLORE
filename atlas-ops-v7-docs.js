(()=>{
 'use strict';
 const DATA_VERSION='7.1';
 const escapeHtml=v=>typeof window.esc==='function'?window.esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const has=key=>typeof window.atlasHasPermission==='function'&&window.atlasHasPermission(key);
 const context=()=>({db:window.atlasAuth?.client,profile:window.atlasAuth?.getProfile?.()});
 const message=e=>String(e?.message||e||'Erro desconhecido');
 const dt=d=>d?new Date(d).toLocaleDateString('pt-BR'):'—';
 const statuses={pending:'Pendente',submitted:'Enviado',in_review:'Em análise',approved:'Aprovado',rejected:'Reprovado',waived:'Dispensado',
  open:'Aberta',in_progress:'Em atendimento',responded:'Respondida — aguardando aceite',accepted:'Aceita pelo órgão',reopened:'Exigência reaberta',cancelled:'Cancelada'};
 // Referência exclusivamente visual até que a migração documental seja aprovada.
 // Itens não são criados, aprovados nem anexados sem o esquema e as políticas RLS do banco.
 const REFERENCE_REQUIREMENTS={
  abertura:[
   ['Identificação e qualificação dos sócios e administradores','Nome, CPF, estado civil, profissão, endereço e dados de representação.','base'],
   ['Documentos de identidade e CPF dos signatários','Conferir documentos pessoais conforme natureza jurídica e órgão registrador.','base'],
   ['Endereço do estabelecimento e dados do imóvel','Endereço completo; verificar inscrição imobiliária, IPTU ou documento equivalente exigido pelo município.','base'],
   ['Dados para elaboração do ato constitutivo','Denominação, objeto, capital, quotas, administração e demais cláusulas aplicáveis.','base'],
   ['Atividades econômicas e CNAEs pretendidos','Descrição das atividades principal e secundárias.','base'],
   ['Consulta de viabilidade do nome e do endereço','Conferir exigências do município e do órgão de registro.','condicional'],
   ['Dados para registro e inscrição no CNPJ','Informações solicitadas pelos módulos aplicáveis da Redesim.','base'],
   ['Procuração e poderes de representação','Se o procedimento for realizado por procurador.','condicional'],
   ['Documentação de atividade regulamentada e licenças','A depender do CNAE, risco, localidade e órgão licenciador.','condicional']
  ],
  alteracao_societaria:[
   ['Contrato social e alterações registradas','Conferir a versão consolidada e os atos anteriores.','base'],
   ['Instrumento de alteração societária','Minuta com as deliberações, alterações e assinaturas cabíveis.','base'],
   ['Identificação dos sócios e administradores envolvidos','Qualificação e documentos dos signatários quando exigidos.','base'],
   ['Informações sobre capital, quotas e administração','Conforme os eventos societários a registrar.','condicional'],
   ['Viabilidade de nome, endereço ou atividade','Quando a alteração envolver eventos sujeitos à consulta prévia.','condicional'],
   ['Documentação de entrada, retirada ou representação','Instrumentos de cessão, anuências e procurações, conforme o caso.','condicional'],
   ['Dados para atualização cadastral na Redesim','Eventos e informações cadastrais pertinentes ao ato.','base']
  ],
  baixa:[
   ['CNPJ e atos constitutivos atualizados','Dados cadastrais e último instrumento registrado.','base'],
   ['Distrato social ou ato de extinção','Documento pertinente à natureza jurídica e deliberação de encerramento.','base'],
   ['Identificação e poderes dos signatários','Conferir representantes, sócios e procurações aplicáveis.','base'],
   ['Dados para baixa cadastral na Redesim','Informações e eventos de baixa nos órgãos integrados.','base'],
   ['Comprovantes e pendências fiscais, trabalhistas ou municipais','Verificar obrigações de encerramento aplicáveis à empresa.','condicional'],
   ['Baixa de inscrições e licenças','Conferir inscrições estadual/municipal e alvarás existentes.','condicional']
  ],
  regularizacao:[
   ['CNPJ e atos empresariais vigentes','Identificar a pessoa jurídica e seus representantes.','base'],
   ['Intimação, exigência, auto ou apontamento da irregularidade','Documentação que descreve o problema a regularizar.','base'],
   ['Protocolos e comprovantes anteriores','Histórico da solicitação perante os órgãos envolvidos.','base'],
   ['Comprovantes fiscais, declarações ou pagamentos','Quando relacionados à pendência identificada.','condicional'],
   ['Documentos do imóvel, atividade ou responsáveis','Conforme exigência específica do órgão.','condicional'],
   ['Procuração e autorização de representação','Se houver representação por terceiros.','condicional']
  ],
  licenciamento:[
   ['CNPJ e ato constitutivo vigente','Identificação e atividade da empresa.','base'],
   ['Endereço e documentos do imóvel','Inscrição imobiliária, IPTU, contrato ou autorização conforme órgão e município.','base'],
   ['Atividades e CNAEs exercidos no local','Descrição da operação, área utilizada e fatores de risco.','base'],
   ['Viabilidade ou consulta de uso e ocupação do solo','Quando requerida pelo município.','condicional'],
   ['Plantas, laudos, projetos e responsabilidade técnica','ART/RRT e documentos técnicos conforme a licença.','condicional'],
   ['Autorizações específicas e licenças anteriores','Vigilância sanitária, meio ambiente, bombeiros ou outras autoridades, conforme atividade.','condicional']
  ],
  legalizacao_empresarial:[
   ['CNPJ, contrato social e últimas alterações','Se a pessoa jurídica já estiver registrada.','base'],
   ['Identificação dos responsáveis e procuradores','Qualificação, contatos e poderes de representação.','base'],
   ['Dados do endereço e do imóvel','Incluindo documentação municipal pertinente.','base'],
   ['Atividades e CNAEs','Detalhamento das operações exercidas ou pretendidas.','base'],
   ['Consulta de viabilidade ou protocolo existente','Quando aplicável à etapa da legalização.','condicional'],
   ['Comprovantes de inscrições tributárias','Estadual ou municipal, se existentes ou exigidos.','condicional'],
   ['Licenças, alvarás e autorizações setoriais','Conforme atividade, risco e localidade.','condicional']
  ]
 };
 function referenceTemplatesFor(service){
  const key=service==='encerramento'?'baixa':service;
  return (REFERENCE_REQUIREMENTS[key]||REFERENCE_REQUIREMENTS.legalizacao_empresarial)
   .map(([title,instructions,kind])=>({title,instructions,kind}));
 }
 function referenceChecklistHtml(service){
  const items=referenceTemplatesFor(service);
  return '<div class="v71-doc-reference-note" role="note"><strong>Prévia orientativa — ainda sem gravação</strong>'+
   '<p>Relação inicial para conferência, não é uma exigência legal universal. Confirme natureza jurídica, CNAEs, município e órgão responsável. '+
   'Esta lista não está gravada no processo: a ativação do checklist definitivo depende da estrutura documental no banco.</p></div>'+
   '<ul class="v71-doc-preview-list v71-doc-reference-list">'+items.map(item=>
    '<li><span><strong>'+escapeHtml(item.title)+'</strong><small>'+escapeHtml(item.instructions)+'</small></span><small class="v71-doc-kind">'+
     (item.kind==='condicional'?'Conforme o caso':'Base de conferência')+'</small></li>').join('')+'</ul>';
 }
 const activeExigency=e=>!['accepted','cancelled'].includes(e.status);
 const docStatus=s=>statuses[s]||s;
 function alertError(err){window.alert('ATLAS 7.1: '+message(err));}
 function call(name,args){const {db}=context();if(!db)throw Error('Sessão indisponível');return db.rpc(name,args).then(({data,error})=>{if(error)throw error;return data;});}
 function modal(title,html) {
  if(typeof window.modalShell==='function'){window.modalShell(title,html);return document.getElementById('atlas-modal-root')||document;}
  throw Error('Modal do ATLAS indisponível');
 }
 function goBack(id){if(window.AtlasOpsV71Process?.refreshProcess)window.AtlasOpsV71Process.refreshProcess();else window.AtlasOpsV71Process?.openOperationalProcess?.(id);}
 function processForm(target) {
  const {db,profile}=context();
  if(!db||!profile?.organization_id||!target)return false;
  return true;
 }
 // A preview can share a production Supabase where the 7.1 migration is not installed.
 // Neither a PostgREST error nor an unresponsive network may trap the user in "Verificando...".
 const PROBE_TIMEOUT_MS=4000;
 const READ_TIMEOUT_MS=5000;
 const RPC_TIMEOUT_MS=6000;
 function bounded(promise,ms=READ_TIMEOUT_MS){
  let timer;
  return Promise.race([
   Promise.resolve(promise),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Prazo da consulta documental excedido')),ms);})
  ]).finally(()=>clearTimeout(timer));
 }
 async function available(){
  const {db,profile}=context();
  if(!db||!profile?.organization_id)return false;
  try {
   const result=await bounded(
    db.from('document_requirement_templates').select('id')
      .eq('organization_id',profile.organization_id).limit(1),PROBE_TIMEOUT_MS);
   return !result?.error;
  }catch(error){
   console.warn('ATLAS 7.1: consulta de disponibilidade documental indisponível',error);
   return false;
  }
 }
 async function templatesFor(service,stageId,clientId){
  const {db,profile}=context();
  if(!db||!profile?.organization_id)return [];
  const result=await bounded(db.from('document_requirement_templates').select('*')
    .eq('organization_id',profile.organization_id).eq('service_type',service||'')
    .eq('active',true).order('sort_order'));
  if(result?.error)throw result.error;
  const company=clientId?
    await bounded(db.from('clients').select('state,city').eq('id',clientId).maybeSingle()):
    {data:null};
  if(company?.error)throw company.error;
  const state=String(company.data?.state||'').toUpperCase();
  const city=String(company.data?.city||'').toLocaleLowerCase('pt-BR');
  return (result?.data||[]).filter(x=>(!x.stage_id||x.stage_id===stageId)&&
   (!x.scope_state||x.scope_state.toUpperCase()===state)&&
   (!x.scope_city||x.scope_city.toLocaleLowerCase('pt-BR')===city));
 }
 async function decorateNewProcessForm(form){
  if(!form||!processForm(form)||form.querySelector('[data-v71-doc-new]'))return;
  const footer=form.querySelector('.modal-actions');
  if(!footer)return;
  const box=document.createElement('section');
  box.className='v71-doc-new span-2';
  box.dataset.v71DocNew='1';
  box.innerHTML='<h3>Checklist documental do processo</h3>'+
    '<p>Itens conforme serviço e localidade; confira as exigências específicas do órgão.</p>'+
    '<div class="v71-doc-new-status" data-v71-doc-preview role="status" aria-live="polite">Verificando modelos...</div>';
  footer.before(box);
  let requestNumber=0;
  const reload=async()=>{
   const number=++requestNumber;
   const host=box.querySelector('[data-v71-doc-preview]');
   if(!host?.isConnected)return;
   host.innerHTML='<div class="v71-doc-reference-footer" role="status">Consultando modelos configurados...</div>'+
    referenceChecklistHtml(form.querySelector('#proc-service')?.value);
   const retryHtml=(msg)=>escapeHtml(msg)+
    ' <button type="button" class="v71-doc-retry" data-v71-doc-retry>Tentar novamente</button>';
   try {
    if(!await available()){
     if(!host.isConnected||number!==requestNumber)return;
     host.innerHTML=referenceChecklistHtml(form.querySelector('#proc-service')?.value)+
      '<div class="v71-doc-reference-footer">Checklist automático indisponível neste ambiente. Você pode salvar o processo normalmente. '+
      retryHtml('')+'</div>';
    } else {
     const rows=await bounded(templatesFor(
      form.querySelector('#proc-service')?.value,
      form.querySelector('#proc-stage')?.value,
      form.querySelector('#proc-client')?.value),READ_TIMEOUT_MS);
     if(!host.isConnected||number!==requestNumber)return;
     host.innerHTML=rows.length?
      '<ul class="v71-doc-preview-list">'+rows.map(r=>
       '<li><strong>'+escapeHtml(r.title)+'</strong> <small>'+
       escapeHtml(r.required_rule==='required'?'Obrigatório':r.required_rule==='optional'?'Opcional':'Condicional')+
       '</small></li>').join('')+'</ul>':
      '<div class="v71-doc-reference-footer">Nenhum modelo configurado para este serviço e localidade. O administrador poderá cadastrar modelos específicos.</div>'+referenceChecklistHtml(form.querySelector('#proc-service')?.value);
    }
   } catch(error) {
    if(!host.isConnected||number!==requestNumber)return;
    host.innerHTML='<div class="v71-doc-reference-footer">Não foi possível consultar os modelos documentais. '+retryHtml('Confira sua conexão ou tente novamente.')+'</div>'+
     referenceChecklistHtml(form.querySelector('#proc-service')?.value);
    console.warn('ATLAS 7.1: modelos documentais indisponíveis',error);
   }
  };
  box.addEventListener('click',event=>{
   if(event.target?.closest?.('[data-v71-doc-retry]'))void reload();
  });
  ['proc-service','proc-client','proc-stage'].forEach(id=>
   form.querySelector('#'+id)?.addEventListener('change',()=>{void reload();}));
  return reload();
 }
 async function afterProcessCreated(processId){
  if(!processId)return {available:false};
  if(!await available())return {available:false};
  try {
   const created=await bounded(call('atlas_v71_init_document_checklist',{p_process_id:processId}),RPC_TIMEOUT_MS);
   document.dispatchEvent(new CustomEvent('atlas:v71:documents-changed',{detail:{processId}}));
   return {available:true,created:Number(created||0)};
  }catch(error){
   console.warn('ATLAS 7.1: não foi possível confirmar geração do checklist',error);
   return {available:true,error:'Não foi possível confirmar a geração do checklist. Consulte o processo antes de tentar novamente.'};
  }
 }
 function documentPanel(detail){
  return '<div class="v71-doc-panel" data-v71-doc-process="'+escapeHtml(detail.process?.id||'')+'" data-v71-doc-kind="documents"><div class="v71-doc-loading">Carregando checklist documental...</div></div>';
 }
 function exigenciesPanel(detail){
  return '<div class="v71-doc-panel" data-v71-doc-process="'+escapeHtml(detail.process?.id||'')+'" data-v71-doc-kind="exigencies"><div class="v71-doc-loading">Carregando exigências formais...</div></div>';
 }
 async function load(processId){
  const {db,profile}=context();
  if(!db||!profile?.organization_id)throw Error('Sessão indisponível');
  const org=profile.organization_id;
  const tables=[
   ['requirements','process_document_requirements'],['versions','process_document_versions'],
   ['exigencies','process_exigencies'],['evidence','process_exigency_evidence']
  ];
  const results=await Promise.all(tables.map(async([key,table])=>{
   const {data,error}=await db.from(table).select('*').eq('organization_id',org).eq('process_id',processId).order('created_at');
   if(error)throw error;
   return [key,data||[]];
  }));
  const {data:files,error}=await db.from('documents').select('id,name,category,storage_key,created_at').eq('organization_id',org).eq('process_id',processId).order('created_at',{ascending:false});
  if(error)throw error;
  return {...Object.fromEntries(results),files:files||[]};
 }
 function fileLink(doc){
  return '<button type="button" data-v71-doc-open="'+escapeHtml(doc.id)+'" class="v71-doc-link">'+escapeHtml(doc.name||'Arquivo')+'</button>';
 }
 function renderChecklist(host,data,processId) {
  const approved=data.requirements.filter(r=>r.status==='approved').length;
  const pending=data.requirements.filter(r=>!['approved','waived'].includes(r.status)).length;
  const header='<div class="v71-doc-heading"><div><h3>Checklist documental</h3><small>'+data.requirements.length+' exigidos · '+approved+' aprovados · '+pending+' pendentes de conferência</small></div>'+
   (has('documents.upload')?'<button class="btn btn-muted" type="button" data-v71-doc-add>Enviar arquivo</button>':'')+
   (has('documents.review')?'<button class="btn btn-muted" type="button" data-v71-doc-manual>Novo documento exigido</button>':'')+
   (has('documents.templates.manage')?'<button class="btn btn-muted" type="button" data-v71-doc-config>Gerenciar modelos documentais</button>':'')+'</div>';
  const rows=data.requirements.map(r=>{
   const file=data.files.find(f=>f.id===r.document_id);
   const versions=data.versions.filter(v=>v.requirement_id===r.id).length;
   const notes=r.review_notes||r.waiver_reason||'';
   const actions=(has('documents.upload')?'<button class="btn btn-muted" type="button" data-v71-doc-upload="'+escapeHtml(r.id)+'">Enviar arquivo</button>':'')+
      (has('documents.review')?'<button class="btn btn-muted" type="button" data-v71-doc-review="'+escapeHtml(r.id)+'">Conferir documento</button>':'');
   return '<div class="v71-doc-item"><div class="v71-doc-item-main"><strong>'+escapeHtml(r.title)+'</strong><span>'+
      escapeHtml(r.required_rule==='required'?'Obrigatório':r.required_rule==='optional'?'Opcional':'Condicional')+' · '+escapeHtml(r.category)+
      '</span>'+ (r.instructions?'<small>'+escapeHtml(r.instructions)+'</small>':'') +
      (file?'<small>Arquivo: '+fileLink(file)+' · Versão '+versions+'</small>':'<small>Arquivo ainda não entregue.</small>')+
      (notes?'<small>Conferência: '+escapeHtml(notes)+'</small>':'')+
      '</div><div class="v71-doc-item-action"><span class="v71-doc-status '+escapeHtml(r.status)+'">'+escapeHtml(docStatus(r.status))+'</span>'+actions+'</div></div>';
  }).join('');
  const legacy=data.files.filter(f=>!data.requirements.some(r=>r.document_id===f.id));
  host.innerHTML=header+(rows||'<div class="v71-empty">Nenhum documento exigido configurado para este processo.</div>')+
    '<section class="v71-doc-existing"><h4>Demais arquivos do Dossiê Digital</h4>'+
    (legacy.length?legacy.map(f=>'<div>'+fileLink(f)+'</div>').join(''):'<small>Nenhum arquivo adicional vinculado.</small>')+'</section>';
 }
 function renderExigencies(host,data){
  const open=data.exigencies.filter(activeExigency).length;
  host.innerHTML='<div class="v71-doc-heading"><div><h3>Exigências formais</h3><small>'+open+' em aberto · respostas somente são cumpridas após aceite explícito</small></div>'+
   (has('documents.upload')?'<button class="btn btn-muted" type="button" data-v71-exigency-file-add>Enviar arquivo</button>':'')+
   (has('exigencies.manage')?'<button class="btn btn-primary" type="button" data-v71-exigency-new>Registrar exigência</button>':'')+'</div>'+
   (data.exigencies.length?data.exigencies.map(x=>{
    const evidence=data.evidence.filter(v=>v.exigency_id===x.id);
    const actions=has('exigencies.manage')?(
      activeExigency(x)?'<button type="button" class="btn btn-muted" data-v71-exigency-respond="'+escapeHtml(x.id)+'">Registrar resposta</button>':'')+
      (x.status==='responded'?'<button type="button" class="btn btn-primary" data-v71-exigency-accept="'+escapeHtml(x.id)+'">Aceite pelo órgão</button>':'')+
      (x.status==='responded'?'<button type="button" class="btn btn-muted" data-v71-exigency-reopen="'+escapeHtml(x.id)+'">Reabrir</button>':'')
     :'';
    return '<article class="v71-exigency-item"><div><strong>'+escapeHtml(x.title)+'</strong><small>Órgão: '+escapeHtml(x.agency)+' · Protocolo: '+escapeHtml(x.protocol_number||'Não informado')+
      ' · Prazo: '+escapeHtml(dt(x.due_on))+'</small><p>'+escapeHtml(x.description)+'</p><small>Comprovantes vinculados: '+evidence.length+' · '+escapeHtml(x.response_protocol||'')+'</small></div>'+
      '<div class="v71-doc-item-action"><span class="v71-doc-status '+escapeHtml(x.status)+'">'+escapeHtml(docStatus(x.status))+'</span>'+actions+'</div></article>';
   }).join(''):'<div class="v71-empty">Nenhuma exigência formal cadastrada. Documentos faltantes são tratados no checklist.</div>');
 }
 async function renderOn(root,detail){
  const id=detail?.process?.id;
  const container=root.matches?.('[data-v71-doc-process]')?root:root.querySelector('[data-v71-doc-process]');
  if(!container||!id)return;
  if(!await available()){
   container.innerHTML=container.dataset.v71DocKind==='exigencies'?
    '<div class="v71-capability-note"><strong>Exigências formais indisponíveis</strong><p>A estrutura de registro e acompanhamento de exigências ainda não foi ativada neste banco. Nenhuma exigência pode ser confirmada nesta prévia.</p></div>':
    referenceChecklistHtml(detail.process?.service_type)+
     '<div class="v71-capability-note">Checklist persistente ainda indisponível. O Dossiê Digital atual permanece acessível pela navegação existente.</div>';
   return;
  }
  try {
   const data=await bounded(load(id));
   if(!container.isConnected)return;
   if(container.dataset.v71DocKind==='exigencies')renderExigencies(container,data);
   else renderChecklist(container,data,id);
   wire(container,data,detail);
  }catch(error){container.innerHTML='<div class="error-box">Não foi possível carregar os dados documentais: '+escapeHtml(message(error))+'</div>'+
   (container.dataset.v71DocKind==='exigencies'?'':referenceChecklistHtml(detail.process?.service_type));}
 }
 async function openDocument(docId){
  const {db}=context();
  const {data,error}=await db.from('documents').select('id,storage_key').eq('id',docId).single();
  if(error||!data)throw error||Error('Documento não encontrado');
  const signed=await db.storage.from('legalizacao-documents').createSignedUrl(data.storage_key,300);
  if(signed.error||!signed.data?.signedUrl)throw signed.error||Error('Acesso privado indisponível');
  window.open(signed.data.signedUrl,'_blank','noopener,noreferrer');
 }
 function sanitizeFilename(v){return String(v||'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(-110);}
 async function uploadFile(processId,clientId,form){
  if(!has('documents.upload'))throw Error('Sem permissão de upload');
  const {db,profile}=context();const file=form.get('file');
  if(!(file instanceof File)||!file.size)throw Error('Selecione o arquivo');
  if(file.size>50*1024*1024)throw Error('Arquivo maior que 50 MB');
  const allowed=['pdf','png','jpg','jpeg','webp','doc','docx','xls','xlsx','txt'];
  const ext=String(file.name||'').split('.').pop().toLowerCase();
  if(!allowed.includes(ext))throw Error('Extensão de arquivo não permitida');
  const storageKey=[profile.organization_id,clientId||'sem-empresa',processId,crypto.randomUUID()+'-'+sanitizeFilename(file.name)].join('/');
  const up=await db.storage.from('legalizacao-documents').upload(storageKey,file,{upsert:false,contentType:file.type||undefined});
  if(up.error)throw up.error;
  const inserted=await db.from('documents').insert({
   organization_id:profile.organization_id,client_id:clientId||null,process_id:processId,
   name:file.name,category:String(form.get('category')||'Outros'),storage_key:storageKey,
   mime_type:file.type||null,size_bytes:file.size,uploaded_by:profile.id
  }).select('id').single();
  if(inserted.error){await db.storage.from('legalizacao-documents').remove([storageKey]);throw inserted.error;}
  return inserted.data.id;
 }
 function formListen(root,selector,handler){
  root.querySelector(selector)?.addEventListener('submit',async event=>{
   event.preventDefault();const btn=event.currentTarget.querySelector('[type=submit]');if(btn)btn.disabled=true;
   try{await handler(new FormData(event.currentTarget));}catch(error){alertError(error);}finally{if(btn)btn.disabled=false;}
  });
 }
 async function uploadModal(detail,requirement){
  const root=modal('Enviar arquivo', '<form class="v71-doc-form" data-v71-doc-upload-form><label>Arquivo<input required type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"></label><label>Categoria<select name="category"><option>'+escapeHtml(requirement?.category||'Outros')+'</option><option>Societário</option><option>Documento pessoal</option><option>Comprovante</option><option>Fiscal</option><option>Protocolo</option><option>Licença</option><option>Outros</option></select></label><div class="v71-doc-actions"><button type="submit" class="btn btn-primary">Enviar arquivo</button></div></form>');
  formListen(root,'[data-v71-doc-upload-form]',async form=>{
   const docId=await uploadFile(detail.process.id,detail.process.client_id,form);
   try{if(requirement?.id)await call('atlas_v71_add_document_version',{p_requirement_id:requirement.id,p_document_id:docId});}
   catch(err){window.alert('Arquivo salvo no Dossiê Digital, porém não vinculado ao checklist: '+message(err));}
   goBack(detail.process.id);
  });
 }
 async function reviewModal(detail,requirement){
  const root=modal('Conferir documento','<form class="v71-doc-form" data-v71-doc-review-form><label>Decisão<select name="decision"><option value="in_review">Em análise</option><option value="approved">Aprovado</option><option value="rejected">Reprovado</option><option value="waived">Dispensado com justificativa</option><option value="pending">Pendente</option></select></label><label>Parecer / justificativa<textarea name="notes" placeholder="Obrigatória para reprovação e dispensa"></textarea></label><div class="v71-doc-actions"><button type="submit" class="btn btn-primary">Registrar conferência</button></div></form>');
  formListen(root,'[data-v71-doc-review-form]',async form=>{
   await call('atlas_v71_review_document',{p_requirement_id:requirement.id,p_decision:form.get('decision'),p_notes:String(form.get('notes')||'')});
   goBack(detail.process.id);
  });
 }
 async function manualModal(detail){
  const root=modal('Novo documento exigido','<form class="v71-doc-form" data-v71-doc-manual-form><label>Documento solicitado<input name="title" required></label><label>Instruções<textarea name="instructions"></textarea></label><label>Obrigatoriedade<select name="required"><option value="conditional">Condicional</option><option value="required">Obrigatório</option><option value="optional">Opcional</option></select></label><div class="v71-doc-actions"><button class="btn btn-primary" type="submit">Adicionar ao checklist</button></div></form>');
  formListen(root,'[data-v71-doc-manual-form]',async form=>{
   const {db,profile}=context();
   const {error}=await db.from('process_document_requirements').insert({
    organization_id:profile.organization_id,process_id:detail.process.id,stage_id:detail.process.current_stage_id,
    title:form.get('title'),instructions:form.get('instructions'),required_rule:form.get('required'),created_by:profile.id
   });
   if(error)throw error;goBack(detail.process.id);
  });
 }
 function docSelect(data){return '<option value="">Selecione o documento do processo</option>'+data.files.map(f=>'<option value="'+escapeHtml(f.id)+'">'+escapeHtml(f.name)+'</option>').join('');}
 async function exigencyModal(detail,data){
  const root=modal('Registrar exigência formal','<form class="v71-doc-form" data-v71-exigency-form><label>Órgão emissor<input required name="agency" placeholder="Junta, Prefeitura, Receita Federal..."></label><label>Título<input required name="title"></label><label>Descrição integral<textarea required name="description"></textarea></label><label>Protocolo<input name="protocol"></label><label>Data da ciência<input required type="date" name="received" value="'+new Date().toISOString().slice(0,10)+'"></label><label>Prazo do órgão<input type="date" name="due"></label><label>Notificação recebida (arquivo já cadastrado)<select name="notice">'+docSelect(data)+'</select></label><div class="v71-doc-actions"><button type="submit" class="btn btn-primary">Registrar exigência</button></div></form>');
  formListen(root,'[data-v71-exigency-form]',async form=>{
   await call('atlas_v71_create_exigency',{p_process_id:detail.process.id,p_agency:form.get('agency'),p_title:form.get('title'),
    p_description:form.get('description'),p_protocol_number:form.get('protocol')||null,p_received_on:form.get('received'),
    p_due_on:form.get('due')||null,p_notice_document_id:form.get('notice')||null,p_assigned_to:null});
   goBack(detail.process.id);
  });
 }
 async function responseModal(detail,data,exigency){
  const root=modal('Registrar resposta ao órgão','<form class="v71-doc-form" data-v71-exigency-response-form><p>O envio de resposta não encerra a exigência. Registre o aceite separadamente.</p><label>Comprovante de resposta<select name="file" required>'+docSelect(data)+'</select></label><label>Protocolo de resposta<input name="protocol"></label><label>Providência realizada<textarea name="summary"></textarea></label><div class="v71-doc-actions"><button type="submit" class="btn btn-primary">Registrar resposta</button></div></form>');
  formListen(root,'[data-v71-exigency-response-form]',async form=>{
   await call('atlas_v71_mark_exigency_responded',{p_exigency_id:exigency.id,p_document_id:form.get('file'),
    p_response_protocol:form.get('protocol')||null,p_summary:form.get('summary')||null});
   goBack(detail.process.id);
  });
 }
 async function acceptanceModal(detail,exigency,accepted){
  const root=modal(accepted?'Registrar aceite pelo órgão':'Reabrir exigência',
   '<form class="v71-doc-form" data-v71-exigency-accept-form><p>'+
    (accepted?'Confirme somente após comprovação do deferimento pelo órgão.':'A exigência voltará a ficar em aberto.')+
    '</p><label>Justificativa / manifestação do órgão<textarea required name="justification"></textarea></label><div class="v71-doc-actions"><button type="submit" class="btn btn-primary">Confirmar</button></div></form>');
  formListen(root,'[data-v71-exigency-accept-form]',async form=>{
   await call('atlas_v71_close_exigency',{p_exigency_id:exigency.id,p_accepted:accepted,p_justification:form.get('justification')});
   goBack(detail.process.id);
  });
 }
 async function templatesModal(detail){
  if(!has('documents.templates.manage'))throw Error('Acesso restrito ao administrador');
  const {db,profile}=context();
  const {data,error}=await db.from('document_requirement_templates').select('*')
   .eq('organization_id',profile.organization_id).order('service_type').order('sort_order');
  if(error)throw error;
  const content='<div class="v71-doc-admin"><h4>Modelos de Documentação e Exigências</h4><p>Documentos mudam conforme serviço, município, UF, natureza da atividade e órgão. Novos modelos não alteram retroativamente processos existentes.</p>'+
   '<div class="v71-doc-admin-list">'+(data||[]).map(t=>'<div><span>'+escapeHtml(t.service_type)+' · '+escapeHtml(t.title)+' · '+escapeHtml(t.required_rule)+(t.active?'':' · INATIVO')+'</span><button class="btn btn-muted" data-v71-doc-toggle="'+escapeHtml(t.id)+'">'+(t.active?'Desativar':'Ativar')+'</button></div>').join('')+'</div>'+
   '<form data-v71-doc-template-form class="v71-doc-form"><label>Serviço<select name="service"><option value="abertura">Abertura</option><option value="alteracao_societaria">Alteração Societária</option><option value="baixa">Baixa</option><option value="regularizacao">Regularização</option><option value="licenciamento">Licenciamento</option><option value="legalizacao_empresarial">Legalização Empresarial</option></select></label>'+
   '<label>Documento<input name="title" required></label><label>Orientações<textarea name="instructions"></textarea></label><label>Categoria<input name="category" value="Outros"></label><label>Obrigatoriedade<select name="required"><option value="conditional">Condicional</option><option value="required">Obrigatório</option><option value="optional">Opcional</option></select></label><label>UF (opcional)<input name="state" maxlength="2"></label><label>Município (opcional)<input name="city"></label><div class="v71-doc-actions"><button type="submit" class="btn btn-primary">Cadastrar modelo</button></div></form></div>';
  const root=modal('Gerenciar modelos documentais',content);
  root.querySelectorAll('[data-v71-doc-toggle]').forEach(button=>button.addEventListener('click',async()=>{
   const row=data.find(r=>r.id===button.dataset.v71DocToggle);
   const {error}=await db.from('document_requirement_templates').update({active:!row.active,updated_at:new Date().toISOString()}).eq('id',row.id).eq('organization_id',profile.organization_id);
   if(error){alertError(error);return;}templatesModal(detail);
  }));
  formListen(root,'[data-v71-doc-template-form]',async form=>{
   const {error}=await db.from('document_requirement_templates').insert({
    organization_id:profile.organization_id,service_type:form.get('service'),title:String(form.get('title')).trim(),
    instructions:form.get('instructions')||null,category:form.get('category')||'Outros',
    required_rule:form.get('required'),scope_state:String(form.get('state')||'').trim().toUpperCase()||null,
    scope_city:String(form.get('city')||'').trim()||null,created_by:profile.id
   });
   if(error)throw error;templatesModal(detail);
  });
 }
 function wire(container,data,detail){
  const processId=detail.process.id;
  container.querySelectorAll('[data-v71-doc-open]').forEach(b=>b.addEventListener('click',()=>openDocument(b.dataset.v71DocOpen).catch(alertError)));
  container.querySelectorAll('[data-v71-doc-upload]').forEach(b=>b.addEventListener('click',()=>{
   const req=data.requirements.find(r=>r.id===b.dataset.v71DocUpload);if(req)uploadModal(detail,req).catch(alertError);
  }));
  container.querySelectorAll('[data-v71-doc-review]').forEach(b=>b.addEventListener('click',()=>{
   const req=data.requirements.find(r=>r.id===b.dataset.v71DocReview);if(req)reviewModal(detail,req).catch(alertError);
  }));
  container.querySelector('[data-v71-doc-add]')?.addEventListener('click',()=>uploadModal(detail,null).catch(alertError));
  container.querySelector('[data-v71-exigency-file-add]')?.addEventListener('click',()=>uploadModal(detail,null).catch(alertError));
  container.querySelector('[data-v71-doc-manual]')?.addEventListener('click',()=>manualModal(detail).catch(alertError));
  container.querySelector('[data-v71-doc-config]')?.addEventListener('click',()=>templatesModal(detail).catch(alertError));
  container.querySelector('[data-v71-exigency-new]')?.addEventListener('click',()=>exigencyModal(detail,data).catch(alertError));
  ['respond','accept','reopen'].forEach(action=>{
   container.querySelectorAll('[data-v71-exigency-'+action+']').forEach(b=>b.addEventListener('click',()=>{
    const item=data.exigencies.find(e=>e.id===b.dataset['v71Exigency'+action.charAt(0).toUpperCase()+action.slice(1)]);
    if(!item)return;
    const actionFn=action==='respond'?responseModal(detail,data,item):acceptanceModal(detail,item,action==='accept');
    Promise.resolve(actionFn).catch(alertError);
   }));
  });
  document.dispatchEvent(new CustomEvent('atlas:v71:document-counts',{detail:{processId,pending:data.requirements.filter(r=>!['approved','waived'].includes(r.status)).length,exigencies:data.exigencies.filter(activeExigency).length}}));
 }
 function bindProcessActions(root,detail){
  root.querySelectorAll('[data-v71-doc-process]').forEach(element=>renderOn(element,detail).catch(alertError));
 }
 window.AtlasOpsV71Documents=Object.freeze({available,templatesFor,referenceTemplatesFor,decorateNewProcessForm,afterProcessCreated,documentPanel,exigenciesPanel,bindProcessActions,load});
})();
