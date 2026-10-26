(() => {
  const LEGACY_LAYER_IDS = ['atlas-v6-fidelity-guard','atlas-v6-mockup-fidelity','atlas-v6-functional-sidebar'];
  const chartInstances = [];
  // Barra lateral em grupos recolhíveis (V8.9). A ordem plana abaixo é derivada dos grupos.
  const SIDEBAR_GROUPS = [
    { key:'inicio', label:'', pages:['dashboard'] },
    { key:'operacao', label:'Operação', pages:['processos','tarefas','protocolos','exigencias','agenda'] },
    { key:'empresas', label:'Empresas', pages:['clientes','monitor','licencas','documentos'] },
    { key:'gestao', label:'Gestão', pages:['custos','relatorios','equipe'] },
    { key:'ajustes', label:'Sistema', pages:['modelos','config','usuarios','integracoes'] },
    { key:'ajuda', label:'Ajuda', pages:['conhecimento','treinamento'] }
  ];
  const SIDEBAR_ORDER = ['dashboard','processos','tarefas','protocolos','exigencias','agenda','clientes','monitor','licencas','documentos','custos','relatorios','equipe','modelos','config','usuarios','integracoes','conhecimento','treinamento'];
  const SIDEBAR_STATE_KEY = 'atlas.sidebarGroups.v1';
  const DEFAULT_OPEN = { operacao:true, empresas:false, gestao:false, ajustes:false, ajuda:false };
  const TYPE_FALLBACK = [
    { label:'LTDA', value:68 },
    { label:'S/A', value:24 },
    { label:'MEI', value:18 },
    { label:'EIRELI', value:16 },
    { label:'Outros', value:12 }
  ];

  const centerTextPlugin = {
    id:'atlasCenterText',
    afterDatasetsDraw(chart,args,pluginOptions={}) {
      if (chart.config.type !== 'doughnut') return;
      const arc = chart.getDatasetMeta(0)?.data?.[0];
      if (!arc) return;

      const total = Number(pluginOptions.total ?? 0);
      const label = String(pluginOptions.label || 'processos');
      const x = arc.x;
      const y = arc.y;
      const innerRadius = Number(arc.innerRadius || 40);
      const totalSize = Math.max(16, Math.min(20, Math.round(innerRadius * .44)));
      const labelSize = Math.max(9, Math.min(11, Math.round(innerRadius * .24)));
      const totalY = Math.max(7, Math.round(totalSize * .42));
      const labelY = Math.max(11, Math.round(labelSize * 1.05));
      const ctx = chart.ctx;

      ctx.save();
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillStyle='#0F1D3A';
      ctx.font=`700 ${totalSize}px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillText(String(total),x,y-totalY);
      ctx.fillStyle='#6B7A99';
      ctx.font=`500 ${labelSize}px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillText(label,x,y+labelY);
      ctx.restore();
    }
  };

  function removeLegacyFidelityLayers() {
    LEGACY_LAYER_IDS.forEach(id => document.getElementById(id)?.remove());
  }

  function ensureFinalStylesheet() {
    if (document.getElementById('atlas-reference-final-css')) return;
    const link=document.createElement('link');
    link.id='atlas-reference-final-css';
    link.rel='stylesheet';
    link.href='/atlas-reference-final.css?v=1.0';
    document.head.appendChild(link);
  }

  function ensureMobileStylesheet() {
    if (document.getElementById('atlas-reference-mobile-css')) return;
    const link=document.createElement('link');
    link.id='atlas-reference-mobile-css';
    link.rel='stylesheet';
    link.href='/atlas-reference-mobile.css?v=1.0';
    document.head.appendChild(link);
  }

  function ensureMobileFixStylesheet() {
    if (document.getElementById('atlas-reference-mobile-fix-css')) return;
    const link=document.createElement('link');
    link.id='atlas-reference-mobile-fix-css';
    link.rel='stylesheet';
    link.href='/atlas-reference-mobile-fix.css?v=1.0';
    document.head.appendChild(link);
  }

  function ensureReadabilityStylesheet() {
    if (document.getElementById('atlas-readability-fix-css')) return;
    const link=document.createElement('link');
    link.id='atlas-readability-fix-css';
    link.rel='stylesheet';
    link.href='/atlas-readability-fix.css?v=1.0';
    document.head.appendChild(link);
  }

  function ensurePolishStylesheet() {
    if (document.getElementById('atlas-dashboard-polish-css')) return;
    const link=document.createElement('link');
    link.id='atlas-dashboard-polish-css';
    link.rel='stylesheet';
    link.href='/atlas-dashboard-polish.css?v=1.0';
    document.head.appendChild(link);
  }

  function readSidebarState() {
    try { return { ...DEFAULT_OPEN, ...(JSON.parse(localStorage.getItem(SIDEBAR_STATE_KEY) || '{}') || {}) }; }
    catch { return { ...DEFAULT_OPEN }; }
  }
  function saveSidebarState(state) { try { localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(state)); } catch {} }

  function setGroupOpen(group, open, persist) {
    if (!group || !group.dataset.sbGroup) return;
    const head = group.querySelector(':scope > .atlas-sb-head');
    const items = group.querySelector(':scope > .atlas-sb-items');
    group.classList.toggle('is-open', open);
    if (head) head.setAttribute('aria-expanded', String(open));
    if (items) items.hidden = !open;
    if (persist) { const st = readSidebarState(); st[group.dataset.sbGroup] = open; saveSidebarState(st); }
  }

  function syncSidebarGroups(nav) {
    nav.querySelectorAll('.atlas-sb-group').forEach(group => {
      const items = [...group.querySelectorAll('.nav-item[data-page]')];
      // Conta só o que o perfil e o layout realmente exibem (alguns itens ficam ocultos no computador).
      const visible = items.filter(i => !i.classList.contains('hidden') && getComputedStyle(i).display !== 'none');
      group.classList.toggle('atlas-sb-empty', !visible.length);
      const active = items.some(i => i.classList.contains('active'));
      group.classList.toggle('has-active', active);
      const count = group.querySelector('.atlas-sb-count');
      if (count) count.textContent = String(visible.length);
    });
  }

  function buildSidebarGroups(primary) {
    if (primary.dataset.sbReady === '1') return;
    primary.dataset.sbReady = '1';
    primary.classList.add('atlas-sb-root');
    const state = readSidebarState();
    SIDEBAR_GROUPS.forEach(g => {
      const group = document.createElement('div');
      group.className = 'atlas-sb-group' + (g.label ? '' : ' atlas-sb-flat');
      group.dataset.sbGroup = g.key;
      if (g.label) {
        const head = document.createElement('button');
        head.type = 'button';
        head.className = 'atlas-sb-head';
        head.innerHTML = `<span class="atlas-sb-label">${g.label}</span><span class="atlas-sb-count" aria-hidden="true"></span><svg class="atlas-sb-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        head.addEventListener('click', () => setGroupOpen(group, !group.classList.contains('is-open'), true));
        group.appendChild(head);
      }
      const items = document.createElement('div');
      items.className = 'atlas-sb-items';
      group.appendChild(items);
      primary.appendChild(group);
      if (g.label) setGroupOpen(group, !!state[g.key], false);
      else group.classList.add('is-open');
    });
    // Ao navegar para um item de grupo fechado (busca, sino, atalhos), abre o grupo dele.
    const nav = primary.closest('#nav');
    if (nav && window.MutationObserver) {
      new MutationObserver(() => {
        syncSidebarGroups(nav);
        const act = nav.querySelector('.atlas-sb-group .nav-item.active');
        const grp = act?.closest('.atlas-sb-group');
        if (grp && !grp.classList.contains('is-open') && grp.dataset.lastActive !== act.dataset.page) { grp.dataset.lastActive = act.dataset.page; setGroupOpen(grp, true, false); }
      }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  }

  function polishSidebarOrder() {
    const nav=document.getElementById('nav');
    if(!nav) return;
    let primary=nav.querySelector('.atlas-polished-primary');
    if(!primary){
      primary=document.createElement('section');
      primary.className='v6-nav-group atlas-polished-primary';
      primary.setAttribute('aria-label','Navegação principal');
      nav.prepend(primary);
    }
    buildSidebarGroups(primary);
    let index = 0;
    SIDEBAR_GROUPS.forEach(g => {
      const host = primary.querySelector(`.atlas-sb-group[data-sb-group="${g.key}"] > .atlas-sb-items`);
      g.pages.forEach(page => {
        const item=nav.querySelector(`.nav-item[data-page="${page}"]`);
        if(item){
          item.style.setProperty('--atlas-nav-order', String(index++));
          if (item.parentElement !== host) host.appendChild(item);
        }
      });
    });
    syncSidebarGroups(nav);
  }

  function syncMobileDashboardChrome() {
    const active=!!document.querySelector('#page-content .atlas-final-dashboard');
    document.body.classList.toggle('atlas-final-dashboard-active',active);
    const shell=document.getElementById('app-shell');
    if(active) shell?.setAttribute('data-v6-page','dashboard');
    const pageHead=shell?.querySelector('.main > .page-head');
    if(pageHead){
      if(active){
        pageHead.style.setProperty('display','none','important');
        pageHead.setAttribute('aria-hidden','true');
      } else {
        pageHead.style.removeProperty('display');
        pageHead.removeAttribute('aria-hidden');
      }
    }
    const fab=document.getElementById('new-process-btn');
    if(fab && active) fab.classList.add('mobile-fab-suppressed');
  }

  function injectRuntimeStyles() {
    if (document.getElementById('atlas-reference-runtime-style')) return;
    const style=document.createElement('style');
    style.id='atlas-reference-runtime-style';
    style.textContent=`
      .atlas-chart-canvas{position:relative;min-width:0}
      .atlas-chart-canvas.donut{width:82px;height:82px;margin:auto}
      .atlas-chart-canvas.donut canvas{width:82px!important;height:82px!important}
      .atlas-chart-canvas.bars{height:98px;width:100%}
      .atlas-chart-canvas.bars canvas{width:100%!important;height:98px!important}
      .atlas-status-body:has(.atlas-chart-canvas){grid-template-columns:96px minmax(0,1fr)}
      .atlas-bars:has(.atlas-chart-canvas){display:block;height:104px;padding:8px 14px 4px}
    `;
    document.head.appendChild(style);
  }

  function destroyCharts() {
    while (chartInstances.length) {
      try { chartInstances.pop()?.destroy?.(); } catch (_) {}
    }
  }

  function parseStatusRows(root) {
    return [...root.querySelectorAll('.atlas-legend > div')].map(row => ({
      label: row.querySelector('span')?.textContent?.trim() || '',
      value: Number(row.querySelector('b')?.textContent?.replace(/\D/g,'') || 0)
    })).filter(x => x.label);
  }

  function parseTypeRows(root) {
    return [...root.querySelectorAll('.atlas-bars > div')].map(row => ({
      label: row.querySelector('small')?.textContent?.trim() || '',
      value: Number(row.querySelector('b')?.textContent?.replace(/\D/g,'') || 0)
    })).filter(x => x.label);
  }

  function normalizeTypeRows(rows=[]) {
    const clean=rows.filter(row => row?.label && Number.isFinite(Number(row.value)) && Number(row.value) >= 0);
    const onlyOutros=clean.length===1 && /outros/i.test(clean[0].label) && Number(clean[0].value)>0;
    return (!clean.length || onlyOutros) ? TYPE_FALLBACK.map(row=>({...row})) : clean;
  }

  function upgradeCharts() {
    if (!window.Chart) return;
    const dashboard = document.querySelector('.atlas-final-dashboard');
    if (!dashboard || dashboard.dataset.chartjsUpgraded === '1') return;
    const statusBody = dashboard.querySelector('.atlas-status-body');
    const barsBody = dashboard.querySelector('.atlas-bars');
    if (!statusBody || !barsBody) return;

    const statusRows = parseStatusRows(dashboard);
    const parsedTypeRows = parseTypeRows(dashboard);
    const onlyOutros = parsedTypeRows.length===1 && /outros/i.test(parsedTypeRows[0].label) && parsedTypeRows[0].value>0;
    const typeRows = normalizeTypeRows(parsedTypeRows);
    if (!statusRows.length || !typeRows.length) return;

    const typeCard=barsBody.closest('.atlas-card');
    if(onlyOutros || !parsedTypeRows.length){
      typeCard?.setAttribute('data-atlas-fallback','company-types');
      const subtitle=typeCard?.querySelector('header p');
      if(subtitle) subtitle.textContent='Distribuição ilustrativa — natureza jurídica não informada nos cadastros.';
    } else {
      typeCard?.removeAttribute('data-atlas-fallback');
    }

    destroyCharts();
    const total = statusRows.reduce((s,x)=>s+x.value,0);
    statusBody.innerHTML = `<div class="atlas-chart-canvas donut"><canvas id="atlas-status-chart"></canvas></div><div class="atlas-legend">${statusRows.map((r,i)=>`<div><i style="background:${['#1565D8','#22A861','#F7931E','#19B5E8','#98A5B9'][i]}"></i><span>${r.label}</span><b>${r.value}</b><small>${total?Math.round(r.value/total*100):0}%</small></div>`).join('')}</div>`;
    barsBody.innerHTML = `<div class="atlas-chart-canvas bars"><canvas id="atlas-type-chart"></canvas></div>`;

    chartInstances.push(new Chart(document.getElementById('atlas-status-chart'), {
      type:'doughnut',
      data:{labels:statusRows.map(x=>x.label),datasets:[{data:statusRows.map(x=>x.value),backgroundColor:['#1565D8','#22A861','#F7931E','#19B5E8','#98A5B9'],borderWidth:0,hoverOffset:2}]},
      plugins:[centerTextPlugin],
      options:{
        responsive:true,
        maintainAspectRatio:false,
        cutout:'67%',
        layout:{padding:0},
        plugins:{legend:{display:false},tooltip:{enabled:true},atlasCenterText:{total,label:'processos'}}
      }
    }));

    chartInstances.push(new Chart(document.getElementById('atlas-type-chart'), {
      type:'bar',
      data:{labels:typeRows.map(x=>x.label),datasets:[{data:typeRows.map(x=>x.value),backgroundColor:['#1565D8','#3CA7E5','#19B5C4','#F7931E','#98A5B9'],borderRadius:4,borderSkipped:false,maxBarThickness:42}]},
      options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:8,left:6,right:6,bottom:0}},plugins:{legend:{display:false},tooltip:{enabled:true}},scales:{x:{grid:{display:false},border:{display:false},ticks:{font:{size:10,weight:'500'},color:'#60728D'}},y:{display:false,beginAtZero:true,grid:{display:false},border:{display:false}}}}
    }));
    dashboard.dataset.chartjsUpgraded='1';
  }

  function run() {
    removeLegacyFidelityLayers();
    ensureFinalStylesheet();
    ensureMobileStylesheet();
    ensureMobileFixStylesheet();
    ensureReadabilityStylesheet();
    ensurePolishStylesheet();
    injectRuntimeStyles();
    polishSidebarOrder();
    syncMobileDashboardChrome();
    upgradeCharts();
    const root=document.getElementById('page-content');
    if (root && window.MutationObserver) {
      new MutationObserver(() => {
        removeLegacyFidelityLayers();
        ensureFinalStylesheet();
        ensureMobileStylesheet();
        ensureMobileFixStylesheet();
        ensureReadabilityStylesheet();
        ensurePolishStylesheet();
        polishSidebarOrder();
        syncMobileDashboardChrome();
        queueMicrotask(upgradeCharts);
      }).observe(root,{childList:true,subtree:false});
    }
    window.addEventListener('resize',()=>{polishSidebarOrder();syncMobileDashboardChrome();},{passive:true});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();