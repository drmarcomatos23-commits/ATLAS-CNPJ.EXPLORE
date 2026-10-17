import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const familySource = readFileSync('enterprise-family-v5-1.js', 'utf8');
const familyCss = readFileSync('enterprise-family-v5-1.css', 'utf8');
const searchSource = readFileSync('command-center-v4.js', 'utf8');

const clients = [
  { id:'m1', legal_name:'Reliance Agencia Maritima Matriz', trade_name:'Reliance', tax_id:'11.222.333/0001-44', city:'Santos', state:'SP', metadata:{ establishment_type:'matriz' } },
  { id:'b1', legal_name:'Reliance Agencia Maritima Filial Sao Vicente', trade_name:'Reliance SV', tax_id:'11.222.333/0003-06', city:'Sao Vicente', state:'SP', metadata:{ establishment_type:'filial', parent_client_id:'m1' } },
  { id:'m2', legal_name:'Empresa Isolada', tax_id:'99.888.777/0001-55', city:'Praia Grande', state:'SP', metadata:{ establishment_type:'matriz' } }
];

function loadFamilyApi(){
  const context = {
    console,
    Date,
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
  vm.runInContext(familySource, context);
  return context.window.AtlasEnterpriseFamilyV51;
}

function loadSearchApi(){
  const context = {
    console,
    Date,
    setTimeout: () => 0,
    clearTimeout: () => {},
    globalThis: {},
    document: {}
  };
  context.window = context.globalThis;
  context.globalThis.window = context.globalThis;
  context.globalThis.document = context.document;
  vm.createContext(context);
  vm.runInContext(searchSource, context);
  return context.globalThis.AtlasV4Search;
}

test('Empresa 360 detalha indicadores por matriz e filial sem misturar client_id', () => {
  const api = loadFamilyApi();
  assert.equal(typeof api.buildEstablishmentBreakdown, 'function');
  const family = api.familyForClient('b1', clients);
  const rows = api.buildEstablishmentBreakdown(family, {
    processes:[
      { id:'p1', client_id:'m1', status:'in_progress' },
      { id:'p2', client_id:'b1', status:'completed' },
      { id:'px', client_id:'m2', status:'pending' }
    ],
    licenses:[
      { id:'l1', client_id:'m1', expires_at:'2027-01-10' },
      { id:'l2', client_id:'b1', expires_at:'2026-01-10' }
    ],
    documents:[
      { id:'d1', client_id:'m1', process_id:null },
      { id:'d2', client_id:null, process_id:'p2' }
    ],
    costs:[
      { id:'c1', process_id:'p1', amount:100, payment_status:'paid' },
      { id:'c2', process_id:'p2', amount:50, payment_status:'pending' }
    ]
  }, new Date('2026-10-13T01:00:00-03:00'));

  assert.equal(rows.length, 2);
  assert.equal(rows[0].type, 'matriz');
  assert.equal(rows[0].establishmentNumber, '0001');
  assert.equal(rows[0].processes.total, 1);
  assert.equal(rows[0].financial.total, 100);
  assert.equal(rows[1].type, 'filial');
  assert.equal(rows[1].establishmentNumber, '0003');
  assert.equal(rows[1].processes.total, 1);
  assert.equal(rows[1].documents, 1);
  assert.equal(rows[1].financial.pending, 50);
});

test('Empresa 360 renderiza detalhamento por estabelecimento e abre a unidade escolhida', () => {
  assert.match(familySource, /Detalhamento por estabelecimento/);
  assert.match(familySource, /openFamilyEstablishment/);
  assert.match(familyCss, /company-360-family-breakdown/);
  assert.match(familyCss, /family-establishment-row/);
});

test('busca global encontra filial por tipo numero cidade e contexto da matriz', () => {
  const S = loadSearchApi();
  S.buildIndex({ clients, processes:[], licenses:[], documents:[], costs:[] });

  const byNumber = S.search('filial 0003').find(x => x.id === 'b1');
  const byCity = S.search('filial sao vicente').find(x => x.id === 'b1');
  const byMatrix = S.search('filial reliance matriz').find(x => x.id === 'b1');
  const matrix = S.search('matriz santos').find(x => x.id === 'm1');

  assert.ok(byNumber);
  assert.ok(byCity);
  assert.ok(byMatrix);
  assert.ok(matrix);
  assert.match(byNumber.meta, /Filial 0003/);
  assert.match(matrix.meta, /Matriz/);
});
