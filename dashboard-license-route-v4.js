(() => {
  const dashboardBrand='/atlas-dashboard-brand.svg?v=4.1';
  const fullBrand='/atlas-sidebar-brand.svg?v=4.4';
  function setBrand(page){
    const img=document.querySelector('.brand-logo');
    if(img) img.src=page==='dashboard'?dashboardBrand:fullBrand;
  }
  function installActionStyles(){
    if(document.querySelector('#atlas-v4-action-layout')) return;
    const style=document.createElement('style');
    style.id='atlas-v4-action-layout';
    style.textContent=`
      .v4-process-head,.v4-process-row{grid-template-columns:1.05fr 1.35fr 1.3fr 1fr 1fr .8fr .95fr 1.3fr 1.15fr!important}
      .v4-process-list{overflow-x:auto}
      .v4-process-head,.v4-process-row{min-width:1180px}
      .v4-row-actions{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:6px!important;min-width:112px}
      .v4-row-actions .mini-btn{white-space:nowrap!important;min-width:104px!important;min-height:34px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0 10px!important}
      @media(max-width:760px){.v4-row-actions{min-width:108px}.v4-row-actions .mini-btn{min-width:100px!important}}
    `;
    document.head.appendChild(style);
  }
  window.openAtlasV4Stage = (stageName) => {
    if (stageName === 'Licenças') {
      window.atlasV4StageFilter = null;
      document.querySelector('[data-page=licencas]')?.click();
      return;
    }
    window.atlasV4StageFilter = stageName;
    document.querySelector('[data-page=processos]')?.click();
  };
  const baseDashboard=window.dashboard;
  if(typeof baseDashboard==='function'){
    window.dashboard=async function(...args){
      const result=await baseDashboard.apply(this,args);
      try{
        const data=await loadOperationalData();
        const step=[...document.querySelectorAll('.v4-pipeline-track .v4-pipe-step')].find(el=>el.querySelector('small')?.textContent?.trim()==='Licenças');
        const count=step?.querySelector('strong');
        if(count) count.textContent=String(data?.licenses?.length||0);
      }catch(_){ }
      setBrand('dashboard');
      return result;
    };
  }
  document.addEventListener('click',e=>{
    const nav=e.target.closest?.('[data-page]');
    if(nav) queueMicrotask(()=>setBrand(nav.dataset.page));
  });
  document.addEventListener('DOMContentLoaded',()=>{
    installActionStyles();
    setBrand(document.querySelector('[data-page=dashboard].active')?'dashboard':(document.querySelector('.nav-item.active')?.dataset.page||'dashboard'));
  });
  installActionStyles();
})();
