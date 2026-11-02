import test from 'node:test';
import assert from 'node:assert/strict';
import {wk100CurrentWeekStartEat, wk100WeekStartForCalendarDate, isWk100WeekStartEat}
  from '../../../src/pages/admin/charts/ingest/wk100EatWeek.mjs';

test('EAT Sunday 23:59 remains in the preceding week regardless of UTC date', () => {
  assert.equal(wk100CurrentWeekStartEat(new Date('2026-11-01T20:59:59Z')), '2026-10-26');
});
test('EAT Monday 00:00 begins the next calendar week exactly', () => {
  assert.equal(wk100CurrentWeekStartEat(new Date('2026-11-01T21:00:00Z')), '2026-11-02');
});
test('calendar identity never depends on the device time zone', () => {
  assert.equal(wk100CurrentWeekStartEat(new Date('2026-10-31T12:00:00Z')), '2026-10-26');
  assert.equal(wk100WeekStartForCalendarDate('2026-11-04'), '2026-11-02');
});
test('year boundary and leap date produce the correct EAT Monday', () => {
  assert.equal(wk100CurrentWeekStartEat(new Date('2026-12-31T22:00:00Z')), '2026-12-28');
  assert.equal(wk100WeekStartForCalendarDate('2024-02-29'), '2024-02-26');
});
test('invalid and non-Monday dates are not writable weekly identities', () => {
  for(const bad of ['', '2026-02-30', '2026-11-03', '2026-11-02T00:00:00Z', '2026-11-2', null]) {
    assert.equal(isWk100WeekStartEat(bad), false);
  }
  assert.equal(isWk100WeekStartEat('2026-11-02'), true);
  assert.throws(() => wk100CurrentWeekStartEat(new Date(NaN)), /wk100_invalid_instant/);
});
