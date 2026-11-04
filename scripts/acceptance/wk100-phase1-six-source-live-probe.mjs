#!/usr/bin/env node
/**
 * WK100 Phase 1: one-shot first-party source-method acquisition preflight.
 * RESEARCH ONLY. No Admin writes, collection admission, scheduling,
 * service collector receipts, Supabase connections, scoring or publication.
 * Run from a repository worktree with Node 22: node <this file> --fetch.
 */
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,chmod} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {parseMdundoKenya,parseShazamKenya,parseAudiomackKenya,
  parseAppleKenyaPublicHtml} from
  '../../supabase/functions/_shared/chart-public-source-observations.mjs';

const MAX=4_194_304;
const SOURCES=Object.freeze([
  // Exact founder-selected five-core priority order (issue #1338).
  // Research preflight only; these are NOT admitted collector sources.
  {id:'apple_ke',url:'https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172',
    kind:'public_chart_html',reason:'First-party public daily Kenya Top 100; unknown exact weekly stream totals.'},
  {id:'shazam_ke',url:'https://www.shazam.com/services/charts/csv/top-200/kenya/',
    kind:'csv',reason:'First-party Kenya Top 200 CSV candidate; native discovery rank, never streams.'},
  {id:'mdundo_ke',url:'https://play.mdundo.com/top-charts/ke',
    kind:'html',reason:'First-party Kenya ranked songs, described as weekly updated; exact native bounds unverified.'},
  {id:'youtube_ke',url:'https://charts.youtube.com/charts/TopSongs/ke',
    kind:'public_chart_html',reason:'First-party public Kenya Top Songs landing page; exact weekly original response, views and provider period remain unverified.'},
  {id:'audiomack_ke',url:'https://audiomack.com/geo-charts/playlist/kenya',
    kind:'html',reason:'Provider-owned Weekly 100 Kenya geo chart. Preserve native ranks, not invented streams.'},
]);
const EDITORIAL=Object.freeze([
  {id:'spotify_editorial_hot_hits_ke',provider:'spotify_ke',kind:'public_chart_html',
    url:'https://open.spotify.com/embed/playlist/37i9dQZF1DWWWXigQZAD8B'},
  {id:'spotify_editorial_nmf_ke',provider:'spotify_ke',kind:'public_chart_html',
    url:'https://open.spotify.com/embed/playlist/37i9dQZF1DX5lbl7P6kJFp'},
  {id:'spotify_editorial_made_in_ke',provider:'spotify_ke',kind:'public_chart_html',
    url:'https://open.spotify.com/embed/playlist/37i9dQZF1DX7z7RLIui5KP'},
  {id:'spotify_editorial_gengetone_fire',provider:'spotify_ke',kind:'public_chart_html',
    url:'https://open.spotify.com/embed/playlist/37i9dQZF1DX80fLED6RkGS'},
]);
/**
 * Alternate methods for two EXISTING core providers, not extra sources.
 * These are NOT approved collection interfaces. YouTube's public web-client
 * browse API is undocumented; Audiomack's playlist API may require OAuth.
 * Test actual no-credential access before considering any integration.
 */
const METHOD_CANDIDATES=Object.freeze([
  {id:'youtube_ke_weekly_browse_candidate',provider:'youtube_ke',
    url:'https://charts.youtube.com/youtubei/v1/browse?alt=json',
    kind:'json_post',reason:'Unpublished YouTube chart web-client browse API; stability and week authority unqualified.'},
  {id:'audiomack_ke_playlist_api_candidate',provider:'audiomack_ke',
    url:'https://api.audiomack.com/v1/playlist/geo-charts/kenya',
    kind:'json_get',reason:'First-party documented playlist API shape; anonymous accessibility unverified.'},
]);
function youtubeResearchBody(){
  const now=new Date();
  const day=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  const sinceThu=(day.getUTCDay()+7-4)%7;
  // Query a completed Thursday, not a future or currently incomplete week.
  day.setUTCDate(day.getUTCDate()-sinceThu-(sinceThu===0?7:0));
  const requestedEnd=day.toISOString().slice(0,10).replaceAll('-','');
  return {requestedEnd,body:JSON.stringify({
    context:{client:{clientName:'WEB_MUSIC_ANALYTICS',clientVersion:'2.0',
      hl:'en-GB',gl:'KE',theme:'MUSIC'}},
    browseId:'FEmusic_analytics_charts_home',
    query:'perspective=CHART_DETAILS&chart_params_country_code=ke'+
      '&chart_params_chart_type=TRACKS&chart_params_period_type=WEEKLY'+
      '&chart_params_end_date='+requestedEnd,
  })};
}
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
async function getBounded(url,kind='GET'){
  const u=new URL(url);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)
    throw Error('invalid_fixed_endpoint');
  const post=kind==='json_post';
  if(post&&url!=='https://charts.youtube.com/youtubei/v1/browse?alt=json')
    throw Error('unapproved_post_destination');
  const requested=post?youtubeResearchBody():null;
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15_000);
  try{
    const response=await fetch(url,{method:post?'POST':'GET',
      redirect:'manual',credentials:'omit',cache:'no-store',signal:abort.signal,
      headers:{accept:'text/csv,text/html,application/json',
        ...(post?{'content-type':'application/json'}:{})},
      ...(post?{body:requested.body}:{})});
    const metadata={method:post?'POST':'GET',
      requested_chart_end_date:requested?.requestedEnd??null,
      http_status:response.status,content_type:
      (response.headers.get('content-type')??'').split(';')[0].toLowerCase(),
      endpoint:url,client_class:'node_server_fetch',redirected:response.redirected};
    if(response.status!==200||response.redirected||response.url!==url)
      return {...metadata,status:'HTTP_OR_REDIRECT_UNQUALIFIED'};
    if(Number(response.headers.get('content-length'))>MAX)
      return {...metadata,status:'CONTENT_LENGTH_TOO_LARGE'};
    if(!response.body)return {...metadata,status:'BODY_MISSING'};
    const chunks=[];let total=0;
    const reader=response.body.getReader();
    try{
      for(;;){
        const {done,value}=await reader.read();
        if(done)break;
        if(!(value instanceof Uint8Array))throw Error('non_byte_stream');
        total+=value.byteLength;
        if(total>MAX){await reader.cancel();throw Error('body_too_large');}
        chunks.push(value);
      }
    }finally{try{reader.releaseLock();}catch{}}
    if(total===0)return {...metadata,status:'BODY_EMPTY'};
    const bytes=Buffer.concat(chunks,total);
    return {...metadata,status:'RAW_BYTES_OBSERVED',bytes,
      byte_length:bytes.byteLength,payload_sha256:sha(bytes)};
  }finally{clearTimeout(timer);abort.abort();}
}
// Structural research diagnostics from genuine bytes. Deliberately refuses to
// assert chart-native week authority, row count acceptance or an API grant.
function inspectCandidateJson(sourceKey,bytes){
  let body;
  try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{return {status:'FIRST_PARTY_JSON_INVALID'};}
  const root=body&&typeof body==='object'&&!Array.isArray(body)?body:null;
  if(!root)return {status:'FIRST_PARTY_JSON_SHAPE_UNQUALIFIED'};
  if(sourceKey==='audiomack_ke_playlist_api_candidate'){
    // The documented API may return access restrictions or a playlist
    // projection; keys alone never qualify a 100-rank Kenya chart.
    return {status:'AUDIOMACK_PLAYLIST_API_SCHEMA_UNVERIFIED',
      root_keys:Object.keys(root).sort().slice(0,16)};
  }
  if(sourceKey!=='youtube_ke_weekly_browse_candidate')
    return {status:'UNEXPECTED_CANDIDATE_JSON'};
  let nodes=0,lists=0,maxDepth=0,validCountRows=0,periodLabels=0;
  const periods=new Set();
  function walk(value,depth=0){
    nodes++;
    if(nodes>120_000||depth>35)throw Error('candidate_json_traversal_limit');
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){
      for(const item of value)walk(item,depth+1);
      return;
    }
    if(Array.isArray(value.trackViews)){
      lists++;
      maxDepth=Math.max(maxDepth,value.trackViews.length);
      for(const row of value.trackViews){
        const position=row?.chartEntryMetadata?.currentPosition;
        const count=row?.viewCount;
        if((typeof position==='number'&&Number.isInteger(position)&&position>0||
            typeof position==='string'&&/^[1-9][0-9]{0,3}$/.test(position))&&
          (typeof count==='number'&&Number.isSafeInteger(count)&&count>=0||
            typeof count==='string'&&/^[0-9]{1,15}$/.test(count)))
          validCountRows++;
      }
    }
    for(const [key,child] of Object.entries(value)){
      if(['periodKey','period_key','period'].includes(key)&&
        typeof child==='string'&&/^weekly:[0-9]{8}:[0-9]{8}:ke$/.test(child)){
        periodLabels++;periods.add(child);
      }
      if(key!=='trackViews')walk(child,depth+1);
    }
  }
  try{walk(root);}catch{return {status:'YOUTUBE_INTERNAL_JSON_TOO_COMPLEX'};}
  return {status:lists===1&&validCountRows>0?
    'YOUTUBE_INTERNAL_VIEW_ROWS_OBSERVED_PERIOD_NOT_ADMITTED':
    'YOUTUBE_INTERNAL_TRACKVIEWS_NOT_QUALIFIED',
    track_view_lists:lists,max_candidate_depth:maxDepth,
    rows_with_rank_and_view_count:validCountRows,
    exact_period_label_count:periodLabels,distinct_period_labels:periods.size,
    native_period_authority:'unverified'};
}

async function main(){
  const args=process.argv.slice(2);
  if(args.length!==1||!['--dry-run','--fetch'].includes(args[0])){
    console.error('Usage: node scripts/acceptance/wk100-phase1-six-source-live-probe.mjs --dry-run|--fetch');
    process.exitCode=2;return;
  }
  if(args[0]==='--dry-run'){
    console.log(JSON.stringify({mode:'NO_NETWORK',providers:SOURCES.map(s=>
      ({provider:s.id,url:s.url??null,reason:s.reason})),
      supplementaryEditorial:EDITORIAL.map(s=>({source:s.id,url:s.url,provider:s.provider,
        signal:'editorial_placement_not_streams'})),
      routeCandidates:METHOD_CANDIDATES.map(s=>({source:s.id,provider:s.provider,
        url:s.url,method:s.kind==='json_post'?'POST':'GET',
        status:'research_method_not_admitted'}))},null,2));
    return;
  }
  const dir=resolve(process.env.WK100_PROBE_PRIVATE_DIR||
    join(homedir(),'Downloads','wk100-private-five-core-preflight'));
  await mkdir(dir,{recursive:true,mode:0o700});
  await chmod(dir,0o700);
  const records=[];
  for(const source of [...SOURCES,...EDITORIAL,...METHOD_CANDIDATES]){
    const supplementary=source.provider==='spotify_ke';
    const alternate=source.kind==='json_post'||source.kind==='json_get';
    const base={provider:source.provider??source.id,
      source_key:source.id,signal_class:alternate?'research_route_candidate':
        supplementary?'editorial_playlist_placement':'primary_chart',
      market:'KE',endpoint:source.url??null,
      method_reason:source.reason,checked_at:new Date().toISOString(),
      can_collect:false,can_score:false,can_publish:false,collector_receipt:false};
    if(!source.url){records.push({...base,status:'EXACT_SOURCE_ROUTE_UNVERIFIED'});continue;}
    try{
      const result=await getBounded(source.url,source.kind);
      const {bytes,...evidence}=result;
      if(!bytes){records.push({...base,...evidence});continue;}
      const allowed=(source.kind==='html'||source.kind==='public_chart_html')?
        evidence.content_type==='text/html':
        source.kind==='csv'?['text/csv','application/octet-stream'].includes(evidence.content_type):
        alternate&&evidence.content_type==='application/json';
      if(!allowed){records.push({...base,...evidence,status:'CONTENT_TYPE_UNQUALIFIED'});continue;}
      const filename=source.id+'-'+evidence.payload_sha256.slice(0,16)+'.'+
        (source.kind==='csv'?'csv':alternate?'json':'html');
      try{await writeFile(join(dir,filename),bytes,{flag:'wx',mode:0o600});}
      catch(e){
        if(e?.code!=='EEXIST')throw e;
      }
      // Every actual acquisition must be verified against the file bytes
      // independently, including a first-write path, before claiming a
      // captured original. Never overwrite a conflicting same-name original.
      const prior=await readFile(join(dir,filename));
      if(prior.length!==bytes.length||sha(prior)!==evidence.payload_sha256||
          !prior.equals(bytes))throw Error('immutable_original_conflict');
      const observation={...base,...evidence,original_file:filename,status:'ORIGINAL_SAVED_RESEARCH_ONLY'};
      if(alternate){
        const checked=inspectCandidateJson(source.id,bytes);
        observation.status=checked.status;
        observation.method_diagnostics=checked;
        records.push(observation);
        continue;
      }
      if(source.kind==='public_chart_html'&&source.id!=='apple_ke'){
        // A public playlist/landing HTML is not a proven observation list,
        // reporting period, provider stream count, or governed collector receipt.
        observation.status=supplementary?
          'SPOTIFY_EDITORIAL_ORIGINAL_CAPTURED_NO_RANK_VALIDATION':
          'ORIGINAL_CAPTURED_PUBLIC_CHART_DECODER_PENDING';
        records.push(observation);
        continue;
      }
      try{
        const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
        const parsed=source.id==='apple_ke'?parseAppleKenyaPublicHtml(text,{endpoint:source.url}):
          source.id==='mdundo_ke'?parseMdundoKenya(text):
          source.id==='audiomack_ke'?parseAudiomackKenya(text):parseShazamKenya(text);
        observation.status='ORIGINAL_PARSED_RESEARCH_ONLY';
        observation.observed_depth=parsed.observed_depth;
        observation.native_metric=parsed.metric;
        observation.native_period=parsed.native_period;
        observation.provider_period_label=parsed.provider_period_label??null;
      }catch(e){
        observation.status='ORIGINAL_CAPTURED_PARSER_NOT_QUALIFIED';
        observation.parse_failure=String(e?.message??e).slice(0,100);
      }
      records.push(observation);
    }catch(e){records.push({...base,status:'TRANSPORT_CLIENT_CLASS_UNQUALIFIED',
      error_class:e?.name==='AbortError'?'timeout':'network_or_transport'});}
  }
  const report={schema:'wk100-five-core-source-method-preflight-v1',
    client:'node_server_fetch',run_at:new Date().toISOString(),
    collector_receipts:0,operational_providers:0,all_four_gates_open:true,
    records};
  const reportName='method-preflight-'+new Date().toISOString().replace(/[-:.]/g,'')+
    '-'+randomUUID().slice(0,8)+'.json';
  await writeFile(join(dir,reportName),
    JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  // No original bytes or developer token are ever printed.
  console.log(JSON.stringify({private_directory:dir,report:reportName,
    summary:records.map(r=>({provider:r.provider,source:r.source_key,
      signal_class:r.signal_class,status:r.status,
      http_status:r.http_status??null,observed_depth:r.observed_depth??null,
      sha256:r.payload_sha256??null,content_type:r.content_type??null,
      byte_length:r.byte_length??null,
      parse_failure:r.parse_failure??null,
      requested_chart_end_date:r.requested_chart_end_date??null,
      method_diagnostics:r.method_diagnostics??null}))},null,2));
}
await main();
