import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = globalThis;
globalThis.document = {};
await import('../command-center-v4.js');

const source = readFileSync('command-center-v4.js', 'utf8');

test('busca global V5.1 indexa financeiro e preserva contexto de empresa/processo', () => {
  const S = globalThis.AtlasV4Search;
  S.buildIndex({
    clients: [{ id: 'c1', legal_name: 'Empresa Atlas', tax_id: '12.345.678/0001-90' }],
    processes: [{ id: 'p1', public_code: 'LEG-101', title: 'Alteração Contratual', client_id: 'c1' }],
    licenses: [{ id: 'l1', name: 'AVCB', client_id: 'c1' }],
    documents: [{ id: 'd1', name: 'Contrato Social.pdf', client_id: 'c1', process_id: 'p1' }],
    costs: [{ id: 'f1', description: 'Taxa JUCESP', process_id: 'p1', amount: 286.52, payment_status: 'pending' }]
  });

  const financeiro = S.search('jucesp').find(x => x.type === 'financeiro');
  const documento = S.search('contrato social').find(x => x.type === 'documento');
  const licenca = S.search('avcb').find(x => x.type === 'licenca');

  assert.equal(financeiro.process_id, 'p1');
  assert.equal(financeiro.client_id, 'c1');
  assert.equal(documento.process_id, 'p1');
  assert.equal(documento.client_id, 'c1');
  assert.equal(licenca.client_id, 'c1');
});

test('resultados são agrupados por categoria em ordem operacional', () => {
  const S = globalThis.AtlasV4Search;
  const grouped = S.groupResults([
    { type: 'documento', id: 'd1' },
    { type: 'empresa', id: 'c1' },
    { type: 'processo', id: 'p1' },
    { type: 'financeiro', id: 'f1' }
  ]);
  assert.deepEqual(grouped.map(g => g.type), ['empresa', 'processo', 'documento', 'financeiro']);
});

test('ativação abre diretamente Empresa 360 ou processo quando houver contexto', () => {
  const S = globalThis.AtlasV4Search;
  let openedCompany = null;
  let openedProcess = null;
  globalThis.openCompany360V5 = id => { openedCompany = id; };
  globalThis.openAtlasV4Process = id => { openedProcess = id; };

  S.activate({ type: 'empresa', id: 'c1' });
  assert.equal(openedCompany, 'c1');

  S.activate({ type: 'processo', id: 'p1' });
  assert.equal(openedProcess, 'p1');

  openedProcess = null;
  S.activate({ type: 'documento', id: 'd1', process_id: 'p1', client_id: 'c1' });
  assert.equal(openedProcess, 'p1');
});

test('busca intercepta Enter antes do alerta legado e oferece navegação por teclado', () => {
  assert.match(source, /addEventListener\(['"]keydown['"],[\s\S]*true\)/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /Escape/);
  assert.match(source, /groupResults/);
});
