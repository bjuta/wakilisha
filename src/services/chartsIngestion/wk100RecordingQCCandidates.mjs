/**
 * W4 read-only cross-source recording review, from exact signed-in source reviews.
 * Candidate similarity is NEVER a canonical recording match or a scoring vote.
 * No provider fetch, Registry mutation, eligibility assertion or publication.
 */
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=code=>{throw Error('wk100_recording_qc_'+code);};
const check=(v,code)=>{if(!v)fail(code);};
const norm=value=>typeof value==='string'
  ?value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g,' '):'';
const order=(a,b)=>a<b?-1:a>b?1:0;
const sortRows=(a,b)=>a.rank-b.rank||order(a.sourceKey,b.sourceKey)||order(a.rowId,b.rowId);
const decorate=(kind,items)=>({
  kind,key:kind+':'+items.map(r=>r.rowId).sort().join(':'),
  title:items[0].title,artists:[...new Set(items.map(r=>r.artist).filter(Boolean))].sort(),
  sourceCount:new Set(items.map(r=>r.sourceKey)).size,
  positions:[...items].sort(sortRows),
});
const sortGroups=(a,b)=>b.sourceCount-a.sourceCount||b.positions.length-a.positions.length||
  Math.min(...a.positions.map(r=>r.rank))-Math.min(...b.positions.map(r=>r.rank))||
  order(a.title,b.title);

export function projectWk100RecordingQCCandidates({weekStartEat,reviews}){
  check(/^\d{4}-\d{2}-\d{2}$/.test(weekStartEat??'')&&
    new Date(weekStartEat+'T00:00:00Z').getUTCDay()===1,'week_invalid');
  check(Array.isArray(reviews)&&reviews.length>=2&&reviews.length<=8,'source_count_invalid');
  const seenSource=new Set(),seenReceipt=new Set(),seenRow=new Set(),rows=[];
  for(const review of reviews){
    check(review?.schemaVersion==='wk100-admin-identify-observations-v1'&&
      review.weekStartEat===weekStartEat&&typeof review.sourceKey==='string'&&
      /^[a-z][a-z0-9_]{2,63}$/.test(review.sourceKey)&&
      UUID.test(review.receiptId??'')&&SHA.test(review.payloadSha256??'')&&
      review.canWriteRegistry===false&&review.canScore===false&&
      review.canPublish===false&&review.originalReadbackInThisRequest===false&&
      ['succeeded','partial_depth'].includes(review.receiptStatus)&&
      Number.isInteger(review.expectedDepth)&&review.expectedDepth>=1&&
      review.expectedDepth<=200&&Array.isArray(review.rows)&&
      review.rows.length===review.observedDepth&&
      review.rows.length>=1&&review.rows.length<=review.expectedDepth&&
      (review.receiptStatus==='succeeded'
        ?review.rows.length===review.expectedDepth:
        review.rows.length<review.expectedDepth)&&
      !seenSource.has(review.sourceKey)&&!seenReceipt.has(review.receiptId),
      'receipt_invalid');
    seenSource.add(review.sourceKey);seenReceipt.add(review.receiptId);
    for(const [i,r] of review.rows.entries()){
      check(UUID.test(r?.captureRowId??'')&&r.rank===i+1&&
        !seenRow.has(r.captureRowId)&&
        ['resolved','needs_review','conflicting','inactive'].includes(r.identityState)&&
        (r.providerTrackId===null||typeof r.providerTrackId==='string')&&
        (r.observedTitle===null||typeof r.observedTitle==='string')&&
        (r.observedArtist===null||typeof r.observedArtist==='string')&&
        (r.providerArtistName==null||typeof r.providerArtistName==='string'),
        'row_invalid');
      seenRow.add(r.captureRowId);
      const title=r.observedTitle?.trim()??'';
      const artist=(r.providerArtistName||r.observedArtist||'').trim();
      rows.push({rowId:r.captureRowId,sourceKey:review.sourceKey,
        receiptId:review.receiptId,rank:r.rank,title,artist,
        providerTrackId:r.providerTrackId,identityState:r.identityState,
        titleKey:norm(title),artistKey:norm(artist)});
    }
  }
  const grouped=(key)=>{
    const map=new Map();
    for(const r of rows){const k=key(r);if(!k)continue;
      if(!map.has(k))map.set(k,[]);map.get(k).push(r);
    }
    return [...map.values()];
  };
  // Match CANDIDATES only. No source row can be counted as proof of a match.
  const exact=grouped(r=>r.titleKey&&r.artistKey?r.titleKey+'\u0000'+r.artistKey:null)
    .filter(g=>new Set(g.map(r=>r.sourceKey)).size>=2)
    .map(g=>decorate('same_title_artist',g));
  const variants=grouped(r=>r.titleKey||null)
    .filter(g=>new Set(g.map(r=>r.sourceKey)).size>=2&&
      new Set(g.map(r=>r.artistKey)).size>=2)
    .map(g=>decorate('title_artist_variation',g));
  const repeated=grouped(r=>r.titleKey&&r.artistKey?
    r.sourceKey+'\u0000'+r.titleKey+'\u0000'+r.artistKey:null)
    .filter(g=>g.length>=2).map(g=>decorate('within_source_repeat',g));
  const providerIdRepeats=grouped(r=>r.providerTrackId?
    r.sourceKey+'\u0000'+r.providerTrackId:null)
    .filter(g=>g.length>=2).map(g=>decorate('provider_id_repeat',g));
  const groups=[...exact,...variants,...repeated,...providerIdRepeats].sort(sortGroups);
  const byKind=Object.freeze({same_title_artist:exact.length,
    title_artist_variation:variants.length,within_source_repeat:repeated.length,
    provider_id_repeat:providerIdRepeats.length});
  return Object.freeze({schemaVersion:'wk100-recording-qc-candidates/v1',weekStartEat,
    reviewedSourceCount:reviews.length,observedRows:rows.length,
    confirmedActiveLinks:rows.filter(r=>r.identityState==='resolved').length,
    missingProviderIds:rows.filter(r=>!r.providerTrackId).length,
    unknownArtistLabels:rows.filter(r=>!r.artist).length,
    counts:byKind,groups,
    interpretation:'review_candidates_only',
    canWriteRegistry:false,canScore:false,canPublish:false});
}
