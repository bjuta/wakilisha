import { useState } from 'react';
import { Input, TextArea, TextField } from 'react-aria-components';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/design-system/primitives/Modal';
import { WkSelect } from '@/components/design-system/primitives/Select';
import { WkDetailList } from '@/components/design-system/primitives/DetailList';

export type Wk100ProposalRecord={
  id:string;providerKey:string;sourceKey:string;revision:number;surface:string;methodClass:string;
  behavior:string;metric:string;expectedDepth:number;cadence:string;
  intervalHours:number|null;eatHour:number;eatMinute:number;weekdayEat:number|null;
  minimumHealthyCheckpoints:number;evidenceReference:string;reason:string|null;
  createdAt:string;state:'proposed';canCollect:false;canScore:false;canPublish:false;
};

type Draft={
  providerKey:string;sourceKey:string;surface:string;methodClass:string;behavior:string;metric:string;
  expectedDepth:number;cadence:string;intervalHours:number|null;
  eatHour:number;eatMinute:number;weekdayEat:number|null;
  minimumHealthyCheckpoints:number;evidenceReference:string;reason:string|null;
};
const providers=[
  {value:'youtube_ke',label:'YouTube Kenya'},
  {value:'spotify_ke',label:'Spotify Kenya'},
  {value:'boomplay_ke',label:'Boomplay Kenya'},
  {value:'apple_ke',label:'Apple Music Kenya'},
  {value:'mdundo_ke',label:'Mdundo Kenya'},
  {value:'shazam_ke',label:'Shazam Kenya'},
  {value:'audiomack_ke',label:'Audiomack Kenya'},
];
const methodOptions=[
  {value:'provider_api',label:'Provider API'},
  {value:'offered_export',label:'Provider-offered export'},
  {value:'reviewed_page_adapter',label:'Reviewed page adapter'},
  {value:'research_only',label:'Research only'},
];
const behaviorOptions=[
  {value:'consumption',label:'Consumption'},
  {value:'video_consumption',label:'Video consumption'},
  {value:'discovery',label:'Discovery'},
  {value:'ugc_curation',label:'User curation'},
  {value:'broadcast_exposure',label:'Broadcast exposure'},
];
const metricOptions=[
  {value:'rank',label:'Native rank'},
  {value:'rank_and_count',label:'Rank and provider-native count'},
  {value:'event_count',label:'Provider-native event count'},
];
const cadenceOptions=[
  {value:'daily',label:'Daily'},
  {value:'weekly',label:'Weekly'},
  {value:'interval_hours',label:'Repeated interval'},
];
const weekdayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const rangeOptions=(length:number,from=0)=>Array.from({length},(_,i)=>({
  value:String(i+from),label:String(i+from).padStart(2,'0'),
}));
const entry=(record:Wk100ProposalRecord|null):Draft=>record?{
  providerKey:record.providerKey,sourceKey:record.sourceKey,surface:record.surface,methodClass:record.methodClass,
  behavior:record.behavior,metric:record.metric,expectedDepth:record.expectedDepth,
  cadence:record.cadence,intervalHours:record.intervalHours,
  eatHour:record.eatHour,eatMinute:record.eatMinute,weekdayEat:record.weekdayEat,
  minimumHealthyCheckpoints:record.minimumHealthyCheckpoints,
  evidenceReference:record.evidenceReference,reason:record.reason,
}: {
  providerKey:'',sourceKey:'',surface:'',methodClass:'provider_api',behavior:'consumption',metric:'rank',
  expectedDepth:100,cadence:'weekly',intervalHours:null,eatHour:12,eatMinute:0,
  weekdayEat:0,minimumHealthyCheckpoints:1,evidenceReference:'',reason:null,
};
function ProposalField({label,value,onChange,limit,area=false,disabled=false}:{
  label:string;value:string;onChange:(v:string)=>void;limit:number;area?:boolean;disabled?:boolean;
}){
  return <TextField aria-label={label} value={value} onChange={onChange} isDisabled={disabled} className="block min-w-0">
    <span className="mb-1 block text-xs font-semibold text-wk-text-muted">{label}</span>
    {area?<TextArea maxLength={limit} className="wk-input min-h-20 w-full rounded-xl border-wk-border bg-wk-surface text-[16px] text-wk-text"/>:
      <Input maxLength={limit} className="wk-input w-full rounded-xl border-wk-border bg-wk-surface text-[16px] text-wk-text"/>}
  </TextField>;
}
function Choose({label,value,onChange,options}:{
  label:string;value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];
}){
  return <div className="min-w-0"><p className="mb-1 text-xs font-semibold text-wk-text-muted">{label}</p>
    <WkSelect ariaLabel={label} value={value} onChange={onChange} options={options}/></div>;
}

export function SourceProposalForm({close,onSaved,existing,initial=null}:{
  close:()=>void;onSaved:()=>void;existing:Wk100ProposalRecord[];initial?:Wk100ProposalRecord|null;
}){
  const [draft,setDraft]=useState<Draft>(()=>entry(initial));
  const [step,setStep]=useState(initial?2:1);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const change=<K extends keyof Draft>(name:K,value:Draft[K])=>{
    setDraft(current=>({...current,[name]:value}));setError('');
  };
  const existingKeys=new Set(existing.map(p=>p.sourceKey));
  const sourceIdValid=draft.sourceKey.length<=64 &&
    new RegExp('^'+draft.providerKey+'_[a-z][a-z0-9_]{1,45}$').test(draft.sourceKey) &&
    (initial!==null || !existingKeys.has(draft.sourceKey));
  const maxCheckpoints=draft.cadence==='weekly'?1:draft.cadence==='daily'?7:
    168/(draft.intervalHours??24);
  const fieldValid = sourceIdValid && draft.surface.trim().length>=3 && draft.evidenceReference.trim().length>=1 &&
    draft.expectedDepth>=1 && draft.expectedDepth<=500 &&
    draft.minimumHealthyCheckpoints>=1 && draft.minimumHealthyCheckpoints<=maxCheckpoints;
  const submit=async()=>{
    if(!fieldValid||busy)return;
    setBusy(true);setError('');
    try{
      const payload={...draft,surface:draft.surface.trim(),evidenceReference:draft.evidenceReference.trim(),
        reason:draft.reason?.trim()||null};
      const {data,error:callError}=await supabase.functions.invoke('wk100-source-admin-proposals',{
        body:{action:'submit_source_proposal',proposal:payload,expectedRevision:initial?.revision??0},
      });
      if(callError||!data||data.schemaVersion!=='wk100-source-proposal-written-v1'||
        !data.saved||data.saved.state!=='proposed'||data.saved.canCollect!==false||
        data.saved.canScore!==false||data.saved.canPublish!==false||
        data.saved.providerKey!==draft.providerKey||data.saved.sourceKey!==draft.sourceKey||
        data.saved.revision!==(initial?.revision??0)+1)
        throw new Error(data?.error==='proposal_revision_conflict'?'This proposal changed. Reload the Source Registry before revising.':'The proposal was not confirmed by the protected server. Nothing is assumed saved.');
      onSaved();close();
    }catch(e){setError(e instanceof Error?e.message:'Source proposal could not be saved.');}
    finally{setBusy(false);}
  };
  return <Modal open={true} onClose={close} dismissable={!busy} maxWidth="3xl"
    title={initial?'Revise source proposal':'Add Source'}
    footer={<div className="flex items-center justify-between gap-3">
      <button type="button" disabled={busy} className="wk-button wk-button-secondary wk-button-sm"
        onClick={()=>step===1||(initial&&step===2)?close():setStep(n=>n-1)}>{step===1||(initial&&step===2)?'Cancel':'Back'}</button>
      {step<3?<button type="button" className="wk-button wk-button-primary wk-button-sm"
        disabled={busy||(step===1&&!draft.providerKey)||(step===2&&!fieldValid)}
        onClick={()=>setStep(n=>n+1)}>Continue</button>:
        <button type="button" className="wk-button wk-button-primary wk-button-sm"
          disabled={busy||!fieldValid} onClick={()=>void submit()}>{busy?'Saving…':'Save proposal'}</button>}
    </div>}>
    <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-wk-text-muted">
      Proposal only · no admission, automated collection, scoring or publication
    </p>
    <h3 className="mt-3 text-xl font-bold text-wk-text">
      {step===1?'Choose a Kenya provider':step===2?'Configure the proposed source method':'Review before saving'}
    </h3>
    <ol aria-label="Source proposal steps" className="mt-3 flex flex-wrap gap-2 text-xs text-wk-text-muted">
      <li className={step===1?'font-bold text-wk-text':''}>1 Provider and method</li>
      <li aria-hidden>→</li><li className={step===2?'font-bold text-wk-text':''}>2 Proposed surface and timing</li>
      <li aria-hidden>→</li><li className={step===3?'font-bold text-wk-text':''}>3 Review</li>
    </ol>
    {step===1&&<div className="mt-5 space-y-3">
      <p className="text-xs leading-relaxed text-wk-text-muted">
        Choose a Kenya provider and proposed source method. Public research remains
        independent; selecting a method does not grant unattended collection.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
      {providers.map(provider=><button key={provider.value} type="button"
        aria-pressed={draft.providerKey===provider.value}
        onClick={()=>setDraft(d=>({...d,providerKey:provider.value,sourceKey:provider.value+'_'}))}
        className={'min-h-20 rounded-2xl border p-4 text-left font-semibold '+
          (draft.providerKey===provider.value?'border-wk-brand bg-wk-brand-soft text-wk-text':
            'border-wk-border text-wk-text-soft hover:bg-wk-surface-raised')}>{provider.label}
        <span className="mt-1 block text-xs font-normal">{existing.filter(p=>p.providerKey===provider.value).length} existing proposed sources</span>
      </button>)}
      </div>
      {draft.providerKey&&<div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
        <Choose label="Proposed access method" value={draft.methodClass}
          onChange={v=>change('methodClass',v)} options={methodOptions}/>
        <p className="mt-2 text-xs text-wk-text-muted">
          Method availability is not an approval claim. The separately audited
          source-method decision controls unattended collection.
        </p>
      </div>}
    </div>}
    {step===2&&<div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <ProposalField label="Stable source ID (provider-scoped)" value={draft.sourceKey}
          onChange={v=>change('sourceKey',v)} limit={64} disabled={!!initial}/>
        <p className="mt-1 text-xs text-wk-text-muted">Use a distinct permanent ID per chart, playlist or feed, e.g. youtube_ke_top_songs_weekly. It cannot be renamed after creation.</p>
        {!initial&&existingKeys.has(draft.sourceKey)&&<p role="alert" className="mt-1 text-xs text-wk-danger">This source ID already exists. Revise that source or choose another ID.</p>}
      </div>
      <div className="sm:col-span-2"><ProposalField label="Source surface" value={draft.surface}
        onChange={v=>change('surface',v)} limit={180}/></div>
      <Choose label="Access method class" value={draft.methodClass} onChange={v=>change('methodClass',v)} options={methodOptions}/>
      <Choose label="Observation behavior" value={draft.behavior} onChange={v=>change('behavior',v)} options={behaviorOptions}/>
      <Choose label="Provider-native measurement" value={draft.metric} onChange={v=>change('metric',v)} options={metricOptions}/>
      <Choose label="Expected depth" value={String(draft.expectedDepth)}
        onChange={v=>change('expectedDepth',Number(v))}
        options={[10,20,25,50,75,100,150,200,250,500].map(n=>({value:String(n),label:String(n)}))}/>
      <Choose label="Cadence" value={draft.cadence} options={cadenceOptions}
        onChange={v=>setDraft(d=>({...d,cadence:v,intervalHours:v==='interval_hours'?24:null,
          weekdayEat:v==='weekly'?0:null,minimumHealthyCheckpoints:1}))}/>
      {draft.cadence==='interval_hours'&&<Choose label="Interval in hours"
        value={String(draft.intervalHours??24)} options={[3,4,6,8,12,24].map(n=>({value:String(n),label:String(n)}))}
        onChange={v=>setDraft(d=>({...d,intervalHours:Number(v),minimumHealthyCheckpoints:1}))}/>}
      {draft.cadence==='weekly'&&<Choose label="Day of week (EAT)"
        value={String(draft.weekdayEat??0)} onChange={v=>change('weekdayEat',Number(v))}
        options={weekdayNames.map((name,i)=>({value:String(i),label:name}))}/>}
      <Choose label="Hour (EAT)" value={String(draft.eatHour)} onChange={v=>change('eatHour',Number(v))} options={rangeOptions(24)}/>
      <Choose label="Minute (EAT)" value={String(draft.eatMinute)} onChange={v=>change('eatMinute',Number(v))} options={rangeOptions(60)}/>
      <Choose label="Minimum healthy checkpoints" value={String(draft.minimumHealthyCheckpoints)}
        onChange={v=>change('minimumHealthyCheckpoints',Number(v))} options={rangeOptions(maxCheckpoints,1)}/>
      <div className="sm:col-span-2"><ProposalField label="Internal evidence reference (no URLs or secrets)"
        value={draft.evidenceReference} onChange={v=>change('evidenceReference',v)} limit={240}/></div>
      <div className="sm:col-span-2"><ProposalField label="Reason for the source proposal"
        value={draft.reason??''} onChange={v=>change('reason',v||null)} limit={500} area/></div>
      <p className="sm:col-span-2 text-xs leading-relaxed text-wk-text-muted">
        Timing is a proposed EAT collection cadence, not a scheduled job. The source requires independent method qualification.
      </p>
    </div>}
    {step===3&&<div className="mt-5 space-y-4">
      <WkDetailList items={[
        {label:'Provider',value:providers.find(p=>p.value===draft.providerKey)?.label||draft.providerKey},
        {label:'Stable source ID',value:draft.sourceKey},
        {label:'Source surface',value:draft.surface},
        {label:'Method',value:methodOptions.find(x=>x.value===draft.methodClass)?.label||draft.methodClass},
        {label:'Behavior',value:draft.behavior},
        {label:'Native metric',value:draft.metric},
        {label:'Depth',value:draft.expectedDepth},
        {label:'Cadence',value:draft.cadence},
        {label:'EAT hour',value:String(draft.eatHour).padStart(2,'0')+':'+String(draft.eatMinute).padStart(2,'0')},
        {label:'Evidence reference',value:draft.evidenceReference},
        {label:'Next proposal revision',value:(initial?.revision??0)+1},
      ]}/>
      <p className="rounded-xl bg-wk-surface-raised p-4 text-xs leading-relaxed text-wk-text-muted">
        Saving appends an auditable proposed revision. It cannot enroll a capture contract, qualify a source,
        create a scheduled task, or grant ranking or publishing authority.
      </p>
    </div>}
    {error&&<p role="alert" className="mt-4 rounded-xl border border-wk-danger p-3 text-sm text-wk-danger">{error}</p>}
  </Modal>;
}
