// ── SHARED BLOCK (Phase A) ──
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = ["https://wakilisha.africa","https://www.wakilisha.africa","https://staging.wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","http://localhost:5173","http://localhost:3000"];

function corsOpen(): Record<string,string> { return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"}; }
function corsOpenWrite(): Record<string,string> { return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, PATCH, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"}; }
function corsRestricted(req: Request, methods="GET, POST, OPTIONS"): Record<string,string> { const o=req.headers.get("Origin")??""; const isR=o.endsWith(".wakilisha.africa")||o==="https://wakilisha.africa"; const ao=ALLOWED_ORIGINS.includes(o)||isR?o:ALLOWED_ORIGINS[0]; return {"Access-Control-Allow-Origin":ao,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":methods,"Vary":"Origin"}; }

async function verifyJwt(req: Request): Promise<{id:string;email?:string}|null> { const ah=req.headers.get("Authorization"); if(!ah||!ah.startsWith("Bearer ")) return null; const t=ah.replace("Bearer ",""); const uc=createClient(SUPABASE_URL,SERVICE_KEY,{global:{headers:{Authorization:`Bearer ${t}`}}}); const {data:{user},error}=await uc.auth.getUser(t); if(error||!user) return null; return {id:user.id,email:user.email}; }

async function requireCap(userId: string, cap: string, db?: ReturnType<typeof createClient>): Promise<boolean> { const c=db??createClient(SUPABASE_URL,SERVICE_KEY); const {data:roles}=await c.from("user_role_assignments").select("role_key, role_definitions!inner(role_capabilities(capability_key))").eq("user_id",userId).eq("status","active").or("expires_at.is.null,expires_at.gt.now()"); if(!roles||roles.length===0) return false; if(roles.some((r:{role_key:string})=>r.role_key==="administrator")) return true; const all=new Set<string>(); for(const r of roles){const caps=(r.role_definitions as {role_capabilities?:Array<{capability_key:string}>}|null)?.role_capabilities??[];for(const c of caps)all.add(c.capability_key);} return all.has(cap); }

const rid=()=>crypto.randomUUID().slice(0,12);
const iso=()=>new Date().toISOString();
function jsonOk(data:unknown,cors:Record<string,string>,s=200):Response{return new Response(JSON.stringify({ok:true,data,meta:{requestId:rid(),servedAt:iso(),version:"1.0.0"}}),{status:s,headers:{...cors,"Content-Type":"application/json"}});}
function jsonErr(code:string,msg:string,cors:Record<string,string>,s=400,detail?:string):Response{return new Response(JSON.stringify({ok:false,error:{code,message:msg,...(detail?{detail}:{})},meta:{requestId:rid(),servedAt:iso(),version:"1.0.0"}}),{status:s,headers:{...cors,"Content-Type":"application/json"}});}
function jsonRaw(data:unknown,cors:Record<string,string>,s=200):Response{return new Response(JSON.stringify(data),{status:s,headers:{...cors,"Content-Type":"application/json"}});}

async function readCred(envVar:string,dbKey:string,db?:ReturnType<typeof createClient>):Promise<string|null>{const ev=Deno.env.get(envVar);if(ev&&ev.trim())return ev.trim();if(!db)return null;try{const{data:row}=await db.from("admin_settings_secrets").select("setting_value").eq("setting_key",dbKey).maybeSingle();if(row&&(row.setting_value as string)?.trim())return(row.setting_value as string).trim();}catch{/*ignore*/}return null;}

function slugify(s:string):string{return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,160);}
function normalizeArtistName(n:string):string{return n.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0].split(/\s*,\s*/)[0].trim();}
function normalizeIso2(raw:string):string{const u=raw.toUpperCase();const f:Record<string,string>={KENYA:"KE",HAITI:"HT",UK:"GB",CANADA:"CA",USA:"US",FRANCE:"FR",GERMANY:"DE",NIGERIA:"NG",TANZANIA:"TZ",UGANDA:"UG",GHANA:"GH"};return f[u]||u;}
function sanitizeDate(raw:string|null|undefined):string|null{if(!raw||!raw.trim())return null;const r=raw.trim();if(/^\d{4}-\d{2}-\d{2}$/.test(r))return r;if(/^\d{4}-\d{2}$/.test(r))return r+"-01";if(/^\d{4}$/.test(r))return r+"-01-01";try{const d=new Date(r);if(!Number.isNaN(d.getTime()))return d.toISOString().split("T")[0];}catch{/*ignore*/}return null;}

async function writeAudit(p:{actorId:string;actorLabel?:string;action:string;newStatus?:string;payload?:Record<string,unknown>;runId?:string}):Promise<void>{try{const db2=createClient(SUPABASE_URL,SERVICE_KEY);await db2.from("chart_ingest_audit_events").insert({run_id:p.runId??null,actor:p.actorId,actor_email:p.actorLabel??null,action:p.action,new_status:p.newStatus??null,payload_json:p.payload??{},created_at:iso()});}catch(e){console.error("[audit]",e instanceof Error?e.message:String(e));}}

async function createAppleJWT(pk:string,tid:string,kid:string):Promise<string>{const pem=pk.replace("-----BEGIN PRIVATE KEY-----","").replace("-----END PRIVATE KEY-----","").replace(/\s/g,"");const bin=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey("pkcs8",bin,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);const h={alg:"ES256",kid};const ns=Math.floor(Date.now()/1000);const pl={iss:tid,iat:ns,exp:ns+3600};const enc=new TextEncoder();const b64u=(s:string)=>s.replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");const hb=b64u(btoa(JSON.stringify(h))),pb=b64u(btoa(JSON.stringify(pl))),si=hb+"."+pb;const sig=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,enc.encode(si));const sb=b64u(btoa(String.fromCharCode(...new Uint8Array(sig))));return si+"."+sb;}
// ── END SHARED BLOCK ──

const PROVIDER_SECRET_KEYS: Record<string, string[]> = {
  spotify: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_MARKET"],
  apple_music: ["APPLE_MUSIC_TEAM_ID", "APPLE_MUSIC_KEY_ID", "APPLE_MUSIC_PRIVATE_KEY", "APPLE_MUSIC_STOREFRONT", "APPLE_MUSIC_SERVICE_ID", "APPLE_MUSIC_TOKEN_TTL"],
  acrcloud: ["ACR_HOST", "ACR_ACCESS_KEY", "ACR_ACCESS_SECRET", "ACR_CALLBACK_SECRET"],
  youtube: ["YOUTUBE_API_KEY"],
  airplay: ["AIRPLAY_API_BASE", "AIRPLAY_API_KEY"],
};

const DB_KEY_PREFIX: Record<string, string> = {
  SPOTIFY_CLIENT_ID: "spotify_client_id", SPOTIFY_CLIENT_SECRET: "spotify_client_secret", SPOTIFY_MARKET: "spotify_market",
  APPLE_MUSIC_TEAM_ID: "apple_music_team_id", APPLE_MUSIC_KEY_ID: "apple_music_key_id", APPLE_MUSIC_STOREFRONT: "apple_music_storefront",
  APPLE_MUSIC_PRIVATE_KEY: "apple_music_private_key", APPLE_MUSIC_SERVICE_ID: "apple_music_service_id", APPLE_MUSIC_TOKEN_TTL: "apple_music_token_ttl",
  ACR_HOST: "acr_host", ACR_ACCESS_KEY: "acr_access_key", ACR_ACCESS_SECRET: "acr_access_secret", ACR_CALLBACK_SECRET: "acr_callback_secret",
  YOUTUBE_API_KEY: "youtube_api_key", AIRPLAY_API_BASE: "airplay_api_base", AIRPLAY_API_KEY: "airplay_api_key",
};

async function acrcloudSign(accessKey: string, accessSecret: string, method: string, host: string, uri: string): Promise<{ signature: string; timestamp: number }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `${method}\n${host}\n${uri}\n${accessKey}\nsignature_version:1\n${timestamp}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(accessSecret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign));
  return { signature: btoa(String.fromCharCode(...new Uint8Array(sig))), timestamp };
}

Deno.serve(async (req) => {
  const cors = corsRestricted(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const auth = await verifyJwt(req);
  if (!auth) return jsonErr("not_authenticated", "Missing or invalid Authorization header", cors, 401);

  const canManage = await requireCap(auth.id, "manage_settings");
  if (!canManage) return jsonErr("permission_denied", "Requires manage_settings capability.", cors, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonErr("malformed_body", "Invalid JSON body", cors, 400); }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { action, provider, credentials, envVars } = body as { action: string; provider: string; credentials?: Record<string, string>; envVars?: string[] };

  if (action === "health_check") {
    if (!provider) return jsonErr("missing_provider", "Provider key is required", cors, 400);
    if (provider !== "acrcloud") return jsonErr("unsupported", `Health check not implemented for ${provider}. Only acrcloud supported.`, cors, 400);
    const { data: secrets } = await supabase.from("admin_settings_secrets").select("setting_key, setting_value").in("setting_key", ["acr_host","acr_access_key","acr_access_secret"]);
    const cm = new Map<string,string>(); for (const s of (secrets??[])) cm.set(s.setting_key as string,(s.setting_value as string)?.trim()??"");
    const host = Deno.env.get("ACR_HOST")||cm.get("acr_host")||"", ak = Deno.env.get("ACR_ACCESS_KEY")||cm.get("acr_access_key")||"", as = Deno.env.get("ACR_ACCESS_SECRET")||cm.get("acr_access_secret")||"";
    const missing = [!host&&"ACR_HOST",!ak&&"ACR_ACCESS_KEY",!as&&"ACR_ACCESS_SECRET"].filter(Boolean);
    if (missing.length>0) return jsonErr("missing_credentials",`ACRCloud credentials incomplete. Missing: ${missing.join(", ")}`,cors,400);
    const start = Date.now(); let apiHost = host.replace(/^https?:\/\//,"").replace(/\/$/,"");
    const uri="/v1/containers"; const {signature,timestamp}=await acrcloudSign(ak,as,"GET",apiHost,uri);
    const res=await fetch(`https://${apiHost}${uri}?access_key=${ak}&signature=${signature}&signature_version=1&timestamp=${timestamp}`,{headers:{Accept:"application/json"}});
    const lm=Date.now()-start; const ok=res.status===200||res.status===404;
    await writeAudit({actorId:auth.id,actorLabel:auth.email,action:"provider_health_check",payload:{provider:"acrcloud",ok,latencyMs:lm,host}});
    return jsonRaw({ok,latencyMs:lm,message:ok?`ACRCloud reachable (${res.status})`:`ACRCloud returned ${res.status}`},cors);
  }

  if (!provider) return jsonErr("missing_provider","Provider key is required",cors,400);
  const pev = PROVIDER_SECRET_KEYS[provider];
  if (!pev) return jsonErr("unknown_provider",`Unknown provider: ${provider}`,cors,400);

  if (action === "clear") {
    const kc = (envVars??pev).map((ev)=>DB_KEY_PREFIX[ev]).filter(Boolean);
    if (kc.length===0) return jsonErr("no_keys","No valid env vars to clear",cors,400);
    const {error}=await supabase.from("admin_settings_secrets").delete().in("setting_key",kc);
    if (error) return jsonErr("internal_error","Failed to clear credentials",cors,500);
    await writeAudit({actorId:auth.id,actorLabel:auth.email,action:"provider_credentials_cleared",payload:{provider,cleared_keys:kc}});
    return jsonRaw({ok:true,message:`${provider} credentials cleared (${kc.length} keys).`,clearedKeys:kc},cors);
  }

  if (action !== "save") return jsonErr("unknown_action",`Unknown action: ${action}`,cors,400);
  if (!credentials||Object.keys(credentials).length===0) return jsonErr("missing_credentials","credentials object required",cors,400);

  const now = iso(); const saved: string[] = []; const errs: string[] = [];
  for (const [ev,val] of Object.entries(credentials)) {
    const dk = DB_KEY_PREFIX[ev]; if (!dk) { errs.push(`Unknown: ${ev}`); continue; }
    if (!pev.includes(ev)) { errs.push(`${ev} not in provider ${provider}`); continue; }
    const tv = String(val).trim();
    if (!tv) { const {error}=await supabase.from("admin_settings_secrets").delete().eq("setting_key",dk); if(error) errs.push(`Failed to clear ${ev}`); else saved.push(`${ev} (cleared)`); continue; }
    const {error}=await supabase.from("admin_settings_secrets").upsert({setting_key:dk,setting_value:tv,updated_by:auth.id,updated_at:now,metadata:{provider,env_var:ev,saved_at:now}},{onConflict:"setting_key"});
    if (error) errs.push(`Failed: ${ev}`); else saved.push(ev);
  }
  await writeAudit({actorId:auth.id,actorLabel:auth.email,action:"provider_credentials_saved",payload:{provider,saved_keys:saved,error_keys:errs}});
  return jsonRaw({ok:errs.length===0,message:errs.length===0?`${provider} credentials saved (${saved.length} fields).`:`${saved.length} saved, ${errs.length} errors: ${errs.join("; ")}`,savedKeys:saved,errors:errs.length>0?errs:undefined,storedIn:"admin_settings_secrets"},cors);
});
