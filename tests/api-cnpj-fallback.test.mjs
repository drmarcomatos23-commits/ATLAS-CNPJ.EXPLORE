import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/cnpj.js';

function mockRes() { const r = { code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; return r; }
function withFetch(fn, impl) { const orig = globalThis.fetch; globalThis.fetch = impl; return fn().finally(() => { globalThis.fetch = orig; }); }
const reply = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

test('CNPJ ausente nas bases públicas retorna 404 com mensagem clara (não "indisponível")', () => withFetch(async () => {
  const res = mockRes();
  await handler({ method: 'GET', query: { cnpj: '69.724.868/0001-30' } }, res);
  assert.equal(res.code, 404);
  assert.match(res.body.detalhes, /ainda não aparece nas bases públicas/);
}, async () => reply(404, { message: 'not found' })));

test('usa CNPJá aberto como terceira fonte gratuita', () => withFetch(async () => {
  const res = mockRes();
  await handler({ method: 'GET', query: { cnpj: '69724868000130' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.headers['X-Atlas-Source'], 'cnpja');
  assert.equal(res.body.razao_social, 'EMPRESA NOVA LTDA');
  assert.equal(res.body.estabelecimento.cidade.nome, 'Santos');
  assert.equal(res.body.socios[0].nome, 'FULANO');
}, async (url) => String(url).includes('open.cnpja.com')
  ? reply(200, { taxId: '69724868000130', alias: null, founded: '2026-10-20', head: true, status: { text: 'Ativa' }, company: { name: 'EMPRESA NOVA LTDA', equity: 1000, nature: { text: 'Sociedade Empresária Limitada' }, size: { text: 'Microempresa' }, members: [{ since: '2026-10-20', person: { name: 'FULANO', type: 'NATURAL' }, role: { text: 'Sócio-Administrador' } }] }, address: { street: 'Rua X', number: '1', district: 'Centro', city: 'Santos', state: 'SP', zip: '11010000' }, mainActivity: { id: 6911701, text: 'Serviços advocatícios' }, sideActivities: [] })
  : reply(404, { message: 'not found' })));

test('falha de rede em todas as fontes continua retornando 502', () => withFetch(async () => {
  const res = mockRes();
  await handler({ method: 'GET', query: { cnpj: '69724868000130' } }, res);
  assert.equal(res.code, 502);
}, async () => reply(503, { message: 'down' })));
