import { useState } from 'react';
import { Input, TextArea, TextField } from 'react-aria-components';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/design-system/primitives/Modal';
import { WkSelect } from '@/components/design-system/primitives/Select';
import { WkDetailList } from '@/components/design-system/primitives/DetailList';
import type { Wk100ProposalRecord } from './SourceProposalForm';

export type Wk100MethodDecision={
  sourceKey:string;providerKey:string;proposalRevision:number;decisionRevision:number;
  decisionState:'held'|'collector_admitted'|'paused'|'retired';constitutionVersion:string;
  createdAt:string;hasMethodEvidence:boolean;nativePeriodAuthority:string|null;
  captureContractVersion?:string|null;
  canScore:false;canPublish:false;
};
type State=Wk100MethodDecision['decisionState'];
type PeriodAuthority='provider_defined'|'observed_as_of';
type Field='constitutionVersion'|'reason'|'nativePeriodEvidenceRef'|'endpointSha256'|
  'accessEvidenceSha256'|'authorizationRef'|'authorizationExpiresAt';
type Draft={decisionState:State;constitutionVersion:string;reason:string;
  nativePeriodEvidenceRef:string;endpointSha256:string;
  accessEvidenceSha256:string;authorizationRef:string;authorizationExpiresAt:string};
const PARSERS:Record<string,string>={
  youtube_ke:'youtube_kenya_weekly_top_songs_v1',apple_ke:'apple_kenya_chart_v1',
  boomplay_ke:'boomplay_kenya_chart_v1',mdundo_ke:'mdundo_kenya_chart_v1',
  shazam_ke:'shazam_kenya_discovery_v1',spotify_ke:'spotify_kenya_offered_chart_csv_v1',
  audiomack_ke:'audiomack_kenya_chart_v1',
};
function ReviewField({label,value,onChange,limit,area=false}:{
  label:string;value:string;onChange:(v:string)=>void;limit:number;area?:boolean;
}){
  return <TextField aria-label={label} value={value} onChange={onChange} className="block min-w-0">
    <span className="mb-1 block text-xs font-semibold text-wk-text-muted">{label}</span>
    {area?<TextArea maxLength={limit} className="wk-input min-h-24 w-full rounded-xl border-wk-border bg-wk-surface text-[16px] text-wk-text"/>:
      <Input maxLength={limit} className="wk-input w-full rounded-xl border-wk-border bg-wk-surface text-[16px] text-wk-text"/>}
  </TextField>;
}
export function SourceMethodReviewForm({proposal,previous,initialDecisionState='held',close,onSaved}:{
  proposal:Wk100ProposalRecord;previous:Wk100MethodDecision|null;
  initialDecisionState?:State;
  close:()=>void;onSaved:()=>void;
}){
  const [draft,setDraft]=useState<Draft>({
    decisionState:initialDecisionState,constitutionVersion:previous?.constitutionVersion??'',reason:'',
    nativePeriodEvidenceRef:'',endpointSha256:'',
    accessEvidenceSha256:'',authorizationRef:'',authorizationExpiresAt:'',
  });
  const [periodAuthority,setPeriodAuthority]=useState<PeriodAuthority>(
    previous?.nativePeriodAuthority==='observed_as_of'?'observed_as_of':'provider_defined');
  const [saving,setSaving]=useState(false);
  const [enrolling,setEnrolling]=useState(false);
  const [contractVersion,setContractVersion]=useState('');
  const [adapterSha256,setAdapterSha256]=useState('');
  const [error,setError]=useState('');
  const change=(key:Field,value:string)=>{
    setDraft(d=>({...d,[key]:value}));setError('');
  };
  const admitted=draft.decisionState==='collector_admitted';
  const supportsObservedAsOf=['apple_ke','shazam_ke','mdundo_ke','audiomack_ke'].includes(proposal.providerKey);
  const parser=PARSERS[proposal.providerKey]??null;
  const allowedAdmission=!!parser&&proposal.methodClass!=='research_only'&&
    (proposal.providerKey!=='spotify_ke'||(proposal.methodClass==='offered_export'&&
      proposal.behavior==='consumption'&&proposal.metric==='rank_and_count'&&
      proposal.cadence==='weekly'));
  const valid=draft.constitutionVersion.trim().length>=2&&
    (!admitted||periodAuthority==='provider_defined'||
      (supportsObservedAsOf&&
       /^observed_as_of\/[a-z0-9][a-z0-9_.-]{2,119}$/.test(draft.nativePeriodEvidenceRef.trim())))&&
    draft.reason.trim().length>=6&&
    (!admitted||(allowedAdmission&&
      draft.nativePeriodEvidenceRef.trim().length>=3&&
      /^[a-f0-9]{64}$/.test(draft.endpointSha256)&&
      /^[a-f0-9]{64}$/.test(draft.accessEvidenceSha256)&&
      draft.authorizationRef.trim().length>=3&&
      draft.authorizationExpiresAt.trim().length>=20));
  const canEnroll=initialDecisionState!=='paused' && previous?.decisionState==='collector_admitted' &&
    previous.proposalRevision===proposal.revision &&
    !previous.captureContractVersion;
  const enrollmentValid=canEnroll&&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(contractVersion)&&
    /^[a-f0-9]{64}$/.test(adapterSha256);
  const enrollContract=async()=>{
    if(!enrollmentValid||saving||enrolling||!previous)return;
    setEnrolling(true);setError('');
    try{
      const enrollment={
        sourceKey:proposal.sourceKey,contractVersion,
        adapterSha256,
        expectedProposalRevision:proposal.revision,
        expectedDecisionRevision:previous.decisionRevision,
      };
      const {data,error:callError}=await supabase.functions.invoke(
        'wk100-source-admin-methods',{
          body:{action:'enroll_capture_contract',enrollment},
        });
      if(callError||!data||
        data.schemaVersion!=='wk100-capture-contract-enrolled-v1'||
        data.canCollect!==false||data.canScore!==false||
        data.canPublish!==false||!data.enrollment||
        data.enrollment.sourceKey!==proposal.sourceKey||
        data.enrollment.contractVersion!==contractVersion||
        data.enrollment.proposalRevision!==proposal.revision||
        data.enrollment.decisionRevision!==previous.decisionRevision||
        data.enrollment.state!=='candidate'||
        data.enrollment.canCollect!==false||
        data.enrollment.canScore!==false||
        data.enrollment.canPublish!==false||
        typeof data.enrollment.contractId!=='string')
        throw new Error(data?.error==='contract_enrollment_conflict'
          ?'The source method or contract changed. Refresh before enrolling.'
          :'The protected server did not confirm enrollment. Nothing is assumed saved.');
      onSaved();close();
    }catch(e){
      setError(e instanceof Error?e.message:'The capture contract could not be enrolled.');
    }finally{setEnrolling(false);}
  };
  const submit=async()=>{
    if(saving||enrolling||!valid)return;
    setSaving(true);setError('');
    try{
      const decision={
        sourceKey:proposal.sourceKey,providerKey:proposal.providerKey,
        proposalRevision:proposal.revision,decisionState:draft.decisionState,
        parserClass:admitted?parser:null,
        methodClass:proposal.methodClass,
        nativePeriodAuthority:admitted?periodAuthority:null,
        nativePeriodEvidenceRef:admitted?draft.nativePeriodEvidenceRef.trim():null,
        endpointSha256:admitted?draft.endpointSha256:null,
        accessEvidenceSha256:admitted?draft.accessEvidenceSha256:null,
        authorizationRef:admitted?draft.authorizationRef.trim():null,
        authorizationExpiresAt:admitted?draft.authorizationExpiresAt.trim():null,
        constitutionVersion:draft.constitutionVersion.trim(),
        reason:draft.reason.trim(),
      };
      const expectedDecisionRevision=previous?.decisionRevision??0;
      const {data,error:callError}=await supabase.functions.invoke('wk100-source-admin-methods',{
        body:{action:'review_source_method',decision,expectedDecisionRevision},
      });
      if(callError||!data||data.schemaVersion!=='wk100-source-method-written-v1'||
        data.canCollect!==false||data.canScore!==false||data.canPublish!==false||
        !data.saved||data.saved.sourceKey!==proposal.sourceKey||
        data.saved.providerKey!==proposal.providerKey||
        data.saved.proposalRevision!==proposal.revision||
        data.saved.decisionRevision!==expectedDecisionRevision+1||
        data.saved.decisionState!==draft.decisionState||
        data.saved.canScore!==false||data.saved.canPublish!==false)
        throw new Error(data?.error==='method_revision_conflict'
          ?'This method review changed. Refresh the Source Registry before saving.'
          :'The protected server did not confirm this decision. Nothing is assumed saved.');
      onSaved();close();
    }catch(e){setError(e instanceof Error?e.message:'The method decision could not be saved.');}
    finally{setSaving(false);}
  };
  return <Modal open={true} onClose={close} dismissable={!saving&&!enrolling} maxWidth="3xl"
    title={initialDecisionState==='paused'?'Pause Source Method':'Review Source Method'}
    footer={<div className="flex items-center justify-end gap-3">
      <button type="button" disabled={saving||enrolling} className="wk-button wk-button-secondary wk-button-sm" onClick={close}>Cancel</button>
      <button type="button" disabled={!valid||saving||enrolling} className="wk-button wk-button-primary wk-button-sm" onClick={()=>void submit()}>
        {saving?'Saving…':initialDecisionState==='paused'?'Confirm Pause':'Save method decision'}
      </button>
    </div>}>
    <div className="space-y-4">
      <p className="text-sm text-wk-text-muted">
        {initialDecisionState==='paused'
          ?'Pause the reviewed source method. The collector checks this authority again before transport. Original receipts remain unchanged.'
          :'Review the specific source and its evidence. A method decision does not start collection or authorize ranking.'}
      </p>
      <WkDetailList items={[
        {label:'Provider and source',value:proposal.providerKey+' · '+proposal.sourceKey},
        {label:'Source surface',value:proposal.surface},
        {label:'Proposal revision',value:proposal.revision},
        {label:'Previous decision',value:previous?previous.decisionState.replaceAll('_',' ')+' · revision '+previous.decisionRevision:'No decision recorded'},
        {label:'Method class',value:proposal.methodClass.replaceAll('_',' ')},
        {label:'Native parser class',value:parser??'Not implemented'},
      ]}/>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-wk-text-muted">Decision</p>
        {initialDecisionState==='paused'
          ?<p className="rounded-xl border border-wk-border px-3 py-2 text-sm text-wk-text">Pause reviewed method</p>
          :<WkSelect ariaLabel="Method decision" value={draft.decisionState}
            onChange={value=>setDraft(d=>({...d,decisionState:value as State}))}
            options={[
              {value:'held',label:'Hold for evidence'},
              {value:'collector_admitted',label:'Admit reviewed method'},
              {value:'paused',label:'Pause reviewed method'},
              {value:'retired',label:'Retire source method'},
            ]}/>}
      </div>
      <ReviewField label="Constitution version" limit={100}
        value={draft.constitutionVersion} onChange={v=>change('constitutionVersion',v)}/>
      <ReviewField label="Decision reason" limit={500} area
        value={draft.reason} onChange={v=>change('reason',v)}/>
      {admitted&&<div className="space-y-4 rounded-xl border border-wk-border p-4">
        <p className="text-xs font-semibold text-wk-text">Independent source-method evidence</p>
        {!allowedAdmission&&<p role="alert" className="text-sm text-wk-danger">
          This provider method cannot be admitted for unattended collection. Record a hold instead.
        </p>}
        <WkSelect ariaLabel="Period authority" value={periodAuthority}
          onChange={value=>{setPeriodAuthority(value as PeriodAuthority);setError('');}}
          options={[
            {value:'provider_defined',label:'Provider-declared reporting period or chart date'},
            ...(supportsObservedAsOf?[
              {value:'observed_as_of',label:'WAKILISHA observed-as-of (native period unknown)'},
            ]:[]),
          ]}/>
        <p className="text-xs leading-relaxed text-wk-text-muted">
          Observed-as-of means the source rank was visible when our collector captured
          the original bytes. It does not mean the activity happened that day.
          A provider chart date remains source evidence even when full reporting bounds are unknown.
          YouTube's period-bound adapter and Spotify's weekly chart export still require separate native-period qualification.
        </p>
        <ReviewField label={periodAuthority==='observed_as_of'
          ?'Missing-period review reference (observed_as_of/review-id)'
          :'Provider-native period evidence reference'} limit={240}
          value={draft.nativePeriodEvidenceRef} onChange={v=>change('nativePeriodEvidenceRef',v)}/>
        <ReviewField label="Reviewed endpoint SHA-256 (hex only)" limit={64}
          value={draft.endpointSha256} onChange={v=>change('endpointSha256',v)}/>
        <ReviewField label="Access evidence SHA-256 (hex only)" limit={64}
          value={draft.accessEvidenceSha256} onChange={v=>change('accessEvidenceSha256',v)}/>
        <ReviewField label="Approved credential reference (not a secret)" limit={120}
          value={draft.authorizationRef} onChange={v=>change('authorizationRef',v)}/>
        <ReviewField label="Permission expiry UTC (YYYY-MM-DDTHH:MM:SSZ)" limit={45}
          value={draft.authorizationExpiresAt} onChange={v=>change('authorizationExpiresAt',v)}/>
        <p className="text-xs text-wk-text-muted">
          Enter evidence identifiers only. Never paste an access token, password or provider URL.
          The server independently verifies this review and the reviewer’s authority.
        </p>
      </div>}
      {initialDecisionState!=='paused'&&previous?.decisionState==='collector_admitted'&&
        previous.proposalRevision===proposal.revision&&
        <div className="space-y-4 rounded-xl border border-wk-border p-4">
          <p className="text-xs font-semibold text-wk-text">Capture contract enrollment</p>
          <p className="text-xs leading-relaxed text-wk-text-muted">
            Restricted to super-admins with current chart and ingest management permission.
            Enrollment records an immutable candidate contract and operator provenance.
            It does not start collection, score evidence, or publish a chart.
          </p>
          {previous.captureContractVersion?
            <p role="status" className="text-sm text-wk-text">
              Contract {previous.captureContractVersion} enrolled · Collection Off
            </p>:
            <>
              <ReviewField label="Capture contract version" limit={64}
                value={contractVersion} onChange={v=>{setContractVersion(v);setError('')}}/>
              <ReviewField label="Verified adapter SHA-256" limit={64}
                value={adapterSha256} onChange={v=>{setAdapterSha256(v);setError('')}}/>
              <button type="button" className="wk-button wk-button-secondary wk-button-sm"
                disabled={!enrollmentValid||saving||enrolling}
                onClick={()=>void enrollContract()}>
                {enrolling?'Enrolling…':'Enroll candidate capture contract'}
              </button>
            </>}
        </div>}
      <p className="rounded-xl bg-wk-surface-raised p-3 text-xs text-wk-text-muted">
        All decisions append a permanent audit revision. Collection stays off until the independent
        source-access and scheduler gates are accepted. This review cannot publish a chart.
      </p>
      {error&&<p role="alert" className="rounded-xl border border-wk-danger p-3 text-sm text-wk-danger">{error}</p>}
    </div>
  </Modal>;
}
