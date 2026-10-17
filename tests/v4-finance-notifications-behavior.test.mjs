import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadModule(){
  const code=fs.readFileSync('notifications-v4.js','utf8');
  const listeners={};
  const context={
    console,
    setInterval:()=>0,
    setTimeout:(fn)=>fn(),
    Map,Date,
    window:{innerWidth:1200,addEventListener:()=>{},atlasAuth:null},
    document:{
      readyState:'loading',
      addEventListener:(name,fn)=>{listeners[name]=fn;},
      getElementById:()=>null,
      querySelector:()=>null,
      createElement:()=>({}),
      body:{appendChild:()=>{}}
    }
  };
  context.window.window=context.window;
  vm.createContext(context);
  vm.runInContext(code,context);
  return context.window.AtlasNotificationsV4;
}

test('helpers deduplicam realtime e contam nao lidas',()=>{
  const mod=loadModule();
  assert.equal(mod.__test.formatCount(0),'0');
  assert.equal(mod.__test.formatCount(3),'3');
  assert.equal(mod.__test.formatCount(120),'99+');
  const base=[{id:'a',read_at:null,created_at:'2026-10-07T10:00:00Z'}];
  const merged=mod.__test.mergeById(base,[{id:'a',read_at:null,created_at:'2026-10-07T10:00:00Z'},{id:'b',read_at:'2026-10-07T11:00:00Z',created_at:'2026-10-07T11:00:00Z'}]);
  assert.equal(merged.length,2);
  assert.equal(mod.__test.countUnread(merged),1);
});

test('openProcess e tolerante quando integracao nao existe',()=>{
  const mod=loadModule();
  assert.doesNotThrow(()=>mod.openProcess('p1'));
});

test('banco impede renotificacao da mesma taxa do processo em mero salvamento',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261007_finance_fee_notifications.sql','utf8');
  assert.match(sql,/atlas_notifications_fee_process_once_idx/);
  assert.match(sql,/recipient_profile_id\s*,\s*event_type\s*,\s*process_id/);
  assert.match(sql,/on\s+conflict\s+do\s+nothing/i);
});
