/**
 * WK100 Apple Music catalog token, service-only and project-bound by caller.
 *
 * A signed-in browser cannot call this module directly. The collector must
 * first prove gateway service_role, exact deployed project, current admitted
 * method and sealed source manifest before requesting any developer token.
 *
 * This is not a source-admission decision or permission to reuse credentials.
 * Reuse of the established platform signing key requires an additional,
 * explicit WK100_APPLE_USE_EXISTING_PLATFORM_CREDENTIALS=true setting.
 * No credential value, signing key or JWT may be logged or returned to users.
 */
const APPLE_SOURCE=/^apple_ke(?:_[a-z][a-z0-9_]{1,45})?$/;
const APPLE_ID=/^[A-Z0-9]{10}$/;
const TOKEN=/^[A-Za-z0-9_.-]{20,8192}$/;
const MONTH_HOUR=3600;
function b64u(s){return s.replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function validAppleEndpoint(endpoint) {
  if(typeof endpoint!=='string')return false;
  try {
    const u=new URL(endpoint);
    const keys=[...u.searchParams.keys()];
    const limit=u.searchParams.get('limit');
    return u.protocol==='https:'&&u.hostname==='api.music.apple.com'&&
      u.pathname==='/v1/catalog/ke/charts'&&!u.username&&!u.password&&
      !u.hash&&!u.port&&u.searchParams.get('types')==='songs'&&
      u.searchParams.get('chart')==='most-played'&&
      keys.every(k=>['types','chart','limit'].includes(k))&&
      new Set(keys).size===keys.length&&
      (limit===null||(/^\d{1,3}$/.test(limit)&&Number(limit)>=1&&Number(limit)<=200));
  }catch{return false;}
}
export function isWk100AppleCatalogChart(sourceKey,endpoint){
  return typeof sourceKey==='string'&&APPLE_SOURCE.test(sourceKey)&&
    validAppleEndpoint(endpoint);
}
function validPem(value){
  return typeof value==='string'&&value.length>=100&&value.length<=15000&&
    value.includes('-----BEGIN PRIVATE KEY-----')&&
    value.includes('-----END PRIVATE KEY-----')&&
    !value.startsWith('uploaded:')&&value!=='__server_stored__';
}
async function readSecret(db,key){
  if(!db||typeof db.from!=='function')return null;
  try{
    const {data,error}=await db.from('admin_settings_secrets')
      .select('setting_value').eq('setting_key',key).maybeSingle();
    const value=data?.setting_value;
    return !error&&typeof value==='string'?value.trim():null;
  }catch{return null;}
}
async function signedToken({privateKey,teamId,keyId,now,subtle}){
  if(!validPem(privateKey)||!APPLE_ID.test(teamId)||!APPLE_ID.test(keyId)||
    !(now instanceof Date)||!Number.isFinite(now.getTime())||
    !subtle||typeof subtle.importKey!=='function')return null;
  try {
    const pk=privateKey.replace('-----BEGIN PRIVATE KEY-----','')
      .replace('-----END PRIVATE KEY-----','').replace(/\s/g,'');
    const raw=Uint8Array.from(atob(pk),c=>c.charCodeAt(0));
    const key=await subtle.importKey('pkcs8',raw,
      {name:'ECDSA',namedCurve:'P-256'},false,['sign']);
    const iat=Math.floor(now.getTime()/1000);
    const header=b64u(btoa(JSON.stringify({alg:'ES256',kid:keyId})));
    const payload=b64u(btoa(JSON.stringify({iss:teamId,iat,exp:iat+MONTH_HOUR})));
    const signingInput=header+'.'+payload;
    const signature=new Uint8Array(await subtle.sign(
      {name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(signingInput)));
    if(signature.byteLength!==64)return null;
    const compact=signingInput+'.'+b64u(btoa(String.fromCharCode(...signature)));
    return TOKEN.test(compact)?compact:null;
  }catch{return null;}
}
/**
 * No network request is made. Returned bearer may only be used by the
 * existing fetchCandidateBytes transport to the exact Apple Kenya route.
 *
 * The established platform key is queried ONLY after explicit opt-in and
 * from the caller's verified, project-bound service_role DB client.
 */
export async function resolveWk100AppleProviderAuthorization({
  sourceKey,endpoint,directToken='',reuseExisting=false,db=null,
  now=new Date(),subtle=crypto.subtle,
}={}){
  if(!isWk100AppleCatalogChart(sourceKey,endpoint))return null;
  if(directToken){
    return typeof directToken==='string'&&TOKEN.test(directToken)
      ?Object.freeze({kind:'apple_developer_bearer',token:directToken}):null;
  }
  if(reuseExisting!==true||!db)return null;
  const [privateKey,teamId,keyId]=await Promise.all([
    readSecret(db,'apple_music_private_key'),
    readSecret(db,'apple_music_team_id'),
    readSecret(db,'apple_music_key_id'),
  ]);
  const token=await signedToken({privateKey,teamId,keyId,now,subtle});
  return token?Object.freeze({kind:'apple_developer_bearer',token}):null;
}
