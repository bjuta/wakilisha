const key = v => typeof v === 'string' ? v.slice(0,180) : '';
const integer = v => Number.isInteger(v) && v >= 0 ? v : 0;
const bounded = (v,max) => Number.isInteger(v) && v >= 0 && v <= max ? v : null;
export function validEatWeek(value) {
  if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value &&
    date.getUTCDay()===1;
}
export function projectWk100SourceHealth(contracts, attempts, weekStartEat) {
  if(!validEatWeek(weekStartEat)) throw new Error('week_invalid');
  if(!Array.isArray(contracts)||!Array.isArray(attempts)||
    contracts.length>100||attempts.length>1000) throw new Error('source_projection_unavailable');
  const sources=contracts.map(c=>{
    if(!c || typeof c.id!=='string' || typeof c.source_key!=='string') throw new Error('source_projection_invalid');
    const history=attempts.filter(a=>a && a.contract_id===c.id && a.week_start_eat===weekStartEat);
    history.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    const latest=history[0];
    const success=history.find(a=>['succeeded','partial_depth'].includes(a.status));
    return {
      id:key(c.id),sourceKey:key(c.source_key),provider:key(c.provider_key),
      surface:key(c.source_surface),market:key(c.market),
      metric:key(c.native_metric),behavior:key(c.behavior),expectedDepth:integer(c.expected_depth),
      cadence:key(c.cadence_kind),version:key(c.contract_version),
      intervalHours:bounded(c.interval_hours,24),eatHour:bounded(c.eat_hour,23),
      eatMinute:bounded(c.eat_minute,59),weekdayEat:bounded(c.weekday_eat,6),
      minimumHealthyCheckpoints:integer(c.minimum_healthy_checkpoints),
      adapterVersion:key(c.adapter_version),
      admissionState:'candidate', // This legacy capture contract cannot be 'qualified'.
      captureState: latest ? key(latest.status) : 'not_collected',
      attemptCount:history.length,lastAttemptAt:latest?.created_at||null,
      lastScheduledAt:typeof latest?.scheduled_at==='string'?latest.scheduled_at:null,
      lastAttemptNumber:Number.isInteger(latest?.attempt_number)&&latest.attempt_number>=1&&latest.attempt_number<=8?latest.attempt_number:null,
      lastSuccessfulAt:success?.fetched_at||null,
      observedDepth:integer(success?.observed_depth),
      nativePeriodAuthority:key(success?.native_period_authority||'unknown'),
      nativePeriodStart:success?.native_period_start||null,
      nativePeriodEnd:success?.native_period_end||null,
      receiptSha256: typeof success?.payload_sha256==='string' && /^[a-f0-9]{64}$/.test(success.payload_sha256) ? success.payload_sha256:null,
      failureCode:latest?.failure_code?key(latest.failure_code):null,
      recentAttempts:history.slice(0,12).map(a=>({
        id:key(a.id),status:key(a.status),attemptedAt:a.created_at||null,
        scheduledAt:typeof a.scheduled_at==='string'?a.scheduled_at:null,
        attemptNumber:Number.isInteger(a.attempt_number)&&a.attempt_number>=1&&a.attempt_number<=8?a.attempt_number:null,
        fetchedAt:a.fetched_at||null,failureCode:a.failure_code?key(a.failure_code):null,
        observedDepth:integer(a.observed_depth),
      })),
      canScore:false,canPublish:false,
    };
  });
  return {
    schemaVersion:'wk100-admin-source-health-v1',weekStartEat,
    sourceCount:sources.length,successfulSources:sources.filter(s=>!!s.receiptSha256).length,
    failedSources:sources.filter(s=>['transport_failed','parse_failed','target_period_unavailable','missed'].includes(s.captureState)).length,
    qualifiedSources:0,canScore:false,canPublish:false,sources,
  };
}
