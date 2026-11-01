/**
 * WAKILISHA 100 archival evidence locator — not a source admission manifest.
 *
 * These are redacted historical receipts from the *real* researcher-directed
 * October 29–30, 2026 original-byte captures independently audited under
 * issue #1264. The original HTML/CSV files live in the operator's PRIVATE
 * archive, not in public Git, Production Storage or the WK100 capture ledger.
 *
 * Never use this map as a current-week source feed, live Storage attestation,
 * scoreable rank input, verified native measurement period, or publication gate.
 */
export const WK100_ARCHIVED_EAT_WEEK = '2026-10-26';
const RECEIPTS = Object.freeze([
  Object.freeze({
    sourceKey:'shazam_ke',displayName:'Shazam Kenya',
    observedAtUtc:'2026-10-29T19:41:23Z',
    rawSha256:'771209bf966548f4594dab542bca1b9ffb3ec571f7441f5f41d2791c1e58ef17',
    byteLength:8210,rankDepth:200,rankStructure:'verified',
    observationType:'Discovery ranks',nativePeriod:'unverified',
    note:'200 discovery ranks; no source-native recording IDs',
  }),
  Object.freeze({
    sourceKey:'mdundo_ke',displayName:'Mdundo Kenya',
    observedAtUtc:'2026-10-30T14:48:47Z',
    rawSha256:'885fd7140b014bb98a7efea525148ac5e98629ee66351fbb217bc6f3b3eb45f1',
    byteLength:1564780,rankDepth:100,rankStructure:'verified',
    observationType:'Platform chart ranks',nativePeriod:'unverified',
    note:'100 ordered native IDs; source describes a weekly update',
  }),
  Object.freeze({
    sourceKey:'apple_ke_public_playlist',displayName:'Apple Music Kenya',
    observedAtUtc:'2026-10-30T15:07:59.769Z',
    rawSha256:'35b372511a91df88ffd942b4b04373d7bb46216ae4636d37c20a2f3afaba5d7b',
    byteLength:712638,rankDepth:100,rankStructure:'verified',
    observationType:'Daily playlist ranks',nativePeriod:'daily_snapshot_not_week',
    note:'100 ordered native IDs; browser HTML, not RSS or Catalog API',
  }),
  Object.freeze({
    sourceKey:'audiomack_ke',displayName:'Audiomack Kenya',
    observedAtUtc:null,
    rawSha256:'0884e9777bee45c38c1008dae544cfe62b1febd74fcf82ad156a3f2d808392a4',
    byteLength:646920,rankDepth:null,rankStructure:'unqualified',
    observationType:'Unqualified chart metadata',nativePeriod:'unverified',
    note:'Original HTML retained; music:song fields are not proven rank/recording IDs',
  }),
]);
const SOURCE_KEYS=new Set(RECEIPTS.map(x=>x.sourceKey));

/** Public-safe, dated archive receipt summary. This is never a live DB read. */
export function getWk100ArchivedResearchPortfolio(weekStartEat){
  if(weekStartEat!==WK100_ARCHIVED_EAT_WEEK)return Object.freeze([]);
  return RECEIPTS;
}

/**
 * Optional PRIVATE local readback only. Do not upload or persist bytes here.
 * A digest match demonstrates sameness to a previously audited payload; it
 * does NOT establish live admission, temporal coverage, identity or scoring.
 */
export async function verifyWk100ArchivedOriginal({weekStartEat,sourceKey,originalBytes}){
  const entry=weekStartEat===WK100_ARCHIVED_EAT_WEEK&&SOURCE_KEYS.has(sourceKey)
    ?RECEIPTS.find(x=>x.sourceKey===sourceKey):null;
  if(!entry||!(originalBytes instanceof Uint8Array)||
     originalBytes.byteLength!==entry.byteLength)
    throw new Error('wk100_archived_original_mismatch');
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',originalBytes));
  const actual=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==entry.rawSha256)throw new Error('wk100_archived_original_mismatch');
  return Object.freeze({
    sourceKey,weekStartEat,privateOriginalMatchesArchivedReceipt:true,
    rankStructure:entry.rankStructure,rankDepth:entry.rankDepth,
    nativePeriod:entry.nativePeriod,sourceAdmitted:false,
    canScore:false,canPublish:false,hostedReceiptVerified:false,
  });
}
