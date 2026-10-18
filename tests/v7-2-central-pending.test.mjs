import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=readFileSync(new URL('../atlas-ops-v7-data.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../atlas-ops-v7-ui.js',import.meta.url),'utf8');

test('Central loads canonical document requirements alongside original costs, tasks and agency exigencies',()=>{
 assert.match(data,/scoped\('process_document_requirements','\*'/);
 assert.match(data,/docRequirements:docRequirements\.data/);
 assert.match(ui,/AtlasOpsV72Pending/);
 assert.match(ui,/pendingDocuments/);
});

test('document queue is clickable and shows source items per original process',()=>{
 assert.match(ui,/kpi\('Pendências documentais'/);
 assert.match(ui,/f\.queue==='documents'/);
 assert.match(ui,/data-v71-process-open/);
});
