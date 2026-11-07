import { useRef, useState } from 'react';
import { TextArea, TextField } from 'react-aria-components';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/design-system/primitives/Modal';
import { WkDetailList } from '@/components/design-system/primitives/DetailList';

export type Wk100RecoveryKind =
  'request_retry'|'request_exception'|'accept_exception'|'reject_exception';
export type Wk100RecoveryTarget={
  id:string;sourceKey:string;surface:string;
  lastScheduledAt:string|null;lastAttemptNumber:number|null;
};
const EXPECTED:Record<Wk100RecoveryKind,string>={
  request_retry:'retry_requested',request_exception:'coverage_requested',
  accept_exception:'coverage_accepted',reject_exception:'coverage_rejected',
};
const TITLES:Record<Wk100RecoveryKind,string>={
  request_retry:'Request Source Retry',
  request_exception:'Request Coverage Review',
  accept_exception:'Record Coverage Decision',
  reject_exception:'Reject Coverage Request',
};
export function SourceRecoveryDialog({kind,source,week,revision,close,onSaved}:{
  kind:Wk100RecoveryKind;source:Wk100RecoveryTarget;week:string;
  revision:number;close:()=>void;onSaved:()=>void;
}){
  const [reason,setReason]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  // Retain the same operation identity after a lost response. A retry must
  // not create another durable action just because the browser timed out.
  const operationId=useRef(crypto.randomUUID());
  const valid=reason.trim().length>=8 && reason.trim().length<=500 &&
    !/[\x00-\x1F<>]/.test(reason.trim()) && reason===reason.trim();
  const submit=async()=>{
    if(saving||!valid)return;
    setSaving(true);setError('');
    try{
      const {data,error:rpcError}=await supabase.rpc('wk100_record_collection_action_v1',{
        p_action:kind,p_week:week,p_contract_id:source.id,
        p_scheduled_at:kind==='request_retry'?source.lastScheduledAt:null,
        p_expected_attempt_number:kind==='request_retry'?source.lastAttemptNumber:null,
        p_expected_revision:kind==='request_retry'?null:revision,
        p_operation_id:operationId.current,p_reason:reason,
      });
      if(rpcError){
        const code=String(rpcError.code??'');
        throw new Error(code==='42501'?'Your account cannot approve this action.':
          code==='40001'?'The source or review changed. Refresh before deciding.':
          code==='22023'?'This action is no longer eligible for the selected week.':
          'The recovery service did not confirm the action.');
      }
      const expectedAttempt=kind==='request_retry'?
        (source.lastAttemptNumber??0)+1:null;
      if(!data||data.recorded!==true||data.actionKind!==EXPECTED[kind]||
        data.weekStartEat!==week||data.contractId!==source.id||
        typeof data.actionId!=='string'||
        data.attemptNumber!==expectedAttempt||
        data.revision!==(kind==='request_retry'?0:revision+1)||
        data.canCollect!==false||data.canScore!==false||data.canPublish!==false)
        throw new Error('The server response did not confirm the requested action.');
      onSaved();close();
    }catch(e){
      setError(e instanceof Error?e.message:'The recovery action could not be recorded.');
    }finally{setSaving(false);}
  };
  return <Modal open={true} onClose={close} dismissable={!saving} maxWidth="lg"
    title={TITLES[kind]} footer={<div className="flex items-center justify-end gap-2">
      <button type="button" disabled={saving} className="wk-button wk-button-secondary wk-button-sm" onClick={close}>Cancel</button>
      <button type="button" disabled={!valid||saving} className="wk-button wk-button-primary wk-button-sm" onClick={()=>void submit()}>
        {saving?'Recording…':'Confirm Action'}
      </button>
    </div>}>
    <div className="space-y-4">
      <WkDetailList items={[
        {label:'Source',value:source.surface},
        {label:'EAT week',value:week},
        {label:'Source ID',value:source.sourceKey},
        ...(kind==='request_retry'?[
          {label:'Original slot',value:source.lastScheduledAt??'Unavailable'},
          {label:'Previous attempt',value:source.lastAttemptNumber??'Unavailable'},
        ]:[]),
      ]}/>
      <p className="text-sm leading-relaxed text-wk-text-muted">
        {kind==='request_retry'?
          'A retry stays inside the original collection window. The existing scheduler and capture lease decide whether an attempt can run. Recording a request does not mean collection succeeded.':
          'Coverage decisions document missing evidence. They cannot substitute earlier data, adjust source weights, or unlock ranking or publication.'}
      </p>
      <TextField aria-label="Reason" className="block" value={reason} onChange={v=>{setReason(v);setError('')}}>
        <span className="mb-1 block text-xs font-semibold text-wk-text-muted">Reason</span>
        <TextArea className="wk-input min-h-28 w-full rounded-xl border-wk-border bg-wk-surface text-[16px] text-wk-text"
          maxLength={500}/>
      </TextField>
      {error&&<p role="alert" className="rounded-xl border border-wk-danger p-3 text-sm text-wk-danger">{error}</p>}
    </div>
  </Modal>;
}
