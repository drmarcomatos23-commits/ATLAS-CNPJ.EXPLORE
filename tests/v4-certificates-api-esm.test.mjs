import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('API de certidoes usa ESM compativel com o projeto',()=>{
  const api=fs.readFileSync('api/certificates.js','utf8');
  assert.match(api,/export default async function handler/);
  assert.doesNotMatch(api,/module\.exports/);
});
