import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = ["https://wakilisha.africa","https://www.wakilisha.africa","https://staging.wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","http://localhost:5173","http://localhost:3000"];
function corsR(req: Request, methods="GET, POST, OPTIONS"): Record<string,string> { const o=req.headers.get("Origin")??""; const isR=o.endsWith(".wakilisha.africa")||o==="https://wakilisha.africa"; const ao=ALLOWED_ORIGINS.includes(o)||isR?o:ALLOWED_ORIGINS[0]; return {"Access-Control-Allow-Origin":ao,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":methods,"Vary":"Origin"}; }
async function vJwt(req: Request): Promise<{id:string;email?:string}|null> { const ah=req.headers.get("Authorization"); if(!ah||!ah.startsWith("Bearer ")) return null; const t=ah.replace("Bearer ",""); const uc=createClient(SUPABASE_URL,SERVICE_KEY,{global:{headers:{Authorization:`Bearer ${t}`}}}); const {data:{user},error}=await uc.auth.getUser(t); if(error||!user) return null; return {id:user.id,email:user.email}; }
async function rCap(userId: string, cap: string): Promise<boolean> { const c=createClient(SUPABASE_URL,SERVICE_KEY); const {data:roles}=await c.from("user_role_assignments").select("role_key, role_definitions!inner(role_capabilities(capability_key))").eq("user_id",userId).eq("status","active").or("expires_at.is.null,expires_at.gt.now()"); if(!roles||roles.length===0) return false; if(roles.some((r:{role_key:string})=>r.role_key==="administrator")) return true; const all=new Set<string>(); for(const r of roles){const caps=(r.role_definitions as {role_capabilities?:Array<{capability_key:string}>}|null)?.role_capabilities??[];for(const c of caps)all.add(c.capability_key);} return all.has(cap); }
function jRaw(data:unknown,cors:Record<string,string>,s=200):Response{return new Response(JSON.stringify(data),{status:s,headers:{...cors,"Content-Type":"application/json"}});}
async function rCred(envVar:string,dbKey:string,db?:ReturnType<typeof createClient>):Promise<string|null>{const ev=Deno.env.get(envVar);if(ev&&ev.trim())return ev.trim();if(!db)return null;try{const{data:row}=await db.from("admin_settings_secrets").select("setting_value").eq("setting_key",dbKey).maybeSingle();if(row&&(row.setting_value as string)?.trim())return(row.setting_value as string).trim();}catch{return null;}return null;}
function slugify(s:string):string{return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,160);}
async function cAJWT(pk:string,tid:string,kid:string):Promise<string>{const pem=pk.replace("-----BEGIN PRIVATE KEY-----","").replace("-----END PRIVATE KEY-----","").replace(/\s/g,"");const bin=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey("pkcs8",bin,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);const h={alg:"ES256",kid};const ns=Math.floor(Date.now()/1000);const pl={iss:tid,iat:ns,exp:ns+3600};const enc=new TextEncoder();const b64u=(s:string)=>s.replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");const hb=b64u(btoa(JSON.stringify(h))),pb=b64u(btoa(JSON.stringify(pl))),si=hb+"."+pb;const sig=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,enc.encode(si));const sb=b64u(btoa(String.fromCharCode(...new Uint8Array(sig))));return si+"."+sb;}
interface AArt { url: string; }
interface ASHit { id: string; type: string; attributes?: { name?: string; artistName?: string; artwork?: AArt; releaseDate?: string; genreNames?: string[]; recordLabel?: string; isrc?: string; trackNumber?: number; durationInMillis?: number; playParams?: { id?: string }; previews?: Array<{ url: string }>; trackCount?: number; }; relationships?: { tracks?: { data: Array<{ id: string; attributes?: Record<string,unknown> }> }; }; }
function aUrl(aw: AArt|undefined|null, w: number): string|null { if(!aw?.url) return null; return aw.url.replace("{w}",String(w)).replace("{h}",String(w)); }
const TS = ["canonicalized","rejected"];

async function getAC(db:ReturnType<typeof createClient>):Promise<{token:string}|{error:string}>{
  const pk=await rCred("APPLE_MUSIC_PRIVATE_KEY","apple_music_private_key",db);
  const tid=await rCred("APPLE_TEAM_ID","apple_music_team_id",db);
  const kid=await rCred("APPLE_MUSIC_KEY_ID","apple_music_key_id",db);
  if(!pk||!tid||!kid) return {error:"Apple Music credentials not configured."};
  try{return{token:await cAJWT(pk,tid,kid)};}catch(e){return{error:"JWT failed: "+(e instanceof Error?e.message:String(e))};}
}
async function fAlbum(token:string,pid:string,sf:string):Promise<{album:ASHit|null;error:string|null}>{
  const apiUrl="https://api.music.apple.com/v1/catalog/"+sf+"/albums/"+pid+"?include=artists,tracks";
  const res=await fetch(apiUrl,{headers:{Authorization:"Bearer "+token}});
  if(!res.ok){const t=await res.text();return{album:null,error:"Apple Music API "+res.status+": "+t.slice(0,300)};}
  const raw=await res.json() as {data:ASHit[]};
  return {album:raw.data?.[0]||null,error:null};
}
function eTracks(album:ASHit,albumArtist:string,artwork:string|null){
  return (album.relationships?.tracks?.data||[]).map(t=>({
    id:t.id, title:(t.attributes?.name as string)||"Untitled",
    artistName:(t.attributes?.artistName as string)||albumArtist,
    trackNumber:(t.attributes?.trackNumber as number|null)??null,
    durationMs:(t.attributes?.durationInMillis as number|null)||null,
    isrc:(t.attributes?.isrc as string)||null,
    artworkUrl:aUrl(t.attributes?.artwork as AArt|undefined,300)||artwork,
    previewUrl:((t.attributes?.previews as Array<{url:string}>|undefined)?.[0]?.url)||null,
  }));
}

Deno.serve(async (req) => {
  const cors = corsR(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = await vJwt(req);
  if (!auth) return jRaw({ error: "Missing or invalid token" }, cors, 401);
  const canAccess = await rCap(auth.id, "manage_registry");
  if (!canAccess) return jRaw({ error: "Missing capability: manage_registry" }, cors, 403);
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { body = {}; }
  const route = (body.route as string) || "";
  const now = new Date().toISOString();

  try {
    if (route === "search") {
      const sf=(body.storefront as string)||"ke"; const q=(body.query as string)||(body.q as string)||""; const et=(body.entityType as string)||"all"; const lim=Math.min(Number(body.limit)||25,50);
      if(!q.trim()) return jRaw({error:"Missing query parameter"},cors,400);
      const creds=await getAC(db); if("error" in creds) return jRaw({provider:"apple_music",query:q,storefrontOrMarket:sf,groups:{artists:[],releases:[],tracks:[],labels:[]},rawResultCount:0,normalizedResultCount:0,error:creds.error},cors);
      const types=et==="all"?["artists","albums","songs"]:et==="release"?["albums"]:et==="track"?["songs"]:et==="artist"?["artists"]:[et];
      const api="https://api.music.apple.com/v1/catalog/"+sf+"/search?term="+encodeURIComponent(q)+"&types="+types.join(",")+"&limit="+lim;
      const res=await fetch(api,{headers:{Authorization:"Bearer "+creds.token}});
      if(!res.ok){const t=await res.text();return jRaw({provider:"apple_music",query:q,storefrontOrMarket:sf,groups:{artists:[],releases:[],tracks:[],labels:[]},rawResultCount:0,normalizedResultCount:0,error:"Apple Music API "+res.status},cors);}
      const data=await res.json() as {results?:Record<string,{data:ASHit[]}>}; const rg=data.results||{};
      const fmtHit=(h:ASHit)=>({provider:"apple_music",providerEntityId:h.id,title:h.attributes?.name||"",artistDisplayName:h.attributes?.artistName||null,artworkUrl:aUrl(h.attributes?.artwork,300),confidenceScore:0.95});
      return jRaw({provider:"apple_music",query:q,storefrontOrMarket:sf,groups:{artists:(rg.artists?.data||[]).map(fmtHit),releases:(rg.albums?.data||[]).map(fmtHit),tracks:(rg.songs?.data||[]).map(fmtHit),labels:[]},rawResultCount:(rg.artists?.data||[]).length+(rg.albums?.data||[]).length+(rg.songs?.data||[]).length},cors);
    }
    if (route === "inspect") {
      const pet=(body.providerEntityType as string)||"release"; const pid=(body.providerEntityId as string)||""; const sf=(body.storefront as string)||"ke";
      if(!pid) return jRaw({error:"Missing providerEntityId"},cors,400);
      const creds=await getAC(db); if("error" in creds) return jRaw({error:creds.error},cors,400);
      const at=pet==="release"?"albums":"songs";
      const api="https://api.music.apple.com/v1/catalog/"+sf+"/"+at+"/"+pid+"?include=artists,tracks";
      const res=await fetch(api,{headers:{Authorization:"Bearer "+creds.token}});
      if(!res.ok){const t=await res.text();return jRaw({error:"Apple Music API "+res.status+": "+t.slice(0,300)},cors,500);}
      const raw=await res.json() as {data:ASHit[]}; const md=raw.data?.[0]; if(!md) return jRaw({error:"Entity not found"},cors,404);
      const attrs=md.attributes || {}; const title=attrs.name||""; const ad=attrs.artistName||null; const aw=aUrl(attrs.artwork,600);
      const rs={provider:"apple_music",providerEntityType:pet,providerEntityId:pid,title,artistDisplayName:ad,artworkUrl:aw,confidenceScore:0.95,source:{storefrontOrMarket:sf,fetchedAt:now}};
      const tr=(md.relationships?.tracks?.data||[]).map(r=>({providerEntityType:"track",providerEntityId:r.id,title:(r.attributes?.name as string)||"Unknown",artistDisplayName:(r.attributes?.artistName as string)||null,artworkUrl:aUrl(r.attributes?.artwork as AArt|undefined,300),isrc:(r.attributes?.isrc as string)||null,previewUrl:((r.attributes?.previews as Array<{url:string}>|undefined)?.[0]?.url)||null}));
      const {data:sl}=await db.from("provider_entity_links").select("registry_entity_id").eq("provider","apple_music").eq("provider_entity_id",pid).eq("registry_entity_type",pet);
      const sids=(sl||[]).map(l=>l.registry_entity_id as string);
      const {data:shs}=sids.length>0?await db.from("registry_release_shells").select("id,slug,title,status").in("id",sids):{data:[]};
      return jRaw({result:rs,tracks:tr,existingShells:(shs||[]).map(s=>({shellKey:s.id,title:s.title,status:s.status}))},cors);
    }
    if (route === "test-connection") {
      const creds=await getAC(db);
      if("error" in creds) return jRaw({provider:"apple_music",storefront:(body.storefront as string)||"ke",status:"failed",error:creds.error,testedAt:now},cors);
      const start=Date.now();
      const res=await fetch("https://api.music.apple.com/v1/catalog/"+((body.storefront as string)||"ke")+"/search?term=test&types=artists&limit=1",{headers:{Authorization:"Bearer "+creds.token}});
      return jRaw({provider:"apple_music",storefront:(body.storefront as string)||"ke",status:res.ok?"connected":"failed",latencyMs:Date.now()-start,testedAt:now},cors);
    }
    if (route === "create-shell") {
      const pid=(body.providerEntityId as string)||""; const sf=(body.storefrontOrMarket as string)||(body.storefront as string)||"ke"; const stids=(body.selectedTrackIds as string[])||[];
      if(!pid) return jRaw({error:"Missing providerEntityId"},cors);
      const creds=await getAC(db); if("error" in creds) return jRaw({error:creds.error},cors);
      const{album,error:fe}=await fAlbum(creds.token,pid,sf); if(fe||!album) return jRaw({error:fe||"Album not found"},cors);
      const attrs=album.attributes || {}; const title=attrs.name||"Untitled"; const artist=attrs.artistName||"Unknown Artist"; const aw=aUrl(attrs.artwork,600); const rd=attrs.releaseDate||null; const gn=attrs.genreNames||[]; const rl=attrs.recordLabel||null; const upc=attrs.playParams?.id||null;
      const tracks=eTracks(album,artist,aw); const st=stids.length>0?tracks.filter(tr=>stids.includes(tr.id)):[...tracks]; if(st.length===0&&tracks.length>0) st.push(...tracks);
      const asl=slugify(artist); let ps=asl,pn=artist; const{data:ra}=await db.from("registry_artists").select("slug,display_name").eq("slug",asl).in("status",["active","draft"]).maybeSingle(); if(ra){ps=ra.slug as string;pn=ra.display_name as string;}
      const cs=ps+"--"+slugify(title);
      const{data:el}=await db.from("provider_entity_links").select("registry_entity_id").eq("provider","apple_music").eq("provider_entity_id",pid).limit(1); if(el&&el.length>0) return jRaw({error:"A release shell already exists.",existingShellKey:el[0].registry_entity_id},cors);
      const rid=crypto.randomUUID(); let mer=false; const{data:exRel}=await db.from("registry_releases").select("id,slug").eq("slug",cs).maybeSingle();
      if(exRel){mer=true;} else {const{error:re}=await db.from("registry_releases").insert({id:rid,slug:cs,title,normalized_title:title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""),status:"draft",metadata:{},release_date:rd,artwork_url:aw,upc,created_at:now,updated_at:now});if(re) return jRaw({error:"Failed to create release: "+re.message},cors);}
      const sid=crypto.randomUUID(); const{error:se}=await db.from("registry_release_shells").insert({id:sid,release_id:rid,slug:cs,title,primary_artist_name:pn,primary_artist_slug:ps,release_date:rd,track_count:st.length,has_artwork:!!aw,tracks:st,status:"draft",readiness:"draft",generated_by:"provider_intake_api",source_provenance:{provider:"apple_music",provider_entity_id:pid,artist_name:artist,genre_names:gn,record_label:rl,upc,artwork_url:aw,track_count:st.length,ingested_at:now,matched_existing_release:mer},last_generated_at:now,created_at:now,updated_at:now});
      if(se) return jRaw({error:"Failed to create shell: "+se.message},cors);
      await db.from("provider_entity_links").insert({id:crypto.randomUUID(),provider:"apple_music",provider_entity_id:pid,registry_entity_type:"release",registry_entity_id:sid,confidence_score:1.0,match_status:"confirmed",created_at:now,updated_at:now});
      return jRaw({shell:{shellKey:sid,registryEntityId:sid,status:"draft"},mode:"create",matchedExistingRelease:mer,slug:{scoped:cs,artistSlug:ps,artistName:pn},release:{id:rid,slug:cs,createdNew:!mer}},cors);
    }
    if (route === "refresh-shell") {
      const pid=(body.providerEntityId as string)||""; const sf=(body.storefrontOrMarket as string)||(body.storefront as string)||"ke"; const stids=(body.selectedTrackIds as string[])||[];
      if(!pid) return jRaw({error:"Missing providerEntityId"},cors);
      const{data:el}=await db.from("provider_entity_links").select("registry_entity_id").eq("provider","apple_music").eq("provider_entity_id",pid).limit(1); if(!el||el.length===0) return jRaw({error:"No existing shell found. Use create instead."},cors);
      const sid=el[0].registry_entity_id as string; const{data:es}=await db.from("registry_release_shells").select("id,slug,release_id,status,source_provenance").eq("id",sid).maybeSingle(); if(!es) return jRaw({error:"Shell not found."},cors);
      if(TS.includes(es.status as string)) return jRaw({shell:{shellKey:sid,status:es.status},mode:"refresh-skipped"},cors);
      const creds=await getAC(db); if("error" in creds) return jRaw({error:creds.error},cors);
      const{album,error:fe}=await fAlbum(creds.token,pid,sf); if(fe||!album) return jRaw({error:fe||"Album not found"},cors);
      const attrs=album.attributes || {}; const title=attrs.name||"Untitled"; const artist=attrs.artistName||"Unknown Artist"; const aw=aUrl(attrs.artwork,600); const rd=attrs.releaseDate||null;
      const tracks=eTracks(album,artist,aw); const st=stids.length>0?tracks.filter(tr=>stids.includes(tr.id)):[...tracks]; if(st.length===0&&tracks.length>0) st.push(...tracks);
      const asl=slugify(artist); let ps=asl,pn=artist; const{data:ra}=await db.from("registry_artists").select("slug,display_name").eq("slug",asl).in("status",["active","draft"]).maybeSingle(); if(ra){ps=ra.slug as string;pn=ra.display_name as string;}
      const upd={title,primary_artist_name:pn,primary_artist_slug:ps,release_date:rd,track_count:st.length,has_artwork:!!aw,tracks:st,status:"draft",readiness:"draft",source_provenance:{provider:"apple_music",provider_entity_id:pid,artist_name:artist,track_count:st.length,refreshed_at:now,ingested_at:(es.source_provenance as Record<string,unknown>)?.ingested_at||now},last_generated_at:now,updated_at:now};
      const{error:ue}=await db.from("registry_release_shells").update(upd).eq("id",sid); if(ue) return jRaw({error:"Failed to refresh: "+ue.message},cors);
      const rid=es.release_id as string; await db.from("registry_releases").update({title,release_date:rd,artwork_url:aw,updated_at:now}).eq("id",rid).eq("status","draft");
      return jRaw({shell:{shellKey:sid,status:"draft"},mode:"refresh",slug:{scoped:es.slug,artistSlug:ps,artistName:pn},release:{id:rid,slug:es.slug,createdNew:false},diag:{tracksFetched:tracks.length,tracksSelected:st.length}},cors);
    }
    return jRaw({ error: "Unknown route: " + (route || "none") }, cors);
  } catch (err) {
    console.error("[provider-intake-api]", err instanceof Error ? err.message : String(err));
    return jRaw({ error: "Internal error" }, cors, 500);
  }
});
