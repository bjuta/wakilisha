import {useRef, useState, type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import {WkUploadField} from "@/components/design-system/primitives/UploadField";
import {prepareWk100LocalShazamResearch} from "@/services/chartsIngestion/wk100LocalShazamResearch.mjs";
import {
  getWk100ArchivedResearchPortfolio,
  verifyWk100ArchivedOriginal,
} from "@/services/chartsIngestion/wk100ResearchPortfolio.mjs";
import {submitWk100HtmlResearchEvidence} from "@/services/chartsIngestion/wk100HtmlResearchIntakeClient.mjs";
import {
  submitWk100ResearchEvidence, type Wk100ResearchIntakeAck,
} from "@/services/chartsIngestion/wk100ResearchIntakeClient.mjs";

type Props={weekStartEat:string;draftSaved:boolean};

const errors:Record<string,string>={
  week_invalid:"Choose a valid East Africa Time Monday for this week.",
  csv_invalid:"Choose the original Shazam Kenya CSV, up to 4 MiB.",
  receipt_invalid:"Choose its unchanged researcher receipt JSON, up to 4 KiB.",
  original_bytes_mismatch:"The CSV does not match its receipt. Select the original files.",
  transport_unavailable:"The private research service is unavailable.",
  authentication_required:"Your Admin session has expired. Sign in again before uploading.",
  not_authorized:"Your account needs chart and ingest stewardship to upload research.",
  capability_unavailable:"We could not confirm your permissions. Try again later.",
  intake_not_enabled:"Private research intake is not enabled for this environment.",
  backend_unavailable:"The restricted research service is not configured.",
  research_payload_invalid:"The server rejected the submitted files. Review the originals.",
  research_source_invalid:"The source or receipt did not pass server verification.",
  research_receipt_not_verified:"The private receipt was not finalized. Keep both files and retry the same observation.",
  unverified_ack:"The server did not confirm a complete private receipt. Nothing is marked saved.",
  server_unavailable:"The server could not confirm this upload. Keep both files and retry.",
};
function messageFor(error:unknown):string{
  const raw=error instanceof Error?error.message:"";
  const prefix="wk100_research_ui_";
  const code=raw.startsWith(prefix)?raw.slice(prefix.length):"server_unavailable";
  return errors[code]??errors.server_unavailable;
}

export function Wk100ResearchEvidencePanel({weekStartEat,draftSaved}:Props){
  const [originalCsv,setOriginalCsv]=useState<File|null>(null);
  const [receiptFile,setReceiptFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [ack,setAck]=useState<Wk100ResearchIntakeAck|null>(null);
  const [htmlSource,setHtmlSource]=useState<"mdundo_ke"|"apple_ke_public_playlist">("mdundo_ke");
  const [htmlFile,setHtmlFile]=useState<File|null>(null);
  const [htmlBusy,setHtmlBusy]=useState(false);
  const [htmlError,setHtmlError]=useState<string|null>(null);
  const [htmlSaved,setHtmlSaved]=useState<string|null>(null);
  const archivedResearch=getWk100ArchivedResearchPortfolio(weekStartEat);
  const [newResearchCsv,setNewResearchCsv]=useState<File|null>(null);
  const [newResearchChecking,setNewResearchChecking]=useState(false);
  const [newResearchReceipt,setNewResearchReceipt]=useState<Awaited<ReturnType<typeof prepareWk100LocalShazamResearch>>|null>(null);
  const [newResearchError,setNewResearchError]=useState<string|null>(null);
  const newResearchEpoch=useRef(0);
  async function inspectNewResearch(){
    if(!newResearchCsv||newResearchChecking)return;
    const version=++newResearchEpoch.current;
    setNewResearchChecking(true);
    setNewResearchReceipt(null);
    setNewResearchError(null);
    try {
      if(newResearchCsv.size<1||newResearchCsv.size>4*1024*1024)
        throw new Error('invalid_local_csv_size');
      const bytes=new Uint8Array(await newResearchCsv.arrayBuffer());
      const receipt=await prepareWk100LocalShazamResearch({
        originalBytes:bytes,checkedAtUtc:new Date().toISOString(),
      });
      if(version===newResearchEpoch.current)setNewResearchReceipt(receipt);
    }catch{
      if(version===newResearchEpoch.current)
        setNewResearchError("The file does not contain a valid Kenya chart CSV. Nothing was saved or uploaded.");
    }finally{
      if(version===newResearchEpoch.current)setNewResearchChecking(false);
    }
  }
  function downloadNewResearchReceipt(){
    if(!newResearchReceipt)return;
    const blob=new Blob([JSON.stringify(newResearchReceipt,null,2)+"\n"],
      {type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download='wk100-shazam-kenya-local-research-'+
      newResearchReceipt.checked_at_utc.slice(0,10)+'.json';
    anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const [localSourceKey,setLocalSourceKey]=useState("shazam_ke");
  const [localOriginal,setLocalOriginal]=useState<File|null>(null);
  const [localChecking,setLocalChecking]=useState(false);
  const [localResult,setLocalResult]=useState<{matched:boolean;message:string}|null>(null);
  const localEpoch=useRef(0);
  const ready=draftSaved&&originalCsv!==null&&receiptFile!==null&&!busy;
  function selectLocalSource(sourceKey:string){
    localEpoch.current+=1;
    setLocalSourceKey(sourceKey);
    setLocalOriginal(null);
    setLocalResult(null);
    setLocalChecking(false);
  }
  function selectLocalOriginal(file:File|null){
    localEpoch.current+=1;
    setLocalOriginal(file);
    setLocalResult(null);
    setLocalChecking(false);
  }
  async function verifyLocalOriginal(){
    if(!localOriginal||localChecking)return;
    const source=archivedResearch.find(s=>s.sourceKey===localSourceKey);
    const token=++localEpoch.current;
    setLocalChecking(true);setLocalResult(null);
    try{
      // A local browser read, not an upload. Reject wrong sizes before copying
      // into memory. Do not retain contents, file names or raw bytes in state.
      if(!source||localOriginal.size!==source.byteLength)
        throw new Error("wk100_archived_original_mismatch");
      const bytes=new Uint8Array(await localOriginal.arrayBuffer());
      const receipt=await verifyWk100ArchivedOriginal({
        weekStartEat,sourceKey:localSourceKey,originalBytes:bytes,
      });
      if(token===localEpoch.current){
        setLocalResult({
          matched:true,
          message:receipt.privateOriginalMatchesArchivedReceipt
            ?"Local SHA-256 matches the original October research receipt. No file was uploaded, no hosted receipt was created, and this does not establish a scoring period."
            :"The original could not be verified.",
        });
      }
    }catch{
      if(token===localEpoch.current)setLocalResult({
        matched:false,message:"This file does not match the archived original. Select the unchanged October file; nothing was uploaded.",
      });
    }finally{
      if(token===localEpoch.current)setLocalChecking(false);
    }
  }
  function changeCsv(file:File|null){
    if(busy)return;
    setOriginalCsv(file);setAck(null);setError(null);
  }
  function changeReceipt(file:File|null){
    if(busy)return;
    setReceiptFile(file);setAck(null);setError(null);
  }
  async function upload(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!ready||!originalCsv||!receiptFile)return;
    setBusy(true);setError(null);setAck(null);
    try{
      const result=await submitWk100ResearchEvidence({
        originalCsv,receiptFile,weekStartEat,
        invoke:(name,options)=>supabase.functions.invoke(name,options),
      });
      setAck(result);
    }catch(cause){setError(messageFor(cause));}
    finally{setBusy(false);}
  }
  async function uploadHtml(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!draftSaved||!htmlFile||htmlBusy||busy||archivedResearch.length===0)return;
    setHtmlBusy(true);setHtmlError(null);setHtmlSaved(null);
    try{
      const saved=await submitWk100HtmlResearchEvidence({
        sourceKey:htmlSource,originalHtml:htmlFile,weekStartEat,
        invoke:(name,options)=>supabase.functions.invoke(name,options),
      });
      setHtmlSaved(saved.sourceKey);
    }catch(cause){
      const code=cause instanceof Error&&cause.message.startsWith("wk100_html_ui_")
        ?cause.message.slice("wk100_html_ui_".length):"server_unavailable";
      const extra:Record<string,string>={
        source_not_supported:"Only the two previously audited October HTML sources are eligible here.",
        original_bytes_mismatch:"The selected HTML does not match the archived original. Keep the original unchanged.",
      };
      setHtmlError(extra[code]??errors[code]??errors.server_unavailable);
    }finally{setHtmlBusy(false);}
  }
  function chooseHtmlSource(next:"mdundo_ke"|"apple_ke_public_playlist"){
    if(htmlBusy)return;
    setHtmlSource(next);setHtmlFile(null);setHtmlError(null);setHtmlSaved(null);
  }
  return <section aria-labelledby="wk100-research-heading"
    className="rounded-xl border border-wk-border bg-wk-surface p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="wk100-research-heading" className="text-base font-bold text-wk-text">
          Private Research Evidence
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-wk-text-soft">
          Select the Shazam Kenya CSV and its matching research receipt, including one saved above.
          We verify and retain the original bytes in restricted private storage.
        </p>
      </div>
      <span className="rounded-full border border-wk-border px-3 py-1 text-xs font-semibold text-wk-text-soft">
        Research only
      </span>
    </div>
    <p className="mt-3 text-xs text-wk-text-muted">
      Week of {weekStartEat} (East Africa Time). The source’s native measurement period remains
      unknown. This observation does not authorize scoring, ranking or publication.
    </p>
    <div className="mt-4 rounded-lg border border-wk-border bg-wk-surface-raised p-3"
      aria-label="New local Shazam research">
      <h3 className="text-sm font-semibold text-wk-text">Inspect a New Shazam Chart</h3>
      <p className="mt-1 text-xs text-wk-text-muted">
        Download the offered CSV from the Kenya Top 200 chart, then select it here.
        We check its ranks and original SHA-256 on this device. We do not upload
        the file, infer a reporting week, or add it to a published chart.
      </p>
      <a href="https://www.shazam.com/charts/top-200/kenya"
        target="_blank" rel="noopener noreferrer"
        className="mt-3 inline-flex text-sm font-semibold text-wk-text underline">
        Open Shazam Kenya Top 200
      </a>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <WkUploadField id="wk100-new-shazam-local"
          label="Select downloaded Kenya chart CSV"
          ariaLabel="Select downloaded Kenya chart CSV"
          accept=".csv,text/csv"
          disabled={newResearchChecking}
          onSelect={files=>{
            newResearchEpoch.current+=1;
            setNewResearchCsv(files?.[0]??null);
            setNewResearchReceipt(null);
            setNewResearchError(null);
            setNewResearchChecking(false);
          }}/>
        <button type="button" onClick={()=>{void inspectNewResearch()}}
          disabled={!newResearchCsv||newResearchChecking}
          className="wk-button wk-button-secondary wk-button-sm disabled:cursor-not-allowed disabled:opacity-50">
          {newResearchChecking?"Checking local chart…":"Inspect Local Chart"}
        </button>
      </div>
      {newResearchError&&<p role="alert" className="mt-3 text-xs text-wk-danger">
        {newResearchError}
      </p>}
      {newResearchReceipt&&<div role="status" className="mt-3 space-y-2 text-xs text-wk-text">
        <p>
          {newResearchReceipt.observed_rank_count} valid discovery ranks.
          {newResearchReceipt.complete_chart
            ?" All 200 positions are present."
            :" The file has fewer than 200 positions."}
        </p>
        <p className="break-all">Original SHA-256: {newResearchReceipt.original_sha256}</p>
        <p>
          File checked {newResearchReceipt.checked_at_utc}.
          This does not establish when the provider served it or its exact measurement period.
        </p>
        <button type="button" onClick={downloadNewResearchReceipt}
          className="wk-button wk-button-secondary wk-button-sm">
          Save Local Research Receipt
        </button>
      </div>}
    </div>
    <form className="mt-4 space-y-3" onSubmit={upload}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-wk-border bg-wk-surface-raised p-3">
          <p className="text-sm font-semibold text-wk-text">Original Shazam CSV</p>
          <p className="mt-1 text-xs text-wk-text-muted">
            {originalCsv?"Original CSV selected":"No CSV selected"}
          </p>
          <WkUploadField
            id="wk100-research-csv"
            className="mt-3"
            label="Select original CSV"
            ariaLabel="Select original CSV"
            accept=".csv,text/csv"
            disabled={busy}
            onSelect={files=>changeCsv(files?.[0]??null)}/>
        </div>
        <div className="rounded-lg border border-wk-border bg-wk-surface-raised p-3">
          <p className="text-sm font-semibold text-wk-text">Research receipt</p>
          <p className="mt-1 text-xs text-wk-text-muted">
            {receiptFile?"Research receipt selected":"No receipt selected"}
          </p>
          <WkUploadField
            id="wk100-research-receipt"
            className="mt-3"
            label="Select matching receipt JSON"
            ariaLabel="Select matching receipt JSON"
            accept=".json,application/json"
            disabled={busy}
            onSelect={files=>changeReceipt(files?.[0]??null)}/>
        </div>
      </div>
      {!draftSaved&&<p className="text-xs text-wk-text-muted">
        Save the full weekly Admin configuration to the server before submitting evidence.
      </p>}
      <button type="submit" disabled={!ready}
        className="wk-button wk-button-primary wk-button-sm disabled:cursor-not-allowed disabled:opacity-50">
        {busy?"Verifying private evidence…":"Verify and save research observation"}
      </button>
    </form>
    {error&&<p className="mt-3 text-sm text-wk-danger" role="alert">{error}</p>}
    {ack&&<p className="mt-3 text-sm text-wk-text" role="status" aria-live="polite">
      Private original bytes verified and receipt saved for {ack.weekStartEat}.
      {" "}{ack.observedDepth} discovery ranks recorded. Research only; not admitted for
      chart scoring or publication.
    </p>}
    {archivedResearch.length>0&&<div className="mt-5 border-t border-wk-border pt-4"
      aria-label="Previously captured source research">
      <h3 className="text-sm font-semibold text-wk-text">Research already captured for this week</h3>
      <p className="mt-1 text-xs text-wk-text-muted">
        These are October 29–30 operator-archive audit references, not live Supabase
        receipts. We will reuse the original files rather than request fresh downloads.
        No source is admitted to scoring or publication.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {archivedResearch.map(source=><li key={source.sourceKey}
          className="rounded-lg border border-wk-border bg-wk-surface-raised p-3">
          <p className="text-sm font-semibold text-wk-text">{source.displayName}</p>
          <p className="mt-1 text-xs text-wk-text-soft">
            {source.rankStructure==="verified"
              ?`${source.rankDepth} source-native ranks audited`
              :"Original preserved; ranked recording structure unresolved"}
          </p>
          <p className="mt-1 text-xs text-wk-text-muted">{source.note}</p>
        </li>)}
      </ul>
      <div className="mt-4 rounded-lg border border-wk-border bg-wk-surface-raised p-3"
        aria-label="Local archived original verification">
        <h4 className="text-sm font-semibold text-wk-text">Verify a preserved original locally</h4>
        <p className="mt-1 text-xs text-wk-text-muted">
          Compare any unchanged October CSV or HTML file against the previously audited
          SHA-256 receipt. The browser reads the selected file only on this device.
          No network upload, database write, saved Admin draft or collector permission is needed.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Select archived research source">
          {archivedResearch.map(source=><button key={source.sourceKey} type="button"
            aria-pressed={localSourceKey===source.sourceKey} disabled={localChecking}
            onClick={()=>selectLocalSource(source.sourceKey)}
            className={localSourceKey===source.sourceKey
              ?"wk-button wk-button-primary wk-button-sm"
              :"wk-button wk-button-secondary wk-button-sm"}>
            {source.displayName}
          </button>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <WkUploadField id="wk100-archived-local-original"
            label="Choose original for local verification"
            ariaLabel="Choose original for local verification"
            accept={localSourceKey==="shazam_ke"?".csv,text/csv":".html,text/html"}
            disabled={localChecking}
            onSelect={files=>selectLocalOriginal(files?.[0]??null)}/>
          <button type="button" onClick={()=>{void verifyLocalOriginal()}}
            disabled={!localOriginal||localChecking}
            className="wk-button wk-button-secondary wk-button-sm disabled:cursor-not-allowed disabled:opacity-50">
            {localChecking?"Checking local SHA-256…":"Verify original on this device"}
          </button>
        </div>
        {localResult&&<p role={localResult.matched?"status":"alert"} aria-live="polite"
          className={localResult.matched
            ?"mt-3 text-xs text-wk-text":"mt-3 text-xs text-wk-danger"}>
          {localResult.message}
        </p>}
      </div>
      <div className="mt-4 rounded-lg border border-wk-border bg-wk-surface-raised p-3">
        <h4 className="text-sm font-semibold text-wk-text">Verify preserved Apple or Mdundo HTML</h4>
        <p className="mt-1 text-xs text-wk-text-muted">
          Select only the unchanged October original already saved privately. The service
          verifies its exact bytes, native ranks and private receipt. Audiomack remains
          research-only and is not eligible for this upload.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Original research provider">
          {([
            ["mdundo_ke","Mdundo Kenya"],
            ["apple_ke_public_playlist","Apple Music Kenya"],
          ] as const).map(([key,label])=><button key={key} type="button"
            disabled={htmlBusy||busy} aria-pressed={htmlSource===key}
            onClick={()=>chooseHtmlSource(key)}
            className={htmlSource===key?"wk-button wk-button-primary wk-button-sm":
              "wk-button wk-button-secondary wk-button-sm"}>{label}</button>)}
        </div>
        <form onSubmit={uploadHtml} className="mt-3 flex flex-wrap items-center gap-3">
          <WkUploadField
            id="wk100-research-original-html"
            label="Select preserved HTML"
            ariaLabel="Select preserved HTML"
            accept=".html,text/html"
            disabled={htmlBusy||busy}
            onSelect={files=>{setHtmlFile(files?.[0]??null);
              setHtmlError(null);setHtmlSaved(null);}}/>
          <span className="text-xs text-wk-text-muted">
            {htmlFile?"Original HTML selected":"No HTML selected"}
          </span>
          <button type="submit"
            disabled={!draftSaved||!htmlFile||htmlBusy||busy}
            className="wk-button wk-button-primary wk-button-sm disabled:cursor-not-allowed disabled:opacity-50">
            {htmlBusy?"Verifying private HTML…":"Verify and save HTML"}
          </button>
        </form>
        {htmlError&&<p role="alert" className="mt-3 text-sm text-wk-danger">{htmlError}</p>}
        {htmlSaved&&<p role="status" aria-live="polite"
          className="mt-3 text-sm text-wk-text">
          {htmlSaved==="mdundo_ke"?"Mdundo Kenya":"Apple Music Kenya"} original
          verified and private receipt finalized. Research only; not admitted for
          scoring or publication.
        </p>}
        {!draftSaved&&<p className="mt-2 text-xs text-wk-text-muted">
          Save the complete weekly Admin configuration before uploading.
        </p>}
      </div>
      <p className="mt-3 text-xs text-wk-text-muted">
        Shazam CSV uses its separate protected intake above. Apple and Mdundo
        retain separate native methods; Audiomack requires verified ranked recording
        semantics. None of these observations establishes a common source-native week.
      </p>
    </div>}
    <p className="mt-3 text-xs text-wk-text-muted">
      Original ranks and researcher details stay off this page and out of browser storage.
      Keep both files for reconciliation if the server cannot confirm the receipt.
    </p>
  </section>;
}
