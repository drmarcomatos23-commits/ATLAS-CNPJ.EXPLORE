/* ATLAS Legalização V8 — Central de Legalização
 *
 * Funções replicadas das ferramentas de mercado, sem nenhuma API paga:
 *  - Checklist de tarefas por processo, com data meta x data legal e status "impedida"
 *    com justificativa (Gestta / Acessórias)
 *  - Modelos de checklist por tipo de serviço (Gestta: fluxos de tarefas)
 *  - Protocolos por órgão, com próxima verificação e link oficial (Econsulte)
 *  - Exigências e condicionantes com prazo e responsável (Siga / Ambipar)
 *  - Certidões e vencimentos com status (válido / a vencer / vencido / em renovação),
 *    filtros por órgão, categoria e responsável, atalhos oficiais de emissão gratuita,
 *    importação em lote CSV/XLSX e exportação (Projuris Empresas, Jettax, Dootax, Gestão de Alvarás)
 *  - Agenda unificada de prazos com exportação para calendário .ics
 *  - Comunicação com o cliente por WhatsApp / e-mail com modelos e registro (Acessórias, Econsulte)
 *  - Acompanhamento do cliente (perfil Cliente) com checklist visível e exigências
 */
(() => {
  'use strict';

  const VERSION = '8.4';
  const TZ = 'America/Sao_Paulo';
  const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  /* ---------------- utilidades ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const db = () => window.atlasAuth?.client || null;
  const profile = () => window.atlasAuth?.getProfile?.() || window.atlasCurrentProfile || {};
  const role = () => profile().role || 'cliente';
  const canEdit = () => ['admin', 'operacao'].includes(role());
  const isClient = () => role() === 'cliente';
  const digits = v => String(v ?? '').replace(/\D/g, '');
  const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  function todayISO() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return parts; // YYYY-MM-DD
  }
  function addDays(iso, n) {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + Number(n || 0));
    return d.toISOString().slice(0, 10);
  }
  function diffDays(iso, base = todayISO()) {
    if (!iso) return null;
    const a = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
    const b = new Date(base + 'T12:00:00Z');
    return Math.round((a - b) / 86400000);
  }
  function br(iso) {
    if (!iso) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
  }
  function brDateTime(v) { if (!v) return '—'; try { return new Date(v).toLocaleString('pt-BR', { timeZone: TZ }); } catch { return String(v); } }
  function parseFlexibleDate(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' && v > 20000 && v < 80000) { // serial Excel
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return d.toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(s);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    return null;
  }
  function setHeadSafe(title, kicker, desc) { if (typeof window.setHead === 'function') return window.setHead(title, kicker, desc); if (typeof setHead === 'function') return setHead(title, kicker, desc); }
  function pageSafe(html) { const host = $('#page-content'); if (host) host.innerHTML = html; }
  function loading(text) { pageSafe(`<div class="loading-box"><span class="spinner"></span><div>${h(text)}</div></div>`); }
  function shell(title, body, wide = false) {
    const fn = window.modalShell || (typeof modalShell === 'function' ? modalShell : null);
    if (fn) return fn(title, body, wide);
    const root = $('#atlas-modal-root');
    root.innerHTML = `<div class="atlas-modal-backdrop" onclick="if(event.target===this)closeAtlasModal()"><div class="atlas-modal ${wide ? 'wide' : ''}"><div class="atlas-modal-head"><div><span class="eyebrow">ATLAS</span><h2>${h(title)}</h2></div><button class="modal-close" onclick="closeAtlasModal()">×</button></div><div class="atlas-modal-body">${body}</div></div></div>`;
  }
  function closeModal() { if (typeof window.closeAtlasModal === 'function') window.closeAtlasModal(); else { const r = $('#atlas-modal-root'); if (r) r.innerHTML = ''; } }
  function toast(msg, kind = 'ok') {
    let host = $('#lx-toast-host');
    if (!host) { host = document.createElement('div'); host.id = 'lx-toast-host'; document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = `lx-toast ${kind}`; el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
  }
  function badge(text, cls) { return `<span class="lx-badge ${cls || 'neutral'}">${h(text)}</span>`; }
  function kpi(label, value, small, cls = '') { return `<div class="lx-kpi ${cls}"><span>${h(label)}</span><strong>${h(value)}</strong><small>${h(small)}</small></div>`; }
  function empty(title, text, btn = '') { return `<div class="lx-empty"><div class="lx-empty-ico">＋</div><h3>${h(title)}</h3><p>${h(text)}</p>${btn}</div>`; }
  function msgBox(sel, text, kind = 'error') { const m = $(sel); if (!m) return; m.textContent = text; m.className = `auth-message ${kind} span-2`; }
  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function csv(rows) {
    const cell = v => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  }
  function missingTable(err) { const m = String(err?.message || err?.code || ''); return /does not exist|PGRST205|42P01|schema cache/i.test(m); }

  /* ---------------- dicionários ---------------- */
  const TASK_STATUS = { aberta: ['Aberta', 'info'], concluida: ['Concluída', 'ok'], impedida: ['Impedida', 'bad'], desconsiderada: ['Desconsiderada', 'neutral'] };
  const PARTY = { escritorio: 'Escritório', cliente: 'Cliente', orgao: 'Órgão público' };
  const REQ_STATUS = { aberta: ['Aberta', 'bad'], em_atendimento: ['Em atendimento', 'warn'], cumprida: ['Cumprida', 'ok'], cancelada: ['Cancelada', 'neutral'] };
  const PROTO_STATUS = ['Em análise', 'Em exigência', 'Deferido', 'Indeferido', 'Arquivado', 'Cancelado'];
  const PROTO_TYPES = ['Viabilidade', 'DBE / Receita Federal', 'Registro Junta Comercial', 'Inscrição municipal', 'Inscrição estadual', 'Alvará de funcionamento', 'Licença sanitária', 'AVCB / Bombeiros', 'Licença ambiental', 'Conselho de classe', 'Outro'];
  const AGENCIES = ['JUCESP', 'Receita Federal', 'Redesim', 'Prefeitura', 'Vigilância Sanitária', 'Corpo de Bombeiros', 'CETESB', 'SEFAZ-SP', 'PGFN', 'Caixa (FGTS)', 'TST', 'Cartório de Registro de Imóveis', 'Conselho de classe'];
  const CATEGORY = { licenca: 'Licença', alvara: 'Alvará', certidao: 'Certidão', certificado_digital: 'Certificado digital', registro: 'Registro', outro: 'Outro' };

  // Atalhos oficiais e gratuitos de emissão. A emissão é feita no portal do órgão; o ATLAS
  // controla validade, arquivo e alertas (sem robôs pagos).
  const STANDARD_CERTIDOES = [
    { key: 'cnd_federal', name: 'CND Federal (Receita/PGFN)', agency: 'Receita Federal / PGFN', days: 180, url: 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/certidoes-e-situacao-fiscal' },
    { key: 'crf_fgts', name: 'CRF — Regularidade do FGTS', agency: 'Caixa (FGTS)', days: 30, url: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf' },
    { key: 'cndt', name: 'CNDT — Débitos Trabalhistas', agency: 'TST', days: 180, url: 'https://cndt-certidao.tst.jus.br/inicio.faces' },
    { key: 'cnd_estadual', name: 'CND Estadual (Dívida Ativa SP)', agency: 'PGE-SP / SEFAZ-SP', days: 180, url: 'https://www.dividaativa.pge.sp.gov.br/sc/pages/crda/emitirCrda.jsf' },
    { key: 'cnd_municipal', name: 'CND Municipal (Tributos mobiliários)', agency: 'Prefeitura', days: 90, url: '' },
    { key: 'cert_digital', name: 'Certificado digital e-CNPJ', agency: 'Autoridade certificadora', days: 365, url: '', category: 'certificado_digital' }
  ];

  const MESSAGE_TEMPLATES = {
    etapa: { label: 'Etapa concluída', subject: 'Atualização do processo {codigo}', body: 'Olá, {contato}! Passando para informar que concluímos a etapa "{etapa}" do processo {codigo} ({titulo}) da {empresa}. Seguimos acompanhando e avisaremos a próxima atualização.' },
    documentos: { label: 'Pendência do cliente', subject: 'Documentos pendentes — {codigo}', body: 'Olá, {contato}! Para darmos andamento ao processo {codigo} ({titulo}) da {empresa}, precisamos de: {pendencias}. Assim que recebermos, seguimos com o protocolo.' },
    exigencia: { label: 'Exigência do órgão', subject: 'Exigência recebida — {codigo}', body: 'Olá, {contato}! O órgão responsável emitiu uma exigência no processo {codigo} da {empresa}: {exigencia}. Já estamos tratando e, se precisarmos de algo, avisaremos.' },
    protocolo: { label: 'Protocolo realizado', subject: 'Protocolo realizado — {codigo}', body: 'Olá, {contato}! O pedido do processo {codigo} da {empresa} foi protocolado ({protocolo}). Agora aguardamos a análise do órgão.' },
    concluido: { label: 'Processo concluído', subject: 'Processo concluído — {codigo}', body: 'Olá, {contato}! O processo {codigo} ({titulo}) da {empresa} foi concluído. Os documentos finais estão disponíveis com o escritório.' },
    vencimento: { label: 'Vencimento próximo', subject: 'Vencimento próximo — {empresa}', body: 'Olá, {contato}! Identificamos que {documento} da {empresa} vence em {vencimento}. Podemos iniciar a renovação?' }
  };

  /* ---------------- dados ---------------- */
  let schemaReady = true;

  async function q(table, build) {
    const client = db();
    if (!client) return { data: [], error: new Error('Banco indisponível') };
    try {
      const { data, error } = await (build ? build(client.from(table)) : client.from(table).select('*'));
      return { data: data || [], error };
    } catch (error) { return { data: [], error }; }
  }

  async function loadCentral(extra = {}) {
    const base = typeof window.loadOperationalData === 'function' ? await window.loadOperationalData()
      : (typeof loadOperationalData === 'function' ? await loadOperationalData() : { clients: [], processes: [], profiles: [], protocols: [], licenses: [] });
    const jobs = {
      tasks: q('process_tasks', t => t.select('*').order('position', { ascending: true })),
      requirements: q('process_requirements', t => t.select('*').order('due_date', { ascending: true, nullsFirst: false })),
      templates: extra.templates ? q('task_templates', t => t.select('*').eq('active', true).order('name')) : Promise.resolve({ data: [] }),
      protocols: q('protocols', t => t.select('*')),
      docItems: q('process_doc_items', t => t.select('*').order('position', { ascending: true })),
      documents: extra.documents ? q('documents', t => t.select('id,name,category,process_id,client_id,mime_type,size_bytes,created_at').order('created_at', { ascending: false })) : Promise.resolve({ data: [] })
    };
    const keys = Object.keys(jobs);
    const res = await Promise.all(Object.values(jobs));
    const out = { ...base };
    let missing = false;
    res.forEach((r, i) => { if (r.error && missingTable(r.error)) missing = true; out[keys[i]] = r.error ? [] : r.data; });
    schemaReady = !missing;
    out.processes = (out.processes || []).filter(p => !p.deleted_at);
    out.clientMap = new Map((out.clients || []).map(c => [c.id, c]));
    out.processMap = new Map(out.processes.map(p => [p.id, p]));
    out.profileMap = new Map((out.profiles || []).map(p => [p.id, p]));
    out.stageMap = new Map((out.stages || []).map(s => [s.id, s]));
    return out;
  }

  const clientName = (data, id) => data.clientMap.get(id)?.legal_name || '—';
  const personName = (data, id) => data.profileMap.get(id)?.full_name || 'Não atribuído';
  const procLabel = p => p ? `${p.public_code || 'Processo'} · ${p.title || ''}` : '—';
  const staff = data => (data.profiles || []).filter(p => ['admin', 'operacao'].includes(p.role) || !p.role);

  function schemaNotice() {
    return schemaReady ? '' : `<div class="lx-notice warn"><strong>Recursos aguardando ativação no banco.</strong> As tabelas da Central de Legalização ainda não foram criadas no Supabase. As telas funcionam em modo consulta até a migração <code>20261024_central_legalizacao_v8</code> ser aplicada.</div>`;
  }

  function taskDeadlineState(t) {
    if (t.status !== 'aberta') return 'done';
    const dl = diffDays(t.legal_date); const dm = diffDays(t.target_date);
    if (dl !== null && dl < 0) return 'legal_late';
    if (dl !== null && dl <= 3) return 'legal_risk';
    if (dm !== null && dm < 0) return 'late';
    if (dm === 0) return 'today';
    if (dm !== null && dm <= 7) return 'week';
    return 'ok';
  }
  const DEADLINE_BADGE = {
    legal_late: ['Data legal vencida', 'bad'], legal_risk: ['Risco de multa', 'bad'], late: ['Atrasada', 'bad'],
    today: ['Hoje', 'warn'], week: ['Esta semana', 'warn'], ok: ['No prazo', 'ok'], done: ['', '']
  };

  function licenseState(l) {
    if (l.status === 'not_applicable') return { key: 'na', label: 'Não se aplica', cls: 'neutral' };
    if (l.status === 'renewing') return { key: 'renewing', label: 'Em renovação', cls: 'info' };
    if (!l.expires_at) return { key: 'nodate', label: 'Sem vencimento', cls: 'warn' };
    const d = diffDays(l.expires_at);
    if (d < 0) return { key: 'expired', label: `Vencido há ${Math.abs(d)}d`, cls: 'bad', d };
    if (d === 0) return { key: 'today', label: 'Vence hoje', cls: 'bad', d };
    if (d <= 30) return { key: 'soon', label: `Vence em ${d}d`, cls: 'warn', d };
    if (d <= 90) return { key: 'attention', label: `${d} dias`, cls: 'info', d };
    return { key: 'valid', label: 'Válido', cls: 'ok', d };
  }

  /* ================================================================
     1. TAREFAS E CHECKLIST
     ================================================================ */
  const taskFilters = { owner: '', status: 'aberta', client: '', deadline: '', text: '' };

  async function tasksPage() {
    if (isClient()) return clientFollowUpPage();
    setHeadSafe('Tarefas e checklist', 'OPERAÇÃO', 'Checklist de cada processo com data meta, data legal, responsável e impedimentos.');
    loading('Carregando tarefas...');
    const data = await loadCentral({ templates: true });
    window.__lxData = data;
    renderTasks(data);
  }

  function renderTasks(data) {
    const all = data.tasks || [];
    const open = all.filter(t => t.status === 'aberta');
    const states = open.map(taskDeadlineState);
    const late = states.filter(s => ['late', 'legal_late'].includes(s)).length;
    const risk = states.filter(s => ['legal_risk', 'legal_late'].includes(s)).length;
    const week = states.filter(s => ['today', 'week'].includes(s)).length;
    const blocked = all.filter(t => t.status === 'impedida').length;
    const me = profile().id;

    const list = all.filter(t => {
      const p = data.processMap.get(t.process_id); if (!p) return false;
      if (taskFilters.status && t.status !== taskFilters.status) return false;
      if (taskFilters.owner === 'me' && t.assignee_id !== me) return false;
      if (taskFilters.owner && taskFilters.owner !== 'me' && t.assignee_id !== taskFilters.owner) return false;
      if (taskFilters.client && p.client_id !== taskFilters.client) return false;
      if (taskFilters.deadline) { const s = taskDeadlineState(t); if (taskFilters.deadline === 'late' && !['late', 'legal_late'].includes(s)) return false; if (taskFilters.deadline === 'risk' && !['legal_risk', 'legal_late'].includes(s)) return false; if (taskFilters.deadline === 'week' && !['today', 'week'].includes(s)) return false; }
      if (taskFilters.text && !norm([t.title, t.phase, p.public_code, p.title, clientName(data, p.client_id)].join(' ')).includes(norm(taskFilters.text))) return false;
      return true;
    });

    const groups = new Map();
    list.forEach(t => { if (!groups.has(t.process_id)) groups.set(t.process_id, []); groups.get(t.process_id).push(t); });
    const allByProcess = new Map();
    all.forEach(t => { if (!allByProcess.has(t.process_id)) allByProcess.set(t.process_id, []); allByProcess.get(t.process_id).push(t); });

    const usedClients = [...new Set(all.map(t => data.processMap.get(t.process_id)?.client_id).filter(Boolean))].map(id => data.clientMap.get(id)).filter(Boolean).sort((a, b) => a.legal_name.localeCompare(b.legal_name, 'pt-BR'));

    const blocks = [...groups.entries()].map(([pid, tasks]) => {
      const p = data.processMap.get(pid);
      const every = allByProcess.get(pid) || [];
      const valid = every.filter(t => t.status !== 'desconsiderada');
      const done = valid.filter(t => t.status === 'concluida').length;
      const pct = valid.length ? Math.round(done / valid.length * 100) : 0;
      return `<section class="lx-card lx-task-group">
        <header class="lx-task-group-head">
          <div><strong>${h(p.public_code || 'Processo')}</strong><span>${h(p.title || '')} · ${h(clientName(data, p.client_id))}</span></div>
          <div class="lx-progress-wrap"><div class="lx-progress"><i style="width:${pct}%"></i></div><small>${done}/${valid.length} · ${pct}%</small></div>
          ${(() => { const di = (data.docItems || []).filter(d => d.process_id === pid); if (!di.length) return ''; const ok = di.filter(d => d.status !== 'pendente').length; return badge(`Docs ${ok}/${di.length}`, ok === di.length ? 'ok' : 'warn'); })()}
          <button class="mini-btn" type="button" data-lx-panel="${h(pid)}">Abrir painel</button>
        </header>
        <div class="lx-task-list">${tasks.map(t => taskRow(data, t)).join('')}</div>
      </section>`;
    }).join('');

    const hasTasks = all.length > 0;
    pageSafe(`${schemaNotice()}
      <div class="lx-kpis">
        ${kpi('Tarefas abertas', open.length, 'Checklists em andamento')}
        ${kpi('Atrasadas', late, 'Data meta ou legal vencida', late ? 'bad' : '')}
        ${kpi('Risco de multa', risk, 'Data legal em até 3 dias', risk ? 'bad' : '')}
        ${kpi('Esta semana', week, 'Data meta em até 7 dias', week ? 'warn' : '')}
        ${kpi('Impedidas', blocked, 'Aguardando terceiros', blocked ? 'warn' : '')}
      </div>
      <section class="lx-card">
        <div class="lx-toolbar">
          <input id="lx-task-search" type="search" placeholder="Buscar tarefa, processo ou empresa" value="${h(taskFilters.text)}">
          <select id="lx-task-status"><option value="">Todos os status</option>${Object.entries(TASK_STATUS).map(([k, v]) => `<option value="${k}" ${taskFilters.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
          <select id="lx-task-deadline"><option value="">Todos os prazos</option><option value="late" ${taskFilters.deadline === 'late' ? 'selected' : ''}>Atrasadas</option><option value="risk" ${taskFilters.deadline === 'risk' ? 'selected' : ''}>Risco de multa</option><option value="week" ${taskFilters.deadline === 'week' ? 'selected' : ''}>Esta semana</option></select>
          <select id="lx-task-owner"><option value="">Todos os responsáveis</option><option value="me" ${taskFilters.owner === 'me' ? 'selected' : ''}>Minhas tarefas</option>${staff(data).map(p => `<option value="${p.id}" ${taskFilters.owner === p.id ? 'selected' : ''}>${h(p.full_name)}</option>`).join('')}</select>
          <select id="lx-task-client"><option value="">Todas as empresas</option>${usedClients.map(c => `<option value="${c.id}" ${taskFilters.client === c.id ? 'selected' : ''}>${h(c.legal_name)}</option>`).join('')}</select>
          <div class="lx-toolbar-actions">
            <button class="btn btn-muted" type="button" id="lx-task-export">Exportar CSV</button>
            ${canEdit() && schemaReady ? '<button class="btn btn-muted" type="button" id="lx-apply-template">Aplicar modelo</button><button class="btn btn-primary" type="button" id="lx-new-task">＋ Nova tarefa</button>' : ''}
          </div>
        </div>
      </section>
      ${hasTasks ? (blocks || '<section class="lx-card">' + empty('Nenhuma tarefa com esses filtros', 'Ajuste os filtros acima para ver outras tarefas.') + '</section>') :
        `<section class="lx-card">${empty('Nenhum checklist criado ainda', 'Aplique um modelo pronto (abertura, alteração, baixa, renovação ou holding) a um processo para gerar o checklist com datas meta.', canEdit() && schemaReady ? '<button class="btn btn-primary" type="button" id="lx-apply-template-empty">Aplicar modelo a um processo</button>' : '')}</section>`}
    `);

    const rerender = () => renderTasks(data);
    $('#lx-task-search')?.addEventListener('input', e => { taskFilters.text = e.target.value; clearTimeout(renderTasks._t); renderTasks._t = setTimeout(() => { rerender(); const i = $('#lx-task-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); });
    $('#lx-task-status')?.addEventListener('change', e => { taskFilters.status = e.target.value; rerender(); });
    $('#lx-task-deadline')?.addEventListener('change', e => { taskFilters.deadline = e.target.value; rerender(); });
    $('#lx-task-owner')?.addEventListener('change', e => { taskFilters.owner = e.target.value; rerender(); });
    $('#lx-task-client')?.addEventListener('change', e => { taskFilters.client = e.target.value; rerender(); });
    $('#lx-new-task')?.addEventListener('click', () => openTaskModal(data));
    $('#lx-apply-template')?.addEventListener('click', () => openTemplateModal(data));
    $('#lx-apply-template-empty')?.addEventListener('click', () => openTemplateModal(data));
    $('#lx-task-export')?.addEventListener('click', () => exportTasks(data, list));
    bindTaskRowActions(data, $('#page-content'), () => tasksPage());
  }

  function taskRow(data, t) {
    const st = TASK_STATUS[t.status] || [t.status, 'neutral'];
    const ds = taskDeadlineState(t); const db_ = DEADLINE_BADGE[ds];
    const done = t.status === 'concluida';
    return `<article class="lx-task ${done ? 'done' : ''} ${t.status}" data-task="${h(t.id)}">
      ${canEdit() && schemaReady ? `<button class="lx-check ${done ? 'on' : ''}" type="button" title="${done ? 'Reabrir' : 'Concluir'}" data-lx-task-act="${done ? 'reopen' : 'done'}" data-id="${h(t.id)}" aria-label="${done ? 'Reabrir tarefa' : 'Concluir tarefa'}">${done ? '✓' : ''}</button>` : `<span class="lx-check ${done ? 'on' : ''}">${done ? '✓' : ''}</span>`}
      <div class="lx-task-main">
        <strong>${h(t.title)}</strong>
        <div class="lx-task-meta">
          ${t.phase ? `<span>${h(t.phase)}</span>` : ''}
          <span>${h(PARTY[t.responsible_party] || 'Escritório')}</span>
          <span>${h(personName(data, t.assignee_id))}</span>
          <span>Meta ${br(t.target_date)}</span>
          ${t.legal_date ? `<span>Legal ${br(t.legal_date)}</span>` : ''}
          ${!t.client_visible ? '<span>Interna</span>' : ''}
        </div>
        ${t.status === 'impedida' && t.blocked_reason ? `<div class="lx-blocked">Impedimento: ${h(t.blocked_reason)}</div>` : ''}
        ${t.description ? `<div class="lx-task-desc">${h(t.description)}</div>` : ''}
      </div>
      <div class="lx-task-side">
        ${t.status !== 'aberta' ? badge(st[0], st[1]) : (db_[0] ? badge(db_[0], db_[1]) : '')}
        ${canEdit() && schemaReady ? `<div class="lx-row-actions">
          ${t.status === 'aberta' ? `<button class="mini-btn" type="button" data-lx-task-act="block" data-id="${h(t.id)}">Impedir</button>` : ''}
          ${t.status === 'impedida' ? `<button class="mini-btn" type="button" data-lx-task-act="reopen" data-id="${h(t.id)}">Desbloquear</button>` : ''}
          <button class="mini-btn" type="button" data-lx-task-act="edit" data-id="${h(t.id)}">Editar</button>
          ${t.status === 'concluida' && t.client_visible ? `<button class="mini-btn" type="button" data-lx-task-act="notify" data-id="${h(t.id)}">Avisar cliente</button>` : ''}
        </div>` : ''}
      </div>
    </article>`;
  }

  function bindTaskRowActions(data, root, refresh) {
    root?.querySelectorAll('[data-lx-panel]').forEach(b => b.addEventListener('click', () => openPanel(b.dataset.lxPanel)));
    root?.querySelectorAll('[data-lx-task-act]').forEach(b => b.addEventListener('click', async () => {
      const t = (data.tasks || []).find(x => x.id === b.dataset.id); if (!t) return;
      const act = b.dataset.lxTaskAct;
      if (act === 'edit') return openTaskModal(data, t, refresh);
      if (act === 'block') return openBlockModal(t, refresh);
      if (act === 'notify') return openCommunicationModal(t.process_id, 'etapa', { etapa: t.title });
      b.disabled = true;
      const status = act === 'done' ? 'concluida' : 'aberta';
      const { error } = await db().from('process_tasks').update({ status }).eq('id', t.id);
      if (error) { b.disabled = false; return toast('Não foi possível atualizar: ' + error.message, 'bad'); }
      if (status === 'concluida' && t.client_visible) {
        toast('Tarefa concluída. Use "Avisar cliente" para comunicar a etapa.');
      }
      await refresh();
    }));
  }

  function taskFormFields(data, t = {}, fixedProcessId = '') {
    const procs = data.processes.filter(p => !['cancelled'].includes(p.status));
    return `
      ${fixedProcessId ? `<input type="hidden" id="lx-t-process" value="${h(fixedProcessId)}">` :
        `<div class="field span-2"><label>Processo *</label><select id="lx-t-process" required><option value="">Selecione</option>${procs.map(p => `<option value="${p.id}" ${t.process_id === p.id ? 'selected' : ''}>${h(procLabel(p))} — ${h(clientName(data, p.client_id))}</option>`).join('')}</select></div>`}
      <div class="field span-2"><label>Tarefa *</label><input id="lx-t-title" required maxlength="240" value="${h(t.title || '')}" placeholder="Ex.: Protocolar alteração na JUCESP"></div>
      <div class="field"><label>Fase</label><input id="lx-t-phase" list="lx-phase-list" value="${h(t.phase || '')}" placeholder="Viabilidade, Registro..."><datalist id="lx-phase-list">${['Briefing', 'Viabilidade', 'DBE / Receita', 'Registro', 'Inscrições', 'Licenciamento', 'Conclusão'].map(x => `<option value="${x}">`).join('')}</datalist></div>
      <div class="field"><label>Quem executa</label><select id="lx-t-party">${Object.entries(PARTY).map(([k, v]) => `<option value="${k}" ${(t.responsible_party || 'escritorio') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Responsável no escritório</label><select id="lx-t-assignee"><option value="">Responsável do processo</option>${staff(data).map(p => `<option value="${p.id}" ${t.assignee_id === p.id ? 'selected' : ''}>${h(p.full_name)}</option>`).join('')}</select></div>
      <div class="field"><label>Visível ao cliente</label><select id="lx-t-visible"><option value="1" ${t.client_visible !== false ? 'selected' : ''}>Sim</option><option value="0" ${t.client_visible === false ? 'selected' : ''}>Não (interna)</option></select></div>
      <div class="field"><label>Data meta (prazo interno)</label><input id="lx-t-target" type="date" value="${h(t.target_date || '')}"></div>
      <div class="field"><label>Data legal (prazo do órgão / lei)</label><input id="lx-t-legal" type="date" value="${h(t.legal_date || '')}"></div>
      <div class="field span-2"><label>Observações</label><textarea id="lx-t-desc" rows="2">${h(t.description || '')}</textarea></div>`;
  }

  function readTaskForm() {
    return {
      process_id: $('#lx-t-process').value,
      title: $('#lx-t-title').value.trim(),
      phase: $('#lx-t-phase').value.trim() || null,
      responsible_party: $('#lx-t-party').value,
      assignee_id: $('#lx-t-assignee').value || null,
      client_visible: $('#lx-t-visible').value === '1',
      target_date: $('#lx-t-target').value || null,
      legal_date: $('#lx-t-legal').value || null,
      description: $('#lx-t-desc').value.trim() || null
    };
  }

  function openTaskModal(data, t = null, refresh = tasksPage, fixedProcessId = '') {
    shell(t ? 'Editar tarefa' : 'Nova tarefa', `<form id="lx-task-form" class="modal-form-grid">
      ${taskFormFields(data, t || {}, fixedProcessId)}
      <div class="modal-actions span-2">
        ${t ? '<button type="button" class="btn btn-muted lx-danger-text" id="lx-t-delete">Excluir</button><button type="button" class="btn btn-muted" id="lx-t-ignore">Desconsiderar</button>' : ''}
        <button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button>
        <button class="btn btn-primary" type="submit" id="lx-t-save">Salvar tarefa</button>
      </div>
      <div id="lx-t-msg" class="auth-message hidden span-2"></div>
    </form>`, true);
    $('#lx-task-form').addEventListener('submit', async e => {
      e.preventDefault();
      const payload = readTaskForm();
      if (!payload.process_id) return msgBox('#lx-t-msg', 'Selecione o processo.');
      if (payload.target_date && payload.legal_date && payload.target_date > payload.legal_date) return msgBox('#lx-t-msg', 'A data meta deve ser anterior ou igual à data legal (margem de segurança).');
      const btn = $('#lx-t-save'); btn.disabled = true; btn.textContent = 'Salvando...';
      let error;
      if (t) ({ error } = await db().from('process_tasks').update(payload).eq('id', t.id));
      else {
        const pos = (data.tasks || []).filter(x => x.process_id === payload.process_id).length;
        ({ error } = await db().from('process_tasks').insert({ ...payload, organization_id: profile().organization_id, created_by: profile().id, position: pos }));
      }
      if (error) { btn.disabled = false; btn.textContent = 'Salvar tarefa'; return msgBox('#lx-t-msg', error.message); }
      closeModal(); toast('Tarefa salva.'); await refresh();
    });
    $('#lx-t-delete')?.addEventListener('click', async () => {
      if (!confirm('Excluir esta tarefa do checklist?')) return;
      const { error } = await db().from('process_tasks').delete().eq('id', t.id);
      if (error) return msgBox('#lx-t-msg', error.message);
      closeModal(); toast('Tarefa excluída.'); await refresh();
    });
    $('#lx-t-ignore')?.addEventListener('click', async () => {
      const { error } = await db().from('process_tasks').update({ status: 'desconsiderada' }).eq('id', t.id);
      if (error) return msgBox('#lx-t-msg', error.message);
      closeModal(); await refresh();
    });
  }

  function openBlockModal(t, refresh) {
    shell('Marcar tarefa como impedida', `<form id="lx-block-form" class="modal-form-grid">
      <div class="field span-2"><label>Tarefa</label><input disabled value="${h(t.title)}"></div>
      <div class="field span-2"><label>Justificativa do impedimento *</label><textarea id="lx-block-reason" rows="3" required minlength="3" placeholder="Ex.: aguardando assinatura do sócio; órgão sem sistema; falta comprovante de endereço">${h(t.blocked_reason || '')}</textarea></div>
      <div class="modal-actions span-2"><button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button class="btn btn-primary" type="submit">Marcar impedida</button></div>
      <div id="lx-block-msg" class="auth-message hidden span-2"></div>
    </form>`);
    $('#lx-block-form').addEventListener('submit', async e => {
      e.preventDefault();
      const reason = $('#lx-block-reason').value.trim();
      if (reason.length < 3) return msgBox('#lx-block-msg', 'Descreva o motivo do impedimento.');
      const { error } = await db().from('process_tasks').update({ status: 'impedida', blocked_reason: reason }).eq('id', t.id);
      if (error) return msgBox('#lx-block-msg', error.message);
      closeModal(); toast('Tarefa marcada como impedida.'); await refresh();
    });
  }

  const BUILTIN_TYPES = ['abertura', 'alteracao', 'baixa', 'renovacao', 'holding'];
  function guessTemplate(templates, p) {
    const text = norm([p?.service_type, p?.title].join(' '));
    // Modelos criados pelo escritório: palavras-chave (separadas por vírgula) no campo "tipo".
    const custom = templates.filter(t => t.service_type && !BUILTIN_TYPES.includes(t.service_type));
    for (const t of custom) {
      const keys = String(t.service_type).split(',').map(norm).filter(k => k.length >= 3);
      if (keys.some(k => text.includes(k))) return t;
    }
    const pick = key => templates.find(t => t.service_type === key);
    if (/holding|patrimon/.test(text)) return pick('holding') || templates[0];
    if (/baixa|encerr|extin|distrato/.test(text)) return pick('baixa') || templates[0];
    if (/renov|licen|alvar|avcb|sanit/.test(text)) return pick('renovacao') || templates[0];
    if (/altera|transform|endereco|cnae|socio|capital/.test(text)) return pick('alteracao') || templates[0];
    if (/abert|constitu|nova empresa/.test(text)) return pick('abertura') || templates[0];
    return templates[0];
  }

  function openTemplateModal(data, fixedProcessId = '', refresh = tasksPage) {
    const templates = data.templates || [];
    if (!templates.length) return toast('Nenhum modelo de checklist disponível. Aplique a migração V8 no banco.', 'bad');
    const procs = data.processes.filter(p => !['completed', 'cancelled'].includes(p.status));
    const initialProc = data.processMap.get(fixedProcessId) || procs[0];
    const initialTpl = guessTemplate(templates, initialProc);
    shell('Aplicar modelo de checklist', `<form id="lx-tpl-form" class="modal-form-grid">
      ${fixedProcessId ? `<input type="hidden" id="lx-tpl-process" value="${h(fixedProcessId)}"><div class="field span-2"><label>Processo</label><input disabled value="${h(procLabel(initialProc))}"></div>` :
        `<div class="field span-2"><label>Processo *</label><select id="lx-tpl-process" required>${procs.map(p => `<option value="${p.id}">${h(procLabel(p))} — ${h(clientName(data, p.client_id))}</option>`).join('')}</select></div>`}
      <div class="field span-2"><label>Modelo *</label><select id="lx-tpl-template">${templates.map(t => `<option value="${t.id}" ${initialTpl?.id === t.id ? 'selected' : ''}>${h(t.name)} (${(t.items || []).length} itens)</option>`).join('')}</select></div>
      <div class="field"><label>Início (base das datas meta)</label><input id="lx-tpl-start" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Responsável padrão</label><select id="lx-tpl-assignee"><option value="">Responsável do processo</option>${staff(data).map(p => `<option value="${p.id}">${h(p.full_name)}</option>`).join('')}</select></div>
      <div class="span-2" id="lx-tpl-preview"></div>
      <div class="modal-actions span-2"><button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button class="btn btn-primary" type="submit" id="lx-tpl-save">Gerar checklist</button></div>
      <div id="lx-tpl-msg" class="auth-message hidden span-2"></div>
    </form>`, true);
    const preview = () => {
      const tpl = templates.find(t => t.id === $('#lx-tpl-template').value);
      const start = $('#lx-tpl-start').value || todayISO();
      const pid = $('#lx-tpl-process').value;
      const existing = (data.tasks || []).filter(t => t.process_id === pid).length;
      $('#lx-tpl-preview').innerHTML = `${existing ? `<div class="lx-notice warn">Este processo já tem ${existing} tarefa(s). Os itens do modelo serão adicionados ao final.</div>` : ''}<ol class="lx-tpl-list">${(tpl?.items || []).map(i => `<li><strong>${h(i.title)}</strong><span>${h(i.phase || '')} · ${h(PARTY[i.party] || 'Escritório')} · meta ${br(addDays(start, i.offset || 0))}</span></li>`).join('')}</ol>${(tpl?.documents || []).length ? `<div class="lx-notice" style="margin-top:10px"><strong>Documentos a receber (${tpl.documents.length}):</strong> ${tpl.documents.map(d => h(d.name)).join(' · ')}</div>` : ''}`;
    };
    ['#lx-tpl-template', '#lx-tpl-start', '#lx-tpl-process'].forEach(s => $(s)?.addEventListener('change', () => {
      if (s === '#lx-tpl-process') { const g = guessTemplate(templates, data.processMap.get($('#lx-tpl-process').value)); if (g) $('#lx-tpl-template').value = g.id; }
      preview();
    }));
    preview();
    $('#lx-tpl-form').addEventListener('submit', async e => {
      e.preventDefault();
      const tpl = templates.find(t => t.id === $('#lx-tpl-template').value);
      const pid = $('#lx-tpl-process').value;
      const start = $('#lx-tpl-start').value || todayISO();
      const assignee = $('#lx-tpl-assignee').value || null;
      const proc = data.processMap.get(pid);
      if (!tpl || !proc) return msgBox('#lx-tpl-msg', 'Selecione processo e modelo.');
      const base = (data.tasks || []).filter(t => t.process_id === pid).length;
      const rows = (tpl.items || []).map((i, idx) => ({
        organization_id: profile().organization_id, process_id: pid, title: i.title, phase: i.phase || null,
        responsible_party: PARTY[i.party] ? i.party : 'escritorio', assignee_id: assignee,
        target_date: addDays(start, i.offset || 0),
        legal_date: idx === (tpl.items.length - 1) && proc.due_date ? proc.due_date : null,
        position: base + idx, created_by: profile().id, client_visible: true
      }));
      const btn = $('#lx-tpl-save'); btn.disabled = true; btn.textContent = 'Gerando...';
      const { error } = await db().from('process_tasks').insert(rows);
      if (error) { btn.disabled = false; btn.textContent = 'Gerar checklist'; return msgBox('#lx-tpl-msg', error.message); }
      const docCount = await createDocItems(data, pid, tpl.documents || []);
      closeModal(); toast(`${rows.length} tarefas${docCount ? ` e ${docCount} documentos a receber` : ''} criados.`); await refresh();
    });
  }

  function exportTasks(data, list) {
    const rows = [['Processo', 'Empresa', 'Tarefa', 'Fase', 'Quem executa', 'Responsável', 'Status', 'Data meta', 'Data legal', 'Situação do prazo', 'Impedimento', 'Concluída em']];
    list.forEach(t => { const p = data.processMap.get(t.process_id); const ds = DEADLINE_BADGE[taskDeadlineState(t)][0]; rows.push([p?.public_code, clientName(data, p?.client_id), t.title, t.phase, PARTY[t.responsible_party], personName(data, t.assignee_id), TASK_STATUS[t.status]?.[0], br(t.target_date), br(t.legal_date), ds, t.blocked_reason, brDateTime(t.completed_at)]); });
    downloadFile(`atlas-tarefas-${todayISO()}.csv`, csv(rows), 'text/csv;charset=utf-8');
  }

  /* ================================================================
     2. PAINEL DO PROCESSO (checklist, protocolos, exigências, comunicação, histórico)
     ================================================================ */
  async function openPanel(processId, tab = 'checklist') {
    shell('Painel do processo', '<div class="loading-box"><span class="spinner"></span><div>Carregando painel...</div></div>', true);
    const data = await loadCentral({ templates: true, documents: true });
    const p = data.processMap.get(processId);
    if (!p) { shell('Painel do processo', '<div class="error-box">Processo não encontrado ou sem permissão.</div>'); return; }
    const refresh = () => openPanel(processId, currentTab);
    let currentTab = tab;
    const c = data.clientMap.get(p.client_id) || {};
    const tasks = (data.tasks || []).filter(t => t.process_id === processId);
    const protos = (data.protocols || []).filter(x => x.process_id === processId).sort((a, b) => String(b.protocol_date || '').localeCompare(String(a.protocol_date || '')));
    const reqs = (data.requirements || []).filter(r => r.process_id === processId);
    const valid = tasks.filter(t => t.status !== 'desconsiderada');
    const pct = valid.length ? Math.round(valid.filter(t => t.status === 'concluida').length / valid.length * 100) : 0;

    const docItems = (data.docItems || []).filter(d => d.process_id === processId);
    const docsDone = docItems.filter(d => d.status !== 'pendente').length;
    const tabs = [['checklist', `Checklist (${tasks.length})`], ['documentos', `Documentos (${docsDone}/${docItems.length})`], ['protocolos', `Protocolos (${protos.length})`], ['exigencias', `Exigências (${reqs.filter(r => ['aberta', 'em_atendimento'].includes(r.status)).length})`]];
    if (canEdit()) tabs.push(['comunicar', 'Comunicar cliente']);
    if (['admin', 'auditoria', 'operacao'].includes(role())) tabs.push(['historico', 'Histórico']);

    shell(`${p.public_code || 'Processo'} · ${p.title || ''}`, `
      ${schemaNotice()}
      <div class="lx-panel-head">
        <div><span>Empresa</span><strong>${h(c.legal_name || '—')}</strong></div>
        <div><span>Etapa</span><strong>${h(data.stageMap.get(p.current_stage_id)?.name || '—')}</strong></div>
        <div><span>Responsável</span><strong>${h(personName(data, p.owner_id))}</strong></div>
        <div><span>Prazo</span><strong>${br(p.due_date)}</strong></div>
        <div class="lx-panel-progress"><span>Checklist</span><div class="lx-progress"><i style="width:${pct}%"></i></div><strong>${pct}%</strong></div>
      </div>
      <div class="lx-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-lx-tab="${k}" class="${k === currentTab ? 'active' : ''}">${h(l)}</button>`).join('')}</div>
      <div id="lx-panel-body"></div>`, true);

    const body = () => $('#lx-panel-body');
    const show = async k => {
      currentTab = k;
      $$('[data-lx-tab]').forEach(b => b.classList.toggle('active', b.dataset.lxTab === k));
      if (k === 'checklist') {
        body().innerHTML = `<div class="lx-panel-actions">${canEdit() && schemaReady ? `<button class="btn btn-muted" type="button" id="lx-p-tpl">Aplicar modelo</button><button class="btn btn-primary" type="button" id="lx-p-new">＋ Tarefa</button>` : ''}</div>
          ${tasks.length ? `<div class="lx-task-list">${tasks.map(t => taskRow(data, t)).join('')}</div>` : empty('Sem checklist', 'Aplique um modelo pronto para gerar as tarefas deste processo.')}`;
        $('#lx-p-new')?.addEventListener('click', () => openTaskModal(data, null, refresh, processId));
        $('#lx-p-tpl')?.addEventListener('click', () => openTemplateModal(data, processId, refresh));
        bindTaskRowActions(data, body(), refresh);
      } else if (k === 'documentos') {
        body().innerHTML = docItemsPanel(data, p, docItems);
        bindDocItems(data, p, docItems, refresh);
      } else if (k === 'protocolos') {
        body().innerHTML = `<div class="lx-panel-actions">${canEdit() && schemaReady ? '<button class="btn btn-primary" type="button" id="lx-p-proto">＋ Protocolo</button>' : ''}</div>${protocolTable(data, protos, false)}`;
        $('#lx-p-proto')?.addEventListener('click', () => openProtocolModal(data, null, refresh, processId));
        bindProtocolActions(data, body(), refresh);
      } else if (k === 'exigencias') {
        body().innerHTML = `<div class="lx-panel-actions">${canEdit() && schemaReady ? '<button class="btn btn-primary" type="button" id="lx-p-req">＋ Exigência</button>' : ''}</div>${requirementList(data, reqs)}`;
        $('#lx-p-req')?.addEventListener('click', () => openRequirementModal(data, null, refresh, { process_id: processId, client_id: p.client_id }));
        bindRequirementActions(data, body(), refresh);
      } else if (k === 'comunicar') {
        body().innerHTML = communicationForm(data, p, 'etapa');
        bindCommunicationForm(data, p);
      } else if (k === 'historico') {
        body().innerHTML = '<div class="loading-box"><span class="spinner"></span><div>Carregando histórico...</div></div>';
        const [logs, comms] = await Promise.all([
          q('audit_logs', t => t.select('id,action,entity_type,payload,created_at,actor_id').filter('payload->>process_id', 'eq', processId).order('created_at', { ascending: false }).limit(80)),
          q('communications', t => t.select('*').eq('process_id', processId).order('sent_at', { ascending: false }).limit(40))
        ]);
        const ENT = { processes: 'Processo', process_tasks: 'Tarefa', protocols: 'Protocolo', process_requirements: 'Exigência', costs: 'Custo', documents: 'Documento', licenses: 'Licença' };
        const ACT = { created: 'criou', updated: 'alterou', deleted: 'excluiu' };
        const items = [
          ...logs.data.map(l => ({ at: l.created_at, text: `${personName(data, l.actor_id)} ${ACT[l.action] || l.action} ${ENT[l.entity_type] || l.entity_type}: ${l.payload?.label || ''}`, kind: 'log' })),
          ...comms.data.map(m => ({ at: m.sent_at, text: `Comunicação por ${m.channel === 'whatsapp' ? 'WhatsApp' : 'e-mail'} para ${m.recipient || 'cliente'} — ${m.subject || ''}`, kind: 'comm' }))
        ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
        body().innerHTML = items.length ? `<ol class="lx-timeline">${items.map(i => `<li class="${i.kind}"><time>${brDateTime(i.at)}</time><span>${h(i.text)}</span></li>`).join('')}</ol>` : empty('Sem histórico', 'Nenhuma movimentação registrada para este processo.');
      }
    };
    $$('[data-lx-tab]').forEach(b => b.addEventListener('click', () => show(b.dataset.lxTab)));
    show(currentTab);
  }

  /* ================================================================
     2b. DOCUMENTOS POR SERVIÇO + ENTRADA RÁPIDA (arquivos vindos do WhatsApp)
     ================================================================ */
  const DOC_CATEGORIES = ['Documento pessoal', 'Comprovante', 'Societário', 'Contrato', 'Fiscal', 'Licença', 'Protocolo', 'Outros'];
  const STOP = new Set(['dos', 'das', 'de', 'do', 'da', 'e', 'ou', 'que', 'para', 'com', 'socios', 'socio', 'empresa', 'novo', 'nova', 'atual', 'atualizadas', 'entram', 'saem', 'herdeiros', 'imovel', 'imoveis']);
  const SYN = [
    ['rg', 'identidade', 'cnh', 'habilitacao', 'carteira'], ['cpf'], ['residencia', 'endereco', 'luz', 'agua', 'energia', 'conta', 'sabesp', 'cpfl', 'enel'],
    ['casamento', 'pacto', 'antenupcial', 'nascimento'], ['iptu', 'carne', 'venal', 'habite'], ['locacao', 'aluguel', 'escritura', 'contrato'],
    ['matricula', 'matriculas', 'cartorio'], ['declaracao', 'irpf', 'imposto', 'recibo'], ['social', 'alteracao', 'consolidad', 'ato', 'distrato'],
    ['avcb', 'bombeiro', 'bombeiros'], ['alvara', 'licenca', 'sanitaria'], ['certidao', 'certidoes', 'cnd', 'negativa'], ['balanco', 'encerramento'],
    ['veiculo', 'veiculos', 'crlv', 'renavam'], ['taxa', 'guia', 'boleto', 'pagamento', 'dare', 'darf'], ['atividade', 'atividades', 'cnae']
  ];
  const tokensOf = v => norm(v).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length >= 2);
  function groupsFor(name) {
    const toks = tokensOf(name).filter(t => !STOP.has(t));
    const groups = [];
    toks.forEach(t => { const g = SYN.find(gr => gr.some(w => t.startsWith(w) || w.startsWith(t) && t.length >= 4)); groups.push(g || [t]); });
    return groups;
  }
  function matchDocItem(fileName, items) {
    const f = ' ' + tokensOf(fileName.replace(/\.[a-z0-9]+$/i, '')).join(' ') + ' ';
    let best = null, bestScore = 0;
    items.forEach(it => {
      const score = groupsFor(it.name).reduce((s, g) => s + (g.some(w => f.includes(' ' + w) ) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = it; }
    });
    return bestScore > 0 ? best : null;
  }

  async function createDocItems(data, processId, docs) {
    if (!docs?.length) return 0;
    const existing = new Set((data.docItems || []).filter(d => d.process_id === processId).map(d => norm(d.name)));
    const base = (data.docItems || []).filter(d => d.process_id === processId).length;
    const rows = docs.filter(d => !existing.has(norm(d.name))).map((d, i) => ({ organization_id: profile().organization_id, process_id: processId, name: d.name, category: d.category || 'Documento pessoal', required: d.required !== false, position: base + i, created_by: profile().id }));
    if (!rows.length) return 0;
    const { error } = await db().from('process_doc_items').insert(rows);
    if (error) { toast('Documentos não criados: ' + error.message, 'bad'); return 0; }
    return rows.length;
  }

  function docItemsPanel(data, p, items) {
    const pending = items.filter(d => d.status === 'pendente');
    const docMap = new Map((data.documents || []).map(d => [d.id, d]));
    const loose = (data.documents || []).filter(d => d.process_id === p.id && !items.some(i => i.document_id === d.id));
    const tpl = guessTemplate(data.templates || [], p);
    return `<div class="lx-panel-actions">
        ${canEdit() ? `<button class="btn btn-primary" type="button" id="lx-d-upload">⇪ Receber arquivos</button>` : ''}
        ${canEdit() && pending.some(d => d.required) ? `<button class="btn btn-muted" type="button" id="lx-d-charge">Cobrar pendentes no WhatsApp</button>` : ''}
        ${canEdit() ? `<button class="btn btn-muted" type="button" id="lx-d-add">＋ Item</button>` : ''}
      </div>
      ${items.length ? `<div class="lx-progress-wrap" style="margin-bottom:10px"><div class="lx-progress"><i style="width:${Math.round((items.length - pending.length) / items.length * 100)}%"></i></div><small>${items.length - pending.length} de ${items.length} recebidos</small></div>
      <div class="lx-doc-list">${items.map(d => { const doc = docMap.get(d.document_id); return `<article class="lx-doc ${d.status}">
        ${canEdit() ? `<button class="lx-check ${d.status !== 'pendente' ? 'on' : ''}" type="button" data-lx-doc-act="${d.status === 'pendente' ? 'receive' : 'pending'}" data-id="${h(d.id)}" title="${d.status === 'pendente' ? 'Marcar recebido' : 'Voltar para pendente'}">${d.status === 'recebido' ? '✓' : d.status === 'dispensado' ? '–' : ''}</button>` : `<span class="lx-check ${d.status !== 'pendente' ? 'on' : ''}">${d.status === 'recebido' ? '✓' : ''}</span>`}
        <div class="lx-task-main"><strong>${h(d.name)}</strong><div class="lx-task-meta"><span>${h(d.category)}</span>${d.status === 'recebido' ? `<span>Recebido${d.received_at ? ' ' + brDateTime(d.received_at).split(',')[0] : ''}</span>` : ''}${d.status === 'dispensado' ? '<span>Dispensado</span>' : ''}${!d.required ? '<span>Opcional</span>' : ''}${doc ? `<span>Arquivo: ${h(doc.name)}</span>` : ''}</div></div>
        <div class="lx-row-actions">${doc ? `<button class="mini-btn" type="button" data-lx-doc-open="${h(doc.id)}">Abrir</button>` : ''}${canEdit() && d.status === 'pendente' ? `<button class="mini-btn" type="button" data-lx-doc-act="waive" data-id="${h(d.id)}">Dispensar</button>` : ''}${canEdit() ? `<button class="mini-btn" type="button" data-lx-doc-act="delete" data-id="${h(d.id)}" aria-label="Remover item">×</button>` : ''}</div>
      </article>`; }).join('')}</div>` :
      empty('Sem lista de documentos', 'Gere a lista de documentos do serviço para saber o que pedir ao cliente.', canEdit() && tpl?.documents?.length ? `<button class="btn btn-primary" type="button" id="lx-d-gen">Gerar lista: ${h(tpl.name)}</button>` : '')}
      ${loose.length ? `<div class="lx-section-head" style="margin-top:16px"><h2>Outros arquivos do processo</h2><span>${loose.length}</span></div><div class="lx-mini-list">${loose.map(d => `<div><strong>${h(d.name)}</strong><span>${h(d.category || '')} · ${brDateTime(d.created_at).split(',')[0]}</span><button class="mini-btn" type="button" data-lx-doc-open="${h(d.id)}">Abrir</button></div>`).join('')}</div>` : ''}`;
  }

  function bindDocItems(data, p, items, refresh) {
    const root = $('#lx-panel-body');
    $('#lx-d-gen')?.addEventListener('click', async () => { const tpl = guessTemplate(data.templates || [], p); const n = await createDocItems(data, p.id, tpl?.documents || []); if (n) toast(`${n} documentos adicionados.`); refresh(); });
    $('#lx-d-upload')?.addEventListener('click', () => openQuickUpload(data, p, items, refresh));
    $('#lx-d-charge')?.addEventListener('click', () => { const miss = items.filter(d => d.status === 'pendente' && d.required).map(d => d.name); openCommunicationModal(p.id, 'documentos', { pendencias: miss.join('; ') }); });
    $('#lx-d-add')?.addEventListener('click', async () => {
      const name = prompt('Nome do documento a receber:'); if (!name || name.trim().length < 2) return;
      await createDocItems(data, p.id, [{ name: name.trim(), category: 'Outros' }]); refresh();
    });
    root?.querySelectorAll('[data-lx-doc-open]').forEach(b => b.addEventListener('click', () => (window.openStoredDocument ? window.openStoredDocument(b.dataset.lxDocOpen) : null)));
    root?.querySelectorAll('[data-lx-doc-act]').forEach(b => b.addEventListener('click', async () => {
      const act = b.dataset.lxDocAct, id = b.dataset.id;
      let error;
      if (act === 'delete') { if (!confirm('Remover este item da lista? O arquivo, se houver, continua no dossiê.')) return; ({ error } = await db().from('process_doc_items').delete().eq('id', id)); }
      else ({ error } = await db().from('process_doc_items').update({ status: act === 'receive' ? 'recebido' : act === 'waive' ? 'dispensado' : 'pendente' }).eq('id', id));
      if (error) return toast(error.message, 'bad');
      if (act !== 'pending' && act !== 'delete') await maybeCompleteClientTasks(data, p, items.map(i => i.id === id ? { ...i, status: act === 'waive' ? 'dispensado' : 'recebido' } : i));
      refresh();
    }));
  }

  async function maybeCompleteClientTasks(data, p, items) {
    if (!items.length || items.some(d => d.required && d.status === 'pendente')) return;
    const open = (data.tasks || []).filter(t => t.process_id === p.id && t.status === 'aberta' && t.responsible_party === 'cliente' && /receb|document|matric|envi/.test(norm(t.title)));
    if (!open.length) return;
    const { error } = await db().from('process_tasks').update({ status: 'concluida' }).in('id', open.map(t => t.id));
    if (!error) toast(`Todos os documentos recebidos. ${open.length} tarefa(s) do cliente concluída(s).`);
  }

  const rid = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  function safeName(name) { return String(name || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-120); }

  function openQuickUpload(data, p, items, refresh) {
    const pendingFirst = [...items].sort((a, b) => (a.status === 'pendente' ? 0 : 1) - (b.status === 'pendente' ? 0 : 1));
    shell('Receber arquivos do cliente', `<div class="modal-form-grid">
      <div class="span-2 lx-notice">Salve os arquivos que o cliente mandou no WhatsApp e selecione todos de uma vez. O ATLAS guarda no dossiê do processo <strong>${h(p.public_code || '')}</strong>, sugere a qual documento cada um corresponde e marca como recebido.</div>
      <label class="span-2 lx-drop" id="lx-drop"><input id="lx-q-files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt"><strong>Toque para escolher ou arraste os arquivos aqui</strong><small>PDF, fotos e documentos · até 50 MB cada</small></label>
      <div class="span-2" id="lx-q-list"></div>
      <div class="modal-actions span-2"><button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button class="btn btn-primary" type="button" id="lx-q-save" disabled>Salvar arquivos</button></div>
      <div id="lx-q-msg" class="auth-message hidden span-2"></div>
    </div>`, true);
    let files = [];
    const urls = [];
    const render = () => {
      const used = new Set();
      $('#lx-q-list').innerHTML = files.length ? `<div class="lx-q-files">${files.map((f, i) => {
        if (f.item === undefined) { const m = matchDocItem(f.file.name, pendingFirst.filter(x => !used.has(x.id))); f.item = m?.id || ''; }
        if (f.item) used.add(f.item);
        const it = items.find(x => x.id === f.item);
        if (!f.url && /^image\//.test(f.file.type)) { f.url = URL.createObjectURL(f.file); urls.push(f.url); }
        return `<div class="lx-q-file">
          ${f.url ? `<img src="${f.url}" alt="">` : `<span class="lx-q-ico">${h((f.file.name.split('.').pop() || 'doc').slice(0, 4).toUpperCase())}</span>`}
          <div class="lx-q-meta"><strong>${h(f.file.name)}</strong><small>${f.file.size < 1048576 ? Math.max(1, Math.round(f.file.size / 1024)) + ' KB' : (f.file.size / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB'}${f.file.size > 52428800 ? ' · <b class="lx-danger-text">acima de 50 MB</b>' : ''}</small>
            <select data-q="${i}"><option value="">Sem vínculo (só guardar no dossiê)</option>${pendingFirst.map(x => `<option value="${x.id}" ${f.item === x.id ? 'selected' : ''}>${x.status === 'pendente' ? '' : '✓ '}${h(x.name)}</option>`).join('')}</select>
            ${!it ? `<select data-q-cat="${i}">${DOC_CATEGORIES.map(c => `<option ${f.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>` : ''}
          </div>
          <button type="button" class="mini-btn" data-q-rm="${i}" aria-label="Remover">×</button>
        </div>`; }).join('')}</div>` : '';
      $$('[data-q]').forEach(s => s.addEventListener('change', e => { files[+e.target.dataset.q].item = e.target.value; render(); }));
      $$('[data-q-cat]').forEach(s => s.addEventListener('change', e => { files[+e.target.dataset.qCat].cat = e.target.value; }));
      $$('[data-q-rm]').forEach(b => b.addEventListener('click', () => { files.splice(+b.dataset.qRm, 1); render(); }));
      $('#lx-q-save').disabled = !files.length;
    };
    const add = list => { [...list].forEach(file => files.push({ file, cat: 'Documento pessoal' })); render(); };
    $('#lx-q-files').addEventListener('change', e => add(e.target.files));
    const drop = $('#lx-drop');
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => add(e.dataTransfer.files));
    $('#lx-q-save').addEventListener('click', async () => {
      const big = files.filter(f => f.file.size > 52428800);
      if (big.length) return msgBox('#lx-q-msg', 'Remova os arquivos acima de 50 MB.');
      const btn = $('#lx-q-save'); btn.disabled = true;
      const org = profile().organization_id;
      let ok = 0; const fail = []; const received = new Set();
      for (const [idx, f] of files.entries()) {
        btn.textContent = `Enviando ${idx + 1}/${files.length}...`;
        const it = items.find(x => x.id === f.item);
        const key = `${org}/${p.client_id || 'sem-empresa'}/${p.id}/${rid()}-${safeName(f.file.name)}`;
        const up = await db().storage.from('legalizacao-documents').upload(key, f.file, { upsert: false, contentType: f.file.type || undefined });
        if (up.error) { fail.push(f.file.name + ': ' + up.error.message); continue; }
        const label = it ? `${it.name} — ${f.file.name}` : f.file.name;
        const ins = await db().from('documents').insert({ organization_id: org, client_id: p.client_id || null, process_id: p.id, name: label.slice(0, 200), category: it?.category || f.cat || 'Outros', storage_key: key, mime_type: f.file.type || null, size_bytes: f.file.size, uploaded_by: profile().id }).select('id').single();
        if (ins.error) { await db().storage.from('legalizacao-documents').remove([key]); fail.push(f.file.name + ': ' + ins.error.message); continue; }
        ok++;
        if (it) {
          const patch = { status: 'recebido' }; if (!it.document_id) patch.document_id = ins.data?.id || null;
          const upd = await db().from('process_doc_items').update(patch).eq('id', it.id);
          if (!upd.error) received.add(it.id);
        }
      }
      urls.forEach(u => URL.revokeObjectURL(u));
      if (fail.length) { btn.disabled = false; btn.textContent = 'Salvar arquivos'; files = files.filter(f => fail.some(x => x.startsWith(f.file.name))); render(); return msgBox('#lx-q-msg', `${ok} salvo(s). Falharam: ${fail.join(' | ')}`); }
      await maybeCompleteClientTasks(data, p, items.map(i => received.has(i.id) ? { ...i, status: 'recebido' } : i));
      closeModal();
      const left = items.filter(i => i.required && i.status === 'pendente' && !received.has(i.id)).length;
      toast(`${ok} arquivo(s) salvo(s) no dossiê.${left ? ` Ainda faltam ${left} documento(s).` : ' Lista completa!'}`);
      openPanel(p.id, 'documentos');
    });
  }

  /* ================================================================
     3. PROTOCOLOS
     ================================================================ */
  const protoFilters = { status: 'open', agency: '', text: '' };
  const protoOpen = p => !/(deferido|indeferido|arquivado|cancelado|conclu)/i.test(String(p.status || ''));

  async function protocolsPage() {
    setHeadSafe('Protocolos', 'OPERAÇÃO', 'Números de protocolo por órgão, situação, próxima verificação e link oficial de acompanhamento.');
    loading('Carregando protocolos...');
    const data = await loadCentral();
    renderProtocols(data);
  }

  function renderProtocols(data) {
    const all = (data.protocols || []).filter(p => data.processMap.has(p.process_id));
    const open = all.filter(protoOpen);
    const toCheck = open.filter(p => p.next_action_at && diffDays(String(p.next_action_at).slice(0, 10)) <= 0);
    const inReq = open.filter(p => /exig/i.test(p.status || ''));
    const agencies = [...new Set(all.map(p => p.agency).filter(Boolean))].sort();
    const list = all.filter(p => {
      if (protoFilters.status === 'open' && !protoOpen(p)) return false;
      if (protoFilters.status === 'check' && !(protoOpen(p) && p.next_action_at && diffDays(String(p.next_action_at).slice(0, 10)) <= 0)) return false;
      if (protoFilters.status === 'closed' && protoOpen(p)) return false;
      if (protoFilters.agency && p.agency !== protoFilters.agency) return false;
      if (protoFilters.text) { const pr = data.processMap.get(p.process_id); if (!norm([p.protocol_number, p.agency, p.protocol_type, pr?.public_code, clientName(data, pr?.client_id)].join(' ')).includes(norm(protoFilters.text))) return false; }
      return true;
    }).sort((a, b) => String(a.next_action_at || '9999').localeCompare(String(b.next_action_at || '9999')));

    pageSafe(`${schemaNotice()}
      <div class="lx-kpis">
        ${kpi('Protocolos em aberto', open.length, 'Aguardando órgão')}
        ${kpi('Verificar hoje', toCheck.length, 'Próxima verificação vencida', toCheck.length ? 'warn' : '')}
        ${kpi('Em exigência', inReq.length, 'Exigem resposta', inReq.length ? 'bad' : '')}
        ${kpi('Total registrado', all.length, 'Histórico de protocolos')}
      </div>
      <section class="lx-card">
        <div class="lx-toolbar">
          <input id="lx-proto-search" type="search" placeholder="Buscar número, órgão, processo ou empresa" value="${h(protoFilters.text)}">
          <select id="lx-proto-status"><option value="open" ${protoFilters.status === 'open' ? 'selected' : ''}>Em aberto</option><option value="check" ${protoFilters.status === 'check' ? 'selected' : ''}>Verificar hoje</option><option value="closed" ${protoFilters.status === 'closed' ? 'selected' : ''}>Encerrados</option><option value="" ${!protoFilters.status ? 'selected' : ''}>Todos</option></select>
          <select id="lx-proto-agency"><option value="">Todos os órgãos</option>${agencies.map(a => `<option ${protoFilters.agency === a ? 'selected' : ''}>${h(a)}</option>`).join('')}</select>
          <div class="lx-toolbar-actions">${canEdit() && schemaReady ? '<button class="btn btn-primary" type="button" id="lx-new-proto">＋ Novo protocolo</button>' : ''}</div>
        </div>
        ${protocolTable(data, list, true)}
      </section>
      <section class="lx-card">
        <div class="lx-section-head"><h2>Portais oficiais de acompanhamento</h2><span>Acesso gratuito, direto no órgão</span></div>
        <div class="lx-links">
          <a href="https://www.jucesp.sp.gov.br/" target="_blank" rel="noopener">JUCESP</a>
          <a href="https://www.gov.br/empresas-e-negocios/pt-br/redesim" target="_blank" rel="noopener">Redesim</a>
          <a href="https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" target="_blank" rel="noopener">Comprovante de CNPJ</a>
          <a href="https://www.santos.sp.gov.br/" target="_blank" rel="noopener">Prefeitura de Santos</a>
          <a href="https://www.corpodebombeiros.sp.gov.br/" target="_blank" rel="noopener">Corpo de Bombeiros SP</a>
          <a href="https://cetesb.sp.gov.br/" target="_blank" rel="noopener">CETESB</a>
        </div>
      </section>`);
    $('#lx-proto-search')?.addEventListener('input', e => { protoFilters.text = e.target.value; clearTimeout(renderProtocols._t); renderProtocols._t = setTimeout(() => { renderProtocols(data); const i = $('#lx-proto-search'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }, 250); });
    $('#lx-proto-status')?.addEventListener('change', e => { protoFilters.status = e.target.value; renderProtocols(data); });
    $('#lx-proto-agency')?.addEventListener('change', e => { protoFilters.agency = e.target.value; renderProtocols(data); });
    $('#lx-new-proto')?.addEventListener('click', () => openProtocolModal(data, null, protocolsPage));
    bindProtocolActions(data, $('#page-content'), protocolsPage);
  }

  function protocolTable(data, list, withProcess) {
    if (!list.length) return empty('Nenhum protocolo', 'Registre o número de protocolo de cada pedido feito nos órgãos para acompanhar a análise.');
    return `<div class="lx-table-wrap"><table class="lx-table"><thead><tr>${withProcess ? '<th>Processo</th>' : ''}<th>Órgão / tipo</th><th>Número</th><th>Protocolado</th><th>Situação</th><th>Próxima verificação</th><th></th></tr></thead><tbody>${list.map(p => {
      const pr = data.processMap.get(p.process_id);
      const next = p.next_action_at ? String(p.next_action_at).slice(0, 10) : null;
      const nd = diffDays(next);
      const cls = /deferido/i.test(p.status) && !/indef/i.test(p.status) ? 'ok' : /exig|indef/i.test(p.status) ? 'bad' : /arquiv|cancel/i.test(p.status) ? 'neutral' : 'warn';
      return `<tr>
        ${withProcess ? `<td data-label="Processo"><strong>${h(pr?.public_code || '—')}</strong><div class="muted">${h(clientName(data, pr?.client_id))}</div></td>` : ''}
        <td data-label="Órgão"><strong>${h(p.agency || '—')}</strong><div class="muted">${h(p.protocol_type || '')}</div></td>
        <td data-label="Número"><strong class="lx-mono">${h(p.protocol_number || '—')}</strong>${p.notes ? `<div class="muted">${h(p.notes)}</div>` : ''}</td>
        <td data-label="Protocolado">${br(p.protocol_date)}</td>
        <td data-label="Situação">${badge(p.status || 'Em análise', cls)}${p.last_checked_at ? `<div class="muted">Verificado ${brDateTime(p.last_checked_at)}</div>` : ''}</td>
        <td data-label="Próxima">${next ? `${br(next)}${protoOpen(p) && nd <= 0 ? ' ' + badge('Verificar', 'warn') : ''}` : '—'}</td>
        <td><div class="lx-row-actions">
          ${p.official_url ? `<a class="mini-btn" href="${h(p.official_url)}" target="_blank" rel="noopener">Consultar</a>` : ''}
          ${canEdit() && schemaReady ? `<button class="mini-btn" type="button" data-lx-proto-act="check" data-id="${h(p.id)}">Verificado</button><button class="mini-btn" type="button" data-lx-proto-act="edit" data-id="${h(p.id)}">Editar</button>` : ''}
        </div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function bindProtocolActions(data, root, refresh) {
    root?.querySelectorAll('[data-lx-proto-act]').forEach(b => b.addEventListener('click', async () => {
      const p = (data.protocols || []).find(x => x.id === b.dataset.id); if (!p) return;
      if (b.dataset.lxProtoAct === 'edit') return openProtocolModal(data, p, refresh);
      const nextDays = prompt('Protocolo verificado. Em quantos dias verificar novamente? (deixe vazio para não agendar)', '3');
      if (nextDays === null) return;
      const patch = { last_checked_at: new Date().toISOString() };
      if (String(nextDays).trim()) patch.next_action_at = addDays(todayISO(), Number(nextDays) || 0) + 'T12:00:00-03:00';
      const { error } = await db().from('protocols').update(patch).eq('id', p.id);
      if (error) return toast(error.message, 'bad');
      toast('Verificação registrada.'); await refresh();
    }));
  }

  function openProtocolModal(data, p = null, refresh = protocolsPage, fixedProcessId = '') {
    const procs = data.processes.filter(x => x.status !== 'cancelled');
    const pid = p?.process_id || fixedProcessId;
    shell(p ? 'Editar protocolo' : 'Novo protocolo', `<form id="lx-proto-form" class="modal-form-grid">
      ${fixedProcessId || p ? `<input type="hidden" id="lx-pr-process" value="${h(pid)}"><div class="field span-2"><label>Processo</label><input disabled value="${h(procLabel(data.processMap.get(pid)))}"></div>` :
        `<div class="field span-2"><label>Processo *</label><select id="lx-pr-process" required><option value="">Selecione</option>${procs.map(x => `<option value="${x.id}">${h(procLabel(x))} — ${h(clientName(data, x.client_id))}</option>`).join('')}</select></div>`}
      <div class="field"><label>Órgão *</label><input id="lx-pr-agency" required list="lx-agency-list" value="${h(p?.agency || '')}"><datalist id="lx-agency-list">${AGENCIES.map(a => `<option value="${h(a)}">`).join('')}</datalist></div>
      <div class="field"><label>Tipo</label><input id="lx-pr-type" list="lx-ptype-list" value="${h(p?.protocol_type || '')}"><datalist id="lx-ptype-list">${PROTO_TYPES.map(a => `<option value="${h(a)}">`).join('')}</datalist></div>
      <div class="field"><label>Número do protocolo *</label><input id="lx-pr-number" required value="${h(p?.protocol_number || '')}"></div>
      <div class="field"><label>Data do protocolo</label><input id="lx-pr-date" type="date" value="${h(p?.protocol_date ? String(p.protocol_date).slice(0, 10) : todayISO())}"></div>
      <div class="field"><label>Situação</label><select id="lx-pr-status">${PROTO_STATUS.map(s => `<option ${(p?.status || 'Em análise') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Próxima verificação</label><input id="lx-pr-next" type="date" value="${h(p?.next_action_at ? String(p.next_action_at).slice(0, 10) : addDays(todayISO(), 3))}"></div>
      <div class="field span-2"><label>Link oficial de consulta</label><input id="lx-pr-url" type="url" placeholder="https://" value="${h(p?.official_url || '')}"></div>
      <div class="field span-2"><label>Observações</label><textarea id="lx-pr-notes" rows="2">${h(p?.notes || '')}</textarea></div>
      <div class="modal-actions span-2">${p ? '<button type="button" class="btn btn-muted lx-danger-text" id="lx-pr-delete">Excluir</button>' : ''}<button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button class="btn btn-primary" type="submit" id="lx-pr-save">Salvar protocolo</button></div>
      <div id="lx-pr-msg" class="auth-message hidden span-2"></div>
    </form>`, true);
    $('#lx-proto-form').addEventListener('submit', async e => {
      e.preventDefault();
      const url = $('#lx-pr-url').value.trim();
      if (url && !/^https?:\/\//i.test(url)) return msgBox('#lx-pr-msg', 'O link deve começar com http:// ou https://');
      const payload = {
        process_id: $('#lx-pr-process').value, agency: $('#lx-pr-agency').value.trim(), protocol_type: $('#lx-pr-type').value.trim() || null,
        protocol_number: $('#lx-pr-number').value.trim(), protocol_date: $('#lx-pr-date').value || null, status: $('#lx-pr-status').value,
        next_action_at: $('#lx-pr-next').value ? $('#lx-pr-next').value + 'T12:00:00-03:00' : null, official_url: url || null, notes: $('#lx-pr-notes').value.trim() || null
      };
      if (!payload.process_id) return msgBox('#lx-pr-msg', 'Selecione o processo.');
      const btn = $('#lx-pr-save'); btn.disabled = true; btn.textContent = 'Salvando...';
      const { error } = p ? await db().from('protocols').update(payload).eq('id', p.id) : await db().from('protocols').insert(payload);
      if (error) { btn.disabled = false; btn.textContent = 'Salvar protocolo'; return msgBox('#lx-pr-msg', error.message); }
      closeModal(); toast('Protocolo salvo.');
      if (!p && confirm('Protocolo registrado. Deseja avisar o cliente agora?')) return openCommunicationModal(payload.process_id, 'protocolo', { protocolo: `${payload.agency} nº ${payload.protocol_number}` });
      await refresh();
    });
    $('#lx-pr-delete')?.addEventListener('click', async () => {
      if (!confirm('Excluir este protocolo?')) return;
      const { error } = await db().from('protocols').delete().eq('id', p.id);
      if (error) return msgBox('#lx-pr-msg', error.message);
      closeModal(); await refresh();
    });
  }

  /* ================================================================
     4. EXIGÊNCIAS E CONDICIONANTES
     ================================================================ */
  const reqFilters = { status: 'open', text: '' };

  async function requirementsPage() {
    setHeadSafe('Exigências', 'OPERAÇÃO', 'Exigências dos órgãos e condicionantes de licenças, com prazo, responsável e resolução.');
    loading('Carregando exigências...');
    const data = await loadCentral();
    renderRequirements(data);
  }

  function renderRequirements(data) {
    const all = data.requirements || [];
    const open = all.filter(r => ['aberta', 'em_atendimento'].includes(r.status));
    const late = open.filter(r => r.due_date && diffDays(r.due_date) < 0);
    const soon = open.filter(r => r.due_date && diffDays(r.due_date) >= 0 && diffDays(r.due_date) <= 5);
    const cond = open.filter(r => r.kind === 'condicionante');
    const list = all.filter(r => {
      if (reqFilters.status === 'open' && !['aberta', 'em_atendimento'].includes(r.status)) return false;
      if (reqFilters.status === 'done' && ['aberta', 'em_atendimento'].includes(r.status)) return false;
      if (reqFilters.text && !norm([r.description, r.agency, clientName(data, r.client_id), data.processMap.get(r.process_id)?.public_code].join(' ')).includes(norm(reqFilters.text))) return false;
      return true;
    });
    // Pendências identificadas nos processos (comportamento anterior), mantidas como referência.
    const legacy = data.processes.filter(p => p.status === 'pending' && !open.some(r => r.process_id === p.id));
    pageSafe(`${schemaNotice()}
      <div class="lx-kpis">
        ${kpi('Em aberto', open.length, 'Exigências e condicionantes')}
        ${kpi('Vencidas', late.length, 'Prazo do órgão expirado', late.length ? 'bad' : '')}
        ${kpi('Vencem em 5 dias', soon.length, 'Priorizar resposta', soon.length ? 'warn' : '')}
        ${kpi('Condicionantes', cond.length, 'Obrigações de licenças')}
      </div>
      <section class="lx-card">
        <div class="lx-toolbar">
          <input id="lx-req-search" type="search" placeholder="Buscar exigência, órgão ou empresa" value="${h(reqFilters.text)}">
          <select id="lx-req-status"><option value="open" ${reqFilters.status === 'open' ? 'selected' : ''}>Em aberto</option><option value="done" ${reqFilters.status === 'done' ? 'selected' : ''}>Resolvidas</option><option value="" ${!reqFilters.status ? 'selected' : ''}>Todas</option></select>
          <div class="lx-toolbar-actions">${canEdit() && schemaReady ? '<button class="btn btn-primary" type="button" id="lx-new-req">＋ Nova exigência</button>' : ''}</div>
        </div>
        ${requirementList(data, list)}
      </section>
      ${legacy.length ? `<section class="lx-card"><div class="lx-section-head"><h2>Processos com status "Pendência"</h2><span>Sem exigência formal registrada</span></div>
        <div class="lx-mini-list">${legacy.map(p => `<div><strong>${h(p.public_code || '—')}</strong><span>${h(p.title || '')} · ${h(clientName(data, p.client_id))}</span>${canEdit() && schemaReady ? `<button class="mini-btn" type="button" data-lx-req-from="${h(p.id)}">Registrar exigência</button>` : ''}</div>`).join('')}</div></section>` : ''}`);
    $('#lx-req-search')?.addEventListener('input', e => { reqFilters.text = e.target.value; clearTimeout(renderRequirements._t); renderRequirements._t = setTimeout(() => { renderRequirements(data); const i = $('#lx-req-search'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }, 250); });
    $('#lx-req-status')?.addEventListener('change', e => { reqFilters.status = e.target.value; renderRequirements(data); });
    $('#lx-new-req')?.addEventListener('click', () => openRequirementModal(data, null, requirementsPage));
    $$('[data-lx-req-from]').forEach(b => b.addEventListener('click', () => { const p = data.processMap.get(b.dataset.lxReqFrom); openRequirementModal(data, null, requirementsPage, { process_id: p.id, client_id: p.client_id }); }));
    bindRequirementActions(data, $('#page-content'), requirementsPage);
  }

  function requirementList(data, list) {
    if (!list.length) return empty('Nenhuma exigência', 'Registre aqui as exigências feitas pelos órgãos e as condicionantes das licenças.');
    return `<div class="lx-req-list">${list.map(r => {
      const st = REQ_STATUS[r.status] || [r.status, 'neutral'];
      const d = diffDays(r.due_date);
      const open = ['aberta', 'em_atendimento'].includes(r.status);
      const dl = !open || d === null ? '' : d < 0 ? badge(`Vencida há ${Math.abs(d)}d`, 'bad') : d === 0 ? badge('Vence hoje', 'bad') : d <= 5 ? badge(`${d} dia(s)`, 'warn') : badge(`${d} dias`, 'ok');
      const pr = data.processMap.get(r.process_id);
      return `<article class="lx-req ${r.status}">
        <div class="lx-req-main">
          <div class="lx-req-top">${badge(r.kind === 'condicionante' ? 'Condicionante' : 'Exigência', 'info')}${badge(st[0], st[1])}${dl}</div>
          <strong>${h(r.description)}</strong>
          <div class="lx-task-meta"><span>${h(r.agency || 'Órgão não informado')}</span><span>${h(clientName(data, r.client_id))}</span>${pr ? `<span>${h(pr.public_code || '')}</span>` : ''}<span>Recebida ${br(r.received_at)}</span><span>Prazo ${br(r.due_date)}</span><span>${h(personName(data, r.assignee_id))}</span></div>
          ${r.resolution ? `<div class="lx-task-desc">Resolução: ${h(r.resolution)}</div>` : ''}
        </div>
        ${canEdit() && schemaReady ? `<div class="lx-row-actions">${open ? `<button class="mini-btn" type="button" data-lx-req-act="resolve" data-id="${h(r.id)}">Cumprida</button>` : ''}<button class="mini-btn" type="button" data-lx-req-act="edit" data-id="${h(r.id)}">Editar</button>${open && r.process_id ? `<button class="mini-btn" type="button" data-lx-req-act="notify" data-id="${h(r.id)}">Avisar cliente</button>` : ''}</div>` : ''}
      </article>`;
    }).join('')}</div>`;
  }

  function bindRequirementActions(data, root, refresh) {
    root?.querySelectorAll('[data-lx-req-act]').forEach(b => b.addEventListener('click', async () => {
      const r = (data.requirements || []).find(x => x.id === b.dataset.id); if (!r) return;
      const act = b.dataset.lxReqAct;
      if (act === 'edit') return openRequirementModal(data, r, refresh);
      if (act === 'notify') return openCommunicationModal(r.process_id, 'exigencia', { exigencia: r.description });
      const resolution = prompt('Como a exigência foi cumprida? (opcional)', r.resolution || '');
      if (resolution === null) return;
      const { error } = await db().from('process_requirements').update({ status: 'cumprida', resolution: resolution.trim() || null }).eq('id', r.id);
      if (error) return toast(error.message, 'bad');
      toast('Exigência marcada como cumprida.'); await refresh();
    }));
  }

  function openRequirementModal(data, r = null, refresh = requirementsPage, preset = {}) {
    const rec = r || preset;
    const procs = data.processes.filter(p => p.status !== 'cancelled');
    const clientOptions = typeof window.clientSelectOptions === 'function' ? window.clientSelectOptions(data, rec.client_id || '') : data.clients.map(c => `<option value="${c.id}" ${rec.client_id === c.id ? 'selected' : ''}>${h(c.legal_name)}</option>`).join('');
    shell(r ? 'Editar exigência' : 'Nova exigência', `<form id="lx-req-form" class="modal-form-grid">
      <div class="field"><label>Tipo</label><select id="lx-rq-kind"><option value="exigencia" ${rec.kind !== 'condicionante' ? 'selected' : ''}>Exigência do órgão</option><option value="condicionante" ${rec.kind === 'condicionante' ? 'selected' : ''}>Condicionante de licença</option></select></div>
      <div class="field"><label>Órgão</label><input id="lx-rq-agency" list="lx-agency-list2" value="${h(rec.agency || '')}"><datalist id="lx-agency-list2">${AGENCIES.map(a => `<option value="${h(a)}">`).join('')}</datalist></div>
      <div class="field"><label>Empresa *</label><select id="lx-rq-client" required><option value="">Selecione</option>${clientOptions}</select></div>
      <div class="field"><label>Processo</label><select id="lx-rq-process"><option value="">Sem processo</option>${procs.map(p => `<option value="${p.id}" data-client="${p.client_id}" ${rec.process_id === p.id ? 'selected' : ''}>${h(procLabel(p))}</option>`).join('')}</select></div>
      <div class="field span-2"><label>Licença vinculada (condicionante)</label><select id="lx-rq-license"><option value="">Nenhuma</option>${(data.licenses || []).map(l => `<option value="${l.id}" data-client="${l.client_id}" ${rec.license_id === l.id ? 'selected' : ''}>${h(l.name)} — ${h(clientName(data, l.client_id))}</option>`).join('')}</select></div>
      <div class="field span-2"><label>Descrição *</label><textarea id="lx-rq-desc" rows="3" required>${h(rec.description || '')}</textarea></div>
      <div class="field"><label>Recebida em</label><input id="lx-rq-received" type="date" value="${h(rec.received_at || todayISO())}"></div>
      <div class="field"><label>Prazo para cumprir</label><input id="lx-rq-due" type="date" value="${h(rec.due_date || '')}"></div>
      <div class="field"><label>Responsável</label><select id="lx-rq-assignee"><option value="">Responsável do processo</option>${staff(data).map(p => `<option value="${p.id}" ${rec.assignee_id === p.id ? 'selected' : ''}>${h(p.full_name)}</option>`).join('')}</select></div>
      <div class="field"><label>Situação</label><select id="lx-rq-status">${Object.entries(REQ_STATUS).map(([k, v]) => `<option value="${k}" ${(rec.status || 'aberta') === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
      <div class="field span-2"><label>Resolução</label><textarea id="lx-rq-res" rows="2">${h(rec.resolution || '')}</textarea></div>
      <div class="modal-actions span-2">${r ? '<button type="button" class="btn btn-muted lx-danger-text" id="lx-rq-delete">Excluir</button>' : ''}<button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button class="btn btn-primary" type="submit" id="lx-rq-save">Salvar</button></div>
      <div id="lx-rq-msg" class="auth-message hidden span-2"></div>
    </form>`, true);
    $('#lx-rq-process').addEventListener('change', e => { const c = e.target.selectedOptions[0]?.dataset.client; if (c) $('#lx-rq-client').value = c; });
    $('#lx-rq-license').addEventListener('change', e => { const c = e.target.selectedOptions[0]?.dataset.client; if (c) $('#lx-rq-client').value = c; if (e.target.value) $('#lx-rq-kind').value = 'condicionante'; });
    $('#lx-req-form').addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {
        kind: $('#lx-rq-kind').value, agency: $('#lx-rq-agency').value.trim() || null, client_id: $('#lx-rq-client').value,
        process_id: $('#lx-rq-process').value || null, license_id: $('#lx-rq-license').value || null, description: $('#lx-rq-desc').value.trim(),
        received_at: $('#lx-rq-received').value || null, due_date: $('#lx-rq-due').value || null, assignee_id: $('#lx-rq-assignee').value || null,
        status: $('#lx-rq-status').value, resolution: $('#lx-rq-res').value.trim() || null
      };
      if (!payload.client_id) return msgBox('#lx-rq-msg', 'Selecione a empresa.');
      const btn = $('#lx-rq-save'); btn.disabled = true; btn.textContent = 'Salvando...';
      const { error } = r ? await db().from('process_requirements').update(payload).eq('id', r.id)
        : await db().from('process_requirements').insert({ ...payload, organization_id: profile().organization_id, created_by: profile().id });
      if (error) { btn.disabled = false; btn.textContent = 'Salvar'; return msgBox('#lx-rq-msg', error.message); }
      closeModal(); toast('Exigência salva.'); await refresh();
    });
    $('#lx-rq-delete')?.addEventListener('click', async () => {
      if (!confirm('Excluir esta exigência?')) return;
      const { error } = await db().from('process_requirements').delete().eq('id', r.id);
      if (error) return msgBox('#lx-rq-msg', error.message);
      closeModal(); await refresh();
    });
  }

  /* ================================================================
     5. CERTIDÕES E VENCIMENTOS
     ================================================================ */
  const certFilters = { category: '', state: '', client: '', agency: '', responsible: '', text: '' };

  async function certificatesPage() {
    setHeadSafe('Certidões e vencimentos', 'CONFORMIDADE', 'Certidões negativas, alvarás, licenças e certificados digitais com status, alertas escalonados e renovação.');
    loading('Carregando vencimentos...');
    const data = await loadCentral();
    renderCertificates(data);
  }

  function renderCertificates(data) {
    const all = (data.licenses || []).filter(l => data.clientMap.has(l.client_id));
    const withState = all.map(l => ({ l, s: licenseState(l) }));
    const count = k => withState.filter(x => k.includes(x.s.key)).length;
    const agencies = [...new Set(all.map(l => l.agency).filter(Boolean))].sort();
    const clientsUsed = [...new Set(all.map(l => l.client_id))].map(id => data.clientMap.get(id)).filter(Boolean).sort((a, b) => a.legal_name.localeCompare(b.legal_name, 'pt-BR'));
    const list = withState.filter(({ l, s }) => {
      if (certFilters.category && (l.category || 'licenca') !== certFilters.category) return false;
      if (certFilters.state === 'expired' && !['expired', 'today'].includes(s.key)) return false;
      if (certFilters.state === 'soon' && s.key !== 'soon') return false;
      if (certFilters.state === 'attention' && s.key !== 'attention') return false;
      if (certFilters.state === 'valid' && s.key !== 'valid') return false;
      if (certFilters.state === 'renewing' && s.key !== 'renewing') return false;
      if (certFilters.state === 'nodate' && s.key !== 'nodate') return false;
      if (certFilters.client && l.client_id !== certFilters.client) return false;
      if (certFilters.agency && l.agency !== certFilters.agency) return false;
      if (certFilters.responsible && l.responsible_id !== certFilters.responsible) return false;
      if (certFilters.text && !norm([l.name, l.agency, l.document_number, clientName(data, l.client_id)].join(' ')).includes(norm(certFilters.text))) return false;
      return true;
    }).sort((a, b) => String(a.l.expires_at || '9999').localeCompare(String(b.l.expires_at || '9999')));

    pageSafe(`${schemaNotice()}
      <div class="lx-kpis">
        ${kpi('Vencidos', count(['expired', 'today']), 'Ação imediata', count(['expired', 'today']) ? 'bad' : '')}
        ${kpi('Vencem em 30 dias', count(['soon']), 'Iniciar renovação', count(['soon']) ? 'warn' : '')}
        ${kpi('31 a 90 dias', count(['attention']), 'Planejar renovação')}
        ${kpi('Em renovação', count(['renewing']), 'Pedido em andamento')}
        ${kpi('Válidos', count(['valid']), 'Mais de 90 dias', 'ok')}
      </div>
      <section class="lx-card">
        <div class="lx-toolbar">
          <input id="lx-cert-search" type="search" placeholder="Buscar documento, número ou empresa" value="${h(certFilters.text)}">
          <select id="lx-cert-state"><option value="">Todas as situações</option>${[['expired', 'Vencidos'], ['soon', 'Vencem em 30 dias'], ['attention', '31 a 90 dias'], ['renewing', 'Em renovação'], ['valid', 'Válidos'], ['nodate', 'Sem vencimento']].map(([k, v]) => `<option value="${k}" ${certFilters.state === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <select id="lx-cert-cat"><option value="">Todas as categorias</option>${Object.entries(CATEGORY).map(([k, v]) => `<option value="${k}" ${certFilters.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <select id="lx-cert-client"><option value="">Todas as empresas</option>${clientsUsed.map(c => `<option value="${c.id}" ${certFilters.client === c.id ? 'selected' : ''}>${h(c.legal_name)}</option>`).join('')}</select>
          <select id="lx-cert-agency"><option value="">Todos os órgãos</option>${agencies.map(a => `<option ${certFilters.agency === a ? 'selected' : ''}>${h(a)}</option>`).join('')}</select>
          <select id="lx-cert-resp"><option value="">Todos os responsáveis</option>${staff(data).map(p => `<option value="${p.id}" ${certFilters.responsible === p.id ? 'selected' : ''}>${h(p.full_name)}</option>`).join('')}</select>
          <div class="lx-toolbar-actions">
            <button class="btn btn-muted" type="button" id="lx-cert-export">Exportar CSV</button>
            ${canEdit() ? '<button class="btn btn-muted" type="button" id="lx-cert-import">Importar planilha</button><button class="btn btn-muted" type="button" id="lx-cert-batch">Pacote de certidões</button><button class="btn btn-primary" type="button" id="lx-cert-new">＋ Novo documento</button>' : ''}
          </div>
        </div>
        ${list.length ? `<div class="lx-table-wrap"><table class="lx-table"><thead><tr><th>Documento</th><th>Empresa</th><th>Órgão</th><th>Emissão</th><th>Vencimento</th><th>Situação</th><th>Responsável</th><th></th></tr></thead><tbody>${list.map(({ l, s }) => `<tr>
          <td data-label="Documento"><strong>${h(l.name)}</strong><div class="muted">${h(CATEGORY[l.category] || 'Licença')}${l.document_number ? ' · nº ' + h(l.document_number) : ''}</div></td>
          <td data-label="Empresa">${h(clientName(data, l.client_id))}</td>
          <td data-label="Órgão">${h(l.agency || '—')}</td>
          <td data-label="Emissão">${br(l.issued_at)}</td>
          <td data-label="Vencimento"><strong>${br(l.expires_at)}</strong></td>
          <td data-label="Situação">${badge(s.label, s.cls)}</td>
          <td data-label="Responsável">${h(l.responsible_id ? personName(data, l.responsible_id) : '—')}</td>
          <td><div class="lx-row-actions">${l.official_url ? `<a class="mini-btn" href="${h(l.official_url)}" target="_blank" rel="noopener">Emitir / consultar</a>` : ''}${canEdit() ? `<button class="mini-btn" type="button" data-lx-cert-act="renew" data-id="${h(l.id)}">${l.status === 'renewing' ? 'Renovada' : 'Renovar'}</button><button class="mini-btn" type="button" data-lx-cert-act="edit" data-id="${h(l.id)}">Editar</button><button class="mini-btn" type="button" data-lx-cert-act="notify" data-id="${h(l.id)}">Avisar</button>` : ''}</div></td>
        </tr>`).join('')}</tbody></table></div>` : empty('Nenhum documento com esses filtros', 'Cadastre certidões, alvarás e licenças, ou use o pacote de certidões para gerar as 6 principais de uma empresa.')}
      </section>
      <section class="lx-card">
        <div class="lx-section-head"><h2>Emissão gratuita nos portais oficiais</h2><span>Emita no órgão e anexe em Documentos; o ATLAS controla a validade e avisa antes de vencer</span></div>
        <div class="lx-links">${STANDARD_CERTIDOES.filter(c => c.url).map(c => `<a href="${h(c.url)}" target="_blank" rel="noopener">${h(c.name)}<small>validade usual ${c.days} dias</small></a>`).join('')}</div>
      </section>`);

    const re = () => renderCertificates(data);
    $('#lx-cert-search')?.addEventListener('input', e => { certFilters.text = e.target.value; clearTimeout(renderCertificates._t); renderCertificates._t = setTimeout(() => { re(); const i = $('#lx-cert-search'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }, 250); });
    [['#lx-cert-state', 'state'], ['#lx-cert-cat', 'category'], ['#lx-cert-client', 'client'], ['#lx-cert-agency', 'agency'], ['#lx-cert-resp', 'responsible']].forEach(([s, k]) => $(s)?.addEventListener('change', e => { certFilters[k] = e.target.value; re(); }));
    $('#lx-cert-new')?.addEventListener('click', () => openCertificateModal(data));
    $('#lx-cert-batch')?.addEventListener('click', () => openCertificateBatchModal(data));
    $('#lx-cert-import')?.addEventListener('click', () => openImportModal(data));
    $('#lx-cert-export')?.addEventListener('click', () => {
      const rows = [['Documento', 'Categoria', 'Empresa', 'CNPJ', 'Órgão', 'Número', 'Emissão', 'Vencimento', 'Situação', 'Responsável']];
      list.forEach(({ l, s }) => { const c = data.clientMap.get(l.client_id); rows.push([l.name, CATEGORY[l.category] || 'Licença', c?.legal_name, c?.tax_id, l.agency, l.document_number, br(l.issued_at), br(l.expires_at), s.label, l.responsible_id ? personName(data, l.responsible_id) : '']); });
      downloadFile(`atlas-vencimentos-${todayISO()}.csv`, csv(rows), 'text/csv;charset=utf-8');
    });
    $$('[data-lx-cert-act]').forEach(b => b.addEventListener('click', async () => {
      const l = all.find(x => x.id === b.dataset.id); if (!l) return;
      const act = b.dataset.lxCertAct;
      if (act === 'edit') return openCertificateModal(data, l);
      if (act === 'notify') { const c = data.clientMap.get(l.client_id); return openCommunicationModal(null, 'vencimento', { documento: l.name, vencimento: br(l.expires_at) }, c); }
      if (act === 'renew') return openRenewModal(data, l);
    }));
  }

  function openRenewModal(data, l) {
    const def = STANDARD_CERTIDOES.find(c => norm(c.name) === norm(l.name));
    const base = todayISO();
    const suggested = def ? addDays(base, def.days) : (l.issued_at && l.expires_at ? addDays(base, diffDays(l.expires_at, l.issued_at)) : '');
    const renewing = l.status === 'renewing';
    shell(renewing ? 'Registrar renovação concluída' : 'Renovação', `<form id="lx-renew-form" class="modal-form-grid">
      <div class="field span-2"><label>Documento</label><input disabled value="${h(l.name)} — ${h(clientName(data, l.client_id))}"></div>
      ${renewing ? '' : `<div class="span-2 lx-notice">Marque <strong>Em renovação</strong> quando o pedido for protocolado; os alertas continuam até a nova validade ser registrada.</div>`}
      <div class="field"><label>Nova emissão</label><input id="lx-rn-issued" type="date" value="${base}"></div>
      <div class="field"><label>Nova validade</label><input id="lx-rn-exp" type="date" value="${h(suggested)}"></div>
      <div class="field span-2"><label>Novo número</label><input id="lx-rn-num" value="${h(l.document_number || '')}"></div>
      <div class="modal-actions span-2">${renewing ? '' : '<button type="button" class="btn btn-muted" id="lx-rn-start">Marcar em renovação</button>'}<button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button class="btn btn-primary" type="submit">Registrar nova validade</button></div>
      <div id="lx-rn-msg" class="auth-message hidden span-2"></div>
    </form>`);
    $('#lx-rn-start')?.addEventListener('click', async () => {
      const { error } = await db().from('licenses').update({ status: 'renewing' }).eq('id', l.id);
      if (error) return msgBox('#lx-rn-msg', error.message);
      closeModal(); toast('Marcado como em renovação.'); certificatesPage();
    });
    $('#lx-renew-form').addEventListener('submit', async e => {
      e.preventDefault();
      const exp = $('#lx-rn-exp').value; if (!exp) return msgBox('#lx-rn-msg', 'Informe a nova validade.');
      const { error } = await db().from('licenses').update({ status: 'active', issued_at: $('#lx-rn-issued').value || null, expires_at: exp, document_number: $('#lx-rn-num').value.trim() || null, last_checked_at: todayISO() }).eq('id', l.id);
      if (error) return msgBox('#lx-rn-msg', error.message);
      closeModal(); toast('Nova validade registrada. Anexe o arquivo em Documentos.'); certificatesPage();
    });
  }

  function openCertificateModal(data, l = null) {
    const rec = l || { category: 'certidao', status: 'active' };
    const clientOptions = typeof window.clientSelectOptions === 'function' ? window.clientSelectOptions(data, rec.client_id || '') : data.clients.map(c => `<option value="${c.id}">${h(c.legal_name)}</option>`).join('');
    shell(l ? 'Editar documento' : 'Novo documento com vencimento', `<form id="lx-cert-form" class="modal-form-grid">
      <div class="field"><label>Categoria</label><select id="lx-c-cat">${Object.entries(CATEGORY).map(([k, v]) => `<option value="${k}" ${(rec.category || 'licenca') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Modelo rápido</label><select id="lx-c-preset"><option value="">—</option>${STANDARD_CERTIDOES.map(c => `<option value="${c.key}">${h(c.name)}</option>`).join('')}</select></div>
      <div class="field span-2"><label>Documento *</label><input id="lx-c-name" required value="${h(rec.name || '')}" placeholder="Ex.: CND Federal, Alvará de Funcionamento, Licença CETESB"></div>
      <div class="field"><label>Empresa *</label><select id="lx-c-client" required><option value="">Selecione</option>${clientOptions}</select></div>
      <div class="field"><label>Órgão emissor</label><input id="lx-c-agency" list="lx-agency-list3" value="${h(rec.agency || '')}"><datalist id="lx-agency-list3">${AGENCIES.map(a => `<option value="${h(a)}">`).join('')}</datalist></div>
      <div class="field"><label>Número</label><input id="lx-c-number" value="${h(rec.document_number || '')}"></div>
      <div class="field"><label>Responsável</label><select id="lx-c-resp"><option value="">—</option>${staff(data).map(p => `<option value="${p.id}" ${rec.responsible_id === p.id ? 'selected' : ''}>${h(p.full_name)}</option>`).join('')}</select></div>
      <div class="field"><label>Emissão</label><input id="lx-c-issued" type="date" value="${h(rec.issued_at || '')}"></div>
      <div class="field"><label>Vencimento</label><input id="lx-c-exp" type="date" value="${h(rec.expires_at || '')}"></div>
      <div class="field"><label>Situação</label><select id="lx-c-status"><option value="active" ${rec.status !== 'renewing' && rec.status !== 'not_applicable' ? 'selected' : ''}>Ativo</option><option value="renewing" ${rec.status === 'renewing' ? 'selected' : ''}>Em renovação</option><option value="not_applicable" ${rec.status === 'not_applicable' ? 'selected' : ''}>Não se aplica</option></select></div>
      <div class="field"><label>Antecedência do aviso (dias)</label><input id="lx-c-lead" type="number" min="0" max="365" value="${h(rec.renewal_lead_days ?? 30)}"></div>
      <div class="field span-2"><label>Link oficial de emissão / consulta</label><input id="lx-c-url" type="url" value="${h(rec.official_url || '')}" placeholder="https://"></div>
      <div class="field span-2"><label>Observações</label><textarea id="lx-c-notes" rows="2">${h(rec.notes || '')}</textarea></div>
      <div class="modal-actions span-2">${l ? '<button type="button" class="btn btn-muted lx-danger-text" id="lx-c-delete">Excluir</button>' : ''}<button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button class="btn btn-primary" type="submit" id="lx-c-save">Salvar</button></div>
      <div id="lx-c-msg" class="auth-message hidden span-2"></div>
    </form>`, true);
    $('#lx-c-preset').addEventListener('change', e => {
      const def = STANDARD_CERTIDOES.find(c => c.key === e.target.value); if (!def) return;
      $('#lx-c-name').value = def.name; $('#lx-c-agency').value = def.agency; $('#lx-c-url').value = def.url; $('#lx-c-cat').value = def.category || 'certidao';
      const issued = $('#lx-c-issued').value || todayISO(); $('#lx-c-issued').value = issued; $('#lx-c-exp').value = addDays(issued, def.days);
    });
    $('#lx-cert-form').addEventListener('submit', async e => {
      e.preventDefault();
      const url = $('#lx-c-url').value.trim();
      if (url && !/^https?:\/\//i.test(url)) return msgBox('#lx-c-msg', 'O link deve começar com http:// ou https://');
      const full = {
        category: $('#lx-c-cat').value, name: $('#lx-c-name').value.trim(), client_id: $('#lx-c-client').value, agency: $('#lx-c-agency').value.trim() || null,
        document_number: $('#lx-c-number').value.trim() || null, responsible_id: $('#lx-c-resp').value || null, issued_at: $('#lx-c-issued').value || null,
        expires_at: $('#lx-c-exp').value || null, status: $('#lx-c-status').value, renewal_lead_days: Number($('#lx-c-lead').value || 30),
        official_url: url || null, notes: $('#lx-c-notes').value.trim() || null
      };
      if (!full.client_id) return msgBox('#lx-c-msg', 'Selecione a empresa.');
      if (full.issued_at && full.expires_at && full.expires_at < full.issued_at) return msgBox('#lx-c-msg', 'O vencimento não pode ser anterior à emissão.');
      const payload = schemaReady ? full : (({ category, responsible_id, official_url, notes, ...rest }) => rest)(full);
      const btn = $('#lx-c-save'); btn.disabled = true; btn.textContent = 'Salvando...';
      const { error } = l ? await db().from('licenses').update(payload).eq('id', l.id) : await db().from('licenses').insert(payload);
      if (error) { btn.disabled = false; btn.textContent = 'Salvar'; return msgBox('#lx-c-msg', error.message); }
      closeModal(); toast('Documento salvo.'); certificatesPage();
    });
    $('#lx-c-delete')?.addEventListener('click', async () => {
      if (!confirm('Excluir este documento do controle de vencimentos?')) return;
      const { error } = await db().from('licenses').delete().eq('id', l.id);
      if (error) return msgBox('#lx-c-msg', error.message);
      closeModal(); certificatesPage();
    });
  }

  function openCertificateBatchModal(data) {
    if (!schemaReady) return toast('O pacote de certidões depende da migração V8 no banco.', 'bad');
    const clientOptions = typeof window.clientSelectOptions === 'function' ? window.clientSelectOptions(data, '') : data.clients.map(c => `<option value="${c.id}">${h(c.legal_name)}</option>`).join('');
    shell('Pacote de certidões', `<form id="lx-batch-form" class="modal-form-grid">
      <div class="field span-2"><label>Empresa *</label><select id="lx-b-client" required><option value="">Selecione</option>${clientOptions}</select></div>
      <div class="span-2 lx-check-grid">${STANDARD_CERTIDOES.map(c => `<label><input type="checkbox" value="${c.key}" checked><span><strong>${h(c.name)}</strong><small>${h(c.agency)} · ${c.days} dias</small></span></label>`).join('')}</div>
      <div class="field"><label>Emitidas em</label><input id="lx-b-issued" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Responsável</label><select id="lx-b-resp"><option value="">—</option>${staff(data).map(p => `<option value="${p.id}">${h(p.full_name)}</option>`).join('')}</select></div>
      <div class="span-2 lx-notice">A validade é calculada pelo prazo usual de cada certidão. Ajuste depois pelo vencimento impresso no documento. Itens já cadastrados para a empresa são ignorados.</div>
      <div class="modal-actions span-2"><button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button class="btn btn-primary" type="submit" id="lx-b-save">Criar controles</button></div>
      <div id="lx-b-msg" class="auth-message hidden span-2"></div>
    </form>`, true);
    $('#lx-batch-form').addEventListener('submit', async e => {
      e.preventDefault();
      const client = $('#lx-b-client').value; if (!client) return msgBox('#lx-b-msg', 'Selecione a empresa.');
      const issued = $('#lx-b-issued').value || todayISO();
      const chosen = $$('.lx-check-grid input:checked').map(i => STANDARD_CERTIDOES.find(c => c.key === i.value));
      const existing = new Set((data.licenses || []).filter(l => l.client_id === client).map(l => norm(l.name)));
      const rows = chosen.filter(c => !existing.has(norm(c.name))).map(c => ({
        client_id: client, name: c.name, agency: c.agency, category: c.category || 'certidao', issued_at: issued, expires_at: addDays(issued, c.days),
        official_url: c.url || null, status: 'active', renewal_lead_days: Math.min(30, c.days), responsible_id: $('#lx-b-resp').value || null
      }));
      if (!rows.length) return msgBox('#lx-b-msg', 'Todos os itens escolhidos já existem para esta empresa.');
      const { error } = await db().from('licenses').insert(rows);
      if (error) return msgBox('#lx-b-msg', error.message);
      closeModal(); toast(`${rows.length} controles criados.`); certificatesPage();
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src === src)) return resolve();
      const s = document.createElement('script'); s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('Falha ao carregar o leitor de planilhas.'));
      document.head.appendChild(s);
    });
  }

  function openImportModal(data) {
    shell('Importar vencimentos de planilha', `<div class="modal-form-grid">
      <div class="span-2 lx-notice">Aceita <strong>.xlsx</strong> ou <strong>.csv</strong>. Colunas reconhecidas: <code>empresa</code> ou <code>cnpj</code>, <code>documento</code>, <code>categoria</code>, <code>orgao</code>, <code>numero</code>, <code>emissao</code>, <code>vencimento</code>. A leitura é feita no seu navegador.</div>
      <div class="field span-2"><label>Arquivo</label><input id="lx-imp-file" type="file" accept=".xlsx,.xls,.csv"></div>
      <div class="field span-2"><button type="button" class="btn btn-muted" id="lx-imp-model">Baixar modelo de planilha</button></div>
      <div class="span-2" id="lx-imp-preview"></div>
      <div class="modal-actions span-2"><button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button class="btn btn-primary" type="button" id="lx-imp-save" disabled>Importar</button></div>
      <div id="lx-imp-msg" class="auth-message hidden span-2"></div>
    </div>`, true);
    let ready = [];
    $('#lx-imp-model').addEventListener('click', () => downloadFile('modelo-vencimentos-atlas.csv', csv([['cnpj', 'empresa', 'documento', 'categoria', 'orgao', 'numero', 'emissao', 'vencimento'], ['00.000.000/0001-00', 'Empresa Exemplo Ltda', 'Alvará de Funcionamento', 'alvara', 'Prefeitura', '123/2026', '01/02/2026', '31/01/2027']]), 'text/csv;charset=utf-8'));
    $('#lx-imp-file').addEventListener('change', async e => {
      const file = e.target.files?.[0]; if (!file) return;
      $('#lx-imp-preview').innerHTML = '<div class="loading-box"><span class="spinner"></span><div>Lendo planilha...</div></div>';
      try {
        let rows = [];
        if (/\.csv$/i.test(file.name)) {
          const text = await file.text();
          const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
          const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
          const split = line => { const out = []; let cur = '', qt = false; for (const ch of line) { if (ch === '"') qt = !qt; else if (ch === sep && !qt) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(v => v.trim()); };
          const head = split(lines[0]).map(norm);
          rows = lines.slice(1).map(l => { const v = split(l); const o = {}; head.forEach((k, i) => o[k] = v[i]); return o; });
        } else {
          await loadScript(XLSX_CDN);
          const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
          const raw = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
          rows = raw.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [norm(k), v])));
        }
        const byCnpj = new Map(data.clients.map(c => [digits(c.tax_id), c]));
        const byName = new Map(data.clients.map(c => [norm(c.legal_name), c]));
        const pick = (o, ...keys) => { for (const k of keys) if (o[k] != null && o[k] !== '') return o[k]; return ''; };
        const catOf = v => { const n = norm(v); return Object.keys(CATEGORY).find(k => n.startsWith(k.slice(0, 5)) || n === norm(CATEGORY[k])) || (/certid|cnd|crf/.test(n) ? 'certidao' : /alvar/.test(n) ? 'alvara' : /certificado/.test(n) ? 'certificado_digital' : 'licenca'); };
        const parsed = rows.map(o => {
          const c = byCnpj.get(digits(pick(o, 'cnpj'))) || byName.get(norm(pick(o, 'empresa', 'razao social', 'cliente')));
          const name = String(pick(o, 'documento', 'licenca', 'nome', 'tipo')).trim();
          return { c, row: { client_id: c?.id, name, category: catOf(pick(o, 'categoria') || name), agency: String(pick(o, 'orgao', 'orgao emissor')).trim() || null, document_number: String(pick(o, 'numero', 'n')).trim() || null, issued_at: parseFlexibleDate(pick(o, 'emissao', 'data emissao')), expires_at: parseFlexibleDate(pick(o, 'vencimento', 'validade', 'data vencimento')), status: 'active', renewal_lead_days: 30 } };
        }).filter(x => x.row.name);
        ready = parsed.filter(x => x.c).map(x => schemaReady ? x.row : (({ category, ...rest }) => rest)(x.row));
        const bad = parsed.filter(x => !x.c);
        $('#lx-imp-preview').innerHTML = `<div class="lx-notice ${bad.length ? 'warn' : ''}"><strong>${ready.length}</strong> linha(s) prontas para importar${bad.length ? ` · <strong>${bad.length}</strong> sem empresa correspondente (confira CNPJ ou razão social)` : ''}.</div>
          <div class="lx-table-wrap"><table class="lx-table"><thead><tr><th>Empresa</th><th>Documento</th><th>Vencimento</th></tr></thead><tbody>${parsed.slice(0, 12).map(x => `<tr><td>${x.c ? h(x.c.legal_name) : '<span class="lx-danger-text">Não encontrada</span>'}</td><td>${h(x.row.name)}</td><td>${br(x.row.expires_at)}</td></tr>`).join('')}</tbody></table></div>`;
        $('#lx-imp-save').disabled = !ready.length;
      } catch (err) { $('#lx-imp-preview').innerHTML = `<div class="error-box">${h(err.message || err)}</div>`; }
    });
    $('#lx-imp-save').addEventListener('click', async () => {
      if (!ready.length) return;
      const btn = $('#lx-imp-save'); btn.disabled = true; btn.textContent = 'Importando...';
      const { error } = await db().from('licenses').insert(ready);
      if (error) { btn.disabled = false; btn.textContent = 'Importar'; return msgBox('#lx-imp-msg', error.message); }
      closeModal(); toast(`${ready.length} vencimento(s) importado(s).`); certificatesPage();
    });
  }

  /* ================================================================
     6. AGENDA DE PRAZOS (+ exportação .ics)
     ================================================================ */
  let agendaMonth = todayISO().slice(0, 7);
  let agendaDay = todayISO();

  function agendaEvents(data) {
    const ev = [];
    (data.licenses || []).forEach(l => { if (l.expires_at && l.status !== 'not_applicable' && data.clientMap.has(l.client_id)) ev.push({ date: l.expires_at, kind: 'venc', title: `Vence: ${l.name}`, sub: clientName(data, l.client_id) }); });
    (data.tasks || []).forEach(t => {
      if (t.status !== 'aberta') return; const p = data.processMap.get(t.process_id); if (!p) return;
      if (t.target_date) ev.push({ date: t.target_date, kind: 'task', title: `Meta: ${t.title}`, sub: `${p.public_code || ''} · ${clientName(data, p.client_id)}`, pid: p.id });
      if (t.legal_date) ev.push({ date: t.legal_date, kind: 'legal', title: `Data legal: ${t.title}`, sub: `${p.public_code || ''} · ${clientName(data, p.client_id)}`, pid: p.id });
    });
    (data.requirements || []).forEach(r => { if (r.due_date && ['aberta', 'em_atendimento'].includes(r.status)) ev.push({ date: r.due_date, kind: 'req', title: `Exigência: ${r.description.slice(0, 80)}`, sub: [r.agency, clientName(data, r.client_id)].filter(Boolean).join(' · '), pid: r.process_id }); });
    (data.protocols || []).forEach(p => { if (p.next_action_at && protoOpen(p) && data.processMap.has(p.process_id)) { const pr = data.processMap.get(p.process_id); ev.push({ date: String(p.next_action_at).slice(0, 10), kind: 'proto', title: `Verificar protocolo ${p.protocol_number || ''}`, sub: [p.agency, pr.public_code].filter(Boolean).join(' · '), pid: pr.id }); } });
    data.processes.forEach(p => { if (p.due_date && !['completed', 'cancelled'].includes(p.status)) ev.push({ date: p.due_date, kind: 'proc', title: `Prazo do processo ${p.public_code || ''}`, sub: `${p.title || ''} · ${clientName(data, p.client_id)}`, pid: p.id }); });
    return ev.sort((a, b) => a.date.localeCompare(b.date));
  }
  const KIND = { venc: ['Vencimento', 'bad'], task: ['Tarefa', 'info'], legal: ['Data legal', 'bad'], req: ['Exigência', 'warn'], proto: ['Protocolo', 'neutral'], proc: ['Processo', 'ok'] };

  async function agendaPage() {
    setHeadSafe('Agenda de prazos', 'OPERAÇÃO', 'Vencimentos, datas meta, datas legais, exigências e verificações de protocolo em um só calendário.');
    loading('Montando agenda...');
    const data = await loadCentral();
    renderAgenda(data);
  }

  function renderAgenda(data) {
    const events = agendaEvents(data);
    const byDay = new Map(); events.forEach(e => { if (!byDay.has(e.date)) byDay.set(e.date, []); byDay.get(e.date).push(e); });
    const [y, m] = agendaMonth.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const startDow = (first.getUTCDay() + 6) % 7; // segunda = 0
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const today = todayISO();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push('<div class="lx-cal-cell muted"></div>');
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${agendaMonth}-${String(d).padStart(2, '0')}`;
      const evs = byDay.get(iso) || [];
      const kinds = [...new Set(evs.map(e => e.kind))];
      cells.push(`<button type="button" class="lx-cal-cell ${iso === today ? 'today' : ''} ${iso === agendaDay ? 'sel' : ''} ${evs.length ? 'has' : ''}" data-lx-day="${iso}"><span>${d}</span>${evs.length ? `<i>${kinds.map(k => `<b class="k-${k}"></b>`).join('')}</i><small>${evs.length}</small>` : ''}</button>`);
    }
    const monthName = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const dayEvents = byDay.get(agendaDay) || [];
    const next = events.filter(e => e.date >= today).slice(0, 12);
    const overdue = events.filter(e => e.date < today && e.kind !== 'proc').length;

    pageSafe(`${schemaNotice()}
      <div class="lx-agenda">
        <section class="lx-card">
          <div class="lx-cal-head">
            <button type="button" class="mini-btn" data-lx-month="-1" aria-label="Mês anterior">‹</button>
            <strong>${h(monthName.charAt(0).toUpperCase() + monthName.slice(1))}</strong>
            <button type="button" class="mini-btn" data-lx-month="1" aria-label="Próximo mês">›</button>
            <button type="button" class="mini-btn" data-lx-month="0">Hoje</button>
            <span class="lx-grow"></span>
            <button type="button" class="btn btn-muted" id="lx-ics">Exportar para calendário (.ics)</button>
          </div>
          <div class="lx-cal-dow">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => `<span>${d}</span>`).join('')}</div>
          <div class="lx-cal-grid">${cells.join('')}</div>
          <div class="lx-legend">${Object.entries(KIND).map(([k, v]) => `<span><b class="k-${k}"></b>${v[0]}</span>`).join('')}</div>
        </section>
        <aside class="lx-card">
          <div class="lx-section-head"><h2>${br(agendaDay)}</h2><span>${dayEvents.length} compromisso(s)</span></div>
          ${dayEvents.length ? eventList(dayEvents) : '<p class="muted">Nada agendado para este dia.</p>'}
          <div class="lx-section-head" style="margin-top:18px"><h2>Próximos</h2><span>${overdue ? `${overdue} item(ns) em atraso` : 'Sem atrasos'}</span></div>
          ${next.length ? eventList(next, true) : '<p class="muted">Nenhum prazo futuro cadastrado.</p>'}
        </aside>
      </div>`);
    $$('[data-lx-month]').forEach(b => b.addEventListener('click', () => {
      const delta = Number(b.dataset.lxMonth);
      if (!delta) { agendaMonth = todayISO().slice(0, 7); agendaDay = todayISO(); }
      else { const d = new Date(Date.UTC(y, m - 1 + delta, 1)); agendaMonth = d.toISOString().slice(0, 7); }
      renderAgenda(data);
    }));
    $$('[data-lx-day]').forEach(b => b.addEventListener('click', () => { agendaDay = b.dataset.lxDay; renderAgenda(data); }));
    $$('[data-lx-open-proc]').forEach(b => b.addEventListener('click', () => openPanel(b.dataset.lxOpenProc)));
    $('#lx-ics')?.addEventListener('click', () => exportIcs(events.filter(e => e.date >= addDays(today, -7) && e.date <= addDays(today, 400))));
  }

  function eventList(list, withDate = false) {
    return `<ul class="lx-events">${list.map(e => `<li class="k-${e.kind}"><b class="k-${e.kind}"></b><div><strong>${h(e.title)}</strong><span>${withDate ? br(e.date) + ' · ' : ''}${h(e.sub || '')}</span></div>${e.pid ? `<button class="mini-btn" type="button" data-lx-open-proc="${h(e.pid)}">Abrir</button>` : ''}</li>`).join('')}</ul>`;
  }

  function exportIcs(events) {
    const esc_ = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ATLAS Legalizacao//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:ATLAS Legalização — prazos'];
    events.forEach((e, i) => {
      const d = e.date.replace(/-/g, ''); const end = addDays(e.date, 1).replace(/-/g, '');
      lines.push('BEGIN:VEVENT', `UID:atlas-${d}-${i}-${e.kind}@atlas-legalizacao`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${esc_(e.title)}`, `DESCRIPTION:${esc_((KIND[e.kind]?.[0] || '') + ' — ' + (e.sub || ''))}`,
        'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc_(e.title)}`, 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    downloadFile(`atlas-prazos-${todayISO()}.ics`, lines.join('\r\n'), 'text/calendar;charset=utf-8');
    toast(`${events.length} prazo(s) exportado(s). Abra o arquivo no Google Agenda, Outlook ou Calendário do iPhone.`);
  }

  /* ================================================================
     7. COMUNICAÇÃO COM O CLIENTE (WhatsApp / e-mail, sem custo)
     ================================================================ */
  function fillTemplate(text, vars) { return String(text).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`); }

  function commVars(data, p, extra = {}, clientOverride = null) {
    const c = clientOverride || data.clientMap.get(p?.client_id) || {};
    const missingDocs = (data.docItems || []).filter(d => d.process_id === p?.id && d.status === 'pendente' && d.required).map(d => d.name);
    const pend = missingDocs.length ? missingDocs : (data.tasks || []).filter(t => t.process_id === p?.id && t.responsible_party === 'cliente' && t.status === 'aberta').map(t => t.title);
    return {
      contato: (c.contact_name || '').split(' ')[0] || 'tudo bem', empresa: c.legal_name || 'sua empresa', codigo: p?.public_code || '', titulo: p?.title || '',
      etapa: data.stageMap?.get(p?.current_stage_id)?.name || '', pendencias: pend.length ? pend.join('; ') : '(descrever)', exigencia: '', protocolo: '', documento: '', vencimento: '', ...extra
    };
  }

  function communicationForm(data, p, key = 'etapa', extra = {}, clientOverride = null) {
    const c = clientOverride || data.clientMap.get(p?.client_id) || {};
    const vars = commVars(data, p, extra, c);
    const t = MESSAGE_TEMPLATES[key] || MESSAGE_TEMPLATES.etapa;
    return `<form id="lx-comm-form" class="modal-form-grid" data-key="${h(key)}">
      <div class="field"><label>Modelo</label><select id="lx-cm-tpl">${Object.entries(MESSAGE_TEMPLATES).map(([k, v]) => `<option value="${k}" ${k === key ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
      <div class="field"><label>Destinatário</label><input id="lx-cm-to" value="${h(c.contact_name || c.legal_name || '')}"></div>
      <div class="field"><label>WhatsApp</label><input id="lx-cm-phone" inputmode="tel" value="${h(c.phone || '')}" placeholder="(13) 99999-9999"></div>
      <div class="field"><label>E-mail</label><input id="lx-cm-email" type="email" value="${h(c.email || '')}"></div>
      <div class="field span-2"><label>Assunto</label><input id="lx-cm-subject" value="${h(fillTemplate(t.subject, vars))}"></div>
      <div class="field span-2"><label>Mensagem</label><textarea id="lx-cm-body" rows="6">${h(fillTemplate(t.body, vars))}</textarea></div>
      <div class="span-2 lx-notice">O envio abre o seu WhatsApp ou e-mail com a mensagem pronta — sem custo de API. O ATLAS registra a comunicação no histórico do processo.</div>
      <div class="modal-actions span-2"><button type="button" class="btn btn-muted" id="lx-cm-copy">Copiar texto</button><button type="button" class="btn btn-muted" id="lx-cm-mail">Abrir e-mail</button><button type="button" class="btn btn-primary" id="lx-cm-wa">Enviar por WhatsApp</button></div>
      <div id="lx-cm-msg" class="auth-message hidden span-2"></div>
    </form>`;
  }

  function bindCommunicationForm(data, p, extra = {}, clientOverride = null) {
    const c = clientOverride || data.clientMap.get(p?.client_id) || {};
    $('#lx-cm-tpl')?.addEventListener('change', e => {
      const t = MESSAGE_TEMPLATES[e.target.value]; const vars = commVars(data, p, extra, c);
      $('#lx-cm-subject').value = fillTemplate(t.subject, vars); $('#lx-cm-body').value = fillTemplate(t.body, vars);
    });
    const log = async channel => {
      if (!schemaReady && !db()) return;
      const recipient = channel === 'whatsapp' ? $('#lx-cm-phone').value.trim() : $('#lx-cm-email').value.trim();
      const { error } = await db().from('communications').insert({ process_id: p?.id || null, client_id: c.id || p?.client_id || null, channel, recipient, template_key: $('#lx-cm-tpl').value, subject: $('#lx-cm-subject').value.trim(), body: $('#lx-cm-body').value.trim(), status: 'aberto_no_app', sent_at: new Date().toISOString() });
      if (error) console.warn('ATLAS: comunicação não registrada', error.message);
    };
    $('#lx-cm-copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#lx-cm-body').value); toast('Texto copiado.'); } catch { toast('Não foi possível copiar.', 'bad'); } });
    $('#lx-cm-wa')?.addEventListener('click', async () => {
      let phone = digits($('#lx-cm-phone').value);
      if (!phone) return msgBox('#lx-cm-msg', 'Informe o WhatsApp do cliente.');
      if (phone.length <= 11) phone = '55' + phone;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent($('#lx-cm-body').value)}`, '_blank', 'noopener');
      await log('whatsapp'); msgBox('#lx-cm-msg', 'WhatsApp aberto e comunicação registrada.', 'success');
    });
    $('#lx-cm-mail')?.addEventListener('click', async () => {
      const to = $('#lx-cm-email').value.trim();
      if (!to) return msgBox('#lx-cm-msg', 'Informe o e-mail do cliente.');
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent($('#lx-cm-subject').value)}&body=${encodeURIComponent($('#lx-cm-body').value)}`;
      await log('email'); msgBox('#lx-cm-msg', 'E-mail aberto e comunicação registrada.', 'success');
    });
  }

  async function openCommunicationModal(processId, key = 'etapa', extra = {}, clientOverride = null) {
    const data = await loadCentral();
    const p = processId ? data.processMap.get(processId) : null;
    shell('Comunicar cliente', communicationForm(data, p, key, extra, clientOverride), true);
    bindCommunicationForm(data, p, extra, clientOverride);
  }

  /* ================================================================
     8. ACOMPANHAMENTO DO CLIENTE (perfil Cliente)
     ================================================================ */
  async function clientFollowUpPage() {
    setHeadSafe('Acompanhamento', 'MEUS PROCESSOS', 'Veja em que etapa estão os seus processos e o que depende de você.');
    loading('Carregando acompanhamento...');
    const data = await loadCentral();
    const procs = data.processes.filter(p => !['cancelled'].includes(p.status));
    if (!procs.length) { pageSafe(`<section class="lx-card">${empty('Nenhum processo vinculado', 'Quando o escritório abrir um processo para a sua empresa, ele aparecerá aqui.')}</section>`); return; }
    pageSafe(procs.map(p => {
      const tasks = (data.tasks || []).filter(t => t.process_id === p.id && t.status !== 'desconsiderada');
      const done = tasks.filter(t => t.status === 'concluida').length;
      const pct = tasks.length ? Math.round(done / tasks.length * 100) : (p.status === 'completed' ? 100 : 0);
      const mine = tasks.filter(t => t.responsible_party === 'cliente' && t.status === 'aberta');
      const reqs = (data.requirements || []).filter(r => r.process_id === p.id && ['aberta', 'em_atendimento'].includes(r.status));
      return `<section class="lx-card lx-client-proc">
        <header><div><strong>${h(p.public_code || '')}</strong><h2>${h(p.title || 'Processo')}</h2><span>${h(clientName(data, p.client_id))} · etapa ${h(data.stageMap.get(p.current_stage_id)?.name || '—')}</span></div><div class="lx-progress-wrap"><div class="lx-progress"><i style="width:${pct}%"></i></div><small>${pct}% concluído</small></div></header>
        ${mine.length ? `<div class="lx-notice warn"><strong>Depende de você:</strong> ${mine.map(t => h(t.title)).join(' · ')}</div>` : ''}
        ${reqs.length ? `<div class="lx-notice"><strong>Exigências em tratamento pelo escritório:</strong> ${reqs.map(r => h(r.description)).join(' · ')}</div>` : ''}
        ${tasks.length ? `<ol class="lx-client-steps">${tasks.map(t => `<li class="${t.status}"><b>${t.status === 'concluida' ? '✓' : ''}</b><span>${h(t.title)}</span><small>${t.status === 'concluida' ? 'Concluída ' + brDateTime(t.completed_at).split(',')[0] : t.status === 'impedida' ? 'Aguardando' : 'Previsão ' + br(t.target_date)}</small></li>`).join('')}</ol>` : '<p class="muted">O checklist deste processo será publicado pelo escritório.</p>'}
      </section>`;
    }).join(''));
  }

  /* ================================================================
     9. MONITOR DE CNPJ DA CARTEIRA (base pública, custo zero)
     ================================================================ */
  const MONITOR_FN = 'https://oorpvbxxpbxoaaykrtcf.supabase.co/functions/v1/atlas-legalizacao-cnpj-monitor';
  const monFilters = { view: 'all', text: '' };

  async function monitorPage() {
    setHeadSafe('Monitor de CNPJ', 'CARTEIRA', 'Verificação semanal automática da situação na Receita, sócios, endereço, atividades e Simples de todas as empresas.');
    loading('Carregando monitoramento...');
    const base = await loadCentral();
    const snaps = await q('client_registry_snapshots', t => t.select('id,client_id,source,payload,fetched_at').in('source', ['monitor', 'monitor_erro', 'monitor_falha']).order('fetched_at', { ascending: false }).limit(5000));
    renderMonitor(base, snaps.data || []);
  }

  function renderMonitor(data, snaps) {
    const valid = (data.clients || []).filter(c => digits(c.tax_id).length === 14);
    const latest = new Map(), latestErr = new Map(), changes = [];
    const since = addDays(todayISO(), -30);
    snaps.forEach(s => {
      if (s.source === 'monitor') {
        if (!latest.has(s.client_id)) latest.set(s.client_id, s);
        if ((s.payload?.alteracoes || []).length && String(s.fetched_at).slice(0, 10) >= since) changes.push(s);
      } else if (!latestErr.has(s.client_id)) latestErr.set(s.client_id, s);
    });
    const rows = valid.map(c => {
      const snap = latest.get(c.id), err = latestErr.get(c.id);
      const errNewer = err && (!snap || err.fetched_at > snap.fetched_at);
      const p = snap?.payload || {};
      const sit = p.situacao || '';
      return { c, snap, err: errNewer ? err : null, sit, irregular: !!sit && sit !== 'ATIVA', changed: changes.some(x => x.client_id === c.id) };
    });
    const monitored = rows.filter(r => r.snap).length;
    const irregular = rows.filter(r => r.irregular);
    const waiting = rows.filter(r => !r.snap && !r.err).length;
    const errors = rows.filter(r => r.err && /NAO_ENCONTRADO|CNPJ_INVALIDO/.test(r.err.payload?.erro || ''));
    const list = rows.filter(r => {
      if (monFilters.view === 'irregular' && !r.irregular) return false;
      if (monFilters.view === 'changed' && !r.changed) return false;
      if (monFilters.view === 'error' && !r.err) return false;
      if (monFilters.view === 'waiting' && (r.snap || r.err)) return false;
      if (monFilters.text && !norm([r.c.legal_name, r.c.trade_name, r.c.tax_id].join(' ')).includes(norm(monFilters.text))) return false;
      return true;
    }).sort((a, b) => (b.irregular - a.irregular) || (b.changed - a.changed) || a.c.legal_name.localeCompare(b.c.legal_name, 'pt-BR'));
    const sitBadge = r => r.err && !r.snap ? badge(r.err.payload?.erro === 'NAO_ENCONTRADO' ? 'Não encontrado' : r.err.payload?.erro === 'CNPJ_INVALIDO' ? 'CNPJ inválido' : 'Falha na consulta', r.err.payload?.erro === 'FALHA_CONSULTA' ? 'neutral' : 'bad') : !r.snap ? badge('Aguardando', 'neutral') : badge(r.sit || '—', r.irregular ? 'bad' : 'ok');

    pageSafe(`
      <div class="lx-kpis">
        ${kpi('Monitoradas', `${monitored}/${valid.length}`, waiting ? `${waiting} aguardando 1ª verificação` : 'Carteira completa')}
        ${kpi('Situação irregular', irregular.length, 'Inapta, suspensa ou baixada', irregular.length ? 'bad' : 'ok')}
        ${kpi('Alterações em 30 dias', new Set(changes.map(c => c.client_id)).size, 'Sócios, endereço, CNAE, Simples', changes.length ? 'warn' : '')}
        ${kpi('Cadastro a conferir', errors.length, 'CNPJ não localizado ou inválido', errors.length ? 'warn' : '')}
      </div>
      ${changes.length ? `<section class="lx-card"><div class="lx-section-head"><h2>Alterações detectadas</h2><span>Últimos 30 dias</span></div>
        <div class="lx-mon-changes">${changes.slice(0, 30).map(s => { const c = data.clientMap.get(s.client_id); return `<article><header><strong>${h(c?.legal_name || 'Empresa')}</strong><time>${brDateTime(s.fetched_at).split(',')[0]}</time></header>${(s.payload.alteracoes || []).map(a => `<div class="lx-mon-diff ${a.grave ? 'grave' : ''}"><span>${h(a.campo)}</span><del>${h(String(a.antes).slice(0, 220))}</del><ins>${h(String(a.depois).slice(0, 220))}</ins></div>`).join('')}</article>`; }).join('')}</div></section>` : ''}
      <section class="lx-card">
        <div class="lx-toolbar">
          <input id="lx-mon-search" type="search" placeholder="Buscar empresa ou CNPJ" value="${h(monFilters.text)}">
          <select id="lx-mon-view">${[['all', 'Todas as empresas'], ['irregular', 'Situação irregular'], ['changed', 'Com alterações (30 dias)'], ['error', 'Cadastro a conferir'], ['waiting', 'Aguardando verificação']].map(([k, v]) => `<option value="${k}" ${monFilters.view === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <div class="lx-toolbar-actions">${canEdit() ? '<button class="btn btn-primary" type="button" id="lx-mon-run">Verificar agora</button>' : ''}</div>
        </div>
        <div class="lx-notice" style="margin-top:12px">A verificação roda sozinha de hora em hora, em pequenos lotes, e cada empresa é conferida a cada 7 dias na base pública da Receita (BrasilAPI / CNPJws). Mudanças viram aviso no sino.</div>
        ${list.length ? `<div class="lx-table-wrap"><table class="lx-table"><thead><tr><th>Empresa</th><th>CNPJ</th><th>Situação</th><th>Simples / MEI</th><th>Sócios</th><th>Última verificação</th><th></th></tr></thead><tbody>${list.map(r => { const p = r.snap?.payload || {}; return `<tr>
          <td data-label="Empresa"><strong>${h(r.c.legal_name)}</strong>${r.changed ? ' ' + badge('Alterada', 'warn') : ''}${p.motivo_situacao && r.irregular ? `<div class="muted">${h(p.motivo_situacao)}</div>` : ''}</td>
          <td data-label="CNPJ" class="lx-mono">${h(r.c.tax_id || '')}</td>
          <td data-label="Situação">${sitBadge(r)}</td>
          <td data-label="Simples / MEI">${h([p.simples ? 'Simples: ' + p.simples : '', p.mei === 'SIM' ? 'MEI' : ''].filter(Boolean).join(' · ') || '—')}</td>
          <td data-label="Sócios">${(p.socios || []).length || '—'}</td>
          <td data-label="Última verificação">${r.snap ? brDateTime(r.snap.fetched_at).split(',')[0] : r.err ? brDateTime(r.err.fetched_at).split(',')[0] : '—'}</td>
          <td><div class="lx-row-actions">${r.snap ? `<button class="mini-btn" type="button" data-lx-mon-view="${h(r.c.id)}">Ver cadastro</button>` : ''}${canEdit() && (r.irregular || r.changed) ? `<button class="mini-btn" type="button" data-lx-mon-req="${h(r.c.id)}">Registrar exigência</button>` : ''}</div></td>
        </tr>`; }).join('')}</tbody></table></div>` : empty('Nenhuma empresa nesse filtro', valid.length ? 'Ajuste o filtro acima.' : 'Cadastre o CNPJ das empresas para iniciar o monitoramento.')}
      </section>`);

    $('#lx-mon-search')?.addEventListener('input', e => { monFilters.text = e.target.value; clearTimeout(renderMonitor._t); renderMonitor._t = setTimeout(() => { renderMonitor(data, snaps); const i = $('#lx-mon-search'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }, 250); });
    $('#lx-mon-view')?.addEventListener('change', e => { monFilters.view = e.target.value; renderMonitor(data, snaps); });
    $('#lx-mon-run')?.addEventListener('click', () => runMonitorNow());
    $$('[data-lx-mon-view]').forEach(b => b.addEventListener('click', () => { const r = rows.find(x => x.c.id === b.dataset.lxMonView); if (r) showRegistry(r.c, r.snap); }));
    $$('[data-lx-mon-req]').forEach(b => b.addEventListener('click', () => {
      const r = rows.find(x => x.c.id === b.dataset.lxMonReq); if (!r) return;
      const alts = (changes.find(x => x.client_id === r.c.id)?.payload?.alteracoes || []).map(a => a.campo).join(', ');
      openRequirementModal(data, null, monitorPage, { client_id: r.c.id, agency: 'Receita Federal', description: r.irregular ? `Regularizar situação cadastral ${r.sit} na Receita Federal${r.snap?.payload?.motivo_situacao ? ' (' + r.snap.payload.motivo_situacao + ')' : ''}` : `Conferir e atualizar cadastro: alteração detectada em ${alts}` });
    }));
  }

  function showRegistry(c, snap) {
    const p = snap?.payload || {};
    const row = (k, v) => `<div><span>${h(k)}</span><strong>${h(v || '—')}</strong></div>`;
    shell(c.legal_name, `<div class="lx-panel-head lx-registry">
      ${row('Situação', p.situacao)}${row('Desde', p.data_situacao ? br(p.data_situacao) : '')}${row('Motivo', p.motivo_situacao)}${row('Natureza jurídica', p.natureza)}
      ${row('Capital social', p.capital_social ? Number(p.capital_social).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '')}${row('Simples / MEI', [p.simples && 'Simples: ' + p.simples, p.mei && 'MEI: ' + p.mei].filter(Boolean).join(' · '))}
      ${row('CNAE principal', p.cnae_principal)}${row('Fonte', p.fonte)}
    </div>
    <div class="lx-section-head"><h2>Endereço</h2></div><p style="font-size:13px">${h(String(p.endereco || '—').split(' | ').join(', '))}</p>
    <div class="lx-section-head"><h2>Quadro de sócios</h2><span>${(p.socios || []).length}</span></div>
    <ul class="lx-plain-list">${(p.socios || []).map(s => `<li>${h(s)}</li>`).join('') || '<li class="muted">Não informado pela fonte.</li>'}</ul>
    <div class="lx-section-head"><h2>CNAEs secundários</h2><span>${(p.cnaes_secundarios || []).length}</span></div>
    <p class="lx-mono" style="font-size:12px">${h((p.cnaes_secundarios || []).join(', ') || '—')}</p>
    <p class="muted" style="font-size:11.5px;margin-top:12px">Verificado em ${brDateTime(snap?.fetched_at)}. Dados públicos do CNPJ; para atos formais, confirme no portal da Receita Federal.</p>`, true);
  }

  async function runMonitorNow() {
    const btn = $('#lx-mon-run'); if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }
    try {
      const { data: { session } } = await db().auth.getSession();
      if (!session?.access_token) throw new Error('Sessão expirada. Entre novamente.');
      const res = await fetch(MONITOR_FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ limit: 10 }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error === 'unauthorized' ? 'Apenas Administrador ou Operação podem verificar.' : 'A verificação falhou. Tente de novo em instantes.');
      toast(out.checked ? `${out.checked} empresa(s) verificada(s)${out.changes ? `, ${out.changes} alteração(ões)` : ''}. ${out.remaining ? `Faltam ${out.remaining} — clique de novo ou aguarde a rotina automática.` : 'Carteira em dia.'}` : 'Todas as empresas já foram verificadas nos últimos 7 dias.');
      await monitorPage();
    } catch (err) { toast(err.message || String(err), 'bad'); if (btn) { btn.disabled = false; btn.textContent = 'Verificar agora'; } }
  }

  /* ================================================================
     10. EDITOR DE MODELOS (checklist + documentos por serviço)
     ================================================================ */
  async function templatesPage() {
    setHeadSafe('Modelos de serviço', 'CONFIGURAÇÃO', 'Crie e ajuste os modelos de checklist e a lista de documentos de cada tipo de serviço do escritório.');
    loading('Carregando modelos...');
    const res = await q('task_templates', t => t.select('*').order('name'));
    if (res.error) { pageSafe(`<div class="error-box">Não foi possível carregar os modelos: ${h(res.error.message)}</div>`); return; }
    const list = res.data;
    pageSafe(`<section class="lx-card">
      <div class="lx-section-head"><h2>Modelos cadastrados</h2><div class="lx-row-actions">${canEdit() ? '<button class="btn btn-primary" type="button" id="lx-tpl-new">＋ Novo modelo</button>' : ''}</div></div>
      <div class="lx-notice">Ao aplicar um modelo a um processo, o ATLAS cria as tarefas (com data meta contada a partir do início) e a lista de documentos a receber. Alterar um modelo não muda processos que já têm checklist.</div>
      ${list.length ? `<div class="lx-tpl-cards">${list.map(t => `<article class="lx-tpl-card ${t.active ? '' : 'off'}">
        <header><strong>${h(t.name)}</strong>${t.active ? '' : badge('Inativo', 'neutral')}</header>
        <div class="lx-task-meta"><span>${(t.items || []).length} tarefas</span><span>${(t.documents || []).length} documentos</span><span>${(t.items || []).length ? 'até ' + Math.max(...(t.items || []).map(i => Number(i.offset) || 0)) + ' dias' : 'sem prazos'}</span></div>
        <small class="muted">${BUILTIN_TYPES.includes(t.service_type) ? 'Modelo padrão do ATLAS' : t.service_type ? 'Escolhido quando o processo menciona: ' + h(t.service_type) : 'Sem palavras-chave'}</small>
        ${canEdit() ? `<div class="lx-row-actions" style="justify-content:flex-start;margin-top:8px"><button class="mini-btn" type="button" data-lx-tpl-edit="${h(t.id)}">Editar</button><button class="mini-btn" type="button" data-lx-tpl-dup="${h(t.id)}">Duplicar</button><button class="mini-btn" type="button" data-lx-tpl-toggle="${h(t.id)}">${t.active ? 'Desativar' : 'Ativar'}</button></div>` : ''}
      </article>`).join('')}</div>` : empty('Nenhum modelo', 'Crie o primeiro modelo de serviço do escritório.')}
    </section>`);
    $('#lx-tpl-new')?.addEventListener('click', () => openTemplateEditor(null, list));
    $$('[data-lx-tpl-edit]').forEach(b => b.addEventListener('click', () => openTemplateEditor(list.find(t => t.id === b.dataset.lxTplEdit), list)));
    $$('[data-lx-tpl-dup]').forEach(b => b.addEventListener('click', () => { const t = list.find(x => x.id === b.dataset.lxTplDup); openTemplateEditor({ ...t, id: null, name: t.name + ' (cópia)', service_type: BUILTIN_TYPES.includes(t.service_type) ? '' : t.service_type }, list); }));
    $$('[data-lx-tpl-toggle]').forEach(b => b.addEventListener('click', async () => {
      const t = list.find(x => x.id === b.dataset.lxTplToggle);
      const { error } = await db().from('task_templates').update({ active: !t.active }).eq('id', t.id);
      if (error) return toast(error.message, 'bad');
      toast(t.active ? 'Modelo desativado.' : 'Modelo ativado.'); templatesPage();
    }));
  }

  function openTemplateEditor(t, list) {
    const state = {
      items: JSON.parse(JSON.stringify(t?.items || [{ title: '', phase: 'Briefing', party: 'escritorio', offset: 1 }])),
      documents: JSON.parse(JSON.stringify(t?.documents || []))
    };
    const builtin = t && BUILTIN_TYPES.includes(t.service_type);
    shell(t?.id ? 'Editar modelo' : 'Novo modelo', `<form id="lx-te-form" class="modal-form-grid">
      <div class="field span-2"><label>Nome do modelo *</label><input id="lx-te-name" required maxlength="120" value="${h(t?.name || '')}" placeholder="Ex.: Inventário extrajudicial"></div>
      <div class="field span-2"><label>Palavras-chave para escolha automática</label><input id="lx-te-keys" ${builtin ? 'disabled' : ''} value="${h(builtin ? 'Modelo padrão (' + t.service_type + ')' : (t?.service_type || ''))}" placeholder="Ex.: inventário, partilha, espólio"><small class="muted">${builtin ? 'Modelos padrão já são escolhidos pelo tipo do processo.' : 'Quando o título ou tipo do processo tiver uma dessas palavras, este modelo é sugerido.'}</small></div>
      <div class="span-2"><div class="lx-section-head"><h2>Tarefas</h2><button class="mini-btn" type="button" id="lx-te-add-item">＋ Tarefa</button></div><div id="lx-te-items"></div></div>
      <div class="span-2"><div class="lx-section-head"><h2>Documentos a receber</h2><button class="mini-btn" type="button" id="lx-te-add-doc">＋ Documento</button></div><div id="lx-te-docs"></div></div>
      <div class="modal-actions span-2"><button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button><button class="btn btn-primary" type="submit" id="lx-te-save">Salvar modelo</button></div>
      <div id="lx-te-msg" class="auth-message hidden span-2"></div>
    </form>`, true);
    const phases = ['Briefing', 'Viabilidade', 'DBE / Receita', 'Registro', 'Inscrições', 'Licenciamento', 'Cartório', 'Tributos', 'Conclusão'];
    const drawItems = () => {
      $('#lx-te-items').innerHTML = state.items.map((i, idx) => `<div class="lx-te-row">
        <span class="lx-te-n">${idx + 1}</span>
        <input data-i="${idx}" data-k="title" value="${h(i.title)}" placeholder="Descrição da tarefa" class="lx-te-title">
        <input data-i="${idx}" data-k="phase" list="lx-te-phases" value="${h(i.phase || '')}" placeholder="Fase">
        <select data-i="${idx}" data-k="party">${Object.entries(PARTY).map(([k, v]) => `<option value="${k}" ${(i.party || 'escritorio') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <label class="lx-te-days"><input data-i="${idx}" data-k="offset" type="number" min="0" max="365" value="${h(i.offset ?? 0)}"><span>dias</span></label>
        <div class="lx-te-btns"><button type="button" class="mini-btn" data-mv="${idx}" data-d="-1" aria-label="Subir" ${idx === 0 ? 'disabled' : ''}>↑</button><button type="button" class="mini-btn" data-mv="${idx}" data-d="1" aria-label="Descer" ${idx === state.items.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="mini-btn" data-rm="${idx}" aria-label="Remover">×</button></div>
      </div>`).join('') + `<datalist id="lx-te-phases">${phases.map(p => `<option value="${p}">`).join('')}</datalist>` || '<p class="muted">Nenhuma tarefa.</p>';
      $$('#lx-te-items [data-k]').forEach(el => el.addEventListener('input', e => { const it = state.items[+e.target.dataset.i]; it[e.target.dataset.k] = e.target.dataset.k === 'offset' ? Number(e.target.value || 0) : e.target.value; }));
      $$('#lx-te-items [data-mv]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.mv, j = i + Number(b.dataset.d); [state.items[i], state.items[j]] = [state.items[j], state.items[i]]; drawItems(); }));
      $$('#lx-te-items [data-rm]').forEach(b => b.addEventListener('click', () => { state.items.splice(+b.dataset.rm, 1); drawItems(); }));
    };
    const drawDocs = () => {
      $('#lx-te-docs').innerHTML = state.documents.length ? state.documents.map((d, idx) => `<div class="lx-te-row doc">
        <input data-d="${idx}" data-k="name" value="${h(d.name)}" placeholder="Nome do documento" class="lx-te-title">
        <select data-d="${idx}" data-k="category">${DOC_CATEGORIES.map(c => `<option ${(d.category || 'Documento pessoal') === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <label class="lx-te-opt"><input type="checkbox" data-d="${idx}" data-k="required" ${d.required !== false ? 'checked' : ''}> Obrigatório</label>
        <div class="lx-te-btns"><button type="button" class="mini-btn" data-rmd="${idx}" aria-label="Remover">×</button></div>
      </div>`).join('') : '<p class="muted" style="font-size:12.5px">Nenhum documento. Adicione o que o cliente precisa enviar para este serviço.</p>';
      $$('#lx-te-docs [data-k]').forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', e => { const d = state.documents[+e.target.dataset.d]; d[e.target.dataset.k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; }));
      $$('#lx-te-docs [data-rmd]').forEach(b => b.addEventListener('click', () => { state.documents.splice(+b.dataset.rmd, 1); drawDocs(); }));
    };
    drawItems(); drawDocs();
    $('#lx-te-add-item').addEventListener('click', () => { const last = state.items[state.items.length - 1]; state.items.push({ title: '', phase: last?.phase || 'Briefing', party: 'escritorio', offset: (Number(last?.offset) || 0) + 2 }); drawItems(); $$('#lx-te-items .lx-te-title').pop()?.focus(); });
    $('#lx-te-add-doc').addEventListener('click', () => { state.documents.push({ name: '', category: 'Documento pessoal', required: true }); drawDocs(); $$('#lx-te-docs .lx-te-title').pop()?.focus(); });
    $('#lx-te-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#lx-te-name').value.trim();
      const items = state.items.map(i => ({ title: String(i.title || '').trim(), phase: String(i.phase || '').trim() || null, party: PARTY[i.party] ? i.party : 'escritorio', offset: Math.max(0, Math.min(365, Number(i.offset) || 0)) })).filter(i => i.title.length >= 2);
      const documents = state.documents.map(d => ({ name: String(d.name || '').trim(), category: d.category || 'Documento pessoal', required: d.required !== false })).filter(d => d.name.length >= 2);
      if (name.length < 3) return msgBox('#lx-te-msg', 'Dê um nome ao modelo.');
      if (!items.length) return msgBox('#lx-te-msg', 'Inclua ao menos uma tarefa.');
      if ((list || []).some(x => x.id !== t?.id && norm(x.name) === norm(name))) return msgBox('#lx-te-msg', 'Já existe um modelo com esse nome.');
      const payload = { name, items, documents };
      if (!builtin) payload.service_type = $('#lx-te-keys').value.trim() || null;
      const btn = $('#lx-te-save'); btn.disabled = true; btn.textContent = 'Salvando...';
      const { error } = t?.id ? await db().from('task_templates').update(payload).eq('id', t.id) : await db().from('task_templates').insert({ ...payload, organization_id: profile().organization_id, active: true });
      if (error) { btn.disabled = false; btn.textContent = 'Salvar modelo'; return msgBox('#lx-te-msg', error.message); }
      closeModal(); toast('Modelo salvo.'); templatesPage();
    });
  }

  /* ================================================================
     Integração com o restante do ATLAS
     ================================================================ */
  const PAGES = { modelos: templatesPage, monitor: monitorPage, tarefas: tasksPage, protocolos: protocolsPage, exigencias: requirementsPage, certidoes: certificatesPage, agenda: agendaPage };

  function installRouter() {
    const prev = window.render;
    if (typeof prev !== 'function' || prev.__lxV8) return;
    const wrapped = function (pageName) {
      if (PAGES[pageName]) { document.getElementById('app-shell')?.setAttribute('data-v6-page', pageName); return PAGES[pageName](); }
      return prev.apply(this, arguments);
    };
    wrapped.__lxV8 = true;
    window.render = wrapped;
  }

  // Botão "Checklist" ao lado de cada "Abrir" / "Editar" de processo nas telas existentes.
  function decorateProcessButtons(root = document) {
    root.querySelectorAll('button[onclick*="openAtlasV4Process("], button[onclick*="openProcessModal(\'"]').forEach(btn => {
      const m = /\('([0-9a-f-]{36})'\)/i.exec(btn.getAttribute('onclick') || ''); if (!m) return;
      const host = btn.parentElement; if (!host || host.querySelector(`[data-lx-checklist="${m[1]}"]`)) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mini-btn lx-checklist-btn'; b.dataset.lxChecklist = m[1]; b.textContent = 'Checklist';
      b.addEventListener('click', ev => { ev.stopPropagation(); openPanel(m[1]); });
      btn.insertAdjacentElement('afterend', b);
    });
  }

  function observeContent() {
    const content = document.getElementById('page-content');
    if (!content || !window.MutationObserver) return;
    let pending = false;
    new MutationObserver(() => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; decorateProcessButtons(content); }); }).observe(content, { childList: true, subtree: true });
    const modal = document.getElementById('atlas-modal-root');
    if (modal) new MutationObserver(() => decorateProcessButtons(modal)).observe(modal, { childList: true, subtree: true });
  }

  function syncClientNav() {
    const btn = document.querySelector('#nav .nav-item[data-page="tarefas"]');
    if (!btn) return;
    const label = btn.querySelectorAll('span'); const last = label[label.length - 1];
    if (last) last.textContent = isClient() ? 'Acompanhamento' : 'Tarefas';
  }

  function injectStyles() {
    if (document.getElementById('atlas-central-v8-css')) return;
    const link = document.createElement('link');
    link.id = 'atlas-central-v8-css'; link.rel = 'stylesheet'; link.href = '/central-legalizacao-v8.css?v=' + VERSION;
    document.head.appendChild(link);
  }

  function init() {
    injectStyles();
    installRouter();
    observeContent();
    syncClientNav();
    const userName = document.getElementById('user-name');
    if (userName && window.MutationObserver) new MutationObserver(syncClientNav).observe(userName, { childList: true, characterData: true, subtree: true });
    // Garante o roteador mesmo se outra camada redefinir window.render depois.
    setTimeout(installRouter, 0); setTimeout(installRouter, 600); setTimeout(installRouter, 2000);
  }

  window.AtlasCentralV8 = { version: VERSION, openPanel, openCommunicationModal, pages: PAGES, __test: { matchDocItem, licenseState, taskDeadlineState, parseFlexibleDate, addDays, diffDays, fillTemplate, guessTemplate, agendaEvents, csv } };
  window.openLegalizacaoPanel = openPanel;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
