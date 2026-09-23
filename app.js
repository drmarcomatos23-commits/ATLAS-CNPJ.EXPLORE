import { createExtrasManager } from './extras.mjs';
import { buildReportHtml } from './report.mjs';
import { validCnpj as validBranchCnpj, normalizeBranchList, branchFromCnpj } from './filiais.mjs';
const $ = (selector) => document.querySelector(selector);
const form = $('#search-form');
const input = $('#cnpj-input');
const button = $('#submit-btn');
const results = $('#results');
const notice = $('#notice');
const loading = $('#loading');
const empty = $('#empty');

let current = null;
let controller = null;
let activeRequest = 0;
let activeTab = 'company';
let branchState={root:'',ids:[],details:{},mode:'idle',page:1,pages:1,total:null,error:'',busy:''};
let branchRequest=0;
const extras=createExtrasManager(()=>current);


const digitsOf = (v) => String(v ?? '').replace(/\D/g, '');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function formatCnpj(value) {
  const d = digitsOf(value).slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\/\d{4})(\d)/, '$1-$2');
}
function validCnpj(value) {
  const d = digitsOf(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  function dv(base, weights) {
    const sum = [...base].reduce((v, x, i) => v + Number(x) * weights[i], 0);
    return sum % 11 < 2 ? 0 : 11 - sum % 11;
  }
  const a = dv(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const b = dv(d.slice(0, 12) + a, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${a}${b}`);
}
function friendlyLabel(key) {
  const known = {
    cnpj: 'CNPJ', cnpj_raiz: 'CNPJ raiz', cpf_cnpj_socio: 'CPF/CNPJ do sócio', cpf_representante_legal: 'CPF do representante legal', cep: 'CEP', mei: 'MEI', simples: 'Simples Nacional', id: 'ID', email: 'E-mail', ddd1: 'DDD 1', ddd2: 'DDD 2', ibge_id: 'Código IBGE', siafi_id: 'Código SIAFI', uf: 'UF',
    razao_social: 'Razão social', nome_fantasia: 'Nome fantasia', inscricoes_estaduais: 'Inscrições estaduais', capital_social: 'Capital social', natureza_juridica: 'Natureza jurídica', atividade_principal: 'Atividade principal', atividade_secundaria: 'Atividade secundária', atividade_secundarias: 'Atividades secundárias', estabelecimento: 'Estabelecimento', socios: 'Sócios', simples: 'Simples Nacional', porte: 'Porte', cidade: 'Cidade', estado: 'Estado'
  };
  return known[key] || String(key).replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toLocaleUpperCase('pt-BR'));
}
function date(value) {
  if (typeof value !== 'string') return value == null ? '—' : String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!m) return value;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return dt.getUTCFullYear() === Number(m[1]) && dt.getUTCMonth() + 1 === Number(m[2]) && dt.getUTCDate() === Number(m[3]) ? `${m[3]}/${m[2]}/${m[1]}` : value;
}
function money(value) {
  if (value == null || value === '') return 'Não informado';
  const number = Number(String(value).replaceAll(' ', '').replace(',', '.'));
  return Number.isFinite(number) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number) : String(value);
}
function phone(ddd, number) {
  const clean = digitsOf(number);
  if (!clean) return '';
  const all = clean.length === 8 || clean.length === 9 ? digitsOf(ddd) + clean : clean;
  if (all.length === 10) return `(${all.slice(0, 2)}) ${all.slice(2, 6)}-${all.slice(6)}`;
  if (all.length === 11) return `(${all.slice(0, 2)}) ${all.slice(2, 7)}-${all.slice(7)}`;
  return [ddd, number].filter(Boolean).join(' ');
}
function formatValue(v, key) {
  if (v === null || v === undefined || v === '') return 'Não informado';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (key === 'capital_social') return money(v);
  if (key === 'cep' && digitsOf(v).length === 8) return `${digitsOf(v).slice(0, 5)}-${digitsOf(v).slice(5)}`;
  if (/^(cnpj|cpf_cnpj_socio)$/.test(key) && digitsOf(v).length === 14) return formatCnpj(v);
  if (/(?:^data_|_em$|_at$|^date$)/.test(key)) return date(v);
  return String(v);
}
function countFilled(v) {
  if (v == null) return 0;
  if (Array.isArray(v)) return v.reduce((s, item) => s + countFilled(item), 0);
  if (typeof v === 'object') return Object.values(v).reduce((s, item) => s + countFilled(item), 0);
  return typeof v === 'string' && v.trim() === '' ? 0 : 1;
}
function sectionCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return value == null || value === '' ? 0 : 1;
}
function displayNotice(message, kind = 'error') {
  notice.hidden = !message;
  notice.className = kind === 'success' ? 'notice success' : 'notice error';
  notice.innerHTML = message ? `<strong>${kind === 'error' ? 'Não foi possível consultar' : 'Tudo certo'}</strong><p>${escapeHtml(message)}</p>` : '';
}
function getSummaryModel(data) {
  const e = data.estabelecimento || {};
  const street = [e.tipo_logradouro, e.logradouro].filter(Boolean).join(' ');
  const streetLine = [street, e.numero, e.complemento].filter(Boolean).join(', ');
  const cep = e.cep && digitsOf(e.cep).length === 8 ? `${digitsOf(e.cep).slice(0, 5)}-${digitsOf(e.cep).slice(5)}` : (e.cep || '');
  const address = [streetLine, e.bairro, cep ? `CEP ${cep}` : ''].filter(Boolean).join(' · ');
  const city = e.cidade && typeof e.cidade === 'object' ? e.cidade.nome : e.cidade;
  const uf = e.estado && typeof e.estado === 'object' ? e.estado.sigla : e.estado;
  const activity = e.atividade_principal && typeof e.atividade_principal === 'object' ? [e.atividade_principal.id, e.atividade_principal.descricao].filter(Boolean).join(' — ') : e.atividade_principal;
  const phones = [phone(e.ddd1, e.telefone1), phone(e.ddd2, e.telefone2)].filter(Boolean).join(' · ');
  const registrations = Array.isArray(e.inscricoes_estaduais) ? e.inscricoes_estaduais : (Array.isArray(data.inscricoes_estaduais) ? data.inscricoes_estaduais : []);
  const status = String(e.situacao_cadastral || 'Não informada');
  const statusClass = status.toUpperCase() === 'ATIVA' ? 'positive' : status === 'Não informada' ? 'neutral' : 'negative';
  return {
    razaoSocial: data.razao_social || e.nome_fantasia || 'Razão social não informada',
    fantasia: e.nome_fantasia || 'Nome fantasia não informado',
    cnpj: formatCnpj(e.cnpj || input.value),
    status,
    statusClass,
    address: address || 'Não informado',
    cityUf: [city, uf].filter(Boolean).join(' / ') || 'Não informado',
    activity: activity || 'Não informado',
    phones: phones || 'Não informado',
    email: e.email || 'Não informado',
    capital: money(data.capital_social),
    porte: data.porte?.descricao || 'Não informado',
    inicio: date(e.data_inicio_atividade),
    registrations,
  };
}
function infoItem(label, value, icon, wide = false) {
  return `<div class="info-item ${wide ? 'wide' : ''}"><span class="info-icon">${icon}</span><div><span class="info-label">${escapeHtml(label)}</span><strong>${escapeHtml(value || 'Não informado')}</strong></div></div>`;
}
function buildRegistrations(items) {
  if (!items.length) return '<div class="empty-inline">Nenhuma inscrição estadual informada pela API para este cadastro.</div>';
  return `<div class="register-grid">${items.map((item) => {
    const state = typeof item?.estado === 'object' ? item?.estado?.sigla : item?.estado;
    const status = item?.ativo === true ? 'Ativa' : item?.ativo === false ? 'Inativa' : 'Não informado';
    const cls = item?.ativo === true ? 'positive' : item?.ativo === false ? 'negative' : 'neutral';
    return `<div class="register-item"><div><span class="register-uf">${escapeHtml(state || 'UF')}</span><strong>${escapeHtml(item?.inscricao_estadual || 'Número não informado')}</strong></div><span class="status-pill small ${cls}">${status}</span></div>`;
  }).join('')}</div>`;
}
function buildSummary(data) {
  const model = getSummaryModel(data);
  return `
    <section class="dashboard-card summary-card">
      <div class="summary-top">
        <div class="summary-brand-block">
          <img src="/logo-atlas.png" alt="ATLAS CNPJ.EXPLORE" class="summary-logo" />
          <div>
            <span class="section-kicker">RESULTADO DA CONSULTA</span>
            <h2>${escapeHtml(model.razaoSocial)}</h2>
            <div class="subtitle-row">
              <span>${escapeHtml(model.fantasia)}</span>
              <span class="mini-dot"></span>
              <span class="mono">${escapeHtml(model.cnpj)}</span>
            </div>
          </div>
        </div>
        <div class="status-pill ${model.statusClass}"><span class="status-dot"></span>${escapeHtml(model.status)}</div>
      </div>
      <div class="metrics-grid">
        <div class="metric-card"><span>Capital social</span><strong>${escapeHtml(model.capital)}</strong></div>
        <div class="metric-card"><span>Início das atividades</span><strong>${escapeHtml(model.inicio)}</strong></div>
        <div class="metric-card"><span>Porte</span><strong>${escapeHtml(model.porte)}</strong></div>
        <div class="metric-card"><span>Campos preenchidos</span><strong>${countFilled(data).toLocaleString('pt-BR')}</strong></div>
      </div>
      <div class="info-grid">
        ${infoItem('Endereço', model.address, '⌖', true)}
        ${infoItem('Cidade / UF', model.cityUf, '◌')}
        ${infoItem('CNAE principal', model.activity, '▤')}
        ${infoItem('Telefone', model.phones, '◍')}
        ${infoItem('E-mail', model.email, '✉')}
      </div>
      <div class="register-box">
        <div class="register-head">
          <h3>Inscrições estaduais</h3>
          <span>${model.registrations.length} ${model.registrations.length === 1 ? 'registro' : 'registros'}</span>
        </div>
        ${buildRegistrations(model.registrations)}
      </div>
    </section>
  `;
}
function getExplorerSections(data) {
  const e = data.estabelecimento || {};
  const company = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'socios' && key !== 'estabelecimento'));
  const registries = Array.isArray(e.inscricoes_estaduais) ? e.inscricoes_estaduais : (Array.isArray(data.inscricoes_estaduais) ? data.inscricoes_estaduais : []);
  return [
    { key: 'company', label: 'Dados da empresa', value: company },
    { key: 'establishment', label: 'Estabelecimento', value: e },
    { key: 'partners', label: 'Sócios', value: Array.isArray(data.socios) ? data.socios : [] },
    { key: 'taxes', label: 'Dados fiscais', value: { inscricoes_estaduais: registries, simples: data.simples } }
  ];
}
function treeNode(name, value, key, depth = 0) {
  if (value === null || typeof value !== 'object') {
    const isEmpty = value === null || value === undefined || value === '';
    return `<div class="tree-leaf"><span class="tree-leaf-label">${escapeHtml(name)}</span><span class="tree-leaf-value ${isEmpty ? 'empty' : ''}">${escapeHtml(formatValue(value, key))}</span></div>`;
  }
  const isArray = Array.isArray(value);
  const children = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
  return `<details class="tree-node" ${depth < 1 ? 'open' : ''}><summary class="tree-toggle"><span class="tree-chevron">›</span><span class="tree-label">${escapeHtml(name)}</span><span class="tree-type">${isArray ? 'Lista' : 'Objeto'}</span><span class="tree-count">${children.length} ${children.length === 1 ? 'item' : 'itens'}</span></summary><div class="tree-children">${children.length ? children.map(([k, v]) => treeNode(isArray ? `Item ${Number(k) + 1}` : friendlyLabel(k), v, k, depth + 1)).join('') : '<div class="tree-empty">Nenhum item</div>'}</div></details>`;
}
function renderExplorerSection() {
  const panel = $('#explorer-panel');
  if (!panel || !current) return;
  const sections = getExplorerSections(current);
  const selected = sections.find((item) => item.key === activeTab) || sections[0];
  activeTab = selected.key;
  panel.innerHTML = `<div class="tree-body">${treeNode(selected.label, selected.value, selected.key)}</div>`;
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    const active = btn.dataset.tab === activeTab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
}
function buildExplorer(data) {
  const sections = getExplorerSections(data);
  return `
    <section class="dashboard-card explorer-card">
      <div class="explorer-top">
        <div>
          <span class="section-kicker">EXPLORADOR DE DADOS</span>
          <h3>Painel organizado por grupos</h3>
          <p>Menos abas e navegação simplificada para desktop e celular.</p>
        </div>
        <div class="explorer-actions">
          <span class="badge-inline">${sections.length} abas</span>
          <button type="button" id="print-btn" class="secondary-btn">Imprimir / Salvar PDF</button>
        </div>
      </div>
      <div class="tabs-bar" role="tablist" aria-label="Abas do explorador de dados">
        ${sections.map((section) => `<button class="tab-btn ${section.key === sections[0].key ? 'active' : ''}" type="button" role="tab" aria-selected="${section.key === sections[0].key}" data-tab="${escapeHtml(section.key)}">${escapeHtml(section.label)} <span>${sectionCount(section.value)}</span></button>`).join('')}
      </div>
      <div id="explorer-panel"></div>
    </section>
  `;
}
function ensurePrintArea(data) {
  let printArea = $('#print-area');
  if (!printArea) {printArea=document.createElement('div');printArea.id='print-area';document.body.appendChild(printArea);}
  printArea.innerHTML=buildReportHtml(data,getSummaryModel(data),new Date(),{
    mode:branchState.mode,total:branchState.total,pages:branchState.pages,
    page:branchState.page,ids:[...branchState.ids],details:{...branchState.details}
  },extras.getResults());
}
function printReport() {
  if (!current) return;
  ensurePrintArea(current);
  window.print();
}
function branchCard(branch,cnpj){
  const known=Boolean(branch),main=known?branch.atividadePrincipal:null,all=known?branch.atividadesSecundarias:[];
  const list=known?'<div class="branch-details"><p><b>Endereço:</b> '+escapeHtml(branch.endereco)+'</p><p><b>Atividade principal:</b> '+escapeHtml([main.codigo,main.descricao].filter(Boolean).join(' — ')||'Não informada')+'</p><details class="secondary-activities"><summary>Atividades secundárias ('+all.length+')</summary>'+(all.length?'<ul>'+all.map(item=>'<li>'+escapeHtml([item.codigo,item.descricao].filter(Boolean).join(' — '))+'</li>').join('')+'</ul>':'<p>Não informadas.</p>')+'</details></div>':'<p class="branch-pending">Endereço e atividades disponíveis após consultar esta unidade.</p>';
  return '<article class="branch-card"><div class="branch-card-top"><div><span class="section-kicker">'+(known?escapeHtml(branch.tipo):'OUTRO CNPJ DA RAIZ')+'</span><h4>'+escapeHtml(formatCnpj(cnpj))+'</h4><p>'+(known?escapeHtml(branch.nomeFantasia):'Cadastro individual ainda não consultado')+'</p></div>'+(known?'<span class="status-pill '+(branch.situacao.toUpperCase()==='ATIVA'?'positive':'neutral')+'">'+escapeHtml(branch.situacao)+'</span>':'<button class="secondary-btn branch-detail-btn" type="button" data-branch-detail="'+cnpj+'" '+(branchState.busy===cnpj?'disabled':'')+'>'+(branchState.busy===cnpj?'Consultando...':'Ver dados')+'</button>')+'</div>'+list+'</article>';
}
function branchPanel(data) {
  const e=data.estabelecimento||{},root=String(data.cnpj_raiz||e.cnpj_raiz||digitsOf(e.cnpj).slice(0,8));
  return '<section class="dashboard-card branches" aria-labelledby="branches-title"><div class="branches-header"><div><span class="section-kicker">ESTABELECIMENTOS</span><h3 id="branches-title">Matriz e filiais</h3><p>Raiz do CNPJ: '+escapeHtml(root)+' · Confira outras unidades, seus endereços e atividades.</p></div><div class="branches-chip">Identificação por raiz</div></div><div id="branches-live" aria-live="polite"></div></section>';
}
function renderBranchSection() {
  const section=$('#branches-live');if(!section||!current)return;
  const b=branchState;
  let status='';
  if(b.mode==='loading') status='<div class="branch-message">Localizando estabelecimentos na base comercial...</div>';
  else if(b.mode==='manual') status='<div class="branch-message">A API gratuita não lista automaticamente as filiais. Para descobrir todas pela raiz, habilite uma credencial comercial no servidor. Você pode conferir um CNPJ conhecido abaixo. <strong>A ausência de resultados não significa que a empresa não tenha filiais.</strong></div>';
  else if(b.mode==='ready')status='<div class="branch-message success">Listagem da CNPJws comercial. '+(b.total==null?'Total não informado pela fonte.':'Total informado pela fonte: '+b.total+' estabelecimento(s), incluindo a matriz.')+' Página '+b.page+'/'+b.pages+'. As informações detalhadas são consultadas individualmente.</div>';
  if(b.error)status+='<div class="branch-message error">'+escapeHtml(b.error)+'</div>';
  const empty=b.mode==='ready'&&!b.ids.length&&b.pages===1?'<p class="branch-message">Nenhuma outra unidade identificada na listagem consultada.</p>':'';
  const cards=b.ids.map(id=>branchCard(b.details[id],id)).join('');
  const paging=b.mode==='ready'&&b.pages>1?'<div class="branch-pagination"><button type="button" data-page="'+(b.page-1)+'" '+(b.page===1?'disabled':'')+'>← Anterior</button><span>Página '+b.page+' / '+b.pages+'</span><button type="button" data-page="'+(b.page+1)+'" '+(b.page>=b.pages?'disabled':'')+'>Próxima →</button></div>':'';
  section.innerHTML=status+empty+'<div class="branch-list">'+cards+'</div>'+paging+'<form id="branch-manual-form" class="branch-manual"><label for="branch-cnpj">Consultar outra unidade pelo CNPJ completo</label><div class="branch-input-row"><input id="branch-cnpj" type="text" inputmode="numeric" autocomplete="off" maxlength="18" placeholder="00.000.000/0000-00"><button type="submit" class="secondary-btn" '+(b.busy?'disabled':'')+'>Consultar unidade</button></div><p>O CNPJ deve pertencer à mesma raiz ('+escapeHtml(b.root)+'). Consultas gratuitas adicionais estão sujeitas ao limite de 3/min por IP.</p></form>';
  section.querySelectorAll('[data-branch-detail]').forEach(btn=>btn.addEventListener('click',()=>loadBranch(btn.dataset.branchDetail)));
  section.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>discoverBranches(Number(btn.dataset.page))));
  $('#branch-manual-form').addEventListener('submit',event=>{event.preventDefault();const d=digitsOf($('#branch-cnpj').value);if(!validBranchCnpj(d)){setBranchError('Informe um CNPJ válido, com 14 dígitos');return;}if(d.slice(0,8)!==b.root){setBranchError('Este CNPJ não possui a mesma raiz da empresa pesquisada');return;}if(d===digitsOf(current.estabelecimento?.cnpj)){setBranchError('Este CNPJ já corresponde à empresa consultada');return;}loadBranch(d);});
}
function setBranchError(message){branchState.error=message;renderBranchSection();}
async function discoverBranches(page=1){
  const request=branchRequest;
  if(page===1){branchState.mode='loading';renderBranchSection();}
  try{
    const response=await fetch('/api/filiais?raiz='+encodeURIComponent(branchState.root)+'&page='+page,{headers:{Accept:'application/json'}});
    const body=await response.json().catch(()=>({}));
    if(request!==branchRequest)return;
    if(response.status===501){branchState.mode='manual';renderBranchSection();return;}
    if(!response.ok)throw new Error(body.detalhes||body.titulo||'Falha HTTP '+response.status);
    const currentCnpj=digitsOf(current?.estabelecimento?.cnpj);
    const ids=normalizeBranchList(body.cnpjs,branchState.root,currentCnpj);
    branchState={...branchState,ids:[...new Set([...branchState.ids,...ids])],mode:'ready',page:body.pagina||page,pages:Math.max(1,body.paginas||1),total:body.total??null,error:''};
    renderBranchSection();
  }catch(error){if(request!==branchRequest)return;branchState.mode='error';setBranchError(error.message||'Não foi possível consultar a listagem');}
}
async function loadBranch(cnpj){
  if(branchState.busy)return;
  const request=branchRequest;
  branchState.busy=cnpj;branchState.error='';renderBranchSection();
  try{
    const response=await fetch('/api/filial?cnpj='+encodeURIComponent(cnpj),{headers:{Accept:'application/json'}});
    const body=await response.json().catch(()=>({}));
    if(request!==branchRequest)return;
    if(!response.ok)throw new Error(body.detalhes||body.titulo||'Falha HTTP '+response.status);
    const record=branchFromCnpj(body,branchState.root);
    branchState.details[cnpj]=record;
    if(!branchState.ids.includes(cnpj))branchState.ids.push(cnpj);
    branchState.error='';
  }catch(error){if(request!==branchRequest)return;branchState.error=error.message||'Falha na consulta individual';}
  finally{if(request===branchRequest){branchState.busy='';renderBranchSection();}}
}
function renderResult(data) {
  current = data;
  activeTab = getExplorerSections(data)[0]?.key || 'overview';
  results.innerHTML = `
    <div class="results-head">
      <div>
        <span class="section-kicker">DASHBOARD</span>
        <h2>Consulta concluída com sucesso</h2>
      </div>
      <div class="success-box">✓ Dados carregados</div>
    </div>
    ${buildSummary(data)}
    ${branchPanel(data)}
    ${extras.panel()}
    ${buildExplorer(data)}
    <div class="source-note">Dados fornecidos pela CNPJws. Utilize este painel como apoio e confirme informações cadastrais essenciais nos canais oficiais.</div>
  `;
  results.hidden = false;
  empty.hidden = true;
  document.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => { activeTab = btn.dataset.tab; renderExplorerSection(); }));
  $('#print-btn').addEventListener('click', printReport);
  renderExplorerSection();
  extras.reset();
  extras.render();
  branchRequest++;
  branchState={root:String(data.cnpj_raiz||data.estabelecimento?.cnpj_raiz||digitsOf(data.estabelecimento?.cnpj).slice(0,8)),ids:[],details:{},mode:'idle',page:1,pages:1,total:null,error:'',busy:''};
  discoverBranches(1);
}
function refreshInput() {
  input.value = formatCnpj(input.value);
  const digits = digitsOf(input.value);
  const invalid = digits.length === 14 && !validCnpj(digits);
  $('#input-wrap').classList.toggle('invalid', invalid);
  $('#input-count').textContent = `${digits.length}/14`;
  $('#cnpj-help-text').textContent = invalid ? 'Os dígitos verificadores do CNPJ são inválidos.' : 'Digite os 14 números do CNPJ. O sistema valida os dígitos verificadores automaticamente.';
  button.disabled = !validCnpj(digits) || !loading.hidden;
}
input.addEventListener('input', () => { refreshInput(); if (!notice.hidden) displayNotice(''); });
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const cnpj = digitsOf(input.value);
  if (!validCnpj(cnpj) || !loading.hidden) return;
  controller?.abort();
  controller = new AbortController();
  const request = ++activeRequest;
  current = null;
  extras.reset();
  branchRequest++;
  results.hidden = true;
  empty.hidden = true;
  loading.hidden = false;
  displayNotice('');
  refreshInput();
  button.textContent = 'Consultando...';
  try {
    const response = await fetch(`/api/cnpj/${cnpj}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = [body?.titulo, body?.detalhes].filter(Boolean).join(' — ');
      throw new Error(detail || (response.status === 429 ? 'Limite de consultas atingido. Aguarde um minuto.' : `Falha HTTP ${response.status}.`));
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('A API retornou um formato inesperado.');
    if (request === activeRequest) renderResult(body);
  } catch (error) {
    if (error.name === 'AbortError' || request !== activeRequest) return;
    displayNotice(error instanceof TypeError ? 'API indisponível. Mantenha a janela do ATLAS aberta, confira sua conexão e tente novamente.' : error.message);
    empty.hidden = false;
  } finally {
    if (request === activeRequest) {
      loading.hidden = true;
      button.textContent = 'Consultar CNPJ';
      refreshInput();
    }
  }
});
async function health() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    if (!response.ok) throw new Error('Indisponível');
    $('#connect-status').textContent = 'API conectada · CNPJws';
  } catch {
    $('#connect-status').textContent = 'Servidor local indisponível';
    displayNotice('Falha na conexão com o backend. Verifique o deployment na Vercel e tente novamente.');
  }
}
refreshInput();
health();
