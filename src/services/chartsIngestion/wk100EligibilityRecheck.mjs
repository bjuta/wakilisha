/**
 * WK100 W6: compare two independently authorized all-row eligibility reads.
 *
 * Comparison is session-local, not a Registry writer, approval, or durable
 * correction ledger. Existing Registry operations own canonical edits.
 * An exact immutable receipt and Edition policy must remain unchanged.
 */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const outcomes=new Set(['ELIGIBLE','EXCLUDED','REVIEW_REQUIRED','CONFLICTED']);
export class Wk100RecheckConflict extends Error {
  constructor(code){super('wk100_recheck_'+code);this.code=code;}
}
const assert=(ok,code)=>{if(!ok)throw new Wk100RecheckConflict(code);};
const own=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);
function validate(rev){
  assert(rev&&typeof rev==='object'&&!Array.isArray(rev)&&
    rev.schemaVersion==='wk100-admin-eligibility-preview-v1'&&
    Array.isArray(rev.rows)&&rev.rows.length>=1&&rev.rows.length<=200&&
    Number.isInteger(rev.observedDepth)&&rev.observedDepth===rev.rows.length&&
    Number.isInteger(rev.expectedDepth)&&rev.expectedDepth>=rev.rows.length&&
    Number.isSafeInteger(rev.configRevision)&&rev.configRevision>=1&&
    SHA.test(rev.policySha256)&&SHA.test(rev.payloadSha256)&&
    rev.canScore===false&&rev.canPublish===false&&rev.canWriteRegistry===false,
    'invalid_result');
  const seen=new Set();
  for(let i=0;i<rev.rows.length;i++){
    const row=rev.rows[i];
    assert(row&&UUID.test(row.captureRowId)&&row.rank===i+1&&
      !seen.has(row.captureRowId)&&outcomes.has(row.outcome)&&
      SHA.test(row.registryFactsSha256)&&Array.isArray(row.reasonCodes)&&
      row.reasonCodes.every(x=>typeof x==='string'&&x.length>0)&&
      new Set(row.reasonCodes).size===row.reasonCodes.length&&
      row.canScore===false&&row.canPublish===false,'invalid_row');
    seen.add(row.captureRowId);
  }
  for(const outcome of outcomes){
    assert(Number.isInteger(rev.counts?.[outcome])&&rev.counts[outcome]>=0&&
      rev.counts[outcome]===rev.rows.filter(x=>x.outcome===outcome).length,
      'invalid_count');
  }
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function compareWk100EligibilityRechecks(before,after){
  validate(before);validate(after);
  for(const k of ['weekStartEat','contractId','receiptId','sourceKey','payloadSha256',
    'receiptStatus','observedDepth','expectedDepth']){
    assert(own(before,k)&&own(after,k)&&before[k]===after[k],'receipt_changed');
  }
  assert(before.configRevision===after.configRevision&&
    before.policySha256===after.policySha256,'policy_changed');
  const changed=[];
  for(let i=0;i<before.rows.length;i++){
    const previous=before.rows[i],current=after.rows[i];
    // Only eligibility and verified canonical Registry facts may change.
    // Never accept a changed source row as a "correction".
    for(const k of ['captureRowId','rank','observedTitle','observedArtist','providerTrackId'])
      assert(own(previous,k)&&own(current,k)&&previous[k]===current[k],
        'source_row_changed');
    const factsChanged=previous.registryFactsSha256!==current.registryFactsSha256;
    const outcomeChanged=previous.outcome!==current.outcome;
    const reasonsChanged=!same(previous.reasonCodes,current.reasonCodes);
    const identityChanged=previous.canonicalTrackId!==current.canonicalTrackId||
      previous.identityState!==current.identityState;
    // Same original, policy and canonical facts must produce the same rule result.
    assert(factsChanged||!(outcomeChanged||reasonsChanged||identityChanged),
      'unexplained_evaluation_change');
    if(factsChanged||outcomeChanged||reasonsChanged||identityChanged){
      const resolvedReasons=previous.reasonCodes.filter(x=>!current.reasonCodes.includes(x));
      const newReasons=current.reasonCodes.filter(x=>!previous.reasonCodes.includes(x));
      changed.push({
        captureRowId:current.captureRowId,rank:current.rank,
        observedTitle:current.observedTitle,
        beforeOutcome:previous.outcome,afterOutcome:current.outcome,
        beforeReasons:previous.reasonCodes,afterReasons:current.reasonCodes,
        resolvedReasons,newReasons,
        beforeCanonicalTrackId:previous.canonicalTrackId,
        afterCanonicalTrackId:current.canonicalTrackId,
        factsChanged,outcomeChanged,reasonsChanged,identityChanged,
      });
    }
  }
  const summary={
    becameEligible:changed.filter(x=>x.afterOutcome==='ELIGIBLE'&&x.beforeOutcome!=='ELIGIBLE').length,
    becameExcluded:changed.filter(x=>x.afterOutcome==='EXCLUDED'&&x.beforeOutcome!=='EXCLUDED').length,
    newConflicts:changed.filter(x=>x.afterOutcome==='CONFLICTED'&&x.beforeOutcome!=='CONFLICTED').length,
    identityChanges:changed.filter(x=>x.identityChanged).length,
    factsChanged:changed.filter(x=>x.factsChanged).length,
    reasonsResolved:changed.reduce((n,x)=>n+x.resolvedReasons.length,0),
    reasonsAdded:changed.reduce((n,x)=>n+x.newReasons.length,0),
  };
  return {
    schemaVersion:'wk100-admin-recheck-diff-v1',
    weekStartEat:after.weekStartEat,contractId:after.contractId,
    receiptId:after.receiptId,payloadSha256:after.payloadSha256,
    configRevision:after.configRevision,policySha256:after.policySha256,
    evaluatedRows:after.rows.length,changedCount:changed.length,
    summary,changed,immutableSourceRetained:true,policyRetained:true,
    savedCorrection:false,verifiedRegistryOperation:false,
    canScore:false,canPublish:false,
  };
}
