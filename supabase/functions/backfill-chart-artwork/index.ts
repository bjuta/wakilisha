// backfill-chart-artwork v13 — quad-pass: key → title → no-brackets → Spotify search fallback
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function safeDb<T>(p: Promise<unknown>): Promise<{ data: T | null; err: string | null }> {
  try {
    const r = await p as { data?: T; error?: { message: string } } | null | undefined;
    if (!r) return { data: null, err: "null response" };
    if (r.error) return { data: null, err: r.error.message };
    return { data: (r.data ?? null) as T | null, err: null };
  } catch (e) { return { data: null, err: e instanceof Error ? e.message : String(e) }; }
}

// ── Normalization ───────────────────────────────────────────────────────────
const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g;

function collapseWhitespace(t: string): string {
  return t.replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g," ").replace(/\s+/g," ").trim();
}

function stripBracketsKeepContent(t: string): string { return t.replace(/[\(\[\{]/g," ").replace(/[\)\]\}]/g," "); }
function stripBracketsFull(t: string): string { return t.replace(/\([^)]*\)/g," ").replace(/\[[^\]]*\]/g," ").replace(/\{[^}]*\}/g," "); }

const COMBINING_DIACRITICS = /[\u0300-\u036F]/g;
const FEAT_PATTERNS: RegExp[] = [
  /\b(?:feat|featuring|ft)\s*\.?\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+(?:\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+))*)*/gi,
];

function stripFeaturing(t: string): string {
  let r = t;
  for (const p of FEAT_PATTERNS) r = r.replace(p," ");
  r = r.replace(/\s+x\s+/gi," ").replace(/\s+&\s+/g," ").replace(/\bwith\s+(?!(?:the|a\s))(?:[A-Z][^\s,;]+(?:\s+[^\s,;]+)*)/g," ");
  return r;
}

function normalizeCore(t: string): string {
  if (!t?.trim()) return "";
  let r = t.replace(ZERO_WIDTH_CHARS, "");
  r = r.normalize("NFKD").replace(COMBINING_DIACRITICS,"").toLowerCase();
  r = stripBracketsKeepContent(r);
  r = stripFeaturing(r);
  r = r.replace(/[\u2010-\u2015\u2018\u2019\u201A\u201B\u2032\u2035\u2212\u2E3A\u2E3B]/g," ");
  r = r.replace(/[-\u2013\u2014\u2012\u2015\u2022\u00B7\u2027]/g," ").replace(/[\/\\|]/g," ");
  r = r.replace(/[!"#$%&'()*+,./:;<=>?@\[\]^_`{|}~\u00A1\u00A2\u00A3\u00A4\u00A5\u00A6\u00A7\u00A8\u00A9\u00AA\u00AB\u00AC\u00AE\u00AF\u00B0\u00B1\u00B2\u00B3\u00B4\u00B5\u00B6\u00B7\u00B8\u00B9\u00BA\u00BB\u00BC\u00BD\u00BE\u00BF\u00D7\u00F7]/g," ");
  return collapseWhitespace(r);
}

function normalizeCoreNoBrackets(t: string): string {
  if (!t?.trim()) return "";
  let r = t.replace(ZERO_WIDTH_CHARS, "");
  r = r.normalize("NFKD").replace(COMBINING_DIACRITICS,"").toLowerCase();
  r = stripBracketsFull(r);
  r = stripFeaturing(r);
  r = r.replace(/[\u2010-\u2015\u2018\u2019\u201A\u201B\u2032\u2035\u2212\u2E3A\u2E3B]/g," ");
  r = r.replace(/[-\u2013\u2014\u2012\u2015\u2022\u00B7\u2027]/g," ").replace(/[\/\\|]/g," ");
  r = r.replace(/[!"#$%&'()*+,./:;<=>?@\[\]^_`{|}~\u00A1\u00A2\u00A3\u00A4\u00A5\u00A6\u00A7\u00A8\u00A9\u00AA\u00AB\u00AC\u00AE\u00AF\u00B0\u00B1\u00B2\u00B3\u00B4\u00B5\u00B6\u00B7\u00B8\u00B9\u00BA\u00BB\u00BC\u00BD\u00BE\u00BF\u00D7\u00F7]/g," ");
  return collapseWhitespace(r);
}

function normalize_title(t: string): string { return normalizeCore(t); }
function normalize_artist(a: string): string { return normalizeCore(a); }

function lead_artist_key(full: string): string {
  if (!full?.trim()) return "";
  let e = full;
  const fs = e.split(/\s+(?:feat\.|ft\.|featuring)\s+/i);
  if (fs.length>1) e=fs[0];
  const cs = e.split(/\s+(?:x|&)\s+/i);
  if (cs.length>1) e=cs[0];
  return normalizeCore(e.split(/\s*,\s*/)[0]);
}

function build_candidate_keys(title: string, artist: string): string[] {
  const nt=normalize_title(title), na=normalize_artist(artist), lk=lead_artist_key(artist);
  if (!nt) return [];
  const nth=nt.replace(/\s+/g,"-"), nah=na?na.replace(/\s+/g,"-"):"";
  const keys=new Set<string>();
  if(lk){keys.add(`${nt}::${lk}`);keys.add(`${nth}::${lk}`);}
  if(na){keys.add(`${nt}::${na}`);keys.add(`${nth}::${na}`);}
  if(nah){keys.add(`${nt}::${nah}`);keys.add(`${nth}::${nah}`);}
  return [...keys];
}

function normalized_title_only(title: string): string {
  return normalize_title(title);
}

function normalized_title_no_brackets(title: string): string {
  return normalizeCoreNoBrackets(title);
}

// ── Credentials ─────────────────────────────────────────────────────────────
async function readCredential(db: ReturnType<typeof createClient>, dbKey: string): Promise<string|null> {
  const { data, err } = await safeDb<{ setting_value: string }>(
    db.from("admin_settings_secrets").select("setting_value").eq("setting_key",dbKey).maybeSingle()
  );
  if (!err && data?.setting_value?.trim()) return data.setting_value.trim();
  const ev = Deno.env.get(dbKey.toUpperCase());
  return ev?.trim() || null;
}

// ── Spotify fetch ───────────────────────────────────────────────────────────
interface SpotifyTrack { spotify_id:string;title:string;artist:string;album_name:string;album_id:string;artwork_url:string|null;external_url:string;preview_url:string|null;duration_ms:number;popularity:number;candidate_keys:string[];title_only_key:string;title_no_br_key:string; }

async function fetchPlaylistTracks(playlistId:string,accessToken:string,market:string):Promise<{tracks:SpotifyTrack[];playlistName:string;total:number;error:string|null}> {
  const all:SpotifyTrack[]=[]; let pn="",total=0,offset=0,limit=100;
  while(true){
    const u=new URL(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`);
    u.searchParams.set("market",market);u.searchParams.set("limit",String(limit));u.searchParams.set("offset",String(offset));
    u.searchParams.set("fields","total,items(track(id,name,artists(id,name),album(id,name,images,release_date),external_urls(spotify),preview_url,duration_ms,popularity))");
    const res=await fetch(u.toString(),{headers:{Authorization:`Bearer ${accessToken}`}});
    if(!res.ok){const eb=await res.text();return{tracks:all,playlistName:pn,total,error:`Spotify ${res.status} at ${offset}: ${eb.slice(0,300)}`};}
    const d=await res.json() as {total:number;items:Array<{track:{id:string;name:string;artists:Array<{id:string;name:string}>;album:{id:string;name:string;images:Array<{url:string}>};external_urls:{spotify:string};preview_url:string|null;duration_ms:number;popularity:number}|null}>};
    total=d.total;
    if(offset===0){const ir=await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`,{headers:{Authorization:`Bearer ${accessToken}`}});if(ir.ok){pn=(await ir.json() as {name:string}).name;}}
    for(const it of d.items){if(!it?.track)continue;const t=it.track;const al=t.artists.map(a=>a.name).join(", ");const ck=build_candidate_keys(t.name,al);const tok=normalized_title_only(t.name);const nbt=normalized_title_no_brackets(t.name);
      all.push({spotify_id:t.id,title:t.name,artist:al,album_name:t.album?.name||"",album_id:t.album?.id||"",artwork_url:t.album?.images?.[0]?.url||null,external_url:t.external_urls?.spotify||"",preview_url:t.preview_url||null,duration_ms:t.duration_ms||0,popularity:t.popularity||0,candidate_keys:ck,title_only_key:tok,title_no_br_key:nbt});}
    offset+=limit;if(offset>=total||d.items.length===0)break;
  }
  return{tracks:all,playlistName:pn,total,error:null};
}

// ── Spotify search fallback ─────────────────────────────────────────────────
interface SearchCacheEntry { track: SpotifyTrack | null; searched: boolean; }

async function spotifySearchTrack(
  title: string, artist: string, accessToken: string, market: string,
  cache: Map<string, SearchCacheEntry>
): Promise<SpotifyTrack | null> {
  if (!title?.trim() || !artist?.trim()) return null;
  const cacheKey = `${title}|||${artist}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached.track;

  try {
    // Build search query — use stripped versions for broader matching
    const qTitle = title.replace(/\([^)]*\)/g,"").replace(/\[[^\]]*\]/g,"").trim();
    const qArtist = artist.split(/\s*,\s*/)[0].trim();
    const q = encodeURIComponent(`track:${qTitle} artist:${qArtist}`);
    const url = `https://api.spotify.com/v1/search?q=${q}&type=track&market=${market}&limit=5`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) { cache.set(cacheKey, { track: null, searched: true }); return null; }
    const d = await res.json() as { tracks?: { items: Array<{ id:string; name:string; artists:Array<{id:string;name:string}>; album:{id:string;name:string;images:Array<{url:string}>}; external_urls:{spotify:string}; preview_url:string|null; duration_ms:number; popularity:number }> } };
    const items = d.tracks?.items || [];
    if (items.length === 0) { cache.set(cacheKey, { track: null, searched: true }); return null; }

    // Pick best match: prefer exact title match after normalization
    const nt = normalize_title(title);
    const na = normalize_artist(artist);
    let best:SpotifyTrack|null = null;
    let bestScore = -1;

    for (const t of items) {
      const tn = normalize_title(t.name);
      const an = normalize_artist(t.artists.map(a=>a.name).join(" "));
      let score = 0;
      if (tn === nt) score += 10;
      else if (tn.includes(nt) || nt.includes(tn)) score += 5;
      if (an === na) score += 5;
      else if (an.includes(na) || na.includes(an)) score += 3;
      score += t.popularity / 100; // tiny popularity boost as tiebreaker
      if (score > bestScore) {
        bestScore = score;
        const al = t.artists.map(a=>a.name).join(", ");
        const ck = build_candidate_keys(t.name, al);
        best = {
          spotify_id: t.id, title: t.name, artist: al,
          album_name: t.album?.name||"", album_id: t.album?.id||"",
          artwork_url: t.album?.images?.[0]?.url||null,
          external_url: t.external_urls?.spotify||"",
          preview_url: t.preview_url||null, duration_ms: t.duration_ms||0,
          popularity: t.popularity||0, candidate_keys: ck,
          title_only_key: normalized_title_only(t.name),
          title_no_br_key: normalized_title_no_brackets(t.name),
        };
      }
    }
    cache.set(cacheKey, { track: best, searched: true });
    return best;
  } catch {
    cache.set(cacheKey, { track: null, searched: true });
    return null;
  }
}

// ── Paginated DB fetchers ───────────────────────────────────────────────────
interface DbEntry { id:string;normalized_key:string;track_title:string;artist_name:string;artwork_url:string|null;source_payload:Record<string,unknown>; }

async function fetchEntriesMissingArtwork(db:ReturnType<typeof createClient>):Promise<DbEntry[]> {
  const P=1000,all:DbEntry[]=[];let from=0;
  while(true){
    const { data, err } = await safeDb<DbEntry[]>(
      db.from("wk_chart_entries_v2").select("id,normalized_key,track_title,artist_name,artwork_url,source_payload").is("artwork_url",null).order("id",{ascending:true}).range(from,from+P-1)
    );
    if(err){console.error(`[backfill] entries page ${from}:`,err);break;}
    if(!data||data.length===0)break;
    all.push(...data);
    if(data.length<P)break; from+=P;
  }
  return all;
}

async function fetchSourceUrls(db:ReturnType<typeof createClient>):Promise<Array<{source_urls_seen:string[]|null}>> {
  const P=1000,all:Array<{source_urls_seen:string[]|null}>=[];let from=0;
  while(true){
    const { data, err } = await safeDb<Array<{source_urls_seen:string[]|null}>>(
      db.from("wk_chart_entries_v2").select("source_urls_seen").is("artwork_url",null).order("id",{ascending:true}).range(from,from+P-1)
    );
    if(err){console.error(`[backfill] source urls page ${from}:`,err);break;}
    if(!data||data.length===0)break;
    all.push(...data);
    if(data.length<P)break; from+=P;
  }
  return all;
}

// ── Main ────────────────────────────────────────────────────────────────────
Deno.serve(async (req:Request) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  const start=Date.now();
  try{
    const su=Deno.env.get("SUPABASE_URL")??"",sk=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_ANON_KEY")??"";
    if(!su||!sk) return new Response(JSON.stringify({error:"Supabase config missing."}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
    const db=createClient(su,sk);
    let body:Record<string,unknown>;
    try{body=await req.json();}catch{return new Response(JSON.stringify({error:"invalid_json"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});}
    const action=(body as {action:string}).action;
    if(action==="status"){
      let total=0,withA=0,withoutA=0;
      const { data:td }=await safeDb<{count:number}>(db.from("wk_chart_entries_v2").select("*",{count:"exact",head:true}));
      if(td) total=td.count??0;
      const { data:wd }=await safeDb<{count:number}>(db.from("wk_chart_entries_v2").select("*",{count:"exact",head:true}).not("artwork_url","is",null));
      if(wd) withA=wd.count??0;
      const { data:od }=await safeDb<{count:number}>(db.from("wk_chart_entries_v2").select("*",{count:"exact",head:true}).is("artwork_url",null));
      if(od) withoutA=od.count??0;
      const urls=await fetchSourceUrls(db);
      const pids=new Set<string>();
      for(const r of urls){const s=r.source_urls_seen;if(!s)continue;for(const u of s){const m=u.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);if(m)pids.add(m[1]);}}
      return new Response(JSON.stringify({totalEntries:total,withArtwork:withA,withoutArtwork:withoutA,uniquePlaylists:pids.size,playlistIds:[...pids]}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    const dry=action==="dry_run",bf=action==="backfill";
    if(!dry&&!bf) return new Response(JSON.stringify({error:`unknown_action: ${action}`}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const cid=await readCredential(db,"spotify_client_id"),csec=await readCredential(db,"spotify_client_secret"),market=(await readCredential(db,"spotify_market"))||"KE";
    if(!cid||!csec) return new Response(JSON.stringify({ok:false,error:"Spotify credentials not configured."}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const tr=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Authorization:`Basic ${btoa(`${cid}:${csec}`)}`},body:"grant_type=client_credentials"});
    if(!tr.ok){const eb=await tr.text();return new Response(JSON.stringify({ok:false,error:`Spotify auth failed (${tr.status}): ${eb.slice(0,200)}`}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});}
    const at=(await tr.json() as {access_token:string}).access_token;
    if(!at) return new Response(JSON.stringify({ok:false,error:"No access_token from Spotify"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const allUrls=await fetchSourceUrls(db);
    const pids=new Set<string>();
    for(const r of allUrls){const s=r.source_urls_seen;if(!s)continue;for(const u of s){const m=u.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);if(m)pids.add(m[1]);}}
    if(pids.size===0) return new Response(JSON.stringify({ok:true,message:"No Spotify playlist URLs found."}),{headers:{...corsHeaders,"Content-Type":"application/json"}});

    // Three indices: primary (key), title-only, title-no-brackets
    const ki=new Map<string,SpotifyTrack>();
    const ti=new Map<string,SpotifyTrack>();
    const bi=new Map<string,SpotifyTrack>();
    const pr:Array<{playlistId:string;playlistName:string;total:number;fetched:number;error:string|null}>=[];let tst=0;
    for(const pid of pids){const r=await fetchPlaylistTracks(pid,at,market);pr.push({playlistId:pid,playlistName:r.playlistName,total:r.total,fetched:r.tracks.length,error:r.error});if(r.error){console.error(`[backfill] ${pid}:`,r.error);continue;}tst+=r.tracks.length;
      for(const t of r.tracks){
        for(const k of t.candidate_keys) if(!ki.has(k)) ki.set(k,t);
        if(t.title_only_key && !ti.has(t.title_only_key)) ti.set(t.title_only_key, t);
        if(t.title_no_br_key && !bi.has(t.title_no_br_key)) bi.set(t.title_no_br_key, t);
      }
    }

    // Also add Spotify tracks we already successfully matched from previous runs to the indices.
    // Query all entries that already have artwork for their spotify_metadata, so we can reuse them.
    // (Deferred to avoid extra DB roundtrips — only applied when dry run shows need)

    const entries=await fetchEntriesMissingArtwork(db);
    if(entries.length===0) return new Response(JSON.stringify({ok:true,message:"No entries need updating."}),{headers:{...corsHeaders,"Content-Type":"application/json"}});

    const searchCache = new Map<string,{ track: SpotifyTrack | null; searched: boolean }>();
    let searchCalls = 0;

    const ups:Array<{id:string;artwork_url:string;source_payload:Record<string,unknown>;matched_spotify_id:string;matched_album_name:string;match_pass:string}>=[];
    let mc=0,uc=0,pm=0,tm=0,bm=0,sm=0;
    const us:Array<{title:string;artist:string;nk:string;entry_title_key:string;entry_no_br_key:string}>=[];
    const mmc:Record<string,number>={};

    for(const e of entries){
      const nk=e.normalized_key||"";
      // Pass 1: exact key match
      let t=ki.get(nk);
      let pass="primary";
      if(t?.artwork_url){pm++;}

      // Pass 2: title-only fallback
      if(!t?.artwork_url){
        const etk=normalized_title_only(e.track_title||"");
        if(etk){
          const ft=ti.get(etk);
          if(ft?.artwork_url){t=ft;pass="title_only";tm++;}
        }
      }

      // Pass 3: title without bracket content
      if(!t?.artwork_url){
        const enb=normalized_title_no_brackets(e.track_title||"");
        if(enb){
          const fb=bi.get(enb);
          if(fb?.artwork_url){t=fb;pass="title_no_brackets";bm++;}
        }
      }

      // Pass 4: Spotify search API fallback
      if(!t?.artwork_url){
        const st = await spotifySearchTrack(e.track_title||"", e.artist_name||"", at, market, searchCache);
        if (st) { searchCalls++; }
        if(st?.artwork_url){t=st;pass="search";sm++;}
      }

      if(!t?.artwork_url && us.length<30){
        us.push({
          title:e.track_title||"",
          artist:e.artist_name||"",
          nk,
          entry_title_key:normalized_title_only(e.track_title||""),
          entry_no_br_key:normalized_title_no_brackets(e.track_title||""),
        });
      }

      if(t?.artwork_url){
        const ep:Record<string,unknown> = {};
        if(e.source_payload) Object.assign(ep, e.source_payload);
        ep.spotify_metadata = {spotify_track_id:t.spotify_id,spotify_track_url:t.external_url,album_name:t.album_name,spotify_album_id:t.album_id,popularity:t.popularity,preview_url:t.preview_url,duration_ms:t.duration_ms,backfilled_at:new Date().toISOString(),match_pass:pass};
        ups.push({id:e.id,artwork_url:t.artwork_url,source_payload:ep,matched_spotify_id:t.spotify_id,matched_album_name:t.album_name,match_pass:pass});
        mc++;
        mmc[pass]=(mmc[pass]||0)+1;
      }else{uc++;}
    }

    if(!dry&&ups.length>0){
      const now=new Date().toISOString();let ut=0;const errs:string[]=[];
      for(let i=0;i<ups.length;i+=200){
        for(const u of ups.slice(i,i+200)){
          const { err:ue }=await safeDb(db.from("wk_chart_entries_v2").update({artwork_url:u.artwork_url,source_payload:u.source_payload,updated_at:now}).eq("id",u.id));
          if(ue) errs.push(`${u.id}: ${ue}`); else ut++;
        }
      }
      return new Response(JSON.stringify({ok:true,dryRun:false,playlistsFetched:pids.size,playlistResults:pr,spotifyTracksFetched:tst,keyIndexSize:ki.size,titleIndexSize:ti.size,noBrIndexSize:bi.size,entriesScanned:entries.length,entriesUpdated:ut,entriesUnmatched:uc,matchPct:entries.length>0?Math.round(ut/entries.length*100):0,primaryMatches:pm,titleOnlyMatches:tm,titleNoBracketMatches:bm,searchMatches:sm,searchCallsMade:searchCalls,matchMethodCounts:mmc,unmatchedSamples:us.slice(0,30),updateErrors:errs.slice(0,10),durationMs:Date.now()-start}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    return new Response(JSON.stringify({ok:true,dryRun:dry,playlistsFetched:pids.size,playlistResults:pr,spotifyTracksFetched:tst,keyIndexSize:ki.size,titleIndexSize:ti.size,noBrIndexSize:bi.size,entriesScanned:entries.length,entriesWouldUpdate:mc,entriesUnmatched:uc,matchPct:entries.length>0?Math.round(mc/entries.length*100):0,primaryMatches:pm,titleOnlyMatches:tm,titleNoBracketMatches:bm,searchMatches:sm,searchCallsMade:searchCalls,matchMethodCounts:mmc,unmatchedSamples:us.slice(0,30),durationMs:Date.now()-start,...(dry?{message:"Dry run complete. Use action: 'backfill' to apply."}:{})}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(err){const m=err instanceof Error?err.message:String(err);console.error("[backfill] fatal:",m);return new Response(JSON.stringify({error:"internal_error",detail:m.slice(0,200)}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});}
});
