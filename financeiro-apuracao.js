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
    const paidYm = c => (day(c.paid_at) || refMonth(c)).slice(0, 7);
    const month = fees.filter(c => refMonth(c) === ym);
    const paid = month.filter(isPaid);
    const paidIn = paid.filter(c => paidYm(c) === ym);       // pagas dentro do mês
    const paidLater = paid.filter(c => paidYm(c) > ym);      // pagas depois do mês (entram no caixa do mês seguinte)
    const paidEarly = paid.filter(c => paidYm(c) < ym);      // pagas antes (antecipadas)
    const late = month.filter(c => feeState(c, today) === 'late');
    const open = month.filter(c => feeState(c, today) === 'open');
    const cash = fees.filter(c => isPaid(c) && paidYm(c) === ym);
    const cashOther = cash.filter(c => refMonth(c) !== ym);
    const cashFromPast = cashOther.filter(c => refMonth(c) < ym);
    const cashFromFuture = cashOther.filter(c => refMonth(c) > ym);
    const carried = fees.filter(c => !isPaid(c) && c.due_date && day(c.due_date) < monthStart);
    const noDue = fees.filter(c => feeState(c, today) === 'nodue');
    return {
      ym, today, month, paid, paidIn, paidLater, paidEarly, late, open, cash, cashOther, cashFromPast, cashFromFuture, carried, noDue,
      total: sum(month), totalPaid: sum(paid), totalPaidIn: sum(paidIn), totalPaidLater: sum(paidLater), totalPaidEarly: sum(paidEarly),
      totalLate: sum(late), totalOpen: sum(open),
      totalCash: sum(cash), totalCashOther: sum(cashOther), totalCashFromPast: sum(cashFromPast), totalCashFromFuture: sum(cashFromFuture),
      totalCarried: sum(carried), totalNoDue: sum(noDue),
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
          <button type="button" class="btn btn-primary" id="fx-pdf">Relatório para a gestão (PDF)</button>
          <button type="button" class="btn btn-muted" id="fx-csv">Planilha</button>
        </div>
      </div>
      <div class="grid kpi-grid finance-kpis fx-kpis">
        ${kpi('Previsto no mês', money(A.total), `${A.month.length} parcela(s) com vencimento em ${MONTHS[Number(ym.slice(5)) - 1]}`)}
        ${kpi('Recebido', money(A.totalPaid), A.rate === null ? 'Nada previsto no mês' : `${A.rate}% do previsto` + (A.paidLater.length ? ` · ${money(A.totalPaidLater)} pago depois do mês` : ''), 'ok')}
        ${kpi('A vencer', money(A.totalOpen), `${A.open.length} parcela(s)`, A.open.length ? 'warn' : '')}
        ${kpi('Vencido', money(A.totalLate), `${A.late.length} parcela(s) sem baixa`, A.late.length ? 'bad' : '')}
      </div>
      <div class="fx-cash">Entrou no caixa em ${monthLabel(ym)} (pela data do pagamento): <strong>${money(A.totalCash)}</strong>${A.cashOther.length ? ` · inclui ${money(A.totalCashOther)} de parcelas de outros meses` : ''}${A.paidLater.length ? ` · ${money(A.totalPaidLater)} das parcelas deste mês foram pagos depois e entram no caixa do mês do pagamento` : ''}</div>
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
    const label = monthLabel(ym), mName = MONTHS[Number(ym.slice(5)) - 1];
    const W = 210, M = 14, CW = W - M * 2, BOTTOM = 280;
    const NAVY = [8, 40, 81], BLUE = [13, 94, 168], MUTED = [99, 119, 148], LINE = [216, 228, 240], RED = [180, 35, 24], WARN = [168, 93, 0], OKC = [15, 138, 95], SOFT = [244, 248, 252];
    let y = M;
    const logo = await imageDataUrl(REPORT_LOGO);
    const t = (txt, x, yy, size = 10, color = NAVY, style = 'normal', align) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); doc.text(String(txt), x, yy, align ? { align } : undefined); };
    const ensure = need => { if (y + need > BOTTOM) { doc.addPage(); y = M + 4; } };
    const count = n => `${n} parcela${n === 1 ? '' : 's'}`;

    const cap = v => v.charAt(0).toUpperCase() + v.slice(1);
    const pct = (a, b) => (b > 0 ? Math.round(a / b * 100) : 0);
    const pl = (n, a, b) => `${n} ${n === 1 ? a : b}`;
    const clientsOf = list => new Set(list.map(c => procOf(D, c).client_id || c.process_id)).size;
    const header = (sub) => {
      if (logo) { const hh = 14; doc.addImage(logo.url, 'PNG', M, y - 2, logo.w / logo.h * hh, hh); }
      t(REPORT_BRAND, M + 30, y + 3.5, 10, NAVY, 'bold');
      t(sub, M + 30, y + 9.5, 9, MUTED);
      t(`Posição em ${br(today)}`, W - M, y + 3.5, 8.5, MUTED, 'bold', 'right');
      y += 18;
    };

    // ================= PÁGINA 1 — RESUMO PARA A GESTÃO =================
    header('Relatório de honorários para a gestão');
    t(`Honorários de ${cap(label)}`, M, y + 4, 19, NAVY, 'bold');
    y += 9;
    t(`Considera os honorários com vencimento em ${mName}. Situação atualizada em ${br(today)}.`, M, y + 2, 9, MUTED);
    y += 9;

    // Três números principais
    const paidTotal = A.totalPaid, lateTotal = A.totalLate, openTotal = A.totalOpen;
    const cards = [
      { label: 'Honorários do mês', value: money(A.total), sub: `${pl(A.month.length, 'cobrança', 'cobranças')} · ${pl(clientsOf(A.month), 'cliente', 'clientes')}`, color: NAVY },
      { label: 'Já pagos', value: money(paidTotal), sub: `${pct(paidTotal, A.total)}% do total`, color: OKC },
      { label: 'Em atraso', value: money(lateTotal), sub: lateTotal ? `${pl(clientsOf(A.late), 'cliente', 'clientes')} em atraso` : 'Nenhum atraso', color: lateTotal ? RED : OKC }
    ];
    if (openTotal) cards.push({ label: 'Ainda vai vencer', value: money(openTotal), sub: `${pl(A.open.length, 'cobrança', 'cobranças')} no prazo`, color: WARN });
    {
      const n = cards.length, gap = 4, w = (CW - gap * (n - 1)) / n, h = 27;
      cards.forEach((k, i) => {
        const x = M + i * (w + gap);
        doc.setFillColor(...SOFT); doc.setDrawColor(...LINE); doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');
        doc.setFillColor(...k.color); doc.rect(x, y + 3, 1.6, h - 6, 'F');
        t(k.label.toUpperCase(), x + 5, y + 7, 7.6, MUTED, 'bold');
        t(k.value, x + 5, y + 16, n > 3 ? 13 : 15, k.color, 'bold');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
        t(doc.splitTextToSize(k.sub, w - 8)[0], x + 5, y + 22.5, 7.8, MUTED);
      });
      y += h + 8;
    }

    // Barra de recebimento
    if (A.total > 0) {
      t('Quanto dos honorários do mês já foi pago', M, y, 9.5, NAVY, 'bold'); y += 3.5;
      const bw = CW, bh = 7, parts = [[paidTotal, OKC], [openTotal, [232, 176, 76]], [lateTotal, RED]];
      let x = M;
      doc.setFillColor(235, 240, 246); doc.roundedRect(M, y, bw, bh, 2, 2, 'F');
      parts.forEach(([v, col]) => { const w = bw * v / A.total; if (w > 0.2) { doc.setFillColor(...col); doc.rect(x, y, w, bh, 'F'); x += w; } });
      y += bh + 5;
      let lx = M;
      [['Pago', paidTotal, OKC], ['A vencer', openTotal, [232, 176, 76]], ['Em atraso', lateTotal, RED]].forEach(([n, v, col]) => {
        if (!v && n !== 'Pago') return;
        doc.setFillColor(...col); doc.rect(lx, y - 2.6, 3, 3, 'F');
        const s = `${n}: ${money(v)} (${pct(v, A.total)}%)`; t(s, lx + 4.5, y, 8.5, NAVY); lx += doc.getTextWidth(s) + 12;
      });
      y += 9;
    }

    // Destaques em linguagem simples
    const bullets = [];
    if (A.total > 0) bullets.push(`${pct(paidTotal, A.total)}% dos honorários de ${mName} já foram pagos: ${money(paidTotal)} de ${money(A.total)}.`);
    if (A.late.length) {
      const worst = [...A.late].sort((a, b) => day(a.due_date).localeCompare(day(b.due_date)))[0];
      bullets.push(`${clientsOf(A.late) === 1 ? '1 cliente está' : clientsOf(A.late) + ' clientes estão'} com pagamento atrasado, somando ${money(lateTotal)}. O atraso mais antigo é de ${clientOf(D, worst).legal_name || procOf(D, worst).public_code} (${daysBetween(today, day(worst.due_date))} dias).`);
    } else if (A.total > 0) bullets.push('Nenhum cliente com pagamento atrasado neste mês.');
    if (A.paidLater.length) bullets.push(`${money(A.totalPaidLater)} foram pagos com atraso, já em ${MONTHS[(Number(ym.slice(5))) % 12]}, e por isso entram no caixa desse mês.`);
    bullets.push(`Entrou no caixa durante ${mName}: ${money(A.totalCash)}${A.cashFromPast.length ? `, incluindo ${money(A.totalCashFromPast)} de meses anteriores que estavam em atraso` : ''}.`);
    if (A.carried.length) bullets.push(`Além deste mês, há ${money(A.totalCarried)} em atraso de meses anteriores (${pl(clientsOf(A.carried), 'cliente', 'clientes')}).`);
    if (A.noDue.length) bullets.push(`${A.noDue.length === 1 ? '1 cobrança está' : A.noDue.length + ' cobranças estão'} sem data de vencimento (${money(A.totalNoDue)}) e não entram neste resultado até serem regularizadas.`);
    t('Destaques do mês', M, y, 11, BLUE, 'bold'); y += 6;
    bullets.forEach(b => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.6);
      const lines = doc.splitTextToSize(b, CW - 7);
      ensure(lines.length * 4.8 + 2);
      doc.setFillColor(...BLUE); doc.circle(M + 1.5, y - 1.2, 0.9, 'F');
      doc.setTextColor(...NAVY); doc.text(lines, M + 5, y);
      y += lines.length * 4.8 + 1.8;
    });
    y += 4;

    // Evolução dos últimos 6 meses
    {
      const months = Array.from({ length: 6 }, (_, i) => addMonths(ym + '-01', i - 5).slice(0, 7));
      const rows = months.map(m => ({ m, A: apuracao(D.costs, m, today) })).filter(r => r.A.month.length || r.m === ym);
      if (rows.length > 1) {
        ensure(14 + rows.length * 7);
        t('Evolução dos últimos meses', M, y, 11, BLUE, 'bold'); y += 6;
        const cw = [0.22, 0.2, 0.2, 0.2, 0.18].map(f => f * CW);
        const heads = ['Mês', 'Honorários', 'Pagos', 'Em aberto', '% pago'];
        doc.setFillColor(...SOFT); doc.rect(M, y - 4, CW, 6.5, 'F');
        let x = M + 2; heads.forEach((hh, i) => { t(hh.toUpperCase(), i ? x + cw[i] - 4 : x, y, 7.2, MUTED, 'bold', i ? 'right' : undefined); x += cw[i]; });
        y += 6.5;
        rows.forEach(({ m, A: R }) => {
          const p = pct(R.totalPaid, R.total), cur = m === ym;
          x = M + 2;
          const cells = [cap(monthLabel(m)), money(R.total), money(R.totalPaid), money(R.totalLate + R.totalOpen), R.total ? p + '%' : '—'];
          cells.forEach((v, i) => { t(v, i ? x + cw[i] - 4 : x, y, 9, i === 3 && R.totalLate ? RED : NAVY, cur || i === 4 ? 'bold' : 'normal', i ? 'right' : undefined); x += cw[i]; });
          if (R.total) { const bx = M + cw[0] + cw[1] + cw[2] + cw[3] + 3, bw2 = cw[4] - 20; doc.setFillColor(235, 240, 246); doc.rect(bx, y - 2.6, bw2, 2.6, 'F'); doc.setFillColor(...(p >= 90 ? OKC : p >= 70 ? WARN : RED)); doc.rect(bx, y - 2.6, bw2 * p / 100, 2.6, 'F'); }
          doc.setDrawColor(...LINE); doc.line(M, y + 2.4, W - M, y + 2.4); y += 7;
        });
        t('"Em aberto" = ainda não pago (em atraso ou dentro do prazo), na posição de hoje.', M, y + 1, 7.3, MUTED); y += 10;
      }
    }

    // Lista curta de quem está em atraso (página 1)
    const lateAll = [...A.late, ...A.carried];
    if (lateAll.length) {
      ensure(16 + Math.min(lateAll.length, 12) * 6.2);
      t(A.carried.length ? 'Clientes com pagamento em atraso (todos os meses)' : 'Clientes com pagamento em atraso', M, y, 11, RED, 'bold'); y += 6;
      const sorted = lateAll.sort((a, b) => day(a.due_date).localeCompare(day(b.due_date)));
      sorted.slice(0, 12).forEach(c => {
        const d = daysBetween(today, day(c.due_date));
        t(doc.splitTextToSize(clientOf(D, c).legal_name || '—', CW * 0.55)[0], M + 2, y, 9, NAVY);
        t(`venceu ${br(c.due_date)} · ${d} dia${d === 1 ? '' : 's'}`, M + CW * 0.6, y, 8.5, MUTED);
        t(money(c.amount), W - M - 2, y, 9, RED, 'bold', 'right');
        doc.setDrawColor(...LINE); doc.line(M, y + 2.2, W - M, y + 2.2); y += 6.2;
      });
      if (sorted.length > 12) { t(`… e mais ${sorted.length - 12}. Lista completa no anexo.`, M + 2, y + 1, 8, MUTED); y += 6; }
    }

    // ================= ANEXO — DETALHAMENTO =================
    doc.addPage(); y = M;
    header(`Anexo · detalhamento dos honorários de ${label}`);
    t('Anexo — detalhamento', M, y + 3, 14, NAVY, 'bold'); y += 9;
    t('Lista completa por situação, para conferência pela equipe financeira.', M, y, 8.6, MUTED); y += 6;

    // ---- Tabelas por grupo ----
    const cols = [{ h: 'Empresa', w: 0.34 }, { h: 'Processo', w: 0.17 }, { h: 'Parcela', w: 0.09 }, { h: 'Vencimento', w: 0.12 }, { h: 'Valor', w: 0.14, r: 1 }, { h: '', w: 0.14 }];
    const group = (title, list, lastHead, lastCell, color, note) => {
      if (!list.length) return;
      const total = list.reduce((n, c) => n + cents(c.amount), 0) / 100;
      ensure(24); y += 2;
      doc.setFillColor(...color); doc.rect(M, y - 4, 1.4, 6, 'F');
      t(title, M + 3.5, y + 0.6, 10, NAVY, 'bold');
      t(`${list.length} ${list.length === 1 ? 'cobrança' : 'cobranças'} · ${money(total)}`, W - M, y + 0.6, 9, color, 'bold', 'right');
      y += 4;
      if (note) { t(note, M + 3.5, y + 0.8, 7.3, MUTED); y += 4; }
      y += 2;
      const head = () => { doc.setFillColor(...SOFT); doc.rect(M, y - 3.8, CW, 6, 'F'); let x = M + 1.5; cols.forEach((c, i) => { const w = CW * c.w; t((i === 5 ? lastHead : c.h).toUpperCase(), c.r ? x + w - 3 : x, y, 6.8, MUTED, 'bold', c.r ? 'right' : undefined); x += w; }); y += 6; };
      head();
      [...list].sort((a, b) => day(a.due_date || a.paid_at).localeCompare(day(b.due_date || b.paid_at)) || String(clientOf(D, a).legal_name).localeCompare(String(clientOf(D, b).legal_name))).forEach(c => {
        if (y + 6.5 > BOTTOM) { doc.addPage(); y = M + 4; head(); }
        const p = procOf(D, c), cl = clientOf(D, c);
        const cells = [cl.legal_name || '—', p.public_code || '—', installmentLabel(c), c.due_date ? br(c.due_date) : 's/ venc.*', money(c.amount), lastCell(c)];
        let x = M + 1.5;
        cells.forEach((v, i) => { const col = cols[i], w = CW * col.w; doc.setFont('helvetica', i === 4 || i === 5 ? 'bold' : 'normal'); doc.setFontSize(8); const s = doc.splitTextToSize(String(v), w - 2.5)[0]; t(s, col.r ? x + w - 3 : x, y, 8, i === 5 ? color : NAVY, i === 4 || i === 5 ? 'bold' : 'normal', col.r ? 'right' : undefined); x += w; });
        doc.setDrawColor(...LINE); doc.line(M, y + 2.2, W - M, y + 2.2); y += 6;
      });
      y += 3;
    };
    const lateDays = c => { const d = daysBetween(today, day(c.due_date)); return `${d} dia${d === 1 ? '' : 's'} de atraso`; };
    group(`Em atraso — venceram em ${mName} e não foram pagos`, A.late, 'Atraso', lateDays, RED, 'Cobrar o cliente. Se já pagou, registrar o pagamento no sistema com a data real.');
    group('Ainda vão vencer', A.open, 'Vence em', c => { const d = daysBetween(day(c.due_date), today); return d === 0 ? 'hoje' : `${d} dia(s)`; }, WARN);
    group(`Pagos com atraso (depois de ${mName})`, A.paidLater, 'Pago em', c => br(c.paid_at), WARN, `Entram no caixa do mês em que foram pagos.`);
    group('Pagos antecipadamente', A.paidEarly, 'Pago em', c => br(c.paid_at), OKC);
    group(`Pagos em dia (dentro de ${mName})`, A.paidIn, 'Pago em', c => br(c.paid_at), OKC);
    group(`Pagos em ${mName}, mas de outros meses`, A.cashOther, 'Pago em', c => br(c.paid_at), BLUE, 'Entram no caixa deste mês, mas pertencem ao mês em que venceram.');
    group('Em atraso de meses anteriores', A.carried, 'Situação', lateDays, RED);
    group('Sem data de vencimento (a regularizar)', A.noDue, 'Situação', () => 'sem data', MUTED, 'Informar o vencimento no processo para entrarem no relatório do mês certo.');

    const anyNoDue = A.month.some(c => !c.due_date) || A.cashOther.some(c => !c.due_date);
    if (anyNoDue) { ensure(8); t('* s/ venc.: honorário antigo sem data de vencimento cadastrada; foi considerado no mês em que foi pago.', M, y + 1, 7.3, MUTED); y += 6; }

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setDrawColor(...LINE); doc.line(M, 286, W - M, 286);
      t(`ATLAS Legalização · honorários de ${label} · gerado em ${br(today)}`, M, 290, 7.4, MUTED);
      t(`${i}/${pages}`, W - M, 290, 7.4, MUTED, 'normal', 'right');
    }
    download(`Relatorio-honorarios-${ym}.pdf`, doc.output('blob'));
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
    const link = document.createElement('link'); link.id = 'fx-css'; link.rel = 'stylesheet'; link.href = '/financeiro-apuracao.css?v=9.8';
    document.head?.appendChild(link);
  }

  window.AtlasFinanceiro = { version: '9.8', splitInstallments, addMonths, feeState, refMonth, apuracao, installmentLabel, csvRows, buildPdf, enhance };
})();
