/**
 * WK100 October 2026 source-native HTML verification, PRIVATE server-only.
 *
 * Accept exactly the already preserved original Mdundo and Apple documents.
 * This module is deliberately NOT wired to the Shazam-only SQL reservation,
 * any Edge route, publisher, scoring kernel, or Registry mutation.
 * Original-byte SHA is a local-archive consistency check, not provider
 * authentication, an approved measurement week or a source admission.
 */
import {parseMdundoKenya} from './chart-public-source-observations.mjs';

const OCTOBER_WEEK='2026-10-26';
const ORIGINALS=Object.freeze({
  mdundo_ke:Object.freeze({
    sha256:'885fd7140b014bb98a7efea525148ac5e98629ee66351fbb217bc6f3b3eb45f1',
    size:1564780,observedAt:'2026-10-30T14:48:47Z',
    sourceUrl:'https://play.mdundo.com/top-charts/ke',method:'researcher_directed_public_html',
  }),
  apple_ke_public_playlist:Object.freeze({
    sha256:'35b372511a91df88ffd942b4b04373d7bb46216ae4636d37c20a2f3afaba5d7b',
    size:712638,observedAt:'2026-10-30T15:07:59.769Z',
    sourceUrl:'https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172',
    method:'researcher_directed_public_browser_html',
  }),
});
const fail=()=>{throw Error('wk100_native_html_unverified');};
const clean=x=>typeof x==='string'&&x.length>0&&x.length<=500?x:null;
const attrs=tag=>{
  const out=Object.create(null);
  for(const m of tag.matchAll(/([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
    out[m[1].toLowerCase()]=m[2]??m[3]??'';
  return out;
};
const tags=html=>{
  const out=[];
  for(const m of html.matchAll(/<meta\b[^>]*>/gi)){
    const a=attrs(m[0]);
    if(a.property==='music:song_count'||a.property==='music:song'||a.property==='music:song:track')
      out.push(a);
  }
  return out;
};
function appleSongUrl(ref){
  if(typeof ref!=='string'||ref.length>1024||ref.includes('&'))fail();
  let url;
  try{url=new URL(ref);}catch{fail();}
  if(url.protocol!=='https:'||url.hostname!=='music.apple.com'||
     url.port||url.username||url.password||url.search||url.hash||
     !/^\/ke\/song\/(?:[^/?#]+\/)?[0-9]+$/.test(url.pathname)||
     url.href!==ref)fail();
  const id=url.pathname.split('/').at(-1);
  if(!id||id.length>24)return fail();
  return {url:ref,id};
}
function parseApple(html){
  const metadata=tags(html),count=metadata.filter(x=>x.property==='music:song_count');
  const songTags=metadata.filter(x=>x.property==='music:song');
  const rankTags=metadata.filter(x=>x.property==='music:song:track');
  if(count.length!==1||count[0].content!=='100'||
     songTags.length!==100||rankTags.length!==100)fail();
  const links=songTags.map(x=>appleSongUrl(x.content));
  if(new Set(links.map(x=>x.id)).size!==100||
     rankTags.some((x,i)=>x.content!==String(i+1)))fail();
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(x=>{const a=attrs(x[1]);return a.type==='application/ld+json';});
  if(scripts.length!==1||scripts[0][2].length>400000)fail();
  let playlist;
  try{playlist=JSON.parse(scripts[0][2]);}catch{fail();}
  if(!playlist||playlist['@type']!=='MusicPlaylist'||
     playlist.numTracks!==100||!Array.isArray(playlist.track)||
     playlist.track.length!==100)fail();
  const rows=playlist.track.map((item,i)=>{
    if(!item||item['@type']!=='MusicRecording'||!clean(item.name)||
       typeof item.duration!=='string'||
       !/^PT(?=.*[0-9])(?:[0-9]+H)?(?:[0-9]+M)?(?:[0-9]+(?:\.[0-9]+)?S)?$/.test(item.duration))fail();
    const native=appleSongUrl(item.url);
    if(native.url!==links[i].url||native.id!==links[i].id)fail();
    return Object.freeze({
      source_rank:i+1,provider_track_id:native.id,title_observed:item.name,
      provider_url:native.url,duration_native:item.duration,
      canonical_track_id:null,source_native_count:null,
    });
  });
  return Object.freeze({source_key:'apple_ke_public_playlist',behavior:'consumption',
    metric:'rank',rank_depth:100,native_period_authority:'unknown',
    source_cadence:'daily_updated_playlist',private_rows:Object.freeze(rows)});
}
function parseMdundo(html){
  // Reuse the canonical accepted parser; never treat embedded page duplication,
  // off-chart artist widgets or source rank as new consumption events.
  let native;
  try{native=parseMdundoKenya(html);}catch{fail();}
  if(native.source_key!=='mdundo_ke'||native.market!=='KE'||
     native.observed_depth!==100||native.chart_depth!==100||
     native.status!=='succeeded'||native.behavior!=='consumption'||
     native.metric!=='rank'||native.rows.length!==100)fail();
  const rows=native.rows.map((item,i)=>{
    if(item.rank!==i+1||typeof item.provider_track_id!=='string'||
       !/^[A-Za-z0-9_./-]{1,180}$/.test(item.provider_track_id)||
       !clean(item.title)||!clean(item.artist))fail();
    return Object.freeze({source_rank:i+1,
      provider_track_id:item.provider_track_id,
      title_observed:item.title,artist_observed:item.artist,
      canonical_track_id:null,source_native_count:null});
  });
  return Object.freeze({source_key:'mdundo_ke',behavior:'consumption',
    metric:'rank',rank_depth:100,native_period_authority:'unknown',
    source_cadence:'weekly_update_no_native_bounds',private_rows:Object.freeze(rows)});
}
/** Parse-only native structural validation. Input must be from private originals. */
export function parseWk100ResearchNativeHtml({sourceKey,html}){
  if(!Object.hasOwn(ORIGINALS,sourceKey)||typeof html!=='string'||
     html.length<1||html.length>4_194_304)fail();
  return sourceKey==='mdundo_ke'?parseMdundo(html):parseApple(html);
}
/**
 * Strict October original readback. Never deserialize or expose private_rows
 * in the browser. A successful replay does NOT authorize source scoring.
 */
export async function verifyWk100OctoberHtmlOriginal({
  weekStartEat,sourceKey,originalBytes,
}){
  const pin=Object.hasOwn(ORIGINALS,sourceKey)?ORIGINALS[sourceKey]:null;
  if(weekStartEat!==OCTOBER_WEEK||!pin||
     !(originalBytes instanceof Uint8Array)||originalBytes.byteLength!==pin.size)fail();
  let digest;
  try{digest=new Uint8Array(await crypto.subtle.digest('SHA-256',originalBytes));}
  catch{fail();}
  const sha=[...digest].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(sha!==pin.sha256)fail();
  let parsed;
  try{parsed=parseWk100ResearchNativeHtml({
    sourceKey,html:new TextDecoder('utf-8',{fatal:true}).decode(originalBytes),
  });}catch{fail();}
  return Object.freeze({
    schema_version:'wk100-private-native-html-research-verified-v1',
    source_key:sourceKey,source_url:pin.sourceUrl,
    observation_time_utc:pin.observedAt,
    research_week_start_eat:weekStartEat,
    acquisition_mode:pin.method,raw_sha256:sha,byte_length:pin.size,
    observed_depth:parsed.rank_depth,
    native_period_authority:'unknown',
    source_admitted:false,can_score:false,can_publish:false,
    hosted_receipt_verified:false,private_rows:parsed.private_rows,
  });
}
