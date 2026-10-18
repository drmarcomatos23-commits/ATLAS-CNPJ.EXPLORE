import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const url=new URL('../previews/atlas-checklist-operacional.html',import.meta.url);
const preview=existsSync(url)?readFileSync(url,'utf8'):'';

test('standalone checklist demo cannot access production database or any network API',()=>{
 assert.match(preview,/<!doctype html>/i);
 assert.match(preview,/Demonstração.*não grava|Demonstração sem gravação/i);
 assert.doesNotMatch(preview,/atlas-auth\.js|createClient\(|supabase\.co|sb_publishable_|fetch\(|XMLHttpRequest|WebSocket|<script[^>]+src=/i);
});

test('preview exposes functional service/status/owner/due filters and nonblocking stage action',()=>{
 for(const name of ['serviceSelect','statusFilter','originFilter','docsList','stageButton','saveDocument','assigned_to','pending_with','due_on'])
  assert.ok(preview.includes(name),name);
 assert.match(preview,/abertura/);
 assert.match(preview,/encerramento/);
 assert.match(preview,/cliente/);
 assert.match(preview,/financeiro/);
 assert.match(preview,/orgao/);
 assert.match(preview,/operacao/);
});
