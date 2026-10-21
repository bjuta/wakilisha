import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminUser } from '@/hooks/useAdminUser';
import { AdminChartsPageHeader } from '../components/AdminChartsPageHeader';

type PreviewRow = { rank: number; recording_id: string; corroborating_operators: number };
type PreviewResult = {
  status: 'synthetic_preview';
  week_start_eat: string;
  method_status: string;
  operator_count: number;
  behavior_count: number;
  coverage_status: string;
  recording_count: number;
  corroborated_top100: number;
  failure_codes: string[];
  entries: PreviewRow[];
  can_publish: false;
};
export default function Wk100PrivatePreviewPage() {
  const user = useAdminUser();
  const allowed = user.role === 'super_admin' || user.role === 'administrator';
  const [result, setResult] = useState<PreviewResult|null>(null);
  const [phase, setPhase] = useState<'idle'|'loading'|'ready'|'unavailable'>('idle');
  const fetchPreview=useCallback(async()=>{
    setPhase('loading');
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('wk100-private-admin-preview', { body: { action: 'read' } });
      if(error || !data || data.status!=='synthetic_preview' || data.can_publish!==false ||
        !Array.isArray(data.entries) || data.entries.length>100) throw new Error('invalid_preview');
      setResult(data as PreviewResult);
      setPhase('ready');
    } catch {
      setPhase('unavailable');
    }
  },[]);
  useEffect(()=>{
    if (!user.loading && allowed) void fetchPreview();
  },[user.loading,allowed,fetchPreview]);
  if(user.loading) return <div className="p-6 text-wk-text-muted" role="status">Checking access…</div>;
  if(!allowed) return <section className="p-6" role="alert"><h1 className="text-xl font-bold text-wk-text">Restricted WK100 workspace</h1><p className="mt-2 text-sm text-wk-text-muted">Access is limited to active administrators. No private source information has been loaded.</p></section>;
  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminChartsPageHeader
        eyebrow="WAKILISHA 100 / Restricted"
        title="Private Ranking Preview"
        description="Review an internal synthetic chart run. No sources, private weights, or evidence files are sent to this page."
      >
        <button type="button" onClick={()=>void fetchPreview()} disabled={phase==='loading'}
          className="wk-button wk-button-secondary wk-button-sm">{phase==='loading'?'Checking…':'Refresh Preview'}</button>
      </AdminChartsPageHeader>
      <div className="rounded-xl border border-wk-border bg-wk-surface p-4 text-[13px] text-wk-text">
        <p className="font-semibold">Publication remains locked</p>
        <p className="mt-1 text-wk-text-muted">This workspace does not create a chart edition, approve provider access, or publish rankings. The actual source list and calculation settings remain server-side.</p>
      </div>
      {phase==='loading' && <div className="rounded-xl border border-wk-border p-6 text-sm text-wk-text-muted" role="status">Reading the private preview…</div>}
      {phase==='unavailable' && <div className="rounded-xl border border-wk-border bg-wk-surface p-6" role="status">
        <h2 className="text-base font-semibold text-wk-text">No approved preview configured</h2>
        <p className="mt-2 text-[13px] text-wk-text-muted">The restricted server has not supplied a sealed synthetic preview. No provider data was requested and no ranking was published.</p>
      </div>}
      {phase==='ready' && result && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Operators',result.operator_count],['Behaviors',result.behavior_count],
            ['Identified recordings',result.recording_count],['Corroborated Top 100',result.corroborated_top100],
          ].map(([label,value])=><div key={label} className="rounded-xl border border-wk-border bg-wk-surface p-4"><div className="text-xs text-wk-text-muted">{label}</div><div className="mt-1 text-2xl font-bold text-wk-text">{value}</div></div>)}
        </div>
        <div className="rounded-xl border border-wk-border bg-wk-surface p-4 text-[13px]">
          <div className="font-semibold text-wk-text">Synthetic week: {result.week_start_eat}</div>
          <p className="mt-1 text-wk-text-muted">Coverage: {result.coverage_status.replaceAll('_',' ')}. The formula is provisional. Source rights, actual provenance, and real recording identities have not been verified.</p>
          {result.failure_codes.length>0&&<p className="mt-2 text-wk-text-muted">Quality gaps: {result.failure_codes.join(', ').replaceAll('_',' ')}</p>}
        </div>
        <section className="overflow-hidden rounded-xl border border-wk-border bg-wk-surface">
          <h2 className="px-4 py-3 text-base font-bold text-wk-text">Provisional rankings (synthetic)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-y border-wk-border text-wk-text-muted"><tr><th className="px-4 py-2">Rank</th><th className="px-4 py-2">Recording ID</th><th className="px-4 py-2">Operators</th></tr></thead>
              <tbody>{result.entries.map(row=><tr key={row.recording_id} className="border-b border-wk-border/60"><td className="px-4 py-2 font-semibold text-wk-text">{row.rank}</td><td className="px-4 py-2 font-mono text-xs text-wk-text-muted">{row.recording_id}</td><td className="px-4 py-2 text-wk-text">{row.corroborating_operators}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </>}
    </div>
  );
}
