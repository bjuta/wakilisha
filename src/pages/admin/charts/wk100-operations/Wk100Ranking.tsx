import {useMemo} from 'react';
import {WkSurface} from '@/components/design-system/primitives/Surface';
import {WkStateBadge} from '@/components/design-system/primitives/StateBadge';
import type {Wk100MethodDecision} from './SourceMethodReviewForm';
import {WK100_RANKING_SPECIFICATION_V1} from '@/../supabase/functions/_shared/wk100-ranking-primitive.mjs';
import {reviewWk100MethodologyEvidence} from '@/../supabase/functions/_shared/wk100-methodology-candidate.mjs';

type Source={id:string;provider:string;sourceKey:string;market:string;metric:string;
  version:string;captureState:string;expectedDepth:number;observedDepth:number;
  receiptSha256:string|null;nativePeriodAuthority:string;
  nativePeriodStart:string|null;nativePeriodEnd:string|null;
  lastSuccessfulAt:string|null};
const DISPLAY:Record<string,{label:string;meaning:string}>={
  apple_ke:{label:'Apple Music',meaning:'Daily Kenya most-played positions. Not weekly stream totals.'},
  shazam_ke:{label:'Shazam',meaning:'Kenya song recognition positions. Not audio plays.'},
  mdundo_ke:{label:'Mdundo',meaning:'Kenya chart positions. No inferred play totals.'},
  youtube_ke:{label:'YouTube',meaning:'Provider-reported Kenya weekly song ranking with native views.'},
  audiomack_ke:{label:'Audiomack',meaning:'Kenya geographic song placements. Not disclosed stream totals.'},
};

export function Wk100Ranking({week,sources=[],methods=[],reviewedSourceIds=[]}:{
  week:string;sources?:Source[];methods?:Wk100MethodDecision[];
  reviewedSourceIds?:string[];
}){
  const evidence=useMemo(()=>{
    try{return reviewWk100MethodologyEvidence({
      weekStartEat:week,sources,methods,reviewedSourceIds,
    });}catch{return null;}
  },[week,sources,methods,reviewedSourceIds]);
  const spec=WK100_RANKING_SPECIFICATION_V1;
  return <section data-wk100-ranking aria-label="W7 Ranking" className="space-y-5">
    <WkSurface className="rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-wk-text-muted">Rank / W7 / Kenya</p>
          <h2 className="mt-1 text-xl font-bold text-wk-text">Ranking</h2>
          <p className="mt-2 max-w-3xl text-sm text-wk-text-muted">
            One fixed research specification for WAKILISHA 100. Source observations
            remain distinct. The result measures cross-platform chart traction,
            not a count of Kenyan streams or listeners.
          </p>
        </div>
        <WkStateBadge tone="warning">Private · Publication locked</WkStateBadge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-wk-border p-3">
          <p className="text-xs text-wk-text-muted">Edition week</p>
          <p className="text-sm font-semibold text-wk-text">{week}</p>
        </div>
        <div className="rounded-xl border border-wk-border p-3">
          <p className="text-xs text-wk-text-muted">Calculation</p>
          <p className="text-sm font-semibold text-wk-text">Fixed, versioned ranking</p>
        </div>
        <div className="rounded-xl border border-wk-border p-3">
          <p className="text-xs text-wk-text-muted">Source families</p>
          <p className="text-sm font-semibold text-wk-text">Five required</p>
        </div>
      </div>
      <h3 className="mt-5 text-sm font-semibold text-wk-text">Source Evidence</h3>
      <p className="mt-1 text-xs text-wk-text-muted">
        Each family receives one fixed fifth of the research index. Apple daily
        observations remain within Apple’s share. Spotify playlist placement
        contributes no score. There are no operator-editable ranking percentages.
      </p>
      {!evidence&&<p role="alert" className="mt-3 text-sm text-wk-danger">
        Source evidence is unavailable. Ranking and publication remain blocked.
      </p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-wk100-w7-evidence-review>
        {spec.families.map((family:string)=>{
          const item=evidence?.core.find((x:{family:string;chainCandidateCount:number})=>x.family===family);
          return <div key={family} className="rounded-xl border border-wk-border p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="text-sm font-semibold text-wk-text">{DISPLAY[family].label}</p>
              <p className="text-xs font-semibold text-wk-text-muted" >{spec.familyWeightPercent}% fixed share</p>
            </div>
            <p className="mt-1 text-xs text-wk-text-muted">{DISPLAY[family].meaning}</p>
            <p className="mt-2 text-xs text-wk-text-muted">
              {item?.chainCandidateCount
                ?'Candidate source chain observed. Recording identity and week acceptance remain unverified.'
                :'Source evidence is not ready for ranking.'}
            </p>
          </div>;
        })}
      </div>
      <p role="status" className="mt-4 text-xs text-wk-text-muted">
        {evidence?.chainCandidateFamilies??0} of five source families have a
        candidate evidence chain in this readback. This is not an accepted
        five-source week, a scored Edition or an approval to publish.
      </p>
      <p className="mt-2 text-xs text-wk-text-muted">
        The fixed calculation requires separately verified original receipts,
        canonical Registry identities, the saved eligibility policy and complete
        source checkpoints. The publication decision remains independent.
      </p>
      <p className="mt-2 text-xs font-semibold text-wk-text-muted">
        No ranking, staging or publication command is available on this screen.
      </p>
    </WkSurface>
  </section>;
}
