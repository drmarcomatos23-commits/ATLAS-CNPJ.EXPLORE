import { buildReportHtml } from './report.mjs';
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
let municipal = blankMunicipal();
function blankMunicipal() { return { inscricao: '', alvara: '', emissao: '', validade: '', inscricaoConfirmada: false, alvaraConfirmado: false, observacao: '' }; }


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
    { key: 'taxes', label: 'Fiscal e licenças', value: { inscricoes_estaduais: registries, simples: data.simples, inscricao_municipal: municipal.inscricao || 'Não verificada', alvara: municipal.alvara || 'Não verificado' } }
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
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'print-area';
    document.body.appendChild(printArea);
  }
  printArea.innerHTML = buildReportHtml(data, getSummaryModel(data), { ...municipal, cityUf: getSummaryModel(data).cityUf });
}
function printReport() {
  if (!current) return;
  ensurePrintArea(current);
  window.print();
}
function municipalSection(data) {
  const e = data.estabelecimento || {};
  const city = (e.cidade && typeof e.cidade === 'object' ? e.cidade.nome : e.cidade) || '';
  const state = (e.estado && typeof e.estado === 'object' ? e.estado.sigla : e.estado) || '';
  const santos = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'santos' && state.toUpperCase() === 'SP';
  const links = santos
    ? '<div class="municipal-links"><a href="https://egov.santos.sp.gov.br/tribusweb/CertidaoGeral/Certidao" target="_blank" rel="noopener noreferrer">Certidão municipal ↗</a><a href="https://egov.santos.sp.gov.br/tribusweb/Mobiliario/Alvara" target="_blank" rel="noopener noreferrer">Emissão do alvará ↗</a><a href="https://egov.santos.sp.gov.br/tribusweb/Mobiliario/AlvaraAutenticarInicio" target="_blank" rel="noopener noreferrer">Autenticidade do alvará ↗</a></div>'
    : '<p class="municipal-helper">Para '+escapeHtml([city,state].filter(Boolean).join(' / ') || 'o município')+', consulte o portal oficial da respectiva prefeitura. Não há integração municipal disponível para consulta automática.</p>';
  const entry = (key, title, placeholder = '') =>
    '<label>'+title+' <input data-municipal="'+key+'" value="'+escapeHtml(municipal[key])+'" autocomplete="off" placeholder="'+placeholder+'" maxlength="60"></label>';
  const dates = (key, title) =>
    '<label>'+title+' <input type="date" data-municipal="'+key+'" value="'+escapeHtml(municipal[key])+'"></label>';
  const check = (key, title) =>
    '<label class="municipal-check"><input type="checkbox" data-municipal="'+key+'" '+(municipal[key]?'checked':'')+'> '+title+'</label>';
  return '<section class="dashboard-card municipal-card" aria-labelledby="municipal-title">'
    +'<div class="municipal-head"><div><span class="section-kicker">CONFERÊNCIA COMPLEMENTAR</span><h3 id="municipal-title">Inscrição municipal e alvará</h3><p>O cadastro CNPJws não fornece esses documentos. Os campos abaixo são preenchidos manualmente após consulta ao órgão municipal.</p></div><span class="verification-badge">Não verificado automaticamente</span></div>'
    +links+'<div class="municipal-form">'
    +entry('inscricao','Inscrição municipal','Número no cadastro municipal')
    +entry('alvara','Número do alvará','Número constante no documento')
    +dates('emissao','Emissão do alvará')
    +dates('validade','Validade do alvará')
    +check('inscricaoConfirmada','Conferi a inscrição em documento/portal oficial.')
    +check('alvaraConfirmado','Conferi o alvará em documento/portal oficial.')
    +'<label class="municipal-wide">Observações e referência documental <textarea data-municipal="observacao" maxlength="500" rows="2" placeholder="Ex.: número da certidão e data da consulta; não informe senhas ou códigos de acesso.">'+escapeHtml(municipal.observacao)+'</textarea></label></div>'
    +'<p class="municipal-disclaimer">O ATLAS não consulta o sistema municipal nem confirma a autenticidade dos documentos. A marcação de conferência é uma declaração do usuário, não uma validação automatizada. Não informe código de acesso ou CAPTCHA nesta tela.</p></section>';
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
    ${municipalSection(data)}
    ${buildExplorer(data)}
    <div class="source-note">Dados fornecidos pela CNPJws. Utilize este painel como apoio e confirme informações cadastrais essenciais nos canais oficiais.</div>
  `;
  results.hidden = false;
  empty.hidden = true;
  document.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => { activeTab = btn.dataset.tab; renderExplorerSection(); }));
  $('#print-btn').addEventListener('click', printReport);
  document.querySelectorAll('[data-municipal]').forEach(field => field.addEventListener('change', () => {
    const key = field.dataset.municipal;
    municipal[key] = field.type === 'checkbox' ? field.checked : field.value;
    if (activeTab === 'taxes') renderExplorerSection();
  }));
  renderExplorerSection();
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
  municipal = blankMunicipal();
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
