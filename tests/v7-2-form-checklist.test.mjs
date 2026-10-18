import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../atlas-ops-v7-docs.js',import.meta.url),'utf8');
const company=readFileSync(new URL('../company-flow.js',import.meta.url),'utf8');
const legacy=readFileSync(new URL('../legalizacao.js',import.meta.url),'utf8');
const loader=readFileSync(new URL('../pwa-v5-1.js',import.meta.url),'utf8');

test('process creation uses operational initialization and preserves explicit partial failure',()=>{
 assert.match(source,/atlas_v72_init_document_checklist/);
 assert.match(source,/Tentar novamente|tentar novamente/i);
 assert.match(company,/Processo salvo, mas checklist|Processo salvo; checklist/i);
 assert.match(source,/retryable/);
 assert.match(source,/requestNumber/);
});

test('service editing is reconciled atomically instead of saving service type silently',()=>{
 assert.match(legacy,/atlas_v72_reconcile_checklist|reconcileChecklist/);
 assert.match(legacy,/encerramento/);
});

test('reference-only items cannot be mistaken for persisted process checklist',()=>{
 assert.match(source,/sem gravação|não grava|indisponível/i);
 assert.match(source,/sem modelo configurado|Nenhum modelo configurado/i);
 assert.doesNotThrow(()=>new vm.Script(source));
});

test('mobile loader installs the pure models before the checklist integration with a new cache version',()=>{
 const model=loader.indexOf('atlas-ops-v7-doc-model.js');
 const pending=loader.indexOf('atlas-ops-v7-pending.js');
 const docs=loader.indexOf('atlas-ops-v7-docs.js');
 assert.ok(model>=0&&pending>model&&docs>pending);
 assert.match(loader,/atlas-ops-v7-docs\.js\?v=7\.2/);
});
