(() => {
  const DAY_MS = 86400000;

  function dateKey(value) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) throw new TypeError('Data inválida');
      return value.toISOString().slice(0, 10);
    }
    const raw = String(value ?? '').trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) throw new TypeError('Data inválida');
    const probe = new Date(`${match[1]}T00:00:00.000Z`);
    if (Number.isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== match[1]) {
      throw new TypeError('Data inválida');
    }
    return match[1];
  }

  function utcDay(key) {
    return new Date(`${key}T00:00:00.000Z`);
  }

  function holidaySet(holidays = []) {
    return new Set((holidays || []).map(dateKey));
  }

  function isBusinessDay(key, holidays) {
    const day = utcDay(key).getUTCDay();
    return day !== 0 && day !== 6 && !holidays.has(key);
  }

  function shiftDate(key, amount) {
    const date = utcDay(key);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }

  function businessDaysBetween(startISO, endISO, holidays = []) {
    let cursor = dateKey(startISO);
    const end = dateKey(endISO);
    if (cursor === end) return 0;

    const direction = utcDay(cursor) < utcDay(end) ? 1 : -1;
    const blocked = holidaySet(holidays);
    let count = 0;

    while (cursor !== end) {
      if (direction > 0) {
        if (isBusinessDay(cursor, blocked)) count += 1;
        cursor = shiftDate(cursor, 1);
      } else {
        cursor = shiftDate(cursor, -1);
        if (isBusinessDay(cursor, blocked)) count -= 1;
      }
    }
    return count;
  }

  function addBusinessDays(startISO, days, holidays = []) {
    if (!Number.isInteger(days)) throw new TypeError('days deve ser inteiro');
    let cursor = dateKey(startISO);
    if (days === 0) return cursor;

    const blocked = holidaySet(holidays);
    const direction = days > 0 ? 1 : -1;
    let remaining = Math.abs(days);
    while (remaining > 0) {
      cursor = shiftDate(cursor, direction);
      if (isBusinessDay(cursor, blocked)) remaining -= 1;
    }
    return cursor;
  }

  function normalizeInterval(interval) {
    const startRaw = interval?.start ?? interval?.started_at ?? interval?.startedAt;
    const endRaw = interval?.end ?? interval?.ended_at ?? interval?.endedAt;
    const startDate = new Date(startRaw);
    const endDate = new Date(endRaw);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return null;
    return { startMs: startDate.getTime(), endMs: endDate.getTime() };
  }

  function mergePauseIntervals(pauses = []) {
    const normalized = (pauses || [])
      .map(normalizeInterval)
      .filter(Boolean)
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
    if (!normalized.length) return [];

    const merged = [normalized[0]];
    for (let i = 1; i < normalized.length; i += 1) {
      const current = normalized[i];
      const last = merged[merged.length - 1];
      if (current.startMs <= last.endMs) {
        last.endMs = Math.max(last.endMs, current.endMs);
      } else {
        merged.push(current);
      }
    }
    return merged.map(interval => ({
      start: new Date(interval.startMs).toISOString(),
      end: new Date(interval.endMs).toISOString()
    }));
  }

  function slaSnapshot({ stageStartedAt, now, slaDays, pauses = [], holidays = [] }) {
    const limit = Math.max(0, Number.isFinite(Number(slaDays)) ? Number(slaDays) : 0);
    const nowDate = new Date(now);
    if (Number.isNaN(nowDate.getTime())) throw new TypeError('now inválido');

    const effectivePauses = (pauses || []).map(pause => ({
      start: pause?.start ?? pause?.started_at ?? pause?.startedAt,
      end: pause?.end ?? pause?.ended_at ?? pause?.endedAt ?? nowDate.toISOString()
    }));
    const merged = mergePauseIntervals(effectivePauses);
    const total = Math.max(0, businessDaysBetween(stageStartedAt, now, holidays));
    const paused = merged.reduce((sum, pause) => {
      const start = new Date(pause.start) < new Date(stageStartedAt) ? stageStartedAt : pause.start;
      const end = new Date(pause.end) > nowDate ? now : pause.end;
      if (new Date(end) <= new Date(start)) return sum;
      return sum + Math.max(0, businessDaysBetween(start, end, holidays));
    }, 0);
    const elapsedBusinessDays = Math.max(0, total - paused);
    const remainingBusinessDays = limit - elapsedBusinessDays;
    const state = remainingBusinessDays < 0 ? 'overdue' : remainingBusinessDays === 0 ? 'due_today' : 'within_sla';

    return { elapsedBusinessDays, remainingBusinessDays, state };
  }

  window.AtlasOpsV71Sla = Object.freeze({
    businessDaysBetween,
    addBusinessDays,
    mergePauseIntervals,
    slaSnapshot
  });
})();
