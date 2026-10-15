import test from 'node:test';
import assert from 'node:assert/strict';

// Provide the minimal browser globals used by the production module.
globalThis.window = globalThis;
globalThis.document = {
  addEventListener() {},
  readyState: 'loading',
  getElementById() { return null; },
  querySelector() { return null; }
};

await import('../dashboard-v6.js');

const D = globalThis.AtlasDashboardV6;

test('V6 dashboard model returns zeros and empty collections without fake values', () => {
  const model = D.buildModel({
    companies: [], processes: [], licenses: [], costs: [], pending: [], documents: [], now: '2026-10-15T12:00:00-03:00'
  });
  assert.deepEqual(model.kpis, {
    companies: 0,
    activeProcesses: 0,
    expiringLicenses: 0,
    monthlyHonoraria: 0,
    pending: 0,
    documents: 0
  });
  assert.deepEqual(model.pipeline.map(x => x.count), [0,0,0,0,0,0]);
  assert.deepEqual(model.recentProcesses, []);
  assert.deepEqual(model.statusDistribution, []);
  assert.deepEqual(model.companyTypes, []);
  assert.deepEqual(model.deadlines, []);
});

test('V6 dashboard counts active processes and preserves the six approved pipeline stages', () => {
  const model = D.buildModel({
    companies: [],
    processes: [
      { id: 'p1', status: 'Em andamento', stage: 'Consulta de Viabilidade' },
      { id: 'p2', status: 'Aguardando', stage: 'DBE' },
      { id: 'p3', status: 'Em análise', stage: 'Junta Comercial' },
      { id: 'p4', status: 'Concluído', stage: 'Pós-abertura' },
      { id: 'p5', status: 'Cancelado', stage: 'Licenças' }
    ],
    licenses: [], costs: [], pending: [], documents: [], now: '2026-10-15T12:00:00-03:00'
  });
  assert.equal(model.kpis.activeProcesses, 3);
  assert.deepEqual(model.pipeline.map(x => x.label), [
    'Consulta de Viabilidade',
    'DBE / Receita Federal',
    'Junta Comercial',
    'Alvará Municipal',
    'Licenças / Órgãos Reguladores',
    'Pós-abertura / Regularização'
  ]);
  assert.deepEqual(model.pipeline.map(x => x.count), [1,1,1,0,1,1]);
});

test('V6 dashboard sorts deadlines and recent processes using real dates', () => {
  const model = D.buildModel({
    companies: [{ id:'c1', legal_name:'Empresa Alfa' }],
    processes: [
      { id:'p1', client_id:'c1', title:'Alteração', status:'Em andamento', updated_at:'2026-10-10T10:00:00Z' },
      { id:'p2', client_id:'c1', title:'Abertura', status:'Aguardando', updated_at:'2026-10-14T10:00:00Z' }
    ],
    licenses: [
      { id:'l1', client_id:'c1', name:'AVCB', final_date:'2026-11-20' },
      { id:'l2', client_id:'c1', name:'Licença Sanitária', final_date:'2026-10-22' }
    ],
    costs: [], pending: [], documents: [], now: '2026-10-15T12:00:00-03:00'
  });
  assert.deepEqual(model.recentProcesses.map(x => x.id), ['p2','p1']);
  assert.deepEqual(model.deadlines.map(x => x.id), ['l2','l1']);
  assert.equal(model.deadlines[0].companyName, 'Empresa Alfa');
});

test('V6 dashboard sums only current-month honoraria with paid or receivable business records', () => {
  const model = D.buildModel({
    companies: [], processes: [], licenses: [], pending: [], documents: [],
    costs: [
      { id:'f1', type:'honorarios', amount:1200, date:'2026-10-03' },
      { id:'f2', category:'Honorários', value:800, due_date:'2026-10-21' },
      { id:'f3', type:'taxa', amount:5000, date:'2026-10-08' },
      { id:'f4', type:'honorarios', amount:300, date:'2026-09-30' }
    ],
    now: '2026-10-15T12:00:00-03:00'
  });
  assert.equal(model.kpis.monthlyHonoraria, 2000);
});

test('V6 dashboard groups companies by real type and status distribution totals all processes', () => {
  const model = D.buildModel({
    companies: [
      { id:'c1', legal_nature:'LTDA' },
      { id:'c2', company_type:'LTDA' },
      { id:'c3', legal_nature:'S/A' }
    ],
    processes: [
      { id:'p1', status:'Em andamento' },
      { id:'p2', status:'Concluído' },
      { id:'p3', status:'Aguardando' },
      { id:'p4', status:'Em análise' },
      { id:'p5', status:'Cancelado' }
    ],
    licenses: [], costs: [], pending: [], documents: [], now:'2026-10-15T12:00:00-03:00'
  });
  assert.deepEqual(model.companyTypes, [
    { label:'LTDA', count:2 },
    { label:'S/A', count:1 }
  ]);
  assert.equal(model.statusDistribution.reduce((sum, item) => sum + item.count, 0), 5);
});
