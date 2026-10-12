(()=>{
  let deferredInstallPrompt=null;

  function isStandalone(){
    return window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;
  }

  function ensureInstallButton(){
    if(document.getElementById('atlas-pwa-install'))return document.getElementById('atlas-pwa-install');
    const footer=document.querySelector('.sidebar-footer');
    if(!footer)return null;
    const button=document.createElement('button');
    button.id='atlas-pwa-install';
    button.type='button';
    button.className='atlas-pwa-install hidden';
    button.innerHTML='<span>＋</span><strong>Instalar ATLAS</strong>';
    button.setAttribute('aria-label','Instalar ATLAS neste dispositivo');
    button.addEventListener('click',async()=>{
      if(!deferredInstallPrompt)return;
      button.disabled=true;
      try{
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
      }finally{
        deferredInstallPrompt=null;
        button.classList.add('hidden');
        button.disabled=false;
      }
    });
    footer.prepend(button);
    return button;
  }

  async function registerServiceWorker(){
    if(!('serviceWorker' in navigator))return;
    try{
      const registration=await navigator.serviceWorker.register('/sw-v5-1.js?v=5.1',{scope:'/'});
      registration.update?.();
    }catch(error){
      console.warn('ATLAS PWA: service worker indisponível',error);
    }
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    const button=ensureInstallButton();
    if(button&&!isStandalone())button.classList.remove('hidden');
  });

  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    document.getElementById('atlas-pwa-install')?.classList.add('hidden');
  });

  window.addEventListener('DOMContentLoaded',()=>{
    ensureInstallButton();
    registerServiceWorker();
    if(isStandalone())document.documentElement.classList.add('atlas-pwa-standalone');
  });
})();
