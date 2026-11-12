/**
 * WK100 fixed ranking, independent prospective research challenge (synthetic).
 * No access to sources, Storage, Supabase, Registry, or publishing endpoints.
 * No launch threshold is asserted from simulated observations.
 * Run: node scripts/acceptance/wk100-ranking-research-challenge.mjs
 */
import assert from 'node:assert/strict';
import {computeWk100PrivateRankingCandidate as compute,
  WK100_RANKING_SPECIFICATION_V1 as spec} from '../../supabase/functions/_shared/wk100-ranking-primitive.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const sha=n=>n.toString(16).padStart(64,'0');
const day=(d,delta)=>new Date(Date.parse(d+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10);
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const pseudorandom=seed=>{let state=seed>>>0;return ()=>{state=(state+0x6D2B79F5)|0;let t=Math.imul(state^(state>>>15),1|state);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};};
const settings=Object.freeze({market:'KE',weekStartEat:'2026-11-09',seed:142857,
  candidatePopulation:240,appleDailySnapshots:7,releaseThresholds:'not_set'});
function sourceOrder(familyIndex,mode,appleDay=0){
  const rand=pseudorandom(settings.seed+familyIndex*911+appleDay*7);
  const values=Array.from({length:settings.candidatePopulation},(_,i)=>i+1);
  return values.map(v=>{
    const jitter=(rand()-.5)*20;
    let strength;
    if(mode==='correlated')strength=v+jitter+Math.sin(v*(familyIndex+1))*(familyIndex+1);
    else if(mode==='conflicting')strength=rand()*240+(v%7)*0.0001;
    else if(mode==='one_provider_reversed')strength=familyIndex===3?241-v+jitter:v+jitter;
    else throw Error('unknown_research_mode');
    return {v,strength};
  }).sort((a,b)=>a.strength-b.strength||a.v-b.v).map(x=>x.v);
}
function fixture(mode){
  const snapshots=[];let seq=70100;
  for(let i=0;i<spec.families.length;i++){
    const family=spec.families[i];
    const apple=family==='apple_ke',repeat=apple?7:1;
    for(let n=0;n<repeat;n++){
      const depth=family==='shazam_ke'?200:100;
      const ordered=sourceOrder(i,mode,apple?n:0);
      const rows=ordered.slice(0,depth).map((x,k)=>({recordingId:id(x),rank:k+1,
        ...(family==='youtube_ke'?{nativeCount:120000-k*17}:{})}));
      snapshots.push({family,sourceKey:family+'_kenya_research',market:'KE',
        captureReceiptId:id(seq),captureReceiptSha256:sha(seq++),
        nativeMetric:family==='youtube_ke'?'rank_and_count':'rank',
        observedAtUtc:day(settings.weekStartEat,apple?n:4)+'T11:00:00Z',
        nativePeriodAuthority:family==='youtube_ke'?'provider_declared_dates':'observed_as_of',
        nativePeriodStartUtc:null,nativePeriodEndUtc:null,
        providerPeriodStartDate:family==='youtube_ke'?day(settings.weekStartEat,-3):null,
        providerPeriodEndDate:family==='youtube_ke'?day(settings.weekStartEat,3):null,
        declaredDepth:depth,rows});
    }
  }
  return {weekStartEat:settings.weekStartEat,eligibilityPolicySha256:sha(95001),
    registrySnapshotSha256:sha(95002),snapshots};
}
const rankCredit=(rank,depth)=>Math.floor(((depth-rank+1)*1e6+Math.floor(depth/2))/depth);
/** Completely independent reaggregation from raw fixture, not a call to the ranking engine. */
function independentRanking(input,{omitFamily=null,weights=null,curve='linear'}={}){
  const contributions=new Map();
  for(const family of spec.families){
    const panels=input.snapshots.filter(x=>x.family===family);
    const totals=new Map();
    for(const panel of panels)for(const row of panel.rows){
      let credit=rankCredit(row.rank,panel.declaredDepth);
      if(curve==='head_focused'){
        const k=10,r=row.rank,d=panel.declaredDepth;
        credit=Math.round(1e6*((1/(r+k))-(1/(d+1+k)))/((1/(1+k))-(1/(d+1+k))));
      }
      totals.set(row.recordingId,(totals.get(row.recordingId)||0)+credit);
    }
    for(const [track,total] of totals){
      const value=Math.floor((total+Math.floor(panels.length/2))/panels.length);
      if(!contributions.has(track))contributions.set(track,{});
      contributions.get(track)[family]=value;
    }
  }
  return [...contributions].map(([recordingId,credits])=>({recordingId,
    score:spec.families.reduce((sum,f)=>sum+(f===omitFamily?0:(weights?.[f]??20))*(credits[f]||0),0),
  })).sort((a,b)=>b.score-a.score||cmp(a.recordingId,b.recordingId));
}
function overlap(a,b,k){const set=new Set(a.slice(0,k).map(x=>x.recordingId));
  return b.slice(0,k).filter(x=>set.has(x.recordingId)).length;}
function median(values){const n=[...values].sort((a,b)=>a-b);return n.length%2?n[(n.length-1)/2]:(n[n.length/2-1]+n[n.length/2])/2;}
const rankMap=list=>new Map(list.map((row,i)=>[row.recordingId,i+1]));
function movements(base,challenger,limit=100){const next=rankMap(challenger);
  return base.slice(0,limit).map((x,i)=>Math.abs(i+1-(next.get(x.recordingId)||settings.candidatePopulation+1)));}

const outputs=[];
for(const mode of ['correlated','conflicting','one_provider_reversed']){
  const input=fixture(mode);
  const result=await compute(input);
  const baseline=independentRanking(input);
  assert.deepEqual(result.ranked.map(x=>x.recordingId),baseline.slice(0,100).map(x=>x.recordingId),
    'independent ordinal aggregation must match engine: '+mode);
  for(let i=0;i<100;i++)assert.equal(result.ranked[i].totalMicros,baseline[i].score,
    'independent score must match engine: '+mode);
  assert.equal(result.canPublish,false);
  const removal=Object.fromEntries(spec.families.map(f=>{
    const changed=independentRanking(input,{omitFamily:f});
    return [f,{top10Overlap:overlap(baseline,changed,10),
      top20Overlap:overlap(baseline,changed,20),
      medianAbsRankMovementTop100:median(movements(baseline,changed))}];
  }));
  const alternative=independentRanking(input,{curve:'head_focused'});
  const weightChallenges=Object.fromEntries(spec.families.map(f=>{
    const adjusted=Object.fromEntries(spec.families.map(x=>[x,x===f?30:17.5]));
    const ranked=independentRanking(input,{weights:adjusted});
    return [f,{top10Overlap:overlap(baseline,ranked,10),
      top20Overlap:overlap(baseline,ranked,20)}];
  }));
  const sourceBaseline=baseline.slice(0,10).map(x=>x.recordingId);
  outputs.push({mode,sourcePanelCount:input.snapshots.length,
    rankingDigest:result.rankingDigest,
    baselineTop10:sourceBaseline,
    leaveOneFamilyOut:removal,
    nonlinearHeadFocused:{top10Overlap:overlap(baseline,alternative,10),
      top20Overlap:overlap(baseline,alternative,20),
      medianAbsRankMovementTop100:median(movements(baseline,alternative))},
    alternativeShares30_17_5:weightChallenges,
  });
}
assert.equal(outputs.length,3);
assert(outputs.some(x=>x.nonlinearHeadFocused.top10Overlap<10),
  'research challenge must demonstrate ability to detect changed top-10 rankings');
assert(outputs.some(x=>Object.values(x.leaveOneFamilyOut).some(a=>a.top10Overlap<10)),
  'source removal challenge must be capable of observing rank instability');
console.log(JSON.stringify({schemaVersion:'wk100-ranking-synthetic-challenge/v1',
  dataClass:'SYNTHETIC_NOT_PROVIDER_EVIDENCE',
  specificationId:spec.id,
  caveat:'No empirical validation, calibrated influence or publication authority',
  referenceConstitution:[...spec.families],settings,results:outputs},null,2));
