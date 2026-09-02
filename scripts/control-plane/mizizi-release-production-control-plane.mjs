import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import pg from 'pg';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'pgzizndxdyhqmtyywjmt';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const MODE = process.env.MIZIZI_CONTROL_PLANE_MODE || 'preflight';
const EXPECTED_MAIN = process.env.MIZIZI_EXPECTED_MAIN_SHA || '';
const TRIGGER_FILE = process.env.MIZIZI_TRIGGER_FILE || '';
const ARTIFACT_DIR = process.env.MIZIZI_ARTIFACT_DIR || 'artifacts/mizizi-release-production-control-plane';
const EXPECTED_AUTHORITY_FINGERPRINT = 'cf71fc24d54bb71d64a469e159daaf06b137680f294efe4542b1b691aee68b16';
const EXPECTED_CANDIDATE_FINGERPRINT = '238a817a5e342f8311ac04fc9a6bc978f67276cb664046cddc9e375bc323e9c4';
const EXPECTED_BLOBS = {
  'scripts/registry/agents/mizizi/run.ts': 'fa60ce8060ff12610354d3be94ec29f20b3a6f1f',
  'scripts/registry/agents/mizizi/core.ts': '5d81530ed3e0550162e1d583dacf9eea7eefca07',
  'supabase/functions/_shared/release-taxonomy.ts': 'e424dea443d7fb6ce85acca4f0c33375c56669ca',
};

if (!['preflight','apply'].includes(MODE)) throw new Error('Unsupported control-plane mode');
if (!TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN repository secret is required');
fs.mkdirSync(ARTIFACT_DIR,{recursive:true});

function run(cmd,args,opts={}) {
  const r = spawnSync(cmd,args,{encoding:'utf8',stdio:opts.capture?'pipe':'inherit',env:opts.env||process.env});
  if (r.status !== 0) throw new Error(cmd+' '+args.join(' ')+' failed'+(r.stderr?': '+r.stderr.trim():''));
  return (r.stdout||'').trim();
}

async function api(method,path,body) {
  const r = await fetch('https://api.supabase.com'+path,{
    method,
    headers:{Authorization:'Bearer '+TOKEN,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error('Supabase Management API '+method+' '+path+' failed '+r.status+': '+t.slice(0,500));
  return t?JSON.parse(t):null;
}

function rowsFromJitList(raw) {
  return Array.isArray(raw)?raw:raw?.data||raw?.mappings||raw?.users||raw?.items||[];
}
function profileId(raw) {
  return raw?.gotrue_id||raw?.id||raw?.user_id||raw?.user?.id||raw?.data?.id||raw?.data?.gotrue_id||'';
}
function configState(raw) {
  return String(raw?.state||raw?.data?.state||raw?.config?.state||'').toLowerCase();
}
function sleep(ms) {
  return new Promise(resolve=>setTimeout(resolve,ms));
}

function databaseUrl() {
  const path = 'supabase/.temp/pooler-url';
  if (!fs.existsSync(path)) throw new Error('linked Supabase CLI did not create '+path);
  const linked = fs.readFileSync(path,'utf8').trim();
  const sanitized = linked.replace(/:\/\/([^:]+):[^@]*@/,'://$1:x@');
  const u = new URL(sanitized);
  if (!u.hostname.endsWith('.pooler.supabase.com')) throw new Error('linked Supabase CLI returned unexpected pooler host '+u.hostname);
  u.username = 'postgres.'+PROJECT_REF;
  u.password = TOKEN;
  u.port = '5432';
  u.search = '';
  u.searchParams.set('options','-c jit=true');
  console.log('Using linked Supabase pooler host: '+u.hostname+':5432');
  return u.toString();
}

function isTransientJitError(error) {
  const code = String(error?.code||'');
  const message = String(error?.message||error||'').toLowerCase();
  return code === 'EJITREQUESTFAILED' || code === '28P01' || code === 'XX000' ||
    message.includes('jit provider') || message.includes('temporary access') ||
    message.includes('password authentication failed');
}

async function createJitPoolWithRetry(url) {
  const attempts = 12;
  for (let attempt=1; attempt<=attempts; attempt+=1) {
    const pool = new pg.Pool({
      connectionString:url,
      ssl:{rejectUnauthorized:false},
      max:2,
      connectionTimeoutMillis:10000,
      query_timeout:30000,
      statement_timeout:30000,
    });
    try {
      const {rows:[session]} = await pool.query('select current_user as database_user, current_database() as database_name');
      if (session.database_user !== 'postgres' || session.database_name !== 'postgres') {
        throw new Error('unexpected JIT database session '+session.database_user+'@'+session.database_name);
      }
      console.log('PASS: JIT database session ready on attempt '+attempt+'/'+attempts);
      return pool;
    } catch (error) {
      await pool.end().catch(()=>{});
      if (!isTransientJitError(error) || attempt === attempts) throw error;
      console.log('JIT session not ready on attempt '+attempt+'/'+attempts+'; retrying after transient '+(error?.code||'UNKNOWN'));
      await sleep(5000);
    }
  }
  throw new Error('JIT database session readiness exhausted');
}

const releaseStateSql = [
"with active_releases as (",
" select id,coalesce(btrim(release_type::text),'') stored_type",
" from public.registry_releases where status='active'",
"), resolved as (",
" select r.id release_id,r.stored_type,count(t.id)::int resolvable_active_track_count",
" from active_releases r",
" left join public.registry_release_tracks rt on rt.release_id=r.id and rt.status='active'",
" left join public.registry_tracks t on t.id=rt.track_id and t.status='active'",
" group by r.id,r.stored_type",
"), classified as (",
" select release_id,stored_type,resolvable_active_track_count,case",
"  when resolvable_active_track_count=1 then 'single'",
"  when resolvable_active_track_count between 2 and 6 then 'ep'",
"  when resolvable_active_track_count>=7 then 'album' else null end canonical_type",
" from resolved",
"), candidates as (",
" select * from classified where canonical_type is not null and lower(stored_type) is distinct from canonical_type",
"), broken as (",
" select rt.id,rt.release_id,rt.track_id",
" from public.registry_release_tracks rt",
" join public.registry_releases r on r.id=rt.release_id and r.status='active'",
" left join public.registry_tracks t on t.id=rt.track_id and t.status='active'",
" where rt.status='active' and t.id is null",
"), membership_scope as (",
" select rt.id::text id,rt.release_id::text release_id,rt.track_id::text track_id,(t.id is not null) target_active",
" from public.registry_release_tracks rt",
" join public.registry_releases r on r.id=rt.release_id and r.status='active'",
" left join public.registry_tracks t on t.id=rt.track_id and t.status='active'",
" where rt.status='active'",
"), authority_payload as (",
" select jsonb_build_object(",
"  'releases',coalesce((select jsonb_agg(jsonb_build_object('id',a.id::text,'release_type',a.stored_type) order by a.id) from active_releases a),'[]'::jsonb),",
"  'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'release_id',m.release_id,'track_id',m.track_id,'target_active',m.target_active) order by m.id) from membership_scope m),'[]'::jsonb)",
" ) body",
"), candidate_payload as (",
" select coalesce(jsonb_agg(jsonb_build_object(",
"  'release_id',c.release_id::text,'current',c.stored_type,'proposed',c.canonical_type,",
"  'resolvable_active_track_count',c.resolvable_active_track_count) order by c.release_id),'[]'::jsonb) body",
" from candidates c",
")",
"select",
" (select count(*)::int from active_releases) active_releases,",
" (select count(*)::int from classified where resolvable_active_track_count=0) zero_resolvable_releases,",
" (select count(*)::int from candidates) taxonomy_candidates,",
" (select count(*)::int from candidates where lower(stored_type)='ep' and canonical_type='single') ep_to_single,",
" (select count(*)::int from candidates where lower(stored_type)='album' and canonical_type='ep') album_to_ep,",
" (select count(*)::int from candidates where lower(stored_type)='ep' and canonical_type='album') ep_to_album,",
" (select count(*)::int from broken) bad_active_memberships,",
" (select count(distinct release_id)::int from broken) releases_with_bad_active_memberships,",
" (select count(*)::int from public.registry_canonical_write_events where actor='mizizi' and registry_entity_type='release') mizizi_release_events,",
" (select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open' and source_table='registry_releases') open_mizizi_release_reviews,",
" (select count(*)::int from public.registry_canonical_write_events where actor='mizizi' and registry_entity_type='track') mizizi_track_events,",
" (select count(*)::int from public.registry_review_items where review_type='mizizi_data_hygiene' and status='open') open_mizizi_reviews_total,",
" (select count(*)::int from supabase_migrations.schema_migrations) ledger_count,",
" (select max(version) from supabase_migrations.schema_migrations) ledger_head,",
" (select encode(digest(convert_to(body::text,'UTF8'),'sha256'),'hex') from authority_payload) release_authority_fingerprint,",
" (select encode(digest(convert_to(body::text,'UTF8'),'sha256'),'hex') from candidate_payload) release_candidate_fingerprint",
].join('\\n');

const releaseAcceptanceSql = [
"with e as (",
" select * from public.registry_canonical_write_events where actor='mizizi' and registry_entity_type='release'",
") select",
" count(*)::int events,",
" count(distinct source_suggestion_id)::int unique_fingerprints,",
" count(*) filter(where before_value->>'ruleId'='release_taxonomy_drift' and before_value->>'ruleVersion'='1.1.0')::int rule_matches,",
" count(*) filter(where field_name='release_type' and target_path='public.registry_releases.release_type')::int field_matches,",
" count(*) filter(where after_value->'downstreamImpact' ? 'resolvableActiveTrackCount')::int impact_matches,",
" count(*) filter(where lower(before_value->>'value')='ep' and lower(after_value->>'value')='single')::int ep_to_single_events,",
" count(*) filter(where lower(before_value->>'value')='album' and lower(after_value->>'value')='ep')::int album_to_ep_events,",
" count(*) filter(where lower(before_value->>'value')='ep' and lower(after_value->>'value')='album')::int ep_to_album_events,",
" (select count(*)::int from e join public.registry_releases r on r.id::text=e.registry_entity_id::text and r.status='active' where lower(coalesce(btrim(r.release_type::text),''))=lower(e.after_value->>'value')) event_release_matches",
"from e",
].join('\\n');

const PRE_APPLY_BASELINE = {
  active_releases:841,
  zero_resolvable_releases:13,
  taxonomy_candidates:32,
  ep_to_single:11,
  album_to_ep:19,
  ep_to_album:2,
  bad_active_memberships:18,
  releases_with_bad_active_memberships:13,
  mizizi_release_events:0,
  open_mizizi_release_reviews:0,
  mizizi_track_events:440,
  open_mizizi_reviews_total:66,
  ledger_count:79,
  ledger_head:'20260901170500',
};
const POST_APPLY_BASELINE = {
  ...PRE_APPLY_BASELINE,
  taxonomy_candidates:0,
  ep_to_single:0,
  album_to_ep:0,
  ep_to_album:0,
  mizizi_release_events:32,
};

function assertFields(actual,expected,label) {
  for (const [k,v] of Object.entries(expected)) {
    if (String(actual?.[k]) !== String(v)) throw new Error(label+' '+k+'='+actual?.[k]+' expected '+v);
  }
}
function fieldsMatch(actual,expected) {
  return Object.entries(expected).every(([k,v])=>String(actual?.[k])===String(v));
}
function classifyReleaseProductionState(state) {
  if (fieldsMatch(state,PRE_APPLY_BASELINE)) return 'pre_apply';
  if (fieldsMatch(state,POST_APPLY_BASELINE)) return 'post_apply';
  return 'unexpected';
}
async function assertAcceptedPostApply(pool,state) {
  assertFields(state,POST_APPLY_BASELINE,'release post-apply baseline');
  const {rows:[a]} = await pool.query(releaseAcceptanceSql);
  assertFields(a,{
    events:32,
    unique_fingerprints:32,
    rule_matches:32,
    field_matches:32,
    impact_matches:32,
    ep_to_single_events:11,
    album_to_ep_events:19,
    ep_to_album_events:2,
    event_release_matches:32,
  },'release acceptance');
}

function assertReleaseAudit(text,expectedCandidates) {
  const clean = text.replace(/\x1b\[[0-9;]*m/g,'');
  if (expectedCandidates > 0) {
    const row = new RegExp("'release_taxonomy_drift'\\\\s*│\\\\s*"+expectedCandidates+"\\\\s*│");
    if (!row.test(clean)) throw new Error('release_taxonomy_drift expected '+expectedCandidates);
  } else if (clean.includes("'release_taxonomy_drift'")) {
    throw new Error('post-apply Release audit still reports release_taxonomy_drift');
  }
  if (!clean.includes('Audit mode completed. No Registry rows were changed.')) {
    throw new Error('Release audit did not prove read-only completion');
  }
}

async function streamCommand(cmd,args,env,logPath,pool) {
  const out = fs.createWriteStream(logPath);
  const child = spawn(cmd,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>{process.stdout.write(d);out.write(d);});
  child.stderr.on('data',d=>{process.stderr.write(d);out.write(d);});
  const timer = pool ? setInterval(async()=>{
    try {
      const {rows:[s]} = await pool.query("select count(*)::int events from public.registry_canonical_write_events where actor='mizizi' and registry_entity_type='release'");
      console.log('PROGRESS release_events='+s.events+'/32');
    } catch (e) {
      console.error('PROGRESS_MONITOR '+(e?.code||'UNKNOWN')+' '+(e?.message||e));
    }
  },10000) : null;
  const code = await new Promise(resolve=>child.on('close',resolve));
  if (timer) clearInterval(timer);
  out.end();
  if (code !== 0) throw new Error(cmd+' exited '+code);
}

async function main() {
  console.log('\\n=== 1. REPOSITORY + ACCEPTED RELEASE RUNTIME ===');
  run('git',['fetch','--prune','origin','main']);
  if (run('git',['status','--porcelain'],{capture:true})) throw new Error('worktree is not clean');
  for (const [path,sha] of Object.entries(EXPECTED_BLOBS)) {
    assertFields({sha:run('git',['hash-object',path],{capture:true})},{sha},path);
  }

  if (MODE === 'apply') {
    if (!EXPECTED_MAIN || !TRIGGER_FILE) throw new Error('reviewed production trigger is missing');
    const trigger = JSON.parse(fs.readFileSync(TRIGGER_FILE,'utf8'));
    assertFields(trigger,{
      operation:'mizizi_release_taxonomy_production_apply',
      confirm:'MIZIZI_RELEASE_TAXONOMY_PRODUCTION_APPLY',
      expected_authority_fingerprint:EXPECTED_AUTHORITY_FINGERPRINT,
      expected_candidate_fingerprint:EXPECTED_CANDIDATE_FINGERPRINT,
    },'production trigger');
    assertFields({
      head:run('git',['rev-parse','HEAD'],{capture:true}),
      main:run('git',['rev-parse','origin/main'],{capture:true}),
    },{head:EXPECTED_MAIN,main:EXPECTED_MAIN},'main');
  }

  console.log('PASS: accepted MIZIZI Release runtime bytes exact');
  run('npx',['vitest','run',
    'test/registry/mizizi-cultural-data-steward.test.ts',
    'test/release-taxonomy-public-identity.test.ts',
    'test/registry/mizizi-release-production-control-plane.test.ts',
  ]);

  console.log('\\n=== 2. EXISTING SUPABASE CONTROL PLANE + TEMPORARY ACCESS ===');
  run('npx',['--yes','supabase@2.107.0','link','--project-ref',PROJECT_REF]);

  const userId = profileId(await api('GET','/v1/profile'));
  if (!userId) throw new Error('Supabase profile did not expose a JIT user id');

  const originalState = configState(await api('GET','/v1/projects/'+PROJECT_REF+'/jit-access'));
  if (originalState !== 'disabled') {
    throw new Error('production temporary access must be disabled at rest; found '+(originalState||'unknown'));
  }

  let existing = null;
  let originalRoles = [];
  let mappingChanged = false;

  try {
    const list = rowsFromJitList(await api('GET','/v1/projects/'+PROJECT_REF+'/database/jit/list'));
    existing = list.find(x=>String(x.user_id||x.id||x.gotrue_id||'')===userId)||null;
    originalRoles = existing && Array.isArray(existing.user_roles) ? existing.user_roles : [];

    await api('PUT','/v1/projects/'+PROJECT_REF+'/jit-access',{state:'enabled'});
    const roles = originalRoles.filter(r=>String(r.role||'')!=='postgres');
    roles.push({role:'postgres',expires_at:Date.now()+60*60*1000});
    await api('PUT','/v1/projects/'+PROJECT_REF+'/database/jit',{user_id:userId,roles});
    mappingChanged = true;

    const url = databaseUrl();
    console.log('::add-mask::'+url);
    const pool = await createJitPoolWithRetry(url);

    try {
      console.log('\\n=== 3. PRODUCTION RELEASE STATE ===');
      const {rows:[baseline]} = await pool.query(releaseStateSql);
      const productionState = classifyReleaseProductionState(baseline);
      if (productionState === 'unexpected') {
        throw new Error('production Release state is neither accepted pre-apply nor accepted post-apply: '+JSON.stringify(baseline));
      }
      fs.writeFileSync(ARTIFACT_DIR+'/state-before.json',JSON.stringify(baseline,null,2)+'\\n');

      if (productionState === 'post_apply') {
        console.log('PASS: accepted historical Release taxonomy post-apply baseline detected');
        await assertAcceptedPostApply(pool,baseline);
        fs.writeFileSync(ARTIFACT_DIR+'/state-after.json',JSON.stringify(baseline,null,2)+'\\n');
        console.log('PASS: production Release taxonomy acceptance exact 32 / 0 remaining with 18 bad memberships preserved');

        const auditCurrent = ARTIFACT_DIR+'/post-apply-audit.txt';
        await streamCommand('npm',['run','registry:mizizi:audit','--','--entity=release','--limit=0'],{DATABASE_URL:url},auditCurrent);
        assertReleaseAudit(fs.readFileSync(auditCurrent,'utf8'),0);

        if (MODE === 'apply') {
          throw new Error('historical Release taxonomy apply is already accepted; refusing repeat production mutation');
        }
        console.log('\\n=== MIZIZI RELEASE PRODUCTION CONTROL-PLANE POST-APPLY PREFLIGHT PASS ===');
        console.log('Registry mutation: NO');
        return;
      }

      console.log('PASS: accepted historical Release taxonomy pre-apply baseline detected');
      assertFields(baseline,{
        release_authority_fingerprint:EXPECTED_AUTHORITY_FINGERPRINT,
        release_candidate_fingerprint:EXPECTED_CANDIDATE_FINGERPRINT,
      },'release fingerprint');
      console.log('PASS: exact Release authority fingerprint '+baseline.release_authority_fingerprint);
      console.log('PASS: exact Release candidate-set fingerprint '+baseline.release_candidate_fingerprint);

      console.log('\\n=== 4. FRESH READ-ONLY PRODUCTION AUDIT ===');
      const auditBefore = ARTIFACT_DIR+'/pre-apply-audit.txt';
      await streamCommand('npm',['run','registry:mizizi:audit','--','--entity=release','--limit=0'],{DATABASE_URL:url},auditBefore);
      assertReleaseAudit(fs.readFileSync(auditBefore,'utf8'),32);

      const {rows:[afterAudit]} = await pool.query(releaseStateSql);
      assertFields(afterAudit,PRE_APPLY_BASELINE,'post-audit Release baseline');
      assertFields(afterAudit,{
        release_authority_fingerprint:EXPECTED_AUTHORITY_FINGERPRINT,
        release_candidate_fingerprint:EXPECTED_CANDIDATE_FINGERPRINT,
      },'post-audit Release fingerprint');
      console.log('PASS: fresh production audit = 32 deterministic Release taxonomy candidates and no Registry mutation');

      if (MODE === 'preflight') {
        console.log('\\n=== MIZIZI RELEASE PRODUCTION CONTROL-PLANE PRE-APPLY PREFLIGHT PASS ===');
        console.log('Registry mutation: NO');
        return;
      }

      console.log('\\n=== 5. REAL MIZIZI RELEASE TAXONOMY APPLY - PRODUCTION ===');
      await streamCommand('npm',['run','registry:mizizi:apply','--','--entity=release','--limit=0','--confirm=MIZIZI_APPLY'],{DATABASE_URL:url},ARTIFACT_DIR+'/apply.txt',pool);

      console.log('\\n=== 6. EXACT PRODUCTION ACCEPTANCE ===');
      const {rows:[accepted]} = await pool.query(releaseStateSql);
      await assertAcceptedPostApply(pool,accepted);
      fs.writeFileSync(ARTIFACT_DIR+'/state-after.json',JSON.stringify(accepted,null,2)+'\\n');
      console.log('PASS: production Release taxonomy acceptance exact 32 applied / 0 remaining / 18 bad memberships preserved');

      console.log('\\n=== 7. FRESH POST-APPLY AUDIT ===');
      const auditAfter = ARTIFACT_DIR+'/post-apply-audit.txt';
      await streamCommand('npm',['run','registry:mizizi:audit','--','--entity=release','--limit=0'],{DATABASE_URL:url},auditAfter);
      assertReleaseAudit(fs.readFileSync(auditAfter,'utf8'),0);
      console.log('\\n=== MIZIZI HISTORICAL RELEASE TAXONOMY PRODUCTION APPLY PASS ===');
    } finally {
      await pool.end().catch(()=>{});
    }
  } finally {
    const cleanupErrors = [];
    if (mappingChanged) {
      try {
        if (existing) {
          await api('PUT','/v1/projects/'+PROJECT_REF+'/database/jit',{user_id:userId,roles:originalRoles});
        } else {
          await api('DELETE','/v1/projects/'+PROJECT_REF+'/database/jit/'+userId);
        }
      } catch (error) {
        cleanupErrors.push('mapping cleanup failed: '+(error?.message||error));
      }
    }
    try {
      await api('PUT','/v1/projects/'+PROJECT_REF+'/jit-access',{state:'disabled'});
    } catch (error) {
      cleanupErrors.push('temporary-access cleanup failed: '+(error?.message||error));
    }
    if (cleanupErrors.length) throw new Error(cleanupErrors.join('; '));
    console.log('PASS: JIT mapping restored and production temporary access disabled at rest');
  }
}

main().catch(error=>{
  console.error('\\nMIZIZI Release production control plane failed: '+(error?.message||error));
  process.exitCode = 1;
});
