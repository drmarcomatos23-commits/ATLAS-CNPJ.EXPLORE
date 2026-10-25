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
  assert.equal(w.AtlasCentralV8.version, '8.0');
  assert.deepEqual(Object.keys(w.AtlasCentralV8.pages).sort(), ['agenda', 'certidoes', 'exigencias', 'protocolos', 'tarefas']);
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
  assert.match(html, /central-legalizacao-v8\.js\?v=8\.0/);
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
