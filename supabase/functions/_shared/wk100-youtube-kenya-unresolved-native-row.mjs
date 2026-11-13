/**
 * Candidate-only YouTube Kenya Top Songs decoder with one unresolved video ID.
 * The shared parser remains byte-identical for Apple, Shazam and Mdundo.
 * No source admission, collection, scoring or publication is granted here.
 */
import {parseYouTubeKenyaWeekly} from './chart-public-source-observations.mjs';
const ENDPOINT='https://charts.youtube.com/youtubei/v1/browse?alt=json';
const PERIOD=/^weekly:(\d{8}):(\d{8}):ke$/;
const VIDEO=/^[a-zA-Z0-9_-]{11}$/;
const fail=()=>{throw new Error('youtube_native_row_unverified');};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x:null;
const arr=x=>Array.isArray(x)?x:[];
const txt=(x,max=500)=>typeof x==='string'&&x.trim()&&x.trim().length<=max?x.trim():null;
const count=x=>{
  const s=(typeof x==='string'||typeof x==='number')?String(x).replace(/,/g,''):'';
  if(!/^\d{1,15}$/.test(s))throw new Error('youtube_missing_native_view_count');
  const n=Number(s);
  if(!Number.isSafeInteger(n))throw new Error('youtube_missing_native_view_count');
  return n;
};
/** Preserve native rank/count; never substitute an opaque chart ID for a video. */
export function parseYouTubeKenyaWeeklyCandidate(payload,targetPeriodKey,access={}){
  try{
    const full=parseYouTubeKenyaWeekly(payload,targetPeriodKey,access);
    return {...full,unresolved_provider_identity_rows:0};
  }catch(e){
    if(!(e instanceof Error)||e.message!=='youtube_native_row_unverified')throw e;
  }
  if(access?.endpoint!==ENDPOINT)fail();
  const target=typeof targetPeriodKey==='string'?PERIOD.exec(targetPeriodKey):null;
  if(!target)fail();
  const list=obj(obj(payload?.contents)?.sectionListRenderer),candidates=[];
  for(const section of arr(list?.contents)){
    const content=obj(obj(section?.musicAnalyticsSectionRenderer)?.content);
    for(const item of arr(content?.trackTypes)){
      const x=obj(item);
      if(x&&(x.listType==='TOP_VIEWS_CHART'||x.chartPeriodType==='CHART_PERIOD_TYPE_WEEKLY'))
        candidates.push(x);
    }
  }
  if(candidates.length!==1)fail();
  const chart=candidates[0];
  if(chart.listType!=='TOP_VIEWS_CHART'||chart.chartPeriodType!=='CHART_PERIOD_TYPE_WEEKLY'||
    typeof chart.endDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(chart.endDate)||
    chart.endDate.replaceAll('-','')!==target[2])fail();
  const end=Date.parse(chart.endDate+'T00:00:00Z');
  if(!Number.isFinite(end)||new Date(end).toISOString().slice(0,10)!==chart.endDate||
    new Date(end).getUTCDay()!==4||
    new Date(end-6*86400000).toISOString().slice(0,10).replaceAll('-','')!==target[1])fail();
  if(!Array.isArray(chart.trackViews)||chart.trackViews.length!==100)fail();
  const ids=new Set(),videos=new Set();let missing=0;
  const rows=chart.trackViews.map((entry,i)=>{
    const item=obj(entry),meta=obj(item?.chartEntryMetadata);
    const rank=Number(meta?.currentPosition);
    if(!Number.isSafeInteger(rank)||rank!==i+1)fail();
    const nativeId=txt(item?.id,180);
    if(!nativeId||/[\u0000-\u001f\u007f]/.test(nativeId)||ids.has(nativeId))fail();
    ids.add(nativeId);
    const title=txt(item?.name);
    if(!title)fail();
    const video=txt(item?.encryptedVideoId,180);
    if(video===null)missing++;
    else if(!VIDEO.test(video)||videos.has(video))fail();
    else videos.add(video);
    const view_count=count(item?.viewCount);
    const artist=arr(item?.artists).map(a=>txt(obj(a)?.name)).filter(Boolean).join(', ')||null;
    return {rank,provider_track_id:video,title,artist,view_count};
  });
  if(missing!==1||videos.size!==99)fail();
  return {
    source_key:'youtube_ke',market:'KE',chart_depth:100,observed_depth:100,
    censoring:'top_n',native_period:'unknown',candidate_only:true,
    eligible_for_scoring:false,status:'succeeded',behavior:'video_consumption',
    metric:'rank_and_count',source_period_key:targetPeriodKey,
    provider_period_type:'weekly',provider_week_ending_date:chart.endDate,
    unresolved_provider_identity_rows:1,rows,
  };
}
