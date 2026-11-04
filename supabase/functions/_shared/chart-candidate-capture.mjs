/**
 * WAKILISHA 100: candidate-only, bounded raw-source transport and private archive.
 * No embedded provider URLs, keys, scheduling, SQL writes, Registry writes,
 * scoring, source admission or publication. An independent access authority
 * must explicitly approve the exact source URL on each call.
 *
 * Storage and durable attempt-ledger interfaces are injected; this module
 * does not manufacture privileges or connect to Production on its own.
 */
import { isWk100AppleCatalogChart } from './wk100-apple-service-credential.mjs';

const MAX_BYTES = 4_194_304;
const MIME_TYPES = new Set(['text/html', 'text/csv', 'application/json', 'application/octet-stream']);
const SOURCE = /^[a-z][a-z0-9_]{2,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const KEY = /^[a-zA-Z0-9_./-]{12,320}$/;

export class CandidateCaptureError extends Error {
  constructor(code) { super(code); this.name = 'CandidateCaptureError'; this.code = code; }
}
function reject(code) { throw new CandidateCaptureError(code); }
function assert(ok, code) { if (!ok) reject(code); }
function exactKeys(value, names, code) {
  assert(value && typeof value === 'object' && !Array.isArray(value), code);
  assert(Object.keys(value).every(x => names.includes(x)), code);
}
function exactUtcDate(value, code) {
  assert(typeof value === 'string' && UTC.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().replace('.000Z', 'Z') === value, code);
}
function approvedHttpsEndpoint(value) {
  assert(typeof value === 'string' && value.length <= 1200, 'endpoint_invalid');
  let url;
  try { url = new URL(value); } catch { reject('endpoint_invalid'); }
  assert(url.protocol === 'https:' && url.username === '' && url.password === ''
    && url.hash === '' && url.port === '' && url.hostname.includes('.')
    && !url.hostname.endsWith('.local') && !url.hostname.endsWith('.internal')
    && !/^\d+(?:\.\d+){3}$/.test(url.hostname)
    && !url.hostname.startsWith('[') && url.href === value, 'endpoint_invalid');
  return url;
}
function toBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  reject('raw_bytes_invalid');
}
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', toBytes(value));
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Safe transport. The verifier MUST consult a separately controlled and
 * current access decision; a caller-supplied string is not authorization.
 * No redirects, arbitrary hosts, credentials, or unbounded response bodies.
 */
export async function fetchCandidateBytes({ sourceKey, endpoint, accessDecision,
  verifyAccess, providerAuthorization, fetchImpl = fetch, timeoutMs = 12_000,
  now = () => new Date() }) {
  assert(SOURCE.test(sourceKey), 'source_key_invalid');
  const url = approvedHttpsEndpoint(endpoint);
  // Tokens only travel to Apple's exact native chart API; never allow a
  // manifest entry to redirect credentials to another HTTPS host or route.
  let providerHeaders = null;
  if(providerAuthorization !== undefined) {
    exactKeys(providerAuthorization, ['kind','token'], 'provider_authorization_invalid');
    assert(isWk100AppleCatalogChart(sourceKey,endpoint) &&
      providerAuthorization.kind === 'apple_developer_bearer' &&
      typeof providerAuthorization.token === 'string' &&
      /^[a-zA-Z0-9_.-]{20,8192}$/.test(providerAuthorization.token),
      'provider_authorization_invalid');
    providerHeaders = { authorization: 'Bearer ' + providerAuthorization.token };
  }
  exactKeys(accessDecision, ['source_key', 'exact_endpoint', 'authorization_ref', 'purpose'], 'source_access_invalid');
  assert(accessDecision.source_key === sourceKey && accessDecision.exact_endpoint === endpoint
    && accessDecision.purpose === 'candidate_raw_evidence'
    && typeof accessDecision.authorization_ref === 'string'
    && /^[a-zA-Z0-9_./:-]{6,180}$/.test(accessDecision.authorization_ref), 'source_access_invalid');
  assert(typeof verifyAccess === 'function' && typeof fetchImpl === 'function', 'source_access_verifier_required');
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 30_000, 'timeout_invalid');
  // The verifying authority is expected to check origin, legal access,
  // credentials, environment parity, and validity at the time of retrieval.
  const controller = new AbortController();
  let timeout;
  const deadline = new Promise((_, fail) => {
    timeout = setTimeout(() => { controller.abort(); fail(new CandidateCaptureError('transport_timeout')); }, timeoutMs);
  });
  try {
    const work = (async () => {
      assert(await verifyAccess(accessDecision, { sourceKey, endpoint, hostname: url.hostname, signal:controller.signal }) === true,
        'source_access_not_authorized');
      // A slow authority check can settle after the Promise.race deadline.
      // Never dispatch a provider request once the capture has timed out.
      assert(!controller.signal.aborted, 'transport_timeout');
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'GET', redirect: 'manual', credentials: 'omit',
          cache: 'no-store', signal: controller.signal,
          headers: { accept: 'application/json, text/html, text/csv, application/octet-stream',
            ...(providerHeaders || {}) },
        });
      } catch { reject('transport_failed'); }
      assert(response && typeof response.status === 'number', 'transport_failed');
      assert(response.status === 200 && response.redirected !== true
        && response.type !== 'opaqueredirect' && !response.headers?.get('location')
        && (!response.url || response.url === endpoint),
        response.status >= 300 && response.status <= 399 ? 'redirect_forbidden' : 'upstream_http_unaccepted');
      const type = response.headers?.get('content-type')?.split(';')[0]?.trim()?.toLowerCase();
      assert(MIME_TYPES.has(type), 'upstream_content_type_unaccepted');
      const length = response.headers.get('content-length');
      if (length !== null) {
        assert(/^\d+$/.test(length) && Number(length) <= MAX_BYTES, 'raw_body_too_large');
      }
      assert(response.body && typeof response.body.getReader === 'function', 'raw_body_stream_required');
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          assert(part.value instanceof Uint8Array, 'raw_stream_chunk_invalid');
          received += part.value.byteLength;
          assert(received <= MAX_BYTES, 'raw_body_too_large');
          chunks.push(part.value);
        }
      } finally {
        try { reader.releaseLock(); } catch { /* stream may have failed */ }
      }
      assert(received > 0, 'raw_body_empty');
      const bytes = new Uint8Array(received);
      let position = 0;
      for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
      const fetchedAt = now();
      assert(fetchedAt instanceof Date && Number.isFinite(fetchedAt.valueOf()), 'fetched_at_invalid');
      return Object.freeze({ source_key: sourceKey, bytes,
        payload_sha256: await sha256Hex(bytes), content_type: type,
        byte_length: received, http_status: 200, fetched_at: fetchedAt.toISOString() });
    })();
    return await Promise.race([work, deadline]);
  } finally { clearTimeout(timeout); controller.abort(); }
}

function rawObjectKey({weekStartEat, sourceKey, scheduledAt, attemptNumber, digest, contentType}) {
  assert(typeof weekStartEat === 'string' && DATE.test(weekStartEat)
    && new Date(`${weekStartEat}T00:00:00Z`).toISOString().startsWith(`${weekStartEat}T`)
    && new Date(`${weekStartEat}T00:00:00Z`).getUTCDay() === 1, 'week_start_invalid');
  assert(SOURCE.test(sourceKey), 'source_key_invalid');
  exactUtcDate(scheduledAt, 'scheduled_at_invalid');
  const from = Date.parse(`${weekStartEat}T00:00:00Z`) - 10_800_000;
  const slot = Date.parse(scheduledAt);
  assert(slot >= from && slot < from + 7 * 86_400_000, 'slot_outside_eat_week');
  assert(Number.isInteger(attemptNumber) && attemptNumber >= 1 && attemptNumber <= 8, 'attempt_number_invalid');
  assert(SHA256.test(digest) && MIME_TYPES.has(contentType), 'raw_metadata_invalid');
  const extension = {'text/html':'html','text/csv':'csv','application/json':'json','application/octet-stream':'bin'}[contentType];
  const compact = scheduledAt.replace(/[-:]/g, '').replace('T','T').replace('Z','Z');
  const key = `v1/${weekStartEat}/${sourceKey}/${compact}-${attemptNumber}/${digest}.${extension}`;
  assert(KEY.test(key) && !key.includes('..'), 'object_key_invalid');
  return key;
}

/**
 * Uses a server-only Storage adapter and durable write-ahead ledger.
 * The record of 'reserved' MUST be persisted BEFORE any upload starts.
 * No delete on failure: a partial upload is preserved for orphan recovery.
 * No SQL attempt/row insertion in this module.
 */
export async function archiveCandidateBytes({ capture, weekStartEat, scheduledAt,
  attemptNumber, storage, ledger }) {
  exactKeys(capture, ['source_key','bytes','payload_sha256','content_type','byte_length','http_status','fetched_at'], 'capture_shape_invalid');
  assert(capture.http_status === 200 && SOURCE.test(capture.source_key)
    && MIME_TYPES.has(capture.content_type), 'capture_invalid');
  assert(typeof capture.fetched_at === 'string' && !Number.isNaN(Date.parse(capture.fetched_at))
    && new Date(capture.fetched_at).toISOString() === capture.fetched_at, 'fetched_at_invalid');
  assert(capture.bytes instanceof Uint8Array && capture.bytes.byteLength > 0
    && capture.bytes.byteLength <= MAX_BYTES && capture.bytes.byteLength === capture.byte_length,
    'capture_bytes_invalid');
  const digest = await sha256Hex(capture.bytes);
  assert(capture.payload_sha256 === digest, 'capture_digest_mismatch');
  const key = rawObjectKey({weekStartEat, sourceKey:capture.source_key, scheduledAt,
    attemptNumber, digest, contentType:capture.content_type});
  const elapsed = Date.parse(capture.fetched_at) - Date.parse(scheduledAt);
  assert(elapsed >= 0 && elapsed <= 86_400_000, 'fetch_outside_slot_window');
  assert(storage && typeof storage.putCreateOnly === 'function'
    && typeof storage.readPrivate === 'function'
    && ledger && typeof ledger.record === 'function', 'archive_dependency_invalid');
  const meta = Object.freeze({ object_key:key, payload_sha256:digest,
    content_type:capture.content_type, byte_length:capture.bytes.byteLength,
    week_start_eat:weekStartEat, scheduled_at:scheduledAt,
    attempt_number:attemptNumber, source_key:capture.source_key });
  await ledger.record({ state:'reserved', ...meta });
  try {
    await storage.putCreateOnly(key, capture.bytes, { contentType:capture.content_type, upsert:false });
  } catch {
    reject('raw_storage_create_failed');
  }
  await ledger.record({ state:'uploaded_unverified', ...meta });
  let readback;
  try { readback = toBytes(await storage.readPrivate(key)); }
  catch { reject('raw_storage_readback_failed'); }
  assert(equalBytes(readback, capture.bytes) && await sha256Hex(readback) === digest,
    'raw_storage_integrity_mismatch');
  await ledger.record({ state:'verified', ...meta });
  return Object.freeze({ ...meta, status:'candidate_only_verified', can_publish:false });
}
