import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../central-legalizacao-v8.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../atlas-v6-shell.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20261024_central_legalizacao_v8.sql', import.meta.url), 'utf8');

function load() {
  const listeners = {};
  const doc = { readyState: 'complete', getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: (k, f) => { listeners[k] = f; }, head: { appendChild() {} }, createElement: () => ({ dataset: {}, style: {}, classList: { add() {} } }), scripts: [] };
  const win = { render() { return 'legacy'; } };
  const ctx = { window: win, document: doc, Intl, Date, setTimeout: () => 0, clearTimeout() {}, console, URL, Blob: class {}, navigator: {}, requestAnimationFrame: f => f() };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return win;
}

test('V8: módulo expõe API e roteia as novas páginas sem quebrar as antigas', () => {
  const w = load();
  assert.equal(w.AtlasCentralV8.version, '8.8');
  assert.deepEqual(Object.keys(w.AtlasCentralV8.pages).sort(), ['agenda', 'certidoes', 'equipe', 'exigencias', 'modelos', 'monitor', 'protocolos', 'tarefas']);
  assert.equal(w.render('dashboard'), 'legacy');
  assert.equal(typeof w.openLegalizacaoPanel, 'function');
});

test('V8: situação de vencimento escalonada (vencido / 30 / 90 / válido / renovação)', () => {
  const { licenseState, addDays } = load().AtlasCentralV8.__test;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  assert.equal(licenseState({ expires_at: addDays(today, -1) }).key, 'expired');
  assert.equal(licenseState({ expires_at: today }).key, 'today');
  assert.equal(licenseState({ expires_at: addDays(today, 20) }).key, 'soon');
  assert.equal(licenseState({ expires_at: addDays(today, 60) }).key, 'attention');
  assert.equal(licenseState({ expires_at: addDays(today, 200) }).key, 'valid');
  assert.equal(licenseState({ status: 'renewing', expires_at: addDays(today, -5) }).key, 'renewing');
  assert.equal(licenseState({}).key, 'nodate');
});

test('V8: data legal prevalece sobre data meta no risco da tarefa', () => {
  const { taskDeadlineState, addDays } = load().AtlasCentralV8.__test;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  assert.equal(taskDeadlineState({ status: 'aberta', target_date: addDays(today, 5), legal_date: addDays(today, 2) }), 'legal_risk');
  assert.equal(taskDeadlineState({ status: 'aberta', target_date: addDays(today, -1) }), 'late');
  assert.equal(taskDeadlineState({ status: 'aberta', target_date: today }), 'today');
  assert.equal(taskDeadlineState({ status: 'concluida', target_date: addDays(today, -9) }), 'done');
});

test('V8: importação aceita datas brasileiras, ISO e seriais do Excel', () => {
  const { parseFlexibleDate } = load().AtlasCentralV8.__test;
  assert.equal(parseFlexibleDate('31/01/2027'), '2027-01-31');
  assert.equal(parseFlexibleDate('2027-01-31'), '2027-01-31');
  assert.equal(parseFlexibleDate('5/3/27'), '2027-03-05');
  assert.equal(parseFlexibleDate(46000), '2025-12-09');
  assert.equal(parseFlexibleDate(''), null);
});

test('V8: escolha automática do modelo de checklist pelo tipo do processo', () => {
  const { guessTemplate } = load().AtlasCentralV8.__test;
  const tpls = ['abertura', 'alteracao', 'baixa', 'renovacao', 'holding'].map(s => ({ service_type: s }));
  assert.equal(guessTemplate(tpls, { title: 'Constituição de Holding Patrimonial' }).service_type, 'holding');
  assert.equal(guessTemplate(tpls, { title: 'Alteração de endereço e CNAE' }).service_type, 'alteracao');
  assert.equal(guessTemplate(tpls, { title: 'Baixa da empresa' }).service_type, 'baixa');
  assert.equal(guessTemplate(tpls, { title: 'Renovação do AVCB' }).service_type, 'renovacao');
});

test('V8: mensagens ao cliente preenchem variáveis e CSV usa ponto e vírgula com BOM', () => {
  const { fillTemplate, csv } = load().AtlasCentralV8.__test;
  assert.equal(fillTemplate('Olá, {contato}! {codigo}', { contato: 'Ana', codigo: 'LEG-1' }), 'Olá, Ana! LEG-1');
  assert.equal(csv([['a', 'b;c']]), '﻿a;"b;c"');
});

test('V8: menu, shell e script registrados; mobile-v6 continua a última folha de estilo', () => {
  for (const p of ['tarefas', 'protocolos', 'certidoes', 'agenda']) {
    assert.match(html, new RegExp(`data-page="${p}"`));
    assert.match(shell, new RegExp(`'${p}'`));
  }
  assert.match(html, /central-legalizacao-v8\.js\?v=8\.8/);
  assert.doesNotMatch(html, /central-legalizacao-v8\.css/);
  assert.match(src, /central-legalizacao-v8\.css/);
});

test('V8: migração protege as novas tabelas por organização e perfil, sem custo externo', () => {
  for (const t of ['process_tasks', 'process_requirements', 'task_templates']) {
    assert.match(migration, new RegExp(`alter table public\\.${t} enable row level security`));
  }
  assert.match(migration, /current_atlas_role\(\) in \('admin','operacao'\)/);
  assert.match(migration, /current_client_external_id\(\)/);
  assert.match(migration, /cron\.schedule\('atlas-legalizacao-alertas-diario'/);
  assert.doesNotMatch(migration + src, /resend|twilio|zapi|api\.whatsapp/i);
});

test('V8.1: arquivos do WhatsApp são ligados ao documento certo pelo nome', () => {
  const { matchDocItem } = load().AtlasCentralV8.__test;
  const items = [
    { id: 'rg', name: 'RG ou CNH dos sócios' }, { id: 'res', name: 'Comprovante de residência dos sócios' },
    { id: 'mat', name: 'Matrículas atualizadas dos imóveis' }, { id: 'ir', name: 'Última declaração de IR dos sócios' },
    { id: 'cas', name: 'Certidão de casamento e pacto antenupcial' }, { id: 'iptu', name: 'IPTU ou valor venal dos imóveis' }
  ];
  assert.equal(matchDocItem('CNH Carlos.pdf', items)?.id, 'rg');
  assert.equal(matchDocItem('conta de luz agosto.jpg', items)?.id, 'res');
  assert.equal(matchDocItem('Matricula 45.321 - 1o RI Santos.pdf', items)?.id, 'mat');
  assert.equal(matchDocItem('IRPF 2026 recibo.pdf', items)?.id, 'ir');
  assert.equal(matchDocItem('certidao casamento.pdf', items)?.id, 'cas');
  assert.equal(matchDocItem('carne IPTU 2026.pdf', items)?.id, 'iptu');
  assert.equal(matchDocItem('WhatsApp Image 2026-10-24 at 10.22.33.jpeg', items), null);
});

test('V8.3: modelos do escritório são escolhidos por palavra-chave antes dos padrões', () => {
  const { guessTemplate } = load().AtlasCentralV8.__test;
  const tpls = [{ service_type: 'holding', name: 'Holding' }, { service_type: 'inventário, partilha, espólio', name: 'Inventário extrajudicial' }, { service_type: 'abertura', name: 'Abertura' }];
  assert.equal(guessTemplate(tpls, { title: 'Inventário do espólio de João' }).name, 'Inventário extrajudicial');
  assert.equal(guessTemplate(tpls, { title: 'Holding da família Silva' }).name, 'Holding');
  assert.equal(guessTemplate(tpls, { title: 'Constituição de empresa' }).name, 'Abertura');
});

test('V8.6: resumo financeiro separa honorários a receber e taxas a reembolsar', () => {
  const { finSummary } = load().AtlasCentralV8.__test;
  const F = finSummary([
    { fee_kind: 'honorarios', amount: 3000, payment_status: 'pending', due_date: '2020-01-01' },
    { fee_kind: 'honorarios', amount: 1000, payment_status: 'paid' },
    { fee_kind: 'junta_cartorio', amount: 300, payment_status: 'paid', reimbursement_status: 'pending' },
    { fee_kind: 'junta_cartorio', amount: 200, payment_status: 'paid', reimbursement_status: 'reimbursed' },
    { fee_kind: 'junta_cartorio', amount: 150, payment_status: 'pending' }
  ]);
  assert.equal(F.feeTotal, 4000); assert.equal(F.feeOpen, 3000); assert.equal(F.feeLate, 3000);
  assert.equal(F.reimb, 300); assert.equal(F.toPay, 150); assert.equal(F.open, 3300);
});

test('V8.7: relatório gerencial conta processos e recebimentos do mês escolhido', () => {
  const { managementData } = load().AtlasCentralV8.__test;
  const procs = [
    { id: 'a', client_id: 'c', title: 'Abertura de empresa', status: 'completed', created_at: '2026-09-02T12:00:00Z', completed_at: '2026-10-12T12:00:00Z' },
    { id: 'b', client_id: 'c', title: 'Alteração de endereço', status: 'in_progress', created_at: '2026-10-05T12:00:00Z', due_date: '2026-10-08' }
  ];
  const data = { processes: procs, processMap: new Map(procs.map(p => [p.id, p])), clients: [{ id: 'c', legal_name: 'X', created_at: '2026-01-01' }], clientMap: new Map([['c', { legal_name: 'X' }]]), profileMap: new Map(), templates: [],
    costs: [{ process_id: 'a', fee_kind: 'honorarios', amount: 1000, payment_status: 'paid', paid_at: '2026-10-15', created_at: '2026-09-02' }, { process_id: 'b', fee_kind: 'honorarios', amount: 500, payment_status: 'pending', created_at: '2026-10-05' }],
    tasks: [], requirements: [], protocols: [], licenses: [] };
  const G = managementData(data, [], '2026-10');
  assert.equal(G.opened.length, 1); assert.equal(G.completed.length, 1); assert.equal(G.late.length, 1);
  assert.equal(G.feeReceived, 1000); assert.equal(G.feeOpen, 500); assert.equal(G.feeLaunched, 500);
  assert.deepEqual([...G.byService.keys()], ['Abertura de empresa']); assert.equal(G.durations[0].d, 40);
});

test('V8.8: painel da equipe mede carga, atrasos e processos parados', () => {
  const { teamData, addDays } = load().AtlasCentralV8.__test;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const procs = [{ id: 'p1', owner_id: 'u1', status: 'in_progress', created_at: addDays(today, -40) + 'T12:00:00Z' }, { id: 'p2', owner_id: 'u2', status: 'in_progress', created_at: addDays(today, -2) + 'T12:00:00Z' }];
  const data = { processes: procs, processMap: new Map(procs.map(p => [p.id, p])), clientMap: new Map(), profileMap: new Map(),
    profiles: [{ id: 'u1', full_name: 'Ana', role: 'operacao' }, { id: 'u2', full_name: 'Beto', role: 'admin' }],
    tasks: [
      { process_id: 'p1', status: 'aberta', target_date: addDays(today, -3), created_at: addDays(today, -40) + 'T12:00:00Z' },
      { process_id: 'p2', status: 'concluida', target_date: addDays(today, 2), completed_at: addDays(today, -1) + 'T12:00:00Z', completed_by: 'u2' },
      { process_id: 'p2', status: 'aberta', assignee_id: 'u1', target_date: addDays(today, 3) }
    ], docItems: [] };
  const T = teamData(data, 30);
  const ana = T.rows.find(r => r.person.id === 'u1'), beto = T.rows.find(r => r.person.id === 'u2');
  assert.equal(ana.open, 2); assert.equal(ana.late, 1); assert.equal(ana.week, 1);
  assert.equal(beto.done, 1); assert.equal(beto.onTime, 1);
  assert.equal(T.stalled.length, 1); assert.equal(T.stalled[0].p.id, 'p1');
});
