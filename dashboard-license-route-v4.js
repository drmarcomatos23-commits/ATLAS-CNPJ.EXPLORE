(() => {
  window.openAtlasV4Stage = (stageName) => {
    if (stageName === 'Licenças') {
      window.atlasV4StageFilter = null;
      document.querySelector('[data-page=licencas]')?.click();
      return;
    }
    window.atlasV4StageFilter = stageName;
    document.querySelector('[data-page=processos]')?.click();
  };
})();
