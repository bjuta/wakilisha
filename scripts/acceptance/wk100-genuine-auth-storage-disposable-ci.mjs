#!/usr/bin/env node
/**
 * Real GoTrue-issued authenticated JWT vs PRIVATE WK100 Storage in a disposable
 * local Supabase stack. No hosted Preview/Production credentials or endpoints.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { runCandidateCapture } from '../../supabase/functions/_shared/chart-capture-runtime.mjs';
import { isWk100CaptureConstitutionCurrent, wk100EatWeekFromUtc } from '../../supabase/functions/_shared/wk100-source-scheduler-authority.mjs';
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
function query(sql,container,diagnoseCandidate=false){
  const p=spawnSync('docker',['exec','-i',container,'psql','-X','-q','-A','-t',
    '-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],{
    input:sql,encoding:'utf8',timeout:45000,maxBuffer:256*1024});
  if((p.error||p.status!==0)&&diagnoseCandidate){
    // Candidate contains no provider bytes or credentials. Show only PostgreSQL
    // error classification to locate a failed SQL boundary, not the SQL body.
    const lines=String(p.stderr||'').split(/\r?\n/).filter(line=>
      /ERROR:|HINT:|DETAIL:|CONTEXT:|LINE [0-9]+:/.test(line));
    console.error('WK100_W3_CANDIDATE_SQL_DIAGNOSTIC='+
      lines.slice(0,5).join(' | ').slice(0,700).replace(/[\x00-\x1f]/g,' '));
  }
  check(!p.error && p.status===0,'STOP_DISPOSABLE_LOCAL_SQL_FAILED');
  return p.stdout.trim();
}
const sha=b=>createHash('sha256').update(b).digest('hex');
const client=(url,key)=>createClient(url,key,{auth:{autoRefreshToken:false,
  persistSession:false,detectSessionInUrl:false}});
/**
 * Real first-party Shazam/Mdundo GET bytes through the ACTUAL WK100 candidate
 * runtime, genuine local signed-in super-admin RPC, PostgreSQL lease/receipt
 * and private Storage readback. ONLY in an unlinked disposable CI database.
 *
 * Authority is deliberately SYNTHETIC and exists exclusively in this
 * disposable database. These are real network/service execution tests, NOT
 * a founder-approved source admission or permanent production receipt.
 */
async function runActualProviderDisposableCapture({signed,admin,db,userId}){
  const constitutionVersion='wk100-ci-live-provider-v1';
  const slot=new Date();slot.setUTCSeconds(0,0);
  const eat=new Date(slot.getTime()+3*3600_000);
  const weeklyDay=(eat.getUTCDay()+6)%7;
  const week=wk100EatWeekFromUtc(slot);
  const scheduledAt=slot.toISOString().replace('.000Z','Z');
  query("UPDATE public.user_role_assignments SET status='active',"+
    "updated_at=clock_timestamp(),expires_at=clock_timestamp()+interval '20 minutes'"+
    " WHERE user_id='"+userId+"'::uuid AND role_key='super_admin';",db);
  const canAdmin=await signed.rpc('current_user_has_capability',{required_capability:'manage_ingest'});
  check(!canAdmin.error&&canAdmin.data===true,'STOP_WK100_LIVE_LOCAL_METHOD_ADMIN_UNAVAILABLE');
  const sources=[
    {provider:'shazam_ke',source:'shazam_ke_public_top200',parser:'shazam_kenya_discovery_v1',
     endpoint:'https://www.shazam.com/services/charts/csv/top-200/kenya/',
     methodClass:'offered_export',behavior:'discovery',metric:'rank',depth:200,expected:'succeeded'},
    {provider:'mdundo_ke',source:'mdundo_ke_public_top_songs',parser:'mdundo_kenya_chart_v1',
     endpoint:'https://play.mdundo.com/top-charts/ke',
     methodClass:'reviewed_page_adapter',behavior:'consumption',metric:'rank',depth:100,
     expected:'partial_depth'},
  ];
  const bucket=admin.storage.from('wk-chart-raw-evidence-v1');
  const objects=[];
  try{
    for(const spec of sources){
      const proposal={
        providerKey:spec.provider,sourceKey:spec.source,
        surface:spec.provider+' public Kenya source, isolated real-byte CI',
        methodClass:spec.methodClass,behavior:spec.behavior,metric:spec.metric,
        expectedDepth:spec.depth,cadence:'weekly',intervalHours:null,
        eatHour:eat.getUTCHours(),eatMinute:eat.getUTCMinutes(),
        weekdayEat:weeklyDay,minimumHealthyCheckpoints:1,
        evidenceReference:'ci_real_public_bytes_synthetic_method_authority',
        reason:'Disposable independent public transport without Production admission',
      };
      const p=await signed.rpc('wk100_submit_source_proposal_v1',{
        p_payload:proposal,p_expected_revision:0});
      check(!p.error&&p.data?.revision===1,'STOP_WK100_LIVE_SOURCE_PROPOSAL_FAILED');
      const endpointSha=sha(Buffer.from(spec.endpoint));
      const authorizationRef='ci_only_synthetic_public_access_'+spec.provider;
      const method={
        sourceKey:spec.source,providerKey:spec.provider,proposalRevision:1,
        decisionState:'collector_admitted',parserClass:spec.parser,methodClass:spec.methodClass,
        // Local synthetic period authority intentionally cannot qualify an
        // actual source-native date or commercial collection authorization.
        nativePeriodAuthority:'provider_defined',
        nativePeriodEvidenceRef:'ci_synthetic_period_not_provider_week_proof',
        endpointSha256:endpointSha,
        accessEvidenceSha256:sha(Buffer.from('ci_only_synthetic_method_'+spec.provider)),
        authorizationRef,authorizationExpiresAt:
          new Date(Date.now()+2*86400_000).toISOString().replace(/\.\d{3}Z$/,'Z'),
        constitutionVersion,reason:'CI synthetic admission for real first-party service flow only',
      };
      const review=await signed.rpc('wk100_review_source_method_v1',{
        p_payload:method,p_expected_decision_revision:0});
      check(!review.error&&review.data?.decisionState==='collector_admitted',
        'STOP_WK100_LIVE_LOCAL_METHOD_REVIEW_FAILED');
      const version='ci-real-source-v1',adapterSha=sha(Buffer.from('ci_only_'+spec.parser));
      const enrolled=await signed.rpc('wk100_enroll_source_capture_contract_v1',{
        p_source_key:spec.source,p_contract_version:version,
        p_adapter_sha256:adapterSha,p_expected_proposal_revision:1,
        p_expected_decision_revision:1});
      check(!enrolled.error&&UUID.test(enrolled.data?.contractId??''),
        'STOP_WK100_LIVE_LOCAL_ENROLLMENT_FAILED');
      const contract=await admin.from('wk_chart_capture_contracts_v1').select('*')
        .eq('source_key',spec.source).eq('contract_version',version).single();
      check(!contract.error&&contract.data?.id===enrolled.data.contractId,
        'STOP_WK100_LIVE_LOCAL_CONTRACT_READBACK_FAILED');
      const allowed=async()=>{
        const [q,listed]=await Promise.all([
          admin.rpc('wk100_service_capture_method_allowed_v1',{
            p_source_key:spec.source,p_contract_version:version,
            p_endpoint_sha256:endpointSha,p_authorization_ref:authorizationRef,
            p_parser_class:spec.parser,
          }),
          admin.rpc('wk100_service_admitted_methods_v1'),
        ]);
        return !q.error&&q.data===true&&!listed.error&&
          isWk100CaptureConstitutionCurrent({
            rows:listed.data,sourceKey:spec.source,contractVersion:version,
            endpointSha256:endpointSha,authorizationRef,
            parserClass:spec.parser,constitutionVersion,nowUtc:new Date(),
          });
      };
      check(await allowed(),'STOP_WK100_LIVE_METHOD_SERVICE_CONSTITUTION_NOT_BOUND');
      const storage={
        async readPrivate(key){
          const res=await bucket.download(key);
          if(res.error||!res.data)throw Error('readback_unavailable');
          return new Uint8Array(await res.data.arrayBuffer());
        },
        async putCreateOnly(key,bytes,options){
          const res=await bucket.upload(key,Buffer.from(bytes),{
            contentType:options.contentType,upsert:false,cacheControl:'0'});
          if(res.error)throw Error('private_upload_failed');
          objects.push(key);
        },
      };
      const rpc=async(name,args)=>{
        const {data,error}=await admin.rpc(name,args);
        if(error||!data)throw Error('service_rpc_'+name+'_failed');
        return data;
      };
      const capture=await runCandidateCapture({
        contract:contract.data,weekStartEat:week,scheduledAt,attemptNumber:1,
        access:{source_key:spec.source,endpoint:spec.endpoint,
          authorization_ref:authorizationRef,parser_class:spec.parser},
        verifyAccess:allowed,clock:()=>new Date(),enabled:true,timeoutMs:15000,
        db:{
          reserve:args=>rpc('wk_chart_runtime_reserve_v1',args),
          advance:args=>rpc('wk_chart_runtime_advance_v1',args),
          commit:args=>rpc('wk_chart_runtime_commit_v1',args),
          fail:args=>rpc('wk_chart_runtime_fail_v1',args),
        },storage,
      });
      check(capture.status===spec.expected&&UUID.test(capture.receipt_id??'')&&
        capture.can_publish===false,'STOP_WK100_LIVE_PRIVATE_COLLECTOR_STATUS_INVALID');
      const receipt=await admin.from('wk_chart_capture_attempts_v1')
        .select('id,status,observed_depth,payload_sha256,raw_object_key,native_period_authority')
        .eq('id',capture.receipt_id).single();
      check(!receipt.error&&receipt.data?.status===spec.expected&&
        receipt.data.raw_object_key===capture.raw_object_key&&
        receipt.data.payload_sha256===capture.payload_sha256&&
        receipt.data.native_period_authority==='unknown'&&
        receipt.data.observed_depth===(spec.provider==='mdundo_ke'?99:200),
        'STOP_WK100_LIVE_PRIVATE_SQL_RECEIPT_READBACK_INVALID');
      const raw=await storage.readPrivate(capture.raw_object_key);
      check(sha(Buffer.from(raw))===capture.payload_sha256,
        'STOP_WK100_LIVE_PRIVATE_ORIGINAL_SHA_READBACK_INVALID');
      const rows=await admin.from('wk_chart_capture_rows_v1')
        .select('source_rank').eq('attempt_id',capture.receipt_id).order('source_rank');
      check(!rows.error&&rows.data?.length===receipt.data.observed_depth&&
        rows.data[0]?.source_rank===1&&
        rows.data.at(-1)?.source_rank===receipt.data.observed_depth,
        'STOP_WK100_LIVE_NATIVE_SQL_RANKS_INVALID');
      console.log('WK100_REAL_FIRST_PARTY_'+spec.provider.toUpperCase()+
        '_LOCAL_SERVICE_SQL_PRIVATE_RECEIPT_SHA_READBACK=PASS'+
        ' status='+capture.status+' rows='+receipt.data.observed_depth+
        ' sha256='+capture.payload_sha256);
    }
    const all=await admin.from('wk_chart_capture_attempts_v1')
      .select('id,contract_id').order('created_at');
    check(!all.error&&all.data?.length===3,
      'STOP_WK100_LIVE_TWO_PROVIDER_SERVICE_RECEIPTS_MISSING');
    console.log('WK100_TWO_REAL_PROVIDER_BYTES_SYNTHETIC_LOCAL_ADMISSION_ONLY=PASS');
  }finally{
    if(objects.length){
      const gone=await bucket.remove(objects);
      check(!gone.error,'STOP_WK100_LIVE_PRIVATE_SOURCE_CLEANUP_FAILED');
    }
    query("UPDATE public.user_role_assignments SET status='revoked',"+
      "updated_at=clock_timestamp() WHERE user_id='"+userId+
      "'::uuid AND role_key='super_admin';",db);
  }
  check(query("SELECT count(*) FROM storage.objects WHERE bucket_id='wk-chart-raw-evidence-v1';",db)==='0',
    'STOP_WK100_LIVE_DISPOSABLE_PRIVATE_OBJECTS_REMAIN');
  console.log('WK100_LIVE_FIRST_PARTY_DISPOSABLE_STORAGE_CLEANUP=PASS');
}

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
  // W3 is now an ACTIVE source-controlled migration, not supplemental
  // candidate DDL. The already-completed clean Supabase migration replay
  // must have applied it exactly once before any GoTrue/Storage fixtures.
  // The founder minted this exact version using Supabase CLI 2.107.0 and
  // independently verified the candidate SHA-256 on 2026-11-03.
  const w3Path='supabase/migrations/20261103160634_wk100_phase1_w3_collection_recovery_v1.sql';
  const w3Version='20261103160634';
  const w3Candidate=readFileSync('scripts/acceptance/wk100-phase1-recovery-candidate.sql','utf8');
  const w3Active=readFileSync(w3Path,'utf8');
  check(w3Candidate===w3Active &&
    sha(Buffer.from(w3Active,'utf8'))==='38f27592803baa1097ac38010b018da70778f901af0e5fa876c14323bd1cb2d0' &&
    w3Active.includes('wk100_record_collection_action_v1') &&
    w3Active.includes('wk100_service_retry_requests_v1') &&
    w3Active.trimEnd().endsWith('commit;') &&
    // The full active/apply ledger was matched exactly above. W3 must be
    // byte-for-byte present in that ledger, but newer forward migrations
    // must not falsely invalidate its approved authority.
    expectedVersions.includes(w3Version) &&
    appliedVersions.includes(w3Version),
    'STOP_WK100_W3_ACTIVE_MIGRATION_FILENAME_OR_BYTES_NOT_SEALED');
  check(query("SELECT (SELECT count(*) FROM platform_private.wk100_collection_actions_v1)::text||'|'||"+
    "(SELECT has_function_privilege('anon','public.wk100_record_collection_action_v1(text,date,uuid,timestamptz,smallint,integer,uuid,text)','EXECUTE'))::text||'|'||"+
    "(SELECT has_function_privilege('service_role','public.wk100_service_retry_requests_v1(date)','EXECUTE'))::text;",db)==='0|false|true',
    'STOP_WK100_W3_CANDIDATE_ACL_OR_EMPTY_LEDGER');
  console.log('WK100_W3_ACTIVE_PG17_FULL_REPLAY_AND_ACL=PASS');
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
  const deniedW3Read=await signed.rpc('wk100_list_collection_actions_v1',{p_week:'2026-11-02'});
  const anonymousW3Read=await anon.rpc('wk100_list_collection_actions_v1',{p_week:'2026-11-02'});
  check(!!deniedRead.error&&!!deniedWrite.error&&
    !!deniedW3Read.error&&!!anonymousW3Read.error,
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
  // Keep the SQL fixture's real EAT slot inside the collector's enforced
  // 20-minute window; never relax source cadence or reservation rules.
  const captureSlotUtc=new Date();
  captureSlotUtc.setUTCSeconds(0,0);
  const captureSlotEat=new Date(captureSlotUtc.getTime()+3*3600_000);
  const proposalC={...proposalA,providerKey:'apple_ke',
    sourceKey:'apple_ke_disposable_catalog',surface:'Disposable Apple Kenya chart method',
    behavior:'consumption',metric:'rank',methodClass:'provider_api',
    cadence:'daily',weekdayEat:null,minimumHealthyCheckpoints:7,
    eatHour:captureSlotEat.getUTCHours(),eatMinute:captureSlotEat.getUTCMinutes(),
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
  const localEat=new Date(captureSlotEat);
  localEat.setUTCDate(localEat.getUTCDate()-((localEat.getUTCDay()+6)%7));
  const currentWeek=localEat.toISOString().slice(0,10);
  const w3Read=await signed.rpc('wk100_list_collection_actions_v1',{p_week:currentWeek});
  check(!w3Read.error&&Array.isArray(w3Read.data)&&w3Read.data.length===0,
    'STOP_W3_SUPERADMIN_EMPTY_ACTIONS_UNAVAILABLE');
  const attemptOperation=randomUUID();
  const baseW3={p_week:currentWeek,p_contract_id:enrolled.data.contractId,
    p_scheduled_at:null,p_expected_attempt_number:null,
    p_operation_id:attemptOperation,p_reason:'Document missing collection without evidence substitution'};
  const forgedRetry=await signed.rpc('wk100_record_collection_action_v1',{
    ...baseW3,p_action:'request_retry',
    p_scheduled_at:new Date().toISOString(),p_expected_attempt_number:1,
    p_expected_revision:null});
  check(!!forgedRetry.error,'STOP_W3_RETRY_WITHOUT_FAILED_ATTEMPT_ACCEPTED');
  // A legitimate W3 retry requires an actual service-owned failure receipt.
  // The existing reservation + fail RPCs, not direct table insertion, create
  // that receipt; this exercises exactly the worker's Postgres lease boundary.
  const slotIso=captureSlotUtc.toISOString().replace('.000Z','Z');
  const reserve=await admin.rpc('wk_chart_runtime_reserve_v1',{
    p_contract_id:enrolled.data.contractId,p_week_start_eat:currentWeek,
    p_scheduled_at:slotIso,p_attempt_number:1,
  });
  check(!reserve.error&&UUID.test(reserve.data?.reservation_id??'')&&
    UUID.test(reserve.data?.lease_id??''),
    'STOP_W3_REAL_SERVICE_RESERVATION_FAILED');
  const failed=await admin.rpc('wk_chart_runtime_fail_v1',{
    p_reservation_id:reserve.data.reservation_id,
    p_lease_id:reserve.data.lease_id,p_outcome:'transport_failed',
    p_upstream_reference:'disposable_local_transport_failure',
    p_failure_code:'ci_transport_unavailable',
  });
  check(!failed.error&&failed.data?.status==='transport_failed'&&
    UUID.test(failed.data?.receipt_id??'')&&failed.data?.can_publish===false,
    'STOP_W3_REAL_SERVICE_TRANSPORT_FAILURE_MISSING');
  const retryArgs={...baseW3,p_action:'request_retry',
    p_operation_id:randomUUID(),p_scheduled_at:slotIso,
    p_expected_attempt_number:1,p_expected_revision:null,
    p_reason:'Retry preserved isolated transport-failure receipt'};
  const requestedRetry=await signed.rpc('wk100_record_collection_action_v1',retryArgs);
  check(!requestedRetry.error&&requestedRetry.data?.recorded===true&&
    requestedRetry.data?.actionKind==='retry_requested'&&
    requestedRetry.data?.attemptNumber===2&&
    requestedRetry.data?.canCollect===false&&requestedRetry.data?.canPublish===false,
    'STOP_W3_VALID_FAILED_SLOT_RETRY_NOT_RECORDED');
  const idempotentRetry=await signed.rpc('wk100_record_collection_action_v1',retryArgs);
  check(!idempotentRetry.error&&
    idempotentRetry.data?.actionId===requestedRetry.data.actionId,
    'STOP_W3_VALID_RETRY_OPERATION_REPLAY_NOT_IDEMPOTENT');
  const secondRetry=await signed.rpc('wk100_record_collection_action_v1',{
    ...retryArgs,p_operation_id:randomUUID()});
  check(!!secondRetry.error,'STOP_W3_DUPLICATE_SLOT_RETRY_ALLOWED');
  const queuedRetry=await admin.rpc('wk100_service_retry_requests_v1',{p_week:currentWeek});
  check(!queuedRetry.error&&Array.isArray(queuedRetry.data)&&
    queuedRetry.data.length===1&&
    queuedRetry.data[0].source_key===proposalC.sourceKey&&
    queuedRetry.data[0].attempt_number===2&&
    Date.parse(queuedRetry.data[0].scheduled_at)===Date.parse(slotIso),
    'STOP_W3_SERVICE_RETRY_QUEUE_LOST_VALID_SLOT');
  console.log('WK100_W3_REAL_LEASE_FAILURE_GOVERNED_RETRY_AND_QUEUE=PASS');
  const coverageArgs={...baseW3,p_action:'request_exception',p_expected_revision:0};
  const requestedCoverage=await signed.rpc('wk100_record_collection_action_v1',coverageArgs);
  check(!requestedCoverage.error&&requestedCoverage.data?.recorded===true&&
    requestedCoverage.data?.actionKind==='coverage_requested'&&
    requestedCoverage.data?.revision===1&&
    requestedCoverage.data?.canCollect===false&&
    requestedCoverage.data?.canScore===false&&
    requestedCoverage.data?.canPublish===false,
    'STOP_W3_COVERAGE_REQUEST_NOT_GOVERNED');
  const duplicateCoverage=await signed.rpc('wk100_record_collection_action_v1',coverageArgs);
  check(!duplicateCoverage.error&&duplicateCoverage.data?.actionId===requestedCoverage.data.actionId,
    'STOP_W3_COVERAGE_OPERATION_IDEMPOTENCE_MISSING');
  const staleCoverage=await signed.rpc('wk100_record_collection_action_v1',{
    ...coverageArgs,p_operation_id:randomUUID()});
  check(!!staleCoverage.error,'STOP_W3_DUPLICATE_PENDING_EXCEPTION_ACCEPTED');
  const decidedCoverage=await signed.rpc('wk100_record_collection_action_v1',{
    ...coverageArgs,p_action:'accept_exception',p_operation_id:randomUUID(),
    p_expected_revision:1,p_reason:'Missingness accepted as documentation only'});
  check(!decidedCoverage.error&&decidedCoverage.data?.revision===2&&
    decidedCoverage.data?.actionKind==='coverage_accepted'&&
    decidedCoverage.data?.canScore===false&&decidedCoverage.data?.canPublish===false,
    'STOP_W3_SUPERADMIN_COVERAGE_DECISION_NOT_GOVERNED');
  const w3Readback=await signed.rpc('wk100_list_collection_actions_v1',{p_week:currentWeek});
  const pendingServiceRetries=await admin.rpc('wk100_service_retry_requests_v1',{p_week:currentWeek});
  const deniedUserServiceRetries=await signed.rpc('wk100_service_retry_requests_v1',{p_week:currentWeek});
  check(!w3Readback.error&&w3Readback.data?.length===3&&
    w3Readback.data.every(a=>a.canScore===false&&a.canPublish===false)&&
    !pendingServiceRetries.error&&Array.isArray(pendingServiceRetries.data)&&
    pendingServiceRetries.data.length===1&&!!deniedUserServiceRetries.error&&
    query("SELECT count(*) FROM platform_private.wk100_collection_actions_v1;",db)==='3',
    'STOP_W3_DURABLE_ACTIONS_OR_SERVICE_PRIVACY');
  console.log('WK100_W3_GOTRUE_REQUEST_REPLAY_DECISION_AND_NO_CAPTURE=PASS');

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
  const revokedRecovery=await signed.rpc('wk100_list_collection_actions_v1',{p_week:currentWeek});
  const revokedEnroll=await signed.rpc('wk100_enroll_source_capture_contract_v1',enrollArgs);
  const revokedMethodWrite=await signed.rpc('wk100_review_source_method_v1',{
    p_payload:methodHold,p_expected_decision_revision:1});
  check(!!revokedMethods.error&&!!revokedEnroll.error&&!!revokedMethodWrite.error&&
    !!revokedRecovery.error,
    'STOP_REAL_GOTRUE_REVOKED_SUPERADMIN_STILL_AUTHORIZED');
  check(query("SELECT (SELECT count(*) FROM platform_private.wk100_source_method_decisions_v1)::text||'|'||"+
    "(SELECT count(*) FROM platform_private.wk100_capture_contract_enrollments_v1)::text||'|'||"+
    "(SELECT count(*) FROM public.wk_chart_capture_attempts_v1)::text;",db)==='3|1|1',
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
  if(process.env.WK100_LIVE_SOURCE_ACCEPTANCE==='true')
    await runActualProviderDisposableCapture({signed,admin,db,userId:created.data.user.id});
  console.log('WK100_NO_HOSTED_SUPABASE_PROVIDER_OR_PRODUCTION_ACCESS=PASS');
}
main().catch(e=>{console.error(String(e?.message||'STOP_UNKNOWN').replace(/[^a-zA-Z0-9_ .:-]/g,'_').slice(0,140));process.exitCode=1;});
