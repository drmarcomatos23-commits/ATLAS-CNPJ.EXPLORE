(() => {
  const originalLoadOperationalData = window.loadOperationalData;
  if (typeof originalLoadOperationalData !== 'function' || window.__atlasAuthReadinessV6) return;

  const emptyOperationalData = () => ({
    clients: [],
    groups: [],
    processes: [],
    templates: [],
    stages: [],
    profiles: [],
    protocols: [],
    costs: [],
    licenses: []
  });

  async function waitForAuthenticatedSession() {
    const atlasAuth = window.atlasAuth;
    const db = atlasAuth?.client;
    if (!db?.auth?.getSession) return null;

    const { data, error } = await db.auth.getSession();
    if (error || !data?.session?.access_token) return null;

    const profile = atlasAuth.getProfile?.() || null;
    if (!profile?.id) return null;

    return { db, session: data.session, profile };
  }

  window.loadOperationalData = async function loadOperationalDataAuthenticated(...args) {
    const ctx = await waitForAuthenticatedSession();
    if (!ctx) return emptyOperationalData();
    return originalLoadOperationalData(...args);
  };

  window.atlasWaitForAuthenticatedSession = waitForAuthenticatedSession;
  window.__atlasAuthReadinessV6 = true;
})();
