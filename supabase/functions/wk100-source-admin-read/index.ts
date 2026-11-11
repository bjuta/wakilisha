import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { validEatWeek, projectWk100SourceHealth } from '../_shared/wk100-source-admin-projection.mjs';
import { projectWk100IdentifyObservations, wk100RegistryProviderKey } from '../_shared/wk100-identify-observations.mjs';
import { projectWk100EligibilityPreview } from '../_shared/wk100-eligibility-preview.mjs';
import { inspectWk100RankWeek } from '../_shared/wk100-ranking-evidence-review.mjs';
import { readWk100AttestedRankingPrivate } from '../_shared/wk100-ranking-attested-reader.mjs';
import { WK100_RANKING_SPECIFICATION_V1 as RANK } from '../_shared/wk100-ranking-primitive.mjs';
import { validateWk100AppleArtistReport, sha256OfWk100ReportRaw } from '../_shared/wk100-apple-artist-evidence.mjs';

const origins=new Set([
  'https://wakilisha.africa','https://www.wakilisha.africa',
  'https://staging.wakilisha.africa','http://localhost:5173',
]);
function headers(req:Request):Record<string,string>{
  const origin=req.headers.get('origin')??'';
  return {'content-type':'application/json','cache-control':'no-store',
    'x-content-type-options':'nosniff','vary':'Origin',
    ...(origins.has(origin)?{'access-control-allow-origin':origin}:{})};
}
function reply(req:Request,status:number,body:unknown){
  return new Response(JSON.stringify(body),{status,headers:headers(req)});
}
Deno.serve(async req=>{
  const origin=req.headers.get('origin');
  if(origin&&!origins.has(origin))return reply(req,403,{error:'origin_not_allowed'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers(req),
    'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
    'access-control-allow-methods':'POST,OPTIONS'}});
  if(req.method!=='POST')return reply(req,405,{error:'method_not_allowed'});
  const bearer=req.headers.get('authorization')??'';
  if(!/^Bearer [^\s]+$/.test(bearer))return reply(req,401,{error:'authentication_required'});
  let week:string,action:'health'|'original'|'identify'|'eligibility'|'artist_import'|'ranking',contractId='',receiptId='';
  let reportRaw='', reportSha256='';
  try{
    const raw=await req.text();
    if(raw.length>80000)throw Error();
    const data=JSON.parse(raw);
    if(!data||typeof data!=='object'||Array.isArray(data)||
       !validEatWeek(data.weekStartEat))throw Error();
    week=data.weekStartEat;
    if(data.action==='read_source_health'&&Object.keys(data).length===2){
      action='health';
    }else if(data.action==='read_private_ranking'&&Object.keys(data).length===2){
      action='ranking';
    }else if(['verify_private_original','read_recording_observations','preview_recording_eligibility'].includes(data.action)&&
      Object.keys(data).length===4&&
      typeof data.contractId==='string'&&typeof data.receiptId==='string'&&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.contractId)&&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.receiptId)){
      action=data.action==='verify_private_original'?'original':
        data.action==='preview_recording_eligibility'?'eligibility':'identify';
      contractId=data.contractId;receiptId=data.receiptId;
    }else if(data.action==='import_apple_artist_report'&&
      Object.keys(data).length===6&&
      typeof data.contractId==='string'&&typeof data.receiptId==='string'&&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.contractId)&&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.receiptId)&&
      typeof data.reportRaw==='string'&&data.reportRaw.length<=62000&&
      typeof data.reportSha256==='string'&&/^[a-f0-9]{64}$/.test(data.reportSha256)){
      action='artist_import'; contractId=data.contractId;receiptId=data.receiptId;
      reportRaw=data.reportRaw;reportSha256=data.reportSha256;
    }else throw Error();
    if(action!=='artist_import'&&raw.length>320)throw Error();
  }catch{return reply(req,400,{error:'request_invalid'});}
  const url=Deno.env.get('SUPABASE_URL')??'';
  const anon=Deno.env.get('SUPABASE_ANON_KEY')??'';
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  if(!url||!anon||!serviceKey)return reply(req,503,{error:'backend_unavailable'});
  const token=bearer.slice(7);
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const caller=createClient(url,anon,{global:{headers:{authorization:bearer}},
    auth:{persistSession:false,autoRefreshToken:false}});
  const identity=await admin.auth.getUser(token);
  if(identity.error||!identity.data.user?.id)return reply(req,401,{error:'authentication_required'});
  const allowed=await caller.rpc('current_user_has_capability',{required_capability:'manage_ingest'});
  if(allowed.error)return reply(req,503,{error:'capability_unavailable'});
  if(allowed.data!==true)return reply(req,403,{error:'not_authorized'});
  const charts=await caller.rpc('current_user_has_capability',{required_capability:'manage_charts'});
  if(charts.error)return reply(req,503,{error:'capability_unavailable'});
  if(charts.data!==true)return reply(req,403,{error:'not_authorized'});

  if(action==='ranking'){
    // W8/W8S/W8B/W9: server-selected week, read-only evidence and readiness.
    // The browser supplies NO source IDs, receipts, formulas or Registry facts.
    const registryAccess=await caller.rpc('current_user_has_capability',
      {required_capability:'view_registry'});
    if(registryAccess.error)return reply(req,503,{error:'registry_capability_unavailable'});
    if(registryAccess.data!==true)return reply(req,403,{error:'registry_review_not_authorized'});
    const [contractsResult,attemptsResult]=await Promise.all([
      admin.from('wk_chart_capture_contracts_v1')
        .select('id,source_key,provider_key,market,native_metric,expected_depth,admission_state')
        .limit(101),
      admin.from('wk_chart_capture_attempts_v1')
        .select('id,contract_id,week_start_eat,status,observed_depth,record_count,fetched_at,native_period_authority,native_period_start,native_period_end,native_period_evidence_ref')
        .eq('week_start_eat',week).limit(1001),
    ]);
    if(contractsResult.error||attemptsResult.error||
       !Array.isArray(contractsResult.data)||!Array.isArray(attemptsResult.data)||
       contractsResult.data.length>100||attemptsResult.data.length>1000)
      return reply(req,503,{error:'ranking_source_ledger_unavailable'});
    let inventory;
    try{inventory=inspectWk100RankWeek({weekStartEat:week,
      contracts:contractsResult.data,attempts:attemptsResult.data});}
    catch{return reply(req,503,{error:'ranking_week_inventory_unavailable'});}
    const sources=inventory.families.map(({receiptIds,canReplay,...item})=>({
      ...item,checkpointCandidate:canReplay}));
    const gates=[
      {id:'source',label:'Complete source observations',
        state:inventory.readyForPrivateReplay?'verified':'blocked'},
      {id:'method',label:'Current source admission and originals',state:'blocked'},
      {id:'eligibility',label:'Registry and saved eligibility policy',state:'blocked'},
      {id:'ranking',label:'Reproducible private Top 100',state:'blocked'},
      {id:'approval',label:'Independent editorial approval',state:'blocked'},
      {id:'stage',label:'Private Edition staging',state:'blocked'},
      {id:'publish',label:'Explicit Edition publication',state:'blocked'},
    ];
    const base={schemaVersion:'wk100-admin-private-ranking/v1',weekStartEat:week,
      specificationId:RANK.id,rankingState:'incomplete',sourceFamilies:sources,
      requiredReceiptCount:11,ranked:[],rankingDigest:null,
      sourceAdmissionSnapshotSha256:null,registrySnapshotSha256:null,
      policySha256:null,heldPositions:null,gates,
      canStage:false,canPublish:false};
    if(!inventory.readyForPrivateReplay)return reply(req,200,base);
    const draftResult=await caller.rpc('wk100_get_admin_draft_v1',{p_week:week});
    const policy=draftResult.data?.config?.ingestPolicySha256;
    if(draftResult.error||draftResult.data?.weekStartEat!==week||
       typeof policy!=='string'||!/^[a-f0-9]{64}$/.test(policy))
      return reply(req,200,{...base,
        reason:'saved_policy_not_verified'});
    const version=Deno.env.get('WK100_SOURCE_CONSTITUTION_VERSION')??'';
    if(!/^[a-zA-Z0-9._-]{2,100}$/.test(version))
      return reply(req,200,{...base,reason:'source_constitution_unavailable'});
    try{
      const verified=await readWk100AttestedRankingPrivate({
        db:admin,storage:admin.storage,
        caller:{auth:{getUser:()=>caller.auth.getUser(token)},
          rpc:(name:string,args:Record<string,unknown>)=>caller.rpc(name,args)},
        weekStartEat:week,selectedReceiptIds:inventory.selectedReceiptIds,
        eligibilityPolicySha256:policy,sourceConstitutionVersion:version,
        // Parser selection comes only from the immutable capture contract and
        // the stored period evidence. It never comes from a browser argument.
        parserAccessBySource:async (contract,attempt)=>contract.provider_key==='youtube_ke'
          ?{native_period_key:attempt.native_period_evidence_ref}:{},
      });
      const ranked=verified.privateRanking.ranked;
      if(ranked.length!==100)throw Error('ranking_incomplete');
      const ids=ranked.map(r=>r.recordingId);
      const [tracksResponse,creditsResponse]=await Promise.all([
        admin.from('registry_tracks').select('id,title,status')
          .in('id',ids).eq('status','active').limit(101),
        admin.from('registry_track_artists')
          .select('track_id,artist_id,is_primary,status').in('track_id',ids).limit(1001),
      ]);
      if(tracksResponse.error||creditsResponse.error||
         !Array.isArray(tracksResponse.data)||!Array.isArray(creditsResponse.data)||
         tracksResponse.data.length!==100||creditsResponse.data.length>1000)
        throw Error('canonical_display_unavailable');
      const names=[...new Set(creditsResponse.data.filter(c=>c.is_primary===true&&
        c.status==='active').map(c=>c.artist_id))];
      const artistsResponse=names.length?await admin.from('registry_artists')
        .select('id,display_name,status').in('id',names).limit(1001):
        {data:[],error:null};
      if(artistsResponse.error||!Array.isArray(artistsResponse.data)||
         artistsResponse.data.length>1000)throw Error('artist_display_unavailable');
      const trackById=new Map(tracksResponse.data.map(t=>[t.id,t]));
      const artistById=new Map(artistsResponse.data.filter(a=>a.status==='active')
        .map(a=>[a.id,a.display_name]));
      const nameByTrack=new Map();
      for(const credit of creditsResponse.data){
        if(credit.is_primary&&credit.status==='active'&&!nameByTrack.has(credit.track_id))
          nameByTrack.set(credit.track_id,artistById.get(credit.artist_id)??null);
      }
      const displayRanked=ranked.map(r=>({
        rank:r.rank,recordingId:r.recordingId,
        title:trackById.get(r.recordingId)?.title??null,
        artist:nameByTrack.get(r.recordingId)??null,
        score:r.score,listedFamilyCount:r.listedFamilyCount,
        contributions:RANK.families.map(family=>({
          family,points:Number((20*r.contributions[family]/
            RANK.scoreScale).toFixed(6)),
        })),
      }));
      const verifiedGates=gates.map(g=>
        ['source','method','eligibility','ranking'].includes(g.id)
          ?{...g,state:'verified'}:g);
      return reply(req,200,{...base,rankingState:'private_candidate',
        ranked:displayRanked,rankingDigest:verified.rankingDigest,
        sourceAdmissionSnapshotSha256:verified.sourceAdmissionSnapshotSha256,
        registrySnapshotSha256:verified.registrySnapshotSha256,
        policySha256:verified.policySha256,
        heldPositions:verified.heldPositions,gates:verifiedGates});
    }catch{
      // Never reveal private Registry facts, raw object paths or reason details
      // when the restricted W8 attestation refuses a source/policy/role.
      return reply(req,200,{...base,reason:'private_attestation_not_verified'});
    }
  }
  if(action==='original'){
    // Authorize the exact receipt through its contract and EAT week.
    // Neither a browser-supplied path nor arbitrary Storage key is accepted.
    const {data:record,error:recordError}=await admin.from('wk_chart_capture_attempts_v1')
      .select('id,contract_id,week_start_eat,scheduled_at,attempt_number,status,payload_sha256,raw_object_key,native_period_authority')
      .eq('id',receiptId).eq('contract_id',contractId).eq('week_start_eat',week).maybeSingle();
    if(recordError)return reply(req,503,{error:'original_receipt_unavailable'});
    if(!record)return reply(req,404,{error:'original_receipt_not_found'});
    const hash=record.payload_sha256,key=record.raw_object_key;
    if(!['succeeded','partial_depth','parse_failed','target_period_unavailable'].includes(record.status)||
       typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)||
       typeof key!=='string'||key.length>300||!key.startsWith('v1/'+week+'/')||
       key.includes('..')||!/^[A-Za-z0-9_./-]+$/.test(key))
      return reply(req,409,{error:'original_receipt_not_verifiable'});
    try{
      const {data:original,error:readError}=await admin.storage
        .from('wk-chart-raw-evidence-v1').download(key);
      if(readError||!original||original.size<1||original.size>4_194_304)
        return reply(req,503,{error:'original_readback_unavailable'});
      const bytes=await original.arrayBuffer();
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
      const calculated=Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');
      if(calculated!==hash)return reply(req,503,{error:'original_digest_mismatch'});
      return reply(req,200,{
        schemaVersion:'wk100-admin-original-readback-v1',weekStartEat:week,
        contractId,receiptId,originalVerified:true,payloadSha256:hash,
        byteLength:original.size,status:record.status,
        nativePeriodAuthority:record.native_period_authority,
        canScore:false,canPublish:false,
      });
    }catch{return reply(req,503,{error:'original_readback_unavailable'});}
  }
  if(action==='identify'||action==='eligibility'||action==='artist_import'){
    // Registry details are private steward data; neither chart management nor
    // service_role access substitutes for the caller's Registry read grant.
    const registryAccess=await caller.rpc('current_user_has_capability',
      {required_capability:'view_registry'});
    if(registryAccess.error)return reply(req,503,{error:'registry_capability_unavailable'});
    if(registryAccess.data!==true)return reply(req,403,{error:'registry_review_not_authorized'});
    // The browser selects a real immutable receipt, never a provider URL, raw
    // Storage path, Registry write operation, or purported canonical Track.
    const [contractResponse,attemptResponse]=await Promise.all([
      admin.from('wk_chart_capture_contracts_v1')
        .select('id,source_key,provider_key,market,expected_depth')
        .eq('id',contractId).maybeSingle(),
      admin.from('wk_chart_capture_attempts_v1')
        .select('id,contract_id,week_start_eat,status,payload_sha256,observed_depth,record_count')
        .eq('id',receiptId).eq('contract_id',contractId)
        .eq('week_start_eat',week).maybeSingle(),
    ]);
    if(contractResponse.error||attemptResponse.error)
      return reply(req,503,{error:'identity_receipt_unavailable'});
    const contract=contractResponse.data,attempt=attemptResponse.data;
    if(!contract||!attempt)return reply(req,404,{error:'identity_receipt_not_found'});
    if(contract.market!=='KE'||!['succeeded','partial_depth'].includes(attempt.status))
      return reply(req,409,{error:'identity_receipt_not_reviewable'});
    const rowsResponse=await admin.from('wk_chart_capture_rows_v1')
      .select('id,attempt_id,source_rank,provider_track_id,title_observed,artist_observed')
      .eq('attempt_id',receiptId).order('source_rank',{ascending:true}).limit(201);
    if(rowsResponse.error||!Array.isArray(rowsResponse.data)||
      rowsResponse.data.length>200)
      return reply(req,503,{error:'identity_rows_unavailable'});
    const rows=rowsResponse.data;
    if(action==='artist_import'){
      if(contract.provider_key!=='apple_ke'||contract.source_key!=='apple_ke_public_top100'||
        rows.length!==100||attempt.observed_depth!==100||attempt.record_count!==100)
        return reply(req,409,{error:'apple_evidence_receipt_not_supported'});
      let validated:ReturnType<typeof validateWk100AppleArtistReport>;
      try{
        const actual=await sha256OfWk100ReportRaw(reportRaw);
        if(actual!==reportSha256||
          receiptId!=='de7e4965-b3db-4e04-b352-49a2dc6ee1bb'||
          attempt.payload_sha256!=='2546ec2bf4b2a57351b6cb8bf22ff9377b5d652e3fead842c416c7f1ad7e0965'||
          reportSha256!=='46a2d8f28c25ed06ee8e22ea832d1172c1c820be3c42c27b235822ec897d0296')
          throw Error('unapproved_artist_evidence');
        validated=validateWk100AppleArtistReport({report:JSON.parse(reportRaw),receipt:attempt,rows});
      }catch{return reply(req,409,{error:'apple_evidence_report_not_accepted'});}
      const evidence=admin.from('wk100_source_artist_evidence_v1');
      const existing=await evidence
        .select('capture_row_id,provider_track_id,artist_name,source_title,original_sha256,report_sha256')
        .eq('source_receipt_id',receiptId).limit(401);
      if(existing.error||!Array.isArray(existing.data)||existing.data.length>400)
        return reply(req,503,{error:'artist_evidence_read_unavailable'});
      // Idempotent exact replay. Different or partial prior evidence is not overwritten.
      if(existing.data.length){
        const byRow=new Map(validated.map(x=>[x.capture_row_id,x]));
        const accepted=existing.data.length===100&&existing.data.every(x=>{
          const next=byRow.get(x.capture_row_id);
          return !!next&&x.report_sha256===reportSha256&&
            x.provider_track_id===next.provider_track_id&&
            x.artist_name===next.artist_name&&x.source_title===next.source_title&&
            x.original_sha256===next.original_sha256;
        });
        if(!accepted)return reply(req,409,{error:'artist_evidence_already_reviewed_or_changed'});
        return reply(req,200,{schemaVersion:'wk100-apple-artist-import-result-v1',
          accepted:100,alreadyRecorded:true,reportSha256,canWriteRegistry:false,
          canScore:false,canPublish:false});
      }
      const result=await evidence.insert(validated.map(({receipt_id,...x})=>({
        ...x,source_receipt_id:receipt_id,report_sha256:reportSha256,
        recorded_by:identity.data.user.id,
      })));
      if(result.error)return reply(req,409,{error:'artist_evidence_write_conflict'});
      return reply(req,200,{schemaVersion:'wk100-apple-artist-import-result-v1',
        accepted:100,alreadyRecorded:false,reportSha256,canWriteRegistry:false,
        canScore:false,canPublish:false});
    }
    const ids=[...new Set(rows.map(x=>x.provider_track_id)
      .filter((x):x is string=>typeof x==='string'&&x.length>0))];
    const registryProvider=wk100RegistryProviderKey(contract.provider_key);
    let typedLinks:unknown[]=[],legacyLinks:unknown[]=[];
    if(ids.length){
      const [typed,legacy]=await Promise.all([
        admin.from('registry_track_provider_links')
          .select('provider_key,provider_track_id,track_id,match_status')
          .eq('provider_key',registryProvider).eq('match_status','matched')
          .in('provider_track_id',ids).limit(401),
        admin.from('provider_entity_links')
          .select('provider,provider_entity_id,registry_entity_id,registry_entity_type,match_status')
          .eq('provider',registryProvider).eq('registry_entity_type','track')
          .eq('match_status','confirmed')
          .in('provider_entity_id',ids).limit(401),
      ]);
      if(typed.error||legacy.error||!Array.isArray(typed.data)||!Array.isArray(legacy.data)||
        typed.data.length>400||legacy.data.length>400)
        return reply(req,503,{error:'identity_registry_links_unavailable'});
      typedLinks=typed.data;legacyLinks=legacy.data;
    }
    const candidates=[...new Set([
      ...typedLinks.map(x=>(x as {track_id?:string}).track_id),
      ...legacyLinks.map(x=>(x as {registry_entity_id?:string}).registry_entity_id),
    ].filter((x):x is string=>typeof x==='string'&&
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(x)))];
    let activeTracks:unknown[]=[];
    if(candidates.length){
      const tracks=await admin.from('registry_tracks')
        .select('id,status').in('id',candidates)
        .eq('status','active').limit(401);
      if(tracks.error||!Array.isArray(tracks.data)||tracks.data.length>400)
        return reply(req,503,{error:'identity_registry_tracks_unavailable'});
      activeTracks=tracks.data;
    }
    let observation;
    try{
      observation=projectWk100IdentifyObservations({
        weekStartEat:week,contract,attempt,rows,typedLinks,legacyLinks,activeTracks,
      });
    }catch{return reply(req,503,{error:'identity_projection_unavailable'});}
    // Provider artist metadata is a separate, current lookup. Never mutate
    // original observed artist or canonical Registry identity.
    let evidenceByRow=new Map<string,{artist:string;retrievedAt:string;report:string}>();
    if(contract.source_key==='apple_ke_public_top100'){
      const lookup=await admin.from('wk100_source_artist_evidence_v1')
        .select('capture_row_id,provider_track_id,artist_name,lookup_retrieved_at,original_sha256,report_sha256')
        .eq('source_receipt_id',receiptId)
        .order('lookup_retrieved_at',{ascending:false}).limit(401);
      if(lookup.error||!Array.isArray(lookup.data)||lookup.data.length>400)
        return reply(req,503,{error:'apple_artist_evidence_unavailable'});
      const byId=new Map(rows.map(x=>[x.id,x]));
      for(const entry of lookup.data){
        const source=byId.get(entry.capture_row_id);
        if(source&&source.provider_track_id===entry.provider_track_id&&
          entry.original_sha256===attempt.payload_sha256&&
          !evidenceByRow.has(entry.capture_row_id)){
          evidenceByRow.set(entry.capture_row_id,{artist:entry.artist_name,
            retrievedAt:entry.lookup_retrieved_at,report:entry.report_sha256});
        }
      }
    }
    const withArtist=<T extends {captureRowId:string}>(items:T[])=>items.map(r=>{
      const e=evidenceByRow.get(r.captureRowId);
      return {...r,providerArtistName:e?.artist??null,
        providerArtistRetrievedAt:e?.retrievedAt??null,
        providerArtistReportSha256:e?.report??null};
    });
    observation.rows=withArtist(observation.rows);
    if(action==='identify')return reply(req,200,observation);

    // Existing signed-in, revisioned Edition policy, never a browser-supplied
    // eligibility profile. A missing or invalid draft fails W5 closed.
    const draftResponse=await caller.rpc('wk100_get_admin_draft_v1',{p_week:week});
    if(draftResponse.error)return reply(req,503,{error:'eligibility_draft_unavailable'});
    const current=draftResponse.data;
    if(!current)return reply(req,409,{error:'eligibility_edition_not_configured'});
    if(current.weekStartEat!==week||!Number.isSafeInteger(current.revision)||
       current.revision<1||typeof current.updatedAt!=='string'||
       !current.config||typeof current.config!=='object')
      return reply(req,503,{error:'eligibility_draft_invalid'});

    const resolvedIds=[...new Set(observation.rows
      .filter(x=>x.identityState==='resolved'&&x.canonicalTrackId)
      .map(x=>x.canonicalTrackId))];
    let registryTracks:unknown[]=[],registryCredits:unknown[]=[],
      registryArtists:unknown[]=[],registryReleases:unknown[]=[];
    if(resolvedIds.length){
      const [tracksResult,creditsResult]=await Promise.all([
        admin.from('registry_tracks')
          .select('id,slug,title,isrc,release_id,duration_ms,explicit,preview_url,status,metadata,updated_at')
          .in('id',resolvedIds).eq('status','active').limit(401),
        admin.from('registry_track_artists')
          .select('id,track_id,artist_id,role,is_primary,status')
          .in('track_id',resolvedIds).limit(401),
      ]);
      if(tracksResult.error||creditsResult.error||
        !Array.isArray(tracksResult.data)||!Array.isArray(creditsResult.data)||
        tracksResult.data.length>400||creditsResult.data.length>400)
        return reply(req,503,{error:'eligibility_registry_read_unavailable'});
      registryTracks=tracksResult.data;registryCredits=creditsResult.data;
      const artistIds=[...new Set(creditsResult.data
        .map(x=>x.artist_id).filter((x):x is string=>typeof x==='string'))];
      const releaseIds=[...new Set(tracksResult.data
        .map(x=>x.release_id).filter((x):x is string=>typeof x==='string'))];
      const [artistsResult,releasesResult]=await Promise.all([
        artistIds.length?admin.from('registry_artists')
          .select('id,slug,status,origin_iso2,gender,artist_type,metadata')
          .in('id',artistIds).limit(401):Promise.resolve({data:[],error:null}),
        releaseIds.length?admin.from('registry_releases')
          .select('id,slug,status,release_type,release_date,metadata,updated_at')
          .in('id',releaseIds).limit(401):Promise.resolve({data:[],error:null}),
      ]);
      if(artistsResult.error||releasesResult.error||
        !Array.isArray(artistsResult.data)||!Array.isArray(releasesResult.data)||
        artistsResult.data.length>400||releasesResult.data.length>400)
        return reply(req,503,{error:'eligibility_registry_read_unavailable'});
      registryArtists=artistsResult.data;registryReleases=releasesResult.data;
    }
    try {
      const preview=await projectWk100EligibilityPreview({
        weekStartEat:week,sourceReview:observation,
        draft:{week_start_eat:week,revision:current.revision,
          updated_by:identity.data.user.id,updated_at:current.updatedAt,
          config_json:current.config},
        registryTracks,registryCredits,registryArtists,registryReleases,
      });
      return reply(req,200,{...preview,rows:withArtist(preview.rows)});
    }catch{return reply(req,503,{error:'eligibility_policy_verification_failed'});}
  }
  // Only explicitly selected read-only columns are allowed across this
  // service-role boundary. No raw object keys, endpoints or credentials.
  const [contracts,attempts]=await Promise.all([
    admin.from('wk_chart_capture_contracts_v1')
      .select('id,source_key,provider_key,source_surface,market,behavior,native_metric,expected_depth,cadence_kind,interval_hours,eat_hour,eat_minute,weekday_eat,minimum_healthy_checkpoints,adapter_version,contract_version,admission_state')
      .order('created_at',{ascending:false}).limit(100),
    admin.from('wk_chart_capture_attempts_v1')
      .select('id,contract_id,week_start_eat,scheduled_at,attempt_number,created_at,fetched_at,status,observed_depth,native_period_authority,native_period_start,native_period_end,payload_sha256,failure_code')
      .eq('week_start_eat',week).order('created_at',{ascending:false}).limit(1000),
  ]);
  if(contracts.error||attempts.error)return reply(req,503,{error:'source_health_unavailable'});
  // Never silently present a partial source list as the entire constitution.
  if((contracts.data?.length??0)>=100||(attempts.data?.length??0)>=1000)
    return reply(req,503,{error:'source_health_page_limit'});
  try{
    return reply(req,200,projectWk100SourceHealth(contracts.data,attempts.data,week));
  }catch{return reply(req,503,{error:'source_projection_unavailable'});}
});
