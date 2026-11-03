#!/usr/bin/env node
/**
 * Real GoTrue-issued authenticated JWT vs PRIVATE WK100 Storage in a disposable
 * local Supabase stack. No hosted Preview/Production credentials or endpoints.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
const check=(condition,code)=>{if(!condition) throw new Error(code);};
const UUID=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
function env(){
  const lines=execFileSync('supabase',['status','-o','env'],{encoding:'utf8'}).split(/\r?\n/);
  const values={};
  for(const line of lines){
    const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if(m)values[m[1]]=m[2].replace(/^["']|["']$/g,'');
  }
  return values;
}
function query(sql,container){
  const p=spawnSync('docker',['exec','-i',container,'psql','-X','-q','-A','-t',
    '-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],{
    input:sql,encoding:'utf8',timeout:45000,maxBuffer:256*1024});
  check(!p.error && p.status===0,'STOP_DISPOSABLE_LOCAL_SQL_FAILED');
  return p.stdout.trim();
}
const sha=b=>createHash('sha256').update(b).digest('hex');
const client=(url,key)=>createClient(url,key,{auth:{autoRefreshToken:false,
  persistSession:false,detectSessionInUrl:false}});
async function main(){
  check(process.env.GITHUB_ACTIONS==='true'&&
   process.env.GITHUB_EVENT_NAME==='pull_request'&&
   !process.env.SUPABASE_PROJECT_REF&&!process.env.SUPABASE_ACCESS_TOKEN&&
   !existsSync('supabase/.temp/project-ref'),
   'STOP_NOT_UNLINKED_DISPOSABLE_PR_RUNNER');
  const v=env(); const url=v.API_URL||v.SUPABASE_URL;
  const parsed=new URL(url||'http://invalid.invalid');
  check(parsed.protocol==='http:'&&parsed.hostname==='127.0.0.1'&&
    parsed.port==='54321'&&parsed.pathname==='/'&&
    v.ANON_KEY&&v.SERVICE_ROLE_KEY,'STOP_NOT_LOCAL_AUTH_AND_STORAGE');
  const c=execFileSync('docker',['ps','--filter','name=^supabase_db_',
    '--format','{{.Names}}'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  check(c.length===1,'STOP_LOCAL_POSTGRES_CONTAINER_CARDINALITY');
  const db=c[0];
  // Verify the complete migration ledger, not a stale 234-version Oct 20 head.
  const activeFiles=readdirSync('supabase/migrations')
    .filter(name=>name.endsWith('.sql')).sort();
  const expectedVersions=activeFiles.map(name=>
    name.match(/^([0-9]{14})_[A-Za-z0-9_-]+\.sql$/)?.[1]??null);
  check(expectedVersions.length>0&&expectedVersions.every(Boolean)&&
    new Set(expectedVersions).size===expectedVersions.length,
    'STOP_LOCAL_ACTIVE_MIGRATION_SOURCE_INVALID');
  const appliedVersions=query(
    'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;',db)
    .split(/\r?\n/).filter(Boolean);
  check(appliedVersions.length===expectedVersions.length&&
    appliedVersions.every((version,index)=>version===expectedVersions[index]),
    'STOP_LOCAL_ACTIVE_MIGRATION_LEDGER_DRIFT');
  check(query("SELECT (SELECT count(*) FROM auth.users)::text||'|'||"+
    "(SELECT count(*) FROM storage.objects WHERE bucket_id='wk-chart-raw-evidence-v1')::text;",db)
    ==='0|0','STOP_LOCAL_AUTH_AND_STORAGE_NOT_EMPTY');
  console.log('WK100_GENUINE_AUTH_EXACT_ACTIVE_LEDGER_AND_ZERO_DATA=PASS');
  // Use the already-authoritative read-only SQL verifier against the *entire*
  // current migration replay, not a synthetic isolated-schema approximation.
  const sourceVerifier=readFileSync('scripts/acceptance/wk100-source-proposals-v1-readonly.sql','utf8');
  check(sourceVerifier.includes('WK100_SOURCE_PROPOSAL_READONLY_AUTHORITY_PASS') &&
    sourceVerifier.includes('begin read only;') && sourceVerifier.includes('rollback;'),
    'STOP_PROPOSAL_SQL_VERIFIER_NOT_READ_ONLY');
  query(sourceVerifier,db);
  check(query('SELECT count(*) FROM platform_private.wk100_source_proposals_v1;',db)==='0',
    'STOP_PROPOSAL_FIXTURE_NOT_EMPTY');
  console.log('WK100_GENUINE_SOURCE_PROPOSAL_FULL_CHAIN_SQL_VERIFIER=PASS');
  const admin=client(url,v.SERVICE_ROLE_KEY),anon=client(url,v.ANON_KEY);
  const identity=randomUUID(); const email=`wk100-ci-${identity}@example.test`;
  const password=randomBytes(30).toString('base64url');
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  check(!created.error&&UUID.test(created.data.user?.id||''),
    'STOP_LOCAL_GOTRUE_SYNTHETIC_USER_CREATE');
  const signed=client(url,v.ANON_KEY);
  const login=await signed.auth.signInWithPassword({email,password});
  check(!login.error&&login.data.user?.id===created.data.user.id&&
    !!login.data.session?.access_token,'STOP_REAL_SIGNED_IN_SESSION_MISSING');
  const token=login.data.session.access_token;
  const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
  const verified=await signed.auth.getUser();
  check(payload.role==='authenticated'&&payload.sub===created.data.user.id&&
    payload.exp>Math.floor(Date.now()/1000)&&
    !verified.error&&verified.data.user?.id===created.data.user.id,
    'STOP_GOTRUE_AUTHENTICATED_IDENTITY_NOT_PROVEN');
  console.log('WK100_GENUINE_LOCAL_GOTRUE_SIGNED_IN_USER=PASS');
  // Both RPCs run through PostgREST using the same genuine GoTrue-signed JWT.
  // They must fail before an active manage_ingest assignment, and again after
  // live revocation without obtaining a new JWT or refreshing its claims.
  const proposalA={
    providerKey:'youtube_ke',sourceKey:'youtube_ke_top_songs_weekly',
    surface:'YouTube Kenya Top Songs weekly chart',methodClass:'provider_api',
    behavior:'video_consumption',metric:'rank',expectedDepth:100,
    cadence:'weekly',intervalHours:null,eatHour:9,eatMinute:0,weekdayEat:0,
    minimumHealthyCheckpoints:1,evidenceReference:'local_disposable_signed_jwt_a',
    reason:'Disposable nonpublishing CI acceptance',
  };
  const proposalB={...proposalA,sourceKey:'youtube_ke_daily_playlist',
    surface:'YouTube Kenya daily playlist',methodClass:'reviewed_page_adapter',
    behavior:'ugc_curation',cadence:'daily',weekdayEat:null,
    minimumHealthyCheckpoints:7,evidenceReference:'local_disposable_signed_jwt_b'};
  const rpcWrite=(payload,revision)=>signed.rpc('wk100_submit_source_proposal_v1',{
    p_payload:payload,p_expected_revision:revision});
  const deniedAnon=await anon.rpc('wk100_list_source_proposals_v1');
  check(!!deniedAnon.error,'STOP_ANON_SOURCE_PROPOSALS_READABLE');
  const deniedRead=await signed.rpc('wk100_list_source_proposals_v1');
  const deniedWrite=await rpcWrite(proposalA,0);
  check(!!deniedRead.error&&!!deniedWrite.error,
    'STOP_UNPRIVILEGED_SIGNED_JWT_ACCESS_TO_SOURCE_PROPOSALS');
  console.log('WK100_SOURCE_PROPOSAL_ANON_AND_UNPRIVILEGED_SIGNED_JWT_DENIED=PASS');
  query("INSERT INTO public.user_role_assignments(user_id,role_key,status,expires_at,notes) "+
    "VALUES ('"+created.data.user.id+"'::uuid,'administrator','active',"+
    "clock_timestamp()+interval '20 minutes','Disposable local WK100 proposal operator fixture');",db);
  const active=await signed.rpc('current_user_has_capability',{
    required_capability:'manage_ingest'});
  check(!active.error&&active.data===true,
    'STOP_GENUINE_SIGNED_JWT_MANAGE_INGEST_NOT_ACTIVE');
  const one=await rpcWrite(proposalA,0),two=await rpcWrite(proposalB,0);
  check(!one.error&&!two.error&&one.data?.revision===1&&two.data?.revision===1&&
    one.data?.sourceKey===proposalA.sourceKey&&two.data?.sourceKey===proposalB.sourceKey&&
    one.data?.providerKey==='youtube_ke'&&two.data?.providerKey==='youtube_ke'&&
    one.data?.canCollect===false&&two.data?.canScore===false&&two.data?.canPublish===false,
    'STOP_REAL_JWT_TWO_SOURCES_NOT_INDEPENDENT');
  const proposedSourceList=await signed.rpc('wk100_list_source_proposals_v1');
  check(!proposedSourceList.error&&Array.isArray(proposedSourceList.data)&&proposedSourceList.data.length===2&&
    proposedSourceList.data.every(x=>x.state==='proposed'&&x.providerKey==='youtube_ke'&&
      x.canCollect===false&&x.canScore===false&&x.canPublish===false)&&
    proposedSourceList.data.some(x=>x.sourceKey===proposalA.sourceKey&&x.revision===1)&&
    proposedSourceList.data.some(x=>x.sourceKey===proposalB.sourceKey&&x.revision===1),
    'STOP_REAL_JWT_SOURCE_LIST_WRONG');
  const stale=await rpcWrite(proposalA,0);
  const forged=await rpcWrite({...proposalA,state:'admitted'},1);
  check(!!stale.error&&!!forged.error,
    'STOP_REAL_JWT_CONFLICT_OR_FORGED_AUTHORITY_ALLOWED');
  const revised=await rpcWrite({...proposalA,reason:'Revised disposable proposal'},1);
  check(!revised.error&&revised.data?.revision===2&&
    revised.data?.sourceKey===proposalA.sourceKey&&revised.data?.canCollect===false,
    'STOP_REAL_JWT_INDEPENDENT_REVISION_NOT_APPLIED');
  check(query("SELECT count(*)::text||'|'||count(DISTINCT source_key)::text "+
    "FROM platform_private.wk100_source_proposals_v1;",db)==='3|2',
    'STOP_SIGNED_JWT_SOURCE_AUDIT_CARDINALITY');
  console.log('WK100_GENUINE_SOURCE_PROPOSAL_TWO_SOURCES_CAS_AUDIT=PASS');
  query("UPDATE public.user_role_assignments SET status='revoked',"+
    "updated_at=clock_timestamp() WHERE user_id='"+created.data.user.id+
    "'::uuid AND role_key='administrator';",db);
  const revokedRole=await signed.rpc('current_user_has_capability',{
    required_capability:'manage_ingest'});
  const revokedRead=await signed.rpc('wk100_list_source_proposals_v1');
  const revokedWrite=await rpcWrite(proposalB,1);
  check(!revokedRole.error&&revokedRole.data===false&&
    !!revokedRead.error&&!!revokedWrite.error,
    'STOP_SAME_SIGNED_JWT_REVOKED_ROLE_STILL_MANAGES_PROPOSALS');
  check(query("SELECT count(*) FROM platform_private.wk100_source_proposals_v1;",db)==='3',
    'STOP_REVOCATION_CHANGED_AUDIT');
  console.log('WK100_GENUINE_SOURCE_PROPOSAL_SIGNED_JWT_AND_REVOCATION=PASS');
  // Exercise real GoTrue identity against the existing method-review and
  // capture-enrollment RPCs. All source/method evidence below is synthetic,
  // local-only and NEVER qualifies a real provider for collection.
  const methodReadDenied=await signed.rpc('wk100_list_source_method_decisions_v1');
  const methodWriteDenied=await signed.rpc('wk100_review_source_method_v1',{
    p_payload:{},p_expected_decision_revision:0});
  check(!!methodReadDenied.error&&!!methodWriteDenied.error,
    'STOP_REVOKED_REAL_JWT_METHOD_ACCESS');
  query("INSERT INTO public.user_role_assignments(user_id,role_key,status,expires_at,notes) "+
    "VALUES ('"+created.data.user.id+"'::uuid,'super_admin','active',"+
    "clock_timestamp()+interval '20 minutes','Disposable WK100 method and enrollment authority');",db);
  const superIngest=await signed.rpc('current_user_has_capability',{required_capability:'manage_ingest'});
  const superCharts=await signed.rpc('current_user_has_capability',{required_capability:'manage_charts'});
  check(!superIngest.error&&superIngest.data===true&&
    !superCharts.error&&superCharts.data===true,
    'STOP_GOTRUE_SUPERADMIN_CAPABILITY_MISSING');
  const listedMethods=await signed.rpc('wk100_list_source_method_decisions_v1');
  check(!listedMethods.error&&Array.isArray(listedMethods.data)&&listedMethods.data.length===0,
    'STOP_METHOD_EMPTY_LEDGER_NOT_REPORTED');
  const methodHold={
    sourceKey:proposalA.sourceKey,providerKey:'youtube_ke',proposalRevision:2,
    decisionState:'held',parserClass:null,methodClass:'provider_api',
    nativePeriodAuthority:null,nativePeriodEvidenceRef:null,endpointSha256:null,
    accessEvidenceSha256:null,authorizationRef:null,authorizationExpiresAt:null,
    constitutionVersion:'wk100-ci-method-v1',
    reason:'Disposable local method hold without source admission',
  };
  const hold=await signed.rpc('wk100_review_source_method_v1',{
    p_payload:methodHold,p_expected_decision_revision:0});
  check(!hold.error&&hold.data?.decisionRevision===1&&
    hold.data?.decisionState==='held'&&hold.data?.canPublish===false,
    'STOP_REAL_GOTRUE_METHOD_HOLD_NOT_RECORDED');
  const staleHold=await signed.rpc('wk100_review_source_method_v1',{
    p_payload:methodHold,p_expected_decision_revision:0});
  check(!!staleHold.error,'STOP_METHOD_REVIEW_STALE_REVISION_ACCEPTED');
  const heldEnroll=await signed.rpc('wk100_enroll_source_capture_contract_v1',{
    p_source_key:proposalA.sourceKey,p_contract_version:'ci-v1',
    p_adapter_sha256:'a'.repeat(64),p_expected_proposal_revision:2,
    p_expected_decision_revision:1});
  check(!!heldEnroll.error,'STOP_METHOD_HOLD_BYPASSED_FOR_ENROLLMENT');
  console.log('WK100_GOTRUE_METHOD_HOLD_STALE_CAS_AND_ENROLLMENT_DENIAL=PASS');

  // The Apple source is a synthetic SQL authority fixture, not a qualified
  // Apple access method, native reporting period or collection constitution.
  const proposalC={...proposalA,providerKey:'apple_ke',
    sourceKey:'apple_ke_disposable_catalog',surface:'Disposable Apple Kenya chart method',
    behavior:'consumption',metric:'rank',methodClass:'provider_api',
    cadence:'daily',weekdayEat:null,minimumHealthyCheckpoints:7,
    evidenceReference:'ci_only_not_provider_evidence',
    reason:'Local super-admin enrollment authority acceptance'};
  const appleProposal=await rpcWrite(proposalC,0);
  check(!appleProposal.error&&appleProposal.data?.revision===1&&
    appleProposal.data?.canCollect===false,
    'STOP_REAL_JWT_DISPOSABLE_APPLE_PROPOSAL_FAILED');
  const reviewedEndpoint='https://api.music.apple.com/v1/catalog/ke/charts?types=songs&chart=most-played';
  const expires=new Date(Date.now()+14*86400_000).toISOString().replace(/\.\d{3}Z$/,'Z');
  const appleMethod={
    ...methodHold,sourceKey:proposalC.sourceKey,providerKey:'apple_ke',
    proposalRevision:1,decisionState:'collector_admitted',
    parserClass:'apple_kenya_chart_v1',methodClass:'provider_api',
    nativePeriodAuthority:'provider_defined',
    nativePeriodEvidenceRef:'synthetic_ci_period_not_provider_fact',
    endpointSha256:sha(Buffer.from(reviewedEndpoint)),
    accessEvidenceSha256:sha(Buffer.from('ci_disposable_access_review')),
    authorizationRef:'ci_only_no_external_access',
    authorizationExpiresAt:expires,
    reason:'Synthetic local admission for authorization test only',
  };
  const admitted=await signed.rpc('wk100_review_source_method_v1',{
    p_payload:appleMethod,p_expected_decision_revision:0});
  check(!admitted.error&&admitted.data?.decisionRevision===1&&
    admitted.data?.decisionState==='collector_admitted'&&
    admitted.data?.canScore===false&&admitted.data?.canPublish===false,
    'STOP_REAL_GOTRUE_SUPERADMIN_METHOD_DECISION');
  const adapterSha=sha(Buffer.from('wk100-disposable-adapter-no-provider-transport'));
  const enrollArgs={p_source_key:proposalC.sourceKey,p_contract_version:'ci-v1',
    p_adapter_sha256:adapterSha,p_expected_proposal_revision:1,
    p_expected_decision_revision:1};
  const enrolled=await signed.rpc('wk100_enroll_source_capture_contract_v1',enrollArgs);
  check(!enrolled.error&&UUID.test(enrolled.data?.contractId??'')&&
    enrolled.data?.state==='candidate'&&enrolled.data?.canCollect===false&&
    enrolled.data?.canScore===false&&enrolled.data?.canPublish===false,
    'STOP_REAL_GOTRUE_SUPERADMIN_CONTRACT_ENROLLMENT');
  const duplicateEnroll=await signed.rpc('wk100_enroll_source_capture_contract_v1',enrollArgs);
  check(!!duplicateEnroll.error,'STOP_DUPLICATE_CAPTURE_ENROLLMENT_ACCEPTED');
  const admittedService=await admin.rpc('wk100_service_admitted_methods_v1');
  check(!admittedService.error&&Array.isArray(admittedService.data)&&
    admittedService.data.length===1&&
    admittedService.data[0].source_key===proposalC.sourceKey&&
    admittedService.data[0].contract_version==='ci-v1',
    'STOP_REAL_SERVICE_ADMISSION_PROJECTION_INVALID');
  console.log('WK100_GOTRUE_SUPERADMIN_ADMISSION_AND_IMMUTABLE_ENROLLMENT=PASS');

  const pause=await signed.rpc('wk100_review_source_method_v1',{
    p_payload:{...appleMethod,decisionState:'paused',
      reason:'Disable the synthetic source immediately after enrollment'},
    p_expected_decision_revision:1});
  const pausedService=await admin.rpc('wk100_service_admitted_methods_v1');
  check(!pause.error&&pause.data?.decisionRevision===2&&
    pause.data?.decisionState==='paused'&&
    !pausedService.error&&Array.isArray(pausedService.data)&&
    pausedService.data.length===0,
    'STOP_METHOD_PAUSE_DID_NOT_REVOKE_SERVICE_ADMISSION');
  query("UPDATE public.user_role_assignments SET status='revoked',"+
    "updated_at=clock_timestamp() WHERE user_id='"+created.data.user.id+
    "'::uuid AND role_key='super_admin';",db);
  const revokedMethods=await signed.rpc('wk100_list_source_method_decisions_v1');
  const revokedEnroll=await signed.rpc('wk100_enroll_source_capture_contract_v1',enrollArgs);
  const revokedMethodWrite=await signed.rpc('wk100_review_source_method_v1',{
    p_payload:methodHold,p_expected_decision_revision:1});
  check(!!revokedMethods.error&&!!revokedEnroll.error&&!!revokedMethodWrite.error,
    'STOP_REAL_GOTRUE_REVOKED_SUPERADMIN_STILL_AUTHORIZED');
  check(query("SELECT (SELECT count(*) FROM platform_private.wk100_source_method_decisions_v1)::text||'|'||"+
    "(SELECT count(*) FROM platform_private.wk100_capture_contract_enrollments_v1)::text||'|'||"+
    "(SELECT count(*) FROM public.wk_chart_capture_attempts_v1)::text;",db)==='3|1|0',
    'STOP_REAL_GOTRUE_METHOD_AUDIT_OR_UNINTENDED_CAPTURE');
  console.log('WK100_GOTRUE_METHOD_PAUSE_AND_LIVE_ROLE_REVOCATION=PASS');

  const bucket='wk-chart-raw-evidence-v1';
  const key=`acceptance/wk100-auth-disposable/${identity}.bin`;
  const raw=Buffer.from(`WK100 isolated private sentinel ${identity}`,'utf8');
  const upload=await admin.storage.from(bucket).upload(key,raw,{
    contentType:'application/octet-stream',upsert:false,cacheControl:'0'});
  check(!upload.error,'STOP_LOCAL_PRIVATE_SERVICE_UPLOAD_FAILED');
  const own=await admin.storage.from(bucket).download(key);
  check(!own.error&&own.data&&
    sha(Buffer.from(await own.data.arrayBuffer()))===sha(raw),
    'STOP_LOCAL_SERVICE_RAW_BYTE_DIGEST_MISMATCH');
  console.log('WK100_LOCAL_PRIVATE_SERVICE_BYTE_READBACK_SHA256=PASS');
  const denied=await signed.storage.from(bucket).download(key);
  check(!!denied.error&&!denied.data,
    'STOP_REAL_AUTHENTICATED_USER_READS_PRIVATE_RAW_OBJECT');
  const anonymous=await anon.storage.from(bucket).download(key);
  check(!!anonymous.error&&!anonymous.data,
    'STOP_ANONYMOUS_READS_PRIVATE_RAW_OBJECT');
  const listed=await signed.storage.from(bucket).list('acceptance/wk100-auth-disposable');
  check(!!listed.error||!listed.data?.some(x=>x.name===`${identity}.bin`),
    'STOP_SIGNED_IN_USER_LISTS_PRIVATE_RAW_OBJECT');
  console.log('WK100_GENUINE_AUTHENTICATED_USER_PRIVATE_DOWNLOAD_AND_LIST_DENIED=PASS');
  console.log('WK100_ANONYMOUS_PRIVATE_DOWNLOAD_DENIED=PASS');
  const removed=await admin.storage.from(bucket).remove([key]);
  check(!removed.error,'STOP_LOCAL_PRIVATE_OBJECT_CLEANUP_FAILED');
  check(query("SELECT count(*) FROM storage.objects WHERE bucket_id='wk-chart-raw-evidence-v1';",db)==='0',
    'STOP_LOCAL_PRIVATE_STORAGE_CLEANUP_NOT_EMPTY');
  // This synthetic Auth account lives only in the disposable local database.
  // Account deletion exercises unrelated user-retirement triggers, not the WK100
  // Storage ACL. CI always destroys Auth/Storage/DB volumes without backup.
  check(query('SELECT count(*) FROM auth.users;',db)==='1',
    'STOP_LOCAL_SYNTHETIC_AUTH_FIXTURE_IDENTITY_DRIFT');
  console.log('WK100_SYNTHETIC_STORAGE_OBJECT_REMOVED=PASS');
  console.log('WK100_SYNTHETIC_AUTH_USER_LOCAL_VOLUME_DESTRUCTION_REQUIRED=PASS');
  console.log('WK100_NO_HOSTED_SUPABASE_PROVIDER_OR_PRODUCTION_ACCESS=PASS');
}
main().catch(e=>{console.error(String(e?.message||'STOP_UNKNOWN').replace(/[^a-zA-Z0-9_ .:-]/g,'_').slice(0,140));process.exitCode=1;});
