/**
 * WK100: Validate a separately obtained, current Apple artist display-name
 * evidence report against one immutable chart receipt. No Registry authority.
 */
const SHA=/^[a-f0-9]{64}$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const assert=(condition,code)=>{if(!condition)throw Error('wk100_apple_artist_'+code);};
const text=(v,n=300)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const timestamp=v=>typeof v==='string'&&UTC.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString()===v;
const keysExactly=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const reportKeys=['schemaVersion','sourceReceipt','generatedAtUtc','initiatedAtUtc','lookupEndpoint','lookupCountry','batchSize','requestedBatches','supplierDataIsCurrentLookupNotOriginal','doesNotEstablishRegistryIdentity','canMutateRegistry','canMutateSource','canScore','canPublish','summary','batchesFailed','rows'];
const receiptKeys=['source','weekStartEat','receiptId','originalSha256','capturedAtUtc','originalArtistCount'];
const rowKeys=['rank','providerTrackId','observedTitle','status','artistName','providerTitle','lookupRetrievedAtUtc','evidenceSource','originalArtistObserved','registryIdentityConfirmed'];
export function validateWk100AppleArtistReport({report,receipt,rows}) {
  assert(keysExactly(report,reportKeys),'report_shape_invalid');
  assert(report.schemaVersion==='wk100-apple-artist-observation-probe-v1','schema_invalid');
  assert(keysExactly(report.sourceReceipt,receiptKeys),'receipt_shape_invalid');
  assert(receipt?.id===report.sourceReceipt.receiptId&&
    receipt?.week_start_eat===report.sourceReceipt.weekStartEat&&
    receipt?.payload_sha256===report.sourceReceipt.originalSha256&&
    receipt?.status==='succeeded'&&SHA.test(receipt.payload_sha256),
    'original_receipt_changed');
  assert(report.sourceReceipt.source==='apple_ke_public_top100'&&
    report.sourceReceipt.originalArtistCount===0&&timestamp(report.sourceReceipt.capturedAtUtc),
    'source_not_apple_original');
  assert(report.lookupEndpoint==='https://itunes.apple.com/lookup'&&
    report.lookupCountry==='ke'&&report.batchSize===10&&
    Array.isArray(report.requestedBatches)&&report.requestedBatches.length===10&&
    report.requestedBatches.every((x,i)=>x===i+1)&&
    report.supplierDataIsCurrentLookupNotOriginal===true&&
    report.doesNotEstablishRegistryIdentity===true&&
    report.canMutateRegistry===false&&report.canMutateSource===false&&
    report.canScore===false&&report.canPublish===false,
    'authority_invalid');
  assert(timestamp(report.initiatedAtUtc)&&timestamp(report.generatedAtUtc)&&
    report.initiatedAtUtc<=report.generatedAtUtc&&
    report.generatedAtUtc>report.sourceReceipt.capturedAtUtc,
    'report_time_invalid');
  assert(keysExactly(report.summary,['artist_found'])&&report.summary.artist_found===100&&
    Array.isArray(report.batchesFailed)&&report.batchesFailed.length===0&&
    Array.isArray(report.rows)&&report.rows.length===100&&
    Array.isArray(rows)&&rows.length===100,
    'row_count_invalid');
  const ordered=[...rows].sort((a,b)=>a.source_rank-b.source_rank);
  const seen=new Set();
  return report.rows.map((row,i)=>{
    const source=ordered[i];
    assert(keysExactly(row,rowKeys)&&source&&row.rank===i+1&&
      source.source_rank===i+1&&source.attempt_id===receipt.id&&
      typeof source.id==='string'&&
      row.providerTrackId===source.provider_track_id&&
      row.observedTitle===source.title_observed&&
      row.providerTitle===row.observedTitle&&
      row.originalArtistObserved===null&&source.artist_observed===null&&
      row.status==='artist_found'&&row.registryIdentityConfirmed===false&&
      text(row.providerTrackId,30)&&/^\d{1,20}$/.test(row.providerTrackId)&&
      !seen.has(row.providerTrackId)&&
      text(row.observedTitle,300)&&text(row.artistName,300)&&
      row.evidenceSource==='Apple iTunes Search API ID lookup'&&
      timestamp(row.lookupRetrievedAtUtc)&&
      row.lookupRetrievedAtUtc>=report.initiatedAtUtc&&
      row.lookupRetrievedAtUtc<=report.generatedAtUtc,
      'row_inconsistent');
    seen.add(row.providerTrackId);
    return Object.freeze({
      receipt_id:receipt.id,capture_row_id:source.id,
      provider_track_id:row.providerTrackId,
      source_title:row.observedTitle,artist_name:row.artistName,
      lookup_retrieved_at:row.lookupRetrievedAtUtc,
      original_sha256:receipt.payload_sha256,
    });
  });
}
export async function sha256OfWk100ReportRaw(raw){
  assert(typeof raw==='string'&&raw.length>=1&&raw.length<=62000,'bytes_invalid');
  const bytes=new TextEncoder().encode(raw);
  const sha=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(sha)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
