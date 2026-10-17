import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const modulePath = 'enterprise-family-v5-1.js';
const cssPath = 'enterprise-family-v5-1.css';
const source = existsSync(modulePath) ? readFileSync(modulePath, 'utf8') : '';
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
const index = readFileSync('index.html', 'utf8');

function loadApi(){
  const context = {
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    window: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ className:'', dataset:{}, style:{}, appendChild(){}, addEventListener(){}, innerHTML:'' })
    }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.AtlasCompanyHierarchyV51 = {
    cnpjRoot(value){ return String(value || '').replace(/\D/g,'').slice(0,8); },
    establishmentType(record){
      const saved = String(record?.metadata?.establishment_type || '').toLowerCase();
      if(saved === 'matriz' || saved === 'filial') return saved;
      const d = String(record?.tax_id || '').replace(/\D/g,'');
      return d.length === 14 && d.slice(8,12) !== '0001' ? 'filial' : 'matriz';
    },
    normalizeClientHierarchy(record,list=[]){
      const type = this.establishmentType(record);
      const root = this.cnpjRoot(record?.tax_id);
      const parent = type === 'filial'
        ? (record?.metadata?.parent_client_id || list.find(x => x.id !== record.id && this.establishmentType(x) === 'matriz' && this.cnpjRoot(x.tax_id) === root)?.id || null)
        : null;
      return { ...record, establishment_type:type, parent_client_id:parent, cnpj_root:root };
    },
    familyForCompany(current,list=[]){
      const normalized = list.map(x => this.normalizeClientHierarchy(x,list));
      const item = normalized.find(x => x.id === current.id) || this.normalizeClientHierarchy(current,list);
      const matrixId = item.establishment_type === 'filial' ? item.parent_client_id : item.id;
      const matrix = normalized.find(x => x.id === matrixId) || item;
      const branches = normalized.filter(x => x.establishment_type === 'filial' && x.parent_client_id === matrix.id);
      return { matrix, branches, members:[matrix,...branches] };
    }
  };
  vm.createContext(context);
  if(source) vm.runInContext(source, context);
  return context.window.AtlasEnterpriseFamilyV51;
}

const clients = [
  { id:'m1', legal_name:'Reliance Matriz', tax_id:'11.222.333/0001-44', metadata:{ establishment_type:'matriz' } },
  { id:'b1', legal_name:'Reliance Filial 2', tax_id:'11.222.333/0002-25', metadata:{ establishment_type:'filial', parent_client_id:'m1' } },
  { id:'b2', legal_name:'Reliance Filial 3', tax_id:'11.222.333/0003-06', metadata:{ establishment_type:'filial', parent_client_id:'m1' } },
  { id:'m2', legal_name:'Empresa Isolada', tax_id:'99.888.777/0001-55', metadata:{ establishment_type:'matriz' } }
];

test('camada executiva da familia empresarial existe e é carregada após a hierarquia', () => {
  assert.equal(existsSync(modulePath), true, 'enterprise-family-v5-1.js deve existir');
  assert.equal(existsSync(cssPath), true, 'enterprise-family-v5-1.css deve existir');
  assert.match(index, /enterprise-family-v5-1\.css\?v=5\.1/);
  assert.match(index, /enterprise-family-v5-1\.js\?v=5\.1/);
  assert.equal(index.indexOf('company-hierarchy-v5-1.js') < index.indexOf('enterprise-family-v5-1.js'), true);
});

test('dashboard separa matrizes filiais estabelecimentos e familias com filiais', () => {
  const api = loadApi();
  assert.ok(api?.buildStructureMetrics, 'API deve expor buildStructureMetrics');
  const metrics = api.buildStructureMetrics(clients);
  assert.equal(metrics.matrices, 2);
  assert.equal(metrics.branches, 2);
  assert.equal(metrics.establishments, 4);
  assert.equal(metrics.familiesWithBranches, 1);
});

test('familia de uma filial resolve a matriz e todos os estabelecimentos vinculados', () => {
  const api = loadApi();
  const family = api.familyForClient('b1', clients);
  assert.equal(family.matrix.id, 'm1');
  assert.equal(family.branches.length, 2);
  assert.deepEqual(family.members.map(x => x.id), ['m1','b1','b2']);
});

test('consolidacao soma somente dados da matriz e suas filiais sem mover registros', () => {
  const api = loadApi();
  const family = api.familyForClient('b1', clients);
  const summary = api.consolidateFamily(family, {
    processes:[
      { id:'p1', client_id:'m1', status:'in_progress' },
      { id:'p2', client_id:'b1', status:'completed' },
      { id:'p3', client_id:'b2', status:'pending' },
      { id:'px', client_id:'m2', status:'in_progress' }
    ],
    licenses:[
      { id:'l1', client_id:'m1', expires_at:'2027-01-10' },
      { id:'l2', client_id:'b1', expires_at:'2026-01-10' },
      { id:'lx', client_id:'m2', expires_at:'2026-01-10' }
    ],
    documents:[
      { id:'d1', client_id:'m1', process_id:null },
      { id:'d2', client_id:null, process_id:'p2' },
      { id:'d3', client_id:'b2', process_id:null },
      { id:'dx', client_id:'m2', process_id:null }
    ],
    costs:[
      { id:'c1', process_id:'p1', amount:100, payment_status:'paid' },
      { id:'c2', process_id:'p2', amount:50, payment_status:'pending' },
      { id:'cx', process_id:'px', amount:999, payment_status:'paid' }
    ]
  }, new Date('2026-10-12T12:00:00-03:00'));

  assert.equal(summary.processes.total, 3);
  assert.equal(summary.processes.active, 2);
  assert.equal(summary.licenses.total, 2);
  assert.equal(summary.licenses.overdue, 1);
  assert.equal(summary.documents, 3);
  assert.equal(summary.financial.total, 150);
  assert.equal(summary.financial.paid, 100);
  assert.equal(summary.financial.pending, 50);
});

test('interface executiva oferece filtro de matrizes e filiais e visao consolidada', () => {
  assert.match(source, /Estrutura Empresarial/);
  assert.match(source, /Matrizes/);
  assert.match(source, /Filiais/);
  assert.match(source, /Total de estabelecimentos/);
  assert.match(source, /Famílias empresariais/);
  assert.match(source, /openCompaniesByEstablishment/);
  assert.match(source, /Visão consolidada da família/);
  assert.match(source, /openFamilyMatrix/);
  assert.match(css, /enterprise-structure/);
  assert.match(css, /company-360-family-summary/);
});
