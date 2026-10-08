(() => {
  const OLD_LOGO = 'logo-atlas-legalizacao.png';
  const NEW_LOGO = 'atlas-report-brand.svg?v=4.1';
  const OLD_STYLE = '.report-logo{width:74px;height:68px;object-fit:contain}';
  const NEW_STYLE = '.report-logo{width:210px;height:66px;object-fit:contain}';

  function patchPopupDocument(popup){
    if (!popup?.document?.write) return popup;
    const nativeWrite = popup.document.write.bind(popup.document);
    popup.document.write = (html) => nativeWrite(
      String(html)
        .replaceAll(OLD_LOGO, NEW_LOGO)
        .replaceAll(OLD_STYLE, NEW_STYLE)
    );
    return popup;
  }

  function emitWithNewBrand(period, composition){
    if (typeof window.emitAtlasReportV4 !== 'function') return;
    const nativeOpen = window.open;
    window.open = (...args) => patchPopupDocument(nativeOpen.apply(window, args));
    try {
      return window.emitAtlasReportV4(period, composition);
    } finally {
      window.open = nativeOpen;
    }
  }

  const previousReportsPage = window.reportsPage;
  window.reportsPage = async function(){
    if (typeof previousReportsPage === 'function') await previousReportsPage();
    const oldBtn = document.getElementById('report-emit-btn');
    if (!oldBtn || oldBtn.dataset.atlasReportBrandV4 === '1') return;
    const btn = oldBtn.cloneNode(true);
    btn.dataset.atlasReportBrandV4 = '1';
    oldBtn.replaceWith(btn);
    btn.addEventListener('click', () => {
      emitWithNewBrand(
        document.getElementById('report-period')?.value || 'monthly',
        document.getElementById('report-composition')?.value || 'processes'
      );
    });
  };

  window.emitAtlasReport = emitWithNewBrand;
  window.emitAtlasReportBrandedV4 = emitWithNewBrand;
})();
