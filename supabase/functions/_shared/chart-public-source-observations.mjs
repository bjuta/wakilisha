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

/** Shazam CSV: identifications/discovery, NEVER equivalent to streams. */
export function parseShazamKenya(raw) {
  const csv=assertString(raw,'shazam').replace(/^\ufeff/,'');
  const sheet=csvRows(csv);
  const h=sheet.findIndex(r=>r[0]?.trim()==='Rank' && r[1]?.trim()==='Artist' && r[2]?.trim()==='Title');
  if (h<0) fail('shazam_missing_header');
  const rows=[];
  for (const cols of sheet.slice(h+1)) {
    if (!cols[0]?.trim()) continue;
    const rank=positiveInt(cols[0].trim());
    if (cols.length!==3 || !rank || !text(cols[1]) || !text(cols[2])) fail('shazam_invalid_chart_row');
    rows.push(track(rank,null,text(cols[2]),text(cols[1])));
  }
  if (!rows.length) fail('shazam_missing_chart_rows');
  return normalizeRows('shazam_ke',rows,rows.length,{behavior:'discovery',metric:'rank',
    provider_period_label:text(sheet?.[1]?.[0],300)});
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

function findTrackViews(payload, matches, depth=0) {
  if (depth>30) fail('youtube_payload_too_deep');
  if (Array.isArray(payload)) {for (const x of payload) findTrackViews(x,matches,depth+1);return;}
  const o=record(payload);
  if (!o) return;
  for (const [key,x] of Object.entries(o)) {
    if (key==='trackViews' && Array.isArray(x)) matches.push(x);
    if (key!=='trackViews') findTrackViews(x,matches,depth+1);
  }
}
function includesValue(payload, target, depth=0) {
  if(depth>30)return false;
  if(typeof payload==='string')return payload===target;
  if(Array.isArray(payload))return payload.some(v=>includesValue(v,target,depth+1));
  const o=record(payload);
  return o?Object.values(o).some(v=>includesValue(v,target,depth+1)):false;
}
/** YouTube weekly Kenya tracks: rank AND native view count, not audio plays. */
export function parseYouTubeKenyaWeekly(raw, targetPeriodKey) {
  if(typeof targetPeriodKey!=='string'||!/^weekly:\d{8}:\d{8}:ke$/.test(targetPeriodKey)) fail('youtube_invalid_target_period');
  if(!record(raw) || !includesValue(raw,targetPeriodKey)) fail('youtube_target_period_unavailable');
  const lists=[];
  findTrackViews(raw,lists);
  const top=lists.sort((a,b)=>b.length-a.length)[0];
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
