import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestTimes, topSlots, localWeekdayHour } from '../lib/best-times.ts';

test('converte UTC para hora de Brasília', () => {
  // 22/10/2026 22:00 UTC = 19:00 em São Paulo (quinta-feira)
  assert.deepEqual(localWeekdayHour('2026-10-22T22:00:00Z'), { weekday: 4, hour: 19 });
  // 23/10/2026 02:30 UTC = 22/10 23:30 em São Paulo (ainda quinta)
  assert.deepEqual(localWeekdayHour('2026-10-23T02:30:00Z'), { weekday: 4, hour: 23 });
});

test('gera 7x24 células e janela sem dados fica nula', () => {
  const cells = bestTimes([], []);
  assert.equal(cells.length, 168);
  assert.ok(cells.every((c) => c.score === null));
});

test('melhor horário combina online e desempenho', () => {
  const online = [
    { weekday: 4, hour: 19, value: 300 },
    { weekday: 4, hour: 12, value: 100 },
    { weekday: 1, hour: 8, value: 200 },
  ];
  const posts = [
    { publishedAt: '2026-10-22T22:00:00Z', views: 4000, followersAtTime: 400 }, // qui 19h — forte
    { publishedAt: '2026-10-19T11:00:00Z', views: 200, followersAtTime: 400 },  // seg 08h — fraco
  ];
  const top = topSlots(bestTimes(online, posts), 2);
  assert.equal(top[0].weekday, 4);
  assert.equal(top[0].hour, 19);
  assert.equal(top[0].score, 100);
});

test('horário sem posts não ganha de horário testado com bom resultado', () => {
  const online = [
    { weekday: 1, hour: 20, value: 300 }, // muita gente online, nunca postou
    { weekday: 4, hour: 19, value: 250 }, // postou e foi bem
    { weekday: 2, hour: 9, value: 50 },   // postou e foi mal
  ];
  const posts = [
    { publishedAt: '2026-10-22T22:00:00Z', views: 4000, followersAtTime: 400 },
    { publishedAt: '2026-10-20T12:00:00Z', views: 100, followersAtTime: 400 },
  ];
  const top = topSlots(bestTimes(online, posts), 1)[0];
  assert.deepEqual([top.weekday, top.hour], [4, 19]);
});

test('post sem views ou sem base de seguidores é ignorado', () => {
  const cells = bestTimes([], [{ publishedAt: '2026-10-22T22:00:00Z', views: null, followersAtTime: 400 }]);
  assert.ok(cells.every((c) => c.posts === 0));
});
