import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followsPerThousand, valueRate, sortBy, postsPerWeek } from '../lib/metrics.ts';
import { delta } from '../lib/format.ts';

test('seguidores por mil views', () => {
  assert.equal(followsPerThousand({ views: 2000, follows: 10, saved: null, shares: null }), 5);
  assert.equal(followsPerThousand({ views: 0, follows: 10, saved: null, shares: null }), null);
  assert.equal(followsPerThousand({ views: 100, follows: null, saved: null, shares: null }), null);
});

test('taxa de valor soma salvos e compartilhamentos', () => {
  assert.equal(valueRate({ views: 1000, follows: 0, saved: 30, shares: 20 }), 5);
  assert.equal(valueRate({ views: 1000, follows: 0, saved: null, shares: null }), null);
  assert.equal(valueRate({ views: 1000, follows: 0, saved: 10, shares: null }), 1);
});

test('ordenação deixa nulos no fim nas duas direções', () => {
  const rows = [{ v: 3 }, { v: null }, { v: 10 }, { v: 1 }];
  assert.deepEqual(sortBy(rows, (r) => r.v, 'desc').map((r) => r.v), [10, 3, 1, null]);
  assert.deepEqual(sortBy(rows, (r) => r.v, 'asc').map((r) => r.v), [1, 3, 10, null]);
});

test('posts por semana na janela', () => {
  const now = new Date('2026-10-22T12:00:00Z');
  const dates = ['2026-10-20T10:00:00Z', '2026-10-15T10:00:00Z', '2026-10-01T10:00:00Z', '2026-08-01T10:00:00Z'];
  assert.equal(postsPerWeek(dates, now, 28), 3 / 4);
  assert.equal(postsPerWeek([], now), null);
});

test('variação percentual sem base devolve null', () => {
  assert.equal(delta(120, 100), 20);
  assert.equal(delta(120, 0), null);
  assert.equal(delta(null, 100), null);
});
