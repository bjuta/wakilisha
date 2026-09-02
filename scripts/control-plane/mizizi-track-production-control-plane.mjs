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
const EXPECTED_BLOBS = {
  'scripts/registry/agents/mizizi/run.ts': 'fa60ce8060ff12610354d3be94ec29f20b3a6f1f',
  'scripts/registry/agents/mizizi/core.ts': '5d81530ed3e0550162e1d583dacf9eea7eefca07',
  'supabase/functions/_shared/registry-track-identity.ts': '7bcab485aecc3cc7b90e2a3154d90dcee81be92c',
};

if (!['preflight', 'apply'].includes(MODE)) throw new Error('Unsupported control-plane mode');
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
    ['--yes','supabase@2.107.0','db','query','--linked','--agent=no','-o','json',wrapped],
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

function databaseUrl() {
  const u = new URL(`postgresql://postgres.${PROJECT_REF}:x@aws-0-${REGION}.pooler.supabase.com:5432/postgres`);
  u.password = TOKEN;
  u.searchParams.set('options', '-c jit=on');
  return u.toString();
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
 (select count(*)::int from public.registry_canonical_write_events where actor='mizizi') events,
 (select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open') reviews,
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
 where ri.review_type='mizizi_data_hygiene' and ri.status='open'
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
 from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open' group by 1
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

function assertFields(actual, expected, label) {
  for (const [k, v] of Object.entries(expected)) if (String(actual?.[k]) !== String(v)) throw new Error(`${label} ${k}=${actual?.[k]} expected ${v}`);
}

function assertAudit(text, before) {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
  const rules = before ? [['track_slug_identity_noise',506],['track_title_credit_noise',492],['track_slug_identity_mismatch',3]] : [['track_slug_identity_noise',66],['track_title_credit_noise',492],['track_slug_identity_mismatch',3]];
  for (const [rule,count] of rules) if (!(new RegExp(`'${rule}'\\s*\u2502\\s*${count}\\s*\u2502`)).test(clean)) throw new Error(`${rule} expected ${count}`);
  const summary = before ? /\u2502\s*0\s*\u2502\s*1001\s*\u2502\s*0\s*\u2502\s*0\s*\u2502\s*495\s*\u2502\s*0\s*\u2502\s*2101\s*\u2502/ : /\u2502\s*0\s*\u2502\s*561\s*\u2502\s*0\s*\u2502\s*0\s*\u2502\s*495\s*\u2502\s*0\s*\u2502\s*2101\s*\u2502/;
  if (!summary.test(clean) || !clean.includes('Audit mode completed. No Registry rows were changed.')) throw new Error(`${before ? 'pre' : 'post'}-apply audit summary mismatch`);
}

async function streamCommand(cmd, args, env, logPath, pool) {
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
      console.log(`PROGRESS events=${s.events}/440 reviews=${s.reviews}/66 redirects=${s.redirects}/857`);
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
  if (MODE === 'apply') {
    if (!EXPECTED_MAIN || !TRIGGER_FILE) throw new Error('reviewed production trigger is missing');
    trigger = JSON.parse(fs.readFileSync(TRIGGER_FILE, 'utf8'));
    assertFields(
      trigger,
      {
        operation:'mizizi_track_production_apply',
        confirm:'MIZIZI_TRACK_PRODUCTION_APPLY',
        expected_input_fingerprint:EXPECTED_FINGERPRINT,
        enable_ssl_enforcement:true,
      },
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
  run('npx',['--yes','supabase@2.107.0','link','--project-ref',PROJECT_REF]);
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

    if (!trigger?.enable_ssl_enforcement) throw new Error('production trigger does not authorize permanent SSL enforcement');
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
  const list = rowsFromJitList(await api('GET',`/v1/projects/${PROJECT_REF}/database/jit/list`));
  const existing = list.find(x => String(x.user_id || x.id || x.gotrue_id || '') === userId) || null;
  const originalRoles = existing && Array.isArray(existing.user_roles) ? existing.user_roles : [];
  let touched = false;
  try {
    if (originalState === 'disabled') await api('PUT',`/v1/projects/${PROJECT_REF}/jit-access`,{state:'enabled'});
    const roles = originalRoles.filter(r => String(r.role || '') !== 'postgres');
    roles.push({ role:'postgres', expires_at: Date.now() + 60*60*1000 });
    await api('PUT',`/v1/projects/${PROJECT_REF}/database/jit`,{user_id:userId,user_roles:roles});
    touched = true;

    const url = databaseUrl();
    console.log(`::add-mask::${url}`);
    const pool = new pg.Pool({ connectionString:url, ssl:{rejectUnauthorized:false}, max:2, connectionTimeoutMillis:10000, query_timeout:30000, statement_timeout:30000 });
    try {
      console.log('\n=== 3. PRODUCTION BASELINE + REHEARSAL FINGERPRINT ===');
      const { rows:[baseline] } = await pool.query(baselineSql);
      assertFields(baseline,{active_tracks:2101,events:0,reviews:0,redirects:291,mizizi_redirects:0,ledger_count:79,ledger_head:'20260901170500'},'baseline');
      fs.writeFileSync(`${ARTIFACT_DIR}/state-before.json`,JSON.stringify(baseline,null,2)+'\n');
      const { rows:[fp] } = await pool.query(fingerprintSql);
      if (fp.fingerprint !== EXPECTED_FINGERPRINT) throw new Error(`accepted-rehearsal input fingerprint drift: ${fp.fingerprint}`);
      console.log(`PASS: exact full-row input fingerprint ${fp.fingerprint}`);

      console.log('\n=== 4. FRESH READ-ONLY PRODUCTION AUDIT ===');
      const auditBefore = `${ARTIFACT_DIR}/pre-apply-audit.txt`;
      await streamCommand('npm',['run','registry:mizizi:audit','--','--entity=track','--limit=0'],{DATABASE_URL:url},auditBefore);
      assertAudit(fs.readFileSync(auditBefore,'utf8'),true);
      console.log('PASS: fresh production audit = 1001 findings / 506 candidates / 495 observe-only / 2101 Tracks');

      if (MODE === 'preflight') {
        console.log('\n=== MIZIZI PRODUCTION CONTROL-PLANE PREFLIGHT PASS ===');
        console.log('Registry mutation: NO');
        return;
      }

      console.log('\n=== 5. REAL MIZIZI TRACK APPLY - PRODUCTION ===');
      await streamCommand('npm',['run','registry:mizizi:apply','--','--entity=track','--limit=0','--confirm=MIZIZI_APPLY'],{DATABASE_URL:url},`${ARTIFACT_DIR}/apply.txt`,pool);

      console.log('\n=== 6. EXACT PRODUCTION ACCEPTANCE ===');
      const { rows:[row] } = await pool.query(acceptanceSql);
      const s = row.state;
      assertFields(s,{active_tracks:2101,events:440,unique_fingerprints:440,event_track_matches:440,reviews:66,blocked_still_old:66,review_tracks:66,redirects:1148,mizizi_redirects:857,chart_mismatches:0,save_mismatches:0,ledger_count:79,ledger_head:'20260901170500'},'acceptance');
      assertFields(s.impact,{redirects:857,chart_rows:7,save_slug_rows:3,save_url_rows:3,thread_rows:162},'impact');
      assertFields(s.classes,{thread_collision:28,track_collision:26,missing_primary:6,ambiguous_thread:6},'reviews');
      if (s.classes?.unexpected) throw new Error(`unexpected review class=${s.classes.unexpected}`);
      fs.writeFileSync(`${ARTIFACT_DIR}/state-after.json`,JSON.stringify(s,null,2)+'\n');
      console.log('PASS: production acceptance exact 440 / 66 / 857 with exact downstream impact');

      console.log('\n=== 7. FRESH POST-APPLY AUDIT ===');
      const auditAfter = `${ARTIFACT_DIR}/post-apply-audit.txt`;
      await streamCommand('npm',['run','registry:mizizi:audit','--','--entity=track','--limit=0'],{DATABASE_URL:url},auditAfter);
      assertAudit(fs.readFileSync(auditAfter,'utf8'),false);
      console.log('\n=== MIZIZI HISTORICAL TRACK PRODUCTION APPLY PASS ===');
    } finally {
      await pool.end().catch(()=>{});
    }
  } finally {
    if (touched) {
      if (existing) await api('PUT',`/v1/projects/${PROJECT_REF}/database/jit`,{user_id:userId,user_roles:originalRoles});
      else await api('DELETE',`/v1/projects/${PROJECT_REF}/database/jit/${userId}`);
      if (originalState === 'disabled') await api('PUT',`/v1/projects/${PROJECT_REF}/jit-access`,{state:'disabled'});
      console.log('PASS: temporary JIT access restored to its original state');
    }
  }
}

main().catch(e => { console.error(`\nMIZIZI production control plane failed: ${e.message || e}`); process.exitCode=1; });
