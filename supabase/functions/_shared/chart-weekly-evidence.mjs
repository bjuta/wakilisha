/**
 * WAKILISHA 100: non-publishing observation schedule and weekly freeze kernel.
 * Used by Node acceptance tests and suitable for Deno Edge integration.
 * No provider fetching, database mutation, Registry write or chart ranking here.
 * Every deadline is an explicit checkpoint in East Africa Time (UTC+03:00).
 */

const DAY_MS = 86_400_000;
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const STATUS = new Set(['succeeded', 'transport_failed', 'parse_failed', 'target_period_unavailable', 'partial_depth']);
const BEHAVIORS = new Set(['consumption', 'video_consumption', 'discovery', 'ugc_curation', 'broadcast_exposure']);
const METRICS = new Set(['rank', 'rank_and_count', 'event_count']);
const SHA256_HEX = /^[a-f0-9]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireValue(value, message) {
  if (!value) throw new Error(message);
}

const SOURCE_FIELDS = new Set(['source_key','behavior','metric','market','depth','adapter_version',
  'source_contract_version','required','cadence','minimum_healthy_checkpoints']);
const CADENCE_FIELDS = new Set(['kind','hours','eat_hour','eat_minute','weekday_eat']);
const RECEIPT_FIELDS = new Set(['source_key','scheduled_at','fetched_at','status','payload_sha256',
  'observed_depth','record_count','source_native_period','metric','adapter_version',
  'contract_version','market','upstream_reference','failure_code']);
const NATIVE_PERIOD_FIELDS = new Set(['starts_at','ends_at','authority','evidence_ref']);

function onlyFields(value, allowed, label) {
  requireValue(Object.keys(value).every(k => allowed.has(k)), `${label}: unexpected field`);
}

function utcMs(value, label) {
  requireValue(typeof value === 'string' && ISO_UTC.test(value), `${label}: exact UTC timestamp required`);
  const ms = Date.parse(value);
  requireValue(Number.isFinite(ms), `${label}: invalid timestamp`);
  return ms;
}

function cleanText(value, label) {
  requireValue(typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(value), `${label}: invalid identifier`);
  return value;
}

function iso(ms) {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

function eatDayToUtcMs(date) {
  requireValue(typeof date === 'string' && DATE.test(date), 'week_start_eat: invalid date');
  const utcDay = Date.parse(`${date}T00:00:00Z`);
  requireValue(Number.isFinite(utcDay) && new Date(utcDay).toISOString().startsWith(`${date}T`), 'week_start_eat: invalid calendar date');
  requireValue(new Date(utcDay).getUTCDay() === 1, 'week_start_eat: must be Monday');
  return utcDay - EAT_OFFSET_MS;
}

/** A week is [Monday 00:00 EAT, following Monday 00:00 EAT). */
export function trackingWeek(weekStartEat) {
  const startMs = eatDayToUtcMs(weekStartEat);
  return Object.freeze({ week_start_eat: weekStartEat, starts_at: iso(startMs), ends_at: iso(startMs + 7 * DAY_MS) });
}

/**
 * A collection contract is explicitly admitted by an external product authority.
 * The kernel does not decide which provider or source is nationally representative.
 * Every slot in a source schedule is a requested snapshot, not a play event.
 */
export function validateSourceContract(source) {
  requireValue(source && typeof source === 'object' && !Array.isArray(source), 'source contract required');
  onlyFields(source, SOURCE_FIELDS, 'source contract');
  cleanText(source.source_key, 'source_key');
  requireValue(BEHAVIORS.has(source.behavior), `${source.source_key}: unknown behavior`);
  requireValue(METRICS.has(source.metric), `${source.source_key}: unknown metric`);
  requireValue(source.market === 'KE', `${source.source_key}: Kenya market required`);
  requireValue(typeof source.adapter_version === 'string' && source.adapter_version.trim(), `${source.source_key}: adapter version required`);
  requireValue(typeof source.source_contract_version === 'string' && source.source_contract_version.trim(), `${source.source_key}: contract version required`);
  requireValue(typeof source.required === 'boolean', `${source.source_key}: required flag must be explicit`);
  requireValue(Number.isInteger(source.depth) && source.depth >= 1 && source.depth <= 1000, `${source.source_key}: depth out of bounds`);
  requireValue(source.cadence && typeof source.cadence === 'object', `${source.source_key}: cadence required`);
  onlyFields(source.cadence, CADENCE_FIELDS, `${source.source_key} cadence`);
  const { kind, hours, eat_hour, eat_minute, weekday_eat } = source.cadence;
  requireValue(Number.isInteger(eat_hour) && eat_hour >= 0 && eat_hour <= 23, `${source.source_key}: invalid EAT hour`);
  requireValue(Number.isInteger(eat_minute) && eat_minute >= 0 && eat_minute <= 59, `${source.source_key}: invalid EAT minute`);
  requireValue(['daily', 'interval_hours', 'weekly'].includes(kind), `${source.source_key}: unsupported cadence`);
  if (kind === 'interval_hours') {
    requireValue([3, 4, 6, 8, 12, 24].includes(hours), `${source.source_key}: unsupported interval`);
  }
  if (kind === 'weekly') {
    requireValue(Number.isInteger(weekday_eat) && weekday_eat >= 0 && weekday_eat <= 6, `${source.source_key}: weekday is Monday=0 through Sunday=6`);
  }
  requireValue(Number.isInteger(source.minimum_healthy_checkpoints) && source.minimum_healthy_checkpoints >= 1,
    `${source.source_key}: minimum healthy checkpoint count required`);
  return source;
}

/** Returns expected source checkpoints within a precise Kenya-local week. */
export function checkpointsForSource(weekStartEat, source) {
  validateSourceContract(source);
  const week = trackingWeek(weekStartEat);
  const startMs = utcMs(week.starts_at, 'week start');
  const result = [];
  const { kind, hours, eat_hour, eat_minute, weekday_eat } = source.cadence;
  const first = startMs + eat_hour * 3_600_000 + eat_minute * 60_000;
  const step = kind === 'interval_hours' ? hours * 3_600_000 : DAY_MS;
  for (let t = first; t < startMs + 7 * DAY_MS; t += step) {
    const day = Math.floor((t - startMs) / DAY_MS);
    if (kind === 'weekly' && day !== weekday_eat) continue;
    result.push(Object.freeze({
      source_key: source.source_key,
      scheduled_at: iso(t),
      checkpoint_key: `${source.source_key}|${iso(t)}`,
    }));
  }
  requireValue(source.minimum_healthy_checkpoints <= result.length, `${source.source_key}: minimum exceeds expected checkpoints`);
  return result;
}

/**
 * Explicitly validates a source observation. Ranks are ordinal; metrics remain
 * source-native. No rank-to-play conversion, cross-source weighting or imputation.
 */
export function validateReceipt(receipt, contract, week) {
  requireValue(receipt && typeof receipt === 'object', 'receipt object required');
  onlyFields(receipt, RECEIPT_FIELDS, 'receipt');
  requireValue(receipt.source_key === contract.source_key, 'receipt source does not match contract');
  requireValue(STATUS.has(receipt.status), 'unrecognized receipt status');
  const fetched = utcMs(receipt.fetched_at, 'fetched_at');
  const slot = utcMs(receipt.scheduled_at, 'scheduled_at');
  requireValue(fetched >= slot && fetched - slot <= 24 * 3_600_000, 'fetch is not within 24h after its slot');
  requireValue(slot >= utcMs(week.starts_at, 'week starts') && slot < utcMs(week.ends_at, 'week ends'), 'checkpoint outside tracking week');
  requireValue(receipt.adapter_version === contract.adapter_version, 'adapter version mismatch');
  requireValue(receipt.contract_version === contract.source_contract_version, 'contract version mismatch');
  requireValue(receipt.market === contract.market, 'source territory mismatch');
  requireValue(receipt.source_native_period === 'unknown' ||
    (receipt.source_native_period && typeof receipt.source_native_period === 'object' &&
     receipt.source_native_period.authority === 'provider_defined'),
    'source-native period must carry provider-defined interval or unknown');
  if (receipt.source_native_period !== 'unknown') {
    onlyFields(receipt.source_native_period, NATIVE_PERIOD_FIELDS, 'native period');
    const ps = utcMs(receipt.source_native_period.starts_at, 'native period start');
    const pe = utcMs(receipt.source_native_period.ends_at, 'native period end');
    requireValue(ps < pe, 'native period must be a positive interval');
    requireValue(typeof receipt.source_native_period.evidence_ref === 'string' && receipt.source_native_period.evidence_ref.trim(),
      'native period needs source evidence reference');
  }
  if (receipt.status === 'succeeded' || receipt.status === 'partial_depth') {
    requireValue(typeof receipt.payload_sha256 === 'string' && SHA256_HEX.test(receipt.payload_sha256), 'successful fetch requires actual payload SHA-256');
    requireValue(Number.isInteger(receipt.observed_depth) && receipt.observed_depth >= 1 && receipt.observed_depth <= contract.depth,
      'successful fetch requires valid observed depth');
    requireValue(Number.isInteger(receipt.record_count) && receipt.record_count >= 1 && receipt.record_count <= receipt.observed_depth,
      'successful fetch requires valid record count');
    requireValue(receipt.metric === contract.metric, 'source-native metric type mismatch');
    if (receipt.observed_depth < contract.depth) requireValue(receipt.status === 'partial_depth', 'partial observation cannot be marked healthy');
    if (receipt.status === 'partial_depth') requireValue(receipt.observed_depth < contract.depth, 'partial status must have partial depth');
  } else {
    requireValue(receipt.payload_sha256 === null && receipt.record_count === 0 && receipt.observed_depth === 0,
      'failed/missing receipt cannot masquerade as collected data');
    requireValue(typeof receipt.failure_code === 'string' && receipt.failure_code.trim(), 'failed fetch requires reason code');
  }
  requireValue(typeof receipt.upstream_reference === 'string' && receipt.upstream_reference.trim(), 'upstream source identity required');
  return receipt;
}

function deepFreeze(input) {
  if (input && typeof input === 'object') {
    Object.freeze(input);
    for (const value of Object.values(input)) deepFreeze(value);
  }
  return input;
}

function stableSortObject(input) {
  if (Array.isArray(input)) return input.map(stableSortObject);
  if (input && typeof input === 'object') {
    return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => [k, stableSortObject(v)]));
  }
  return input;
}

/** Canonical JSON for replay. Its cryptographic hash is an audit fingerprint, not an authentication signature. */
export function canonicalJSON(value) {
  return JSON.stringify(stableSortObject(value));
}

export async function digestSHA256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}

/**
 * Fail-closed weekly evidence manifest, NOT permission to publish a ranking.
 * Consumers must independently validate recording identity, admission, scoring,
 * governance and completeness before producing a chart edition.
 */
export async function prepareWeeklyEvidenceFreeze({
  week_start_eat, source_contracts, receipts, constitution_version, methodology_version,
}) {
  const week = trackingWeek(week_start_eat);
  requireValue(typeof constitution_version === 'string' && constitution_version.trim(), 'source constitution version required');
  requireValue(typeof methodology_version === 'string' && methodology_version.trim(), 'methodology version required');
  requireValue(Array.isArray(source_contracts) && source_contracts.length > 0, 'admitted source contracts required');
  requireValue(Array.isArray(receipts), 'receipts must be an array');

  const sources = [...source_contracts].sort((a,b)=> a.source_key.localeCompare(b.source_key));
  const sourceMap = new Map();
  const expected = new Map();
  for (const src of sources) {
    validateSourceContract(src);
    requireValue(!sourceMap.has(src.source_key), 'duplicate source contract');
    sourceMap.set(src.source_key, src);
    for (const slot of checkpointsForSource(week_start_eat, src)) expected.set(slot.checkpoint_key, slot);
  }

  const byCheckpoint = new Map();
  for (const receipt of receipts) {
    const contract = sourceMap.get(receipt?.source_key);
    requireValue(contract, 'unknown source in receipts');
    validateReceipt(receipt, contract, week);
    const key = `${receipt.source_key}|${receipt.scheduled_at}`;
    requireValue(expected.has(key), 'unplanned checkpoint');
    requireValue(!byCheckpoint.has(key), 'duplicate checkpoint receipt: ambiguity requires reconciliation');
    byCheckpoint.set(key, receipt);
  }

  const summaries = [];
  const frozenReceipts = [];
  const blocking = [];
  const warnings = [];
  for (const source of sources) {
    const slots = checkpointsForSource(week_start_eat, source);
    let healthy = 0, changed = 0, lastHash = null, unknownPeriods = 0;
    let periodsOutsideWeek = 0, periodsCrossingWeekBoundary = 0;
    const failures = [];
    for (const slot of slots) {
      const receipt = byCheckpoint.get(slot.checkpoint_key);
      if (!receipt) {
        failures.push({ scheduled_at: slot.scheduled_at, reason: 'missing_checkpoint' });
        continue;
      }
      frozenReceipts.push(receipt);
      if (receipt.status === 'succeeded') {
        if (receipt.source_native_period === 'unknown') unknownPeriods++;
        else {
          const start = utcMs(receipt.source_native_period.starts_at, 'native period start');
          const end = utcMs(receipt.source_native_period.ends_at, 'native period end');
          const ws = utcMs(week.starts_at, 'week starts');
          const we = utcMs(week.ends_at, 'week ends');
          if (end <= ws || start >= we) periodsOutsideWeek++;
          else if (start < ws || end > we) periodsCrossingWeekBoundary++;
        }
        healthy++;
        if (receipt.payload_sha256 !== lastHash) changed++;
        lastHash = receipt.payload_sha256;
      } else failures.push({ scheduled_at: slot.scheduled_at, reason: receipt.status });
    }
    const meetsMinimum = healthy >= source.minimum_healthy_checkpoints;
    const summary = {
      source_key: source.source_key, behavior: source.behavior, metric: source.metric,
      required: source.required, planned_checkpoints: slots.length, received_checkpoints: slots.length - slots.filter(s=>!byCheckpoint.has(s.checkpoint_key)).length,
      healthy_checkpoints: healthy, distinct_consecutive_payloads: changed,
      minimum_healthy_checkpoints: source.minimum_healthy_checkpoints, unknown_native_periods: unknownPeriods,
      periods_outside_week: periodsOutsideWeek, periods_crossing_week_boundary: periodsCrossingWeekBoundary, failures,
      status: meetsMinimum ? (failures.length ? 'degraded' : 'healthy') : 'insufficient',
    };
    summaries.push(summary);
    if (!meetsMinimum && source.required) blocking.push(`${source.source_key}: insufficient healthy checkpoints`);
    if (unknownPeriods > 0 && source.required) blocking.push(`${source.source_key}: upstream period semantics unverified`);
    if (periodsOutsideWeek && source.required) blocking.push(`${source.source_key}: source native period outside tracking week`);
    if (periodsCrossingWeekBoundary && source.required) blocking.push(`${source.source_key}: source native period crosses tracking week; explicit alignment policy required`);
    if (failures.length) warnings.push(`${source.source_key}: ${failures.length} missing or degraded checkpoints`);
    if (unknownPeriods) warnings.push(`${source.source_key}: ${unknownPeriods} unverified native periods`);
    if (periodsOutsideWeek) warnings.push(`${source.source_key}: ${periodsOutsideWeek} outside-week native periods`);
    if (periodsCrossingWeekBoundary) warnings.push(`${source.source_key}: ${periodsCrossingWeekBoundary} cross-boundary native periods`);
  }
  frozenReceipts.sort((a, b) => a.source_key.localeCompare(b.source_key) || a.scheduled_at.localeCompare(b.scheduled_at));
  const content = { schema_version:'wk-chart-weekly-evidence-v1', week, constitution_version, methodology_version, source_contracts:sources, source_summary:summaries, receipts:frozenReceipts };
  // Detach the frozen record from mutable caller objects before digesting it.
  const detached = JSON.parse(canonicalJSON(content));
  const sha256 = await digestSHA256(canonicalJSON(detached));
  return deepFreeze({ ...detached, sha256, state: blocking.length ? 'blocked' : 'evidence_ready_for_independent_review', blocking, warnings, can_publish: false });
}
