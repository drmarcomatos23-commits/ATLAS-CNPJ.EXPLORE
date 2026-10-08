(() => {
  const OLD_LOGO = 'logo-atlas-legalizacao.png';
  const OEA_LOGO = 'oea-report-logo.png?v=1.0';
  const OLD_STYLE = '.report-logo{width:74px;height:68px;object-fit:contain}';
  const NEW_STYLE = '.report-logo{width:92px;height:68px;object-fit:contain}';

  function patchReportHtml(html){
    return String(html)
      .replaceAll(OLD_LOGO, OEA_LOGO)
      .replaceAll(OLD_STYLE, NEW_STYLE)
      .replace('<div class="eyebrow">RELATÓRIO INSTITUCIONAL</div><h1>ATLAS Legalização e Gerenciamento</h1>', '<div class="eyebrow">OEA · ORGANIZAÇÃO EXCELÊNCIA ASSESSORIA</div><h1>Relatório Gerencial</h1>')
      .replaceAll('<span>ATLAS Legalização e Gerenciamento</span>', '<span>OEA · Organização Excelência Assessoria</span>')
      .replaceAll('<title>Relatório ATLAS</title>', '<title>Relatório Institucional</title>')
      .replaceAll('alt="ATLAS"', 'alt="OEA"')
      .replaceAll('ATLAS Legalização e Gerenciamento', 'Organização Excelência Assessoria')
      .replaceAll('Relatório ATLAS', 'Relatório Institucional');
  }

  function patchPopupDocument(popup){
    if (!popup?.document?.write) return popup;
    const nativeWrite = popup.document.write.bind(popup.document);
    popup.document.write = (html) => nativeWrite(patchReportHtml(html));
    return popup;
  }

  function emitWithOeaBrand(period, composition){
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
      emitWithOeaBrand(
        document.getElementById('report-period')?.value || 'monthly',
        document.getElementById('report-composition')?.value || 'processes'
      );
    });
  };

  window.emitAtlasReport = emitWithOeaBrand;
  window.emitAtlasReportBrandedV4 = emitWithOeaBrand;
})();
