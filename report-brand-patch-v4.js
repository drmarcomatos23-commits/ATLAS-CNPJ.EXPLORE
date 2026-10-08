(() => {
  const OLD_LOGO = 'logo-atlas-legalizacao.png';
  const OEA_LOGO = 'oea-report-logo-correct.png?v=1.1';
  const OLD_STYLE = '.report-logo{width:74px;height:68px;object-fit:contain}';
  const NEW_STYLE = '.report-logo{width:118px;height:72px;object-fit:contain;object-position:center center;display:block;flex:0 0 auto}';

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
    if (!popup?.document?.write || popup.document.__oeaReportPatchedV4) return popup;
    const nativeWrite = popup.document.write.bind(popup.document);
    popup.document.write = (html) => {
      const text = String(html);
      const isReport = text.includes('Relatório ATLAS') || text.includes('ATLAS Legalização e Gerenciamento') || text.includes(OLD_LOGO);
      return nativeWrite(isReport ? patchReportHtml(text) : text);
    };
    popup.document.__oeaReportPatchedV4 = true;
    return popup;
  }

  if (!window.__oeaReportWindowOpenPatchedV4) {
    const nativeOpen = window.open.bind(window);
    window.open = function(...args){
      return patchPopupDocument(nativeOpen(...args));
    };
    window.__oeaReportWindowOpenPatchedV4 = true;
  }
})();
