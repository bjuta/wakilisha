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
  return normalizeRows('mdundo_ke',rows,rows.length,{behavior:'consumption',metric:'rank'});
}

/** Audiomack Kenya chart: order of music:song meta elements is observed rank. */
export function parseAudiomackKenya(raw) {
  const html=assertString(raw,'audiomack');
  const count=html.match(/"track_count"\s*:\s*(\d+)/i);
  const declared=count ? positiveInt(count[1]) : null;
  const rows=[];
  for (const hit of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a=attrs(hit[0]);
    if (a.property !== 'music:song') continue;
    const ref=text(a.content,1024);
    if (!ref) fail('audiomack_song_url_missing');
    let u;
    try { u=new URL(ref); } catch { fail('audiomack_invalid_url'); }
    if (u.protocol !== 'https:' || !['audiomack.com','www.audiomack.com'].includes(u.hostname)) fail('audiomack_untrusted_song_origin');
    const id=u.pathname.replace(/^\/+|\/+$/g,'');
    if (!id || !ID_RE.test(id)) fail('audiomack_invalid_song_path');
    rows.push(track(rows.length+1,id,null,null,{provider_url:u.origin+u.pathname}));
  }
  if (!rows.length) fail('audiomack_missing_chart_rows');
  return normalizeRows('audiomack_ke',rows,declared || rows.length,{behavior:'consumption',metric:'rank'});
}

/** Boomplay public chart: rank-preserving ordered /songs/ anchors. */
export function parseBoomplayKenya(raw) {
  const html=assertString(raw,'boomplay');
  const seen=new Set(), rows=[];
  for (const hit of html.matchAll(/<a\b[^>]*>/gi)) {
    const a=attrs(hit[0]);
    const href=text(a.href,1024);
    if (!href) continue;
    const m=href.match(/(?:^|\/)songs\/([A-Za-z0-9_-]+)(?:[?#/]|$)/i);
    if (!m) continue;
    // A repeated anchor for the same recording is a page presentation repeat,
    // not an additional ranked event. Require the officiality/territory check
    // to happen outside this parser.
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      rows.push(track(rows.length+1,m[1]));
    }
  }
  if (!rows.length) fail('boomplay_missing_song_anchors');
  return normalizeRows('boomplay_ke',rows,rows.length,{behavior:'consumption',metric:'rank',officiality:'unverified'});
}

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
  return normalizeRows('shazam_ke',rows,rows.length,{behavior:'discovery',metric:'rank',
    provider_period_label:label,
    provider_snapshot_date:snapshotDate,
    provider_rolling_window_days:snapshotDate?7:null});
}

/**
 * Spotify offered Top 200 export: parser/schema preflight only.
 *
 * Contemporary public examples document these nine columns, but WAKILISHA
 * has NOT yet received an authenticated current Kenya export. This parser
 * deliberately does NOT attest origin, territorial authority, collection
 * permission, native time bounds, or eligibility for the WK100 collector.
 * Do not route its output into runCandidateCapture, source admission or scoring
 * before an actual reviewed KE original and accepted source-method contract.
 */
export function parseSpotifyChartCsvCandidate(raw) {
  const sheet=csvRows(assertString(raw,'spotify').replace(/^\ufeff/,''));
  const header=['rank','uri','artist_names','track_name','source',
    'peak_rank','previous_rank','weeks_on_chart','streams'];
  if(!sheet[0] || sheet[0].length!==header.length ||
    sheet[0].some((v,i)=>v.trim().toLowerCase()!==header[i]))
    fail('spotify_export_schema_unverified');
  const data=sheet.slice(1).filter(c=>c.some(v=>v.trim()));
  if(data.length<1 || data.length>200) fail('spotify_export_depth_invalid');
  const rows=data.map(c=>{
    const uri=c[1]?.trim();
    if(c.length!==header.length ||
      !/^spotify:track:[A-Za-z0-9]{22}$/.test(uri??'') ||
      !text(c[2]) || !text(c[3]))
      fail('spotify_export_row_invalid');
    const rank=positiveInt(c[0]?.trim());
    const streams=nonnegativeCount(c[8]?.trim());
    if(rank===null || streams===null) fail('spotify_export_row_invalid');
    return track(rank,uri.slice('spotify:track:'.length),
      text(c[3]),text(c[2]),{chart_eligible_stream_count:streams});
  });
  // Source body has no independent Kenya/weekly-period attestation.
  // Spotify's chart-eligible streams are NOT YouTube view_count.
  return normalizeRows('spotify_chart_csv_candidate',rows,rows.length,{
    market:'unverified',behavior:'consumption',
    metric:'rank_plus_spotify_chart_eligible_streams',
    chart_surface:'spotify_offered_csv_candidate',native_period:'unknown',
    source_admitted:false,can_collect:false,can_score:false,can_publish:false,
  });
}

/**
 * Spotify weekly Kenya candidate decoder for the EXISTING governed collector.
 *
 * The provider's nine-column offered export carries chart-eligible streams,
 * NOT YouTube views. The CSV carries neither an independently provable
 * country nor source-native week boundaries. A successful decode therefore
 * cannot admit an endpoint, authenticate a Kenya chart, infer a UTC week,
 * score an Edition or allow a fetch. Those remain separate reviewed,
 * server-side source-method/manifest duties. Do not use playlists as a
 * substitute for Spotify's official regional weekly chart.
 */
export function parseSpotifyKenyaWeeklyCandidate(raw) {
  const provisional=parseSpotifyChartCsvCandidate(raw);
  if(provisional.market!=='unverified' ||
     provisional.source_admitted!==false ||
     provisional.native_period!=='unknown' ||
     provisional.eligible_for_scoring!==false)
    fail('spotify_candidate_preflight_invalid');
  return normalizeRows('spotify_ke',provisional.rows,provisional.rows.length,{
    market:'KE',behavior:'consumption',metric:'rank_and_count',
    chart_surface:'unverified_offered_csv',
    source_market_authority:'external_method_review_required',
    source_period_authority:'unknown',
    source_admitted:false,can_collect:false,can_score:false,can_publish:false,
  });
}

/**
 * Apple Kenya native charts. Two distinct public chart schemas are supported:
 * the historical country-bearing RSS feed and the MusicKit catalog charts API.
 * The API payload has no trustworthy storefront field; its territory must be
 * bound to the exact independently approved request endpoint by the caller.
 * Neither schema asserts a seven-day native measurement period or play count.
 */
export function parseAppleKenya(raw,access={}) {
  const o=record(raw);
  const feed=record(o?.feed);
  if (feed) {
    const results=arr(feed.results);
    if (!results.length || results.length>MAX_ROWS) fail('apple_invalid_feed');
    if (text(feed.country)?.toUpperCase() !== 'KE') fail('apple_territory_unverified');
    const rows=results.map((value,i)=>{
      const v=record(value),id=text(v?.id,180);
      if (!id || !ID_RE.test(id)) fail('apple_invalid_track_id');
      return track(i+1,id,text(v.name),text(v.artistName),{artist_provider_id:text(v.artistId,180)});
    });
    return normalizeRows('apple_ke',rows,results.length,{behavior:'consumption',metric:'rank',
      provider_updated_at:text(feed.updated,120),chart_surface:'apple_rss_most_played'});
  }

  // An empty or unrelated response is not an Apple chart at all.
  // Preserve the established fail-closed invalid-feed contract first.
  if (!record(o?.results) || !Array.isArray(o.results.songs)) fail('apple_invalid_feed');

  // The Apple Music API response is only valid when the approved source
  // manifest binds its exact Kenya /charts request. A client-supplied JSON
  // "country" property or an Apple US endpoint cannot supply that authority.
  let endpoint;
  try { endpoint=new URL(access?.endpoint); } catch { fail('apple_chart_endpoint_unverified'); }
  if(endpoint.protocol!=='https:' || endpoint.hostname!=='api.music.apple.com' ||
    endpoint.port || endpoint.username || endpoint.password || endpoint.hash ||
    endpoint.pathname!=='/v1/catalog/ke/charts' ||
    endpoint.searchParams.get('types')!=='songs' ||
    endpoint.searchParams.get('chart')!=='most-played' ||
    [...endpoint.searchParams.keys()].some(k=>!['types','chart','limit'].includes(k)) ||
    new Set(endpoint.searchParams.keys()).size!==[...endpoint.searchParams.keys()].length) {
    fail('apple_chart_endpoint_unverified');
  }
  const limit=endpoint.searchParams.get('limit');
  if(limit!==null && (!/^\d{1,3}$/.test(limit) || Number(limit)<1 || Number(limit)>200))
    fail('apple_chart_endpoint_unverified');
  const charts=arr(record(o?.results)?.songs);
  if(charts.length!==1 || charts[0]?.chart!=='most-played')
    fail('apple_invalid_chart_response');
  const items=arr(charts[0]?.data);
  if(!items.length || items.length>MAX_ROWS || (limit!==null && items.length>Number(limit)))
    fail('apple_invalid_chart_response');
  const rows=items.map((item,i)=>{
    const v=record(item),attributes=record(v?.attributes);
    const id=text(v?.id,180);
    if(v?.type!=='songs' || !id || !ID_RE.test(id) ||
      !text(attributes?.name) || !text(attributes?.artistName))
      fail('apple_invalid_chart_item');
    return track(i+1,id,text(attributes.name),text(attributes.artistName));
  });
  return normalizeRows('apple_ke',rows,items.length,{
    behavior:'consumption',metric:'rank',chart_surface:'apple_music_api_most_played',
  });
}

/**
 * Apple Music's FREE, public Kenya Top 100 page, not the developer-token API.
 * Its HTML is independently provider URL-bound and cross-checks 100 ordered
 * music:song / music:song:track meta tags against a MusicPlaylist JSON-LD.
 * The chart is updated daily; no weekly play counts or period boundaries
 * are inferred from a webpage retrieval time.
 */
export const WK100_APPLE_KE_PUBLIC_CHART_URL =
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
  if(access?.endpoint!==WK100_APPLE_KE_PUBLIC_CHART_URL)
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
export function parseYouTubeKenyaWeekly(raw, targetPeriodKey) {
  if(typeof targetPeriodKey!=='string'||!YOUTUBE_PERIOD.test(targetPeriodKey)) fail('youtube_invalid_target_period');
  if(!record(raw))fail('youtube_target_period_unavailable');
  const lists=[];
  findPeriodBoundTrackViews(raw,targetPeriodKey,lists);
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
    if(count===null)fail('youtube_missing_native_view_count');
    const artists=arr(v.artists).map(a=>text(record(a)?.name)).filter(Boolean);
    return track(rank,provider_id,text(v.name),artists.join(', ')||null,{view_count:count});
  });
  const result=normalizeRows('youtube_ke',rows,top.length,{behavior:'video_consumption',metric:'rank_and_count',
    source_period_key:targetPeriodKey});
  return result;
}
