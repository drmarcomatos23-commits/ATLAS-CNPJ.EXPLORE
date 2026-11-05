import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadSla(){
  const source = readFileSync(new URL('../atlas-ops-v7-sla.js', import.meta.url), 'utf8');
  const sandbox = { window: {}, console };
  vm.runInNewContext(source, sandbox, { filename: 'atlas-ops-v7-sla.js' });
  return sandbox.window.AtlasOpsV71Sla;
}

test('businessDaysBetween counts weekdays in a deterministic half-open interval', () => {
  const sla = loadSla();
  assert.equal(sla.businessDaysBetween('2026-10-12','2026-10-16'), 4);
  assert.equal(sla.businessDaysBetween('2026-10-16T14:00:00-03:00','2026-10-19T09:00:00-03:00'), 1);
  assert.equal(sla.businessDaysBetween('2026-10-17','2026-10-19'), 0);
});

test('business-day arithmetic excludes weekends and explicit holidays', () => {
  const sla = loadSla();
  assert.equal(sla.addBusinessDays('2026-10-16', 1), '2026-10-19');
  assert.equal(sla.addBusinessDays('2026-10-16', 1, ['2026-10-19']), '2026-10-20');
  assert.equal(sla.businessDaysBetween('2026-10-12','2026-10-16',['2026-10-14']), 3);
});

test('mergePauseIntervals merges overlap and touching intervals without double discount', () => {
  const sla = loadSla();
  const merged = sla.mergePauseIntervals([
    {start:'2026-10-13T09:00:00Z',end:'2026-10-14T12:00:00Z'},
    {start:'2026-10-14T10:00:00Z',end:'2026-10-15T09:00:00Z'},
    {start:'2026-10-15T09:00:00Z',end:'2026-10-15T18:00:00Z'}
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].start, '2026-10-13T09:00:00.000Z');
  assert.equal(merged[0].end, '2026-10-15T18:00:00.000Z');
});

test('SLA snapshot subtracts merged external pauses and reports within/due/overdue states', () => {
  const sla = loadSla();
  const base = {
    stageStartedAt:'2026-10-12T09:00:00-03:00',
    slaDays:3,
    holidays:[],
    pauses:[
      {start:'2026-10-13T08:00:00-03:00',end:'2026-10-14T18:00:00-03:00'},
      {start:'2026-10-14T12:00:00-03:00',end:'2026-10-15T09:00:00-03:00'}
    ]
  };
  assert.deepEqual(
    JSON.parse(JSON.stringify(sla.slaSnapshot({...base,now:'2026-10-16T10:00:00-03:00'}))),
    {elapsedBusinessDays:2,remainingBusinessDays:1,state:'within_sla'}
  );
  assert.equal(sla.slaSnapshot({...base,now:'2026-10-19T10:00:00-03:00'}).state, 'due_today');
  assert.equal(sla.slaSnapshot({...base,now:'2026-10-20T10:00:00-03:00'}).state, 'overdue');
});

test('pause crossing a weekend discounts business dates only', () => {
  const sla = loadSla();
  const snapshot = sla.slaSnapshot({
    stageStartedAt:'2026-10-15T09:00:00-03:00',
    now:'2026-10-20T10:00:00-03:00',
    slaDays:5,
    holidays:[],
    pauses:[{start:'2026-10-16T12:00:00-03:00',end:'2026-10-19T12:00:00-03:00'}]
  });
  assert.equal(snapshot.elapsedBusinessDays, 2);
  assert.equal(snapshot.remainingBusinessDays, 3);
});
