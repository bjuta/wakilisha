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
const EXPECTED_REVIEW_INPUT_FINGERPRINT = '6d9fa72f13ce4a5d774a457552e3cd3824475fb8a651473d5999605a3dcc29fb';
const EXPECTED_BLOBS = {
  'scripts/registry/agents/mizizi/run.ts': '9d17f2838aeed154d3b93abbcfe687ba6c38be94',
  'scripts/registry/agents/mizizi/core.ts': '164c9b5a0431b06f8d990b0aff6c6ef8a998aacb',
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
    message.includes('password authentication failed')
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
) select encode(digest(convert_to(body::text,'UTF8'),'sha256'),'hex') fingerprint from payload`;

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
 'credit_gap_reviews',(select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open' and source_payload->>'ruleVersion'='1.3.0' and source_payload->>'ruleId'='track_slug_credit_evidence_gap'),
 'recording_identity_reviews',(select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open' and source_payload->>'ruleVersion'='1.3.0' and source_payload->>'ruleId'='track_recording_identity_conflict'),
 'canonical_events',(select count(*)::int from public.registry_canonical_write_events where actor='mizizi' and registry_entity_type='track'),
 'track_redirects',(select count(*)::int from public.wk_slug_redirects where entity_type='track'),
 'active_capability_grants',(select count(*)::int from platform_private.system_actor_capability_grants where actor_key='mizizi' and status='active' and valid_from<=now() and expires_at>now() and revoked_at is null),
 'active_execution_grants',(select count(*)::int from platform_private.registry_execution_grants where actor_key='mizizi' and status='active' and expires_at>now() and revoked_at is null and consumed_at is null),
 'ledger_count',(select count(*)::int from supabase_migrations.schema_migrations),
 'ledger_head',(select max(version) from supabase_migrations.schema_migrations)
) state`;

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

function fieldsMatch(actual, expected) {
  return Object.entries(expected).every(
    ([key, value]) => String(actual?.[key]) === String(value),
  );
}

function postApplyDomainFieldsMatch(actual, expected) {
  return Object.entries(expected).every(
    ([key, value]) =>
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
  return 'unexpected';
}

function assertAcceptedPostApply(state) {
  const reviewCount = Number(state?.reviews);
  const acceptedHistorical = reviewCount === 66;
  const acceptedTrackZeroResidual = reviewCount === 32;

  if (!acceptedHistorical && !acceptedTrackZeroResidual) {
    throw new Error(
      `accepted Track review boundary is not recognized: ${reviewCount}`,
    );
  }

  assertFields(
    state,
    {
      active_tracks:2101,
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

  const expectedClasses = acceptedTrackZeroResidual
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
    Number(state?.open_mizizi_reviews) === 169 &&
    Number(state?.historical_open_reviews) === 66 &&
    Number(state?.credit_gap_reviews) === 12 &&
    Number(state?.recording_identity_reviews) === 91
  );
}

function assertReviewState(state, finalState) {
  assertFields(
    state,
    {
      historical_open_reviews:66,
      canonical_events:440,
      track_redirects:1148,
      active_capability_grants:0,
      active_execution_grants:0,
      ledger_count:179,
      ledger_head:'20260925050859',
    },
    finalState ? 'review acceptance' : 'review baseline',
  );

  const creditGap = Number(state?.credit_gap_reviews);
  const identityConflict = Number(state?.recording_identity_reviews);
  const openReviews = Number(state?.open_mizizi_reviews);

  if (finalState) {
    assertFields(
      state,
      {
        open_mizizi_reviews:169,
        credit_gap_reviews:12,
        recording_identity_reviews:91,
      },
      'review acceptance',
    );
    return;
  }

  if (
    !Number.isInteger(creditGap) ||
    !Number.isInteger(identityConflict) ||
    creditGap < 0 ||
    creditGap > 12 ||
    identityConflict < 0 ||
    identityConflict > 91 ||
    openReviews !== 66 + creditGap + identityConflict
  ) {
    throw new Error(
      `review baseline is not a resumable subset: open=${openReviews} credit_gap=${creditGap} recording_identity=${identityConflict}`,
    );
  }
}

function assertReviewRun(text) {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
  for (const [rule,count] of [
    ['track_recording_identity_conflict',91],
    ['track_slug_identity_noise',66],
    ['track_slug_credit_evidence_gap',12],
  ]) {
    if (!(new RegExp(`'${rule}'\\s*\\u2502\\s*${count}\\s*\\u2502`)).test(clean)) {
      throw new Error(`${rule} expected ${count} in review run`);
    }
  }

  const summary =
    /\u2502\s*0\s*\u2502\s*664\s*\u2502\s*0\s*\u2502\s*103\s*\u2502\s*495\s*\u2502\s*0\s*\u2502\s*2101\s*\u2502/;

  if (
    !summary.test(clean) ||
    !clean.includes('Review mode completed. No canonical Registry rows were changed.')
  ) {
    throw new Error('review-mode run summary mismatch');
  }
}

function assertAudit(text, before) {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '');

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
  } else if (![66,32].includes(identityNoise)) {
    throw new Error(
      `track_slug_identity_noise is outside accepted post-apply boundaries: ${identityNoise}`,
    );
  }

  const rules = [
    ['track_title_credit_noise',492],
    ['track_slug_identity_mismatch',3],
    ['track_slug_credit_evidence_gap',12],
    ['track_recording_identity_conflict',91],
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

  const expectedFindings = 598 + identityNoise;
  const summary = new RegExp(
    `\\u2502\\s*0\\s*\\u2502\\s*${expectedFindings}` +
      `\\s*\\u2502\\s*0\\s*\\u2502\\s*0` +
      `\\s*\\u2502\\s*495\\s*\\u2502\\s*0` +
      `\\s*\\u2502\\s*2101\\s*\\u2502`,
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
            expected_existing_open_reviews:66,
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

  let existing = null;
  let originalRoles = [];
  let mappingChanged = false;
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
    const pool = await createJitPoolWithRetry(url,transportRole);
    try {
      console.log('\n=== 3. PRODUCTION TRACK STATE ===');
      const baseline = queryViaLinkedCli(baselineSql);
      const productionState = classifyTrackProductionState(baseline);
      if (productionState === 'unexpected') {
        throw new Error(
          `production Track state is neither accepted pre-apply nor accepted post-apply: ${JSON.stringify(baseline)}`,
        );
      }
      fs.writeFileSync(`${ARTIFACT_DIR}/state-before.json`,JSON.stringify(baseline,null,2)+'\n');

      if (
        productionState === 'post_apply' ||
        productionState === 'post_track_zero'
      ) {
        console.log('PASS: accepted historical Track post-apply baseline detected');

        console.log('\n=== 4. EXACT POST-APPLY ACCEPTANCE ===');
        const acceptedState = queryViaLinkedCli(acceptanceSql).state;
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
        assertAudit(fs.readFileSync(auditCurrent,'utf8'),false);
        console.log(`PASS: fresh post-apply audit = ${598 + Number(acceptedState.reviews)} findings / ${acceptedState.reviews} deterministic candidates / 12 credit-evidence reviews / 91 recording-identity reviews / 495 observe-only / 2101 Tracks`);

        if (MODE === 'review') {
          console.log('\n=== 6. REVIEW-ONLY PRODUCTION AUTHORITY ===');
          const reviewFingerprintBefore = queryViaLinkedCli(fingerprintSql);
          if (reviewFingerprintBefore.fingerprint !== EXPECTED_REVIEW_INPUT_FINGERPRINT) {
            throw new Error(
              `review input fingerprint drift: ${reviewFingerprintBefore.fingerprint}`,
            );
          }

          const reviewBefore = queryViaLinkedCli(reviewStateSql).state;
          assertReviewState(reviewBefore,false);
          fs.writeFileSync(
            `${ARTIFACT_DIR}/review-state-before.json`,
            JSON.stringify(reviewBefore,null,2)+'\n',
          );

          if (reviewMaterializationComplete(reviewBefore)) {
            console.log('PASS: review materialization was already complete; no duplicate runner execution required');
            console.log('\n=== MIZIZI PUBLIC MUSIC IDENTITY REVIEW MATERIALIZATION PASS ===');
            return;
          }

          console.log('\n=== 7. REAL MIZIZI REVIEW MATERIALIZATION - PRODUCTION ===');
          const reviewLog = `${ARTIFACT_DIR}/review-materialization.txt`;
          await streamCommand(
            'npm',
            ['run','registry:mizizi:review','--','--entity=track','--limit=0'],
            {DATABASE_URL:url},
            reviewLog,
            pool,
            {events:440,reviews:169,redirects:857},
          );
          assertReviewRun(fs.readFileSync(reviewLog,'utf8'));

          console.log('\n=== 8. REVIEW-ONLY PRODUCTION ACCEPTANCE ===');
          const reviewAfter = queryViaLinkedCli(reviewStateSql).state;
          assertReviewState(reviewAfter,true);
          const reviewFingerprintAfter = queryViaLinkedCli(fingerprintSql);
          if (reviewFingerprintAfter.fingerprint !== EXPECTED_REVIEW_INPUT_FINGERPRINT) {
            throw new Error(
              `canonical Registry input changed during review materialization: ${reviewFingerprintAfter.fingerprint}`,
            );
          }
          fs.writeFileSync(
            `${ARTIFACT_DIR}/review-state-after.json`,
            JSON.stringify(reviewAfter,null,2)+'\n',
          );
          console.log('PASS: review materialization exact 12 + 91 = 103 with canonical delta zero');

          console.log('\n=== 9. FRESH POST-REVIEW READ-ONLY AUDIT ===');
          const postReviewAudit = `${ARTIFACT_DIR}/post-review-audit.txt`;
          await streamCommand(
            'npm',
            ['run','registry:mizizi:audit','--','--entity=track','--limit=0'],
            {DATABASE_URL:url},
            postReviewAudit,
          );
          assertAudit(fs.readFileSync(postReviewAudit,'utf8'),false);
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
      await pool.end().catch(()=>{});
    }
  } finally {
    const cleanupErrors = [];

    if (mappingChanged) {
      try {
        if (existing) {
          await api('PUT',`/v1/projects/${PROJECT_REF}/database/jit`,{user_id:userId,roles:originalRoles});
        } else {
          await api('DELETE',`/v1/projects/${PROJECT_REF}/database/jit/${userId}`);
        }
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
    console.log('PASS: JIT mapping restored and production temporary access disabled at rest');
  }
}

main().catch(e => { console.error(`\nMIZIZI production control plane failed: ${e.message || e}`); process.exitCode=1; });
