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
import {parseMdundoKenya,parseShazamKenya,parseAudiomackKenya} from
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
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
async function getBounded(url,token){
  const u=new URL(url);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)
    throw Error('invalid_fixed_endpoint');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15_000);
  try{
    const response=await fetch(url,{method:'GET',redirect:'manual',credentials:'omit',
      cache:'no-store',signal:abort.signal,
      headers:{accept:'text/csv,text/html,application/json',
        ...(token?{authorization:'Bearer '+token}:{})}});
    const metadata={http_status:response.status,content_type:
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
        signal:'editorial_placement_not_streams'}))},null,2));
    return;
  }
  const dir=resolve(process.env.WK100_PROBE_PRIVATE_DIR||
    join(homedir(),'Downloads','wk100-private-five-core-preflight'));
  await mkdir(dir,{recursive:true,mode:0o700});
  await chmod(dir,0o700);
  const records=[];
  for(const source of [...SOURCES,...EDITORIAL]){
    const supplementary=source.provider==='spotify_ke';
    const base={provider:supplementary?'spotify_ke':source.id,
      source_key:source.id,signal_class:supplementary?'editorial_playlist_placement':'primary_chart',
      market:'KE',endpoint:source.url??null,
      method_reason:source.reason,checked_at:new Date().toISOString(),
      can_collect:false,can_score:false,can_publish:false,collector_receipt:false};
    if(!source.url){records.push({...base,status:'EXACT_SOURCE_ROUTE_UNVERIFIED'});continue;}
    try{
      const result=await getBounded(source.url,null);
      const {bytes,...evidence}=result;
      if(!bytes){records.push({...base,...evidence});continue;}
      const allowed=(source.kind==='html'||source.kind==='public_chart_html')?
        evidence.content_type==='text/html':
        source.kind==='csv'&&['text/csv','application/octet-stream'].includes(evidence.content_type);
      if(!allowed){records.push({...base,...evidence,status:'CONTENT_TYPE_UNQUALIFIED'});continue;}
      const filename=source.id+'-'+evidence.payload_sha256.slice(0,16)+'.'+
        (source.kind==='csv'?'csv':'html');
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
      if(source.kind==='public_chart_html'){
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
        const parsed=source.id==='mdundo_ke'?parseMdundoKenya(text):
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
      byte_length:r.byte_length??null}))},null,2));
}
await main();
