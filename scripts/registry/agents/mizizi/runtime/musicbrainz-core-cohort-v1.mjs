/** Offline cohort candidate discovery from the official MusicBrainz CC0 core
 * PostgreSQL COPY dump. This is NOT the MusicBrainz API or derived dump.
 * No network, model, database write, canonical resolution or authority grant.
 * Retain one candidate projection per source recording, not one copy per
 * subject. The trusted caller verifies the publisher-signed archive and
 * extraction manifest separately; this reader verifies actual table bytes.
 */
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {readFile,stat} from "node:fs/promises";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";

const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const ISRC=/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;
const MAX_INPUT=100000,MAX_CANDIDATES=150000,MAX_EDGES=2000000,MAX_PER_SUBJECT=50;
const MAX_LINE=262144,MAX_RETAINED_BYTES=128000000,MAX_INPUT_BYTES=64000000;
const TABLES=Object.freeze({isrc:5,artist_credit:7,recording:9});
const fail=code=>{throw Error("MIZIZI_CORE_COHORT_"+code);};
const digest=value=>createHash("sha256").update(value).digest("hex");
const text=value=>typeof value==="string"&&value.length<=1024&&value.trim().length>0&&!/[\p{Cc}\p{Cf}]/u.test(value);
const key=value=>typeof value==="string"?value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu," ").trim():"";
const pair=(title,artist)=>JSON.stringify([title,artist]);
const id=value=>typeof value==="string"&&/^[1-9][0-9]{0,9}$/.test(value)&&Number(value)<=2147483647;
function normalizeIsrc(value){
 if(value===null||value===undefined)return null;
 if(typeof value!=="string")fail("INPUT_ISRC_INVALID");
 const normalized=value.toUpperCase().replace(/-/g,"");
 if(!ISRC.test(normalized)||!/^(?:[A-Za-z]{2}[A-Za-z0-9]{3}[0-9]{7}|[A-Za-z]{2}-[A-Za-z0-9]{3}-[0-9]{2}-[0-9]{5})$/.test(value))
  fail("INPUT_ISRC_INVALID");
 return normalized;
}
function inputOf(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>MAX_INPUT)fail("INPUT_BOUND");
 const seen=new Set();
 return rows.map(row=>{
  if(!row||typeof row!=="object"||Array.isArray(row)||Object.keys(row).some(k=>!["recordingId","title","artist","isrc"].includes(k))||
   !UUID.test(row.recordingId??"")||seen.has(row.recordingId)||!text(row.title)||
   (row.artist!==null&&row.artist!==undefined&&!text(row.artist)))fail("INPUT_INVALID");
  seen.add(row.recordingId);
  return {recordingId:row.recordingId,title:row.title,artist:row.artist??null,isrc:normalizeIsrc(row.isrc)};
 });
}
function manifestOf(value){
 if(!value||value.dataset!=="musicbrainz-core-cc0"||
  typeof value.snapshot!=="string"||!/^[0-9]{8}-[0-9]{6}$/.test(value.snapshot)||
  !SHA.test(value.archiveSha256??"")||!value.tables||Object.keys(value.tables).sort().join(",")!==Object.keys(TABLES).sort().join(",")||
  Object.values(value.tables).some(x=>typeof x!=="string"||!SHA.test(x)))fail("MANIFEST_INVALID");
 return {dataset:value.dataset,snapshot:value.snapshot,archiveSha256:value.archiveSha256,
  tables:Object.fromEntries(Object.keys(TABLES).map(t=>[t,value.tables[t]]))};
}
// PostgreSQL COPY text escape decoding. Reject unsupported escape forms rather
// than silently changing names or matching a different recording.
function copyText(value){
 if(value==="\\N")return null;
 let result="";
 for(let i=0;i<value.length;i++){
  const c=value[i];if(c!=="\\"){result+=c;continue;}
  const next=value[++i];
  const escapes={"\\":"\\",t:"\t",n:"\n",r:"\r",b:"\b",f:"\f",v:"\v"};
  if(!Object.hasOwn(escapes,next))fail("COPY_ESCAPE_INVALID");
  result+=escapes[next];
 }
 return result;
}
// Streaming bounded byte-level framing. Digest covers exactly the consumed
// bytes, including row delimiters; row digest excludes its LF delimiter.
async function scan(directory,table,expected,visit){
 const hash=createHash("sha256"),decoder=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true});
 let remainder=Buffer.alloc(0),rows=0,bytes=0;
 function line(raw){
  if(!raw.length||raw.length>MAX_LINE||raw.includes(0)||raw.includes(13))fail("COPY_ROW_INVALID");
  let value;try{value=decoder.decode(raw);}catch{fail("COPY_UTF8_INVALID");}
  const fields=value.split("\t");
  if(fields.length!==TABLES[table])fail("COPY_SCHEMA_MISMATCH");
  rows++;visit(fields,()=>digest(raw));
 }
 for await(const chunk of createReadStream(join(directory,table),{highWaterMark:65536})){
  hash.update(chunk);bytes+=chunk.length;
  const data=remainder.length?Buffer.concat([remainder,chunk]):chunk;
  let start=0;
  for(;;){
   const end=data.indexOf(10,start);if(end===-1)break;
   line(data.subarray(start,end));start=end+1;
  }
  remainder=Buffer.from(data.subarray(start));
  if(remainder.length>MAX_LINE)fail("COPY_ROW_BOUND");
 }
 if(remainder.length)fail("COPY_INCOMPLETE_ROW");
 if(hash.digest("hex")!==expected)fail("TABLE_DIGEST_MISMATCH");
 if(!rows)fail("EMPTY_TABLE");
 return {table,rows,bytes};
}
function push(map,k,v){
 const list=map.get(k)??[];list.push(v);map.set(k,list);
}
/** Same snapshot is scanned by table, irrespective of cohort size. Matching
 * is exact normalized ISRC or normalized complete title + artist credit.
 * Neither method grants authority to approve a canonical recording. No fuzzy
 * similarity, transliteration, or artist-only identity merges.
 */
export async function discoverMusicBrainzCoreCohortV1({directory,manifest,recordings}={}){
 if(typeof directory!=="string"||!directory.length)fail("DIRECTORY_REQUIRED");
 const m=manifestOf(manifest),inputs=inputOf(recordings);
 const byIsrc=new Map(),byPair=new Map(),wantedArtists=new Set();
 inputs.forEach((r,i)=>{
  if(r.isrc)push(byIsrc,r.isrc,i);
  const t=key(r.title),a=key(r.artist);
  if(t&&a){push(byPair,pair(t,a),i);wantedArtists.add(a);}
 });
 const isrcByRecording=new Map(),credits=new Map(),candidates=new Map(),mbids=new Set(),matchedIsrcRows=new Set();
 const results=inputs.map(r=>({recordingId:r.recordingId,candidates:[],candidateCount:0,overflow:false}));
 const scans=[];let retainedBytes=0,edges=0,isrcRows=0;
 function retain(value){
  retainedBytes+=Buffer.byteLength(JSON.stringify(value));
  if(retainedBytes>MAX_RETAINED_BYTES)fail("RETAINED_BYTES_BOUND");
 }
 scans.push(await scan(directory,"isrc",m.tables.isrc,(f,rowHash)=>{
  if(!id(f[0])||!id(f[1])||!ISRC.test(f[2]))fail("ISRC_SCHEMA_INVALID");
  if(!byIsrc.has(f[2]))return;
  if(++isrcRows>MAX_CANDIDATES*4)fail("ISRC_MATCH_BOUND");
  const codes=isrcByRecording.get(f[1])??new Map();
  if(codes.has(f[2]))fail("DUPLICATE_ISRC_ROW");
  const match={isrc:f[2],rowSha256:rowHash()};
  retain(match);codes.set(f[2],match);isrcByRecording.set(f[1],codes);
 }));
 function creditRow(f,rowHash,missing){
  if(!id(f[0]))fail("CREDIT_SCHEMA_INVALID");
  const name=copyText(f[1]),normalized=key(name);
  if(missing?!missing.has(f[0]):!wantedArtists.has(normalized))return;
  if(!text(name)||!normalized||credits.has(f[0]))fail("CREDIT_ROW_INVALID");
  const credit={name,normalized,rowSha256:rowHash()};
  retain(credit);credits.set(f[0],credit);
  if(credits.size>MAX_CANDIDATES*2)fail("CREDIT_BOUND");
 }
 scans.push(await scan(directory,"artist_credit",m.tables.artist_credit,(f,rowHash)=>creditRow(f,rowHash,null)));
 scans.push(await scan(directory,"recording",m.tables.recording,(f,rowHash)=>{
  if(!id(f[0])||!UUID.test(f[1])||!id(f[3]))fail("RECORDING_SCHEMA_INVALID");
  const codes=isrcByRecording.get(f[0]),credit=credits.get(f[3]);
  if(!codes&&!credit)return;
  const title=copyText(f[2]),t=key(title);
  const targets=new Map();
  if(codes){
   matchedIsrcRows.add(f[0]);
   for(const code of codes.keys())for(const i of byIsrc.get(code)??[])targets.set(i,1);
  }
  if(credit&&t){
   for(const i of byPair.get(pair(t,credit.normalized))??[])targets.set(i,(targets.get(i)??0)|2);
  }
  if(!targets.size)return;
  if(!text(title)||!t||candidates.has(f[0])||mbids.has(f[1])||candidates.size>=MAX_CANDIDATES||
    !["t","f"].includes(f[8]))fail("RECORDING_ROW_INVALID");
  const duration=f[4]==="\\N"?null:Number(f[4]);
  if(duration!==null&&(!id(f[4])||!Number.isSafeInteger(duration)||duration<1))fail("DURATION_INVALID");
  const source={mbid:f[1],title,creditId:f[3],durationMs:duration,video:f[8]==="t",
   recordingRowSha256:rowHash(),matchedIsrcRows:[...(codes?.values()??[])].sort((a,b)=>a.isrc.localeCompare(b.isrc))};
  retain(source);candidates.set(f[0],source);mbids.add(f[1]);
  for(const [i,method] of targets){
   if(++edges>MAX_EDGES)fail("MATCH_EDGE_BOUND");
   const result=results[i];result.candidateCount++;
   if(result.candidateCount>MAX_PER_SUBJECT){result.overflow=true;continue;}
   const match={mbid:source.mbid,method};
   retain(match);result.candidates.push(match);
  }
 }));
 if(matchedIsrcRows.size!==isrcByRecording.size)fail("ISRC_RECORDING_JOIN_INCOMPLETE");
 // An ISRC hit can have a different artist from the supplied credit. Resolve
 // those credit IDs in one further scan, not N API calls, and expose conflict.
 const missing=new Set([...candidates.values()].map(c=>c.creditId).filter(c=>!credits.has(c)));
 if(missing.size)scans.push(await scan(directory,"artist_credit",m.tables.artist_credit,(f,rowHash)=>creditRow(f,rowHash,missing)));
 if([...missing].some(c=>!credits.has(c)))fail("RECORDING_CREDIT_JOIN_INCOMPLETE");
 const sources=[...candidates.values()].map(c=>{
  const credit=credits.get(c.creditId);
  if(!credit)fail("RECORDING_CREDIT_JOIN_INCOMPLETE");
  return {mbid:c.mbid,sourceUrl:"https://musicbrainz.org/recording/"+c.mbid,title:c.title,
   artistCredit:credit.name,durationMs:c.durationMs,video:c.video,
   recordingRowSha256:c.recordingRowSha256,artistCreditRowSha256:credit.rowSha256,
   matchedIsrcRows:c.matchedIsrcRows};
 }).sort((a,b)=>a.mbid.localeCompare(b.mbid));
 const sourceByMbid=new Map(sources.map(s=>[s.mbid,s]));
 const projected=results.map((result,i)=>{
  const input=inputs[i];
  const matches=result.overflow?[]:result.candidates.map(c=>{
   const source=sourceByMbid.get(c.mbid);
   return {mbid:c.mbid,exactIsrc:!!(c.method&1),titleArtistMatch:!!(c.method&2),
    titleAgrees:key(input.title)===key(source.title),
    artistAgrees:input.artist===null?null:key(input.artist)===key(source.artistCredit)};
  }).sort((a,b)=>a.mbid.localeCompare(b.mbid));
  return {recordingId:input.recordingId,candidateCount:result.candidateCount,
   disposition:result.overflow?"candidate_overflow":matches.length===0?"unmatched":
    matches.length>1?"ambiguous":matches[0].exactIsrc&&(!matches[0].titleAgrees||matches[0].artistAgrees===false)?
    "identifier_metadata_conflict":"single_candidate",matches};
 });
 const summary={requested:inputs.length,uniqueSourceRecordings:sources.length,
  unmatched:0,single_candidate:0,ambiguous:0,identifier_metadata_conflict:0,candidate_overflow:0};
 for(const row of projected)summary[row.disposition]++;
 return {contract:"mizizi.musicbrainz_core_cohort.v1",candidateOnly:true,identityVerified:false,canPublish:false,
  source:{...m,license:"CC0-1.0",lineage:"musicbrainz:community-core",archiveSignatureVerifiedByReader:false,
   tableDigestsVerified:true},inputSha256:digest(JSON.stringify(inputs)),scans,summary,sources,recordings:projected};
}
async function smallJson(path,max){
 const info=await stat(path);
 if(!info.isFile()||info.size<1||info.size>max)fail("JSON_FILE_BOUND");
 const data=await readFile(path);if(data.length>max)fail("JSON_FILE_BOUND");
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(data));}catch{fail("JSON_FILE_INVALID");}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==5)fail("USAGE_CORE_DIRECTORY_MANIFEST_JSON_RECORDINGS_JSON");
  const [directory,manifestPath,recordingsPath]=process.argv.slice(2);
  const result=await discoverMusicBrainzCoreCohortV1({directory,
   manifest:await smallJson(manifestPath,65536),recordings:await smallJson(recordingsPath,MAX_INPUT_BYTES)});
  process.stdout.write(JSON.stringify(result)+"\n");
 }catch(error){
  const message=error instanceof Error?error.message:"";
  console.error(/^MIZIZI_CORE_COHORT_[A-Z0-9_]+$/.test(message)?message:"MIZIZI_CORE_COHORT_IO_UNCONFIRMED");
  process.exitCode=1;
 }
}
