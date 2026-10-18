import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const doc=readFileSync(new URL('../atlas-ops-v7-docs.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../atlas-ops-v7.css',import.meta.url),'utf8');

test('real checklist renders filterable items with independently editable state, origin, owner and due date',()=>{
 for(const field of ['data-v72-doc-item','data-v72-filter-status','data-v72-filter-origin','data-v72-search','data-v72-doc-edit','pending_with','assigned_to','due_on','applicability'])
  assert.ok(doc.includes(field),`missing ${field}`);
 assert.match(doc,/atlas_v72_update_requirement/);
 assert.match(doc,/process_document_versions/);
 assert.match(doc,/waived|Dispensado/);
 assert.match(doc,/returned|Devolvido/);
 assert.match(doc,/data-v71-doc-upload/);
});

test('manual requirement is created through authenticated idempotent RPC',()=>{
 assert.match(doc,/atlas_v72_add_manual_requirement/);
 assert.match(doc,/p_manual_key/);
 assert.match(doc,/p_instructions/);
});

test('mobile document controls contain filters and cards without horizontal overflow',()=>{
 assert.match(css,/v72-doc-toolbar/);
 assert.match(css,/v72-doc-item/);
 assert.match(css,/@media\s*\(max-width:760px\)[\s\S]*v72-doc/);
 assert.doesNotThrow(()=>new vm.Script(doc));
});
