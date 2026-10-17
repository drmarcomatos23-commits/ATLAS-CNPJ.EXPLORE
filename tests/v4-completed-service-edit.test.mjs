import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('processo concluido oferece alteracao isolada do servico',()=>{
  const ops=fs.readFileSync('operations-v4.js','utf8');
  const editor=fs.readFileSync('process-service-edit-v4.js','utf8');
  const index=fs.readFileSync('index.html','utf8');
  assert.match(ops,/completed[\s\S]{0,300}openProcessServiceEditor/);
  assert.match(ops,/Alterar serviço/);
  assert.match(editor,/async function openProcessServiceEditor\(id\)/);
  assert.match(editor,/update\(\{service_type:value\}\)/);
  assert.ok(!/update\(\{[^}]*completed_at/.test(editor));
  assert.ok(!/update\(\{[^}]*status/.test(editor));
  assert.ok(index.includes('/process-service-edit-v4.js?v=4.1'));
});
