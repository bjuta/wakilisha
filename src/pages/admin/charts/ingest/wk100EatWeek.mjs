/** WAKILISHA 100 weekly identity is the Monday of the Africa/Nairobi week. */
export function wk100CurrentWeekStartEat(instant = new Date()) {
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) {
    throw new Error('wk100_invalid_instant');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const get = type => parts.find(p => p.type === type)?.value;
  const year = get('year'), month = get('month'), day = get('day');
  if (!year || !month || !day) throw new Error('wk100_eat_date_unavailable');
  return wk100WeekStartForCalendarDate(`${year}-${month}-${day}`);
}

export function wk100WeekStartForCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function isWk100WeekStartEat(value) {
  return value !== null && value === wk100WeekStartForCalendarDate(value);
}
