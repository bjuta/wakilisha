/**
 * Charts 2.0: pure first-party Kenya source decoders, adapted from the
 * reviewed 2026-11-17 chart archive. No network, privileged access, score,
 * Registry write, evidence storage, or publication authority is provided.
 * Source-native observations are candidate evidence only.
 */
/**
 * WAKILISHA Charts: bounded, provider-native public chart observation parsers.
 *
 * Source-accessibility research is not source admission for publication.
 * These pure parsers neither fetch from providers nor score/publish editions.
 * A successful parse retains native ranks/counts without inventing national
 * streams, a weekly date range, artist identities, or source weights.
 *
 * A production caller must enforce lawful access, request controls, fixed
 * provider URLs, transport limits, immutable raw-body hashing/storage, and
 * independently authorized source contracts.
 */

const MAX_TEXT_SIZE = 4_000_000;
const MAX_ROWS = 500;
const ID_RE = /^[a-zA-Z0-9_./-]{1,180}$/;

function fail(code) { throw new Error(code); }
function assertString(x, type) {
  if (typeof x !== 'string' || x.length > MAX_TEXT_SIZE) fail(`invalid_${type}_body`);
  return x;
}
function record(x) { return x !== null && typeof x === 'object' && !Array.isArray(x) ? x : null; }
function arr(x) { return Array.isArray(x) ? x : []; }
function text(x, max = 500) {
  if (typeof x !== 'string') return null;
  const s = x.trim();
  return s && s.length <= max ? s : null;
}
function decode(s) {
  return s.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&#(?:39|x27);/gi,"'").replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>').replace(/&nbsp;/gi,' ');
}
function positiveInt(x) {
  if (typeof x !== 'number' && typeof x !== 'string') return null;
  const s = String(x).replace(/,/g,'');
  if (!/^\d{1,9}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function nonnegativeCount(x) {
  const s = typeof x === 'number' || typeof x === 'string' ? String(x).replace(/,/g,'') : '';
  if (!/^\d{1,15}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}
function attrs(tag) {
  const out = Object.create(null);
  for (const m of tag.matchAll(/([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? '');
  }
  return out;
}
function normalizeRows(source, rows, declaredDepth, extra = {}) {
  if (!Number.isInteger(declaredDepth) || declaredDepth < 1 || declaredDepth > MAX_ROWS) fail(`${source}_invalid_depth`);
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > declaredDepth) fail(`${source}_invalid_rows`);
  const ranks = new Set(), ids = new Set();
  for (const r of rows) {
    if (!Number.isInteger(r.rank) || r.rank < 1 || r.rank > declaredDepth || ranks.has(r.rank)) fail(`${source}_duplicate_or_invalid_rank`);
    ranks.add(r.rank);
    if (r.provider_track_id) {
      if (ids.has(r.provider_track_id)) fail(`${source}_duplicate_provider_id`);
      ids.add(r.provider_track_id);
    }
  }
  const ordered = [...rows].sort((a,b)=>a.rank-b.rank);
  // These surfaces promise an ordered top-N list; gaps must be investigated,
  // not silently converted into artificial compacted ranks.
  if (ordered.some((r,i)=>r.rank !== i+1)) fail(`${source}_noncontiguous_rank`);
  return {
    source_key:source, market:'KE', chart_depth:declaredDepth,
    observed_depth:ordered.length, censoring:'top_n', native_period:'unknown',
    candidate_only:true, eligible_for_scoring:false,
    ...extra,
    status:ordered.length < declaredDepth ? 'partial_depth' : 'succeeded',
    rows:ordered,
  };
}
function track(rank, provider_track_id, title = null, artist = null, extra = {}) {
  return {rank, provider_track_id, title, artist, ...extra};
}

/** Mdundo Kenya Top Charts; rank and provider ID are DOM data attributes. */
export function parseMdundoKenya(raw) {
  const html = assertString(raw,'mdundo');
  const rows=[];
  for (const hit of html.matchAll(/<div\b[^>]*\bclass\s*=\s*["'][^"']*\bmd-playlist-song-item\b[^"']*["'][^>]*>/gi)) {
    const a=attrs(hit[0]);
    if (a['data-playlist-url'] !== '/top-charts/ke') continue;
    const rank=positiveInt(a['data-index']);
    const id=text(a['data-id'],180);
    if (!rank || !id || !ID_RE.test(id)) fail('mdundo_invalid_rank_or_provider_id');
    rows.push(track(rank,id,text(a['data-title']),text(a['data-artist'])));
  }
  if (!rows.length) fail('mdundo_missing_chart_rows');
  return normalizeRows('mdundo_ke',rows,100,{behavior:'consumption',metric:'rank'});
}

/**
 * First-party Audiomack Kenya public Weekly 100 playlist. The page's current
 * native music:song content is a TITLE (not a URL); historical pages exposed
 * absolute song URLs instead. Neither representation attests streaming totals
 * or exact weekly start/end boundaries.
 */
export const CHARTS2_AUDIOMACK_KE_PUBLIC_CHART_URL =
  'https://audiomack.com/geo-charts/playlist/kenya';

/**
 * Read the exact first-party Next.js Flight playlist, not the HTML title order
 * by itself. The original response is capped by the collector at 4 MiB.
 * A missing or changed server structure is research-only, never ranked rows.
 */
function audiomackEmbeddedPlaylist(html) {
  let found=null;
  for(const hit of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)){
    const script=hit[1];
    if(!script.startsWith('self.__next_f.push(')||
      !script.includes('\\"music\\":{'))continue;
    if(!script.endsWith(')'))fail('audiomack_playlist_serialization_invalid');
    let frame;
    try{frame=JSON.parse(script.slice('self.__next_f.push('.length,-1));}
    catch{fail('audiomack_playlist_serialization_invalid');}
    if(!Array.isArray(frame)||frame[0]!==1||typeof frame[1]!=='string')
      fail('audiomack_playlist_serialization_invalid');
    const stream=frame[1],marker='"music":{',position=stream.indexOf(marker);
    if(position<0||stream.indexOf(marker,position+1)!==-1||found)
      fail('audiomack_playlist_ambiguous');
    const start=position+'"music":'.length;
    let depth=0,inString=false,escaped=false,end=-1;
    for(let i=start;i<stream.length;i++){
      const ch=stream[i];
      if(inString){
        if(escaped)escaped=false;
        else if(ch==='\\')escaped=true;
        else if(ch==='"')inString=false;
        continue;
      }
      if(ch==='"'){inString=true;continue;}
      if(ch==='{')depth++;
      else if(ch==='}'&&--depth===0){end=i+1;break;}
    }
    if(end<0)fail('audiomack_playlist_serialization_invalid');
    if((stream.slice(start,end).match(/"tracks":\[/g)||[]).length!==1)
      fail('audiomack_playlist_ambiguous');
    try{found=JSON.parse(stream.slice(start,end));}
    catch{fail('audiomack_playlist_serialization_invalid');}
  }
  return found;
}
function parseAudiomackEmbeddedKenya(html,refs) {
  const p=record(audiomackEmbeddedPlaylist(html));
  if(!p)return null;
  if(p.id!=='18474189'||p.title!=='Weekly 100: Kenya'||
    p.href!=='/geo-charts/playlist/kenya'||p.urlSlug!=='kenya'||
    record(p.uploadedBy)?.slug!=='geo-charts'||p.trackCount!==100||
    !Number.isSafeInteger(p.updatedAt)||p.updatedAt<1500000000||
    !Array.isArray(p.tracks)||p.tracks.length!==100||refs.length!==100)
    fail('audiomack_embedded_chart_unverified');
  const rows=p.tracks.map((item,i)=>{
    const v=record(item),parent=record(v?.parentPlaylist),
      id=text(v?.id,180),name=text(v?.title),artist=text(v?.artistName);
    if(v?.type!=='song'||!id||!/^\d{1,16}$/.test(id)||
      v.songId!==id||!name||!artist||name!==refs[i]||
      parent?.id!==p.id||parent?.href!==p.href||
      typeof v.href!=='string'||
      !/^\/[a-zA-Z0-9_-]+\/song\/[a-zA-Z0-9_-]+$/.test(v.href))
      fail('audiomack_embedded_track_mismatch');
    return track(i+1,id,name,artist,{
      provider_url:'https://audiomack.com'+v.href,
    });
  });
  return normalizeRows('audiomack_ke',rows,100,{
    behavior:'consumption',metric:'rank',
    chart_surface:'audiomack_first_party_embedded_kenya_weekly_100',
    rank_authority:'first_party_embedded_playlist_metadata_crosschecked',
    provider_track_identity_authority:'first_party_song_id',
    artist_authority:'first_party_playlist_entry',
    provider_playlist_id:p.id,
    provider_updated_at:new Date(p.updatedAt*1000).toISOString(),
    // A playlist update timestamp is not its native consumption interval.
    native_period:'unknown',
  });
}

export function parseAudiomackKenya(raw,access={}) {
  const html=assertString(raw,'audiomack');
  const count=html.match(/"track_count"\s*:\s*(\d+)/i);
  const declared=count ? positiveInt(count[1]) : null;
  const refs=[];
  for (const hit of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a=attrs(hit[0]);
    if(a.property!=='music:song')continue;
    const ref=text(a.content,1024);
    if(!ref)fail('audiomack_song_metadata_missing');
    refs.push(ref);
  }
  if(!refs.length)fail('audiomack_missing_chart_rows');
  const allAbsolute=refs.every(ref=>/^https:\/\//i.test(ref));
  if(allAbsolute){
    const rows=[];
    for(const ref of refs){
      let u;
      try{u=new URL(ref);}catch{fail('audiomack_invalid_url');}
      if(u.protocol!=='https:' || !['audiomack.com','www.audiomack.com'].includes(u.hostname) ||
        u.port||u.username||u.password||u.search||u.hash)
        fail('audiomack_untrusted_song_origin');
      const id=u.pathname.replace(/^\/+|\/+$/g,'');
      if(!id || !ID_RE.test(id))fail('audiomack_invalid_song_path');
      rows.push(track(rows.length+1,id,null,null,{provider_url:u.origin+u.pathname}));
    }
    return normalizeRows('audiomack_ke',rows,declared||rows.length,{
      behavior:'consumption',metric:'rank',
      chart_surface:'audiomack_public_music_song_urls',
    });
  }
  // Today's first-party HTML contains exactly 100 music:song TITLE meta tags.
  // Accept only that source-bound public-chart shape. They are not stable song
  // IDs, and metadata order still needs independent ranked-display verification.
  if(access?.endpoint!==CHARTS2_AUDIOMACK_KE_PUBLIC_CHART_URL ||
    refs.length!==100||(declared!==null&&declared!==100)||
    !/<title\b[^>]*>[^<]*Weekly 100:\s*Kenya\b/i.test(html)||
    refs.some(x=>/^[a-z][a-z0-9.+-]*:|^\/|[<>]|[\u0000-\u001f\u007f]/i.test(x)))
    fail('audiomack_public_titles_unqualified');
  // Only an identical 100-entry provider playlist and meta-order attestation
  // can supply stable Audiomack song IDs and ranked candidate rows.
  const embedded=parseAudiomackEmbeddedKenya(html,refs);
  if(embedded)return embedded;
  const rows=refs.map((title,i)=>track(i+1,null,title));
  return normalizeRows('audiomack_ke',rows,100,{
    behavior:'consumption',metric:'rank',
    chart_surface:'audiomack_public_kenya_weekly_100_title_metadata',
    native_period:'unknown',
    rank_authority:'metadata_order_requires_independent_verification',
    provider_track_identity_authority:'unverified',
    artist_authority:'unverified',
  });
}

/** Strict CSV decoding for Shazam's offered Kenya Top 200 original. */
function csvRows(csv) {
  let row=[], cell='', quoted=false, closedQuote=false, out=[];
  for (let i=0;i<csv.length;i++) {
    const ch=csv[i];
    if (quoted) {
      if (ch==='"' && csv[i+1]==='"') {cell+='"';i++;}
      // The public Shazam CSV can contain literal interior quotes without
      // RFC 4180 doubling. A quote ends a field ONLY at a true boundary.
      // Preserve interior quotes verbatim; never alter the original raw bytes.
      else if (ch==='"' && csv[i+1]!==',' && csv[i+1]!=='\n' &&
        csv[i+1]!=='\r' && i+1<csv.length) {cell+='"';}
      else if (ch==='"') {quoted=false;closedQuote=true;}
      else cell+=ch;
    } else if (ch==='"') {
      if (cell || closedQuote) fail('shazam_invalid_quoted_csv');
      quoted=true;
    } else if (ch===',') {
      row.push(cell);cell='';closedQuote=false;
    } else if (ch==='\n') {
      row.push(cell.replace(/\r$/,''));out.push(row);row=[];cell='';closedQuote=false;
    } else if (closedQuote && ch!=='\r') fail('shazam_invalid_csv_after_quote');
    else cell+=ch;
  }
  if (quoted) fail('shazam_unterminated_csv_quote');
  if (row.length || cell) {row.push(cell.replace(/\r$/,''));out.push(row);}
  return out;
}

const SHAZAM_WEEKDAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SHAZAM_MONTHS=['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
/**
 * A Shazam CSV may put its dated rolling-window label on the first row,
 * followed by a blank row and the Rank header. Treat the date as a
 * provider-labelled SNAPSHOT DATE, never an exact UTC period boundary.
 */
function shazamSnapshotDate(label) {
  if(typeof label!=='string')return null;
  const match=label.match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4}) \[performance over the past 7 days\]$/);
  if(!match)return null;
  const day=Number(match[2]),month=SHAZAM_MONTHS.indexOf(match[3]),year=Number(match[4]);
  const date=new Date(Date.UTC(year,month,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month||
    date.getUTCDate()!==day||SHAZAM_WEEKDAYS[date.getUTCDay()]!==match[1])
    return null;
  return date.toISOString().slice(0,10);
}

/** Shazam CSV: identifications/discovery, NEVER equivalent to streams. */
export function parseShazamKenya(raw) {
  const csv=assertString(raw,'shazam').replace(/^\ufeff/,'');
  const sheet=csvRows(csv);
  const h=sheet.findIndex(r=>r[0]?.trim()==='Rank' && r[1]?.trim()==='Artist' && r[2]?.trim()==='Title');
  if (h<0) fail('shazam_missing_header');
  const rows=[];
  for (const cols of sheet.slice(h+1)) {
    // Ignore genuinely empty CSV spacer lines, but never silently discard a
    // populated observation whose rank is absent.
    if (cols.every(v=>!v.trim())) continue;
    const rank=positiveInt(cols[0]?.trim());
    if (cols.length!==3 || !rank || !text(cols[1]) || !text(cols[2])) fail('shazam_invalid_chart_row');
    rows.push(track(rank,null,text(cols[2]),text(cols[1])));
  }
  if (!rows.length) fail('shazam_missing_chart_rows');
  // The preamble is not guaranteed to have a fixed row index. The last
  // nonempty single-cell line before the header is the recorded label.
  const labels=sheet.slice(0,h).filter(cols=>cols.length===1)
    .map(cols=>text(cols[0],300)).filter(Boolean);
  const label=labels.at(-1)??null;
  const snapshotDate=shazamSnapshotDate(label);
  return normalizeRows('shazam_ke',rows,200,{behavior:'discovery',metric:'rank',
    provider_period_label:label,
    provider_snapshot_date:snapshotDate,
    provider_rolling_window_days:snapshotDate?7:null});
}

/**
 * Apple Music's FREE, public Kenya Top 100 page, not the developer-token API.
 * Its HTML is independently provider URL-bound and cross-checks 100 ordered
 * music:song / music:song:track meta tags against a MusicPlaylist JSON-LD.
 * The chart is updated daily; no weekly play counts or period boundaries
 * are inferred from a webpage retrieval time.
 */
export const CHARTS2_APPLE_KE_PUBLIC_CHART_URL =
  'https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172';
function applePublicSongUrl(ref) {
  if(typeof ref!=='string'||ref.length>1024||ref.includes('&'))
    fail('apple_public_song_url_invalid');
  let url;
  try{url=new URL(ref);}catch{fail('apple_public_song_url_invalid');}
  if(url.protocol!=='https:'||url.hostname!=='music.apple.com'||
    url.port||url.username||url.password||url.search||url.hash||
    !/^\/ke\/song\/(?:[^/?#]+\/)?[0-9]+$/.test(url.pathname)||
    url.href!==ref)fail('apple_public_song_url_invalid');
  return {url:ref,id:url.pathname.split('/').at(-1)};
}
export function parseAppleKenyaPublicHtml(raw,access={}) {
  if(access?.endpoint!==CHARTS2_APPLE_KE_PUBLIC_CHART_URL)
    fail('apple_public_chart_endpoint_unverified');
  const html=assertString(raw,'apple_public');
  const metadata=[...html.matchAll(/<meta\b[^>]*>/gi)].map(x=>attrs(x[0]));
  const count=metadata.filter(x=>x.property==='music:song_count');
  const songs=metadata.filter(x=>x.property==='music:song');
  const ranks=metadata.filter(x=>x.property==='music:song:track');
  if(count.length!==1||count[0].content!=='100'||
    songs.length!==100||ranks.length!==100)
    fail('apple_public_chart_structure_unverified');
  const links=songs.map(x=>applePublicSongUrl(x.content));
  if(new Set(links.map(x=>x.id)).size!==100||
    ranks.some((x,i)=>x.content!==String(i+1)))
    fail('apple_public_chart_rank_mismatch');
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(x=>attrs(x[1]).type==='application/ld+json');
  if(scripts.length!==1||scripts[0][2].length>400000)
    fail('apple_public_chart_jsonld_unverified');
  let playlist;
  try{playlist=JSON.parse(scripts[0][2]);}
  catch{fail('apple_public_chart_jsonld_unverified');}
  if(!record(playlist)||playlist['@type']!=='MusicPlaylist'||
    playlist.numTracks!==100||!Array.isArray(playlist.track)||
    playlist.track.length!==100)
    fail('apple_public_chart_jsonld_unverified');
  const rows=playlist.track.map((item,i)=>{
    const entry=record(item);
    if(!entry||entry['@type']!=='MusicRecording'||!text(entry.name)||
      typeof entry.duration!=='string'||
      !/^PT(?=.*[0-9])(?:[0-9]+H)?(?:[0-9]+M)?(?:[0-9]+(?:\.[0-9]+)?S)?$/.test(entry.duration))
      fail('apple_public_chart_track_invalid');
    const ref=applePublicSongUrl(entry.url);
    if(ref.url!==links[i].url||ref.id!==links[i].id)
      fail('apple_public_chart_track_mismatch');
    return track(i+1,ref.id,entry.name,null,{
      provider_url:ref.url,duration_native:entry.duration,
    });
  });
  return normalizeRows('apple_ke',rows,100,{
    behavior:'consumption',metric:'rank',
    chart_surface:'apple_public_daily_top_100',
    source_cadence:'daily_updated_playlist',
    native_period:'unknown',
  });
}


/**
 * The actual YouTube Charts web response encloses trackViews with its own
 * CHART_PERIOD_TYPE_WEEKLY and endDate, not a synthetic periodKey string.
 * The requested target only verifies that native date; it never supplies it.
 * A full start/end interval is NOT claimed from an end-date-only response.
 */
export const CHARTS2_YOUTUBE_KE_CHART_RESPONSE_URL =
  'https://charts.youtube.com/youtubei/v1/browse?alt=json';
function youtubeNativeWeeklyTrackViews(payload,target,access) {
  const list=record(record(payload?.contents)?.sectionListRenderer);
  if(!list)return null; // Keep the earlier explicit-period fixture decoder.
  const candidates=[];
  for(const section of arr(list.contents)){
    const content=record(record(section?.musicAnalyticsSectionRenderer)?.content);
    for(const item of arr(content?.trackTypes)){
      const o=record(item);
      if(o&&(o.listType==='TOP_VIEWS_CHART'||
        o.chartPeriodType==='CHART_PERIOD_TYPE_WEEKLY')){
        if(o.listType!=='TOP_VIEWS_CHART'||
          o.chartPeriodType!=='CHART_PERIOD_TYPE_WEEKLY')
          fail('youtube_source_chart_type_unverified');
        candidates.push(o);
      }
    }
  }
  if(candidates.length===0)fail('youtube_source_chart_type_unverified');
  if(access?.endpoint!==CHARTS2_YOUTUBE_KE_CHART_RESPONSE_URL)
    fail('youtube_source_endpoint_unverified');
  if(candidates.length!==1)fail('youtube_ambiguous_weekly_track_views');
  const native=candidates[0],endDate=native.endDate;
  if(typeof endDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||
    !Number.isFinite(Date.parse(endDate+'T00:00:00Z'))||
    new Date(Date.parse(endDate+'T00:00:00Z')).toISOString().slice(0,10)!==endDate)
    fail('youtube_native_week_end_invalid');
  const parts=target.match(/^weekly:(\d{8}):(\d{8}):ke$/);
  const ending=Date.parse(endDate+'T00:00:00Z');
  const expectedFriday=new Date(ending-6*86400000)
    .toISOString().slice(0,10).replaceAll('-','');
  if(!parts||parts[2]!==endDate.replaceAll('-','')||
    parts[1]!==expectedFriday||new Date(ending).getUTCDay()!==4)
    fail('youtube_target_period_unavailable');
  if(!Array.isArray(native.trackViews))fail('youtube_missing_track_views');
  return {rows:native.trackViews,endDate};
}

// Bind trackViews to its nearest explicit provider period. The previous
// document-wide period search could accept a matching label in unrelated
// metadata and then choose a different week's (larger) chart list.
const YOUTUBE_PERIOD=/^weekly:\d{8}:\d{8}:ke$/;
function youtubeDeclaredPeriod(o) {
  const meta=record(o.metadata);
  const candidates=[o.periodKey,o.period,o.period_key,
    meta?.periodKey,meta?.period,meta?.period_key]
    .filter(x=>typeof x==='string' && YOUTUBE_PERIOD.test(x));
  if(new Set(candidates).size>1)fail('youtube_ambiguous_native_period');
  return candidates[0]??null;
}
function findPeriodBoundTrackViews(payload,target,matches,period=null,depth=0) {
  if(depth>30)fail('youtube_payload_too_deep');
  if(Array.isArray(payload)){
    for(const x of payload)findPeriodBoundTrackViews(x,target,matches,period,depth+1);
    return;
  }
  const o=record(payload);
  if(!o)return;
  const effectivePeriod=youtubeDeclaredPeriod(o)??period;
  if(Array.isArray(o.trackViews) && effectivePeriod===target)
    matches.push(o.trackViews);
  for(const [key,child] of Object.entries(o)){
    if(key==='trackViews'||key==='metadata')continue;
    findPeriodBoundTrackViews(child,target,matches,effectivePeriod,depth+1);
  }
}
/** YouTube weekly Kenya tracks: rank AND native view count, not audio plays. */
export function parseYouTubeKenyaWeekly(raw, targetPeriodKey, access={}) {
  if(typeof targetPeriodKey!=='string'||!YOUTUBE_PERIOD.test(targetPeriodKey)) fail('youtube_invalid_target_period');
  if(!record(raw))fail('youtube_target_period_unavailable');
  const native=youtubeNativeWeeklyTrackViews(raw,targetPeriodKey,access);
  const lists=[];
  if(native)lists.push(native.rows);
  else findPeriodBoundTrackViews(raw,targetPeriodKey,lists);
  // Multiple candidate charts for the same week need an explicit reviewed
  // selector; never arbitrarily choose the largest provider list.
  if(lists.length>1)fail('youtube_ambiguous_weekly_track_views');
  const top=lists[0];
  if(!top)fail('youtube_target_period_unavailable');
  if(!top?.length || top.length>MAX_ROWS) fail('youtube_missing_track_views');
  const rows=top.map((x)=>{
    const v=record(x),meta=record(v?.chartEntryMetadata);
    const rank=positiveInt(meta?.currentPosition);
    if(!rank)fail('youtube_missing_rank');
    const provider_id=text(v.encryptedVideoId,180);
    const count=nonnegativeCount(v.viewCount);
    if(native&&(!provider_id||!ID_RE.test(provider_id)||!text(v.name)))
      fail('youtube_native_row_unverified');
    if(count===null)fail('youtube_missing_native_view_count');
    const artists=arr(v.artists).map(a=>text(record(a)?.name)).filter(Boolean);
    return track(rank,provider_id,text(v.name),artists.join(', ')||null,{view_count:count});
  });
  const result=normalizeRows('youtube_ke',rows,100,{behavior:'video_consumption',metric:'rank_and_count',
    source_period_key:targetPeriodKey,
    ...(native?{provider_period_type:'weekly',provider_week_ending_date:native.endDate}:{}),
    native_period:'unknown'});
  return result;
}