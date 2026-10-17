import { buildRedactedHeadquartersAuditV1 } from "@/services/miziziRedactedAudit";
import { useAdminUser } from "@/hooks/useAdminUser";
import { useCallback, useEffect, useState } from "react";
import { TextArea, TextField, Label } from "react-aria-components";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkDisclosure } from "@/components/design-system/primitives/Disclosure";
import { WkSelect } from "@/components/design-system/primitives/Select";
import { WkIcon } from "@/components/design-system/Icon";
import type { HeadquartersQueueV2 } from "@/services/miziziHeadquartersBrief";
import { WkZonedTimestamp } from "@/components/data-viz/WkZonedTimestamp";
import {
  beginMiziziCaseResearchV1,
  bootstrapHeadquartersOwnerV1,
  canOfferInternalWorkspaceSetupV1,
  HeadquartersAuthorizationDeniedError,
  loadHeadquartersDashboardV1,
  projectHeadquartersCaseMachineReadV1,
  loadHeadquartersCaseEventsV1,
  type HeadquartersCaseEvent,
  type HeadquartersDashboardLoadV1,
  releaseWorkspaceHoldV1,
  startWorkspaceHoldV1,
  type HeadquartersDurableCase,
  type HeadquartersHold,
} from "@/services/miziziDurableCases";

type State = {kind:"loading"} | HeadquartersDashboardLoadV1;
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
export function MiziziDurableCasesPanel({ queue, onInspectReview }: {
  queue?: HeadquartersQueueV2 | null;
  onInspectReview?: (reviewId: string) => void;
}) {
  const admin=useAdminUser();
  const canOfferSetup=canOfferInternalWorkspaceSetupV1(
    admin.loading,admin.can("manage_registry"),admin.can("manage_users"),
  );
  const [state,setState] = useState<State>({kind:"loading"});
  const [refreshToken,setRefreshToken] = useState(0);
  const [selectedCase,setSelectedCase] = useState<string|null>(null);
  const [activeCaseId,setActiveCaseId] = useState<string|null>(null);
  const [recordView,setRecordView] = useState<"human"|"machine">("human");
  const [detailTab,setDetailTab] = useState<"overview"|"evidence"|"next"|"history">("overview");
  const [recentEvents,setRecentEvents] = useState<readonly HeadquartersCaseEvent[]>([]);
  const [recentEventsState,setRecentEventsState] = useState<"loading"|"ready"|"error">("loading");
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
    void loadHeadquartersDashboardV1().then(
      result=>{if(active)setState(result);},
      ()=>{if(active)setState({kind:"unavailable"});},
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
  const cases = state.kind === "ready" ? state.cases : [];
  const focusedCase = cases.find(item => item.caseId === activeCaseId) ?? cases[0] ?? null;
  const sourceReview = focusedCase?.reviewId
    ? queue?.items.find(item => item.id === focusedCase.reviewId) ?? null
    : null;
  const activeHolds = state.kind === "ready"
    ? state.holds.filter(item => item.status === "active") : [];
  useEffect(() => {
    if (!focusedCase) { setRecentEvents([]); return; }
    let active = true;
    setRecentEventsState("loading");
    setRecentEvents([]);
    void loadHeadquartersCaseEventsV1(focusedCase.caseId).then(
      events => { if (active) { setRecentEvents(events); setRecentEventsState("ready"); } },
      () => { if (active) setRecentEventsState("error"); },
    );
    return () => { active = false; };
  }, [focusedCase?.caseId, refreshToken]);
  const displayClaim = (value: string) => value.replaceAll("_", " ");
  const takeAction=async (job:()=>Promise<void>,success:string)=>{
    if(busy)return;
    setBusy(true);setNotice(null);
    try {await job();setNotice(success);setSelectedCase(null);setTransitionReason("");setHoldReason("");reload();}
    catch(error){setNotice(error instanceof HeadquartersAuthorizationDeniedError
      ? "Your account is not authorized for that Headquarters action. No workspace changes were made."
      : "We could not confirm that change. Please check the recorded state before trying again.");}
    finally{setBusy(false);}
  };
  const downloadRedactedAudit=async()=>{
    if(busy || state.kind!=="ready")return;
    setBusy(true);setNotice("Preparing the verified redacted audit…");
    try {
      const payload=await buildRedactedHeadquartersAuditV1();
      const url=URL.createObjectURL(new Blob([payload],{type:"application/json;charset=utf-8"}));
      try {
        const anchor=document.createElement("a");
        anchor.href=url;
        anchor.download=`wakilisha-mizizi-audit-redacted-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        window.setTimeout(()=>URL.revokeObjectURL(url),0);
      }
      setNotice("Redacted case and Hold Writes audit prepared.");
    } catch {
      setNotice("We could not verify a complete audit. No file was exported.");
    } finally {setBusy(false);}
  };
  return <div className="mz-case-home" data-wk-mizizi-investigation-first>
    <header className="mz-case-introduction">
      <span className="mz-case-eyebrow">MIZIZI / Headquarters / Investigate</span>
      <h1>Start with the investigation.</h1>
      <p>What does the record support, what remains uncertain, and which action is actually permitted?</p>
    </header>
    {state.kind === "loading" ? (
      <p role="status" className="mz-case-readstate">Checking recorded cases and access…</p>
    ) : state.kind === "denied" ? (
      <p role="status" className="mz-case-readstate">No authorized Headquarters case view is available. Open case controls to inspect your access path.</p>
    ) : state.kind === "unavailable" ? (
      <p role="alert" className="mz-case-readstate">The case authority could not be verified. No case outcome can be displayed.</p>
    ) : null}
    {state.kind === "ready" && !focusedCase ? (
      <div className="mz-case-empty">
        <WkIcon name="Folder" size={20} aria-hidden="true" />
        <h2>No recorded investigations in this workspace.</h2>
        <p>Registry review totals are separate from durable cases. Nothing has been promoted into an investigation here.</p>
      </div>
    ) : null}
    {state.kind === "ready" && focusedCase ? (
      <div className="mz-case-layout">
        <div className="mz-case-switcher" aria-label="Recorded investigations">
          <WkSelect
            ariaLabel="Switch recorded investigation"
            className="mz-case-select"
            triggerClassName="mz-case-select-trigger"
            value={focusedCase.caseId}
            onChange={(caseId) => {
              if (!cases.some(item => item.caseId === caseId)) return;
              setActiveCaseId(caseId);
              setDetailTab("overview");
              setRecordView("human");
            }}
            options={cases.map(item => ({
              value: item.caseId,
              label: queue?.items.find(review => review.id === item.reviewId)?.title
                || displayClaim(item.claimFamily),
              description: `${item.subjectType} · ${item.caseId.slice(0,8)} · ${item.stage.replaceAll("_"," ")}`,
            }))}
          />
          <span className="mz-case-switcher-count">
            {cases.length} recorded {cases.length === 1 ? "case" : "cases"}
          </span>
        </div>
        <article className="mz-case-story" aria-label="Selected investigation">
          <header className="mz-case-hero">
            <div className="mz-case-hero-art" aria-label="No authorized artefact image is connected">
              <WkIcon name="FileText" size={23} aria-hidden="true" />
              <span>Artefact unavailable</span>
            </div>
            <div className="mz-case-hero-copy">
              <div className="mz-case-hero-meta">
                <span className="mz-case-eyebrow">{focusedCase.subjectType} / {displayClaim(focusedCase.claimFamily)}</span>
                <span className="mz-case-lifecycle">{focusedCase.state.replaceAll("_"," ")} · {focusedCase.stage.replaceAll("_"," ")}</span>
              </div>
              <h2>{sourceReview?.title || displayClaim(focusedCase.claimFamily)}</h2>
              <p>Case {focusedCase.caseId} · Revision {focusedCase.caseRevision}</p>
              <p className="mz-case-hero-context">Canonical subject {focusedCase.subjectId}. The case stage is operational state, not a verified finding about music identity or rights.</p>
            </div>
          </header>
          <dl className="mz-case-stats" aria-label="Recorded case status and research limits">
            <div><dt>Questions decided</dt><dd>Not recorded</dd></div>
            <div><dt>Linked receipts</dt><dd>{focusedCase.receiptCount.toLocaleString()}</dd></div>
            <div><dt>Next due</dt><dd>{focusedCase.nextActionAt
              ? <WkZonedTimestamp value={focusedCase.nextActionAt}/>
              : "Not scheduled"}</dd></div>
            <div><dt>MIZIZI research</dt><dd>Runtime status unavailable</dd></div>
          </dl>
          <div className="mz-case-view-switch" role="group" aria-label="Selected case representation">
            <button type="button" className="mz-case-view-option"
              aria-pressed={recordView === "human"} onClick={() => setRecordView("human")}>Human View</button>
            <button type="button" className="mz-case-view-option"
              aria-pressed={recordView === "machine"} onClick={() => setRecordView("machine")}>Machine View</button>
          </div>
          {recordView === "human" ? (
            <>
          <div className="mz-case-detail-tabs" role="group" aria-label="Case reading views">
            {([
              ["overview","Overview"],["evidence","Evidence"],
              ["next","Next evidence"],["history","History"],
            ] as const).map(([id,label]) => (
              <button key={id} type="button" aria-pressed={detailTab===id}
                onClick={()=>setDetailTab(id)}>{label}</button>
            ))}
          </div>
          {detailTab === "overview" ? (
            <>
              <section className="mz-case-focus">
            <div className="mz-case-section-head"><span className="mz-case-eyebrow">Question in this case</span><span className="mz-case-unresolved">Not adjudicated here</span></div>
            <h3>{sourceReview?.title || displayClaim(focusedCase.claimFamily)}</h3>
            <p>The attached Registry review is a research lead. Inspect its original record before choosing an explanation. A review's status does not establish independent evidence or ownership.</p>
          </section>
              <footer className="mz-case-next">
            <div><strong>Next step</strong><p>Examine the source review and the case journal. Only an authorized operator can change case stage or activate Holds.</p></div>
            <span className="mz-case-next-state">{activeHolds.length} active workspace {activeHolds.length === 1 ? "hold" : "holds"}</span>
          </footer>
            </>
          ) : detailTab === "evidence" ? (
            <>
              <p className="mz-case-pane-explanation">Only authorized linked receipts and the governed Registry review are available here.
                The source-grade, ACH and custody library require their own accepted evidence records.</p>
              <div className="mz-case-facts">
            <section aria-label="Source and provenance">
              <span className="mz-case-eyebrow">Source and provenance</span>
              <strong>{focusedCase.receiptCount} linked {focusedCase.receiptCount === 1 ? "receipt" : "receipts"}</strong>
              <p>{focusedCase.reviewId ? "An exact Registry review is linked to this case." : "No source review reference is recorded for this case."}</p>
              {focusedCase.reviewId && sourceReview && onInspectReview ? (
                <WkButton variant="soft" className="wk-button-sm"
                  onClick={() => onInspectReview(focusedCase.reviewId!)}>Inspect evidence in Workbench</WkButton>
              ) : focusedCase.reviewId ? (
                <a className="mz-case-link" href={`/admin/review/queue?review=${encodeURIComponent(focusedCase.reviewId)}`}>
                  Inspect source review
                </a>
              ) : null}
            </section>
            <section aria-label="Decision and execution boundary">
              <span className="mz-case-eyebrow">Decision boundary</span>
              <strong>No automatic Registry correction</strong>
              <p>The current case interface does not confer publication, external disclosure, a rights decision, or a write grant.</p>
              <span className="mz-case-muted-state">Decision authority remains separate</span>
            </section>
          </div>
            </>
          ) : detailTab === "next" ? (
            <section className="mz-case-future" aria-label="Next evidence for this case">
              <span className="mz-case-eyebrow">Next evidence</span>
              <h3>No recorded evidence requests available.</h3>
              <p>The current authorized case read does not contain source-backed proposed collection tasks,
                custodian consent or a research request queue.</p>
              <p>{focusedCase.nextActionAt
                ? <>Recorded case next-action time: <WkZonedTimestamp value={focusedCase.nextActionAt}/></>
                : "No case next-action date has been recorded."}</p>
            </section>
          ) : (
            <>
              <section className="mz-case-history" aria-label="Recent case journal">
            <div className="mz-case-section-head"><span className="mz-case-eyebrow">Recorded activity</span><span className="mz-case-eyebrow">Immutable case events</span></div>
            {recentEventsState === "loading" ? <p role="status">Loading case history…</p> : null}
            {recentEventsState === "error" ? <p role="alert">The case journal could not be verified.</p> : null}
            {recentEventsState === "ready" && !recentEvents.length ? <p>No recorded case events were returned.</p> : null}
            {recentEventsState === "ready" ? recentEvents.slice(0, 3).map(event => (
              <div className="mz-case-event" key={event.eventId}>
                <span className="mz-case-event-rev">Rev {event.revision}</span>
                <div><strong>{event.stage.replaceAll("_"," ")}</strong><p>{event.reason}</p></div>
                <WkZonedTimestamp value={event.recordedAt}/>
              </div>
            )) : null}
          </section>
              <p className="mz-case-pane-explanation">This is a recent journal view, not the complete authenticated case export.
                Open case controls for the full verified event timeline.</p>
            </>
          )}
            </>
          ) : (
            <section className="mz-case-machine" aria-label="Authorized case machine record">
              <h3>Machine View</h3>
              <p>This read-only record comes from the same authorized case as the Human View.
                It does not grant actions, verify evidence, or authorize publication.</p>
              <pre><code>{JSON.stringify(projectHeadquartersCaseMachineReadV1(focusedCase), null, 2)}</code></pre>
            </section>
          )}
        </article>
      </div>
    ) : null}
    <WkDisclosure
      summary="Case controls, complete journal and Hold Writes"
      className="mz-case-operations"
      triggerClassName="mz-case-operations-trigger"
      contentClassName="mz-case-operations-detail"
    >
      <WkSurface className="space-y-4 p-5" data-wk-mizizi-durable-cases>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-[18px] font-semibold text-wk-text">Recorded Cases</h2>
        <p className="mt-1 text-[12px] text-wk-text-muted">Actual case, receipt, and Hold Writes records. Registry reviews remain separate.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <WkButton variant="soft" className="wk-button-sm" onClick={reload} disabled={busy}>Refresh Records</WkButton>
        {state.kind==="ready" ? <WkButton variant="soft" className="wk-button-sm" onClick={()=>void downloadRedactedAudit()} disabled={busy}>Export Redacted Audit</WkButton> : null}
      </div>
    </header>
    {state.kind==="loading" ? <p role="status" className="text-[13px] text-wk-text-muted">Checking recorded case access…</p> : null}
    {state.kind==="unavailable" ? <p role="alert" className="text-[13px] text-wk-text-muted">
      We could not verify Headquarters case access. Refresh Records to try again. No workspace changes were made.
    </p> : null}
    {state.kind==="denied" ? <div className="space-y-3" role="status">
      <p className="text-[13px] text-wk-text-muted">No authorized internal Headquarters case view is available for this account. Existing Registry reviews remain accessible above.</p>
      {canOfferSetup ? <>
        <p className="text-[12px] text-wk-text-muted">First-owner setup is permitted only before the workspace has a member. If Headquarters is already initialized, request reviewed membership from its owner.</p>
        <ReasonField value={bootstrapReason} onChange={setBootstrapReason} label="Internal Workspace Setup Reason" />
        <WkButton variant="soft" disabled={busy||!actionReason(bootstrapReason)}
          onClick={()=>void takeAction(async()=>{await bootstrapHeadquartersOwnerV1(bootstrapReason);},"Internal workspace membership recorded.")}>
          Set Up Internal Workspace</WkButton>
      </> : <p className="text-[12px] text-wk-text-muted">Headquarters case access requires an authorized workspace membership. Request reviewed access from its owner.</p>}
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
      </WkSurface>
    </WkDisclosure>
  </div>;
}
