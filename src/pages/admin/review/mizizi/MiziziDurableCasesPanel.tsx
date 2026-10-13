import { useCallback, useEffect, useState } from "react";
import { TextArea, TextField, Label } from "react-aria-components";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkZonedTimestamp } from "@/components/data-viz/WkZonedTimestamp";
import {
  beginMiziziCaseResearchV1,
  bootstrapHeadquartersOwnerV1,
  loadDurableHeadquartersCasesV1,
  loadHeadquartersCaseEventsV1,
  type HeadquartersCaseEvent,
  loadHeadquartersHoldsV1,
  releaseWorkspaceHoldV1,
  startWorkspaceHoldV1,
  type HeadquartersDurableCase,
  type HeadquartersHold,
} from "@/services/miziziDurableCases";

type State =
  | {kind:"loading"}
  | {kind:"denied"}
  | {kind:"ready"; cases:readonly HeadquartersDurableCase[]; holds:readonly HeadquartersHold[]};
const actionReason = (value:string) => value.trim().length>=12 && value.trim().length<=1000;

function ReasonField({value,onChange,label}:{value:string;onChange:(v:string)=>void;label:string}) {
  return <TextField aria-label={label} value={value} onChange={onChange} className="min-w-0">
    <Label className="mb-1 block text-[12px] font-semibold text-wk-text">{label}</Label>
    <TextArea rows={2} className="wk-input min-w-0 w-full resize-y rounded-xl border-wk-border bg-wk-surface p-3 text-[13px] text-wk-text" />
  </TextField>;
}

/** The Registry queue above remains the source of review facts.
 * This panel only renders actual DB02 case/DB05 hold receipts from the
 * authenticated, capability-gated Data API. No heuristic review-to-case promotion.
 */
export function MiziziDurableCasesPanel() {
  const [state,setState] = useState<State>({kind:"loading"});
  const [refreshToken,setRefreshToken] = useState(0);
  const [selectedCase,setSelectedCase] = useState<string|null>(null);
  const [timelineCase,setTimelineCase] = useState<string|null>(null);
  const [timeline,setTimeline] = useState<readonly HeadquartersCaseEvent[]>([]);
  const [timelineError,setTimelineError] = useState(false);
  const [transitionReason,setTransitionReason] = useState("");
  const [holdReason,setHoldReason] = useState("");
  const [bootstrapReason,setBootstrapReason] = useState("");
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState<string|null>(null);
  const reload=useCallback(()=>setRefreshToken(v=>v+1),[]);
  useEffect(()=>{
    let active=true;
    setState({kind:"loading"});
    void Promise.all([loadDurableHeadquartersCasesV1(),loadHeadquartersHoldsV1()]).then(
      ([cases,holds])=>{if(active)setState({kind:"ready",cases,holds});},
      ()=>{if(active)setState({kind:"denied"});},
    );
    return ()=>{active=false;};
  },[refreshToken]);
  useEffect(()=>{
    if(!timelineCase){setTimeline([]);setTimelineError(false);return;}
    let live=true;
    setTimelineError(false);
    void loadHeadquartersCaseEventsV1(timelineCase).then(
      events=>{if(live)setTimeline(events);},
      ()=>{if(live)setTimelineError(true);},
    );
    return ()=>{live=false;};
  },[timelineCase,refreshToken]);
  const takeAction=async (job:()=>Promise<void>,success:string)=>{
    if(busy)return;
    setBusy(true);setNotice(null);
    try {await job();setNotice(success);setSelectedCase(null);setTransitionReason("");setHoldReason("");reload();}
    catch{setNotice("We could not confirm that change. Please check the recorded state before trying again.");}
    finally{setBusy(false);}
  };
  return <WkSurface className="mt-6 space-y-4 p-5" data-wk-mizizi-durable-cases>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-[18px] font-semibold text-wk-text">Recorded Cases</h2>
        <p className="mt-1 text-[12px] text-wk-text-muted">Actual case, receipt, and Hold Writes records. Registry reviews remain separate.</p></div>
      <WkButton variant="soft" className="wk-button-sm" onClick={reload} disabled={busy}>Refresh Records</WkButton>
    </header>
    {state.kind==="loading" ? <p role="status" className="text-[13px] text-wk-text-muted">Checking recorded case access…</p> : null}
    {state.kind==="denied" ? <div className="space-y-3" role="status">
      <p className="text-[13px] text-wk-text-muted">No authorized internal Headquarters case view is available for this account. Existing Registry reviews remain accessible above.</p>
      <p className="text-[12px] text-wk-text-muted">An authorized administrator can set up the first internal workspace membership once.</p>
      <ReasonField value={bootstrapReason} onChange={setBootstrapReason} label="Internal Workspace Setup Reason" />
      <WkButton variant="soft" disabled={busy||!actionReason(bootstrapReason)}
        onClick={()=>void takeAction(async()=>{await bootstrapHeadquartersOwnerV1(bootstrapReason);},"Internal workspace membership recorded.")}>
        Set Up Internal Workspace</WkButton>
    </div> : null}
    {state.kind==="ready" ? <>
      <p className="text-[12px] text-wk-text-muted">{state.cases.length} recorded cases in this page. Each state comes from DB02.</p>
      {state.cases.length===0 ? <p className="text-[13px] text-wk-text-muted">No durable Headquarters cases have been admitted here yet. Review counts are not case counts.</p> :
       <div className="space-y-3" role="list" aria-label="Durable Headquarters cases">
        {state.cases.map(item=><article key={item.caseId} role="listitem" className="rounded-xl border border-wk-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="text-[13px] font-semibold text-wk-text">{item.claimFamily.replaceAll("_"," ")}</h3>
              <p className="mt-1 text-[12px] text-wk-text-muted">{item.subjectType} · Case {item.caseId.slice(0,8)} · Revision {item.caseRevision}</p></div>
            <span className="text-[12px] font-semibold text-wk-text">{item.state.replaceAll("_"," ")} · {item.stage.replaceAll("_"," ")}</span>
          </div>
          <p className="mt-2 text-[12px] text-wk-text-muted">{item.receiptCount} linked receipts · Updated <WkZonedTimestamp value={item.updatedAt}/></p>
          <WkButton variant="ghost" className="wk-button-sm mt-2" disabled={busy}
            onClick={()=>setTimelineCase(timelineCase===item.caseId?null:item.caseId)}>
            {timelineCase===item.caseId?"Hide Case Journal":"View Recorded Case Journal"}
          </WkButton>
          {timelineCase===item.caseId ? <section aria-label="Immutable case event timeline" className="mt-3 space-y-2">
            {timelineError ? <p role="alert" className="text-[12px] text-wk-danger">The recorded case journal could not be verified.</p> : null}
            {!timelineError && timeline.length===0 ? <p role="status" className="text-[12px] text-wk-text-muted">Checking immutable case events…</p> : null}
            {timeline.map(event=><div key={event.eventId} className="rounded-xl border border-wk-border p-3">
              <p className="text-[12px] font-semibold text-wk-text">Revision {event.revision} · {event.stage.replaceAll("_"," ")}</p>
              <p className="mt-1 text-[12px] text-wk-text-muted">{event.reason}</p>
              <p className="mt-1 text-[11px] text-wk-text-muted">Recorded <WkZonedTimestamp value={event.recordedAt}/></p>
            </div>)}
          </section> : null}
          {item.reviewId ? <a className="mt-2 inline-block text-[12px] font-semibold text-wk-brand hover:underline"
            href={`/admin/review/queue?review=${encodeURIComponent(item.reviewId)}`}>Inspect Source Review</a> : null}
          {item.state==="open"&&item.stage==="triage" ? <div className="mt-3">
            <WkButton variant="soft" className="wk-button-sm" disabled={busy}
              onClick={()=>{setSelectedCase(selectedCase===item.caseId?null:item.caseId);setTransitionReason("");}}>
              {selectedCase===item.caseId?"Cancel Research Preparation":"Prepare Research"}</WkButton>
            {selectedCase===item.caseId ? <div className="mt-3 space-y-2">
              <ReasonField value={transitionReason} onChange={setTransitionReason} label="Reason to Begin Research" />
              <p className="text-[12px] text-wk-text-muted">This records the case stage. It does not approve a Registry change or queue a job by itself.</p>
              <WkButton disabled={busy||!actionReason(transitionReason)} onClick={()=>void takeAction(async()=>{
                await beginMiziziCaseResearchV1({caseId:item.caseId,expectedRevision:item.caseRevision,reason:transitionReason});
              },"Research stage recorded in the case journal.")}>Confirm Research Stage</WkButton>
            </div> : null}
          </div> : null}
        </article>)}
       </div>}
      <div className="space-y-3 border-t border-wk-border pt-4">
        <h3 className="text-[14px] font-semibold text-wk-text">Hold Writes</h3>
        <p className="text-[12px] text-wk-text-muted">Workspace holds block Registry write admission at the database, including requests from stale browser sessions. Research reads may continue.</p>
        {state.holds.filter(x=>x.status==="active").map(hold=><article key={hold.holdId} className="rounded-xl border border-wk-border p-3">
          <p className="text-[13px] font-semibold text-wk-text">Active: {hold.holdKey}</p>
          <p className="text-[12px] text-wk-text-muted">{hold.reason}</p>
          <WkButton variant="soft" className="wk-button-sm mt-2" disabled={busy||!actionReason(holdReason)}
            onClick={()=>void takeAction(async()=>{await releaseWorkspaceHoldV1(hold,holdReason);},"The selected workspace hold was released.")}>
            Release This Hold</WkButton>
        </article>)}
        <ReasonField value={holdReason} onChange={setHoldReason} label="Hold Writes Reason" />
        <WkButton variant="soft" disabled={busy||!actionReason(holdReason)} onClick={()=>void takeAction(async()=>{
          const key=`mizizi:workspace:hold:${crypto.randomUUID()}`;
          await startWorkspaceHoldV1(holdReason,key);
        },"Workspace Hold Writes is active.")}>Start Workspace Hold Writes</WkButton>
      </div>
    </> : null}
    {notice ? <p role="status" className="text-[12px] text-wk-text-muted">{notice}</p> : null}
  </WkSurface>;
}
