/* ATLAS · Financeiro V9.3 — honorários parcelados, gestão por mês de apuração e relatório de apuração.
   Cada parcela é um lançamento em costs (fee_kind='honorarios'), com metadata.installment = {n,total}.
   A situação é calculada: sem baixa e com vencimento anterior a hoje => "Vencido". */
(() => {
  const TZ = 'America/Sao_Paulo';
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const REPORT_LOGO = '/assets/oea-cartilha-logo.png?v=3.57';
  const REPORT_BRAND = 'OEA · Organização Excelência Assessoria';

  // ---------------- funções puras (testadas) ----------------
  const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const isFee = c => !!c && (c.fee_kind === 'honorarios' || c.metadata?.kind === 'service_fee' || c.metadata?.kind === 'hourly' || c.cost_type === 'hourly');
  const isPaid = c => c?.payment_status === 'paid';
  const day = v => (v ? String(v).slice(0, 10) : '');
  const cents = v => Math.round(Number(v || 0) * 100);

  function addMonths(iso, k) {
    const [y, m, d] = String(iso).split('-').map(Number);
    const target = new Date(Date.UTC(y, m - 1 + k, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, last));
    return target.toISOString().slice(0, 10);
  }

  // Divide o total em n parcelas mensais; os centavos que sobram vão para a 1ª parcela.
  function splitInstallments(total, n, firstDue) {
    n = Math.max(1, Math.round(Number(n) || 1));
    const t = cents(total), base = Math.floor(t / n), rest = t - base * n;
    return Array.from({ length: n }, (_, i) => ({ n: i + 1, amount: (base + (i === 0 ? rest : 0)) / 100, due_date: firstDue ? addMonths(firstDue, i) : '' }));
  }

  function daysBetween(a, b) { return Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000); }

  // Situação de um honorário: paid | late | open | nodue
  function feeState(c, today = todayISO()) {
    if (isPaid(c)) return 'paid';
    if (!c.due_date) return 'nodue';
    return day(c.due_date) < today ? 'late' : 'open';
  }

  // Mês de apuração (competência) = mês do vencimento; recebido sem vencimento cai no mês do recebimento.
  const refMonth = c => (day(c.due_date) || (isPaid(c) ? day(c.paid_at) : '')).slice(0, 7);

  const installmentLabel = c => {
    const it = c?.metadata?.installment;
    if (it?.n && it?.total) return `${it.n}/${it.total}`;
    const m = String(c?.description || '').match(/parcela\s+(\d+)\s*\/\s*(\d+)/i);
    return m ? `${m[1]}/${m[2]}` : 'Única';
  };

  function apuracao(costs, ym, today = todayISO()) {
    const fees = (costs || []).filter(isFee);
    const sum = arr => arr.reduce((n, c) => n + cents(c.amount), 0) / 100;
    const monthStart = ym + '-01';
    const month = fees.filter(c => refMonth(c) === ym);
    const paid = month.filter(isPaid);
    const late = month.filter(c => feeState(c, today) === 'late');
    const open = month.filter(c => feeState(c, today) === 'open');
    const cash = fees.filter(c => isPaid(c) && day(c.paid_at).slice(0, 7) === ym);
    const cashOther = cash.filter(c => refMonth(c) !== ym);
    const carried = fees.filter(c => !isPaid(c) && c.due_date && day(c.due_date) < monthStart);
    const noDue = fees.filter(c => feeState(c, today) === 'nodue');
    return {
      ym, today, month, paid, late, open, cash, cashOther, carried, noDue,
      total: sum(month), totalPaid: sum(paid), totalLate: sum(late), totalOpen: sum(open),
      totalCash: sum(cash), totalCashOther: sum(cashOther), totalCarried: sum(carried), totalNoDue: sum(noDue),
      rate: month.length ? Math.round(sum(paid) / Math.max(0.01, sum(month)) * 100) : null
    };
  }

  const money = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const br = v => { const s = day(v); if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
  const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} de ${y}`; };
  const cap = v => v.charAt(0).toUpperCase() + v.slice(1);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function stateBadge(c, today) {
    const s = feeState(c, today);
    if (s === 'paid') return '<span class="pill ok">Recebido</span>';
    if (s === 'late') { const d = daysBetween(today, day(c.due_date)); return `<span class="pill bad">Vencido · ${d} dia${d === 1 ? '' : 's'}</span>`; }
    if (s === 'nodue') return '<span class="pill neutral">Sem vencimento</span>';
    const d = daysBetween(day(c.due_date), today);
    return `<span class="pill warn">${d === 0 ? 'Vence hoje' : `A vencer · ${d} dia${d === 1 ? '' : 's'}`}</span>`;
  }

  // ---------------- dados ----------------
  const db = () => (typeof window.atlasDb === 'function' ? window.atlasDb() : window.atlasAuth?.client);
  async function loadData() {
    const c = db();
    const [costs, procs, clients] = await Promise.all([
      c.from('costs').select('*'),
      c.from('processes').select('id,public_code,title,client_id,status'),
      c.from('clients').select('id,legal_name,tax_id,phone')
    ]);
    const processMap = new Map((procs.data || []).map(p => [p.id, p]));
    const clientMap = new Map((clients.data || []).map(x => [x.id, x]));
    return { costs: costs.data || [], processMap, clientMap };
  }
  const procOf = (D, c) => D.processMap.get(c.process_id) || {};
  const clientOf = (D, c) => D.clientMap.get(procOf(D, c).client_id) || {};
  const canEdit = () => (window.atlasHasPermission ? window.atlasHasPermission('costs.edit') !== false : true);

  // ---------------- tela ----------------
  let state = { ym: null, filter: 'todos' };
  try { const saved = sessionStorage.getItem('atlas.finYm'); if (/^\d{4}-\d{2}$/.test(saved || '')) state.ym = saved; } catch (_) {}

  function monthOptions(current) {
    const now = todayISO().slice(0, 7), set = new Set();
    for (let i = -24; i <= 12; i++) set.add(addMonths(now + '-01', i).slice(0, 7));
    set.add(current);
    return [...set].sort().reverse().map(ym => `<option value="${ym}" ${ym === current ? 'selected' : ''}>${cap(monthLabel(ym))}${ym === now ? ' (mês atual)' : ''}</option>`).join('');
  }

  function rowHtml(D, c, today) {
    const p = procOf(D, c), cl = clientOf(D, c), st = feeState(c, today);
    const actions = !canEdit() ? '' : st === 'paid'
      ? `<button class="mini-btn" type="button" data-fx="undo" data-id="${esc(c.id)}">Desfazer</button>`
      : `<span class="fx-receive"><input type="date" class="fx-date" value="${today}" max="${today}" aria-label="Data do recebimento"><button class="mini-btn fx-ok" type="button" data-fx="receive" data-id="${esc(c.id)}">Recebido</button></span>`;
    return `<tr class="fx-${st}">
      <td>${br(c.due_date)}</td>
      <td><strong>${esc(p.public_code || '—')}</strong><div class="muted">${esc(p.title || '')}</div></td>
      <td><strong>${esc(cl.legal_name || '—')}</strong>${c.payer_name && c.payer_name !== cl.legal_name ? `<div class="muted">Pagador: ${esc(c.payer_name)}</div>` : ''}</td>
      <td>${esc(installmentLabel(c))}</td>
      <td class="fx-num"><strong>${money(c.amount)}</strong></td>
      <td>${stateBadge(c, today)}</td>
      <td>${isPaid(c) ? br(c.paid_at) : '—'}</td>
      <td><div class="row-actions">${actions}<button class="mini-btn" type="button" data-fx="edit" data-pid="${esc(c.process_id)}">Editar</button></div></td>
    </tr>`;
  }

  function table(D, list, today, empty) {
    if (!list.length) return `<div class="muted fx-empty">${empty}</div>`;
    const sorted = [...list].sort((a, b) => day(a.due_date || a.paid_at).localeCompare(day(b.due_date || b.paid_at)) || String(procOf(D, a).public_code).localeCompare(String(procOf(D, b).public_code)));
    return `<div class="table-wrap"><table class="fx-table"><thead><tr><th>Vencimento</th><th>Processo</th><th>Empresa</th><th>Parcela</th><th class="fx-num">Valor</th><th>Situação</th><th>Recebido em</th><th>Ações</th></tr></thead><tbody>${sorted.map(c => rowHtml(D, c, today)).join('')}</tbody></table></div>`;
  }

  function sectionHtml(D) {
    const today = todayISO();
    const ym = state.ym || today.slice(0, 7);
    const A = apuracao(D.costs, ym, today);
    const filters = { todos: A.month, aberto: A.open, vencido: A.late, recebido: A.paid };
    const list = filters[state.filter] || A.month;
    const chip = (k, label, n) => `<button type="button" class="fx-chip ${state.filter === k ? 'active' : ''}" data-fx-filter="${k}">${label} <b>${n}</b></button>`;
    const kpi = (label, value, sub, tone = '') => `<div class="surface kpi fx-kpi ${tone}"><span class="kpi-label">${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
    return `
      <div class="section-head fx-head">
        <div><h2>Honorários · gestão mensal</h2><span>Apuração pelo mês de vencimento de cada parcela. Sem baixa até o vencimento, a parcela passa a constar como vencida.</span></div>
        <div class="fx-tools">
          <button type="button" class="mini-btn" data-fx-step="-1" aria-label="Mês anterior">‹</button>
          <select id="fx-month" aria-label="Mês de apuração">${monthOptions(ym)}</select>
          <button type="button" class="mini-btn" data-fx-step="1" aria-label="Próximo mês">›</button>
          <button type="button" class="btn btn-primary" id="fx-pdf">Relatório de apuração (PDF)</button>
          <button type="button" class="btn btn-muted" id="fx-csv">Planilha</button>
        </div>
      </div>
      <div class="grid kpi-grid finance-kpis fx-kpis">
        ${kpi('Previsto no mês', money(A.total), `${A.month.length} parcela(s) com vencimento em ${MONTHS[Number(ym.slice(5)) - 1]}`)}
        ${kpi('Recebido', money(A.totalPaid), A.rate === null ? 'Nada previsto no mês' : `${A.rate}% do previsto`, 'ok')}
        ${kpi('A vencer', money(A.totalOpen), `${A.open.length} parcela(s)`, A.open.length ? 'warn' : '')}
        ${kpi('Vencido', money(A.totalLate), `${A.late.length} parcela(s) sem baixa`, A.late.length ? 'bad' : '')}
      </div>
      <div class="fx-cash">Entrou no caixa em ${monthLabel(ym)}: <strong>${money(A.totalCash)}</strong>${A.cashOther.length ? ` · inclui ${money(A.totalCashOther)} de parcelas de outros meses` : ''}</div>
      ${A.noDue.length ? `<div class="fx-alert"><strong>${A.noDue.length} honorário(s) em aberto sem data de vencimento (${money(A.totalNoDue)}).</strong> Sem a data, eles não entram na apuração mensal nem viram vencidos. Abra o processo e informe o vencimento. <button type="button" class="mini-btn" data-fx-toggle="nodue">Ver lista</button><div class="fx-collapse" data-fx-box="nodue" hidden>${table(D, A.noDue, today, '')}</div></div>` : ''}
      ${A.carried.length ? `<div class="fx-alert bad"><strong>${A.carried.length} parcela(s) vencida(s) de meses anteriores ainda sem baixa (${money(A.totalCarried)}).</strong> <button type="button" class="mini-btn" data-fx-toggle="carried">Ver lista</button><div class="fx-collapse" data-fx-box="carried" hidden>${table(D, A.carried, today, '')}</div></div>` : ''}
      <div class="fx-chips">${chip('todos', 'Todas do mês', A.month.length)}${chip('aberto', 'A vencer', A.open.length)}${chip('vencido', 'Vencidas', A.late.length)}${chip('recebido', 'Recebidas', A.paid.length)}</div>
      ${table(D, list, today, `Nenhuma parcela ${state.filter === 'todos' ? 'com vencimento' : 'nesta situação'} em ${monthLabel(ym)}.`)}`;
  }

  async function render(host, D) {
    host.innerHTML = sectionHtml(D);
    host.querySelector('#fx-month')?.addEventListener('change', ev => { setMonth(ev.target.value); render(host, D); });
    host.querySelectorAll('[data-fx-step]').forEach(b => b.addEventListener('click', () => { setMonth(addMonths((state.ym || todayISO().slice(0, 7)) + '-01', Number(b.dataset.fxStep)).slice(0, 7)); render(host, D); }));
    host.querySelectorAll('[data-fx-filter]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.fxFilter; render(host, D); }));
    host.querySelectorAll('[data-fx-toggle]').forEach(b => b.addEventListener('click', () => { const box = host.querySelector(`[data-fx-box="${b.dataset.fxToggle}"]`); if (box) { box.hidden = !box.hidden; b.textContent = box.hidden ? 'Ver lista' : 'Ocultar'; } }));
    host.querySelector('#fx-pdf')?.addEventListener('click', async ev => {
      const b = ev.currentTarget; b.disabled = true; const t = b.textContent; b.textContent = 'Gerando...';
      try { await buildPdf(D, state.ym || todayISO().slice(0, 7)); } catch (err) { alert('Não foi possível gerar o relatório: ' + (err.message || err)); }
      b.disabled = false; b.textContent = t;
    });
    host.querySelector('#fx-csv')?.addEventListener('click', () => exportCsv(D, state.ym || todayISO().slice(0, 7)));
    host.__fxD = D;
    cardTables(host);
    if (!host.__fxBound) { host.__fxBound = true; host.addEventListener('click', ev => onAction(host, ev)); }
  }
  async function onAction(host, ev) {
    const b = ev.target.closest('[data-fx]'); if (!b || !host.contains(b)) return;
    const D = host.__fxD, act = b.dataset.fx;
    if (act === 'edit') { if (typeof window.openProcessModal === 'function') window.openProcessModal(b.dataset.pid); return; }
    let patch;
    if (act === 'receive') {
      const date = b.closest('.fx-receive')?.querySelector('.fx-date')?.value || todayISO();
      if (date > todayISO()) return alert('A data do recebimento não pode ser futura.');
      patch = { payment_status: 'paid', paid_at: date };
    } else if (act === 'undo') {
      if (!confirm('Desfazer a baixa desta parcela? Ela volta a constar como a receber/vencida.')) return;
      patch = { payment_status: 'pending', paid_at: null };
    } else return;
    b.disabled = true;
    const { error } = await db().from('costs').update(patch).eq('id', b.dataset.id);
    if (error) { b.disabled = false; return alert('Não foi possível atualizar: ' + error.message); }
    D.costs.filter(c => c.id === b.dataset.id).forEach(row => Object.assign(row, patch));
    render(host, D);
  }
  function setMonth(ym) { state.ym = ym; state.filter = 'todos'; try { sessionStorage.setItem('atlas.finYm', ym); } catch (_) {} }

  // Tabelas viram cartões quando a área é estreita (tela dividida / notebook): rótulo de cada coluna em data-label
  function cardTables(root) {
    root?.querySelectorAll('.table-wrap > table').forEach(tb => {
      const heads = [...tb.querySelectorAll('thead th')].map(th => th.textContent.trim());
      tb.classList.add('fx-cards');
      tb.closest('.surface')?.classList.add('fx-host');
      tb.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (!td.dataset.label && heads[i]) td.dataset.label = heads[i]; }));
    });
  }
  window.addEventListener?.('atlas:fx-rendered', () => cardTables(document.getElementById('page-content')));

  async function enhance() {
    const root = document.getElementById('page-content');
    cardTables(root);
    const old = root?.querySelector('.honorarios-control');
    if (!old || old.dataset.fx === '1') return;
    old.dataset.fx = '1';
    old.classList.add('fx-section');
    old.innerHTML = '<div class="loading-box"><span class="spinner"></span><div>Carregando honorários...</div></div>';
    try { render(old, await loadData()); }
    catch (err) { old.innerHTML = `<div class="fx-alert bad">Não foi possível carregar os honorários: ${esc(err.message || err)}</div>`; }
  }

  // ---------------- relatório (PDF) ----------------
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (window.jspdf?.jsPDF) return res();
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('falha ao carregar o gerador de PDF')); document.head.appendChild(s);
    });
  }
  function imageDataUrl(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { try { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); resolve({ url: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight }); } catch (_) { resolve(null); } };
      img.onerror = () => resolve(null); img.src = src;
    });
  }
  function download(name, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  async function buildPdf(D, ym) {
    await loadScript(JSPDF_CDN);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const today = todayISO();
    const A = apuracao(D.costs, ym, today);
    const label = monthLabel(ym);
    const W = 210, M = 14, CW = W - M * 2, BOTTOM = 280;
    const NAVY = [8, 40, 81], BLUE = [13, 94, 168], MUTED = [99, 119, 148], LINE = [216, 228, 240], RED = [180, 35, 24], WARN = [168, 93, 0], OKC = [15, 138, 95];
    let y = M;
    const logo = await imageDataUrl(REPORT_LOGO);
    const t = (txt, x, yy, size = 10, color = NAVY, style = 'normal', align) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); doc.text(String(txt), x, yy, align ? { align } : undefined); };
    const ensure = need => { if (y + need > BOTTOM) { doc.addPage(); y = M + 4; } };
    const section = (title, sub) => { ensure(18); y += 3; doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 6; t(title.toUpperCase(), M, y, 9.5, BLUE, 'bold'); if (sub) t(sub, W - M, y, 8, MUTED, 'normal', 'right'); y += 5; };
    const kpis = items => {
      const n = items.length, gap = 3, w = (CW - gap * (n - 1)) / n; ensure(22);
      items.forEach((k, i) => {
        const x = M + i * (w + gap);
        doc.setFillColor(244, 248, 252); doc.setDrawColor(...LINE); doc.roundedRect(x, y, w, 19, 2, 2, 'FD');
        doc.setFillColor(...(k.color || BLUE)); doc.rect(x, y + 2, 1.2, 15, 'F');
        t(k.label.toUpperCase(), x + 4, y + 5.5, 6.6, MUTED, 'bold');
        t(k.value, x + 4, y + 12, 11.5, k.color || NAVY, 'bold');
        if (k.sub) t(doc.splitTextToSize(k.sub, w - 6)[0], x + 4, y + 16.5, 6.8, MUTED);
      });
      y += 23;
    };
    const cols = [{ h: 'Venc.', w: 0.1 }, { h: 'Processo', w: 0.14 }, { h: 'Empresa', w: 0.32 }, { h: 'Parc.', w: 0.07 }, { h: 'Valor', w: 0.13, r: 1 }, { h: 'Situação', w: 0.12 }, { h: 'Recebido', w: 0.12 }];
    const stateText = c => { const s = feeState(c, today); return s === 'paid' ? 'Recebido' : s === 'late' ? `Vencido ${daysBetween(today, day(c.due_date))}d` : s === 'nodue' ? 'Sem venc.' : 'A vencer'; };
    const stateColor = c => ({ paid: OKC, late: RED, open: WARN, nodue: MUTED })[feeState(c, today)];
    const table = (list, totalLabel) => {
      if (!list.length) { t('Sem lançamentos.', M, y + 1, 9, MUTED); y += 7; return; }
      const sorted = [...list].sort((a, b) => day(a.due_date || a.paid_at).localeCompare(day(b.due_date || b.paid_at)));
      const head = () => { ensure(12); doc.setFillColor(244, 248, 252); doc.rect(M, y - 3.8, CW, 6, 'F'); let x = M + 1.5; cols.forEach(c => { const w = CW * c.w; t(c.h.toUpperCase(), c.r ? x + w - 3 : x, y, 6.8, MUTED, 'bold', c.r ? 'right' : undefined); x += w; }); y += 6; };
      head();
      sorted.forEach(c => {
        if (y + 6.5 > BOTTOM) { doc.addPage(); y = M + 4; head(); }
        const p = procOf(D, c), cl = clientOf(D, c);
        const cells = [br(c.due_date), p.public_code || '—', cl.legal_name || '—', installmentLabel(c), money(c.amount), stateText(c), isPaid(c) ? br(c.paid_at) : '—'];
        let x = M + 1.5;
        cells.forEach((v, i) => { const col = cols[i], w = CW * col.w; const txt = doc.splitTextToSize(String(v), w - 3)[0]; t(txt, col.r ? x + w - 3 : x, y, 8.2, i === 5 ? stateColor(c) : NAVY, i === 5 || i === 4 ? 'bold' : 'normal', col.r ? 'right' : undefined); x += w; });
        doc.setDrawColor(...LINE); doc.line(M, y + 2.2, W - M, y + 2.2); y += 6;
      });
      const total = list.reduce((n, c) => n + cents(c.amount), 0) / 100;
      ensure(8); t(totalLabel || 'Total', M + 1.5, y + 1, 8.6, NAVY, 'bold'); t(money(total), M + CW * 0.76 - 1.5, y + 1, 8.6, NAVY, 'bold', 'right'); y += 8;
    };

    // Cabeçalho
    if (logo) { const hh = 15; doc.addImage(logo.url, 'PNG', M, y - 2, logo.w / logo.h * hh, hh); }
    t(REPORT_BRAND, M + 30, y + 3.5, 10.5, NAVY, 'bold');
    t(`Relatório de apuração de honorários · ${label}`, M + 30, y + 9.5, 10, BLUE, 'bold');
    t(`Situação em ${br(today)}`, W - M, y + 3.5, 8.5, MUTED, 'bold', 'right');
    t('Uso interno', W - M, y + 9.5, 8, MUTED, 'normal', 'right');
    y += 20;

    section('Resumo do mês', `competência = mês de vencimento`);
    kpis([
      { label: 'Previsto no mês', value: money(A.total), sub: `${A.month.length} parcela(s)` },
      { label: 'Recebido', value: money(A.totalPaid), sub: A.rate === null ? '—' : `${A.rate}% do previsto`, color: OKC },
      { label: 'A vencer', value: money(A.totalOpen), sub: `${A.open.length} parcela(s)`, color: A.open.length ? WARN : NAVY },
      { label: 'Vencido', value: money(A.totalLate), sub: `${A.late.length} sem baixa`, color: A.late.length ? RED : OKC }
    ]);
    kpis([
      { label: 'Entrada de caixa no mês', value: money(A.totalCash), sub: 'pela data de recebimento', color: OKC },
      { label: 'De outros meses', value: money(A.totalCashOther), sub: `${A.cashOther.length} parcela(s)` },
      { label: 'Vencidos anteriores', value: money(A.totalCarried), sub: `${A.carried.length} em aberto`, color: A.carried.length ? RED : OKC },
      { label: 'Sem vencimento', value: money(A.totalNoDue), sub: `${A.noDue.length} a regularizar`, color: A.noDue.length ? WARN : OKC }
    ]);

    section(`Parcelas com vencimento em ${label}`);
    table(A.month, 'Total previsto no mês');
    if (A.late.length) { section('Vencidas no mês sem baixa'); table(A.late, 'Total vencido no mês'); }
    if (A.cashOther.length) { section(`Recebidas em ${label} de outros meses`); table(A.cashOther, 'Total recebido de outros meses'); }
    if (A.carried.length) { section('Vencidas de meses anteriores ainda em aberto'); table(A.carried, 'Total em atraso acumulado'); }
    if (A.noDue.length) { section('Honorários em aberto sem vencimento (regularizar)'); table(A.noDue, 'Total sem vencimento'); }

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setDrawColor(...LINE); doc.line(M, 286, W - M, 286);
      t(`ATLAS Legalização · apuração de honorários de ${label} · gerado em ${br(today)}`, M, 290, 7.4, MUTED);
      t(`${i}/${pages}`, W - M, 290, 7.4, MUTED, 'normal', 'right');
    }
    download(`Apuracao-honorarios-${ym}.pdf`, doc.output('blob'));
    return A;
  }

  // ---------------- planilha (CSV para Excel) ----------------
  function csvRows(D, ym, today = todayISO()) {
    const A = apuracao(D.costs, ym, today);
    const lines = [['Grupo', 'Vencimento', 'Processo', 'Empresa', 'CNPJ', 'Parcela', 'Valor', 'Situação', 'Recebido em', 'Pagador']];
    const add = (group, list) => list.forEach(c => { const p = procOf(D, c), cl = clientOf(D, c); const st = feeState(c, today); lines.push([group, br(c.due_date), p.public_code || '', cl.legal_name || '', cl.tax_id || '', installmentLabel(c), Number(c.amount || 0).toFixed(2).replace('.', ','), { paid: 'Recebido', late: 'Vencido', open: 'A vencer', nodue: 'Sem vencimento' }[st], isPaid(c) ? br(c.paid_at) : '', c.payer_name || '']); });
    add(`Vencimento em ${monthLabel(ym)}`, A.month);
    add('Recebido no mês (outros meses)', A.cashOther);
    add('Vencido de meses anteriores', A.carried);
    add('Sem vencimento', A.noDue);
    return lines;
  }
  function exportCsv(D, ym) {
    const text = csvRows(D, ym).map(r => r.map(v => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n');
    download(`Apuracao-honorarios-${ym}.csv`, new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  }

  // ---------------- integração ----------------
  if (typeof window.costPage === 'function' && !window.costPage.__fx) {
    const prev = window.costPage;
    const wrapped = async function (...args) { const out = await prev.apply(this, args); await enhance(); return out; };
    wrapped.__fx = true;
    window.costPage = wrapped;
  }
  if (typeof document !== 'undefined' && !document.getElementById('fx-css')) {
    const link = document.createElement('link'); link.id = 'fx-css'; link.rel = 'stylesheet'; link.href = '/financeiro-apuracao.css?v=9.4';
    document.head?.appendChild(link);
  }

  window.AtlasFinanceiro = { version: '9.4', splitInstallments, addMonths, feeState, refMonth, apuracao, installmentLabel, csvRows, buildPdf, enhance };
})();
