// One-shot, hosted real-Chromium acceptance for IFPI/DDEX on isolated Registry Preview.
// Never put service-role credentials into Chromium or the receipt.
// Triggered ONLY on PR #1421 ready-for-review, not on push/synchronize/retry.
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { chromium } from '@playwright/test';

const REF='psycfvdphmvcwdhjjggf';
const URL='https://'+REF+'.supabase.co';
const USER='f1834c7d-c925-4c3d-9c03-bbee8a8a08c3';
const EMAIL='wk-discography-selected-0188f62a-78bb-42f8-9b49-44135dee4caf@example.test';
const ARTIST='10b940ff-3382-42b3-a81b-a30e4028297d';
const ORIGINAL='062aad7b-cc4f-5b4f-8902-4e82cb85faf3';
const ORIGINAL_RELEASE='d8b4d8d0-afff-536a-834d-f2754521c792';
const ORIGINAL_ISRC='KEWAK2614169', VARIANT_ISRC='KEWAK2614170', CONTRADICTION_ISRC='KEWAK2614171', NEW_ISRC='KEWAK2614172';
const POS='9901417001', NEG='9901417003', UNSELECTED='9901416996';
const LEDGER='wk-ifpi-ddex-hosted-preview-ci-receipt.json';
const evidence={project:REF,pr:1421,head:process.env.GITHUB_SHA,gate:'hosted_preview_real_browser',events:[]};
function assert(value,message){if(!value)throw new Error(message);}
function save(stage,fields={}){
  evidence.events.push({stage,at:new Date().toISOString(),...fields});
  fs.writeFileSync(LEDGER,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
  console.log('WK_HOSTED_PREVIEW_GATE='+stage);
}
function keyFrom(tree,type){
  if(Array.isArray(tree)){
    for(const x of tree){const key=keyFrom(x,type);if(key)return key;}
  } else if(tree&&typeof tree==='object'){
    const label=String(tree.name||tree.type||tree.role||'').toLowerCase();
    const v=tree.api_key||tree.key||tree.value;
    if(typeof v==='string' && (type==='service' ? label==='service_role' : label==='anon'))return v;
    for(const [k,x] of Object.entries(tree)){
      if(type==='service' && k==='service_role'&&typeof x==='string')return x;
      if(type==='anon'&&k==='anon'&&typeof x==='string')return x;
      if(typeof x==='object'){const key=keyFrom(x,type);if(key)return key;}
    }
  }
  return null;
}
const parsed=JSON.parse(fs.readFileSync(process.env.WK_SUPABASE_KEYS_FILE,'utf8'));
const service=keyFrom(parsed,'service'),anon=keyFrom(parsed,'anon');
assert(service&&anon&&service!==anon,'Exact Preview must expose distinct legacy service_role and anon keys.');
assert(process.env.SUPABASE_PROJECT_REF===REF,'Refusing anything outside disposable Registry Preview.');
if(process.env.GITHUB_EVENT_NAME!=='pull_request')throw new Error('Refusing non-PR context.');
if(!process.env.GITHUB_HEAD_REF || process.env.GITHUB_HEAD_REF!=='fix/discography-ifpi-ddex-recording-identity')throw new Error('Unexpected source branch.');
assert(process.env.GITHUB_REPOSITORY==='bjuta/wakilisha','Unexpected repository.');
async function json(url,headers,body,method='POST'){
  const response=await fetch(url,{
    method,headers:{'Content-Type':'application/json',...headers},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const raw=await response.text();
  let data;try{data=JSON.parse(raw)}catch{data={non_json:true}};
  return {status:response.status,ok:response.ok,data};
}
const adminHeaders={apikey:service,Authorization:'Bearer '+service};
let browser,server;
try {
  // Exact existing synthetic operator, NO password reset or new account.
  const existing=await json(URL+'/auth/v1/admin/users/'+USER,adminHeaders,null,'GET');
  assert(existing.ok&&existing.data.id===USER&&existing.data.email===EMAIL,
    'Existing disposable operator must match the exact expected account.');
  const link=await json(URL+'/auth/v1/admin/generate_link',adminHeaders,
    {type:'magiclink',email:EMAIL});
  assert(link.ok,'Existing operator magic-link generation failed (HTTP '+link.status+').');
  const data=link.data;
  assert((data.user?.id||data.id)===USER,'Magic link attempted to create or target a different user.');
  const hash=data.properties?.hashed_token||data.hashed_token;
  assert(typeof hash==='string'&&hash.length>10,'Magic-link token is unavailable.');
  const verified=await json(URL+'/auth/v1/verify',{apikey:anon},
    {type:'magiclink',token_hash:hash});
  assert(verified.ok&&verified.data.user?.id===USER&&verified.data.access_token,
    'Genuine GoTrue OTP verification failed (HTTP '+verified.status+').');
  const token=verified.data.access_token;
  const actor=await json(URL+'/auth/v1/user',{apikey:anon,Authorization:'Bearer '+token},null,'GET');
  assert(actor.ok&&actor.data.id===USER,'Authenticated session has wrong user identity.');
  save('GOTRUE_AUTHENTICATED_PREVIEW_OPERATOR_PASS',{operator_id:USER});
  // Chromium is the actual client class; privileged Auth key stays in server memory.
  server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>WAKILISHA Preview acceptance</title>');});
  await new Promise((resolve,reject)=>server.once('error',reject).listen(5173,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  await page.goto('http://localhost:5173');
  const origin='http://localhost:5173';
  async function request(path,options={}){
    return page.evaluate(async ({URL,anon,token,path,options})=>{
      const h={apikey:anon, ...(options.auth===false?{}:{Authorization:'Bearer '+token}),
        ...(options.body?{'Content-Type':'application/json'}:{})};
      const timer=new AbortController();const stop=setTimeout(()=>timer.abort(),30000);
      try{
        const resp=await fetch(URL+path,{method:options.method||'GET',headers:h,
          ...(options.body?{body:JSON.stringify(options.body)}:{}),signal:timer.signal});
        const raw=await resp.text();let data;
        try{data=JSON.parse(raw)}catch{data={non_json:raw.slice(0,150)}};
        return {status:resp.status,ok:resp.ok,data,
          allowOrigin:resp.headers.get('access-control-allow-origin')};
      }finally{clearTimeout(stop)}
    },{URL,anon,token,path,options});
  }
  const rpc=(name,body)=>request('/rest/v1/rpc/'+name,{method:'POST',body});
  const sel=(table,params)=>request('/rest/v1/'+table+'?'+params);
  const cors=await request('/functions/v1/ingest-artist-discography',{method:'OPTIONS',auth:false});
  assert(cors.ok&&cors.allowOrigin===origin,'Chromium Preview CORS preflight denied.');
  const role=await rpc('current_user_has_capability',{required_capability:'manage_registry'});
  assert(role.ok&&role.data===true,'Real JWT lacks governed manage_registry capability.');
  const original=await sel('registry_tracks','select=id,title,slug,isrc,metadata&isrc=eq.'+ORIGINAL_ISRC);
  assert(original.ok&&original.data.length===1&&original.data[0].id===ORIGINAL,'Original Track identity changed.');
  const originalRow=original.data[0];
  const reserved=await sel('registry_tracks','select=id,isrc&isrc=in.('+[VARIANT_ISRC,CONTRADICTION_ISRC,NEW_ISRC].join(',')+')');
  assert(reserved.ok&&reserved.data.length===0,'One-shot variants already exist; no second Apply.');
  const originalMembership=await sel('registry_release_tracks','select=release_id,track_id&track_id=eq.'+ORIGINAL);
  assert(originalMembership.ok&&originalMembership.data.some(r=>r.release_id===ORIGINAL_RELEASE),
    'Original single membership missing.');
  const unselectedBefore=await sel('registry_releases','select=id&title=eq.Unselected%20Preview%20-%20Single');
  assert(unselectedBefore.ok&&unselectedBefore.data.length===0,'Unselected album already admitted.');
  save('SIGNED_IN_CHROMIUM_PREFLIGHT_PASS');
  const track=(id,title,isrc,n)=>({apple_music_id:id,title,artist_name:'WK Selected Preview Artist',
    duration_ms:60000,disc_number:1,track_number:n,isrc,artwork_url:null,
    explicit:false,preview_url:null,genre_names:['African']});
  const album=(id,title,upc,tracks,type='album')=>({apple_music_id:id,title,
    album_artist_name:'WK Selected Preview Artist',release_type:type,release_date:'2026-11-22',
    upc,record_label:'Disposable Synthetic Acceptance (IFPI/DDEX)',genre_names:['African'],
    artwork_url:null,apple_music_url:null,
    related_artists:[{apple_music_artist_id:'9901416998',name:'WK Selected Preview Artist',url:null}],
    tracks});
  const excluded=album(UNSELECTED,'Unselected Preview - Single','9990000014168',
    [track('9901416994','Unselected Preview','KEWAK2614168',1)],'single');
  const observe=albums=>({provider:'apple_music',storefront:'ke',
    acquired_at:new Date().toISOString(),
    artist:{id:ARTIST,slug:'wk-selected-preview-artist',display_name:'WK Selected Preview Artist'},
    albums,failed_album_ids:[]});
  async function prepare(observation){
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify(observation)).digest('hex');
    const resp=await rpc('admin_prepare_registry_discography_evidence_v1',{
      p_artist_id:ARTIST,p_observation:observation,p_source_payload_fingerprint:fingerprint});
    assert(resp.ok&&typeof resp.data==='string'&&/^[0-9a-f-]{36}$/.test(resp.data),
      'Immutable evidence preparation failed HTTP '+resp.status);
    return resp.data;
  }
  const posObs=observe([album(POS,'IFPI DDEX Synthetic Album','9990000014170',[
    track('9901417005','Selected Preview',ORIGINAL_ISRC,1),
    track('9901417004','Selected Preview',VARIANT_ISRC,2),
    track('9901417006','Fresh Preview Recording',NEW_ISRC,3)]),excluded]);
  save('POSITIVE_EVIDENCE_PREPARE_ATTEMPTED');
  const posEvidence=await prepare(posObs);
  save('POSITIVE_EVIDENCE_PREPARED',{evidence_id:posEvidence});
  const preview=await rpc('admin_preview_registry_discography_evidence_v1',
    {p_evidence_assertion_id:posEvidence});
  assert(preview.ok,'Cannot preview exact immutable evidence.');
  save('POSITIVE_EDGE_APPLY_ATTEMPTED',{evidence_id:posEvidence});
  const positive=await request('/functions/v1/ingest-artist-discography',{
    method:'POST',body:{artist_id:ARTIST,mode:'apply',approved:true,
      evidence_assertion_id:posEvidence,
      selected_albums:[{apple_music_id:POS,action:'canonicalize',additional_primary_artists:[]}]}});
  assert(positive.status===200&&positive.data.ok===true&&positive.data.mode==='apply',
    'Positive hosted Edge request failed HTTP '+positive.status);
  save('POSITIVE_HTTP_200',{duration_ms:positive.data.duration_ms||null});
  const tracks=await sel('registry_tracks',
    'select=id,title,slug,isrc,metadata&isrc=in.('+[ORIGINAL_ISRC,VARIANT_ISRC,NEW_ISRC].join(',')+')');
  assert(tracks.ok&&tracks.data.length===3,'Exact three Track identities not readable.');
  const byIsrc=new Map(tracks.data.map(t=>[t.isrc,t]));
  assert(byIsrc.get(ORIGINAL_ISRC)?.id===ORIGINAL,'Strong match changed the original ID.');
  assert(JSON.stringify(byIsrc.get(ORIGINAL_ISRC)?.metadata)===JSON.stringify(originalRow.metadata),
    'Strong match changed global Track metadata.');
  assert(byIsrc.get(VARIANT_ISRC)?.id!==ORIGINAL&&
    byIsrc.get(VARIANT_ISRC)?.slug!==originalRow.slug,
    'Separate valid ISRC recording must receive separate identity/slug.');
  assert(byIsrc.get(NEW_ISRC)?.id,'Genuinely new recording missing.');
  const releases=await sel('registry_releases','select=id,title&title=eq.IFPI%20DDEX%20Synthetic%20Album');
  assert(releases.ok&&releases.data.length===1,'Selected Release not admitted exactly once.');
  const releaseId=releases.data[0].id;
  const memberships=await sel('registry_release_tracks',
    'select=release_id,track_id,disc_number,track_number&release_id=eq.'+releaseId);
  assert(memberships.ok&&memberships.data.length===3,'Selected Release must have exactly three memberships.');
  for(const [i,isrc] of [[1,ORIGINAL_ISRC],[2,VARIANT_ISRC],[3,NEW_ISRC]]){
    assert(memberships.data.some(m=>m.track_id===byIsrc.get(isrc).id&&m.disc_number===1&&m.track_number===i),
      'Incorrect exact selected Track membership for '+isrc);
  }
  const afterMembership=await sel('registry_release_tracks','select=release_id&track_id=eq.'+ORIGINAL);
  assert(afterMembership.ok&&afterMembership.data.some(x=>x.release_id===ORIGINAL_RELEASE)&&
    afterMembership.data.some(x=>x.release_id===releaseId),'Original single membership not preserved.');
  const excludedAfter=await sel('registry_releases','select=id&title=eq.Unselected%20Preview%20-%20Single');
  assert(excludedAfter.ok&&excludedAfter.data.length===0,'Unselected Release canonicalized.');
  save('PERSISTED_SELECTED_ONLY_REUSE_VARIANT_NEW_PASS',{
    release_id:releaseId,variant_track_id:byIsrc.get(VARIANT_ISRC).id,
    new_track_id:byIsrc.get(NEW_ISRC).id,original_track_id:ORIGINAL});
  const negObs=observe([album(NEG,'IFPI DDEX Contradiction MUST NOT Publish',
    '9990000014171',[track('9901416997','Selected Preview',CONTRADICTION_ISRC,1)]),excluded]);
  save('NEGATIVE_EVIDENCE_PREPARE_ATTEMPTED');
  const negEvidence=await prepare(negObs);
  save('NEGATIVE_EVIDENCE_PREPARED',{evidence_id:negEvidence});
  save('NEGATIVE_EDGE_APPLY_ATTEMPTED',{evidence_id:negEvidence});
  const rejected=await request('/functions/v1/ingest-artist-discography',{
    method:'POST',body:{artist_id:ARTIST,mode:'apply',approved:true,
      evidence_assertion_id:negEvidence,
      selected_albums:[{apple_music_id:NEG,action:'canonicalize',additional_primary_artists:[]}]}});
  assert(rejected.status===409&&rejected.data.ok===false&&
    /Strong Apple Music Track identity contradicts existing recording ISRC/i.test(rejected.data.error||''),
    'Contradictory provider Track identity must return typed HTTP 409.');
  const refusedRelease=await sel('registry_releases',
    'select=id&title=eq.IFPI%20DDEX%20Contradiction%20MUST%20NOT%20Publish');
  const refusedTrack=await sel('registry_tracks','select=id&isrc=eq.'+CONTRADICTION_ISRC);
  assert(refusedRelease.ok&&refusedRelease.data.length===0&&refusedTrack.ok&&refusedTrack.data.length===0,
    'Rejected contradictory identity wrote canonical data.');
  save('IFPI_DDEX_HOSTED_PREVIEW_ACCEPTANCE_PASS',{
    positive_http:200,negative_http:409,memberships:3,unselected_writes:0,wrong_isrc_writes:0});
  console.log('IFPI_DDEX_HOSTED_PREVIEW_ACCEPTANCE=PASS');
}catch(e){
  console.error('IFPI_DDEX_HOSTED_PREVIEW_ACCEPTANCE=FAIL: '+e.message);
  save('FAILED_STOP_NO_RETRY',{reason:e.message});
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(server)await new Promise(r=>server.close(()=>r()));
}
