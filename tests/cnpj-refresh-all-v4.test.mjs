import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('cnpj-refresh-all-v4.js','utf8');
const html=fs.readFileSync('index.html','utf8');

test('Consultar CNPJ carrega regra de atualização geral',()=>{
  assert.ok(html.includes('/cnpj-refresh-all-v4.js?v=4.1'));
  assert.match(js,/async function refreshAllRegisteredCnpjs\(/);
  assert.match(js,/from\('clients'\)\.select\('id,tax_id,metadata'\)/);
  assert.match(js,/closest\?\.\('#client-cnpj-consult'\)/);
});

test('lote altera somente os dez campos oficiais e preserva campos manuais ausentes',()=>{
  const start=js.indexOf('function officialCompanyPatch');
  const end=js.indexOf('async function refreshAllRegisteredCnpjs',start);
  const block=js.slice(start,end);
  for(const field of ['legal_name','trade_name','state_registration','postal_code','street','address_number','address_complement','neighborhood','city','state']) assert.ok(block.includes(field),field);
  assert.equal(block.includes('phone:'),false);
  assert.equal(block.includes('email:'),false);
  assert.match(block,/filter\(\(\[,value\]\)=>value!==undefined&&value!==null&&String\(value\)\.trim\(\)!==''\)/);
});

test('falhas individuais nao interrompem a atualização geral',()=>{
  assert.match(js,/for\(const client of clients\)/);
  assert.match(js,/catch\(err\)\{\s*failed\+\+/s);
  assert.ok(js.includes("btn.textContent='Atualizando base...'"));
});
