import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { validEatWeek, projectWk100SourceHealth } from '../_shared/wk100-source-admin-projection.mjs';
import { projectWk100IdentifyObservations, wk100RegistryProviderKey } from '../_shared/wk100-identify-observations.mjs';
import { projectWk100EligibilityPreview } from '../_shared/wk100-eligibility-preview.mjs';

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
  let week:string,action:'health'|'original'|'identify'|'eligibility',contractId='',receiptId='';
  try{
    const raw=await req.text();
    if(raw.length>320)throw Error();
    const data=JSON.parse(raw);
    if(!data||typeof data!=='object'||Array.isArray(data)||
       !validEatWeek(data.weekStartEat))throw Error();
    week=data.weekStartEat;
    if(data.action==='read_source_health'&&Object.keys(data).length===2){
      action='health';
    }else if(['verify_private_original','read_recording_observations','preview_recording_eligibility'].includes(data.action)&&
      Object.keys(data).length===4&&
      typeof data.contractId==='string'&&typeof data.receiptId==='string'&&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.contractId)&&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.receiptId)){
      action=data.action==='verify_private_original'?'original':
        data.action==='preview_recording_eligibility'?'eligibility':'identify';
      contractId=data.contractId;receiptId=data.receiptId;
    }else throw Error();
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
  if(action==='identify'||action==='eligibility'){
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
          .select('id,slug,title,isrc,release_id,duration_ms,explicit,preview_url,status,metadata')
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
          .select('id,status,origin_iso2,gender,artist_type,metadata')
          .in('id',artistIds).limit(401):Promise.resolve({data:[],error:null}),
        releaseIds.length?admin.from('registry_releases')
          .select('id,status,release_type,release_date,metadata')
          .in('id',releaseIds).limit(401):Promise.resolve({data:[],error:null}),
      ]);
      if(artistsResult.error||releasesResult.error||
        !Array.isArray(artistsResult.data)||!Array.isArray(releasesResult.data)||
        artistsResult.data.length>400||releasesResult.data.length>400)
        return reply(req,503,{error:'eligibility_registry_read_unavailable'});
      registryArtists=artistsResult.data;registryReleases=releasesResult.data;
    }
    try {
      return reply(req,200,await projectWk100EligibilityPreview({
        weekStartEat:week,sourceReview:observation,
        draft:{week_start_eat:week,revision:current.revision,
          updated_by:identity.data.user.id,updated_at:current.updatedAt,
          config_json:current.config},
        registryTracks,registryCredits,registryArtists,registryReleases,
      }));
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
