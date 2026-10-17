(() => {
  const Data = window.AtlasOpsV71Data;
  const Engine = window.AtlasOpsV71Engine;
  const CENTRAL_PAGE = 'central-operacional';
  let renderHooked = false;

  const e = value => typeof window.esc === 'function'
    ? window.esc(value)
    : String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function hasPermission(key) {
    return typeof window.atlasHasPermission === 'function' ? window.atlasHasPermission(key) : false;
  }

  function canManageTeams() {
    return hasPermission('teams.manage');
  }

  function ensureCentralNavItem() {
    const nav = document.querySelector('#nav');
    if (!nav || nav.querySelector('[data-page="central-operacional"]')) return;
    const processItem = nav.querySelector('[data-page="processos"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item';
    button.dataset.page = CENTRAL_PAGE;
    button.dataset.roles = 'admin,operacao,financeiro,auditoria';
    button.innerHTML = '<span class="nav-ico">◎</span><span>Central Operacional</span>';
    if (processItem) nav.insertBefore(button, processItem);
    else nav.appendChild(button);
    button.addEventListener('click', () => {
      if (!hasPermission('operations.view')) return;
      nav.querySelectorAll('[data-page]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      if (typeof window.render === 'function') window.render(CENTRAL_PAGE);
    });
    window.atlasPermissions?.apply?.();
  }

  function pageHtml(html) {
    if (typeof window.page === 'function') return window.page(html);
    const host = document.getElementById('page-content');
    if (host) host.innerHTML = html;
  }

  function setPageHead(title,kicker,description) {
    if (typeof window.setHead === 'function') return window.setHead(title,kicker,description);
    const titleEl = document.getElementById('page-title');
    const kickerEl = document.getElementById('page-kicker');
    const descEl = document.getElementById('page-desc');
    if (titleEl) titleEl.textContent = title;
    if (kickerEl) kickerEl.textContent = kicker;
    if (descEl) descEl.textContent = description;
  }

  async function centralOperationalPage() {
    setPageHead('Central Operacional','OPERAÇÃO','Prioridades, tarefas, bloqueios e SLA em uma única visão.');
    if (!hasPermission('operations.view')) {
      pageHtml('<div class="error-box">Seu perfil não possui acesso à Central Operacional.</div>');
      return;
    }
    const capability = await Data?.capabilities?.() || {available:false,reason:'adapter_unavailable'};
    if (!capability.available) {
      pageHtml(`<section class="surface pad"><div class="section-head"><div><h2>Central Operacional</h2><span>ATLAS 7.1</span></div></div><div class="v71-capability-note"><strong>Recurso preparado para homologação</strong><p>A estrutura operacional ainda não está ativa neste banco. Os módulos atuais do ATLAS continuam funcionando normalmente.</p></div></section>`);
      return;
    }
    pageHtml('<section class="surface pad"><div class="section-head"><div><h2>Central Operacional</h2><span>Carregando operação...</span></div></div><div class="loading-box"><span class="spinner"></span><div>Preparando tarefas e SLA...</div></div></section>');
  }

  function installRenderHook() {
    if (renderHooked || typeof window.render !== 'function') return false;
    const legacyRender = window.render;
    window.render = function(pageName) {
      if (pageName === CENTRAL_PAGE) return centralOperationalPage();
      return legacyRender(pageName);
    };
    renderHooked = true;
    return true;
  }

  function modal(body) {
    const shell = window.modalShell || (typeof window.modalShell === 'function' ? window.modalShell : null);
    if (typeof shell === 'function') {
      shell('Ativar Central Operacional', body);
      return document.querySelector('#atlas-modal-root') || document;
    }
    const root = document.getElementById('atlas-modal-root');
    if (!root) return document;
    root.innerHTML = `<div class="modal-backdrop"><div class="atlas-modal"><div class="atlas-modal-body">${body}</div></div></div>`;
    return root;
  }

  function closeActivationModal() {
    if (typeof window.closeAtlasModal === 'function') window.closeAtlasModal();
    else {
      const root = document.getElementById('atlas-modal-root');
      if (root) root.innerHTML = '';
    }
  }

  function activationHtml(processId,templates) {
    const rows = templates.length ? templates.map(template => `
      <label class="v71-activation-task">
        <input type="checkbox" data-v71-template-id="${e(template.id)}" checked>
        <span><strong>${e(template.title)}</strong><small>${template.required ? 'Obrigatória' : 'Opcional'} · ${e(template.priority || 'normal')}</small></span>
      </label>`).join('') : '<div class="v71-empty">Nenhuma tarefa automática está configurada para esta etapa.</div>';
    return `<div class="v71-activation-review" data-v71-activation-process="${e(processId)}">
      <h3>Revisar tarefas propostas</h3>
      <p>Confira as tarefas antes de ativar a Central Operacional neste processo. Nada será criado até sua confirmação.</p>
      <div class="v71-activation-list">${rows}</div>
      <div class="v71-activation-actions">
        <button type="button" class="btn btn-muted" data-v71-activate-cancel>Cancelar</button>
        <button type="button" class="btn btn-primary" data-v71-activate-confirm>Ativar Central Operacional neste processo</button>
      </div>
    </div>`;
  }

  async function previewLegacyActivation(processId) {
    if (!hasPermission('workflow.advance')) throw new Error('Sem permissão para ativar a Central Operacional');
    const detail = await Data.loadProcess(processId);
    if (!detail?.available) throw new Error('ATLAS 7.1 ainda não está disponível neste ambiente');
    if (detail.operation) return {alreadyActive:true,operation:detail.operation};
    const stageId = detail.process?.current_stage_id;
    if (!stageId) throw new Error('O processo precisa possuir uma etapa atual antes da ativação');
    const templates = await Data.loadTaskTemplates(stageId);
    const root = modal(activationHtml(processId,templates));
    root.querySelector?.('[data-v71-activate-cancel]')?.addEventListener('click',closeActivationModal);
    root.querySelector?.('[data-v71-activate-confirm]')?.addEventListener('click',async event => {
      event.currentTarget.disabled = true;
      try { await confirmLegacyActivation(processId,root); }
      finally { event.currentTarget.disabled = false; }
    });
    return {alreadyActive:false,stageId,templates};
  }

  async function confirmLegacyActivation(processId,root=document) {
    const templateIds = [...root.querySelectorAll?.('[data-v71-template-id]:checked') || []]
      .map(input => input.dataset.v71TemplateId)
      .filter(Boolean);
    const result = await Engine.activateProcess(processId,templateIds);
    closeActivationModal();
    document.dispatchEvent?.(new CustomEvent('atlas:v71:activation-complete',{detail:{processId,templateIds}}));
    return result;
  }

  function legacyActivationButton(processId) {
    if (!hasPermission('workflow.advance')) return '';
    return `<button class="btn btn-primary" type="button" data-v71-legacy-activate="${e(processId)}">Ativar Central Operacional neste processo</button>`;
  }

  function bindLegacyActivation(root=document) {
    root.querySelectorAll?.('[data-v71-legacy-activate]').forEach(button => {
      if (button.dataset.v71Bound === '1') return;
      button.dataset.v71Bound = '1';
      button.addEventListener('click',() => previewLegacyActivation(button.dataset.v71LegacyActivate));
    });
  }

  function teamsControl() {
    return canManageTeams() ? '<button type="button" class="btn btn-muted" data-v71-team-manage>Gerenciar equipes</button>' : '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureCentralNavItem();
    installRenderHook();
    bindLegacyActivation(document);
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      ensureCentralNavItem();
      if (installRenderHook() || tries > 20) clearInterval(timer);
    }, 150);
  });

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-v71-legacy-activate]');
    if (button && button.dataset.v71Bound !== '1') previewLegacyActivation(button.dataset.v71LegacyActivate);
  });

  window.AtlasOpsV71UI = Object.freeze({
    ensureCentralNavItem,
    centralOperationalPage,
    previewLegacyActivation,
    confirmLegacyActivation,
    legacyActivationButton,
    bindLegacyActivation,
    canManageTeams,
    teamsControl
  });
})();
