import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import pg from 'pg';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'pgzizndxdyhqmtyywjmt';
const REGION = process.env.SUPABASE_REGION || 'eu-west-2';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const MODE = process.env.MIZIZI_CONTROL_PLANE_MODE || 'preflight';
const EXPECTED_MAIN = process.env.MIZIZI_EXPECTED_MAIN_SHA || '';
const TRIGGER_FILE = process.env.MIZIZI_TRIGGER_FILE || '';
const ARTIFACT_DIR = process.env.MIZIZI_ARTIFACT_DIR || 'artifacts/mizizi-track-production-control-plane';
const EXPECTED_FINGERPRINT = '551b29431700536937c26ecb1e396c3cf9314edefd88c589284cf330c9d1bb9a';
const EXPECTED_REVIEW_INPUT_FINGERPRINT = 'b6a8047ce9adae9cf422f8f787de88832ae6bb3f7307437a2443d2652b40bcc9';
const EXPECTED_1094_FEATURE_REVIEW_TARGETS = [
  ['431fbc40-916e-5de2-8278-68b826050f2f','2-left-feet-feat-mwirigi','2-left-feet'],
  ['e4581038-cfe2-5e64-897f-1e0eb291671a','bombo-feat-maandy','bombo'],
  ['d7f6fb75-3dba-5965-86ea-cf1a5fd7ce7e','form-imeiva-feat-mr-ke4','form-imeiva'],
  ['30163529-f5b1-5645-884e-e942378cd0fa','glow-feat-gendi','glow'],
  ['db0a566e-7e62-526b-8794-831ce14878d7','hakuna-kulala-feat-mercury-ke','hakuna-kulala'],
  ['84f1919b-83be-5f25-8596-1b28055ba724','hands-in-the-air-feat-shanki-austine','hands-in-the-air'],
  ['b4be461b-9c7a-5ec8-82e7-e37c5ccc6588','itisha-feat-vinc-on-the-beat','itisha'],
  ['1cf26df0-5072-5686-80a6-6a53450d41ea','murda-feat-ali-smallz','murda'],
  ['eb003451-b337-50da-8aba-71ed4809458b','pretty-girl-feat-tuku-kantu','pretty-girl'],
  ['3a2af997-85b6-5557-8e61-21eb551c28c8','seto-feat-hassanoke','seto'],
  ['999027a7-4aea-5aa6-8742-a0f8dd78bcfd','sitaki-drinks-feat-kash-kaaria','sitaki-drinks'],
  ['92d21032-dc76-5518-8b21-82ecd1f1a6ab','waist-line-feat-grandmastatek','waist-line'],
];
const EXPECTED_1094_FEATURE_REVIEW_IDS_SQL =
  EXPECTED_1094_FEATURE_REVIEW_TARGETS
    .map(([id]) => "'" + id + "'")
    .join(',');
const EXPECTED_BLOBS = {
  'scripts/registry/agents/mizizi/run.ts': '87742402dc980ce98613b898f75a118d2c57b0be',
  'scripts/registry/agents/mizizi/core.ts': 'd57a242b60f517461243f0310c61d1f791362f37',
  'supabase/functions/_shared/registry-track-identity.ts': '7bcab485aecc3cc7b90e2a3154d90dcee81be92c',
};

if (!['preflight', 'review', 'apply'].includes(MODE)) throw new Error('Unsupported control-plane mode');
if (!TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN repository secret is required');
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: opts.capture ? 'pipe' : 'inherit', env: opts.env || process.env });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed${r.stderr ? `: ${r.stderr.trim()}` : ''}`);
  return (r.stdout || '').trim();
}

async function api(method, path, body) {
  const r = await fetch(`https://api.supabase.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase Management API ${method} ${path} failed ${r.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

function rowsFromJitList(raw) {
  return Array.isArray(raw) ? raw : raw?.data || raw?.mappings || raw?.users || raw?.items || [];
}

function profileId(raw) {
  return raw?.gotrue_id || raw?.id || raw?.user_id || raw?.user?.id || raw?.data?.id || raw?.data?.gotrue_id || '';
}

function configState(raw) {
  return String(raw?.state || raw?.data?.state || raw?.config?.state || '').toLowerCase();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findPayload(value, depth = 0) {
  if (depth > 14) return null;
  if (typeof value === 'string') {
    try { return findPayload(JSON.parse(value), depth + 1); } catch { return null; }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPayload(item, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    if (value.payload !== undefined) return value.payload;
    for (const child of Object.values(value)) {
      const found = findPayload(child, depth + 1);
      if (found !== null) return found;
    }
  }
  return null;
}

function queryViaLinkedCli(sql) {
  const wrapped = `select to_jsonb(q) as payload from (${sql.replace(/;\\s*$/, '')}) q`;
  const raw = run(
    'npx',
    ['--yes','supabase@2.108.0','db','query','--linked','--agent=no','-o','json',wrapped],
    { capture:true },
  );
  const payload = findPayload(JSON.parse(raw));
  if (payload === null) throw new Error('linked Supabase CLI query did not return a parseable payload');
  return payload;
}

async function queryViaLinkedCliWithRetry(sql, label) {
  const attempts = 8;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return queryViaLinkedCli(sql);
    } catch (error) {
      const message = String(error?.message || error).toLowerCase();
      const transient =
        isTransientJitError(error) ||
        message.includes('failed to connect as temp role') ||
        message.includes('ssl connection is required');

      if (!transient || attempt === attempts) throw error;
      console.log(
        `Linked CLI ${label} not ready on attempt ${attempt}/${attempts}; retrying transient login transport`,
      );
      await sleep(5000);
    }
  }
  throw new Error(`linked CLI ${label} retry budget exhausted`);
}

async function waitForDatabaseHealth() {
  for (let attempt = 1; attempt <= 36; attempt += 1) {
    try {
      const health = await api('GET',`/v1/projects/${PROJECT_REF}/health?services=db&timeout_ms=5000`);
      const services =
        Array.isArray(health)
          ? health
          : Array.isArray(health?.services)
            ? health.services
            : Array.isArray(health?.data)
              ? health.data
              : [];
      if (
        services.some(
          item =>
            item?.name === 'db' &&
            (
              item?.healthy === true ||
              String(item?.status || '').toUpperCase() === 'ACTIVE_HEALTHY'
            ),
        )
      ) {
        return;
      }
    } catch {}
    await sleep(5000);
  }
  throw new Error('database did not return healthy after SSL enforcement change');
}

function databaseUrl(role) {
  const poolerPath = 'supabase/.temp/pooler-url';
  if (!fs.existsSync(poolerPath)) throw new Error(`linked Supabase CLI did not create ${poolerPath}`);

  const linkedPooler = fs.readFileSync(poolerPath, 'utf8').trim();
  const sanitized = linkedPooler.replace(/:\/\/([^:]+):[^@]*@/, '://$1:x@');
  const u = new URL(sanitized);
  if (!u.hostname.endsWith('.pooler.supabase.com')) {
    throw new Error(`linked Supabase CLI returned unexpected pooler host ${u.hostname}`);
  }

  u.username = `${role}.${PROJECT_REF}`;
  u.password = TOKEN;
  u.port = '5432';
  u.search = '';
  u.searchParams.set('options', '-c jit=true');
  console.log(`Using linked Supabase pooler host: ${u.hostname}:5432 as ${role}`);
  return u.toString();
}

function isTransientJitError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || error || '').toLowerCase();

  return (
    code === 'EJITREQUESTFAILED' ||
    code === '28P01' ||
    code === 'XX000' ||
    message.includes('jit provider') ||
    message.includes('temporary access') ||
    message.includes('password authentication failed') ||
    message.includes('pam authentication failed')
  );
}

async function createJitPoolWithRetry(url, expectedRole) {
  const attempts = 12;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const pool = new pg.Pool({
      connectionString:url,
      ssl:{rejectUnauthorized:false},
      max:2,
      connectionTimeoutMillis:10000,
      query_timeout:30000,
      statement_timeout:30000,
    });

    try {
      const { rows:[session] } = await pool.query(
        'select current_user as database_user, current_database() as database_name',
      );

      if (session.database_user !== expectedRole || session.database_name !== 'postgres') {
        throw new Error(
          `unexpected JIT database session ${session.database_user}@${session.database_name} expected ${expectedRole}@postgres`,
        );
      }

      console.log(`PASS: JIT ${expectedRole} database session ready on attempt ${attempt}/${attempts}`);
      return pool;
    } catch (error) {
      await pool.end().catch(()=>{});

      if (!isTransientJitError(error) || attempt === attempts) {
        throw error;
      }

      console.log(
        `JIT session not ready on attempt ${attempt}/${attempts}; retrying after transient ${error?.code || 'UNKNOWN'}`,
      );
      await sleep(5000);
    }
  }

  throw new Error('JIT database session readiness exhausted');
}

const transportAuthoritySql = `select
 exists(
   select 1
   from supabase_migrations.schema_migrations
   where version='20260920095334'
     and name='mizizi_stage_c_narrow_executor_transport_v1'
 ) as stage_c_applied,
 exists(
   select 1
   from platform_private.system_actor_executor_bindings
   where actor_key='mizizi'
     and executor_kind='database_role'
     and executor_key='postgres'
     and status='active'
 ) as postgres_active,
 exists(
   select 1
   from platform_private.system_actor_executor_bindings
   where actor_key='mizizi'
     and executor_kind='database_role'
     and executor_key='postgres'
     and status='disabled'
 ) as postgres_disabled,
 exists(
   select 1
   from platform_private.system_actor_executor_bindings
   where actor_key='mizizi'
     and executor_kind='database_role'
     and executor_key='mizizi_executor'
     and status='active'
 ) as executor_active,
 exists(
   select 1
   from platform_private.system_actor_executor_bindings
   where actor_key='mizizi'
     and executor_kind='database_role'
     and executor_key='mizizi_executor'
     and status='disabled'
 ) as executor_disabled`;

function resolveMiziziTransportRole() {
  const authority = queryViaLinkedCli(transportAuthoritySql);

  if (authority.stage_c_applied === true) {
    if (
      authority.executor_active !== true ||
      authority.postgres_disabled !== true
    ) {
      throw new Error(
        'Stage C ledger is present but dedicated executor binding is not exact',
      );
    }
    console.log('PASS: Stage C ledger active; JIT transport = mizizi_executor');
    return 'mizizi_executor';
  }

  if (
    authority.postgres_active !== true ||
    authority.executor_disabled !== true
  ) {
    throw new Error(
      'Stage C ledger is absent but Stage B transport binding is not exact',
    );
  }

  console.log('PASS: Stage C ledger absent; exact Stage B postgres compatibility transport retained');
  return 'postgres';
}

const fingerprintSql = `with payload as (
 select jsonb_build_object(
  'tracks',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.registry_tracks t where t.status='active'),'[]'::jsonb),
  'track_artists',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.registry_track_artists x where x.status='active'),'[]'::jsonb),
  'releases',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.registry_releases x where x.status='active'),'[]'::jsonb),
  'release_tracks',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.registry_release_tracks x where x.status='active'),'[]'::jsonb),
  'release_artists',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.registry_release_artists x where x.status='active'),'[]'::jsonb),
  'threads',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.community_threads x where x.entity_type='track'),'[]'::jsonb),
  'saves',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.community_saves x where x.entity_type='track'),'[]'::jsonb),
  'chart_entries',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.wk_chart_entries_v2 x where x.canonical_track_id is not null),'[]'::jsonb),
  'redirects',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.wk_slug_redirects x where x.entity_type='track'),'[]'::jsonb)
 ) body
) select encode(extensions.digest(convert_to(body::text,'UTF8'),'sha256'),'hex') fingerprint from payload`;

const baselineSql = `select
 (select count(*)::int from public.registry_tracks where status='active') active_tracks,
 (select count(*)::int from public.registry_canonical_write_events where actor='mizizi' and registry_entity_type='track') events,
 (select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open' and source_payload->>'ruleId'='track_slug_identity_noise') reviews,
 (select count(*)::int from public.wk_slug_redirects where entity_type='track') redirects,
 (select count(*)::int from public.wk_slug_redirects where entity_type='track' and created_by='mizizi:1.1.0') mizizi_redirects,
 (select count(*)::int from supabase_migrations.schema_migrations) ledger_count,
 (select max(version) from supabase_migrations.schema_migrations) ledger_head`;

const acceptanceSql = `with e as (
 select * from public.registry_canonical_write_events where actor='mizizi' and registry_entity_type='track'
), r as (
 select count(*)::int reviews,
        count(*) filter(where t.slug=ri.source_payload->>'currentValue')::int blocked_still_old,
        count(distinct ri.source_id)::int review_tracks
 from public.registry_review_items ri left join public.registry_tracks t on t.id::text=ri.source_id
 where ri.review_type='mizizi_data_hygiene'
   and ri.status='open'
   and ri.source_payload->>'ruleId'='track_slug_identity_noise'
), impact as (
 select coalesce(sum((after_value->'downstreamImpact'->>'permanentRedirects')::int),0)::int redirects,
        coalesce(sum((after_value->'downstreamImpact'->>'chartEntriesUpdated')::int),0)::int chart_rows,
        coalesce(sum((after_value->'downstreamImpact'->>'communitySavesUpdated')::int),0)::int save_slug_rows,
        coalesce(sum((after_value->'downstreamImpact'->>'communitySaveUrlsUpdated')::int),0)::int save_url_rows,
        coalesce(sum((after_value->'downstreamImpact'->>'communityThreadsUpdated')::int),0)::int thread_rows from e
), classes as (
 select case
  when source_payload->'evidence'->>'collision' like 'candidate_slug_collides_with_current_community_thread:%' then 'thread_collision'
  when source_payload->'evidence'->>'collision' like 'candidate_slug_collides_with_track:%' then 'track_collision'
  when source_payload->'evidence'->>'collision'='missing_explicit_primary_artist_scope' then 'missing_primary'
  when source_payload->'evidence'->>'collision' like 'current_community_thread_ownership_ambiguous:%' then 'ambiguous_thread'
  else 'unexpected' end reason,count(*)::int count
 from public.registry_review_items
 where review_type='mizizi_data_hygiene'
   and status='open'
   and source_payload->>'ruleId'='track_slug_identity_noise'
 group by 1
)
select jsonb_build_object(
 'active_tracks',(select count(*) from public.registry_tracks where status='active'),
 'events',(select count(*) from e),'unique_fingerprints',(select count(distinct source_suggestion_id) from e),
 'event_track_matches',(select count(*) from e join public.registry_tracks t on t.id::text=e.registry_entity_id::text where t.slug=e.after_value->>'value'),
 'reviews',(select reviews from r),'blocked_still_old',(select blocked_still_old from r),'review_tracks',(select review_tracks from r),
 'redirects',(select count(*) from public.wk_slug_redirects where entity_type='track'),
 'mizizi_redirects',(select count(*) from public.wk_slug_redirects where entity_type='track' and created_by='mizizi:1.1.0'),
 'impact',(select to_jsonb(impact) from impact),'classes',(select jsonb_object_agg(reason,count) from classes),
 'chart_mismatches',(select count(*) from public.wk_chart_entries_v2 ce join e on ce.canonical_track_id=e.registry_entity_id::text where ce.track_slug is distinct from e.after_value->>'value'),
 'save_mismatches',(select count(*) from public.community_saves cs join e on cs.entity_type='track' and cs.entity_id=e.registry_entity_id::text where cs.entity_slug is distinct from e.after_value->>'value'),
 'ledger_count',(select count(*) from supabase_migrations.schema_migrations),'ledger_head',(select max(version) from supabase_migrations.schema_migrations)
) state`;

const reviewStateSql = `select jsonb_build_object(
 'open_mizizi_reviews',(select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open'),
 'historical_open_reviews',(select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open' and source_payload->>'ruleId'='track_slug_identity_noise'),
 'feature_slug_reviews',(select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open' and source_payload->>'ruleVersion'='1.1.0' and source_payload->>'ruleId'='track_slug_identity_noise'),
 'credit_gap_reviews',(select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open' and source_payload->>'ruleVersion'='1.3.0' and source_payload->>'ruleId'='track_slug_credit_evidence_gap'),
 'recording_identity_reviews',(select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open' and source_payload->>'ruleVersion'='1.3.0' and source_payload->>'ruleId'='track_recording_identity_conflict'),
 'release_single_reviews',(select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open' and source_payload->>'ruleVersion'='1.4.0' and source_payload->>'ruleId'='release_single_identity_conflict'),
 'active_tracks',(select count(*)::int from public.registry_tracks where status='active'),
 'canonical_events',(select count(*)::int from public.registry_canonical_write_events where actor='mizizi' and registry_entity_type='track'),
 'track_redirects',(select count(*)::int from public.wk_slug_redirects where entity_type='track'),
 'active_capability_grants',(select count(*)::int from platform_private.system_actor_capability_grants where actor_key='mizizi' and status='active' and valid_from<=now() and expires_at>now() and revoked_at is null),
 'active_execution_grants',(select count(*)::int from platform_private.registry_execution_grants where actor_key='mizizi' and status='active' and expires_at>now() and revoked_at is null and consumed_at is null),
 'ledger_count',(select count(*)::int from supabase_migrations.schema_migrations),
 'ledger_head',(select max(version) from supabase_migrations.schema_migrations)
) state`;

const featureReviewStateSql = `select coalesce(
 jsonb_agg(
   jsonb_build_object(
     'sourceId',source_id,
     'currentValue',source_payload->>'currentValue',
     'proposedValue',candidate_payload->>'proposedValue',
     'status',status,
     'ruleId',source_payload->>'ruleId',
     'ruleVersion',source_payload->>'ruleVersion'
   )
   order by source_id
 ),
 '[]'::jsonb
) rows
from public.registry_review_items
where review_type='mizizi_data_hygiene'
  and source_id in (${EXPECTED_1094_FEATURE_REVIEW_IDS_SQL})
  and source_payload->>'ruleId'='track_slug_identity_noise'
  and source_payload->>'ruleVersion'='1.1.0'`;

function assertFields(actual, expected, label) {
  for (const [k, v] of Object.entries(expected)) if (String(actual?.[k]) !== String(v)) throw new Error(`${label} ${k}=${actual?.[k]} expected ${v}`);
}

const PRE_APPLY_BASELINE = {
  active_tracks:2101,
  events:0,
  reviews:0,
  redirects:291,
  mizizi_redirects:0,
  ledger_count:79,
  ledger_head:'20260901170500',
};

const POST_APPLY_BASELINE = {
  active_tracks:2101,
  events:440,
  reviews:66,
  redirects:1148,
  mizizi_redirects:857,
  ledger_count:116,
  ledger_head:'20260914072142',
};

const POST_TRACK_ZERO_BASELINE = {
  ...POST_APPLY_BASELINE,
  reviews:32,
};

const POST_PRIMARY_FOLLOWUP_BASELINE = {
  ...POST_APPLY_BASELINE,
  reviews:27,
};

const POST_BATCH_A_BASELINE = {
  ...POST_APPLY_BASELINE,
  active_tracks:2091,
  reviews:12,
};

const POST_BATCH_B1_BASELINE = {
  ...POST_APPLY_BASELINE,
  active_tracks:2091,
  reviews:5,
};

function fieldsMatch(actual, expected) {
  return Object.entries(expected).every(
    ([key, value]) => String(actual?.[key]) === String(value),
  );
}

function postApplyDomainFieldsMatch(actual, expected) {
  return Object.entries(expected).every(
    ([key, value]) =>
      key === 'active_tracks' ||
      key === 'ledger_count' ||
      key === 'ledger_head' ||
      String(actual?.[key]) === String(value),
  );
}

function postApplyLedgerAccepted(actual, expected = POST_APPLY_BASELINE) {
  const actualCount = Number(actual?.ledger_count);
  const minimumCount = Number(expected.ledger_count);
  const actualHead = String(actual?.ledger_head || '');
  const minimumHead = String(expected.ledger_head || '');
  return (
    Number.isFinite(actualCount) &&
    Number.isFinite(minimumCount) &&
    actualCount >= minimumCount &&
    actualHead >= minimumHead
  );
}

function assertPostApplyLedger(state, label) {
  if (!postApplyLedgerAccepted(state, POST_APPLY_BASELINE)) {
    throw new Error(
      `${label} migration ledger regressed: count=${state?.ledger_count} head=${state?.ledger_head} minimum_count=${POST_APPLY_BASELINE.ledger_count} minimum_head=${POST_APPLY_BASELINE.ledger_head}`,
    );
  }
}

function classifyTrackProductionState(state) {
  if (fieldsMatch(state, PRE_APPLY_BASELINE)) return 'pre_apply';
  if (
    postApplyDomainFieldsMatch(state, POST_APPLY_BASELINE) &&
    postApplyLedgerAccepted(state, POST_APPLY_BASELINE)
  ) return 'post_apply';
  if (
    postApplyDomainFieldsMatch(state, POST_TRACK_ZERO_BASELINE) &&
    postApplyLedgerAccepted(state, POST_TRACK_ZERO_BASELINE)
  ) return 'post_track_zero';
  if (
    postApplyDomainFieldsMatch(state, POST_PRIMARY_FOLLOWUP_BASELINE) &&
    postApplyLedgerAccepted(state, POST_PRIMARY_FOLLOWUP_BASELINE)
  ) return 'post_primary_followup';
  if (
    postApplyDomainFieldsMatch(state, POST_BATCH_A_BASELINE) &&
    postApplyLedgerAccepted(state, POST_BATCH_A_BASELINE)
  ) return 'post_batch_a';
  if (
    postApplyDomainFieldsMatch(state, POST_BATCH_B1_BASELINE) &&
    postApplyLedgerAccepted(state, POST_BATCH_B1_BASELINE)
  ) return 'post_batch_b1';
  return 'unexpected';
}

function assertAcceptedPostApply(state) {
  const reviewCount = Number(state?.reviews);
  const acceptedHistorical = reviewCount === 66;
  const acceptedTrackZeroResidual = reviewCount === 32;
  const acceptedPrimaryFollowupResidual = reviewCount === 27;
  const acceptedBatchAResidual = reviewCount === 12;
  const acceptedBatchB1Residual = reviewCount === 5;

  if (
    !acceptedHistorical &&
    !acceptedTrackZeroResidual &&
    !acceptedPrimaryFollowupResidual &&
    !acceptedBatchAResidual &&
    !acceptedBatchB1Residual
  ) {
    throw new Error(
      `accepted Track review boundary is not recognized: ${reviewCount}`,
    );
  }

  const activeTracks = Number(state?.active_tracks);
  const historicalMinimumActiveTracks =
    acceptedBatchAResidual || acceptedBatchB1Residual
      ? 2091
      : 2101;

  if (
    !Number.isInteger(activeTracks) ||
    activeTracks < historicalMinimumActiveTracks
  ) {
    throw new Error(
      `active Tracks regressed below accepted historical floor: ${activeTracks} < ${historicalMinimumActiveTracks}`,
    );
  }

  assertFields(
    state,
    {
      events:440,
      unique_fingerprints:440,
      event_track_matches:440,
      reviews:reviewCount,
      blocked_still_old:reviewCount,
      review_tracks:reviewCount,
      redirects:1148,
      mizizi_redirects:857,
      chart_mismatches:0,
      save_mismatches:0,
    },
    'acceptance',
  );
  assertPostApplyLedger(state, 'acceptance');
  assertFields(
    state.impact,
    {
      redirects:857,
      chart_rows:7,
      save_slug_rows:3,
      save_url_rows:3,
      thread_rows:162,
    },
    'impact',
  );

  const expectedClasses = acceptedBatchB1Residual
    ? {
        track_collision:4,
        missing_primary:1,
      }
    : acceptedBatchAResidual
      ? {
          track_collision:11,
          missing_primary:1,
        }
      : acceptedPrimaryFollowupResidual
        ? {
            track_collision:26,
            missing_primary:1,
          }
        : acceptedTrackZeroResidual
          ? {
              track_collision:26,
              missing_primary:6,
            }
          : {
              thread_collision:28,
              track_collision:26,
              missing_primary:6,
              ambiguous_thread:6,
            };

  assertFields(
    state.classes,
    expectedClasses,
    'reviews',
  );

  const actualClassKeys = Object.keys(
    state.classes || {},
  ).sort().join(',');
  const expectedClassKeys = Object.keys(
    expectedClasses,
  ).sort().join(',');

  if (actualClassKeys !== expectedClassKeys) {
    throw new Error(
      `unexpected review classes=${actualClassKeys} expected=${expectedClassKeys}`,
    );
  }
}

function reviewMaterializationComplete(state) {
  return (
    Number(state?.open_mizizi_reviews) === 160 &&
    Number(state?.feature_slug_reviews) === 17 &&
    Number(state?.credit_gap_reviews) === 12 &&
    Number(state?.recording_identity_reviews) === 91 &&
    Number(state?.release_single_reviews) === 40
  );
}

function assertReviewState(state, finalState) {
  assertFields(
    state,
    {
      active_tracks:2122,
      canonical_events:440,
      track_redirects:1148,
      credit_gap_reviews:12,
      recording_identity_reviews:91,
      release_single_reviews:40,
      active_capability_grants:0,
      active_execution_grants:0,
      ledger_count:212,
      ledger_head:'20261008180201',
    },
    finalState ? 'review acceptance' : 'review baseline',
  );

  const featureSlug = Number(state?.feature_slug_reviews);
  const historicalOpen = Number(state?.historical_open_reviews);
  const openReviews = Number(state?.open_mizizi_reviews);

  if (finalState) {
    assertFields(
      state,
      {
        open_mizizi_reviews:160,
        historical_open_reviews:17,
        feature_slug_reviews:17,
      },
      'review acceptance',
    );
    return;
  }

  if (
    !Number.isInteger(featureSlug) ||
    featureSlug < 5 ||
    featureSlug > 17 ||
    historicalOpen !== featureSlug ||
    openReviews !== 143 + featureSlug
  ) {
    throw new Error(
      `#1094 review baseline is not a resumable subset: open=${openReviews} feature_slug=${featureSlug} historical_open=${historicalOpen}`,
    );
  }
}

function assertFeatureReviewRows(rows, complete) {
  const expected = new Map(
    EXPECTED_1094_FEATURE_REVIEW_TARGETS.map(
      ([id,currentValue,proposedValue]) => [
        id,
        { currentValue, proposedValue },
      ],
    ),
  );
  const actualRows = Array.isArray(rows) ? rows : [];

  for (const row of actualRows) {
    const target = expected.get(String(row?.sourceId || ''));
    if (!target) {
      throw new Error(`unexpected #1094 feature review row ${row?.sourceId}`);
    }
    assertFields(
      row,
      {
        currentValue:target.currentValue,
        proposedValue:target.proposedValue,
        status:'open',
        ruleId:'track_slug_identity_noise',
        ruleVersion:'1.1.0',
      },
      `#1094 feature review ${row.sourceId}`,
    );
  }

  if (complete && actualRows.length !== expected.size) {
    throw new Error(
      `#1094 feature review set incomplete: ${actualRows.length}/${expected.size}`,
    );
  }
}

function assertReviewRun(text) {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
  if (
    !clean.includes('track_slug_identity_noise') ||
    !clean.includes('Review mode completed. No canonical Registry rows were changed.')
  ) {
    throw new Error('review-mode run did not prove bounded review-only completion');
  }
}

function assertCurrentAuditReadOnly(text) {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
  if (
    !clean.includes('Audit mode completed. No Registry rows were changed.')
  ) {
    throw new Error('current Track audit did not prove read-only completion');
  }
  const counts = {};
  for (const rule of [
    'track_slug_identity_noise',
    'track_title_credit_noise',
    'track_slug_identity_mismatch',
    'track_slug_credit_evidence_gap',
    'track_recording_identity_conflict',
  ]) {
    const match = clean.match(
      new RegExp(`'${rule}'\\s*\\u2502\\s*(\\d+)\\s*\\u2502`),
    );
    if (!match) throw new Error(`${rule} current audit count was not parseable`);
    counts[rule] = Number(match[1]);
  }
  return counts;
}

function assertAudit(text, before) {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '');

  if (!before) {
    const counts = {};

    for (const rule of [
      'track_slug_identity_noise',
      'track_title_credit_noise',
      'track_slug_identity_mismatch',
      'track_slug_credit_evidence_gap',
      'track_recording_identity_conflict',
    ]) {
      const match = clean.match(
        new RegExp(
          `'${rule}'\\s*\\u2502\\s*(\\d+)\\s*\\u2502`,
        ),
      );

      if (!match) {
        throw new Error(
          `${rule} current audit count was not parseable`,
        );
      }

      const count = Number(match[1]);
      if (!Number.isInteger(count) || count < 0) {
        throw new Error(
          `${rule} current audit count is invalid: ${match[1]}`,
        );
      }

      counts[rule] = count;
    }

    if (
      !clean.includes(
        'Audit mode completed. No Registry rows were changed.',
      )
    ) {
      throw new Error(
        'post-apply audit did not prove read-only completion',
      );
    }

    return counts;
  }

  const identityNoiseMatch = clean.match(
    /'track_slug_identity_noise'\s*\u2502\s*(\d+)\s*\u2502/,
  );

  if (!identityNoiseMatch) {
    throw new Error(
      'track_slug_identity_noise audit count was not parseable',
    );
  }

  const identityNoise = Number(identityNoiseMatch[1]);

  if (before) {
    if (identityNoise !== 506) {
      throw new Error(
        `track_slug_identity_noise expected 506, found ${identityNoise}`,
      );
    }
  } else if (![66,32,27,12].includes(identityNoise)) {
    throw new Error(
      `track_slug_identity_noise is outside accepted post-apply boundaries: ${identityNoise}`,
    );
  }

  const postBatchA = identityNoise === 12;
  const titleNoise = postBatchA ? 482 : 492;
  const recordingIdentityConflict = postBatchA ? 71 : 91;
  const trackCount = postBatchA ? 2091 : 2101;

  const rules = [
    ['track_title_credit_noise',titleNoise],
    ['track_slug_identity_mismatch',3],
    ['track_slug_credit_evidence_gap',12],
    ['track_recording_identity_conflict',recordingIdentityConflict],
  ];

  for (const [rule,count] of rules) {
    if (
      !(new RegExp(
        `'${rule}'\\s*\u2502\\s*${count}\\s*\u2502`,
      )).test(clean)
    ) {
      throw new Error(`${rule} expected ${count}`);
    }
  }

  const expectedFindings =
    identityNoise +
    titleNoise +
    3 +
    12 +
    recordingIdentityConflict;
  const observeOnly = titleNoise + 3;
  const summary = new RegExp(
    `\\u2502\\s*0\\s*\\u2502\\s*${expectedFindings}` +
      `\\s*\\u2502\\s*0\\s*\\u2502\\s*0` +
      `\\s*\\u2502\\s*${observeOnly}\\s*\\u2502\\s*0` +
      `\\s*\\u2502\\s*${trackCount}\\s*\\u2502`,
  );

  if (
    !summary.test(clean) ||
    !clean.includes(
      'Audit mode completed. No Registry rows were changed.',
    )
  ) {
    throw new Error(
      `${before ? 'pre' : 'post'}-apply audit summary mismatch`,
    );
  }
}

async function streamCommand(cmd, args, env, logPath, pool = null, progressTarget = { events:440, reviews:66, redirects:857 }) {
  const out = fs.createWriteStream(logPath);
  const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => { process.stdout.write(d); out.write(d); });
  child.stderr.on('data', d => { process.stderr.write(d); out.write(d); });
  const timer = pool ? setInterval(async () => {
    try {
      const { rows:[s] } = await pool.query(`select
       (select count(*)::int from public.registry_canonical_write_events where actor='mizizi' and registry_entity_type='track') events,
       (select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open') reviews,
       (select count(*)::int from public.wk_slug_redirects where entity_type='track' and created_by='mizizi:1.1.0') redirects`);
      console.log(`PROGRESS events=${s.events}/${progressTarget.events} reviews=${s.reviews}/${progressTarget.reviews} redirects=${s.redirects}/${progressTarget.redirects}`);
    } catch (e) { console.error(`PROGRESS_MONITOR ${e.code || 'UNKNOWN'} ${e.message}`); }
  }, 10000) : null;
  const code = await new Promise(resolve => child.on('close', resolve));
  if (timer) clearInterval(timer);
  out.end();
  if (code !== 0) throw new Error(`${cmd} exited ${code}`);
}

async function main() {
  console.log('\n=== 1. REPOSITORY + PREVIEW-PROVEN RUNTIME ===');
  run('git',['fetch','--prune','origin','main']);
  if (run('git',['status','--porcelain'],{capture:true})) throw new Error('worktree is not clean');
  for (const [path,sha] of Object.entries(EXPECTED_BLOBS)) assertFields({sha:run('git',['hash-object',path],{capture:true})},{sha},path);
  let trigger = null;
  if (MODE === 'apply' || MODE === 'review') {
    if (!EXPECTED_MAIN || !TRIGGER_FILE) throw new Error('reviewed production trigger is missing');
    trigger = JSON.parse(fs.readFileSync(TRIGGER_FILE, 'utf8'));
    const expectedTrigger =
      MODE === 'review'
        ? {
            operation:'mizizi_track_production_review',
            confirm:'MIZIZI_TRACK_PRODUCTION_REVIEW',
            expected_input_fingerprint:EXPECTED_REVIEW_INPUT_FINGERPRINT,
            expected_existing_open_reviews:148,
            expected_existing_feature_slug_reviews:5,
            expected_new_feature_slug_reviews:12,
            expected_final_open_reviews:160,
            expected_final_feature_slug_reviews:17,
            expected_credit_gap_reviews:12,
            expected_recording_identity_reviews:91,
          }
        : {
            operation:'mizizi_track_production_apply',
            confirm:'MIZIZI_TRACK_PRODUCTION_APPLY',
            expected_input_fingerprint:EXPECTED_FINGERPRINT,
            enable_ssl_enforcement:true,
          };
    assertFields(
      trigger,
      expectedTrigger,
      'production trigger',
    );
    assertFields(
      {head:run('git',['rev-parse','HEAD'],{capture:true}),main:run('git',['rev-parse','origin/main'],{capture:true})},
      {head:EXPECTED_MAIN,main:EXPECTED_MAIN},
      'main',
    );
  }
  console.log('PASS: accepted-preview MIZIZI runtime bytes exact');
  run('npx',['vitest','run','test/registry/mizizi-cultural-data-steward.test.ts']);

  console.log('\n=== 2. EXISTING SUPABASE CONTROL PLANE + TEMPORARY ACCESS ===');
  run('npx',['--yes','supabase@2.108.0','link','--project-ref',PROJECT_REF]);
  const profile = await api('GET','/v1/profile');
  const userId = profileId(profile);
  if (!userId) throw new Error('Supabase profile did not expose a JIT user id');
  const initialConfig = await api('GET',`/v1/projects/${PROJECT_REF}/jit-access`);
  let originalState = configState(initialConfig);

  if (originalState === 'unavailable') {
    const ssl = await api('GET',`/v1/projects/${PROJECT_REF}/ssl-enforcement`);
    const enforced = Boolean(ssl?.currentConfig?.database);

    if (MODE === 'preflight') {
      if (enforced) throw new Error('temporary access unavailable even though SSL enforcement is enabled');
      const baseline = queryViaLinkedCli(baselineSql);
      assertFields(baseline,{active_tracks:2101,events:0,reviews:0,redirects:291,mizizi_redirects:0,ledger_count:79,ledger_head:'20260901170500'},'baseline');
      const fp = queryViaLinkedCli(fingerprintSql);
      if (fp.fingerprint !== EXPECTED_FINGERPRINT) throw new Error(`accepted-rehearsal input fingerprint drift: ${fp.fingerprint}`);
      console.log('PASS: production baseline and full-row rehearsal fingerprint exact through existing Supabase control plane');
      console.log('PASS: SSL enforcement bootstrap is the only remaining raw-session prerequisite');
      console.log('\n=== MIZIZI PRODUCTION CONTROL-PLANE STRUCTURAL PREFLIGHT PASS ===');
      console.log('Registry mutation: NO');
      return;
    }

    if (MODE !== 'apply' || !trigger?.enable_ssl_enforcement) throw new Error('production temporary access unavailable; only reviewed historical apply may authorize permanent SSL enforcement');
    console.log('\n=== 2A. PERMANENT PRODUCTION SSL ENFORCEMENT ===');
    const baseline = queryViaLinkedCli(baselineSql);
    assertFields(baseline,{active_tracks:2101,events:0,reviews:0,redirects:291,mizizi_redirects:0,ledger_count:79,ledger_head:'20260901170500'},'pre-SSL baseline');
    const fp = queryViaLinkedCli(fingerprintSql);
    if (fp.fingerprint !== EXPECTED_FINGERPRINT) throw new Error(`pre-SSL rehearsal fingerprint drift: ${fp.fingerprint}`);
    await api('PUT',`/v1/projects/${PROJECT_REF}/ssl-enforcement`,{requestedConfig:{database:true}});
    await waitForDatabaseHealth();
    console.log('PASS: production SSL enforcement enabled and database healthy');

    for (let attempt = 1; attempt <= 24; attempt += 1) {
      originalState = configState(await api('GET',`/v1/projects/${PROJECT_REF}/jit-access`));
      if (['enabled','disabled'].includes(originalState)) break;
      await sleep(5000);
    }
  }

  if (!['enabled','disabled'].includes(originalState)) throw new Error(`temporary access did not become available after SSL enforcement: ${originalState}`);
  console.log(`Temporary access at entry: ${originalState}`);

  const transportRole = resolveMiziziTransportRole();

  let reviewBefore = null;
  let reviewBaseline = null;
  let reviewAcceptedState = null;
  if (MODE === 'review') {
    if (originalState !== 'disabled') {
      throw new Error(
        `#1094 review requires production temporary access disabled at entry; found ${originalState}`,
      );
    }

    console.log('\n=== 2B. PRIVILEGED #1094 REVIEW PRECONDITION SNAPSHOT ===');
    reviewBaseline = await queryViaLinkedCliWithRetry(
      baselineSql,
      'review baseline',
    );
    const reviewProductionState = classifyTrackProductionState(reviewBaseline);
    if (![
      'post_apply',
      'post_track_zero',
      'post_primary_followup',
      'post_batch_a',
      'post_batch_b1',
    ].includes(reviewProductionState)) {
      throw new Error(
        `#1094 review baseline is not an accepted post-apply state: ${reviewProductionState}`,
      );
    }

    reviewAcceptedState = (
      await queryViaLinkedCliWithRetry(
        acceptanceSql,
        'review historical acceptance',
      )
    ).state;
    assertAcceptedPostApply(reviewAcceptedState);

    const reviewFingerprintBefore = await queryViaLinkedCliWithRetry(
      fingerprintSql,
      'review fingerprint before',
    );
    if (reviewFingerprintBefore.fingerprint !== EXPECTED_REVIEW_INPUT_FINGERPRINT) {
      throw new Error(
        `review input fingerprint drift: ${reviewFingerprintBefore.fingerprint}`,
      );
    }

    reviewBefore = (
      await queryViaLinkedCliWithRetry(
        reviewStateSql,
        'review state before',
      )
    ).state;
    assertReviewState(reviewBefore,false);
    const featureReviewBefore = (
      await queryViaLinkedCliWithRetry(
        featureReviewStateSql,
        'feature review rows before',
      )
    ).rows;
    assertFeatureReviewRows(
      featureReviewBefore,
      reviewMaterializationComplete(reviewBefore),
    );
    fs.writeFileSync(
      `${ARTIFACT_DIR}/review-state-before.json`,
      JSON.stringify(reviewBefore,null,2)+'\n',
    );

    if (reviewMaterializationComplete(reviewBefore)) {
      console.log('PASS: review materialization was already complete; no executor session required');
      console.log('\n=== MIZIZI PUBLIC MUSIC IDENTITY REVIEW MATERIALIZATION PASS ===');
      return;
    }
  }

  let existing = null;
  let originalRoles = [];
  let mappingChanged = false;
  let pool = null;
  let jitRestored = false;

  const restoreJitState = async () => {
    if (jitRestored) return;
    const cleanupErrors = [];

    if (pool) {
      await pool.end().catch(error => {
        cleanupErrors.push(`pool cleanup failed: ${error?.message || error}`);
      });
      pool = null;
    }

    if (mappingChanged) {
      try {
        if (existing) {
          await api('PUT',`/v1/projects/${PROJECT_REF}/database/jit`,{user_id:userId,roles:originalRoles});
        } else {
          await api('DELETE',`/v1/projects/${PROJECT_REF}/database/jit/${userId}`);
        }
        mappingChanged = false;
      } catch (error) {
        cleanupErrors.push(`mapping cleanup failed: ${error?.message || error}`);
      }
    }

    try {
      await api('PUT',`/v1/projects/${PROJECT_REF}/jit-access`,{state:'disabled'});
    } catch (error) {
      cleanupErrors.push(`temporary-access cleanup failed: ${error?.message || error}`);
    }

    if (cleanupErrors.length) throw new Error(cleanupErrors.join('; '));
    jitRestored = true;
    console.log('PASS: JIT mapping restored and production temporary access disabled at rest');
  };
  try {
    const list = rowsFromJitList(await api('GET',`/v1/projects/${PROJECT_REF}/database/jit/list`));
    existing = list.find(x => String(x.user_id || x.id || x.gotrue_id || '') === userId) || null;
    originalRoles = existing && Array.isArray(existing.user_roles) ? existing.user_roles : [];

    if (originalState === 'disabled') {
      await api('PUT',`/v1/projects/${PROJECT_REF}/jit-access`,{state:'enabled'});
    }

    const roles = originalRoles.filter(r => !['postgres','mizizi_executor'].includes(String(r.role || '')));
    roles.push({ role:transportRole, expires_at: Date.now() + 60*60*1000 });
    await api('PUT',`/v1/projects/${PROJECT_REF}/database/jit`,{user_id:userId,roles});
    mappingChanged = true;

    const url = databaseUrl(transportRole);
    console.log(`::add-mask::${url}`);
    pool = await createJitPoolWithRetry(url,transportRole);
    try {
      console.log('\n=== 3. PRODUCTION TRACK STATE ===');
      const baseline =
        MODE === 'review'
          ? reviewBaseline
          : queryViaLinkedCli(baselineSql);
      const productionState = classifyTrackProductionState(baseline);
      if (productionState === 'unexpected') {
        throw new Error(
          `production Track state is neither accepted pre-apply nor accepted post-apply: ${JSON.stringify(baseline)}`,
        );
      }
      fs.writeFileSync(`${ARTIFACT_DIR}/state-before.json`,JSON.stringify(baseline,null,2)+'\n');

      if (
        productionState === 'post_apply' ||
        productionState === 'post_track_zero' ||
        productionState === 'post_primary_followup' ||
        productionState === 'post_batch_a' ||
        productionState === 'post_batch_b1'
      ) {
        console.log('PASS: accepted historical Track post-apply baseline detected');

        console.log('\n=== 4. EXACT POST-APPLY ACCEPTANCE ===');
        const acceptedState =
          MODE === 'review'
            ? reviewAcceptedState
            : queryViaLinkedCli(acceptanceSql).state;
        assertAcceptedPostApply(acceptedState);
        fs.writeFileSync(
          `${ARTIFACT_DIR}/state-after.json`,
          JSON.stringify(acceptedState,null,2)+'\n',
        );
        console.log(`PASS: production acceptance exact 440 / ${acceptedState.reviews} / 857 with exact downstream impact`);

        console.log('\n=== 5. FRESH POST-APPLY READ-ONLY AUDIT ===');
        const auditCurrent = `${ARTIFACT_DIR}/post-apply-audit.txt`;
        await streamCommand(
          'npm',
          ['run','registry:mizizi:audit','--','--entity=track','--limit=0'],
          {DATABASE_URL:url},
          auditCurrent,
        );
        const auditCounts =
          MODE === 'review'
            ? assertCurrentAuditReadOnly(
                fs.readFileSync(auditCurrent,'utf8'),
              )
            : assertAudit(
                fs.readFileSync(auditCurrent,'utf8'),
                false,
              );
        console.log(
          'PASS: fresh post-apply read-only audit completed with dynamic current findings ' +
          JSON.stringify(auditCounts) +
          ` / ${acceptedState.active_tracks} Tracks; historical MIZIZI receipts remain exact`,
        );

        if (MODE === 'review') {
          console.log('\n=== 6. REVIEW-ONLY PRODUCTION AUTHORITY ===');
          if (!reviewBefore) {
            throw new Error('#1094 privileged precondition snapshot is missing');
          }

          console.log('\n=== 7. REAL MIZIZI REVIEW MATERIALIZATION - PRODUCTION ===');
          const reviewLog = `${ARTIFACT_DIR}/review-materialization.txt`;
          await streamCommand(
            'npm',
            ['run','registry:mizizi:review','--','--entity=track','--limit=0'],
            {DATABASE_URL:url},
            reviewLog,
            null,
          );
          assertReviewRun(fs.readFileSync(reviewLog,'utf8'));

          console.log('\n=== 8. FRESH POST-REVIEW READ-ONLY AUDIT ===');
          const postReviewAudit = `${ARTIFACT_DIR}/post-review-audit.txt`;
          await streamCommand(
            'npm',
            ['run','registry:mizizi:audit','--','--entity=track','--limit=0'],
            {DATABASE_URL:url},
            postReviewAudit,
          );
          assertCurrentAuditReadOnly(
            fs.readFileSync(postReviewAudit,'utf8'),
          );

          console.log('\n=== 9. RESTORE NARROW EXECUTOR + PRIVILEGED ACCEPTANCE ===');
          await restoreJitState();

          const reviewAfter = (
            await queryViaLinkedCliWithRetry(
              reviewStateSql,
              'review state after',
            )
          ).state;
          assertReviewState(reviewAfter,true);
          const featureReviewAfter = (
            await queryViaLinkedCliWithRetry(
              featureReviewStateSql,
              'feature review rows after',
            )
          ).rows;
          assertFeatureReviewRows(featureReviewAfter,true);
          const reviewFingerprintAfter = await queryViaLinkedCliWithRetry(
            fingerprintSql,
            'review fingerprint after',
          );
          if (reviewFingerprintAfter.fingerprint !== EXPECTED_REVIEW_INPUT_FINGERPRINT) {
            throw new Error(
              `canonical Registry input changed during review materialization: ${reviewFingerprintAfter.fingerprint}`,
            );
          }
          fs.writeFileSync(
            `${ARTIFACT_DIR}/review-state-after.json`,
            JSON.stringify(reviewAfter,null,2)+'\n',
          );
          console.log('PASS: #1094 review materialization exact +12 feature-slug reviews with canonical delta zero');
          console.log('\n=== MIZIZI PUBLIC MUSIC IDENTITY REVIEW MATERIALIZATION PASS ===');
          return;
        }

        if (MODE === 'apply') {
          throw new Error('historical Track apply is already accepted; refusing repeat production mutation');
        }

        console.log('\n=== MIZIZI PRODUCTION CONTROL-PLANE POST-APPLY PREFLIGHT PASS ===');
        console.log('Registry mutation: NO');
        return;
      }

      console.log('PASS: accepted historical Track pre-apply baseline detected');
      const fp = queryViaLinkedCli(fingerprintSql);
      if (fp.fingerprint !== EXPECTED_FINGERPRINT) throw new Error(`accepted-rehearsal input fingerprint drift: ${fp.fingerprint}`);
      console.log(`PASS: exact full-row input fingerprint ${fp.fingerprint}`);

      console.log('\n=== 4. FRESH READ-ONLY PRODUCTION AUDIT ===');
      const auditBefore = `${ARTIFACT_DIR}/pre-apply-audit.txt`;
      await streamCommand('npm',['run','registry:mizizi:audit','--','--entity=track','--limit=0'],{DATABASE_URL:url},auditBefore);
      assertAudit(fs.readFileSync(auditBefore,'utf8'),true);
      console.log('PASS: fresh production audit = 1001 findings / 506 candidates / 495 observe-only / 2101 Tracks');

      if (MODE === 'preflight') {
        console.log('\n=== MIZIZI PRODUCTION CONTROL-PLANE PRE-APPLY PREFLIGHT PASS ===');
        console.log('Registry mutation: NO');
        return;
      }

      console.log('\n=== 5. REAL MIZIZI TRACK APPLY - PRODUCTION ===');
      await streamCommand('npm',['run','registry:mizizi:apply','--','--entity=track','--limit=0','--confirm=MIZIZI_APPLY'],{DATABASE_URL:url},`${ARTIFACT_DIR}/apply.txt`,pool);

      console.log('\n=== 6. EXACT PRODUCTION ACCEPTANCE ===');
      const s = queryViaLinkedCli(acceptanceSql).state;
      assertAcceptedPostApply(s);
      fs.writeFileSync(`${ARTIFACT_DIR}/state-after.json`,JSON.stringify(s,null,2)+'\n');
      console.log(`PASS: production acceptance exact 440 / ${s.reviews} / 857 with exact downstream impact`);

      console.log('\n=== 7. FRESH POST-APPLY AUDIT ===');
      const auditAfter = `${ARTIFACT_DIR}/post-apply-audit.txt`;
      await streamCommand('npm',['run','registry:mizizi:audit','--','--entity=track','--limit=0'],{DATABASE_URL:url},auditAfter);
      assertAudit(fs.readFileSync(auditAfter,'utf8'),false);
      console.log('\n=== MIZIZI HISTORICAL TRACK PRODUCTION APPLY PASS ===');
    } finally {
      if (pool) {
        await pool.end().catch(()=>{});
        pool = null;
      }
    }
  } finally {
    await restoreJitState();
  }
}

main().catch(e => { console.error(`\nMIZIZI production control plane failed: ${e.message || e}`); process.exitCode=1; });
