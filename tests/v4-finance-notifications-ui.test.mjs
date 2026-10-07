import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('guard V4 carrega assets de notificacao sem alterar shell principal',()=>{
  const guard=fs.readFileSync('dashboard-brand-guard-v4.js','utf8');
  assert.match(guard,/notifications-v4\.css/);
  assert.match(guard,/notifications-v4\.js/);
  assert.match(guard,/ensureNotificationAssets/);
});

test('modulo transforma sino existente e suporta leitura, processo e realtime',()=>{
  assert.equal(fs.existsSync('notifications-v4.js'),true);
  assert.equal(fs.existsSync('notifications-v4.css'),true);
  const js=fs.readFileSync('notifications-v4.js','utf8');
  const css=fs.readFileSync('notifications-v4.css','utf8');
  assert.match(js,/atlas-notification-bell/);
  assert.match(js,/atlas-notification-count/);
  assert.match(js,/from\(['"]atlas_notifications['"]\)/);
  assert.match(js,/recipient_profile_id/);
  assert.match(js,/markRead/);
  assert.match(js,/markAllRead/);
  assert.match(js,/openProcess/);
  assert.match(js,/postgres_changes/);
  assert.match(js,/recipient_profile_id=eq\./);
  assert.match(css,/atlas-notification-count/);
  assert.match(css,/notification-panel/);
  assert.match(css,/@media\s*\(max-width:\s*760px\)/);
});
