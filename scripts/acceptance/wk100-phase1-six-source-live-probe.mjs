#!/usr/bin/env node
/**
 * WK100 Phase 1: one-shot first-party source-method acquisition preflight.
 * RESEARCH ONLY. No Admin writes, collection admission, scheduling,
 * service collector receipts, Supabase connections, scoring or publication.
 * Run from a repository worktree with Node 22: node <this file> --fetch.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {parseMdundoKenya,parseShazamKenya,parseAppleKenya} from
  '../../supabase/functions/_shared/chart-public-source-observations.mjs';

const MAX=4_194_304;
const SOURCES=Object.freeze([
  {id:'youtube_ke',reason:'Official weekly Kenya song-view methodology; exact first-party weekly bytes route not established.'},
  {id:'spotify_ke',reason:'First-party editorial playlists do not provide Kenya chart-eligible weekly stream counts; offered export unverified.'},
  {id:'boomplay_ke',reason:'First-party Kenya ranked chart route and native schema not independently established.'},
  {id:'apple_ke',url:'https://api.music.apple.com/v1/catalog/ke/charts?types=songs&chart=most-played',
    kind:'api',reason:'Official Kenya chart API; requires read-only developer bearer token.'},
  {id:'mdundo_ke',url:'https://play.mdundo.com/top-charts/ke',
    kind:'html',reason:'First-party weekly-described Kenya chart; exact native period bounds not proved.'},
  {id:'shazam_ke',url:'https://www.shazam.com/services/charts/csv/top-200/kenya/',
    kind:'csv',reason:'Offered Top 200 Kenya CSV candidate; native discovery ranks, not streams.'},
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
      ({provider:s.id,url:s.url??null,reason:s.reason}))},null,2));
    return;
  }
  const dir=resolve(process.env.WK100_PROBE_PRIVATE_DIR||
    join(homedir(),'Downloads','wk100-private-six-source-preflight'));
  await mkdir(dir,{recursive:true,mode:0o700});
  const records=[];
  for(const source of SOURCES){
    const base={provider:source.id,market:'KE',endpoint:source.url??null,
      method_reason:source.reason,checked_at:new Date().toISOString(),
      can_collect:false,can_score:false,can_publish:false,collector_receipt:false};
    if(!source.url){records.push({...base,status:'EXACT_SOURCE_ROUTE_UNVERIFIED'});continue;}
    const token=source.kind==='api'?process.env.WK100_APPLE_READONLY_DEVELOPER_TOKEN:null;
    if(source.kind==='api'&&!token){records.push({...base,status:'API_CREDENTIAL_NOT_AVAILABLE'});continue;}
    try{
      const result=await getBounded(source.url,token);
      const {bytes,...evidence}=result;
      if(!bytes){records.push({...base,...evidence});continue;}
      const allowed=source.kind==='html'?evidence.content_type==='text/html':
        source.kind==='csv'?['text/csv','application/octet-stream'].includes(evidence.content_type):
        evidence.content_type==='application/json';
      if(!allowed){records.push({...base,...evidence,status:'CONTENT_TYPE_UNQUALIFIED'});continue;}
      const filename=source.id+'-'+evidence.payload_sha256.slice(0,16)+'.'+
        (source.kind==='html'?'html':source.kind==='csv'?'csv':'json');
      try{await writeFile(join(dir,filename),bytes,{flag:'wx',mode:0o600});}
      catch(e){
        if(e?.code!=='EEXIST')throw e;
        const prior=await readFile(join(dir,filename));
        if(prior.length!==bytes.length||sha(prior)!==evidence.payload_sha256)
          throw Error('immutable_original_conflict');
      }
      const observation={...base,...evidence,original_file:filename,status:'ORIGINAL_SAVED_RESEARCH_ONLY'};
      try{
        const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
        const parsed=source.kind==='html'?parseMdundoKenya(text):
          source.kind==='csv'?parseShazamKenya(text):parseAppleKenya(JSON.parse(text),{});
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
  const report={schema:'wk100-six-provider-source-method-preflight-v1',
    client:'node_server_fetch',run_at:new Date().toISOString(),
    collector_receipts:0,operational_providers:0,all_four_gates_open:true,
    records};
  await writeFile(join(dir,'method-preflight.json'),
    JSON.stringify(report,null,2)+'\n',{mode:0o600});
  // No original bytes or developer token are ever printed.
  console.log(JSON.stringify({private_directory:dir,report:'method-preflight.json',
    summary:records.map(r=>({provider:r.provider,status:r.status,
      http_status:r.http_status??null,observed_depth:r.observed_depth??null,
      sha256:r.payload_sha256??null}))},null,2));
}
await main();
