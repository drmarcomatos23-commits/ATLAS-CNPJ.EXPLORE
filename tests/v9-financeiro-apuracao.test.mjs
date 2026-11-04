import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load() {
  const w = { document: undefined, sessionStorage: { getItem: () => null, setItem() {} } };
  w.window = w;
  vm.runInNewContext(fs.readFileSync('financeiro-apuracao.js', 'utf8'), { window: w, document: undefined, sessionStorage: w.sessionStorage, Intl, Date, Math, Number, String, Map, Set, Promise, Array, Object, RegExp, URL, Blob: class {}, alert() {}, confirm: () => true });
  return w.AtlasFinanceiro;
}
const F = load();

test('parcelas mensais: soma exata e vencimento no fim do mês quando o dia não existe', () => {
  const p = F.splitInstallments(1000, 3, '2026-01-31');
  assert.deepEqual([...p.map(x => x.amount)], [333.34, 333.33, 333.33]);
  assert.equal(Math.round(p.reduce((n, x) => n + x.amount, 0) * 100), 100000);
  assert.deepEqual([...p.map(x => x.due_date)], ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(F.splitInstallments(3242, 2, '2026-11-10').map(x => [x.amount, x.due_date]), [[1621, '2026-11-10'], [1621, '2026-12-10']]);
});

test('situação automática: sem baixa e vencimento passado = vencido', () => {
  const today = '2026-11-04';
  assert.equal(F.feeState({ payment_status: 'pending', due_date: '2026-11-03' }, today), 'late');
  assert.equal(F.feeState({ payment_status: 'pending', due_date: '2026-11-04' }, today), 'open');
  assert.equal(F.feeState({ payment_status: 'paid', due_date: '2026-10-01', paid_at: '2026-10-20' }, today), 'paid');
  assert.equal(F.feeState({ payment_status: 'pending', due_date: null }, today), 'nodue');
});

test('apuração do mês: previsto, recebido, a vencer, vencido, caixa e atrasados anteriores', () => {
  const H = (o) => ({ fee_kind: 'honorarios', cost_type: 'hourly', ...o });
  const costs = [
    H({ id: 1, amount: 1000, due_date: '2026-11-02', payment_status: 'pending' }),              // vencido no mês
    H({ id: 2, amount: 500, due_date: '2026-11-20', payment_status: 'pending' }),               // a vencer
    H({ id: 3, amount: 700, due_date: '2026-11-01', payment_status: 'paid', paid_at: '2026-11-01' }), // recebido no mês
    H({ id: 4, amount: 300, due_date: '2026-10-10', payment_status: 'paid', paid_at: '2026-11-03' }), // caixa de outro mês
    H({ id: 5, amount: 250, due_date: '2026-09-10', payment_status: 'pending' }),               // atrasado anterior
    H({ id: 6, amount: 90, due_date: null, payment_status: 'pending' }),                        // sem vencimento
    { id: 7, fee_kind: 'junta_cartorio', amount: 999, due_date: '2026-11-05', payment_status: 'pending' } // taxa: fora
  ];
  const A = F.apuracao(costs, '2026-11', '2026-11-04');
  assert.equal(A.total, 2200);
  assert.equal(A.totalPaid, 700);
  assert.equal(A.totalOpen, 500);
  assert.equal(A.totalLate, 1000);
  assert.equal(A.totalCash, 1000);
  assert.equal(A.totalCashOther, 300);
  assert.equal(A.totalCarried, 250);
  assert.equal(A.totalNoDue, 90);
  assert.equal(A.rate, 32);
});

test('rótulo da parcela e planilha da apuração', () => {
  assert.equal(F.installmentLabel({ metadata: { installment: { n: 2, total: 5 } } }), '2/5');
  assert.equal(F.installmentLabel({ description: 'Honorários do serviço · Parcela 3/4' }), '3/4');
  assert.equal(F.installmentLabel({ description: 'Honorários do serviço' }), 'Única');
  const D = { costs: [{ id: 'a', process_id: 'p', fee_kind: 'honorarios', amount: 1621, due_date: '2026-11-10', payment_status: 'pending', metadata: { installment: { n: 1, total: 2 } } }], processMap: new Map([['p', { public_code: 'LEG-1', client_id: 'c' }]]), clientMap: new Map([['c', { legal_name: 'Empresa X', tax_id: '1' }]]) };
  const rows = F.csvRows(D, '2026-11', '2026-11-04');
  assert.equal(rows.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(rows[1].slice(1, 8))), ['10/11/2026', 'LEG-1', 'Empresa X', '1', '1/2', '1621,00', 'A vencer']);
});

test('cadastro do processo: vencimento obrigatório, parcelamento e validação antes de salvar', () => {
  const s = fs.readFileSync('process-financial.js', 'utf8');
  assert.match(s, /name="proc-honor-mode" value="parcelado"/);
  assert.match(s, /O vencimento é obrigatório para o controle mensal/);
  assert.match(s, /A soma das parcelas/);
  assert.match(s, /const finCheck=readHonorarios\(\);\s*if\(finCheck\.error\)/);
  assert.ok(s.indexOf('const finCheck=readHonorarios()') < s.indexOf("btn.disabled=true;btn.textContent='Salvando...'"));
  assert.match(s, /installment:\{n:it\.n,total:N\}/);
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.indexOf('financial-costs.js') < html.indexOf('financeiro-apuracao.js'));
});

test('cadastro de empresa bloqueia duplicidade (banco + telas)', () => {
  const sql = fs.readFileSync('supabase/migrations/20261104_clientes_sem_duplicidade_v9_6.sql', 'utf8');
  assert.match(sql, /create unique index if not exists clients_org_cnpj_unique/);
  assert.match(sql, /create or replace trigger atlas_prevent_duplicate_client/);
  const reg = fs.readFileSync('company-registration.js', 'utf8');
  const quick = fs.readFileSync('company-flow.js', 'utf8');
  assert.match(reg, /atlas_find_client_duplicate/);
  assert.match(reg, /ATLAS_DUPLICIDADE/);
  assert.ok(quick.indexOf("rpc('atlas_find_client_duplicate'") < quick.indexOf(".from('clients')\n        .insert("));
});

test('apuração separa recebido no mês, com atraso e caixa (caso KORINHO)', () => {
  const H = (o) => ({ fee_kind: 'honorarios', ...o });
  const A = F.apuracao([
    H({ amount: 100, due_date: '2026-10-16', payment_status: 'paid', paid_at: '2026-10-30' }),
    H({ amount: 3242, due_date: '2026-10-30', payment_status: 'paid', paid_at: '2026-11-03' }),
    H({ amount: 50, due_date: '2026-10-20', payment_status: 'pending' })
  ], '2026-10', '2026-11-04');
  assert.equal(A.totalPaid, 3342);
  assert.equal(A.totalPaidIn, 100);
  assert.equal(A.totalPaidLater, 3242);
  assert.equal(A.totalCash, 100);
  assert.equal(A.totalLate, 50);
  assert.equal(A.total, A.totalPaidIn + A.totalPaidLater + A.totalPaidEarly + A.totalLate + A.totalOpen);
});
