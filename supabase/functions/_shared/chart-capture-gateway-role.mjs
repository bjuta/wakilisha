/**
 * A trusted service-role identity exists only behind Supabase's hosted JWT
 * verification gateway. Local claim decoding is never a signature verifier.
 */
const TOKEN=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
function claimsOf(token) {
  if(typeof token!=='string' || token.length<48 || token.length>4096 || !TOKEN.test(token)) return null;
  try {
    const seg=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    const p=JSON.parse(atob(seg.padEnd(Math.ceil(seg.length/4)*4,'=')));
    return p && typeof p==='object' && !Array.isArray(p) ? p : null;
  }catch{return null;}
}
function identity(token,nowMs){
  if(!Number.isFinite(nowMs))return null;
  const c=claimsOf(token);
  return c && c.role==='service_role' && c.iss==='supabase' &&
    Number.isSafeInteger(c.exp) && c.exp>Math.floor(nowMs/1000) &&
    typeof c.ref==='string' && /^[a-z0-9]{20}$/.test(c.ref) ? c : null;
}
export function isGatewayVerifiedServiceRole(token,apiKey,nowMs=Date.now()){
  return typeof token==='string' && typeof apiKey==='string' && token===apiKey && !!identity(token,nowMs);
}
/**
 * Only the hosted gateway can validate the signature. The verified legacy JWT
 * contains a signed project-ref; a request URL can be rewritten by internal
 * Supabase routing. The separately configured WK100_CAPTURE_PROJECT_REF must agree with the
 * JWT project ref before enabling database access. No injected URL,
 * forwarded Host or caller JSON is trusted.
 * The corresponding service-role token must be supplied to PostgREST.
 */
export function runtimeProjectApiUrl(verifiedToken,configuredProjectRef,nowMs=Date.now()){
  const c=identity(verifiedToken,nowMs);
  if(!c || typeof configuredProjectRef!=='string' ||
     !/^[a-z0-9]{20}$/.test(configuredProjectRef) ||
     c.ref!==configuredProjectRef) return null;
  return `https://${c.ref}.supabase.co`;
}
