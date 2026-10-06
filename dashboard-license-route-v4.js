(() => {
  const baseDashboard = window.dashboard;

  async function syncLicenseCount() {
    try {
      const data = await loadOperationalData();
      const count = Array.isArray(data?.licenses) ? data.licenses.length : 0;
      const step = [...document.querySelectorAll('.v4-pipeline-track .v4-pipe-step')]
        .find(el => el.querySelector('small')?.textContent?.trim() === 'Licenças');
      if (step) {
        const value = step.querySelector('strong');
        if (value) value.textContent = String(count);
        step.dataset.licenseCount = String(count);
      }
    } catch (err) {
      console.warn('ATLAS: não foi possível sincronizar a contagem de licenças no Dashboard.', err);
    }
  }

  if (typeof baseDashboard === 'function') {
    window.dashboard = async function dashboardWithRealLicenseCount(...args) {
      const out = await baseDashboard.apply(this, args);
      await syncLicenseCount();
      return out;
    };
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
})();
