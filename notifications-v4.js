(() => {
  const state = { items: [], profileId: null, channel: null, panel: null, initialized: false };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const formatCount = (n) => n > 99 ? '99+' : String(Math.max(0, Number(n) || 0));
  const mergeById = (current, incoming) => {
    const map = new Map((current || []).map((item) => [item.id, item]));
    for (const item of (incoming || [])) if (item?.id) map.set(item.id, { ...(map.get(item.id) || {}), ...item });
    return [...map.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  };
  const countUnread = (items) => (items || []).filter((item) => !item.read_at).length;
  const db = () => window.atlasAuth?.client || null;
  const profile = () => window.atlasAuth?.getProfile?.() || null;
  const bell = () => document.getElementById('atlas-notification-bell') || document.querySelector('.top-actions .bell');
  const badge = () => document.getElementById('atlas-notification-count');

  function ensureBell() {
    const b = bell();
    if (!b) return null;
    if (!b.id) b.id = 'atlas-notification-bell';
    b.type = 'button';
    b.setAttribute('aria-label', 'Notificações');
    if (!b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false');
    let count = document.getElementById('atlas-notification-count');
    if (!count) {
      count = document.createElement('span');
      count.id = 'atlas-notification-count';
      count.className = 'atlas-notification-count';
      count.hidden = true;
      count.textContent = '0';
      b.appendChild(count);
    }
    return b;
  }

  function ensurePanel() {
    if (state.panel?.isConnected) return state.panel;
    const panel = document.createElement('section');
    panel.id = 'atlas-notification-panel';
    panel.className = 'notification-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Central de notificações');
    panel.innerHTML = '<div class="notification-panel-head"><div><strong>Notificações</strong><small id="atlas-notification-summary">Financeiro</small></div><button id="atlas-mark-all-read" type="button" class="notification-link">Marcar todas como lidas</button></div><div id="atlas-notification-list" class="notification-list"></div>';
    document.body.appendChild(panel);
    state.panel = panel;
    document.getElementById('atlas-mark-all-read')?.addEventListener('click', () => markAllRead());
    return panel;
  }

  function positionPanel() {
    const b = bell(), p = state.panel;
    if (!b || !p) return;
    const r = b.getBoundingClientRect();
    if (window.innerWidth <= 760) {
      p.style.top = `${Math.max(64, r.bottom + 8)}px`;
      p.style.right = '12px';
      p.style.left = '12px';
    } else {
      p.style.top = `${r.bottom + 10}px`;
      p.style.right = `${Math.max(16, window.innerWidth - r.right)}px`;
      p.style.left = 'auto';
    }
  }

  function render() {
    const unread = countUnread(state.items);
    const b = badge();
    if (b) { b.textContent = formatCount(unread); b.hidden = unread === 0; }
    const summary = document.getElementById('atlas-notification-summary');
    if (summary) summary.textContent = unread ? `${unread} não lida${unread === 1 ? '' : 's'}` : 'Tudo em dia';
    const host = document.getElementById('atlas-notification-list');
    if (!host) return;
    if (!state.items.length) { host.innerHTML = '<div class="notification-empty">Nenhuma notificação.</div>'; return; }
    host.innerHTML = state.items.map((item) => {
      const when = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '—';
      const body = esc(item.body || '').replace(/\n/g, '<br>');
      const actions = [];
      if (item.process_id) actions.push(`<button type="button" class="notification-action" data-notification-process="${esc(item.process_id)}" data-notification-id="${esc(item.id)}">Abrir processo</button>`);
      if (!item.read_at) actions.push(`<button type="button" class="notification-action secondary" data-notification-read="${esc(item.id)}">Marcar como lida</button>`);
      return `<article class="notification-item ${item.read_at ? '' : 'unread'}" data-notification-row="${esc(item.id)}"><div class="notification-dot" aria-hidden="true"></div><div class="notification-content"><strong>${esc(item.title || 'Notificação')}</strong><p>${body}</p><small>${esc(when)}</small>${actions.length ? `<div class="notification-actions">${actions.join('')}</div>` : ''}</div></article>`;
    }).join('');
    host.querySelectorAll('[data-notification-read]').forEach((btn) => btn.addEventListener('click', () => markRead(btn.dataset.notificationRead)));
    host.querySelectorAll('[data-notification-process]').forEach((btn) => btn.addEventListener('click', () => openProcess(btn.dataset.notificationProcess, btn.dataset.notificationId)));
  }

  async function refresh() {
    const p = profile(), client = db();
    if (!p?.id || !client) return [];
    state.profileId = p.id;
    const { data, error } = await client.from('atlas_notifications')
      .select('id,recipient_profile_id,event_type,title,body,process_id,client_id,cost_id,metadata,read_at,created_at')
      .eq('recipient_profile_id', p.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) { console.error('ATLAS notificações:', error); return state.items; }
    state.items = mergeById([], data || []);
    ensurePanel();
    render();
    return state.items;
  }

  async function markRead(id) {
    const p = profile(), client = db();
    if (!id || !p?.id || !client) return false;
    const stamp = new Date().toISOString();
    const { error } = await client.from('atlas_notifications').update({ read_at: stamp }).eq('id', id).eq('recipient_profile_id', p.id);
    if (error) { console.error('ATLAS notificações:', error); return false; }
    state.items = state.items.map((item) => item.id === id && !item.read_at ? { ...item, read_at: stamp } : item);
    render();
    return true;
  }

  async function markAllRead() {
    const p = profile(), client = db();
    if (!p?.id || !client) return false;
    const stamp = new Date().toISOString();
    const { error } = await client.from('atlas_notifications').update({ read_at: stamp }).eq('recipient_profile_id', p.id).is('read_at', null);
    if (error) { console.error('ATLAS notificações:', error); return false; }
    state.items = state.items.map((item) => item.read_at ? item : { ...item, read_at: stamp });
    render();
    return true;
  }

  function closePanel() {
    if (!state.panel) return;
    state.panel.hidden = true;
    bell()?.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    const p = ensurePanel();
    p.hidden = !p.hidden;
    bell()?.setAttribute('aria-expanded', String(!p.hidden));
    if (!p.hidden) { positionPanel(); refresh(); }
  }

  function openProcess(processId, notificationId) {
    if (notificationId) markRead(notificationId);
    closePanel();
    const fn = window.openAtlasV4Process || (typeof window.openProcessModal === 'function' ? window.openProcessModal : null);
    if (typeof fn === 'function' && processId) fn(processId);
  }

  function unsubscribe() {
    const client = db();
    if (state.channel && client?.removeChannel) client.removeChannel(state.channel);
    state.channel = null;
  }

  function subscribe(profileId) {
    const client = db();
    if (!client || !profileId) return;
    unsubscribe();
    state.channel = client.channel(`atlas-notifications-${profileId}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'atlas_notifications', filter:`recipient_profile_id=eq.${profileId}` }, (payload) => {
        const row = payload?.new;
        if (!row?.id) return;
        state.items = mergeById(state.items, [row]);
        ensurePanel();
        render();
      })
      .subscribe();
  }

  async function syncProfile() {
    const p = profile();
    if (!p?.id) {
      if (state.profileId) { state.items = []; state.profileId = null; unsubscribe(); render(); closePanel(); }
      return false;
    }
    if (state.profileId !== p.id) {
      state.items = [];
      state.profileId = p.id;
      subscribe(p.id);
      await refresh();
    }
    return true;
  }

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    const b = ensureBell();
    if (!b) return;
    ensurePanel();
    b.addEventListener('click', (ev) => { ev.stopPropagation(); togglePanel(); });
    document.addEventListener('click', (ev) => { if (state.panel && !state.panel.hidden && !state.panel.contains(ev.target) && !b.contains(ev.target)) closePanel(); });
    window.addEventListener('resize', () => { if (state.panel && !state.panel.hidden) positionPanel(); });
    await syncProfile();
    setInterval(syncProfile, 1000);
    db()?.auth?.onAuthStateChange?.((event) => {
      if (event === 'SIGNED_OUT') syncProfile();
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setTimeout(syncProfile, 0);
    });
  }

  window.AtlasNotificationsV4 = { init, refresh, markRead, markAllRead, openProcess, __test: { formatCount, mergeById, countUnread } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
