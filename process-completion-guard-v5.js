(() => {
  const originalAtlasDb = window.atlasDb;
  if (typeof originalAtlasDb !== 'function' || window.__atlasCompletionGuardV5) return;

  const cleanPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return payload;
    const clean = { ...payload };
    delete clean.completed_at;
    return clean;
  };

  const wrapTable = (builder, table) => {
    if (table !== 'processes' || !builder) return builder;
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === 'update' || prop === 'insert') {
          return (payload, ...args) => {
            const safePayload = Array.isArray(payload)
              ? payload.map(cleanPayload)
              : cleanPayload(payload);
            return target[prop](safePayload, ...args);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  };

  window.atlasDb = function atlasDbCompletionSafe(...args) {
    const client = originalAtlasDb(...args);
    if (!client || typeof client.from !== 'function') return client;
    return new Proxy(client, {
      get(target, prop, receiver) {
        if (prop === 'from') {
          return (table) => wrapTable(target.from(table), table);
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  };

  window.__atlasCompletionGuardV5 = true;
})();
