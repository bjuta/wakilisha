import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  chartStudioReturnHref,
  parseChartReviewReference,
} from "@/services/chartsPrivate/chartReviewContext";

type VerifiedContext = {
  state:"verified_chart_review_context";
  source_key:string; receipt_id:string; original_sha256:string;
  rank:number; title:string; artist:string|null;
  provider_track_id:string|null; observed_at:string;
  can_publish:false;
};

const LABELS:Record<string,string>={
  youtube_ke:"YouTube Kenya",mdundo_ke:"Mdundo Kenya",
  apple_ke:"Apple Music Kenya",audiomack_ke:"Audiomack Kenya",
  shazam_ke:"Shazam Kenya",
};

/** Revalidates the exact Chart evidence before showing a return path.
 * This does not create a Track, Artist, alias or identity assertion. */
export function ChartReviewReturnContext({
  consequence="none",
}:{
  consequence?:"none"|"artist_alias"|"track_duplicate";
}) {
  const [params]=useSearchParams();
  const key=params.toString();
  const reference=useMemo(()=>parseChartReviewReference(new URLSearchParams(key)),[key]);
  const requested=params.has("chart_source");
  const [state,setState]=useState<{
    loading:boolean;error:string;result:VerifiedContext|null;
  }>({loading:false,error:"",result:null});

  useEffect(()=>{
    if(!requested || !reference)return;
    let current=true;
    setState({loading:true,error:"",result:null});
    void supabase.functions.invoke("charts2-capture?mode=studio_review_context",{
      body:reference,
    }).then(({data,error})=>{
      if(!current)return;
      const item=data as VerifiedContext|null;
      if(error||!item||item.state!=="verified_chart_review_context"||
         item.source_key!==reference.source_key||
         item.receipt_id!==reference.receipt_id||
         item.original_sha256!==reference.original_sha256||
         item.rank!==reference.rank){
        setState({loading:false,result:null,
          error:"The original chart review reference could not be verified. Return to Charts Studio and reopen that song."});
        return;
      }
      setState({loading:false,error:"",result:item});
    }).catch(()=>{
      if(current)setState({loading:false,result:null,
        error:"The chart review reference could not be checked."});
    });
    return ()=>{current=false;};
  },[key,reference,requested]);

  if(!requested)return null;
  if(!reference)return <p role="alert" className="rounded-xl border border-wk-danger p-4 text-sm text-wk-danger">
    The chart review reference is invalid. Open the recording again from Charts Studio.
  </p>;
  return <section aria-label="Charts Studio review context"
    className="mb-5 space-y-2 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
    <p className="text-[11px] font-black uppercase tracking-wide text-wk-brand">
      From Charts Studio · Registry stewardship
    </p>
    {state.loading && <p role="status" className="text-[12px] text-wk-text-muted">
      Verifying the original chart observation…
    </p>}
    {state.error && <p role="alert" className="text-[12px] text-wk-danger">{state.error}</p>}
    {state.result && <>
      <p className="text-[14px] font-black text-wk-text">{state.result.title}</p>
      <p className="text-[12px] text-wk-text-muted">
        {state.result.artist??"Artist not provided in chart original"} ·
        {" "}{LABELS[state.result.source_key]??state.result.source_key} ·
        {" "}position #{state.result.rank}
      </p>
      <p className="text-[11px] text-wk-text-muted">
        This original observation is verified. Any Artist, credit, alias or Track decision
        still needs its own Registry review and proof.
      </p>
      {consequence==="artist_alias" &&
        <p role="status" className="rounded-lg border border-wk-warning p-3 text-[12px] text-wk-warning">
          Artist Alias approval here may also update existing public chart artist references.
          It is not a private Charts Studio approval. Review the full impact separately.
        </p>}
      {consequence==="track_duplicate" &&
        <p role="status" className="rounded-lg border border-wk-warning p-3 text-[12px] text-wk-warning">
          A Registry duplicate repair can move public chart rows, provider links and credits.
          Do not apply a repair merely to resolve this private chart position.
        </p>}
      <Link to={chartStudioReturnHref(reference)} className="inline-flex min-h-11 items-center
        text-[12px] font-bold text-wk-brand underline underline-offset-4">
        Return to this chart position
      </Link>
    </>}
  </section>;
}
