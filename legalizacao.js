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
 if(page==='dashboard')return dashboard();if(page==='processos')return processPage();if(page==='clientes')return clientPage();if(page==='protocolos')return protocolPage();if(page==='custos')return costPage();if(page==='licencas')return licensePage();if(page==='integracoes')return integrationPage();if(page==='documentos')return docsPage();if(page==='relatorios')return reportsPage();if(page==='usuarios')return usersPage();if(page==='config')return configPage();
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
function docsPage(){setHead('Documentos','DOSSIÊ DIGITAL','Organize documentos societários, pessoais, protocolos e licenças por processo.');page(`<section class="surface pad"><div class="section-head"><h2>Dossiê de documentos</h2><button class="btn btn-primary" onclick="alert('Upload privado será ativado com Supabase Storage.')">＋ Documento</button></div><div class="source-note"><strong>Ambiente de demonstração.</strong> O upload real ficará disponível após a ativação do storage privado e das permissões por usuário.</div></section>`)}
function reportsPage(){setHead('Relatórios','GESTÃO','Indicadores de prazo, produtividade, custos, licenças e gargalos operacionais.');page(`<div class="grid kpi-grid"><div class="surface kpi"><span class="kpi-label">Tempo médio</span><strong>8,4d</strong><small>Por etapa</small></div><div class="surface kpi"><span class="kpi-label">Concluídos</span><strong>18</strong><small>No mês</small></div><div class="surface kpi"><span class="kpi-label">Pendências</span><strong>4</strong><small>Exigem ação</small></div><div class="surface kpi"><span class="kpi-label">Renovações</span><strong>7</strong><small>Próximos 90 dias</small></div></div>`)}
function configPage(){setHead('Configurações','SISTEMA','Usuários, perfis, integrações e parâmetros operacionais.');page(`<section class="surface pad"><div class="section-head"><h2>Ambiente</h2><span>Preview</span></div><div class="data-list"><div class="data-row"><span>Modo</span><strong>Demonstração online</strong></div><div class="data-row"><span>Banco</span><strong>Próxima etapa · Supabase</strong></div><div class="data-row"><span>IA</span><strong>Próxima etapa · OpenAI</strong></div></div></section>`)}

function integrationPage(){
 setHead('Integrações','APIs E CONECTORES','Conecte e consulte fontes oficiais e serviços auxiliares para agilizar seus processos.');
 page(`<div class="grid integration-layout"><section class="surface cnpj-card">
  <div class="section-head"><div class="title-with-icon"><div class="title-icon">▦</div><div><h2>Consulta CNPJ</h2><p>Consulta empresarial completa no padrão ATLAS Explore, com CNPJws e fallback BrasilAPI.</p></div></div></div>
  <form id="cnpj-form" class="cnpj-form"><div class="input-shell"><input id="cnpj-input" inputmode="numeric" placeholder="00.000.000/0000-00" maxlength="18" autocomplete="off"><span id="input-count" class="input-count">0/14</span></div><button id="cnpj-button" class="btn btn-primary" type="submit">⌕ Consultar</button></form>
  <div id="cnpj-feedback" class="cnpj-feedback">Digite os 14 números do CNPJ. A validação dos dígitos é automática.</div><div id="cnpj-result"></div>
 </section>
 <aside class="surface integration-status"><div class="section-head"><h2>Status das integrações</h2></div>
  ${integrationRow('DB','CNPJws','Consulta cadastral CNPJ','Ativa','ok')}${integrationRow('IB','IBGE','UF e municípios','Ativa','ok')}${integrationRow('SB','Supabase','Auth, banco e storage','Próxima etapa','warn')}${integrationRow('AI','OpenAI','ATLAS IA','Próxima etapa','warn')}
  <div class="integration-info"><strong>Integrações em evolução</strong>A estrutura foi preparada para incorporar autenticação, storage, WhatsApp, e-mail e ATLAS IA sem alterar o fluxo operacional.</div>
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
