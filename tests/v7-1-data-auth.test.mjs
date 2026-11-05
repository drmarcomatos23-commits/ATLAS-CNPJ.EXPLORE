import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const completion = readFileSync(new URL('../completion-date-v4.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function fakeDb(responses = {}) {
  const calls = [];
  const db = {
    calls,
    from(table) {
      const call = { type:'from', table, filters:[] };
      calls.push(call);
      const builder = {
        select(columns){ call.select=columns; return builder; },
        eq(column,value){ call.filters.push([column,value]); return builder; },
        order(column,opts){ call.order=[column,opts]; return builder; },
        limit(value){ call.limit=value; return builder; },
        in(column,value){ call.filters.push([column,value]); return builder; },
        then(resolve,reject){
          const response = responses[table] ?? {data:[],error:null};
          return Promise.resolve(response).then(resolve,reject);
        }
      };
      return builder;
    },
    rpc(name,args){ calls.push({type:'rpc',name,args}); return Promise.resolve(responses[`rpc:${name}`] ?? {data:{ok:true},error:null}); }
  };
  return db;
}

function loadDataAdapter({ profile = null, db = null } = {}) {
  const source = readFileSync(new URL('../atlas-ops-v7-data.js', import.meta.url), 'utf8');
  const sandbox = {
    window: { atlasAuth: { getProfile: () => profile, client: db } },
    console,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(source, sandbox, { filename:'atlas-ops-v7-data.js' });
  return sandbox.window.AtlasOpsV71Data;
}

test('completion-date waits for authenticated ATLAS session before querying processes', () => {
  assert.match(completion, /async function refreshWhenAuthenticated\s*\(/);
  assert.match(completion, /atlasAuth\?\.getProfile\?\.\(\)/);
  assert.match(completion, /atlasAuth\?\.client/);
  const domReady = completion.match(/document\.addEventListener\('DOMContentLoaded',[\s\S]*?\n\s*\}\);/i)?.[0] || '';
  assert.match(domReady, /refreshWhenAuthenticated\(\)/);
  assert.doesNotMatch(domReady, /\brefreshCompletionDates\(\)\s*;/);
});

test('ATLAS 7.1 scripts load after auth and permissions in deterministic order', () => {
  const rolePermissions = index.indexOf('/role-permissions.js?v=3.58');
  const sla = index.indexOf('/atlas-ops-v7-sla.js?v=7.1');
  const data = index.indexOf('/atlas-ops-v7-data.js?v=7.1');
  const engine = index.indexOf('/atlas-ops-v7-engine.js?v=7.1');
  const ui = index.indexOf('/atlas-ops-v7-ui.js?v=7.1');
  assert.ok(rolePermissions >= 0, 'role-permissions loader must exist');
  assert.ok(sla > rolePermissions, 'SLA module must load after role permissions');
  assert.ok(data > sla, 'data module must load after SLA module');
  assert.ok(engine > data, 'engine module must load after data module');
  assert.ok(ui > engine, 'UI module must load after engine module');
});

test('data adapter performs no Supabase query before authenticated profile readiness', async () => {
  const db = fakeDb();
  const adapter = loadDataAdapter({profile:null,db});
  assert.equal(await adapter.ready(), false);
  assert.deepEqual(JSON.parse(JSON.stringify(await adapter.capabilities())), {available:false,reason:'auth_not_ready'});
  assert.equal(db.calls.length, 0);
});

test('capability detection converts missing-schema codes to unavailable without throwing', async () => {
  for (const code of ['42P01','PGRST205']) {
    const db = fakeDb({process_operations:{data:null,error:{code,message:'missing'}}});
    const adapter = loadDataAdapter({profile:{id:'u1',organization_id:'org-1'},db});
    const cap = await adapter.capabilities();
    assert.deepEqual(JSON.parse(JSON.stringify(cap)), {available:false,reason:'schema_unavailable'});
  }
});

test('direct operational reads are scoped from authenticated profile organization only', async () => {
  const db = fakeDb();
  const profile = {id:'u1',organization_id:'org-77'};
  const adapter = loadDataAdapter({profile,db});
  assert.equal((await adapter.capabilities()).available, true);
  await adapter.loadCentral({status:'pending'});
  await adapter.loadTeams();
  await adapter.loadHolidays();
  const directReads = db.calls.filter(call => call.type==='from');
  assert.ok(directReads.length >= 6);
  for (const call of directReads) {
    assert.ok(call.filters.some(([column,value]) => column==='organization_id' && value==='org-77'), `${call.table} must be organization scoped`);
  }
});

test('adapter exposes the approved API and reuses atlasAuth client for RPC calls', async () => {
  const db = fakeDb();
  const adapter = loadDataAdapter({profile:{id:'u1',organization_id:'org-1'},db});
  for (const name of ['ready','capabilities','loadCentral','loadProcess','loadTeams','loadHolidays','rpc']) assert.equal(typeof adapter[name], 'function');
  const result = await adapter.rpc('atlas_v71_start_task',{p_task_id:'t1'});
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {ok:true});
  assert.ok(db.calls.some(call => call.type==='rpc' && call.name==='atlas_v71_start_task'));
});
